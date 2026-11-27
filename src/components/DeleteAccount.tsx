import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Settings → delete my account (type your username to confirm) */
const DeleteAccount = ({ username }: { username: string }) => {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const word = username || "delete";

  const remove = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("delete-account", { body: { confirm: typed } });
    if (error || !(data as { deleted?: boolean })?.deleted) {
      let reason = "";
      try {
        reason = (await (error as { context?: Response })?.context?.json())?.error || "";
      } catch {}
      setBusy(false);
      toast.error(reason || "couldn't delete your account — try again");
      return;
    }
    await supabase.auth.signOut().catch(() => {});
    try {
      localStorage.clear();
    } catch {}
    window.location.href = "/";
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-center text-[11px] text-muted-foreground/60 transition-colors hover:text-destructive"
        style={{ touchAction: "manipulation" }}
      >
        delete my account
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-destructive/40 p-4">
      <p className="text-sm font-medium text-foreground">Delete your PLAI account?</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        This permanently removes your profile, your synced songs, your music-app connections, follows, songs you've
        sent and received, replies and photos. It can't be undone. Your music apps themselves aren't affected.
      </p>
      <label htmlFor="delete-confirm" className="mt-3 block text-[11px] text-muted-foreground">
        type <span className="font-medium text-foreground">{word}</span> to confirm
      </label>
      <input
        id="delete-confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        className="mt-1 w-full rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-destructive"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={remove}
          disabled={busy || typed.trim().toLowerCase().replace(/^@/, "") !== word.toLowerCase()}
          className="flex-1 rounded-full bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground disabled:opacity-40"
        >
          {busy ? "deleting…" : "delete forever"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground"
        >
          cancel
        </button>
      </div>
    </div>
  );
};

export default DeleteAccount;
