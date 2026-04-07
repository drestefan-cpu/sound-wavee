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
        const clientId = (import.meta as any).env?.VITE_TIDAL_CLIENT_ID;
        if (!clientId) {
          setStatus("Tidal not configured");
          toast.error("Tidal client ID not set");
          setTimeout(() => navigate("/"), 2000);
          return;
        }

        const tokenRes = await fetch("https://auth.tidal.com/v1/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: `${window.location.origin}/auth/tidal/callback`,
            client_id: clientId,
            code_verifier: codeVerifier,
          }),
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
          setStatus("token exchange failed");
          toast.error("Tidal auth failed");
          setTimeout(() => navigate("/"), 2000);
          return;
        }

        sessionStorage.removeItem("tidal_code_verifier");

        if (user) {
          // Update existing profile
          await supabase.from("profiles").update({
            tidal_access_token: tokenData.access_token,
            tidal_refresh_token: tokenData.refresh_token || null,
            platform: "tidal",
          } as any).eq("id", user.id);

          // Trigger sync
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.functions.invoke("sync-tidal-likes", {
            body: { user_id: user.id },
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });

          toast.success("Tidal connected!");
          navigate("/feed");
        } else {
          // Store tokens temporarily — user needs to auth with Spotify/email first
          sessionStorage.setItem("tidal_tokens", JSON.stringify(tokenData));
          toast("Tidal connected — sign in to link your account");
          navigate("/");
        }
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
