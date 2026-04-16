import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PlatformContextType {
  preferredPlatform: string;
  setPreferredPlatform: (p: string) => void;
}

const PlatformContext = createContext<PlatformContextType>({ preferredPlatform: "spotify", setPreferredPlatform: () => {} });

const STORAGE_KEY = "plai-platform";

export function PlatformProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferredPlatform, setPlatform] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "spotify"
  );

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("preferred_platform").eq("id", user.id).single()
      .then(({ data }) => {
        const saved = (data as any)?.preferred_platform;
        if (saved) {
          setPlatform(saved);
          localStorage.setItem(STORAGE_KEY, saved);
        }
      });
  }, [user]);

  const setPreferredPlatform = (p: string) => {
    setPlatform(p);
    localStorage.setItem(STORAGE_KEY, p);
    if (user) {
      supabase.from("profiles").update({ preferred_platform: p } as any).eq("id", user.id);
    }
  };

  return (
    <PlatformContext.Provider value={{ preferredPlatform, setPreferredPlatform }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  return useContext(PlatformContext);
}
