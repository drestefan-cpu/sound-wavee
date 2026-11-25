import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FollowButton from "@/components/FollowButton";
import { useSheetDrag } from "@/hooks/useSheetDrag";

/**
 * Following / followers sheet (opened from the counts at the top of a profile). On your own
 * profile, each person shows your taste match with them.
 */

interface FollowersModalProps {
  profileId: string;
  mode: "followers" | "following";
  onClose: () => void;
  /** Show the viewer's taste match % next to each person (own profile only) */
  showMatches?: boolean;
}

interface Person {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

let matchCache: Map<string, number | null> | null = null;

const FollowersModal = ({ profileId, mode: initialMode, onClose, showMatches = false }: FollowersModalProps) => {
  const [mode, setMode] = useState(initialMode);
  const [users, setUsers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Map<string, number | null>>(matchCache || new Map());
  const { panelRef, handlers, sheetStyle, backdropStyle, close } = useSheetDrag(onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      const { data } =
        mode === "followers"
          ? await supabase
              .from("follows")
              .select("follower_id, profiles!follows_follower_id_fkey(id, display_name, username, avatar_url)")
              .eq("following_id", profileId)
          : await supabase
              .from("follows")
              .select("following_id, profiles!follows_following_id_fkey(id, display_name, username, avatar_url)")
              .eq("follower_id", profileId);
      setUsers(((data || []) as any[]).map((d) => d.profiles).filter(Boolean));
      setLoading(false);
    };
    load();
  }, [profileId, mode]);

  useEffect(() => {
    if (!showMatches || matchCache) return;
    (supabase as any).rpc("my_friend_matches").then(({ data }: { data: { user_id: string; score: number | null }[] | null }) => {
      matchCache = new Map((data || []).map((m) => [m.user_id, m.score]));
      setMatches(matchCache);
    });
  }, [showMatches]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center backdrop-blur-sm sm:items-center"
      style={backdropStyle}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={mode}
    >
      <div
        ref={panelRef}
        className="relative flex max-h-[80dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card motion-safe:animate-sheet-up sm:mx-4 sm:max-w-md sm:rounded-2xl sm:motion-safe:animate-pop-in"
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 px-5 pb-3 pt-2" {...handlers}>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
          <button
            onClick={close}
            aria-label="close"
            className="absolute right-3 top-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="inline-flex rounded-full border border-border bg-background p-0.5" role="tablist">
            {(["following", "followers"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-full px-4 py-1 text-xs font-medium transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border px-5 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {mode === "followers" ? "no followers yet" : "not following anyone yet"}
            </p>
          ) : (
            <ul className="space-y-1">
              {users.map((u) => {
                const score = matches.get(u.id);
                return (
                  <li key={u.id} className="flex items-center gap-3 rounded-xl py-2">
                    <Link to={`/profile/${u.username || u.id}`} onClick={close} className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-primary/20">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                            {(u.display_name || u.username || "U")[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{u.display_name || u.username || "User"}</p>
                        <p className="truncate text-xs text-muted-foreground">@{u.username || "user"}</p>
                      </div>
                    </Link>
                    {showMatches && typeof score === "number" && (
                      <span
                        className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary"
                        title="taste match"
                        aria-label={`${score}% taste match`}
                      >
                        {score}%
                      </span>
                    )}
                    <FollowButton targetUserId={u.id} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default FollowersModal;
