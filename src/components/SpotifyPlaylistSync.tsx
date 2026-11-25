import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Settings → Spotify, for people who can't connect Spotify: sync a public playlist instead.
 * Paste link → check (shows the playlist) → use it. Then: sync now / change / remove.
 */

interface PlaylistSummary {
  id: string;
  name: string;
  owner: string | null;
  image: string | null;
  songs: number;
  total: number;
}

interface Props {
  playlistName: string | null;
  syncedAt: string | null;
  onChange: (p: { name: string | null; syncedAt: string | null }) => void;
}

const ago = (ts: string) => {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
};

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("spotify-playlist", { body });
  if (error) {
    // The function's own message (e.g. "make sure it's public") is in the response body
    let message = "something went wrong — try again";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) message = (await ctx.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  return data;
};

const SpotifyPlaylistSync = ({ playlistName, syncedAt, onChange }: Props) => {
  const [editing, setEditing] = useState(!playlistName);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<PlaylistSummary | null>(null);
  const [busy, setBusy] = useState<"check" | "connect" | "sync" | "remove" | null>(null);

  const check = async () => {
    if (!url.trim() || busy) return;
    setBusy("check");
    setPreview(null);
    try {
      const data = await call({ action: "preview", url });
      setPreview(data.playlist);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    setBusy("connect");
    try {
      const data = await call({ action: "connect", url });
      onChange({ name: data.playlist.name, syncedAt: new Date().toISOString() });
      toast.success(`synced ${data.count} songs from “${data.playlist.name}”`);
      setEditing(false);
      setPreview(null);
      setUrl("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    setBusy("sync");
    try {
      const data = await call({ action: "sync" });
      onChange({ name: data.playlist?.name || playlistName, syncedAt: new Date().toISOString() });
      toast.success(`up to date — ${data.count} songs`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("remove");
    try {
      await call({ action: "disconnect" });
      onChange({ name: null, syncedAt: null });
      setEditing(true);
      toast("playlist removed — songs already in your collection stay");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!editing && playlistName) {
    return (
      <div className="ml-5 mt-1.5 space-y-1.5">
        <p className="text-[11px] text-muted-foreground">
          syncing your playlist <span className="text-foreground">“{playlistName}”</span>
          {syncedAt ? ` · updated ${ago(syncedAt)}` : ""}
        </p>
        <div className="flex items-center gap-3 text-[11px]">
          <button onClick={syncNow} disabled={!!busy} className="inline-flex items-center gap-1 text-primary disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${busy === "sync" ? "animate-spin" : ""}`} /> sync now
          </button>
          <button onClick={() => setEditing(true)} disabled={!!busy} className="text-muted-foreground hover:text-foreground">
            change
          </button>
          <button onClick={remove} disabled={!!busy} className="text-destructive hover:underline disabled:opacity-50">
            remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-5 mt-2 space-y-2">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Can't connect Spotify? Sync a <span className="text-foreground">public playlist</span> instead. Add the songs you love to
        it and they'll show up for friends. In Spotify: open the playlist → ⋯ → Share → Copy link.
      </p>
      <div className="flex gap-2">
        <input
          id="spotify-playlist-url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setPreview(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="open.spotify.com/playlist/…"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          className="h-9 min-w-0 flex-1 rounded-full border border-border bg-background px-3.5 text-xs text-foreground placeholder:text-muted-foreground"
        />
        <button
          onClick={check}
          disabled={!url.trim() || !!busy}
          className="h-9 shrink-0 rounded-full border border-border px-4 text-xs font-medium text-foreground disabled:opacity-50"
        >
          {busy === "check" ? "checking…" : "check"}
        </button>
      </div>

      {preview && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-secondary">
            {preview.image && <img src={preview.image} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{preview.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {preview.owner ? `by ${preview.owner} · ` : ""}
              {preview.songs} {preview.songs === 1 ? "song" : "songs"}
            </p>
          </div>
          <button
            onClick={connect}
            disabled={!!busy}
            className="h-8 shrink-0 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy === "connect" ? "syncing…" : "use this"}
          </button>
        </div>
      )}

      {playlistName && (
        <button onClick={() => setEditing(false)} className="text-[11px] text-muted-foreground hover:text-foreground">
          cancel
        </button>
      )}
    </div>
  );
};

export default SpotifyPlaylistSync;
