import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PlatformContextType {
  preferredPlatform: string;
  setPreferredPlatform: (p: string) => void;
}

const PlatformContext = createContext<PlatformContextType>({ preferredPlatform: "spotify", setPreferredPlatform: () => {} });

export function PlatformProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferredPlatform, setPlatform] = useState("spotify");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("preferred_platform").eq("id", user.id).single()
      .then(({ data }) => { if ((data as any)?.preferred_platform) setPlatform((data as any).preferred_platform); });
  }, [user]);

  const setPreferredPlatform = (p: string) => {
    setPlatform(p);
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
