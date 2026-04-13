import { ExternalLink } from "lucide-react";

export interface DiscoverPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  body_markdown: string | null;
  post_type: "internal" | "external";
  external_url: string | null;
  author_name: string | null;
  published_at: string;
  status: "draft" | "published";
}

interface DiscoverPostCardProps {
  post: DiscoverPost;
  onOpen: (post: DiscoverPost) => void;
}

const formatPublishedDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const DiscoverPostCard = ({ post, onOpen }: DiscoverPostCardProps) => {
  const destinationLabel = post.post_type === "external" ? "external" : "journal";

  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      className="w-full rounded-xl border border-border bg-card p-3 text-left transition-all duration-150 hover:border-primary/30"
    >
      <div className="flex gap-3 items-start">
        <div
          className="flex-shrink-0 overflow-hidden rounded-lg border border-border bg-card"
          style={{ width: 72, height: 72 }}
        >
          {post.cover_image_url ? (
            <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center">
              <span className="font-display text-base text-foreground/80">PLAI</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {destinationLabel}
            </span>
            <span className="text-[10px] text-muted-foreground">{formatPublishedDate(post.published_at)}</span>
          </div>
          <p className="line-clamp-2 text-sm font-medium text-foreground">{post.title}</p>
          {post.excerpt && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{post.excerpt}</p>}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="truncate text-[11px]" style={{ color: "#2a3a4a" }}>
              {post.author_name || "PLAI"}
            </span>
            {post.post_type === "external" ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                open link
                <ExternalLink className="h-3 w-3" />
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">read in app</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

export default DiscoverPostCard;
