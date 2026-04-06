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
  const syncingRef = useRef(false);

  const storeTokensAndSync = async (s: Session) => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    const providerToken = s.provider_token;
    const providerRefreshToken = s.provider_refresh_token;

    // Always store tokens when available (keeps them fresh every login)
    if (providerToken) {
      const updateData: Record<string, string> = {
        spotify_access_token: providerToken,
        display_name: s.user.user_metadata?.full_name || s.user.user_metadata?.name || undefined,
        avatar_url: s.user.user_metadata?.avatar_url || s.user.user_metadata?.picture || undefined,
      };
      // Remove undefined values
      Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);
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
    syncingRef.current = false;
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

        // Always sync on SIGNED_IN event when provider tokens are available
        if (session?.user && session.provider_token) {
          storeTokensAndSync(session);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      // On page load with existing session, sync if provider tokens present
      if (session?.user && session.provider_token) {
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
    syncingRef.current = false;
    await supabase.auth.signOut();
    // Clear all storage to ensure clean account switching
    Object.keys(localStorage).forEach(key => {
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
