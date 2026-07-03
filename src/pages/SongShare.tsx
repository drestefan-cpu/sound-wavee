import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TrackRow {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  album_art_url: string | null;
  spotify_track_id: string | null;
  youtube_video_id: string | null;
}

interface SharerProfile {
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

const SongShare = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const [searchParams] = useSearchParams();
  const fromParam = searchParams.get("from");

  const [track, setTrack] = useState<TrackRow | null>(null);
  const [sharer, setSharer] = useState<SharerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [artError, setArtError] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!trackId) { setLoading(false); return; }

      const trackPromise = supabase
        .from("tracks")
        .select("id, title, artist, album, album_art_url, spotify_track_id, youtube_video_id")
        .eq("id", trackId)
        .maybeSingle();

      const sharerPromise = fromParam
        ? supabase
            .from("profiles")
            .select("display_name, avatar_url, username")
            .ilike("username", fromParam)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [{ data: trackData }, { data: sharerData }] = await Promise.all([
        trackPromise,
        sharerPromise,
      ]);

      setTrack(trackData as TrackRow | null);
      setSharer(sharerData as SharerProfile | null);
      setLoading(false);
    };
    load();
  }, [trackId, fromParam]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080B12]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF2D78] border-t-transparent" />
      </div>
    );
  }

  if (!track) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#080B12]">
        <p className="text-sm text-[#4a6a8a]">song not found</p>
        <a
          href="https://onplai.lovable.app"
          className="text-xs text-[#4a6a8a] transition-colors hover:text-[#F0EBE3]"
        >
          find music with friends →
        </a>
      </div>
    );
  }

  const q = encodeURIComponent(`${track.title} ${track.artist}`);
  const sid = track.spotify_track_id;
  const isApple = !!sid && sid.startsWith("apple:");
  const isYouTubeSentinel = !!sid && sid.startsWith("yt:");
  const showSpotify = !!sid && !isApple && !isYouTubeSentinel;
  const appleMusicId = isApple ? sid!.slice(6) : null;
  const ytVideoId = track.youtube_video_id || (isYouTubeSentinel ? sid!.slice(3) : null);
  const showApple = !!appleMusicId;
  const showYouTube = !!ytVideoId;
  const sharerName = sharer?.display_name || sharer?.username || null;

  return (
    <div className="min-h-screen bg-[#080B12]">
      <div className="mx-auto max-w-[420px] px-6 py-12">

        {/* Sharer */}
        {sharer && sharerName && sharer.username && (
          <Link
            to={`/profile/${sharer.username}`}
            className="mb-8 flex items-center gap-2 text-xs text-[#4a6a8a] transition-colors hover:text-[#F0EBE3]"
          >
            {sharer.avatar_url ? (
              <img
                src={sharer.avatar_url}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a2535] text-xs font-bold text-[#FF2D78]">
                {(sharerName[0] || "?").toUpperCase()}
              </div>
            )}
            <span>{sharerName} shared this</span>
          </Link>
        )}

        {/* Album art */}
        <div className="mx-auto w-full max-w-[280px]">
          {track.album_art_url && !artError ? (
            <img
              src={track.album_art_url}
              alt=""
              className="w-full rounded-2xl object-cover"
              onError={() => setArtError(true)}
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-[#1a2535] bg-[#0F1520]">
              <Music className="h-12 w-12 text-[#4a6a8a]" />
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="mt-6 text-center">
          <p className="text-xl font-medium text-[#F0EBE3]">{track.title}</p>
          <p className="mt-1 text-sm text-[#4a6a8a]">{track.artist}</p>
          {track.album && (
            <p className="mt-0.5 text-xs" style={{ color: "rgba(74,106,138,0.6)" }}>
              {track.album}
            </p>
          )}
        </div>

        {/* Platform buttons */}
        <div className="mt-8 flex flex-col gap-3">
          {showSpotify && (
            <a
              href={`https://open.spotify.com/track/${track.spotify_track_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#1DB954] px-6 py-3.5 text-sm font-medium text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Listen on Spotify
            </a>
          )}

          {showApple && (
            <a
              href={`https://music.apple.com/us/song/${appleMusicId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#FC3C44] px-6 py-3.5 text-sm font-medium text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
              </svg>
              Listen on Apple Music
            </a>
          )}

          {showYouTube && (
            <a
              href={`https://music.youtube.com/watch?v=${ytVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#FF0000] px-6 py-3.5 text-sm font-medium text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
              </svg>
              Listen on YouTube Music
            </a>
          )}

          <a
            href={`https://tidal.com/search?q=${q}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-3 rounded-full border border-[#1a2535] bg-[#0F1520] px-6 py-3.5 text-sm font-medium text-[#F0EBE3]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004L8.008 8l4.004 4-4.004 4.004 4.004 4.004 4.004-4.004-4.004-4.004 4.004-4L20.02 3.992l4.004 4.004-4.004 4.004-4.004-4.004-4.004 4.004z" />
            </svg>
            Search on Tidal
          </a>

          <a
            href={`https://music.amazon.com/search/${q}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-3 rounded-full border border-[#1a2535] bg-[#0F1520] px-6 py-3.5 text-sm font-medium text-[#F0EBE3]"
          >
            <span className="text-base font-bold leading-none">a</span>
            Search on Amazon Music
          </a>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          {sharerName && sharer?.username ? (
            <Link
              to={`/profile/${sharer.username}`}
              className="text-xs text-[#4a6a8a] transition-colors hover:text-[#F0EBE3]"
            >
              see what {sharerName} is listening to →
            </Link>
          ) : (
            <a
              href="https://onplai.lovable.app"
              className="text-xs text-[#4a6a8a] transition-colors hover:text-[#F0EBE3]"
            >
              find music with friends
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default SongShare;
