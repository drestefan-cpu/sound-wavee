import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_NAMES } from "@/components/ConnectionNotice";
import SpotifyRequests from "@/components/admin/SpotifyRequests";

/** Admin → people: who's active, whose music apps are syncing, who's gone quiet */

type Person = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  joined: string;
  last_seen_at: string | null;
  apps: string[];
  broken_apps: string[];
  last_synced_at: string | null;
  likes_7d: number;
  sent_7d: number;
  reactions_7d: number;
  following: number;
  followers: number;
  push_devices: number;
  invited_by: string | null;
};

const ago = (ts: string | null) => {
  if (!ts) return "never";
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return mins < 2 ? "just now" : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

const status = (p: Person): { label: string; cls: string } => {
  const days = p.last_seen_at ? (Date.now() - new Date(p.last_seen_at).getTime()) / 86400_000 : Infinity;
  if (days < 1) return { label: "active today", cls: "bg-emerald-500/15 text-emerald-500" };
  if (days < 7) return { label: "this week", cls: "bg-primary/15 text-primary" };
  if (days === Infinity) return { label: "not seen yet", cls: "bg-secondary text-muted-foreground" };
  return { label: "gone quiet", cls: "bg-amber-500/15 text-amber-500" };
};

const PeopleAdmin = () => {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (supabase as any).rpc("admin_activity").then(({ data, error }: { data: Person[] | null; error: unknown }) => {
      if (error) setError(true);
      setPeople(data || []);
    });
  }, []);

  if (error) return <p className="text-sm text-muted-foreground">couldn't load people</p>;
  if (!people) return <div className="h-24 animate-pulse rounded-xl bg-card" />;

  const weekActive = people.filter((p) => p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < 7 * 86400_000).length;
  const broken = people.filter((p) => p.broken_apps.length > 0).length;

  return (
    <div className="space-y-4">
      <SpotifyRequests />
      <div className="grid grid-cols-3 gap-2">
        {[
          { n: people.length, label: "people" },
          { n: weekActive, label: "opened this week" },
          { n: broken, label: "need to reconnect" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-3 py-2.5">
            <p className="text-xl font-semibold tabular-nums text-foreground">{s.n}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        "last opened" starts counting from today, so people who haven't opened PLAI since show as not seen yet.
      </p>

      <div className="space-y-2">
        {people.map((p) => {
          const s = status(p);
          return (
            <div key={p.username} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary/20">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-primary">
                      {p.username[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link to={`/profile/${p.username}`} className="block truncate text-sm font-medium text-foreground hover:text-primary">
                    {p.display_name || p.username} <span className="font-normal text-muted-foreground">@{p.username}</span>
                  </Link>
                  <p className="text-[11px] text-muted-foreground">
                    last opened {ago(p.last_seen_at)} · synced {ago(p.last_synced_at)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.cls}`}>{s.label}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                {p.apps.map((a) => (
                  <span
                    key={a}
                    className={`rounded-full px-2 py-0.5 ${
                      p.broken_apps.includes(a) ? "bg-amber-500/15 text-amber-500" : "border border-border text-foreground/80"
                    }`}
                  >
                    {PLATFORM_NAMES[a] || a}
                    {p.broken_apps.includes(a) && " · expired"}
                  </span>
                ))}
                {p.apps.length === 0 && <span className="text-muted-foreground">no music app connected</span>}
              </div>
              <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
                this week: {p.likes_7d} liked · {p.sent_7d} sent · {p.reactions_7d} reactions · {p.following} following ·{" "}
                {p.followers} followers{p.push_devices > 0 ? " · notifications on" : ""}
                {p.invited_by ? ` · invited by @${p.invited_by}` : ""}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PeopleAdmin;
