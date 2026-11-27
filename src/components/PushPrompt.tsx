import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { enablePush, getPushState } from "@/lib/push";

const DISMISS_KEY = "plai-push-prompt-dismissed";

/** One-time card at the top of the friends feed: "turn on notifications". Hidden once answered. */
const PushPrompt = () => {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {}
    getPushState().then((s) => setShow(s === "off"));
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <BellRing className="h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground">
        Get a notification when friends send you songs or add new music.
      </p>
      <button
        onClick={async () => {
          setBusy(true);
          try {
            const s = await enablePush();
            if (s === "on") toast.success("notifications on ✓");
            if (s === "on" || s === "blocked") dismiss();
          } catch (err: any) {
            toast.error(err?.message || "couldn't turn on notifications");
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
        style={{ touchAction: "manipulation" }}
      >
        turn on
      </button>
      <button onClick={dismiss} aria-label="not now" className="shrink-0 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default PushPrompt;
