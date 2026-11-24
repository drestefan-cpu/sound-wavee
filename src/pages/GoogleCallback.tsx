import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

const APIKEY = SUPABASE_PUBLISHABLE_KEY;

const GoogleCallback = () => {
  const navigate = useNavigate();
  const [statusText, setStatusText] = useState("connecting your account…");

  useEffect(() => {
    let handled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const handleSession = async (session: Session) => {
      if (handled) return;
      handled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);

      // Save the Google (YouTube) token so sync-youtube-likes can use it.
      // Google only sends a refresh token on first consent — don't overwrite an existing one with null.
      if (session.provider_token) {
        setStatusText("connecting YouTube Music…");
        await supabase
          .from("profiles")
          .update({
            youtube_access_token: session.provider_token,
            ...(session.provider_refresh_token ? { youtube_refresh_token: session.provider_refresh_token } : {}),
          } as any)
          .eq("id", session.user.id);
      }

      setStatusText("syncing your liked music…");
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/sync-youtube-likes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: APIKEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ user_id: session.user.id }),
        });
      } catch {
        // non-fatal — auto-sync will retry
      }
      toast.success("YouTube Music connected!");
      navigate("/feed");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) handleSession(session);
    });

    // Also check if session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleSession(session);
    });

    // Timeout fallback
    timeout = setTimeout(() => {
      subscription.unsubscribe();
      toast.error("Connection failed — please try again");
      navigate("/");
    }, 15000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{statusText}</p>
      </div>
    </div>
  );
};

export default GoogleCallback;
