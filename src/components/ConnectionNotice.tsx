import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * "Your Spotify connection expired — reconnect": shown at the top of the friends feed when the
 * background sync couldn't sign in to one of your music apps. Hidden for the session once closed.
 */

export const PLATFORM_NAMES: Record<string, string> = {
  spotify: "Spotify",
  "apple-music": "Apple Music",
  tidal: "Tidal",
  youtube: "YouTube Music",
};

let dismissed = false;
let cache: string[] | null = null;

/** Your apps that need reconnecting (shared by the feed notice and Settings) */
export function useConnectionIssues(): [string[], () => void] {
  const { user } = useAuth();
  const [issues, setIssues] = useState<string[]>(cache || []);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!user) return;
    (supabase as any).rpc("my_connection_issues").then(({ data }: { data: { platform: string }[] | null }) => {
      cache = (data || []).map((r) => r.platform).filter((p) => PLATFORM_NAMES[p]);
      setIssues(cache);
    });
  }, [user, version]);

  return [issues, () => setVersion((v) => v + 1)];
}

/** After reconnecting an app: forget its old failures so the notice disappears right away */
export async function clearConnectionIssue(platform: keyof typeof PLATFORM_NAMES | string) {
  cache = (cache || []).filter((p) => p !== platform);
  try {
    await (supabase as any).rpc("clear_connection_issue", { p_platform: platform });
  } catch {}
}

const ConnectionNotice = () => {
  const navigate = useNavigate();
  const [issues] = useConnectionIssues();
  const [hidden, setHidden] = useState(dismissed);
  if (hidden || issues.length === 0) return null;

  const names = issues.map((p) => PLATFORM_NAMES[p]);
  const label = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return (
    <div role="status" className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-card px-4 py-3">
      <AlertCircle className="h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground">
        Your {label} connection expired, so new songs aren't syncing.
      </p>
      <button
        onClick={() => navigate("/settings#connected-platforms")}
        className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
      >
        reconnect
      </button>
      <button
        onClick={() => {
          dismissed = true;
          setHidden(true);
        }}
        aria-label="hide"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default ConnectionNotice;
