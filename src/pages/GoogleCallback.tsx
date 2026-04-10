import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://sylwprldxdgbsncwyhfk.supabase.co";
const APIKEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE";

const GoogleCallback = () => {
  const navigate = useNavigate();
  const [statusText, setStatusText] = useState("connecting your account…");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        subscription.unsubscribe();
        setStatusText("syncing your liked music…");
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/sync-youtube-likes`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: APIKEY,
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              user_id: session.user.id,
              access_token: session.provider_token,
            }),
          });
        } catch (e) {
          console.error("Sync failed (non-fatal):", e);
        }
        toast.success("YouTube Music connected!");
        navigate("/feed");
      }
    });

    // Also check if session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        subscription.unsubscribe();
        setStatusText("syncing your liked music…");
        fetch(`${SUPABASE_URL}/functions/v1/sync-youtube-likes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: APIKEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            user_id: session.user.id,
            access_token: session.provider_token,
          }),
        })
          .catch(() => {})
          .finally(() => {
            toast.success("YouTube Music connected!");
            navigate("/feed");
          });
      }
    });

    // Timeout fallback
    const timeout = setTimeout(() => {
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
