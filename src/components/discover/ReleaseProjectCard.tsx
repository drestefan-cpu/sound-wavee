import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { usePlatform } from "@/contexts/PlatformContext";
import { openUrl } from "@/lib/openUrl";
import FriendAvatars, { type FriendLike } from "@/components/discover/FriendAvatars";

/**
 * One new project (album, EP or single with several songs) in Discover → releases.
 * Collapsed: cover, title, artist, type and song count. Tap to show its songs.
 */

export interface ReleaseProject {
  key: string;
  album: string;
  artist: string;
  albumArtUrl: string | null;
  spotifyAlbumId: string | null;
  typeLabel: string;
  totalTracks: number | null;
  badge?: "today" | "new";
  releaseDate: string | null;
  friends: FriendLike[];
}

const projectUrl = (platform: string, p: ReleaseProject) => {
  const q = encodeURIComponent(`${p.album} ${p.artist}`);
  switch (platform) {
    case "apple_music":
      return `https://music.apple.com/search?term=${q}`;
    case "tidal":
      return `https://tidal.com/search?q=${q}`;
    case "youtube_music":
      return `https://music.youtube.com/search?q=${q}`;
    case "amazon_music":
      return `https://music.amazon.com/search/${q}`;
    default:
      return p.spotifyAlbumId ? `https://open.spotify.com/album/${p.spotifyAlbumId}` : `https://open.spotify.com/search/${q}`;
  }
};

const formatDate = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

interface Props {
  project: ReleaseProject;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

const ReleaseProjectCard = ({ project, badge, children }: Props) => {
  const [open, setOpen] = useState(false);
  const { preferredPlatform } = usePlatform();
  const count = project.totalTracks ? `${project.totalTracks} songs` : null;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
          {project.albumArtUrl ? <img src={project.albumArtUrl} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{project.album}</p>
          <p className="truncate text-xs text-muted-foreground">{project.artist}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            {badge}
            <span className="uppercase tracking-[0.08em]">{project.typeLabel}</span>
            {count && <span>· {count}</span>}
            {project.releaseDate && <span>· {formatDate(project.releaseDate)}</span>}
          </div>
          <FriendAvatars friends={project.friends} />
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border p-3">
          {children}
          <button
            onClick={() => openUrl(projectUrl(preferredPlatform, project))}
            className="flex items-center gap-1.5 pt-1 text-xs text-primary"
          >
            <ExternalLink className="h-3 w-3" /> open the full {project.typeLabel.toLowerCase()}
          </button>
        </div>
      )}
    </div>
  );
};

export default ReleaseProjectCard;
