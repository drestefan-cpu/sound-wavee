import { useState, useRef } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status = "new_find" | "following" | "love";

const STATUS_OPTIONS: { value: Status; label: string; emoji: string }[] = [
  { value: "new_find", label: "new find", emoji: "💡" },
  { value: "following", label: "following", emoji: "🎧" },
  { value: "love", label: "love", emoji: "🖤" },
];

const GENRE_OPTIONS = [
  "Hip-Hop", "R&B", "Pop", "Afrobeats", "Latin",
  "Electronic", "Rock", "Country", "Other",
];

const STRENGTH_OPTIONS = [
  "Charisma", "Creativity", "Hooks", "Lyricism", "Melody", "Messaging",
  "Performance", "Production", "Storytelling", "Structure", "Versatility", "Visuals",
];

const SOCIAL_FIELDS: { key: string; label: string }[] = [
  { key: "instagram_url", label: "Instagram" },
  { key: "tiktok_url", label: "TikTok" },
  { key: "twitter_url", label: "Twitter/X" },
  { key: "soundcloud_url", label: "SoundCloud" },
  { key: "youtube_url", label: "YouTube" },
  { key: "apple_music_url", label: "Apple Music" },
  { key: "spotify_url", label: "Spotify" },
  { key: "distributor", label: "Distributor" },
];

function detectPlatform(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host.includes("instagram.com")) return "Instagram";
    if (host.includes("tiktok.com")) return "TikTok";
    if (host === "open.spotify.com") return "Spotify";
    if (host.includes("soundcloud.com")) return "SoundCloud";
    if (host.includes("youtube.com") || host === "youtu.be") return "YouTube";
    if (host.includes("music.apple.com")) return "Apple Music";
    if (host.includes("twitter.com") || host.includes("x.com")) return "Twitter/X";
    return "Other";
  } catch {
    return "";
  }
}

function extractSpotifyArtistId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "open.spotify.com") return null;
    const match = u.pathname.match(/^\/artist\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function isValidImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">
    {children}
  </p>
);

const fieldInput =
  "w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

const RadarNew = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Core fields
  const [sourceUrl, setSourceUrl] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState("");
  const [spotifyArtistId, setSpotifyArtistId] = useState<string | null>(null);
  const [fetchingSpotify, setFetchingSpotify] = useState(false);
  const [spotifyFetchError, setSpotifyFetchError] = useState("");

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [discoveredAt, setDiscoveredAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<Status>("new_find");
  const [firstNote, setFirstNote] = useState("");

  // Social links
  const [showSocials, setShowSocials] = useState(false);
  const [socials, setSocials] = useState<Record<string, string>>({
    instagram_url: "",
    tiktok_url: "",
    twitter_url: "",
    soundcloud_url: "",
    youtube_url: "",
    apple_music_url: "",
    spotify_url: "",
    distributor: "",
  });

  // Spotify-fetched extras (stored on insert)
  const spotifyExtras = useRef<{
    spotify_monthly_listeners?: number;
    spotify_followers?: number;
    spotify_popularity?: number;
    genre?: string;
  }>({});

  const [submitting, setSubmitting] = useState(false);

  const handleSourceChange = (val: string) => {
    setSourceUrl(val);
    const platform = detectPlatform(val);
    setDetectedPlatform(platform);
    const artistId = extractSpotifyArtistId(val);
    setSpotifyArtistId(artistId);
    setSpotifyFetchError("");
    if (platform === "Spotify" && artistId) {
      setSocials((prev) => ({ ...prev, spotify_url: val }));
    }
  };

  const handleFetchSpotify = async () => {
    if (!user || !sourceUrl) return;
    setFetchingSpotify(true);
    setSpotifyFetchError("");
    try {
      const { data, error } = await supabase.functions.invoke(
        "fetch-spotify-artist",
        { body: { spotify_url: sourceUrl, user_id: user.id } }
      );
      if (error || !data) throw new Error("fetch failed");
      if (data.name) setName(data.name);
      if (data.photo_url) setPhotoUrl(data.photo_url);
      if (data.spotify_artist_id) setSpotifyArtistId(data.spotify_artist_id);
      if (data.genre) setGenres([data.genre]);
      spotifyExtras.current = {
        spotify_monthly_listeners: data.spotify_monthly_listeners ?? undefined,
        spotify_followers: data.spotify_followers ?? undefined,
        spotify_popularity: data.spotify_popularity ?? undefined,
        genre: data.genre ?? undefined,
      };
    } catch {
      setSpotifyFetchError("couldn't fetch — fill in manually");
    } finally {
      setFetchingSpotify(false);
    }
  };

  const toggleGenre = (g: string) => {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const toggleStrength = (s: string) => {
    setStrengths((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!name.trim()) {
      setNameError("artist name is required");
      return;
    }
    setNameError("");
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      user_id: user.id,
      name: name.trim(),
      status,
      source_platform: detectedPlatform || null,
      source_url: sourceUrl.trim() || null,
      photo_url: photoUrl.trim() || null,
      genre: genres.length > 0 ? genres.join(", ") : null,
      strengths: strengths.length > 0 ? strengths : null,
      discovered_at: discoveredAt || null,
      location: location.trim() || null,
      spotify_artist_id: spotifyArtistId,
      instagram_url: socials.instagram_url.trim() || null,
      tiktok_url: socials.tiktok_url.trim() || null,
      twitter_url: socials.twitter_url.trim() || null,
      soundcloud_url: socials.soundcloud_url.trim() || null,
      youtube_url: socials.youtube_url.trim() || null,
      apple_music_url: socials.apple_music_url.trim() || null,
      spotify_url: socials.spotify_url.trim() || null,
      distributor: socials.distributor.trim() || null,
      ...spotifyExtras.current,
    };

    const { data: inserted, error } = await (supabase
      .from("radar_artists" as any)
      .insert(payload as any)
      .select("id")
      .single() as any);

    if (error || !inserted) {
      toast.error("couldn't save — try again");
      setSubmitting(false);
      return;
    }

    if (firstNote.trim()) {
      await (supabase.from("radar_notes" as any).insert({
        artist_id: inserted.id,
        user_id: user.id,
        content: firstNote.trim(),
      } as any) as any);
    }

    toast("added to radar");
    navigate(`/radar/artist/${inserted.id}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        className="max-w-[480px] mx-auto px-4 pb-24"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}
      >
        {/* Header */}
        <div className="py-4 mb-6">
          <Link
            to="/radar"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors block mb-3"
          >
            ← radar
          </Link>
          <h1 className="font-display text-xl font-black tracking-tight">
            add artist
          </h1>
        </div>

        <div className="flex flex-col gap-6">
          {/* 1. Source URL */}
          <div>
            <Label>source url</Label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => handleSourceChange(e.target.value)}
              onBlur={(e) => handleSourceChange(e.target.value)}
              placeholder="paste a link — instagram, spotify, tiktok, anything"
              className={fieldInput}
            />
            {detectedPlatform && (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {detectedPlatform}
                </span>
                {detectedPlatform === "Spotify" && spotifyArtistId && (
                  <button
                    onClick={handleFetchSpotify}
                    disabled={fetchingSpotify}
                    className="text-xs text-primary hover:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    {fetchingSpotify ? "fetching…" : "fetch from Spotify →"}
                  </button>
                )}
              </div>
            )}
            {spotifyFetchError && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {spotifyFetchError}
              </p>
            )}
          </div>

          {/* 1b. Date discovered */}
          <div>
            <Label>date discovered</Label>
            <input
              type="date"
              value={discoveredAt}
              onChange={(e) => setDiscoveredAt(e.target.value)}
              className={`${fieldInput} [color-scheme:dark]`}
            />
          </div>

          {/* 2. Artist name */}
          <div>
            <Label>artist name</Label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              placeholder="artist name"
              className={fieldInput}
            />
            {nameError && (
              <p className="mt-1.5 text-xs text-destructive">{nameError}</p>
            )}
          </div>

          {/* 3. Photo URL */}
          <div>
            <Label>photo url</Label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="photo url (optional)"
              className={fieldInput}
            />
            {photoUrl && isValidImageUrl(photoUrl) && (
              <img
                src={photoUrl}
                alt=""
                className="mt-2 h-12 w-12 rounded-full object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
          </div>

          {/* 4. Genre */}
          <div>
            <Label>genre</Label>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((g) => {
                const selected = genres.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4b. Strengths */}
          <div>
            <Label>strengths</Label>
            <div className="flex flex-wrap gap-2">
              {STRENGTH_OPTIONS.map((s) => {
                const selected = strengths.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleStrength(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Location */}
          <div>
            <Label>location</Label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="city, country"
              className={fieldInput}
            />
          </div>

          {/* 6. Status */}
          <div>
            <Label>status</Label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const selected = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={`flex-1 rounded-full px-3 py-2 text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. Social links (collapsible) */}
          <div>
            <button
              onClick={() => setShowSocials((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              add links {showSocials ? "↑" : "↓"}
            </button>
            {showSocials && (
              <div className="mt-4 flex flex-col gap-4">
                {SOCIAL_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <input
                      type={key === "distributor" ? "text" : "url"}
                      value={socials[key]}
                      onChange={(e) =>
                        setSocials((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder={
                        key === "distributor"
                          ? "distrokid, tunecore, etc"
                          : `${label.toLowerCase()} url`
                      }
                      className={fieldInput}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 8. First note */}
          <div>
            <Label>first impressions</Label>
            <textarea
              value={firstNote}
              onChange={(e) => setFirstNote(e.target.value)}
              placeholder="first impressions..."
              rows={4}
              className={`${fieldInput} resize-none`}
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
          >
            {submitting ? "saving..." : "add to radar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RadarNew;
