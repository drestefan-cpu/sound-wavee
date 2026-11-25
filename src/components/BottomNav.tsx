import { useLocation, useNavigate } from "react-router-dom";
import { Home, Compass, Disc, Settings } from "lucide-react";

const LINKS = [
  { to: "/feed", icon: Home, label: "Friends" },
  { to: "/discover", icon: Compass, label: "Discover" },
  { to: "/profile", icon: Disc, label: "Library" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

const isActive = (pathname: string, to: string) =>
  pathname === to || (to === "/profile" && pathname.startsWith("/profile/"));

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleTap = (to: string) => {
    // Tapping the tab you're on scrolls back to the top
    if (isActive(location.pathname, to)) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigate(to);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", minHeight: "3.5rem" }}
    >
      <div className="mx-auto flex max-w-feed items-center justify-around py-1.5">
        {LINKS.map(({ to, icon: Icon, label }) => {
          const active = isActive(location.pathname, to);
          return (
            <button
              key={to}
              type="button"
              onClick={() => handleTap(to)}
              aria-current={active ? "page" : undefined}
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              // No hover colour on touch screens (it "sticks" after a tap on iPhone); instant press feedback instead
              className={`relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] transition-[color,transform] duration-100 active:scale-90 ${
                active ? "text-primary" : "text-muted-dim [@media(hover:hover)]:hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
