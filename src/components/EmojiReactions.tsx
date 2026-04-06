import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const EMOJIS = ["🔥", "😍", "😭", "😂", "🫀", "✨"];

interface ReactionCount {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface EmojiReactionsProps {
  likeId: string;
  localOnly?: boolean;
  initialReactions?: { emoji: string; count: number }[];
  compact?: boolean;
}

const EmojiReactions = ({ likeId, localOnly = false, initialReactions, compact = false }: EmojiReactionsProps) => {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<ReactionCount[]>(
    EMOJIS.map((e) => {
      const init = initialReactions?.find((r) => r.emoji === e);
      return { emoji: e, count: init?.count || 0, reacted: false };
    })
  );

  const loadReactions = useCallback(async () => {
    if (localOnly) return;
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
  }, [likeId, user, localOnly]);

  useEffect(() => {
    loadReactions();
  }, [loadReactions]);

  const toggleReaction = async (emoji: string) => {
    const current = reactions.find((r) => r.emoji === emoji);
    if (!current) return;

    setReactions((prev) =>
      prev.map((r) =>
        r.emoji === emoji
          ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted }
          : r
      )
    );

    if (localOnly || !user) return;

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

  const pillSize = compact
    ? "px-1.5 py-0.5 text-[10px] gap-0.5"
    : "px-2.5 py-1 text-xs gap-1";

  return (
    <div className="flex flex-wrap gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={(e) => { e.stopPropagation(); toggleReaction(r.emoji); }}
          className={`inline-flex items-center rounded-full transition-all duration-150 ${pillSize} ${
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
