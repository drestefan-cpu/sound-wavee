import { clearConnectionIssue } from "@/components/ConnectionNotice";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;

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

        let newAccount = false;
        if (!userId) {
          newAccount = true;
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
            const { data: existingProfile } = await (supabase
              .from("profiles" as any)
              .select("id")
              .eq("tidal_user_id", tidalUid)
              .maybeSingle() as any);
            if (existingProfile && existingProfile.id !== userId) {
              // This Tidal account already has a PLAI account: send them to sign in to that one
              // (the brand-new empty account is cleaned up automatically)
              const { data: existing } = await supabase
                .from("profiles")
                .select("username")
                .eq("id", existingProfile.id)
                .maybeSingle();
              if (newAccount) await supabase.auth.signOut();
              toast(
                existing?.username
                  ? `you already have a PLAI account, @${existing.username} — sign in with your PIN`
                  : "this Tidal account is already connected to another PLAI account",
                { duration: 8000 },
              );
              navigate("/");
              return;
            } else {
              // Store tidal_user_id for future logins
              await (supabase
                .from("profiles" as any)
                .update({ tidal_user_id: tidalUid })
                .eq("id", userId) as any);
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

        clearConnectionIssue("tidal");

        // New to PLAI: pick a username + PIN (and photo), with the name from Tidal filled in
        const { data: me } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
        if (!me?.username) {
          try {
            sessionStorage.setItem("plai-signup", JSON.stringify({ platform: "tidal", name: result.name || "" }));
          } catch {}
          navigate("/");
          return;
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
