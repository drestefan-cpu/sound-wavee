import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSavedTracks } from "@/contexts/SavedTracksContext";
import UnifiedTrackCard from "@/components/UnifiedTrackCard";
import RecommendModal from "@/components/RecommendModal";
import { EMOJIS, reactionPillClass } from "@/components/EmojiReactions";

/**
 * Profile → for you.
 *  received: songs friends sent you, with a one-tap emoji reply (the sender is notified) and saves
 *            credited to the sender.
 *  sent:     songs you sent, with whether they saved it / how they reacted.
 */


interface SentRow {
  id: string;
  created_at: string;
  message: string | null;
  reaction: string | null;
  seen: boolean;
  saved: boolean;
  source: "app" | "link";
  to_username: string;
  to_display_name: string | null;
  track_id: string;
  title: string;
  artist: string;
  album: string | null;
  album_art_url: string | null;
  spotify_track_id: string;
  spotify_link_id: string | null;
  apple_music_id: string | null;
  tidal_track_id: string | null;
  amazon_music_id: string | null;
  short_id: string | null;
}

interface Props {
  received: any[];
  loaded: boolean;
  onReceivedChange: (rows: any[]) => void;
  myUsername?: string;
  /** Controlled view (the library's finds switch); without it, this shows its own received/sent switch */
  view?: "received" | "sent";
}

const Segmented = ({ value, onChange }: { value: "received" | "sent"; onChange: (v: "received" | "sent") => void }) => (
  <div className="mb-3 inline-flex rounded-full border border-border bg-card p-0.5" role="tablist">
    {(["received", "sent"] as const).map((v) => (
      <button
        key={v}
        role="tab"
        aria-selected={value === v}
        onClick={() => onChange(v)}
        className={`rounded-full px-4 py-1 text-[11px] font-medium transition-colors ${
          value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {v}
      </button>
    ))}
  </div>
);

const Spinner = () => (
  <div className="flex justify-center py-6">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const ForYouTab = ({ received, loaded, onReceivedChange, myUsername, view: controlledView }: Props) => {
  const { isSaved, toggleSave } = useSavedTracks();
  const [ownView, setView] = useState<"received" | "sent">("received");
  const view = controlledView ?? ownView;
  const [sent, setSent] = useState<SentRow[] | null>(null);
  const [shareTrack, setShareTrack] = useState<{ id: string; title: string; artist?: string; shortId?: string | null } | null>(null);

  useEffect(() => {
    if (view !== "sent" || sent) return;
    (supabase as any)
      .rpc("my_sent_recommendations", { p_limit: 50 })
      .then(({ data }: { data: SentRow[] | null }) => setSent(data || []));
  }, [view, sent]);

  const react = async (rec: any, emoji: string) => {
    const next = rec.reaction === emoji ? null : emoji;
    onReceivedChange(received.map((r) => (r.id === rec.id ? { ...r, reaction: next } : r)));
    const { error } = await (supabase
      .from("recommendations" as any)
      .update({ reaction: next, reacted_at: next ? new Date().toISOString() : null } as any)
      .eq("id", rec.id) as any);
    if (error) onReceivedChange(received); // put it back
  };

  return (
    <div>
      {!controlledView && <Segmented value={view} onChange={setView} />}

      {view === "received" ? (
        !loaded ? (
          <Spinner />
        ) : received.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">when a friend sends you a song, it'll appear here.</p>
        ) : (
          <div className="space-y-2">
            {received.map((rec: any) => {
              const t = rec.tracks || {};
              const from = rec.profiles?.username || rec.profiles?.display_name;
              return (
                <UnifiedTrackCard
                  key={rec.id}
                  compact
                  hideReactions
                  sharerUsername={myUsername}
                  track={{
                    id: rec.track_id,
                    trackDbId: rec.track_id,
                    title: t.title || "Unknown",
                    artist: t.artist || "Unknown",
                    album: t.album,
                    albumArtUrl: t.album_art_url,
                    spotifyTrackId: t.spotify_track_id,
                    appleMusicId: t.apple_music_id,
                    spotifyLinkId: t.spotify_link_id,
                    tidalTrackId: t.tidal_track_id,
                    amazonMusicId: t.amazon_music_id,
                    shortId: t.short_id,
                  }}
                  isSaved={isSaved(rec.track_id)}
                  // Credit the friend who sent it ("saved the song you sent")
                  onToggleSave={() => toggleSave(rec.track_id, rec.from_user_id, "recommendation")}
                  onShare={() => setShareTrack({ id: rec.track_id, title: t.title, artist: t.artist, shortId: t.short_id })}
                  subtitle={
                    <div className="space-y-1.5 pt-0.5">
                      <p className="text-[11px] text-muted-foreground">
                        from{" "}
                        <Link
                          to={`/profile/${rec.profiles?.username || rec.from_user_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-foreground/80 hover:text-primary"
                        >
                          @{from}
                        </Link>
                        {rec.source === "link" && <span> · via a link</span>}
                        {rec.message && <span className="italic"> “{rec.message}”</span>}
                      </p>
                      <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                        {EMOJIS.map((e) => (
                          <button
                            key={e}
                            onClick={() => react(rec, e)}
                            aria-label={`reply ${e}`}
                            aria-pressed={rec.reaction === e}
                            className={reactionPillClass(rec.reaction === e, rec.reaction !== e, true)}
                          >
                            <span>{e}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  }
                />
              );
            })}
          </div>
        )
      ) : sent === null ? (
        <Spinner />
      ) : sent.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">songs you send to friends will appear here.</p>
      ) : (
        <div className="space-y-2">
          {sent.map((r) => (
            <UnifiedTrackCard
              key={r.id}
              compact
              hideReactions
              sharerUsername={myUsername}
              track={{
                id: r.track_id,
                trackDbId: r.track_id,
                title: r.title,
                artist: r.artist,
                album: r.album,
                albumArtUrl: r.album_art_url,
                spotifyTrackId: r.spotify_track_id,
                appleMusicId: r.apple_music_id,
                spotifyLinkId: r.spotify_link_id,
                tidalTrackId: r.tidal_track_id,
                amazonMusicId: r.amazon_music_id,
                shortId: r.short_id,
              }}
              onShare={() => setShareTrack({ id: r.track_id, title: r.title, artist: r.artist, shortId: r.short_id })}
              subtitle={
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-[11px] text-muted-foreground">
                  <span>
                    to <span className="font-medium text-foreground/80">@{r.to_username}</span>
                    {r.source === "link" && " · opened your link"}
                  </span>
                  {r.saved && (
                    <span className="inline-flex items-center gap-0.5 text-primary">
                      <Check className="h-3 w-3" strokeWidth={3} /> saved
                    </span>
                  )}
                  {r.reaction && <span aria-label={`reacted ${r.reaction}`}>{r.reaction}</span>}
                  {!r.saved && !r.reaction && r.source !== "link" && <span>{r.seen ? "seen" : "not seen yet"}</span>}
                </div>
              }
            />
          ))}
        </div>
      )}

      {shareTrack && (
        <RecommendModal
          trackId={shareTrack.id}
          trackTitle={shareTrack.title}
          trackArtist={shareTrack.artist}
          shortId={shareTrack.shortId}
          sharerUsername={myUsername}
          onClose={() => setShareTrack(null)}
        />
      )}
    </div>
  );
};

export default ForYouTab;
