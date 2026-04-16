import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FollowButton from "@/components/FollowButton";

interface FollowersModalProps {
  profileId: string;
  mode: "followers" | "following";
  onClose: () => void;
}

const FollowersModal = ({ profileId, mode, onClose }: FollowersModalProps) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const load = async () => {
      if (mode === "followers") {
        const { data } = await supabase
          .from("follows")
          .select("follower_id, profiles!follows_follower_id_fkey(id, display_name, username, avatar_url)")
          .eq("following_id", profileId);
        setUsers((data || []).map((d: any) => d.profiles).filter(Boolean));
      } else {
        const { data } = await supabase
          .from("follows")
          .select("following_id, profiles!follows_following_id_fkey(id, display_name, username, avatar_url)")
          .eq("follower_id", profileId);
        setUsers((data || []).map((d: any) => d.profiles).filter(Boolean));
      }
      setLoading(false);
    };
    load();
  }, [profileId, mode]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-4 pb-8 max-h-[70vh] overflow-y-auto animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">{mode}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {mode === "followers" ? "no followers yet" : "not following anyone yet"}
          </p>
        ) : (
          <div className="space-y-2">
            {users.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl p-2">
                <Link
                  to={`/profile/${u.username || u.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-primary/20 flex-shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                        {(u.display_name || "U")[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate">
                      {u.display_name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground">@{u.username || "user"}</p>
                  </div>
                </Link>
                <FollowButton targetUserId={u.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowersModal;
