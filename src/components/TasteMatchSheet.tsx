import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useSheetDrag } from "@/hooks/useSheetDrag";
import UnifiedTrackCard from "@/components/UnifiedTrackCard";

/** Taste match breakdown: the score, and the artists and songs two people have in common. */

export interface TasteMatch {
  enough: boolean;
  score: number | null;
  songs_a: number;
  songs_b: number;
  shared_song_count: number;
  shared_artist_count: number;
  shared_genres?: string[];
  shared_artists: { name: string; songs: number }[];
  shared_songs: {
    track_id: string;
    title: string;
    artist: string;
    album_art_url: string | null;
    short_id: string | null;
    spotify_track_id: string | null;
    spotify_link_id: string | null;
    apple_music_id: string | null;
    tidal_track_id: string | null;
    amazon_music_id: string | null;
  }[];
}

const Ring = ({ score }: { score: number }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[26px] font-semibold tabular-nums tracking-tight text-foreground">
        {score}
        <span className="ml-0.5 text-sm font-medium text-muted-foreground">%</span>
      </span>
    </div>
  );
};

interface Props {
  match: TasteMatch;
  otherName: string;
  myUsername?: string;
  onClose: () => void;
}

const TasteMatchSheet = ({ match, otherName, myUsername, onClose }: Props) => {
  const { panelRef, handlers, sheetStyle, backdropStyle, close } = useSheetDrag(onClose);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center backdrop-blur-sm sm:items-center"
      style={backdropStyle}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={`taste match with ${otherName}`}
    >
      <div
        ref={panelRef}
        {...handlers}
        className="relative max-h-[86dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card px-5 motion-safe:animate-sheet-up sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:motion-safe:animate-pop-in"
        style={{ ...sheetStyle, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-5 flex h-11 items-center justify-center bg-card px-5">
          <span className="h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
          <button
            onClick={close}
            aria-label="close"
            className="absolute right-3 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">taste match</p>
          <p className="mt-1 text-base font-semibold text-foreground">you & {otherName}</p>
          {match.enough && match.score !== null ? (
            <>
              <div className="mt-4">
                <Ring score={match.score} />
              </div>
            </>
          ) : (
            <p className="mt-4 max-w-[16rem] text-sm text-muted-foreground">
              Not enough music yet to compare. A match shows up once you both have at least 10 songs.
            </p>
          )}
          <p className="mt-2 max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
            Based on the artists you both listen to most, the genres you share, and the songs you both love, on any app.
          </p>
        </div>

        {match.shared_genres && match.shared_genres.length > 0 && (
          <section className="mt-6 border-t border-border pt-4">
            <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">genres you share</h3>
            <div className="flex flex-wrap gap-1.5">
              {match.shared_genres.map((g) => (
                <span key={g} className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                  {g}
                </span>
              ))}
            </div>
          </section>
        )}

        {match.shared_artists.length > 0 && (
          <section className="mt-6 border-t border-border pt-4">
            <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {match.shared_artist_count} {match.shared_artist_count === 1 ? "artist" : "artists"} in common
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {match.shared_artists.map((a) => (
                <span key={a.name} className="rounded-full border border-border px-3 py-1 text-xs text-foreground">
                  {a.name}
                </span>
              ))}
              {match.shared_artist_count > match.shared_artists.length && (
                <span className="px-1 py-1 text-xs text-muted-foreground">+{match.shared_artist_count - match.shared_artists.length} more</span>
              )}
            </div>
          </section>
        )}

        {match.shared_songs.length > 0 && (
          <section className="mt-6 border-t border-border pt-4">
            <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {match.shared_song_count} {match.shared_song_count === 1 ? "song" : "songs"} you both love
            </h3>
            <div className="space-y-2">
              {match.shared_songs.map((s) => (
                <UnifiedTrackCard
                  key={s.track_id}
                  compact
                  hideReactions
                  sharerUsername={myUsername}
                  track={{
                    id: s.track_id,
                    trackDbId: s.track_id,
                    title: s.title,
                    artist: s.artist,
                    albumArtUrl: s.album_art_url,
                    shortId: s.short_id,
                    spotifyTrackId: s.spotify_track_id || undefined,
                    spotifyLinkId: s.spotify_link_id,
                    appleMusicId: s.apple_music_id,
                    tidalTrackId: s.tidal_track_id,
                    amazonMusicId: s.amazon_music_id,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {match.enough && match.shared_artists.length === 0 && match.shared_songs.length === 0 && (
          <p className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            No artists in common yet. Send them a song to start.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default TasteMatchSheet;
