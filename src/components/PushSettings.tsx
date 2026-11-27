import { useEffect, useState } from "react";
import { toast } from "sonner";
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from "@/lib/push";

/** Settings → notifications: turn lock-screen alerts on/off for this device, send a test */
const PushSettings = () => {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      const next = state === "on" ? await disablePush() : await enablePush();
      setState(next);
      if (next === "on") toast.success("notifications on ✓");
      if (next === "blocked") toast("notifications are blocked for PLAI — allow them in your phone's settings");
    } catch (err: any) {
      toast.error(err?.message || "couldn't change notifications — try again");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const sent = await sendTestPush();
      toast(sent > 0 ? "test sent — check your lock screen" : "no devices to send to — turn notifications on first");
    } catch (err: any) {
      toast.error(err?.message || "couldn't send a test");
    } finally {
      setBusy(false);
    }
  };

  const help: Record<PushState, string> = {
    on: "on for this device: songs friends send you, reactions, new followers, and music from people you've belled",
    off: "get a notification when friends send you songs, react, or add new music",
    blocked: "notifications are blocked for PLAI. Turn them on in your phone's Settings → Notifications → PLAI",
    "needs-home-screen": "on iPhone, notifications work in the home-screen app: Share → Add to Home Screen, then open PLAI from there",
    unsupported: "this browser can't show notifications",
  };

  return (
    <div className="border-t border-border pt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1">notifications</h3>
      <p className="text-[11px] leading-relaxed text-muted-foreground mb-3">{state ? help[state] : "checking…"}</p>
      {(state === "on" || state === "off") && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggle}
            disabled={busy}
            className={
              state === "on"
                ? "rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
                : "rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
            }
            style={{ touchAction: "manipulation" }}
          >
            {state === "on" ? "turn off" : "turn on notifications"}
          </button>
          {state === "on" && (
            <button
              onClick={test}
              disabled={busy}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
              style={{ touchAction: "manipulation" }}
            >
              send a test
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PushSettings;
