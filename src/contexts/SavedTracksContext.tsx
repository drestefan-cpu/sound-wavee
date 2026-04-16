import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { followArtistForTrack } from "@/lib/followedArtists";

interface SavedTracksContextType {
  savedTrackIds: Set<string>;
  toggleSave: (trackId: string, sourceUserId?: string, sourceContext?: string) => Promise<void>;
  isSaved: (trackId: string) => boolean;
}

const SavedTracksContext = createContext<SavedTracksContextType | undefined>(undefined);

export function SavedTracksProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [savedTrackIds, setSavedTrackIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setSavedTrackIds(new Set()); return; }
    const load = async () => {
      const { data } = await supabase.from("saved_tracks").select("track_id").eq("user_id", user.id);
      setSavedTrackIds(new Set((data || []).map(d => d.track_id)));
    };
    load();
  }, [user]);

  const toggleSave = useCallback(async (trackId: string, sourceUserId?: string, sourceContext?: string) => {
    if (!user) return;
    const alreadySaved = savedTrackIds.has(trackId);
    setSavedTrackIds(prev => {
      const next = new Set(prev);
      if (alreadySaved) next.delete(trackId); else next.add(trackId);
      return next;
    });
    if (alreadySaved) {
      const { error } = await supabase.from("saved_tracks").delete().eq("user_id", user.id).eq("track_id", trackId);
      if (error) {
        setSavedTrackIds(prev => new Set(prev).add(trackId));
        toast.error("couldn't remove — try again");
      }
    } else {
      const { error } = await supabase.from("saved_tracks").insert({
        user_id: user.id, track_id: trackId,
        source_user_id: sourceUserId || null, source_context: sourceContext || "feed",
      } as any);
      if (error) {
        setSavedTrackIds(prev => { const n = new Set(prev); n.delete(trackId); return n; });
        toast.error("couldn't save — try again");
      } else {
        try {
          await followArtistForTrack(user.id, trackId, "saved_track");
        } catch {}

        // Fire-and-forget: add to PLAI playlist in Spotify (non-blocking)
        supabase.functions.invoke("add-to-plai-playlist", {
          body: { user_id: user.id, track_id: trackId },
        }).then(({ data, error }) => {
          if (error || (data as any)?.error === "scope_missing") {
            toast("reconnect Spotify in settings to sync saves to your playlist", { duration: 5000 });
          }
        }).catch(() => {});

        // Fire-and-forget: add to Apple Music library (non-blocking, only runs if authorized)
        supabase
          .from("tracks")
          .select("title, artist")
          .eq("id", trackId)
          .maybeSingle()
          .then(({ data: track }) => {
            if (track?.title && track?.artist) {
              import("@/lib/appleMusicLibrary")
                .then(({ addToAppleMusicLibrary }) =>
                  addToAppleMusicLibrary(track.title, track.artist)
                )
                .catch(() => {});
            }
          });
      }
    }
  }, [user, savedTrackIds]);

  const isSaved = useCallback((trackId: string) => savedTrackIds.has(trackId), [savedTrackIds]);

  return (
    <SavedTracksContext.Provider value={{ savedTrackIds, toggleSave, isSaved }}>
      {children}
    </SavedTracksContext.Provider>
  );
}

const savedTracksFallback: SavedTracksContextType = {
  savedTrackIds: new Set(),
  toggleSave: async () => {},
  isSaved: () => false,
};

export function useSavedTracks() {
  const context = useContext(SavedTracksContext);
  if (!context) {
    console.warn("useSavedTracks called outside SavedTracksProvider — using fallback");
    return savedTracksFallback;
  }
  return context;
}
