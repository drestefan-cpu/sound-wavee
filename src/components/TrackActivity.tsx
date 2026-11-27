import { useEffect, useState } from "react";
import { Heart, Smile, Play, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Song screen: what this song has done on PLAI, spelled out (the lists only show the icons) */

type Activity = { loved: number; reactions: number; plays: number; sent: number };
const cache = new Map<string, Activity>();

const TrackActivity = ({ trackId }: { trackId: string }) => {
  const [a, setA] = useState<Activity | null>(cache.get(trackId) || null);

  useEffect(() => {
    if (cache.has(trackId)) return;
    (supabase as any).rpc("track_activity", { p_track_id: trackId }).then(({ data }: { data: Activity | null }) => {
      if (!data) return;
      cache.set(trackId, data);
      setA(data);
    });
  }, [trackId]);

  if (!a) return null;
  const items = [
    { n: a.loved, Icon: Heart, text: a.loved === 1 ? "person loves it" : "people love it" },
    { n: a.reactions, Icon: Smile, text: a.reactions === 1 ? "reaction" : "reactions" },
    { n: a.plays, Icon: Play, text: a.plays === 1 ? "play from PLAI links" : "plays from PLAI links" },
    { n: a.sent, Icon: Send, text: a.sent === 1 ? "time sent to a friend" : "times sent to friends" },
  ].filter((i) => i.n > 0);
  if (items.length === 0) return null;

  return (
    <div className="mt-3 rounded-2xl border border-border px-4 py-2.5">
      <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">on PLAI</p>
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {items.map(({ n, Icon, text }) => (
          <li key={text} className="flex items-center gap-1.5 text-xs text-foreground/90">
            <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
            <span>
              <span className="font-medium tabular-nums text-foreground">{n}</span> {text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TrackActivity;
