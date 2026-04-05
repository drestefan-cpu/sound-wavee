import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const FollowButton = ({ targetUserId }: { targetUserId: string }) => {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();
      setFollowing(!!data);
      setLoading(false);
    };
    check();
  }, [user, targetUserId]);

  const toggle = async () => {
    if (!user) return;
    setFollowing((prev) => !prev);

    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);
    } else {
      await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: targetUserId });
    }
  };

  if (loading || !user || user.id === targetUserId) return null;

  return (
    <Button
      variant={following ? "outline" : "default"}
      size="sm"
      onClick={toggle}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
};

export default FollowButton;
