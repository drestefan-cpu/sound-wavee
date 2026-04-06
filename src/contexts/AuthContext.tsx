import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  syncing: boolean;
  syncError: boolean;
  signInWithSpotify: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const hasSynced = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setLoading(false);

        if (session?.user && !hasSynced.current) {
          hasSynced.current = true;
          setSyncing(true);
          setSyncError(false);
          try {
            const { data } = await supabase.functions.invoke("sync-spotify-likes", {
              body: { user_id: session.user.id },
            });
            if (!data?.count || data.count === 0) {
              setSyncError(true);
            }
          } catch (e) {
            console.error("Auto-sync error:", e);
            setSyncError(true);
          }
          setSyncing(false);
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
