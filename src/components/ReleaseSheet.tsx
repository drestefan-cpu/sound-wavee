import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlatform } from "@/contexts/PlatformContext";
import { useSheetDrag } from "@/hooks/useSheetDrag";
import { openUrl } from "@/lib/openUrl";
import ImageViewer from "@/components/ImageViewer";

/** A release (album / EP / single) from the artist section: cover, tracklist, and open it on your app */

type Release = {
  id: string;
  title: string;
  artist: string;
  kind: string;
  releaseDate: string | null;
  art: string | null;
  label: string | null;
  copyright: string | null;
  note: string | null;
  tracks: { n: number; disc: number; title: string; artist: string | null; ms: number; explicit: boolean }[];
  totalMs: number;
  links: Record<string, string | null>;
};

const PLATFORMS: { key: string; label: string }[] = [
  { key: "spotify", label: "spotify" },
  { key: "apple_music", label: "apple music" },
  { key: "tidal", label: "tidal" },
  { key: "youtube_music", label: "youtube music" },
  { key: "amazon_music", label: "amazon music" },
  { key: "deezer", label: "deezer" },
];

const cache = new Map<string, Release>();
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}`;
const length = (ms: number) => {
  const min = Math.round(ms / 60000);
  return min >= 60 ? `${Math.floor(min / 60)} hr ${min % 60} min` : `${min} min`;
};

interface Props {
  appleAlbumId: string;
  /** shown while loading */
  preview: { title: string; art: string };
  onClose: () => void;
}

const ReleaseSheet = ({ appleAlbumId, preview, onClose }: Props) => {
  const { preferredPlatform } = usePlatform();
  const [r, setR] = useState<Release | null>(cache.get(appleAlbumId) || null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);
  const { panelRef, handlers, sheetStyle, backdropStyle, close } = useSheetDrag(onClose);

  useEffect(() => {
    if (cache.has(appleAlbumId)) return;
    supabase.functions.invoke("album-details", { body: { apple_album_id: appleAlbumId } }).then(({ data, error }) => {
      if (error || !data || (data as { error?: string }).error) return setFailed(true);
      cache.set(appleAlbumId, data as Release);
      setR(data as Release);
    });
  }, [appleAlbumId]);

  const preferred = PLATFORMS.find((p) => p.key === preferredPlatform) || PLATFORMS[0];
  const others = r ? PLATFORMS.filter((p) => p.key !== preferred.key && r.links[p.key]) : [];
  const discs = r ? new Set(r.tracks.map((t) => t.disc)).size : 1;
  const art = r?.art || preview.art;

  return createPortal(
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center backdrop-blur-sm sm:items-center"
      style={backdropStyle}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={preview.title}
    >
      <div
        ref={panelRef}
        {...handlers}
        className="relative max-h-[86dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card px-5 motion-safe:animate-sheet-up sm:mx-4 sm:max-w-sm sm:rounded-2xl"
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

        <button
          onClick={() => setZoom(true)}
          aria-label="view cover larger"
          className="mx-auto block aspect-square w-[64%] max-w-[260px] overflow-hidden rounded-2xl bg-secondary shadow-lg"
        >
          <img src={art} alt="" className="h-full w-full object-cover" />
        </button>

        <div className="mt-4 text-center">
          <h2 className="text-xl font-semibold leading-tight text-foreground" style={{ textWrap: "balance" } as React.CSSProperties}>
            {r?.title || preview.title}
          </h2>
          {r && (
            <>
              <p className="mt-1 text-[15px] text-foreground/80">{r.artist}</p>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {[
                  r.releaseDate?.slice(0, 4),
                  r.kind,
                  r.tracks.length > 1 ? `${r.tracks.length} songs` : null,
                  r.totalMs ? length(r.totalMs) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </>
          )}
        </div>

        {r ? (
          <>
            {r.note && <p className="mt-3 text-center text-[13px] italic leading-relaxed text-muted-foreground">{r.note}</p>}

            {r.links[preferred.key] && (
              <button
                onClick={() => openUrl(r.links[preferred.key]!)}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground active:scale-[0.98]"
              >
                <Play className="h-4 w-4 fill-current" strokeWidth={0} />
                open on {preferred.label}
              </button>
            )}
            {others.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5">
                <span className="mr-1 text-[11px] text-muted-foreground">also on</span>
                {others.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => openUrl(r.links[p.key]!)}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground/80 hover:border-primary/50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {r.tracks.length > 1 && (
              <ol className="mt-6 border-t border-border pt-2">
                {r.tracks.map((t, i) => (
                  <li key={`${t.disc}-${t.n}`}>
                    {discs > 1 && (i === 0 || r.tracks[i - 1].disc !== t.disc) && (
                      <p className="pb-1 pt-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">disc {t.disc}</p>
                    )}
                    <div className="flex items-center gap-3 py-2">
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{t.n}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">{t.title}</span>
                        {t.artist && <span className="block truncate text-[11px] text-muted-foreground">{t.artist}</span>}
                      </span>
                      {t.explicit && (
                        <span className="rounded-[3px] bg-muted-foreground/20 px-1 text-[9px] font-semibold leading-4 text-muted-foreground">E</span>
                      )}
                      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{t.ms ? mmss(t.ms) : ""}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {(r.label || r.copyright) && (
              <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">{r.copyright || r.label}</p>
            )}
          </>
        ) : failed ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">Couldn't load this release. Try again in a bit.</p>
        ) : (
          <div className="mt-6 space-y-3" aria-label="loading release">
            {[80, 60, 70, 50].map((w) => (
              <div key={w} className="h-3.5 animate-pulse rounded bg-secondary" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
      </div>
      {zoom && art && <ImageViewer images={[{ url: art }]} start={0} onClose={() => setZoom(false)} />}
    </div>,
    document.body,
  );
};

export default ReleaseSheet;
