import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { openUrl } from "@/lib/openUrl";
import BottomNav from "@/components/BottomNav";
import UnifiedTrackCard from "@/components/UnifiedTrackCard";
import FriendAvatars from "@/components/discover/FriendAvatars";
import ImageViewer from "@/components/ImageViewer";
import ReleaseSheet from "@/components/ReleaseSheet";

/**
 * /artist/<name>: an artist's page. Photo, bio, socials, the songs by them that you and your
 * friends love on PLAI, their photos, and their albums / singles (each opens its release screen).
 */

type Details = {
  name: string;
  genres: string[];
  photos: { url: string; source: string }[];
  releases: { id?: string; title: string; year: string | null; kind?: string; art: string; url: string | null }[];
  bio: { text: string; url: string } | null;
  links: Partial<Record<string, string>>;
};

type PlaiSong = {
  track_id: string;
  title: string;
  artist: string;
  album: string | null;
  album_art_url: string | null;
  short_id: string | null;
  spotify_track_id: string;
  spotify_link_id: string | null;
  apple_music_id: string | null;
  tidal_track_id: string | null;
  amazon_music_id: string | null;
  mine: boolean;
  lovers: { username: string; avatar_url: string | null }[];
};

const LINKS: [string, string][] = [
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

const ReleaseGrid = ({ items, onOpen }: { items: Details["releases"]; onOpen: (r: Details["releases"][number]) => void }) => (
  <div className="grid grid-cols-3 gap-x-3 gap-y-4">
    {items.map((r) => (
      <button key={r.art} onClick={() => onOpen(r)} className="min-w-0 text-left">
        <span className="block aspect-square overflow-hidden rounded-xl bg-secondary">
          <img src={r.art} alt="" loading="lazy" className="h-full w-full object-cover" />
        </span>
        <span className="mt-1.5 block truncate text-xs font-medium text-foreground">{r.title}</span>
        {r.year && <span className="block text-[10px] text-muted-foreground">{r.year.replace(/ · (single|EP)$/, "")}</span>}
      </button>
    ))}
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8">
    <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
    {children}
  </section>
);

const Artist = () => {
  const { name = "" } = useParams();
  const artistName = decodeURIComponent(name);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [d, setD] = useState<Details | null | undefined>(undefined);
  const [songs, setSongs] = useState<PlaiSong[]>([]);
  const [bioOpen, setBioOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [release, setRelease] = useState<Details["releases"][number] | null>(null);
  const [showAllSingles, setShowAllSingles] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setD(undefined);
    supabase.functions.invoke("artist-details", { body: { artist: artistName } }).then(({ data, error }) => {
      setD(error || !data || (data as { error?: string }).error ? null : (data as Details));
    });
  }, [artistName]);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .rpc("artist_songs_on_plai", { p_artist: artistName })
      .then(({ data }: { data: PlaiSong[] | null }) => setSongs(data || []));
  }, [user, artistName]);

  const albums = (d?.releases || []).filter((r) => (r.kind || "album") === "album");
  const singles = (d?.releases || []).filter((r) => r.kind && r.kind !== "album");
  const links = d ? LINKS.filter(([k]) => d.links[k]) : [];
  const hero = d?.photos[0]?.url;
  const openRelease = (r: Details["releases"][number]) => (r.id ? setRelease(r) : r.url && openUrl(r.url));

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* hero: photo fading into the page, name on top */}
      <div className="relative">
        <div className="relative aspect-[4/3] max-h-[52vh] w-full overflow-hidden bg-card">
          {hero ? (
            <button onClick={() => setViewing(0)} aria-label={`view photo of ${artistName} larger`} className="h-full w-full">
              <img src={hero} alt="" className="h-full w-full object-cover object-top" />
            </button>
          ) : (
            d === undefined && <div className="h-full w-full animate-pulse bg-secondary" />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/discover"))}
          aria-label="back"
          className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-1">
          <h1 className="font-display text-3xl leading-tight text-foreground" style={{ textWrap: "balance" } as React.CSSProperties}>
            {d?.name || artistName}
          </h1>
          {d && d.genres.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{d.genres.join(" · ")}</p>}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5">
        {d === null && (
          <p className="mt-8 text-center text-sm text-muted-foreground">Couldn't find this artist's details right now.</p>
        )}

        {links.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {links.map(([k, label]) => (
              <button
                key={k}
                onClick={() => openUrl(d!.links[k]!)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] text-foreground/85 hover:border-primary/50"
              >
                {label}
                <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {d?.bio && (
          <div className="mt-4">
            <button
              onClick={() => setBioOpen((o) => !o)}
              className={`text-left text-sm leading-relaxed text-foreground/85 ${bioOpen ? "" : "line-clamp-4"}`}
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

        {songs.length > 0 && (
          <Section title="loved on PLAI">
            <div className="space-y-2">
              {songs.map((s) => (
                <UnifiedTrackCard
                  key={s.track_id}
                  compact
                  hideReactions
                  track={{
                    id: s.track_id,
                    trackDbId: s.track_id,
                    title: s.title,
                    artist: s.artist,
                    album: s.album,
                    albumArtUrl: s.album_art_url,
                    shortId: s.short_id,
                    spotifyTrackId: s.spotify_track_id,
                    spotifyLinkId: s.spotify_link_id,
                    appleMusicId: s.apple_music_id,
                    tidalTrackId: s.tidal_track_id,
                    amazonMusicId: s.amazon_music_id,
                  }}
                  subtitle={
                    <div className="pt-0.5">
                      {s.mine && <p className="text-[11px] text-primary">in your collection</p>}
                      <FriendAvatars
                        friends={s.lovers.map((l) => ({ id: l.username, username: l.username, displayName: l.username, avatarUrl: l.avatar_url }))}
                        verb="loved by"
                      />
                    </div>
                  }
                />
              ))}
            </div>
          </Section>
        )}

        {d && d.photos.length > 1 && (
          <Section title="photos">
            <div className="-mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {d.photos.map((p, i) => (
                <button
                  key={p.url}
                  onClick={() => setViewing(i)}
                  className="relative aspect-[4/5] w-[46%] max-w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl bg-secondary"
                >
                  <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[9px] text-white/90">{p.source}</span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {albums.length > 0 && (
          <Section title={`albums · ${albums.length}`}>
            <ReleaseGrid items={albums} onOpen={openRelease} />
          </Section>
        )}

        {singles.length > 0 && (
          <Section title="singles & EPs">
            <ReleaseGrid items={showAllSingles ? singles : singles.slice(0, 9)} onOpen={openRelease} />
            {singles.length > 9 && !showAllSingles && (
              <button
                onClick={() => setShowAllSingles(true)}
                className="mx-auto mt-4 block rounded-full border border-border bg-card px-5 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                show more
              </button>
            )}
          </Section>
        )}

        {d === undefined && (
          <div className="mt-8 grid grid-cols-3 gap-3" aria-label="loading">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        )}
      </main>

      {viewing !== null && d && (
        <ImageViewer
          images={d.photos.map((p) => ({ url: p.url, caption: `${d.name} · ${p.source}` }))}
          start={viewing}
          onClose={() => setViewing(null)}
        />
      )}
      {release?.id && (
        <ReleaseSheet appleAlbumId={release.id} preview={{ title: release.title, art: release.art }} onClose={() => setRelease(null)} />
      )}
      <BottomNav />
    </div>
  );
};

export default Artist;
