import { useState, useEffect, useCallback, useRef } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatTimestamp } from "@/lib/formatTimestamp";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "new_find" | "following" | "love";

type RadarArtistRow = {
  id: string;
  user_id: string;
  name: string;
  status: Status;
  photo_url: string | null;
  source_platform: string | null;
  source_url: string | null;
  genre: string[] | null;
  strengths: string[] | null;
  discovered_at: string | null;
  location: string | null;
  spotify_artist_id: string | null;
  spotify_monthly_listeners: number | null;
  spotify_followers: number | null;
  spotify_popularity: number | null;
  spotify_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  twitter_url: string | null;
  soundcloud_url: string | null;
  youtube_url: string | null;
  apple_music_url: string | null;
  created_at: string;
  updated_at: string;
};

type RadarNote = {
  id: string;
  artist_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type RadarMetric = {
  id: string;
  artist_id: string;
  recorded_at: string;
  spotify_monthly_listeners: number | null;
  instagram_followers: number | null;
  tiktok_followers: number | null;
  youtube_subscribers: number | null;
  note: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: Status; label: string; emoji: string }[] = [
  { value: "new_find", label: "new find", emoji: "💡" },
  { value: "following", label: "following", emoji: "🎧" },
  { value: "love", label: "love", emoji: "🖤" },
];

const SOCIAL_LINK_KEYS: {
  key: keyof Pick<
    RadarArtistRow,
    | "instagram_url"
    | "tiktok_url"
    | "twitter_url"
    | "soundcloud_url"
    | "youtube_url"
    | "apple_music_url"
    | "spotify_url"
  >;
  label: string;
}[] = [
  { key: "instagram_url", label: "Instagram" },
  { key: "tiktok_url", label: "TikTok" },
  { key: "twitter_url", label: "Twitter/X" },
  { key: "soundcloud_url", label: "SoundCloud" },
  { key: "youtube_url", label: "YouTube" },
  { key: "apple_music_url", label: "Apple Music" },
  { key: "spotify_url", label: "Spotify" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-xl p-4">{children}</div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
    {children}
  </p>
);

// ─── Main component ───────────────────────────────────────────────────────────

const RadarArtist = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [artist, setArtist] = useState<RadarArtistRow | null>(null);
  const [notes, setNotes] = useState<RadarNote[]>([]);
  const [metrics, setMetrics] = useState<RadarMetric[]>([]);
  const [fetching, setFetching] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Menu / delete
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Status update
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Spotify refresh
  const [refreshingSpotify, setRefreshingSpotify] = useState(false);

  // Metrics inline form
  const [showMetricForm, setShowMetricForm] = useState(false);
  const [metricForm, setMetricForm] = useState({
    spotify_monthly_listeners: "",
    instagram_followers: "",
    tiktok_followers: "",
    youtube_subscribers: "",
    note: "",
  });
  const [savingMetric, setSavingMetric] = useState(false);

  // Notes inline form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!user || !id) return;

    const [artistRes, notesRes, metricsRes] = await Promise.all([
      (supabase
        .from("radar_artists" as any)
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle() as any),
      (supabase
        .from("radar_notes" as any)
        .select("*")
        .eq("artist_id", id)
        .order("created_at", { ascending: false }) as any),
      (supabase
        .from("radar_metrics" as any)
        .select("*")
        .eq("artist_id", id)
        .order("recorded_at", { ascending: true }) as any),
    ]);

    if (!artistRes.data) {
      setNotFound(true);
    } else {
      setArtist(artistRes.data as RadarArtistRow);
    }
    setNotes((notesRes.data as RadarNote[]) ?? []);
    setMetrics((metricsRes.data as RadarMetric[]) ?? []);
    setFetching(false);
  }, [user, id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleStatusChange = async (newStatus: Status) => {
    if (!artist || statusUpdating) return;
    const prev = artist.status;
    setArtist({ ...artist, status: newStatus });
    setStatusUpdating(true);
    const { error } = await (supabase
      .from("radar_artists" as any)
      .update({ status: newStatus } as any)
      .eq("id", artist.id) as any);
    if (error) {
      setArtist({ ...artist, status: prev });
      toast.error("couldn't update status");
    }
    setStatusUpdating(false);
  };

  const handleDelete = async () => {
    if (!artist) return;
    setDeleting(true);
    await (supabase
      .from("radar_artists" as any)
      .delete()
      .eq("id", artist.id) as any);
    toast("artist removed");
    navigate("/radar");
  };

  const handleRefreshSpotify = async () => {
    if (!artist?.spotify_url && !artist?.spotify_artist_id) return;
    setRefreshingSpotify(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "fetch-spotify-artist",
        { body: { spotify_url: artist.spotify_url, user_id: user?.id } }
      );
      if (error || !data) throw new Error("fetch failed");

      const updates: Partial<RadarArtistRow> = {};
      if (data.spotify_monthly_listeners != null)
        updates.spotify_monthly_listeners = data.spotify_monthly_listeners;
      if (data.spotify_followers != null)
        updates.spotify_followers = data.spotify_followers;
      if (data.spotify_popularity != null)
        updates.spotify_popularity = data.spotify_popularity;

      await (supabase
        .from("radar_artists" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", artist.id) as any);

      setArtist((prev) => (prev ? { ...prev, ...updates } : prev));
      toast("spotify data refreshed");
    } catch {
      toast.error("couldn't refresh — try again");
    } finally {
      setRefreshingSpotify(false);
    }
  };

  const handleSaveMetric = async () => {
    if (!artist || !user) return;
    setSavingMetric(true);

    const payload: Record<string, unknown> = {
      artist_id: artist.id,
      user_id: user.id,
      recorded_at: new Date().toISOString(),
      spotify_monthly_listeners: metricForm.spotify_monthly_listeners
        ? Number(metricForm.spotify_monthly_listeners)
        : null,
      instagram_followers: metricForm.instagram_followers
        ? Number(metricForm.instagram_followers)
        : null,
      tiktok_followers: metricForm.tiktok_followers
        ? Number(metricForm.tiktok_followers)
        : null,
      youtube_subscribers: metricForm.youtube_subscribers
        ? Number(metricForm.youtube_subscribers)
        : null,
      note: metricForm.note.trim() || null,
    };

    const { data: inserted, error } = await (supabase
      .from("radar_metrics" as any)
      .insert(payload as any)
      .select("*")
      .single() as any);

    if (error || !inserted) {
      toast.error("couldn't save snapshot");
    } else {
      setMetrics((prev) => [...prev, inserted as RadarMetric]);
      setMetricForm({
        spotify_monthly_listeners: "",
        instagram_followers: "",
        tiktok_followers: "",
        youtube_subscribers: "",
        note: "",
      });
      setShowMetricForm(false);
      toast("snapshot logged");
    }
    setSavingMetric(false);
  };

  const handleSaveNote = async () => {
    if (!artist || !user || !noteContent.trim()) return;
    setSavingNote(true);

    const { data: inserted, error } = await (supabase
      .from("radar_notes" as any)
      .insert({
        artist_id: artist.id,
        user_id: user.id,
        content: noteContent.trim(),
      } as any)
      .select("*")
      .single() as any);

    if (error || !inserted) {
      toast.error("couldn't save note");
    } else {
      setNotes((prev) => [inserted as RadarNote, ...prev]);
      setNoteContent("");
      setShowNoteForm(false);
    }
    setSavingNote(false);
  };

  // ── Guards ────────────────────────────────────────────────────────────────

  if (authLoading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-3">
        <p className="text-sm text-muted-foreground">artist not found</p>
        <Link to="/radar" className="text-xs text-primary hover:opacity-80">
          ← back to radar
        </Link>
      </div>
    );
  }

  if (!artist) return null;

  // ── Derived ───────────────────────────────────────────────────────────────

  const genreTags = artist.genre ?? [];

  const activeSocialLinks = SOCIAL_LINK_KEYS.filter(
    ({ key }) => artist[key] != null && String(artist[key]).length > 0
  );

  const hasSpotifyData =
    artist.spotify_artist_id != null ||
    artist.spotify_monthly_listeners != null;

  // Only show columns that have at least one value
  const metricCols: {
    key: keyof RadarMetric;
    label: string;
  }[] = (
    [
      { key: "spotify_monthly_listeners", label: "monthly" },
      { key: "instagram_followers", label: "IG" },
      { key: "tiktok_followers", label: "TT" },
      { key: "youtube_subscribers", label: "YT" },
    ] as { key: keyof RadarMetric; label: string }[]
  ).filter((col) => metrics.some((m) => m[col.key] != null));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        className="max-w-[480px] mx-auto px-4 pb-24 space-y-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between py-3">
          <Link
            to="/radar"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← radar
          </Link>

          {/* Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 text-lg leading-none"
            >
              •••
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl overflow-hidden z-20 min-w-[120px]">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate(`/radar/edit/${artist.id}`);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-secondary transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Delete confirm ── */}
        {showDeleteConfirm && (
          <SectionCard>
            <p className="text-sm text-foreground mb-1">remove {artist.name}?</p>
            <p className="text-xs text-muted-foreground mb-4">
              this cannot be undone — all notes and snapshots will be deleted
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-full border border-border py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-full bg-destructive py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {deleting ? "removing…" : "remove"}
              </button>
            </div>
          </SectionCard>
        )}

        {/* ── Hero ── */}
        <SectionCard>
          <div className="flex items-start gap-4">
            {/* Photo */}
            <div className="flex-shrink-0">
              {artist.photo_url ? (
                <img
                  src={artist.photo_url}
                  alt={artist.name}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                  {artist.name[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-black tracking-tight text-foreground truncate">
                {artist.name}
              </h1>

              {genreTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {genreTags.map((g) => (
                    <span
                      key={g}
                      className="inline-flex items-center rounded-full bg-card border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {artist.strengths && artist.strengths.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {artist.strengths.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center rounded-full bg-card border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {artist.location && (
                <p className="text-xs text-muted-foreground mt-1">
                  {artist.location}
                </p>
              )}

              {(artist.source_platform || artist.discovered_at) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {[
                    artist.source_platform
                      ? `found on ${artist.source_platform}`
                      : null,
                    artist.discovered_at
                      ? `discovered ${formatShortDate(artist.discovered_at)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ── Status selector ── */}
        <SectionCard>
          <SectionLabel>status</SectionLabel>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const selected = artist.status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={statusUpdating}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-medium border transition-colors disabled:opacity-60 ${
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Platform links ── */}
        {activeSocialLinks.length > 0 && (
          <SectionCard>
            <SectionLabel>links</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {activeSocialLinks.map(({ key, label }) => (
                <a
                  key={key}
                  href={String(artist[key])}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {label} ↗
                </a>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Spotify data ── */}
        {hasSpotifyData && (
          <SectionCard>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>spotify</SectionLabel>
              <button
                onClick={handleRefreshSpotify}
                disabled={refreshingSpotify}
                className="text-xs text-primary hover:opacity-80 transition-opacity disabled:opacity-50 mb-3"
              >
                {refreshingSpotify ? "refreshing…" : "refresh →"}
              </button>
            </div>

            {artist.spotify_monthly_listeners != null && (
              <div className="mb-3">
                <p className="text-2xl font-medium text-foreground">
                  {artist.spotify_monthly_listeners.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">monthly listeners</p>
              </div>
            )}

            {artist.spotify_followers != null && (
              <p className="text-sm text-muted-foreground mb-3">
                {artist.spotify_followers.toLocaleString()} followers
              </p>
            )}

            {artist.spotify_popularity != null && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">popularity</p>
                  <p className="text-xs text-muted-foreground">
                    {artist.spotify_popularity}/100
                  </p>
                </div>
                <div className="h-1.5 rounded-full bg-card overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${artist.spotify_popularity}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              last refreshed {formatTimestamp(artist.updated_at)}
            </p>
          </SectionCard>
        )}

        {/* ── Metrics ── */}
        <SectionCard>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>snapshots</SectionLabel>
            {!showMetricForm && (
              <button
                onClick={() => setShowMetricForm(true)}
                className="text-xs text-primary hover:opacity-80 transition-opacity mb-3"
              >
                + log snapshot
              </button>
            )}
          </div>

          {showMetricForm && (
            <div className="mb-4 space-y-3">
              {(
                [
                  {
                    key: "spotify_monthly_listeners",
                    label: "Spotify monthly listeners",
                  },
                  { key: "instagram_followers", label: "Instagram followers" },
                  { key: "tiktok_followers", label: "TikTok followers" },
                  { key: "youtube_subscribers", label: "YouTube subscribers" },
                ] as { key: keyof typeof metricForm; label: string }[]
              ).map(({ key, label }) => (
                <div key={key}>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={metricForm[key]}
                    onChange={(e) =>
                      setMetricForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder="—"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
              <div>
                <p className="text-xs text-muted-foreground mb-1">note</p>
                <input
                  type="text"
                  value={metricForm.note}
                  onChange={(e) =>
                    setMetricForm((prev) => ({ ...prev, note: e.target.value }))
                  }
                  placeholder="optional note"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowMetricForm(false)}
                  className="flex-1 rounded-full border border-border py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  cancel
                </button>
                <button
                  onClick={handleSaveMetric}
                  disabled={savingMetric}
                  className="flex-1 rounded-full bg-primary py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {savingMetric ? "saving…" : "save snapshot"}
                </button>
              </div>
            </div>
          )}

          {metrics.length === 0 && !showMetricForm && (
            <p className="text-xs text-muted-foreground">
              no snapshots yet — log your first one
            </p>
          )}

          {metrics.length > 0 && (
            <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-2 font-normal pr-4">date</th>
                    {metricCols.map((col) => (
                      <th
                        key={col.key}
                        className="text-right pb-2 font-normal pr-2"
                      >
                        {col.label}
                      </th>
                    ))}
                    {metrics.some((m) => m.note) && (
                      <th className="text-left pb-2 font-normal pl-2">note</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-muted-foreground pr-4 whitespace-nowrap">
                        {formatShortDate(m.recorded_at)}
                      </td>
                      {metricCols.map((col) => (
                        <td
                          key={col.key}
                          className="py-2 text-right text-foreground pr-2 whitespace-nowrap"
                        >
                          {fmtNum(m[col.key] as number | null)}
                        </td>
                      ))}
                      {metrics.some((mx) => mx.note) && (
                        <td className="py-2 text-muted-foreground pl-2 max-w-[120px] truncate">
                          {m.note ?? ""}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* ── Notes ── */}
        <SectionCard>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>notes</SectionLabel>
            {!showNoteForm && (
              <button
                onClick={() => setShowNoteForm(true)}
                className="text-xs text-primary hover:opacity-80 transition-opacity mb-3"
              >
                + add note
              </button>
            )}
          </div>

          {showNoteForm && (
            <div className="mb-4 space-y-2">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="first impressions..."
                rows={4}
                autoFocus
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowNoteForm(false);
                    setNoteContent("");
                  }}
                  className="flex-1 rounded-full border border-border py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || !noteContent.trim()}
                  className="flex-1 rounded-full bg-primary py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {savingNote ? "saving…" : "save"}
                </button>
              </div>
            </div>
          )}

          {notes.length === 0 && !showNoteForm && (
            <p className="text-xs text-muted-foreground">
              no notes yet — add your first impression
            </p>
          )}

          {notes.length > 0 && (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id}>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(note.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default RadarArtist;
