import { useState, useEffect, useCallback, useRef } from "react";
import { getRandomHomeTagline, loadTaglinesFromDb } from "@/lib/taglines";

const HomeTagline = () => {
  const [tagline, setTagline] = useState(() => getRandomHomeTagline());
  const [fading, setFading] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const [logoFlash, setLogoFlash] = useState(false);
  const cycleRef = useRef<() => void>();

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

  cycleRef.current = cycle;

  useEffect(() => {
    const timer = setInterval(cycle, 6000);
    return () => clearInterval(timer);
  }, [cycle]);

  const handleLogoTap = () => {
    cycleRef.current?.();
    setLogoFlash(true);
    setTimeout(() => setLogoFlash(false), 150);
  };

  return (
    <div>
      <div
        onClick={handleLogoTap}
        style={{
          cursor: "pointer",
          userSelect: "none",
          display: "inline-block",
          borderRadius: 6,
          background: logoFlash ? "rgba(255,45,120,0.15)" : "transparent",
          transition: "background 0.15s ease",
        }}
      />
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
    </div>
  );
};

export default HomeTagline;
