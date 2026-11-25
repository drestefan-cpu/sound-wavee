import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DiscoverPost } from "@/components/DiscoverPostCard";

/**
 * Admin → Journal: write, edit, publish and unpublish the posts in Discover → journal.
 * Drafts are only visible to admins (database policy); published posts are public.
 */

type Draft = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  post_type: "internal" | "external";
  external_url: string;
  body_markdown: string;
  author_name: string;
  status: "draft" | "published";
};

const EMPTY: Draft = {
  title: "",
  slug: "",
  excerpt: "",
  cover_image_url: "",
  post_type: "internal",
  external_url: "",
  body_markdown: "",
  author_name: "PLAI",
  status: "draft",
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const isHttpsUrl = (s: string) => {
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
};

const fromPost = (p: DiscoverPost): Draft => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  excerpt: p.excerpt || "",
  cover_image_url: p.cover_image_url || "",
  post_type: p.post_type,
  external_url: p.external_url || "",
  body_markdown: p.body_markdown || "",
  author_name: p.author_name || "",
  status: p.status,
});

const JournalAdmin = () => {
  const [posts, setPosts] = useState<DiscoverPost[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await (supabase
      .from("discover_posts" as any)
      .select("*")
      .order("published_at", { ascending: false }) as any);
    setPosts((data || []) as DiscoverPost[]);
  };

  useEffect(() => {
    load();
  }, []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setEditing((d) => {
      if (!d) return d;
      const next = { ...d, [key]: value };
      if (key === "title" && !slugTouched && !d.id) next.slug = slugify(String(value));
      return next;
    });

  const save = async (status: Draft["status"]) => {
    if (!editing) return;
    const d = { ...editing, status };
    if (!d.title.trim()) return toast.error("add a title");
    if (!slugify(d.slug)) return toast.error("add a slug (the post's web address)");
    if (d.post_type === "external" && !isHttpsUrl(d.external_url)) return toast.error("external posts need a link starting with https://");
    if (d.post_type === "internal" && !d.body_markdown.trim()) return toast.error("write the post body");
    if (d.cover_image_url && !isHttpsUrl(d.cover_image_url)) return toast.error("the cover image link must start with https://");

    const wasPublished = posts.find((p) => p.id === d.id)?.status === "published";
    const row: Record<string, unknown> = {
      title: d.title.trim(),
      slug: slugify(d.slug),
      excerpt: d.excerpt.trim() || null,
      cover_image_url: d.cover_image_url.trim() || null,
      post_type: d.post_type,
      external_url: d.post_type === "external" ? d.external_url.trim() : null,
      body_markdown: d.post_type === "internal" ? d.body_markdown : null,
      author_name: d.author_name.trim() || null,
      status,
      updated_at: new Date().toISOString(),
    };
    // The publish date is the moment it first goes live
    if (status === "published" && !wasPublished) row.published_at = new Date().toISOString();

    setSaving(true);
    const { error } = d.id
      ? await (supabase.from("discover_posts" as any).update(row as any).eq("id", d.id) as any)
      : await (supabase.from("discover_posts" as any).insert(row as any) as any);
    setSaving(false);

    if (error) {
      toast.error(error.code === "23505" ? "another post already uses that slug" : `couldn't save: ${error.message}`);
      return;
    }
    toast.success(status === "published" ? "published" : "saved as draft");
    setEditing(null);
    load();
  };

  const setStatus = async (post: DiscoverPost, status: Draft["status"]) => {
    const row: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "published") row.published_at = new Date().toISOString();
    const { error } = await (supabase.from("discover_posts" as any).update(row as any).eq("id", post.id) as any);
    if (error) return toast.error(`couldn't update: ${error.message}`);
    toast.success(status === "published" ? "published" : "moved to drafts");
    load();
  };

  const remove = async (post: DiscoverPost) => {
    if (!window.confirm(`Delete "${post.title}"? This can't be undone.`)) return;
    const { error } = await (supabase.from("discover_posts" as any).delete().eq("id", post.id) as any);
    if (error) return toast.error(`couldn't delete: ${error.message}`);
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
  };

  if (editing) {
    const field = "bg-background border-border";
    return (
      <div className="space-y-3 rounded-xl border border-primary/30 bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{editing.id ? "Edit post" : "New post"}</p>
          <button onClick={() => setEditing(null)} className="text-xs text-muted-foreground hover:text-foreground">
            cancel
          </button>
        </div>

        <div className="flex gap-2">
          {(["internal", "external"] as const).map((t) => (
            <button
              key={t}
              onClick={() => set("post_type", t)}
              className={`rounded-full px-3 py-1 text-xs ${editing.post_type === t ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
            >
              {t === "internal" ? "story (written here)" : "link (to another site)"}
            </button>
          ))}
        </div>

        <Input id="journal-title" value={editing.title} onChange={(e) => set("title", e.target.value)} placeholder="title" className={field} />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">slug</span>
          <Input
            id="journal-slug"
            value={editing.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value);
            }}
            placeholder="short-name-for-the-address"
            className={field}
          />
        </div>
        <Input id="journal-excerpt" value={editing.excerpt} onChange={(e) => set("excerpt", e.target.value)} placeholder="one-line summary shown on the card" className={field} />
        <Input id="journal-cover" value={editing.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} placeholder="cover image link (https://…), optional" className={field} />
        <Input id="journal-author" value={editing.author_name} onChange={(e) => set("author_name", e.target.value)} placeholder="author" className={field} />

        {editing.post_type === "external" ? (
          <Input id="journal-url" value={editing.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://… (where the card opens)" className={field} />
        ) : (
          <div className="space-y-1">
            <Textarea
              id="journal-body"
              value={editing.body_markdown}
              onChange={(e) => set("body_markdown", e.target.value)}
              placeholder={"Write the story.\n\n## A heading\nA paragraph.\n\n- a list item"}
              className={`${field} min-h-[220px] font-mono text-xs`}
            />
            <p className="text-[10px] text-muted-foreground">
              Start a line with # or ## for a heading and - for a list item. Leave a blank line between paragraphs.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            disabled={saving}
            onClick={() => save("published")}
            className="rounded-full bg-primary px-4 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
          >
            {editing.status === "published" ? "save changes" : "publish"}
          </button>
          <button
            disabled={saving}
            onClick={() => save("draft")}
            className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground disabled:opacity-50"
          >
            {editing.status === "published" ? "unpublish (save as draft)" : "save draft"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {posts.filter((p) => p.status === "published").length} published · {posts.filter((p) => p.status === "draft").length} drafts
        </p>
        <button
          onClick={() => {
            setSlugTouched(false);
            setEditing({ ...EMPTY });
          }}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
        >
          <Plus className="h-3 w-3" /> new post
        </button>
      </div>

      {posts.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          {p.cover_image_url ? (
            <img src={p.cover_image_url} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded border border-border text-xs text-muted-foreground">¶</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {p.post_type === "external" ? "link" : "story"} · {new Date(p.published_at).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => setStatus(p, p.status === "published" ? "draft" : "published")}
            className={`rounded-full px-2 py-0.5 text-[10px] ${p.status === "published" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}
            title={p.status === "published" ? "tap to unpublish" : "tap to publish"}
          >
            {p.status === "published" ? "live" : "draft"}
          </button>
          <button
            onClick={() => {
              setSlugTouched(true);
              setEditing(fromPost(p));
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => remove(p)} className="text-muted-foreground hover:text-destructive" aria-label="delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {posts.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No posts yet.</p>}
    </div>
  );
};

export default JournalAdmin;
