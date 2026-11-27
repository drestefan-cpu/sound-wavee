import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openUrl } from "@/lib/openUrl";
import ImageViewer from "@/components/ImageViewer";
import ReleaseSheet from "@/components/ReleaseSheet";

/**
 * Song screen → "the artist": a swipeable gallery (photos, then their latest releases), a short bio
 * and their socials. From the artist-details function (Apple Music, Spotify, Wikipedia, MusicBrainz).
 */

type Details = {
  name: string;
  genres: string[];
  photos: { url: string; source: string }[];
  releases: { id?: string; title: string; year: string | null; art: string; url: string | null }[];
  bio: { text: string; url: string } | null;
  links: Partial<Record<string, string>>;
};

const cache = new Map<string, Details | null>();

const LINK_LABELS: [string, string][] = [
  ["instagram", "instagram"],
  ["tiktok", "tiktok"],
  ["x", "x"],
  ["youtube", "youtube"],
  ["soundcloud", "soundcloud"],
  ["bandcamp", "bandcamp"],
  ["website", "website"],
  ["spotify", "spotify"],
  ["apple_music", "apple music"],
];

/**
 * trackId for songs in PLAI; otherwise artist (+ spotifyTrackId) — e.g. the song playing on Spotify
 * that PLAI hasn't seen before.
 */
interface Props {
  trackId?: string;
  artist?: string;
  spotifyTrackId?: string;
  /** opens the artist's full page */
  onOpenArtist?: (name: string) => void;
}

const ArtistSection = ({ trackId, artist, spotifyTrackId, onOpenArtist }: Props) => {
  const key = trackId || `${artist}|${spotifyTrackId || ""}`;
  const [d, setD] = useState<Details | null | undefined>(cache.has(key) ? cache.get(key) : undefined);
  const [bioOpen, setBioOpen] = useState(false);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<number | null>(null);
  const [release, setRelease] = useState<Details["releases"][number] | null>(null);

  useEffect(() => {
    if (cache.has(key)) return;
    supabase.functions
      .invoke("artist-details", {
        body: trackId ? { track_id: trackId } : { artist, spotify_track_id: spotifyTrackId },
      })
      .then(({ data, error }) => {
        const result = error || !data || (data as { error?: string }).error ? null : (data as Details);
        cache.set(key, result);
        setD(result);
      })
      .catch(() => setD(null));
  }, [key, trackId, artist, spotifyTrackId]);

  if (d === undefined) {
    return (
      <section className="mt-6 border-t border-border pt-4" aria-label="loading the artist">
        <div className="mb-3 h-3 w-20 animate-pulse rounded bg-secondary" />
        <div className="flex gap-2.5 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[4/5] w-40 shrink-0 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      </section>
    );
  }
  if (!d) return null;

  const photos = d.photos.filter((p) => !broken.has(p.url));
  const links = LINK_LABELS.filter(([k]) => d.links[k]);
  if (photos.length === 0 && d.releases.length === 0 && !d.bio && links.length === 0) return null;
  const hide = (url: string) => setBroken((s) => new Set(s).add(url));

  return (
    <section className="mt-6 border-t border-border pt-4" aria-label={`about ${d.name}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">the artist</h3>
        {onOpenArtist && (
          <button onClick={() => onOpenArtist(d.name)} className="text-[11px] font-medium text-primary">
            see all →
          </button>
        )}
      </div>
      <p className="mt-1 text-base font-semibold text-foreground">
        {d.name}
        {d.genres.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{d.genres.join(" · ")}</span>}
      </p>

      {(photos.length > 0 || d.releases.length > 0) && (
        <div
          className="-mx-5 mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onTouchStart={(e) => e.stopPropagation()} // swiping the gallery shouldn't drag the sheet
        >
          {photos.map((p, i) => (
            <button
              key={p.url}
              onClick={() => setViewing(i)}
              aria-label={`view photo of ${d.name} larger`}
              className="relative aspect-[4/5] w-[58%] max-w-[210px] shrink-0 snap-start overflow-hidden rounded-2xl bg-secondary"
              style={{ touchAction: "pan-x" }}
            >
              <img src={p.url} alt={d.name} loading="lazy" onError={() => hide(p.url)} className="h-full w-full object-cover" />
              <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[9px] text-white/90 backdrop-blur-sm">
                {p.source}
              </span>
            </button>
          ))}
          {d.releases.map((r) => (
            <button
              key={r.art}
              onClick={() => (r.id ? setRelease(r) : r.url && openUrl(r.url))}
              className="w-32 shrink-0 snap-start text-left"
              style={{ touchAction: "pan-x" }}
            >
              <span className="block aspect-square overflow-hidden rounded-xl bg-secondary">
                <img src={r.art} alt="" loading="lazy" className="h-full w-full object-cover" />
              </span>
              <span className="mt-1.5 block truncate text-xs font-medium text-foreground">{r.title}</span>
              {r.year && <span className="block text-[10px] text-muted-foreground">{r.year}</span>}
            </button>
          ))}
        </div>
      )}

      {d.bio && (
        <div className="mt-3">
          <button
            onClick={() => setBioOpen((o) => !o)}
            className={`text-left text-[13px] leading-relaxed text-foreground/85 ${bioOpen ? "" : "line-clamp-3"}`}
          >
            {d.bio.text}
          </button>
          <button
            onClick={() => openUrl(d.bio!.url)}
            className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            from Wikipedia <ArrowUpRight className="h-2.5 w-2.5" />
          </button>
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {links.map(([k, label]) => (
            <button
              key={k}
              onClick={() => openUrl(d.links[k]!)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] text-foreground/85 transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {label}
              <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
      {viewing !== null && (
        <ImageViewer
          images={photos.map((p) => ({ url: p.url, caption: `${d.name} · ${p.source}` }))}
          start={viewing}
          onClose={() => setViewing(null)}
        />
      )}
      {release?.id && (
        <ReleaseSheet appleAlbumId={release.id} preview={{ title: release.title, art: release.art }} onClose={() => setRelease(null)} />
      )}
    </section>
  );
};

export default ArtistSection;
