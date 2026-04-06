import { Link, useLocation } from "react-router-dom";
import { Home, Compass, Disc, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  const links = [
    { to: "/feed", icon: Home, label: "Feed" },
    { to: "/discover", icon: Compass, label: "Discover" },
    { to: `/profile/${user?.id || ""}`, icon: Disc, label: "Library" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background">
      <div className="mx-auto flex max-w-feed items-center justify-around py-2">
        {links.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to || (to !== "/settings" && location.pathname.startsWith(to + "/"));
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-all duration-150 ${
                active ? "text-primary" : "text-muted-dim hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
