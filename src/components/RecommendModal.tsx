import { useState, useEffect } from "react";
import { X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { followArtistForTrack } from "@/lib/followedArtists";

interface RecommendModalProps {
  trackId: string;
  trackTitle: string;
  onClose: () => void;
}

const RecommendModal = ({ trackId, trackTitle, onClose }: RecommendModalProps) => {
  const { user } = useAuth();
  const [followers, setFollowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id, profiles!follows_follower_id_fkey(id, display_name, username, avatar_url)")
        .eq("following_id", user.id);
      setFollowers(data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSend = async (toUserId: string) => {
    if (!user) return;
    setSending(toUserId);
    const { error } = await supabase.from("recommendations" as any).insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      track_id: trackId,
      message: message || null,
    });
    setSending(null);
    if (error) {
      console.error("Recommend error:", error);
      toast.error("couldn't send — try again");
    } else {
      try {
        await followArtistForTrack(user.id, trackId, "sent_track");
      } catch {}
      toast.success("recommended!");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-card border border-border p-4 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground">recommend "{trackTitle}"</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-3">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 75))}
            placeholder="add a message (optional)"
            className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground"
          />
          <p className={`text-right text-[10px] mt-1 ${message.length >= 70 ? "text-primary" : "text-muted-foreground"}`}>
            {message.length}/75
          </p>
        </div>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : followers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">follow someone first to recommend tracks</p>
        ) : (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground mb-2">
              {followers.length} {followers.length === 1 ? "person" : "people"}
            </p>
            {followers.map((f) => {
              const p = f.profiles;
              if (!p) return null;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary/50 transition-colors"
                >
                  <div
                    className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0"
                    style={{ backgroundColor: "#FF2D78" }}
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
                        {(p.display_name || "U")[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{p.display_name || "User"}</p>
                    <p className="text-xs text-muted-foreground">@{p.username || "user"}</p>
                  </div>
                  <button
                    onClick={() => handleSend(p.id)}
                    disabled={sending === p.id}
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Send className="h-3 w-3" />
                    {sending === p.id ? "..." : "send"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendModal;
