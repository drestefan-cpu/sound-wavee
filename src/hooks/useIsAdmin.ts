import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Whether the signed-in user is a PLAI admin (listed in the app_admins table).
 * Checked by the database (is_admin()), so it can't be faked from the browser.
 */
export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      setChecked(true);
      return;
    }
    (supabase.rpc as any)("is_admin").then(({ data }: { data: boolean | null }) => {
      if (cancelled) return;
      setIsAdmin(data === true);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isAdmin, checked };
}
