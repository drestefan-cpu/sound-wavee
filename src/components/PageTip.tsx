import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

/**
 * First-visit tip card: a few short steps explaining what's on a page. Shown once per tip id
 * (remembered on this device); Settings → "show tips again" brings them back.
 */

export interface TipStep {
  icon: LucideIcon;
  title: string;
  body: ReactNode;
}

const KEY = "plai-tips-seen";

const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

export const markTipSeen = (id: string) => {
  try {
    const seen = new Set(readSeen());
    seen.add(id);
    localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {}
};

export const resetTips = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {}
};

const PageTip = ({ id, steps, className = "" }: { id: string; steps: TipStep[]; className?: string }) => {
  const [open, setOpen] = useState(() => !readSeen().includes(id));
  const [i, setI] = useState(0);
  if (!open || steps.length === 0) return null;

  const step = steps[i];
  const Icon = step.icon;
  const last = i === steps.length - 1;
  const dismiss = () => {
    markTipSeen(id);
    setOpen(false);
  };

  return (
    <section
      aria-label="tip"
      className={`relative rounded-2xl border border-primary/25 bg-card p-4 motion-safe:animate-pop-in ${className}`}
    >
      <button
        onClick={dismiss}
        aria-label="hide tip"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex gap-3 pr-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{step.title}</p>
          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between pl-11">
        {steps.length > 1 ? (
          <div className="flex gap-1.5" aria-label={`step ${i + 1} of ${steps.length}`}>
            {steps.map((_, n) => (
              <button
                key={n}
                onClick={() => setI(n)}
                aria-label={`step ${n + 1}`}
                className={`h-1.5 rounded-full transition-all duration-200 ${n === i ? "w-4 bg-primary" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
        ) : (
          <span />
        )}
        <button
          onClick={() => (last ? dismiss() : setI(i + 1))}
          className="rounded-full px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {last ? "got it" : "next"}
        </button>
      </div>
    </section>
  );
};

export default PageTip;
