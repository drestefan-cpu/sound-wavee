import { supabase } from "@/integrations/supabase/client";

/**
 * Profile photo from the phone: crop to a square, shrink to 512px JPEG, upload to the
 * "avatars" bucket (avatars/<user id>/<time>.jpg) and save it on the profile.
 * Returns the new public URL.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("that file isn't a photo");

  const blob = await squareJpeg(file, 512);
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) throw new Error("couldn't upload the photo — try again");

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = data.publicUrl;
  const { error: saveError } = await supabase.from("profiles").update({ avatar_url: url } as any).eq("id", userId);
  if (saveError) throw new Error("couldn't save the photo — try again");
  return url;
}

async function squareJpeg(file: File, size: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("couldn't read that photo — try a different one"));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(size, side);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("couldn't read that photo");
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("couldn't read that photo"))), "image/jpeg", 0.86),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
