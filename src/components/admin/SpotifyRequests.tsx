import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin → people → Spotify access: people Spotify turned away while PLAI is in development mode.
 * Add their email in Spotify's dashboard (User Management, max 5 people), then mark them added;
 * they're notified if they've made a PLAI account meanwhile.
 */

type Request = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  status: "pending" | "added";
  created_at: string;
  added_at: string | null;
};

// PLAI's Spotify app → User Management
const SPOTIFY_USERS_URL = "https://developer.spotify.com/dashboard/88d4b293653547458d674430cdf8c608/users";

const SpotifyRequests = () => {
  const [rows, setRows] = useState<Request[] | null>(null);

  const load = () =>
    (supabase as any).rpc("admin_spotify_requests").then(({ data }: { data: Request[] | null }) => setRows(data || []));
  useEffect(() => {
    load();
  }, []);

  if (!rows) return null;
  const pending = rows.filter((r) => r.status === "pending");
  const added = rows.filter((r) => r.status === "added");

  const markAdded = async (r: Request) => {
    const { error } = await (supabase as any).rpc("admin_mark_spotify_added", { p_id: r.id });
    if (error) {
      toast.error("couldn't save — try again");
      return;
    }
    toast.success(r.username ? `marked — @${r.username} has been told` : "marked as added");
    load();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Spotify access requests</h3>
        <a href={SPOTIFY_USERS_URL} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">
          open Spotify's user list ↗
        </a>
      </div>
      {pending.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No one waiting. {added.length > 0 && `${added.length} added so far (Spotify allows 5).`}
        </p>
      ) : (
        <div className="space-y-2">
          {pending.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 border-t border-border pt-2 first:border-0 first:pt-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {r.name || r.email}
                  {r.username && <span className="text-muted-foreground"> · @{r.username}</span>}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{r.email}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(r.email).then(() => toast("email copied"), () => toast(r.email))}
                className="rounded-full border border-border px-3 py-1 text-[11px] text-foreground hover:border-primary/50"
              >
                copy email
              </button>
              <button
                onClick={() => markAdded(r)}
                className="rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground"
              >
                mark added
              </button>
            </div>
          ))}
          <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
            Add each email in Spotify's user list (name + email), then tap mark added. {added.length} of 5 spots used.
          </p>
        </div>
      )}
    </section>
  );
};

export default SpotifyRequests;
