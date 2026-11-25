import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** The signed-in person's username (cached for the session) — used to tag share links with ?from= */
let cached: { userId: string; username: string | null } | null = null;

export function useMyUsername(): string | null {
  const { user } = useAuth();
  const [username, setUsername] = useState<string | null>(cached && user && cached.userId === user.id ? cached.username : null);

  useEffect(() => {
    if (!user) return;
    if (cached?.userId === user.id) {
      setUsername(cached.username);
      return;
    }
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        cached = { userId: user.id, username: (data as { username: string | null } | null)?.username ?? null };
        setUsername(cached.username);
      });
  }, [user]);

  return username;
}
