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

const AUTO_SYNC_INTERVAL = 7 * 60 * 1000; // 7 minutes
const isLocalDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const localDevUser = isLocalDev
  ? ({
      id: "local-dev-user",
      app_metadata: {},
      user_metadata: {
        full_name: "Local Dev",
        name: "Local Dev",
      },
      aud: "authenticated",
      created_at: new Date(0).toISOString(),
    } as User)
  : null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const storeTokensAndSync = async (
    userId: string,
    providerToken: string,
    providerRefreshToken: string | null,
    metadata: any,
  ) => {
    // Check existing profile first — never overwrite display_name or avatar_url
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .single();

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        spotify_access_token: providerToken,
        spotify_refresh_token: providerRefreshToken,
        display_name: existingProfile?.display_name || metadata?.full_name || metadata?.name,
        avatar_url: existingProfile?.avatar_url || metadata?.avatar_url || metadata?.picture,
      } as any,
      { onConflict: "id" },
    );

    if (upsertError) console.error("Profile upsert failed:", upsertError.message, upsertError);

    const { data, error } = await supabase.functions.invoke("sync-spotify-likes", {
      body: { user_id: userId },
    });
    if (error) console.error("Sync failed:", error.message, error);
    else console.log("Sync success:", data?.count, "tracks");
  };

  const triggerAutoSync = async (userId: string) => {
    try {
      // Don't sync for anonymous users
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.is_anonymous) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("last_synced_at, tidal_access_token")
        .eq("id", userId)
        .single();
      const lastSynced = profile?.last_synced_at ? new Date(profile.last_synced_at).getTime() : 0;
      const now = Date.now();
      const timeSinceSync = now - lastSynced;
      if (!lastSynced || (timeSinceSync > AUTO_SYNC_INTERVAL && timeSinceSync > 60000)) {
        console.log("Auto-sync: triggering background sync");
        await supabase.functions.invoke("sync-spotify-likes", {
          body: { user_id: userId },
        });
        if (profile?.tidal_access_token) {
          await supabase.functions.invoke("sync-tidal-likes", {
            body: { user_id: userId },
          });
        }
      }
    } catch (e) {
      console.error("Auto-sync error:", e);
    }
  };

  // Handle OAuth redirect — FIRST useEffect
  useEffect(() => {
    if (isLocalDev) {
      setLoading(false);
      return;
    }

    const handleOAuthRedirect = async () => {
      const hash = window.location.hash;
      if (!hash || !hash.includes("provider_token")) return;

      const params = new URLSearchParams(hash.substring(1));
      const providerToken = params.get("provider_token");
      const providerRefreshToken = params.get("provider_refresh_token");
      if (!providerToken) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      console.log("OAuth redirect captured, storing token for:", session.user.id);

      // Check existing profile first — never overwrite display_name or avatar_url
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", session.user.id)
        .single();

      const { error: upsertError } = await supabase.from("profiles").upsert(
        {
          id: session.user.id,
          spotify_access_token: providerToken,
          spotify_refresh_token: providerRefreshToken,
          display_name:
            existingProfile?.display_name ||
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email?.split("@")[0],
          avatar_url:
            existingProfile?.avatar_url ||
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture,
        } as any,
        { onConflict: "id" },
      );

      if (upsertError) {
        console.error("Profile upsert failed:", upsertError);
        return;
      }

      console.log("Token stored, starting sync...");

      const { data, error } = await supabase.functions.invoke("sync-spotify-likes", {
        body: { user_id: session.user.id },
      });

      console.log("Sync result:", data?.count, "tracks, error:", error?.message);
      window.history.replaceState(null, "", window.location.pathname);
    };

    handleOAuthRedirect();
  }, []);

  useEffect(() => {
    if (isLocalDev) {
      setLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);

      if (event === "SIGNED_IN" && session?.provider_token) {
        storeTokensAndSync(
          session.user.id,
          session.provider_token,
          session.provider_refresh_token ?? null,
          session.user.user_metadata,
        );
      }

      if (event === "SIGNED_IN" && session?.user) {
        setTimeout(() => triggerAutoSync(session.user.id), 3000);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => triggerAutoSync(session.user.id), 3000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isLocalDev) return;

    if (session?.user) {
      syncIntervalRef.current = setInterval(() => {
        triggerAutoSync(session.user.id);
      }, AUTO_SYNC_INTERVAL);
    }
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [session?.user?.id]);

  const signInWithSpotify = async () => {
    if (isLocalDev) {
      setLoading(false);
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "spotify",
      options: {
        redirectTo: `${window.location.origin}/feed`,
        scopes:
          "user-library-read user-read-email user-read-private streaming user-read-playback-state user-modify-playback-state user-read-recently-played",
      },
    });
  };

  const signOut = async () => {
    if (isLocalDev) {
      setSession(null);
      setLoading(false);
      window.location.href = "/";
      return;
    }

    await supabase.auth.signOut();
    // Only clear app-specific keys — supabase.auth.signOut() handles its own cleanup.
    // Calling localStorage.clear() wipes Supabase's session reconciliation state and
    // prevents it from re-linking the existing Spotify/YouTube identity on next login.
    localStorage.removeItem("tidal_code_verifier");
    localStorage.removeItem("tidal_user_id");
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? localDevUser ?? null,
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
