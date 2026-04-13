import { useEffect, useMemo } from "react";
import { ExternalLink, X } from "lucide-react";
import type { DiscoverPost } from "@/components/DiscoverPostCard";

interface DiscoverPostModalProps {
  post: DiscoverPost;
  onClose: () => void;
}

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const MiniStarfield = () => {
  const stars = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        opacity: 0.05 + Math.random() * 0.15,
        size: 0.6 + Math.random() * 1,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            backgroundColor: "#F0EBE3",
          }}
        />
      ))}
    </div>
  );
};

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

const renderInlineMarkdown = (text: string) => {
  const segments: Array<{ type: "text" | "strong" | "em" | "link"; value: string; href?: string }> = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      segments.push({ type: "strong", value: match[2] });
    } else if (match[3]) {
      segments.push({ type: "em", value: match[3] });
    } else if (match[4] && match[5]) {
      segments.push({ type: "link", value: match[4], href: match[5] });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    return text;
  }

  return segments.map((segment, index) => {
    if (segment.type === "strong") {
      return (
        <strong key={index} className="font-medium text-foreground">
          {segment.value}
        </strong>
      );
    }

    if (segment.type === "em") {
      return (
        <em key={index} className="italic text-foreground">
          {segment.value}
        </em>
      );
    }

    if (segment.type === "link" && segment.href) {
      return (
        <a
          key={index}
          href={segment.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
        >
          {segment.value}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    }

    return <span key={index}>{segment.value}</span>;
  });
};

const DiscoverPostModal = ({ post, onClose }: DiscoverPostModalProps) => {
  const blocks = parseMarkdown(post.body_markdown || "");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{
        backgroundColor: "#080B12",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <MiniStarfield />

      <div
        className="fixed z-50 text-muted-foreground transition-colors hover:text-foreground"
        style={{
          top: "max(env(safe-area-inset-top, 16px), 16px)",
          left: 16,
        }}
      >
        <button
          onClick={onClose}
          style={{
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            padding: 8,
          }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative z-10 mx-auto w-full max-w-feed px-3 sm:px-4"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 300,
          lineHeight: 1.8,
          color: "#F0EBE3",
          paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 64px), 80px)",
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 112px), 112px)",
        }}
      >
        <div className="rounded-[28px] border border-border bg-card/40 p-3 backdrop-blur-sm">
          {post.cover_image_url && (
            <div className="mb-4 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border bg-secondary">
              <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          <div className="mb-5 space-y-2 px-2">
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Journal
            </span>
            <h2 className="font-display text-[28px] leading-tight text-foreground">{post.title}</h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{post.author_name || "PLAI"}</span>
              <span>·</span>
              <span>{formatPublishedDate(post.published_at)}</span>
            </div>
            {post.excerpt && <p className="text-sm text-muted-foreground">{post.excerpt}</p>}
          </div>

          <div className="space-y-5 px-2">
            {blocks.length > 0 ? (
              blocks.map((block, index) => {
                if (block.type === "heading") {
                  if (block.level === 1) {
                    return (
                      <h3 key={index} className="font-display text-2xl text-foreground">
                        {renderInlineMarkdown(block.text)}
                      </h3>
                    );
                  }
                  if (block.level === 2) {
                    return (
                      <h4 key={index} className="font-medium text-lg text-foreground">
                        {renderInlineMarkdown(block.text)}
                      </h4>
                    );
                  }
                  return (
                    <h5 key={index} className="text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {renderInlineMarkdown(block.text)}
                    </h5>
                  );
                }

                if (block.type === "list") {
                  return (
                    <ul key={index} className="space-y-2 pl-5 text-sm leading-7 text-foreground/90">
                      {block.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="list-disc">
                          {renderInlineMarkdown(item)}
                        </li>
                      ))}
                    </ul>
                  );
                }

                return (
                  <p key={index} className="text-[15px] leading-7 text-foreground/90">
                    {renderInlineMarkdown(block.text)}
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
