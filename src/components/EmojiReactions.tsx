import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const EMOJIS = ["🔥", "😍", "😭", "💀", "✨", "🎵"];

interface ReactionCount {
  emoji: string;
  count: number;
  reacted: boolean;
}

const EmojiReactions = ({ likeId }: { likeId: string }) => {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<ReactionCount[]>(
    EMOJIS.map((e) => ({ emoji: e, count: 0, reacted: false }))
  );

  const loadReactions = useCallback(async () => {
    const { data } = await supabase
      .from("reactions")
      .select("emoji, user_id")
      .eq("like_id", likeId);

    if (data) {
      setReactions(
        EMOJIS.map((emoji) => {
          const matching = data.filter((r) => r.emoji === emoji);
          return {
            emoji,
            count: matching.length,
            reacted: matching.some((r) => r.user_id === user?.id),
          };
        })
      );
    }
  }, [likeId, user]);

  useEffect(() => {
    loadReactions();
  }, [loadReactions]);

  const toggleReaction = async (emoji: string) => {
    if (!user) return;
    const current = reactions.find((r) => r.emoji === emoji);
    if (!current) return;

    setReactions((prev) =>
      prev.map((r) =>
        r.emoji === emoji
          ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted }
          : r
      )
    );

    if (current.reacted) {
      await supabase
        .from("reactions")
        .delete()
        .eq("like_id", likeId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
    } else {
      await supabase
        .from("reactions")
        .insert({ like_id: likeId, user_id: user.id, emoji });
    }
  };

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggleReaction(r.emoji)}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all duration-150 ${
            r.reacted
              ? "bg-primary/20 text-primary"
              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
          } ${r.count === 0 && !r.reacted ? "opacity-50" : ""}`}
        >
          <span>{r.emoji}</span>
          {r.count > 0 && <span>{r.count}</span>}
        </button>
      ))}
    </div>
  );
};

export default EmojiReactions;
