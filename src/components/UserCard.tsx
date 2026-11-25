import { Link } from "react-router-dom";
import FollowButton from "@/components/FollowButton";

interface UserCardProps {
  profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  showFollow?: boolean;
  /** Optional line under the username, e.g. "12 songs in common" */
  reason?: string | null;
}

const UserCard = ({ profile, showFollow, reason }: UserCardProps) => {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all duration-150">
      <Link to={`/profile/${profile.username || profile.id}`}>
        <div className="h-10 w-10 overflow-hidden rounded-full bg-primary/20">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
              {(profile.display_name || "U")[0].toUpperCase()}
            </div>
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={`/profile/${profile.username || profile.id}`}
          className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-150"
        >
          {profile.display_name || "User"}
        </Link>
        <p className="text-xs text-muted-foreground truncate">
          @{profile.username || "user"}
          {reason ? <span className="text-primary"> · {reason}</span> : null}
        </p>
      </div>
      {showFollow && <FollowButton targetUserId={profile.id} />}
    </div>
  );
};

export default UserCard;
