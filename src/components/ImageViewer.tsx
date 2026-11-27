import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Full-screen photo viewer: swipe between photos, tap the background or × to close */

interface Props {
  images: { url: string; caption?: string }[];
  start: number;
  onClose: () => void;
}

const ImageViewer = ({ images, start, onClose }: Props) => {
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [start, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[95] bg-black/95 motion-safe:animate-in motion-safe:fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="photo"
      onClick={onClose}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        aria-label="close"
        className="absolute right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <X className="h-5 w-5" />
      </button>
      <div
        ref={strip}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img, i) => (
          <figure key={img.url} className="flex h-full w-full shrink-0 snap-center flex-col items-center justify-center px-4">
            <img
              src={img.url}
              alt=""
              className="max-h-[80dvh] max-w-full rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {(img.caption || images.length > 1) && (
              <figcaption className="mt-3 text-[11px] text-white/60">
                {img.caption}
                {images.length > 1 && <span className="tabular-nums">{img.caption ? " · " : ""}{i + 1} / {images.length}</span>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>,
    document.body,
  );
};

export default ImageViewer;
