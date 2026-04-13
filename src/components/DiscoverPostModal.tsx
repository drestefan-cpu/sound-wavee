import { X } from "lucide-react";
import type { DiscoverPost } from "@/components/DiscoverPostCard";

interface DiscoverPostModalProps {
  post: DiscoverPost;
  onClose: () => void;
}

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const parseMarkdown = (value: string): Block[] => {
  const lines = value.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push({ type: "list", items: list });
    list = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 1, text: trimmed.slice(2).trim() });
      return;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 2, text: trimmed.slice(3).trim() });
      return;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 3, text: trimmed.slice(4).trim() });
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushParagraph();
      list.push(trimmed.slice(2).trim());
      return;
    }

    flushList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();

  return blocks;
};

const formatPublishedDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const DiscoverPostModal = ({ post, onClose }: DiscoverPostModalProps) => {
  const blocks = parseMarkdown(post.body_markdown || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {post.cover_image_url && (
          <div className="aspect-[16/9] w-full overflow-hidden border-b border-border bg-secondary">
            <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        <div className="overflow-y-auto px-5 pb-6 pt-5">
          <div className="mb-4 space-y-2 pr-8">
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Journal
            </span>
            <h2 className="font-display text-2xl text-foreground">{post.title}</h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{post.author_name || "PLAI"}</span>
              <span>·</span>
              <span>{formatPublishedDate(post.published_at)}</span>
            </div>
            {post.excerpt && <p className="text-sm text-muted-foreground">{post.excerpt}</p>}
          </div>

          <div className="space-y-4">
            {blocks.length > 0 ? (
              blocks.map((block, index) => {
                if (block.type === "heading") {
                  if (block.level === 1) {
                    return (
                      <h3 key={index} className="font-display text-xl text-foreground">
                        {block.text}
                      </h3>
                    );
                  }
                  if (block.level === 2) {
                    return (
                      <h4 key={index} className="font-medium text-base text-foreground">
                        {block.text}
                      </h4>
                    );
                  }
                  return (
                    <h5 key={index} className="text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {block.text}
                    </h5>
                  );
                }

                if (block.type === "list") {
                  return (
                    <ul key={index} className="space-y-2 pl-4 text-sm text-foreground">
                      {block.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="list-disc">
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                }

                return (
                  <p key={index} className="text-sm leading-6 text-foreground/90">
                    {block.text}
                  </p>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No article body has been published yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscoverPostModal;
