import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TidalCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("connecting to Tidal...");

  useEffect(() => {
    const exchange = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const codeVerifier = localStorage.getItem("tidal_code_verifier");

      if (!code || !codeVerifier) {
        setStatus("missing authorization code");
        toast.error("Tidal login failed — missing code");
        setTimeout(() => navigate("/"), 2000);
        return;
      }

      try {
        // Use localStorage — survives cross-origin redirects unlike sessionStorage
        let userId = localStorage.getItem("tidal_user_id");

        // If not in localStorage, try Supabase session with retries
        if (!userId) {
          for (let i = 0; i < 4; i++) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const { data } = await supabase.auth.getSession();
            if (data.session?.user?.id) {
              userId = data.session.user.id;
              break;
            }
          }
        }

        if (!userId) {
          setStatus("session not found — please sign in first");
          toast.error("Please sign in before connecting Tidal");
          setTimeout(() => navigate("/"), 2000);
          return;
        }

        setStatus("exchanging tokens...");

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        const { data, error } = await supabase.functions.invoke("tidal-exchange-token", {
          body: {
            code,
            code_verifier: codeVerifier,
            redirect_uri: `${window.location.origin}/auth/tidal/callback`,
            user_id: userId,
          },
        });

        // Clean up localStorage
        localStorage.removeItem("tidal_code_verifier");
        localStorage.removeItem("tidal_user_id");

        if (error || !data?.success) {
          setStatus("token exchange failed");
          toast.error("Tidal auth failed");
          setTimeout(() => navigate("/"), 2000);
          return;
        }

        setStatus("syncing your Tidal library...");

        try {
          await supabase.functions.invoke("sync-tidal-likes", {
            body: { user_id: userId },
            headers: currentSession ? { Authorization: `Bearer ${currentSession.access_token}` } : {},
          });
        } catch {
          // Sync failure is non-fatal
        }

        toast.success("Tidal connected!");
        navigate("/feed");
      } catch (err) {
        setStatus("connection failed");
        toast.error("Tidal connection failed");
        setTimeout(() => navigate("/"), 2000);
      }
    };

    exchange();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
};

export default TidalCallback;
