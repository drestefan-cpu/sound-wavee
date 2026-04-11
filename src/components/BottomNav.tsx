import { useLocation, useNavigate } from "react-router-dom";
import { Home, Disc, Settings, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRef } from "react";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const lastTapRef = useRef<number>(0);
  const unread = useUnreadNotifications();

  const links = [
    { to: "/feed", icon: Home, label: "Feed" },
    { to: `/profile/${user?.id || ""}`, icon: Disc, label: "Library" },
    { to: "/notifications", icon: Bell, label: "Alerts", badge: unread > 0 },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  const handleFeedTap = () => {
    const now = Date.now();
    if (location.pathname === "/feed" && now - lastTapRef.current < 400) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    lastTapRef.current = now;
    navigate("/feed");
  };

  const handleNavTap = (to: string) => {
    if (location.pathname === to) return;
    navigate(to);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-feed items-center justify-around py-2">
        {links.map(({ to, icon: Icon, label, badge }) => {
          const active = location.pathname === to || (to !== "/settings" && to !== "/notifications" && location.pathname.startsWith(to + "/"));
          return (
            <button
              key={to}
              type="button"
              onClick={to === "/feed" ? handleFeedTap : () => handleNavTap(to)}
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-all duration-150 ${
                active ? "text-primary" : "text-muted-dim hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
              {badge && (
                <span className="absolute top-0 right-1.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
