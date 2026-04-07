import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithSpotify: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTO_SYNC_INTERVAL = 20 * 60 * 1000; // 20 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const storeTokensAndSync = async (userId: string, providerToken: string, providerRefreshToken: string | null, metadata: any) => {
    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: userId,
      spotify_access_token: providerToken,
      spotify_refresh_token: providerRefreshToken,
      display_name: metadata?.full_name || metadata?.name,
      avatar_url: metadata?.avatar_url || metadata?.picture,
    } as any, { onConflict: "id" });

    if (upsertError) console.error("Profile upsert failed:", upsertError.message, upsertError);

    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("sync-spotify-likes", {
      body: { user_id: userId },
      headers: { Authorization: `Bearer ${currentSession?.access_token}` },
    });
    if (error) console.error("Sync failed:", error.message, error);
    else console.log("Sync success:", data?.count, "tracks");
  };

  const triggerAutoSync = async (userId: string) => {
    try {
      const { data: profile } = await supabase.from("profiles").select("last_synced_at").eq("id", userId).single();
      const lastSynced = profile?.last_synced_at ? new Date(profile.last_synced_at).getTime() : 0;
      const now = Date.now();
      if (!lastSynced || now - lastSynced > AUTO_SYNC_INTERVAL) {
        console.log("Auto-sync: triggering background sync");
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        await supabase.functions.invoke("sync-spotify-likes", {
          body: { user_id: userId },
          headers: { Authorization: `Bearer ${currentSession?.access_token}` },
        });
      }
    } catch (e) {
      console.error("Auto-sync error:", e);
    }
  };

  // Handle OAuth redirect — FIRST useEffect
  useEffect(() => {
    const handleOAuthRedirect = async () => {
      const hash = window.location.hash;
      if (!hash || !hash.includes("provider_token")) return;

      const params = new URLSearchParams(hash.substring(1));
      const providerToken = params.get("provider_token");
      const providerRefreshToken = params.get("provider_refresh_token");
      if (!providerToken) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      console.log("OAuth redirect captured, storing token for:", session.user.id);

      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: session.user.id,
        spotify_access_token: providerToken,
        spotify_refresh_token: providerRefreshToken,
        display_name: session.user.user_metadata?.full_name ||
                      session.user.user_metadata?.name ||
                      session.user.email?.split("@")[0],
        avatar_url: session.user.user_metadata?.avatar_url ||
                    session.user.user_metadata?.picture,
      } as any, { onConflict: "id" });

      if (upsertError) {
        console.error("Profile upsert failed:", upsertError);
        return;
      }

      console.log("Token stored, starting sync...");

      const { data, error } = await supabase.functions.invoke("sync-spotify-likes", {
        body: { user_id: session.user.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      console.log("Sync result:", data?.count, "tracks, error:", error?.message);
      window.history.replaceState(null, "", window.location.pathname);
    };

    handleOAuthRedirect();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);

        if (event === "SIGNED_IN" && session?.provider_token) {
          storeTokensAndSync(
            session.user.id,
            session.provider_token,
            session.provider_refresh_token ?? null,
            session.user.user_metadata
          );
        }

        // Auto-sync on sign in
        if (event === "SIGNED_IN" && session?.user) {
          setTimeout(() => triggerAutoSync(session.user.id), 3000);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      // Auto-sync on app open
      if (session?.user) {
        setTimeout(() => triggerAutoSync(session.user.id), 3000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Set up recurring sync interval
  useEffect(() => {
    if (session?.user) {
      syncIntervalRef.current = setInterval(() => {
        triggerAutoSync(session.user.id);
      }, AUTO_SYNC_INTERVAL);
    }
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, [session?.user?.id]);

  const signInWithSpotify = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "spotify",
      options: {
        redirectTo: `${window.location.origin}/feed`,
        scopes: "user-library-read user-read-email user-read-private streaming user-read-playback-state user-modify-playback-state user-read-recently-played",
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-")) localStorage.removeItem(key);
    });
    sessionStorage.clear();
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signInWithSpotify,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
