import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://sylwprldxdgbsncwyhfk.supabase.co";
const APIKEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE";

const YouTubeCallback = () => {
  const navigate = useNavigate();
  const [statusText, setStatusText] = useState("connecting to YouTube Music…");

  useEffect(() => {
    const handle = async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) {
        toast.error("YouTube Music connection failed — missing code");
        setTimeout(() => navigate("/"), 2000);
        return;
      }

      setStatusText("verifying session…");
      let {
        data: { session },
      } = await supabase.auth.getSession();
      let userId = session?.user?.id || null;

      if (!userId) {
        for (let i = 0; i < 3; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const { data } = await supabase.auth.getSession();
          if (data.session?.user?.id) {
            userId = data.session.user.id;
            session = data.session;
            break;
          }
        }
      }

      if (!userId) {
        setStatusText("creating your account…");
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError || !anonData.user) {
          toast.error("Could not create account — please try again");
          setTimeout(() => navigate("/"), 3000);
          return;
        }
        userId = anonData.user.id;
        const { data: refreshed } = await supabase.auth.getSession();
        session = refreshed.session;
      }

      setStatusText("exchanging token…");
      const authToken = session?.access_token || APIKEY;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-exchange-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: APIKEY,
        },
        body: JSON.stringify({
          code,
          redirect_uri: window.location.origin + "/auth/youtube/callback",
          user_id: userId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(`YouTube Music connection failed: ${result.error || "unknown error"}`);
        setTimeout(() => navigate("/"), 2000);
        return;
      }

      // Returning user — their data is already under existing_user_id
      if (result.existing_user_id && result.existing_user_id !== userId) {
        setStatusText("welcome back…");
        await supabase.auth.signOut();
        toast.success("Welcome back to PLAI!");
        setTimeout(() => navigate("/"), 1500);
        return;
      }

      toast.success("YouTube Music connected!");

      setStatusText("syncing your liked music…");
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/sync-youtube-likes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            apikey: APIKEY,
          },
          body: JSON.stringify({ user_id: userId }),
        });
      } catch (e) {
        console.error("YouTube sync failed (non-fatal):", e);
      }

      navigate("/feed");
    };

    handle();
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

export default YouTubeCallback;
