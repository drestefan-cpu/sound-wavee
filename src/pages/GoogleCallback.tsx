import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const GoogleCallback = () => {
  const navigate = useNavigate();
  const [statusText, setStatusText] = useState("connecting your account…");

  useEffect(() => {
    const handle = async () => {
      let session = null;
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          session = data.session;
          break;
        }
      }
      if (!session) {
        toast.error("Connection failed — please try again");
        navigate("/");
        return;
      }
      setStatusText("syncing your liked music…");
      try {
        await fetch(
          "https://sylwprldxdgbsncwyhfk.supabase.co/functions/v1/sync-youtube-likes",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ user_id: session.user.id }),
          }
        );
      } catch (e) {
        console.error("Sync failed (non-fatal):", e);
      }
      toast.success("YouTube Music connected!");
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

export default GoogleCallback;
