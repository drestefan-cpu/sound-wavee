import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PlaiLogo from "@/components/PlaiLogo";

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  rightContent?: React.ReactNode;
}

const PageHeader = ({ title, showBack = true, rightContent }: PageHeaderProps) => {
  const navigate = useNavigate();
  return (
    <header
      className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto flex max-w-feed items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/feed", { replace: true })}
              className="text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="text-sm font-medium text-foreground">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {rightContent}
          <Link to="/feed">
            <PlaiLogo className="text-base" />
          </Link>
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
