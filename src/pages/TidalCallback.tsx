import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TidalCallback = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("connecting to Tidal...");

  useEffect(() => {
    const exchange = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const codeVerifier = sessionStorage.getItem("tidal_code_verifier");

      if (!code || !codeVerifier) {
        setStatus("missing authorization code");
        toast.error("Tidal login failed — missing code");
        setTimeout(() => navigate("/"), 2000);
        return;
      }

      try {
        const userId = user?.id;
        if (!userId) {
          // Store tokens temporarily — user needs to auth first
          sessionStorage.setItem("tidal_pending_code", code);
          toast("Tidal connected — sign in to link your account");
          navigate("/");
          return;
        }

        const { data, error } = await supabase.functions.invoke("tidal-exchange-token", {
          body: {
            code,
            code_verifier: codeVerifier,
            redirect_uri: `${window.location.origin}/auth/tidal/callback`,
            user_id: userId,
          },
        });

        sessionStorage.removeItem("tidal_code_verifier");

        if (error || !data?.success) {
          setStatus("token exchange failed");
          toast.error("Tidal auth failed");
          setTimeout(() => navigate("/"), 2000);
          return;
        }

        // Trigger sync
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.functions.invoke("sync-tidal-likes", {
            body: { user_id: userId },
            headers: { Authorization: `Bearer ${session?.access_token}` },
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
  }, [user, navigate]);

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
