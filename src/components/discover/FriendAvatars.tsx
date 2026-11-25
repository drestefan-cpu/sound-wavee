import { supabase } from "@/integrations/supabase/client";

/** Friends (people you follow) who liked a song, shown as small overlapping avatars. */

export interface FriendLike {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

const FriendAvatars = ({ friends, verb = "liked by" }: { friends?: FriendLike[]; verb?: string }) => {
  if (!friends || friends.length === 0) return null;
  const visible = friends.slice(0, 3);
  const overflow = friends.length - visible.length;
  const lead = visible[0];
  return (
    <div className="flex items-center gap-2 pt-1">
      <div className="flex items-center">
        {visible.map((friend, index) => (
          <div
            key={friend.id}
            className="-ml-1 first:ml-0 h-5 w-5 overflow-hidden rounded-full border border-background bg-primary/20"
            style={{ zIndex: visible.length - index }}
          >
            {friend.avatarUrl ? (
              <img src={friend.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[9px] font-bold text-primary">
                {friend.displayName[0]?.toUpperCase() || friend.username[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div className="-ml-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-background bg-card px-1 text-[9px] font-medium text-muted-foreground">
            +{overflow}
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {verb} @{lead.username}
        {friends.length > 1 ? ` +${friends.length - 1}` : ""}
      </p>
    </div>
  );
};

/** Which of the given songs the people you follow have liked → track id → friends. */
export async function loadFriendLikes(trackIds: string[], followingIds: string[]): Promise<Map<string, FriendLike[]>> {
  const map = new Map<string, FriendLike[]>();
  if (trackIds.length === 0 || followingIds.length === 0) return map;
  const { data } = await (supabase
    .from("likes")
    .select("track_id, user_id, profiles!likes_user_id_fkey(id, username, display_name, avatar_url)")
    .in("user_id", followingIds)
    .in("track_id", trackIds) as any);
  for (const row of (data || []) as any[]) {
    const p = row.profiles;
    if (!row.track_id || !p?.id) continue;
    const list = map.get(row.track_id) || [];
    if (!list.some((f) => f.id === p.id)) {
      list.push({
        id: p.id,
        username: p.username || "user",
        displayName: p.display_name || p.username || "User",
        avatarUrl: p.avatar_url || null,
      });
    }
    map.set(row.track_id, list);
  }
  return map;
}

export default FriendAvatars;
