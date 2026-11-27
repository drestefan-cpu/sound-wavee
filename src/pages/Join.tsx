import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PlaiLogo from "@/components/PlaiLogo";
import Starfield from "@/components/Starfield";
import { applyPendingInvite, rememberInvite } from "@/lib/invite";

/** /join/<username>: "@dre.stefan invited you to PLAI" */
const Join = () => {
  const { username = "" } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [inviter, setInviter] = useState<{ username: string; display_name: string | null; avatar_url: string | null } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("username", username.toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.username) {
          setMissing(true);
          return;
        }
        setInviter(data as { username: string; display_name: string | null; avatar_url: string | null });
        rememberInvite(data.username);
      });
  }, [username]);

  // Already have an account: follow them now and go to their profile
  useEffect(() => {
    if (loading || !user || !inviter) return;
    applyPendingInvite().finally(() => navigate(`/profile/${inviter.username}`, { replace: true }));
  }, [loading, user, inviter, navigate]);

  const name = inviter?.display_name || (inviter ? `@${inviter.username}` : "");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <Starfield />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <PlaiLogo className="text-5xl" />
        {missing ? (
          <>
            <p className="text-sm text-muted-foreground">This invite link doesn't work anymore.</p>
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground"
            >
              go to PLAI →
            </button>
          </>
        ) : inviter ? (
          <>
            <div className="h-20 w-20 overflow-hidden rounded-full border border-border bg-card">
              {inviter.avatar_url ? (
                <img src={inviter.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary">
                  {inviter.username[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-medium text-foreground" style={{ textWrap: "balance" } as React.CSSProperties}>
                {name} invited you to PLAI
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Connect your music app and you'll follow each other: see what {name} is listening to, and your taste
                match.
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
              style={{ touchAction: "manipulation" }}
            >
              get started →
            </button>
            <p className="text-[11px] text-muted-foreground/70">works with Spotify, Apple Music, Tidal and YouTube Music</p>
          </>
        ) : (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
      </div>
    </div>
  );
};

export default Join;
