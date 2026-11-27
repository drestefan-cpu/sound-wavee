import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Invite links: plai.delaneyprojects.xyz/join/<username>.
 * The inviter is remembered on this device through sign-up; once the new account has a
 * username, accept_invite makes the two follow each other and tells the inviter.
 */

const KEY = "plai-invite";
export const APP_URL = "https://plai.delaneyprojects.xyz";

export const inviteLink = (username: string) => `${APP_URL}/join/${username}`;

export function rememberInvite(username: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ username: username.toLowerCase(), at: Date.now() }));
  } catch {}
}

/** The inviter's username, if an invite was opened on this device in the last 14 days */
export function pendingInvite(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!v?.username || Date.now() - v.at > 14 * 86400_000) return null;
    return v.username;
  } catch {
    return null;
  }
}

export function clearInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Apply a remembered invite (call once the account has a username) */
export async function applyPendingInvite(): Promise<void> {
  const inviter = pendingInvite();
  if (!inviter) return;
  const { data, error } = await (supabase as any).rpc("accept_invite", { p_username: inviter });
  if (error) return; // try again next time
  clearInvite();
  if (data === "joined") toast.success(`you and @${inviter} now follow each other 🎉`, { duration: 5000 });
  else if (data === "followed") toast(`you're following @${inviter}`);
}

/** Share sheet with your invite link (copies it where sharing isn't available) */
export async function shareInvite(username: string) {
  const url = inviteLink(username);
  const text = "come see what i'm listening to on PLAI, and our taste match";
  if (navigator.share) {
    try {
      await navigator.share({ title: "PLAI", text, url });
      return;
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast.success("invite link copied");
  } catch {
    toast(url);
  }
}
