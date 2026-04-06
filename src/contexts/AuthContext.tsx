import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const storeTokensAndSync = async (userId: string, providerToken: string, providerRefreshToken: string | null, metadata: any) => {
    await supabase.from("profiles").upsert({
      id: userId,
      spotify_access_token: providerToken,
      spotify_refresh_token: providerRefreshToken,
      display_name: metadata?.full_name || metadata?.name,
      avatar_url: metadata?.avatar_url || metadata?.picture,
    } as any, { onConflict: "id" });

    const { data, error } = await supabase.functions.invoke("sync-spotify-likes", {
      body: { user_id: userId },
    });
    console.log("Sync result:", data, error);
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

      await supabase.from("profiles").upsert({
        id: session.user.id,
        spotify_access_token: providerToken,
        spotify_refresh_token: providerRefreshToken,
        display_name: session.user.user_metadata?.full_name ||
                      session.user.user_metadata?.name ||
                      session.user.email?.split("@")[0],
        avatar_url: session.user.user_metadata?.avatar_url ||
                    session.user.user_metadata?.picture,
      } as any, { onConflict: "id" });

      await supabase.functions.invoke("sync-spotify-likes", {
        body: { user_id: session.user.id },
      });

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
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithSpotify = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "spotify",
      options: {
        redirectTo: `${window.location.origin}/feed`,
        scopes: "user-library-read user-read-email user-read-private",
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
