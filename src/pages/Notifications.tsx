import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import BottomNav from "@/components/BottomNav";
import { Bell, UserPlus, Heart, Disc, Send } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  actor_id: string | null;
  track_id: string | null;
  read: boolean;
  data: any;
  created_at: string;
}

const ICONS: Record<string, any> = {
  follow: UserPlus,
  reaction: Heart,
  save: Disc,
  recommendation: Send,
};

const typeLabel = (type: string, data: any) => {
  switch (type) {
    case "follow":
      return "followed you";
    case "reaction":
      return `reacted ${data?.emoji || ""} to your song`;
    case "save":
      return "saved your song";
    case "recommendation":
      return "recommended you a song";
    default:
      return "did something";
  }
};

const timeAgo = (ts: string) => {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
};

const Notifications = () => {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await (supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50) as any);
      setNotifications(data || []);
      setLoaded(true);

      // Mark unread as read
      const unreadIds = (data || []).filter((n: any) => !n.read).map((n: any) => n.id);
      if (unreadIds.length > 0) {
        await (supabase
          .from("notifications" as any)
          .update({ read: true } as any)
          .in("id", unreadIds) as any);
      }
    };
    load();
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Notifications" />
      <main className="mx-auto max-w-feed px-4 py-4">
        {!loaded ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card border border-border mb-4">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">no notifications yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              when someone follows, reacts, saves, or recommends — it'll show up here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => {
              const Icon = ICONS[n.type] || Bell;
              const actorName = n.data?.actor_username ? `@${n.data.actor_username}` : "someone";
              const trackInfo = n.data?.track_title ? ` · ${n.data.track_title}` : "";
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors duration-150 ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {n.data?.actor_avatar ? (
                      <img
                        src={n.data.actor_avatar}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">
                      <span className="font-medium">{actorName}</span>{" "}
                      <span className="text-muted-foreground">{typeLabel(n.type, n.data)}</span>
                    </p>
                    {trackInfo && (
                      <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                        {n.data.track_title} — {n.data.track_artist}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 flex-shrink-0 mt-1">
                    {timeAgo(n.created_at)}
                  </span>
                  {!n.read && (
                    <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Notifications;
