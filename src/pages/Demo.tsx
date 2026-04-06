import { useState } from "react";
import { Link } from "react-router-dom";
import PlaiLogo from "@/components/PlaiLogo";
import DemoCard from "@/components/DemoCard";
import TrendingCard from "@/components/TrendingCard";
import { demoFeedItems, demoUsers } from "@/lib/demoData";
import { trendingTracks } from "@/lib/trending";

const Demo = () => {
  const [tab, setTab] = useState<"following" | "trending">("following");
  const [followedIds, setFollowedIds] = useState<string[]>([]);

  const toggleFollow = (id: string) => {
    setFollowedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Top banner */}
      <div className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="mx-auto flex max-w-feed items-center justify-between px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            you're previewing PLAI — connect Spotify to see your friends' real likes
          </p>
          <Link
            to="/"
            className="flex-shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80"
          >
            get started →
          </Link>
        </div>
      </div>

      <header className="sticky top-[45px] z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-feed items-center justify-between px-4 py-3">
          <PlaiLogo className="text-xl" />
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-live" />
            Live
          </span>
        </div>
      </header>

      {/* Tabs */}
      <div className="mx-auto max-w-feed px-4 pt-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("following")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 ${
              tab === "following"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            following
          </button>
          <button
            onClick={() => setTab("trending")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 ${
              tab === "trending"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            trending
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-feed px-4 py-4">
        {tab === "following" ? (
          <div className="space-y-3">
            {demoFeedItems.map((item) => (
              <DemoCard key={item.id} item={item} />
            ))}

            <div className="mt-8">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                discover people
              </h3>
              <div className="space-y-2">
                {demoUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 relative">
                    <span className="absolute top-2 right-2 rounded-full bg-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-primary">
                      example
                    </span>
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-primary/20">
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                        {u.display_name[0].toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{u.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{u.username} · {u.genre} · {u.follower_count} followers</p>
                    </div>
                    <button
                      onClick={() => toggleFollow(u.id)}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 ${
                        followedIds.includes(u.id)
                          ? "border border-primary text-primary"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {followedIds.includes(u.id) ? "Following" : "Follow"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-2">trending this week</p>
            {trendingTracks.map((track) => (
              <TrendingCard key={track.position} track={track} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Demo;
