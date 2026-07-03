import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import RadarDashboard from "@/components/radar/RadarDashboard";

const Radar = () => {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await (supabase
        .from("radar_access" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle() as any);
      setHasAccess(!!data);
      setChecking(false);
    };
    check();
  }, [user]);

  const handleSubmit = async () => {
    if (!user || !code.trim()) return;
    setSubmitting(true);
    setError("");

    const { data: invite } = await (supabase
      .from("radar_invites" as any)
      .select("id, used")
      .eq("code", code.trim().toLowerCase())
      .maybeSingle() as any);

    if (!invite || invite.used) {
      setError("invalid or already used code");
      setSubmitting(false);
      return;
    }

    const { error: accessErr } = await (supabase
      .from("radar_access" as any)
      .insert({ user_id: user.id, invite_id: invite.id } as any) as any);

    if (accessErr) {
      setError("something went wrong — try again");
      setSubmitting(false);
      return;
    }

    await (supabase
      .from("radar_invites" as any)
      .update({ used: true, used_by: user.id } as any)
      .eq("id", invite.id) as any);

    toast("access granted");
    setHasAccess(true);
    setSubmitting(false);
  };

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  if (hasAccess) return <RadarDashboard />;

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4"
    >
      <div className="bg-card border border-border rounded-2xl p-8 max-w-xs w-full text-center">
        <h1 className="font-display text-2xl font-black text-foreground mb-2 tracking-tight">
          <span className="text-foreground">PL</span>
          <span className="text-primary">A</span>
          <span className="text-foreground">I </span>
          <span className="text-foreground">Radar</span>
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          invite only — enter your code to get access
        </p>
        <Input
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="invite code"
          className="bg-background border-border text-center tracking-widest mb-3 lowercase"
          autoCapitalize="none"
          autoCorrect="off"
        />
        {error && (
          <p className="text-xs text-destructive mb-3">{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting || !code.trim()}
          className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
        >
          {submitting ? "checking…" : "submit"}
        </button>
      </div>
    </div>
  );
};

export default Radar;
