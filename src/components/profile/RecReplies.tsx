import { useState } from "react";
import { MessageCircle, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * A short conversation under a song someone sent: only the sender and receiver see it,
 * and the other person gets a notification for each reply.
 */

export interface Reply {
  id: string;
  recommendation_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

interface Props {
  recId: string;
  myId: string;
  otherName: string;
  replies: Reply[];
  onAdd: (r: Reply) => void;
}

const MAX = 280;

const RecReplies = ({ recId, myId, otherName, replies, onAdd }: Props) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { data, error } = await supabase
      .from("recommendation_replies" as any)
      .insert({ recommendation_id: recId, user_id: myId, body } as any)
      .select("id, recommendation_id, user_id, body, created_at")
      .single();
    setSending(false);
    if (error) {
      toast.error(error.code === "P0001" ? error.message : "couldn't send — try again");
      return;
    }
    onAdd(data as unknown as Reply);
    setText("");
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
        >
          <MessageCircle className="h-3 w-3" />
          {replies.length > 0 ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : "reply"}
        </button>
      ) : (
        <div className="mt-1 space-y-1.5">
          {replies.map((r) => {
            const mine = r.user_id === myId;
            return (
              <div key={r.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-xs leading-snug ${
                    mine ? "bg-primary/15 text-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  {r.body}
                </p>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5">
            <input
              id={`reply-${recId}`}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={`reply to ${otherName}…`}
              autoFocus
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              aria-label="send reply"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecReplies;
