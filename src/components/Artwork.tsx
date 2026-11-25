import { useEffect, useState, type ReactNode } from "react";

/**
 * Album artwork that recovers by itself. A failed load (a network blip, the phone waking up)
 * used to leave a placeholder until you left the page; now it retries a few times with a short
 * pause, and starts fresh whenever the image address changes.
 */

const RETRY_DELAYS = [600, 2000, 5000];

interface Props {
  src?: string | null;
  className?: string;
  /** Shown when there's no artwork at all, or every retry failed */
  fallback?: ReactNode;
  /** Load straight away (e.g. the big cover in the song sheet) instead of when scrolled near */
  eager?: boolean;
}

const Artwork = ({ src, className = "h-full w-full object-cover", fallback, eager = false }: Props) => {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // New image → start over
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
    setLoaded(false);
  }, [src]);

  // Coming back online / back to the app → give a failed image another go
  useEffect(() => {
    if (!failed) return;
    const retry = () => {
      setFailed(false);
      setAttempt(0);
    };
    const onVisible = () => document.visibilityState === "visible" && retry();
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [failed]);

  if (!src || failed) return <>{fallback ?? <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">♪</div>}</>;

  return (
    <img
      key={`${src}#${attempt}`}
      src={src}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`${className} transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (attempt < RETRY_DELAYS.length) {
          const next = attempt + 1;
          setTimeout(() => setAttempt(next), RETRY_DELAYS[attempt]);
        } else {
          setFailed(true);
        }
      }}
    />
  );
};

export default Artwork;
