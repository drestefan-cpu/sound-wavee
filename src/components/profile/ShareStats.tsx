import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Profile → activity: how often your shared PLAI links were opened. Hidden until there's something to show. */

interface Row {
  total_opens: number;
  opens_7d: number;
  track_id: string | null;
  title: string | null;
  artist: string | null;
  album_art_url: string | null;
  opens: number | null;
  last_opened_at: string | null;
}

const ago = (ts: string) => {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

let cache: Row[] | null = null;

const ShareStats = () => {
  const [rows, setRows] = useState<Row[] | null>(cache);

  useEffect(() => {
    (supabase as any).rpc("my_share_stats").then(({ data }: { data: Row[] | null }) => {
      cache = data || [];
      setRows(cache);
    });
  }, []);

  if (!rows || rows.length === 0 || !rows[0].total_opens) return null;
  const { total_opens, opens_7d } = rows[0];
  const tracks = rows.filter((r) => r.track_id).slice(0, 3);

  return (
    <section className="mb-3 rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">your shared links</p>
      <div className="mt-2 flex items-baseline gap-4">
        <p className="text-foreground">
          <span className="font-display text-2xl tabular-nums">{total_opens}</span>
          <span className="ml-1.5 text-xs text-muted-foreground">{total_opens === 1 ? "open" : "opens"}</span>
        </p>
        {opens_7d > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium tabular-nums text-primary">{opens_7d}</span> this week
          </p>
        )}
      </div>
      {tracks.length > 0 && (
        <ul className="mt-3 space-y-2">
          {tracks.map((t) => (
            <li key={t.track_id} className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-secondary">
                {t.album_art_url && <img src={t.album_art_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{t.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {t.opens} {t.opens === 1 ? "open" : "opens"}
                  {t.last_opened_at ? ` · last ${ago(t.last_opened_at)}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ShareStats;
