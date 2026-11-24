import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

/** Bell icon linking to /notifications, with an unread count badge. */
const NotificationBell = () => {
  const unread = useUnreadNotifications();
  const label = unread > 9 ? "9+" : String(unread);

  return (
    <Link
      to="/notifications"
      aria-label={unread > 0 ? `${unread} unread notifications` : "notifications"}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {label}
        </span>
      )}
    </Link>
  );
};

export default NotificationBell;
