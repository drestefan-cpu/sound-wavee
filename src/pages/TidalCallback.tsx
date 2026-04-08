import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const getTidalUid = (token: string): string | null => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.uid ? String(payload.uid) : null;
  } catch {
    return null;
  }
};

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
        setStatus("finding your session...");

        let userId = localStorage.getItem("tidal_user_id");

        if (!userId) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user?.id) userId = data.session.user.id;
        }

        if (!userId) {
          for (let i = 0; i < 3; i++) {
            await new Promise((r) => setTimeout(r, 1500));
            const { data } = await supabase.auth.getSession();
            if (data.session?.user?.id) {
              userId = data.session.user.id;
              break;
            }
          }
        }

        if (!userId) {
          setStatus("creating your account...");
          const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
          if (anonError || !anonData.user) {
            toast.error("Please sign in with Spotify first, then connect Tidal in Settings");
            setTimeout(() => navigate("/"), 3000);
            return;
          }
          userId = anonData.user.id;
        }

        setStatus("exchanging tokens...");

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const authToken = session?.access_token || SUPABASE_ANON_KEY;

        console.log("Invoking tidal-exchange-token with userId:", userId);

        const response = await fetch(`${SUPABASE_URL}/functions/v1/tidal-exchange-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            code,
            code_verifier: codeVerifier,
            redirect_uri: `${window.location.origin}/auth/tidal/callback`,
            user_id: userId,
          }),
        });

        const responseText = await response.text();
        console.log("Edge function response:", response.status, responseText);

        localStorage.removeItem("tidal_code_verifier");
        localStorage.removeItem("tidal_user_id");

        let result;
        try {
          result = JSON.parse(responseText);
        } catch {
          setStatus("token exchange failed");
          toast.error("Tidal auth failed — invalid response");
          setTimeout(() => navigate("/"), 2000);
          return;
        }

        if (!response.ok || !result.success) {
          console.error("Token exchange failed:", result);
          setStatus("token exchange failed");
          toast.error(`Tidal auth failed: ${result.error || "unknown error"}`);
          setTimeout(() => navigate("/"), 2000);
          return;
        }

        // Check for existing profile by Tidal UID to prevent duplicate accounts
        if (result.access_token) {
          const tidalUid = getTidalUid(result.access_token);
          if (tidalUid) {
            const { data: existingProfile } = await supabase
              .from("profiles")
              .select("id")
              .eq("tidal_user_id" as any, tidalUid)
              .maybeSingle();
            if (existingProfile && existingProfile.id !== userId) {
              // Found existing profile — use it instead of the new anon account
              userId = existingProfile.id;
            } else {
              // Store tidal_user_id for future logins
              await supabase
                .from("profiles")
                .update({ tidal_user_id: tidalUid } as any)
                .eq("id", userId);
            }
          }
        }

        setStatus("syncing your Tidal library...");

        try {
          await fetch(`${SUPABASE_URL}/functions/v1/sync-tidal-likes`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ user_id: userId }),
          });
        } catch {
          // non-fatal
        }

        toast.success("Tidal connected!");
        navigate("/feed");
      } catch (err) {
        console.error("TidalCallback error:", err);
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
