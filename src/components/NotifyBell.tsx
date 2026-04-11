import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NotifyBellProps {
  targetUserId: string;
  targetUsername?: string;
}

const NotifyBell = ({ targetUserId, targetUsername }: NotifyBellProps) => {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await (supabase.from("user_notify_follows" as any)
        .select("id")
        .eq("follower_id", user.id)
        .eq("target_user_id", targetUserId)
        .maybeSingle() as any);
      setEnabled(!!data);
      setLoading(false);
    };
    check();
  }, [user, targetUserId]);

  const toggle = async () => {
    if (!user) return;
    const next = !enabled;
    setEnabled(next);

    if (next) {
      await (supabase.from("user_notify_follows" as any).insert({
        follower_id: user.id,
        target_user_id: targetUserId,
      }) as any);
      toast(`Notifying you when @${targetUsername || "user"} adds music`, { duration: 2300 });
    } else {
      await (supabase.from("user_notify_follows" as any)
        .delete()
        .eq("follower_id", user.id)
        .eq("target_user_id", targetUserId) as any);
      toast(`Stopped notifications for @${targetUsername || "user"}`, { duration: 2300 });
    }
  };

  if (loading || !user || user.id === targetUserId) return null;

  return (
    <button
      onClick={toggle}
      className={`flex h-9 w-9 items-center justify-center rounded-md border transition-all duration-150 ${
        enabled
          ? "border-input bg-background text-foreground shadow-sm"
          : "border-border bg-background/40 text-muted-foreground hover:text-foreground hover:border-input"
      }`}
      style={{ touchAction: "manipulation" }}
      aria-label={enabled ? "Disable notifications" : "Enable notifications"}
    >
      {enabled ? (
        <Bell className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
    </button>
  );
};

export default NotifyBell;
