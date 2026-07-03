import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const URL_REGEX = /(https?:\/\/[^\s]+)/;

function extractUrl(title: string, text: string, url: string): string | null {
  if (url) return url;
  const fromText = text.match(URL_REGEX)?.[1];
  if (fromText) return fromText;
  const fromTitle = title.match(URL_REGEX)?.[1];
  if (fromTitle) return fromTitle;
  return null;
}

const ShareTarget = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const title = searchParams.get("title") ?? "";
    const text = searchParams.get("text") ?? "";
    const url = searchParams.get("url") ?? "";

    const found = extractUrl(title, text, url);

    if (!found) {
      toast("couldn't read that link");
      navigate("/feed", { replace: true });
      return;
    }

    navigate(`/radar/new?url=${encodeURIComponent(found)}`, { replace: true });
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080B12]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="mt-4 text-sm text-muted-foreground">opening PLAI...</p>
    </div>
  );
};

export default ShareTarget;
