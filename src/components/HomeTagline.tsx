import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { getRandomHomeTagline, loadTaglinesFromDb } from "@/lib/taglines";

export interface HomeTaglineRef {
  cycle: () => void;
}

const HomeTagline = forwardRef<HomeTaglineRef>((_, ref) => {
  const [tagline, setTagline] = useState(() => getRandomHomeTagline());
  const [fading, setFading] = useState(false);
  const [glowing, setGlowing] = useState(false);

  useEffect(() => { loadTaglinesFromDb(); }, []);

  const cycle = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setTagline((prev) => getRandomHomeTagline(prev));
      setFading(false);
      setGlowing(true);
      setTimeout(() => setGlowing(false), 1200);
    }, 200);
  }, []);

  useImperativeHandle(ref, () => ({ cycle }), [cycle]);

  useEffect(() => {
    const timer = setInterval(cycle, 6000);
    return () => clearInterval(timer);
  }, [cycle]);

  return (
    <p
      className="text-xs italic text-center transition-all duration-500 ease-in-out"
      style={{
        opacity: fading ? 0 : 1,
        color: glowing ? "hsl(340 100% 59%)" : "hsl(210 30% 40%)",
        textShadow: glowing ? "0 0 12px hsl(340 100% 59% / 0.4)" : "none",
        transition: "opacity 0.2s ease, color 1.2s ease, text-shadow 1.2s ease",
      }}
    >
      {tagline}
    </p>
  );
});

HomeTagline.displayName = "HomeTagline";
export default HomeTagline;
