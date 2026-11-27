import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Song screen: what the people you follow have done with this song — loved it, saved it, reacted,
 * sent it to you (or you to them), made it their song of the week.
 */

type Row = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  loved: boolean;
  saved: boolean;
  emoji: string | null;
  sent_you: boolean;
  you_sent: boolean;
  pick: boolean;
};

const cache = new Map<string, Row[]>();

const describe = (r: Row) =>
  [
    r.pick && "song of the week 📌",
    r.sent_you && "sent it to you",
    r.loved && "loves it",
    !r.loved && r.saved && "saved it",
    r.emoji && `reacted ${r.emoji}`,
    r.you_sent && "you sent it to them",
  ].filter(Boolean) as string[];

const FriendsOnTrack = ({ trackId, onNavigate }: { trackId: string; onNavigate?: () => void }) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>(cache.get(trackId) || []);
  const [all, setAll] = useState(false);

  useEffect(() => {
    if (!user || cache.has(trackId)) return;
    (supabase as any).rpc("friends_on_track", { p_track_id: trackId }).then(({ data }: { data: Row[] | null }) => {
      cache.set(trackId, data || []);
      setRows(data || []);
    });
  }, [user, trackId]);

  if (rows.length === 0) return null;
  const shown = all ? rows : rows.slice(0, 3);

  return (
    <section className="mt-3 rounded-2xl border border-border px-4 py-2.5" aria-label="your friends and this song">
      <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">friends</p>
      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.user_id} className="flex items-center gap-2.5">
            <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-primary/20">
              {r.avatar_url ? (
                <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-primary">
                  {r.username[0].toUpperCase()}
                </span>
              )}
            </span>
            <p className="min-w-0 flex-1 text-xs leading-snug">
              <Link to={`/profile/${r.username}`} onClick={onNavigate} className="font-medium text-foreground hover:text-primary">
                {r.display_name || `@${r.username}`}
              </Link>{" "}
              <span className="text-muted-foreground">{describe(r).join(" · ")}</span>
            </p>
          </li>
        ))}
      </ul>
      {rows.length > 3 && !all && (
        <button onClick={() => setAll(true)} className="mt-1.5 w-full text-center text-[11px] text-primary">
          +{rows.length - 3} more
        </button>
      )}
    </section>
  );
};

export default FriendsOnTrack;
