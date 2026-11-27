import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * "your week on PLAI": the Friday recap, shown at the top of the friends feed for 3 days
 * (or whenever opened from its notification, with ?recap=1).
 */

type Recap = {
  id: string;
  week_start: string;
  created_at: string;
  data: {
    liked?: number;
    top_artist?: string;
    top_artist_count?: number;
    reactions?: number;
    top_emoji?: string;
    saves?: number;
    received?: number;
    friend_songs?: number;
    top_friend?: { username: string; name: string; count: number };
    shared?: { title: string; artist: string; friends: string[] };
  };
};

const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

const WeeklyRecapCard = () => {
  const { user } = useAuth();
  const [recap, setRecap] = useState<Recap | null>(null);

  useEffect(() => {
    if (!user) return;
    const forced = new URLSearchParams(window.location.search).get("recap") === "1";
    let q = supabase
      .from("weekly_recaps" as any)
      .select("id, week_start, created_at, data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!forced) {
      q = q.eq("dismissed", false).gte("created_at", new Date(Date.now() - 3 * 86400_000).toISOString());
    }
    q.then(({ data }) => setRecap(((data as unknown as Recap[]) || [])[0] || null));
  }, [user]);

  if (!recap) return null;
  const d = recap.data;

  const dismiss = () => {
    setRecap(null);
    supabase.from("weekly_recaps" as any).update({ dismissed: true } as any).eq("id", recap.id).then(() => {});
  };

  const stats = [
    { n: d.liked, label: d.liked === 1 ? "song liked" : "songs liked" },
    { n: d.reactions, label: d.reactions === 1 ? "reaction" : "reactions", extra: d.top_emoji },
    { n: d.saves, label: "saved from you" },
    { n: d.received, label: "sent to you" },
  ].filter((s) => (s.n || 0) > 0);

  const end = new Date(recap.created_at);
  const start = new Date(end.getTime() - 6 * 86400_000);

  const rows: { label: string; value: React.ReactNode }[] = [];
  if (d.top_artist) {
    rows.push({
      label: "top artist",
      value: (
        <>
          {d.top_artist}
          <span className="text-muted-foreground"> · {d.top_artist_count} songs</span>
        </>
      ),
    });
  }
  if (d.shared) {
    const names = d.shared.friends || [];
    rows.push({
      label: `you & ${names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0]} both love`,
      value: (
        <>
          {d.shared.title}
          <span className="text-muted-foreground"> · {d.shared.artist}</span>
        </>
      ),
    });
  }
  if (d.top_friend) {
    rows.push({
      label: "most active friend",
      value: (
        <Link to={`/profile/${d.top_friend.username}`} className="hover:text-primary">
          {d.top_friend.name}
          <span className="text-muted-foreground">
            {" "}
            · added {d.top_friend.count} {d.top_friend.count === 1 ? "song" : "songs"} →
          </span>
        </Link>
      ),
    });
  }

  return (
    <section aria-label="your week on PLAI" className="mb-4 rounded-2xl border border-primary/30 bg-card px-5 py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">your week on PLAI</h2>
          <p className="text-[11px] text-muted-foreground">
            {fmt(start)} – {fmt(end)}
          </p>
        </div>
        <button onClick={dismiss} aria-label="hide recap" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {stats.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="flex h-6 items-baseline gap-1 text-2xl font-semibold leading-none tabular-nums text-foreground">
                {s.n}
                {s.extra && <span className="text-sm leading-none">{s.extra}</span>}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <dl className="flex flex-col gap-2 border-t border-border pt-3">
          {rows.map((r) => (
            <div key={r.label} className="min-w-0">
              <dt className="text-[10px] uppercase tracking-wider text-primary">{r.label}</dt>
              <dd className="truncate text-sm text-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};

export default WeeklyRecapCard;
