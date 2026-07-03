import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Status = "new_find" | "following" | "love";

type RadarArtistRow = {
  id: string;
  user_id: string;
  name: string;
  status: Status;
  photo_url: string | null;
  source_platform: string | null;
  monthly_listeners: number | null;
  followup_date: string | null;
  updated_at: string;
  genre: string[] | null;
  strengths: string[] | null;
};

const SECTIONS: { status: Status; label: string; emoji: string }[] = [
  { status: "new_find", label: "new find", emoji: "💡" },
  { status: "following", label: "following", emoji: "🎧" },
  { status: "love", label: "love", emoji: "🖤" },
];

function platformLabel(platform: string | null): string {
  if (!platform) return "";
  switch (platform) {
    case "spotify": return "Spotify";
    case "apple_music": return "Apple Music";
    case "tidal": return "Tidal";
    case "youtube": return "YouTube";
    default: return platform;
  }
}

const ArtistCard = ({ artist }: { artist: RadarArtistRow }) => {
  const navigate = useNavigate();

  const isOverdue =
    artist.followup_date != null &&
    new Date(artist.followup_date) < new Date();

  const followupFormatted = artist.followup_date
    ? new Date(artist.followup_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <button
      onClick={() => navigate(`/radar/artist/${artist.id}`)}
      className="flex-shrink-0 bg-card border border-border rounded-xl p-3 text-left transition-opacity hover:opacity-80 active:opacity-60"
      style={{ width: 140, borderWidth: "0.5px" }}
    >
      <div className="mb-2">
        {artist.photo_url ? (
          <img
            src={artist.photo_url}
            alt={artist.name}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
            {artist.name[0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>

      <p className="text-sm font-medium text-foreground truncate leading-tight mb-1">
        {artist.name}
      </p>

      {[...(artist.genre || []), ...(artist.strengths || [])].slice(0, 3).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 mb-1">
          {[...(artist.genre || []), ...(artist.strengths || [])]
            .slice(0, 3)
            .map((tag) => (
              <span key={tag} className="text-[9px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                {tag}
              </span>
            ))}
        </div>
      )}

      {artist.source_platform && (
        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground mb-1">
          {platformLabel(artist.source_platform)}
        </span>
      )}

      {artist.monthly_listeners != null && (
        <p className="text-xs text-muted-foreground truncate">
          {artist.monthly_listeners.toLocaleString()} monthly
        </p>
      )}

      {followupFormatted && (
        <p
          className={`text-xs mt-0.5 ${
            isOverdue ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {isOverdue ? "overdue · " : ""}
          {followupFormatted}
        </p>
      )}
    </button>
  );
};

const RadarDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [artists, setArtists] = useState<RadarArtistRow[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchArtists = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase
      .from("radar_artists" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }) as any);
    setArtists((data as RadarArtistRow[]) ?? []);
    setFetching(false);
  }, [user]);

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  useEffect(() => {
    window.addEventListener("focus", fetchArtists);
    return () => window.removeEventListener("focus", fetchArtists);
  }, [fetchArtists]);

  const grouped = SECTIONS.map((s) => ({
    ...s,
    items: artists.filter((a) => a.status === s.status),
  }));

  if (fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div
        className="px-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex items-start justify-between py-3">
          <div>
            <Link
              to="/feed"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-1.5 block"
            >
              ← PLAI
            </Link>
            <h1 className="font-display text-xl font-black tracking-tight">
              radar
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              artists you're watching
            </p>
          </div>
          <button
            onClick={() => navigate("/radar/new")}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground flex-shrink-0 mt-5"
          >
            + add artist
          </button>
        </div>
      </div>

      {/* Empty state */}
      {artists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <p className="font-medium text-foreground mb-1">nothing here yet</p>
          <p className="text-sm text-muted-foreground mb-6">
            add artists you're curious about
          </p>
          <button
            onClick={() => navigate("/radar/new")}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            + add artist
          </button>
        </div>
      )}

      {/* Pipeline sections */}
      {artists.length > 0 && (
        <div
          className="pb-12 mt-2 space-y-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3rem)" }}
        >
          {grouped.map(({ status, label, emoji, items }) => (
            <div key={status}>
              <div className="flex items-center gap-2 px-4 mb-3">
                <span aria-hidden>{emoji}</span>
                <span className="text-sm font-medium text-foreground">
                  {label}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({items.length})
                </span>
              </div>

              {items.length === 0 ? (
                <p className="px-4 text-xs text-muted-foreground">
                  none here yet
                </p>
              ) : (
                <div
                  className="flex gap-3 overflow-x-auto px-4 pb-1"
                  style={{ scrollbarWidth: "none" }}
                >
                  {items.map((artist) => (
                    <ArtistCard key={artist.id} artist={artist} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RadarDashboard;
