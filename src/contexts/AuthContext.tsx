import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  syncing: boolean;
  syncError: boolean;
  syncCount: number | null;
  signInWithSpotify: () => Promise<void>;
  signOut: () => Promise<void>;
  triggerSync: () => Promise<number>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [syncCount, setSyncCount] = useState<number | null>(null);
  const hasSynced = useRef(false);

  const storeTokensAndSync = async (s: Session) => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    // Capture provider tokens from the session
    const providerToken = s.provider_token;
    const providerRefreshToken = s.provider_refresh_token;

    if (providerToken) {
      // Store tokens in profiles table
      const updateData: Record<string, string> = { spotify_access_token: providerToken };
      if (providerRefreshToken) {
        updateData.spotify_refresh_token = providerRefreshToken;
      }
      await supabase.from("profiles").update(updateData as any).eq("id", s.user.id);
    }

    // Trigger sync
    setSyncing(true);
    setSyncError(false);
    setSyncCount(null);
    try {
      const { data } = await supabase.functions.invoke("sync-spotify-likes", {
        body: { user_id: s.user.id },
      });
      const count = data?.count ?? 0;
      setSyncCount(count);
      if (count === 0) {
        setSyncError(true);
      }
    } catch (e) {
      console.error("Auto-sync error:", e);
      setSyncError(true);
    }
    setSyncing(false);
  };

  const triggerSync = async (): Promise<number> => {
    if (!session?.user) return 0;
    setSyncing(true);
    setSyncError(false);
    try {
      const { data } = await supabase.functions.invoke("sync-spotify-likes", {
        body: { user_id: session.user.id },
      });
      const count = data?.count ?? 0;
      setSyncCount(count);
      setSyncing(false);
      return count;
    } catch (e) {
      console.error("Sync error:", e);
      setSyncError(true);
      setSyncing(false);
      return 0;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setLoading(false);

        if (session?.user && !hasSynced.current) {
          storeTokensAndSync(session);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user && !hasSynced.current) {
        storeTokensAndSync(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithSpotify = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "spotify",
      options: {
        redirectTo: window.location.origin + "/feed",
        scopes: "user-library-read user-read-email",
      },
    });
  };

  const signOut = async () => {
    hasSynced.current = false;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        syncing,
        syncError,
        syncCount,
        signInWithSpotify,
        signOut,
        triggerSync,
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
