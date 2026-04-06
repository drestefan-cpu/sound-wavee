import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import PlaiLogo from "./PlaiLogo";
import { getRandomTagline } from "@/lib/taglines";

const MiniStarfield = () => {
  const stars = useMemo(
    () =>
      Array.from({ length: 35 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        opacity: 0.08 + Math.random() * 0.18,
        size: 0.8 + Math.random() * 1.2,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-foreground"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
          }}
        />
      ))}
    </div>
  );
};

const TaglineSpace = () => {
  const [tagline, setTagline] = useState(() => getRandomTagline());
  const [fading, setFading] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const [tapped, setTapped] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const cycle = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setTagline((prev) => getRandomTagline(prev));
      setFading(false);
      setGlowing(true);
      setTimeout(() => setGlowing(false), 1200);
    }, 400);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(cycle, 5500);
    return () => clearInterval(timerRef.current);
  }, [cycle]);

  const handleTap = () => {
    if (tapped) return;
    setTapped(true);
    clearInterval(timerRef.current);
    cycle();
    timerRef.current = setInterval(cycle, 5500);
  };

  return (
    <div
      onClick={handleTap}
      className="relative flex flex-col items-center justify-center py-16 cursor-pointer select-none rounded-2xl overflow-hidden"
      style={{ background: "linear-gradient(180deg, hsl(218 32% 6%) 0%, hsl(218 32% 4%) 100%)" }}
    >
      <MiniStarfield />

      <div className="relative z-10 flex flex-col items-center">
        <PlaiLogo className="text-4xl" glow />
        <p
          className="mt-5 text-sm italic text-center transition-all duration-500 ease-in-out"
          style={{
            opacity: fading ? 0 : 1,
            color: glowing
              ? "hsl(340 100% 59%)"
              : "hsl(210 30% 40%)",
            textShadow: glowing
              ? "0 0 12px hsl(340 100% 59% / 0.4)"
              : "none",
            transition: "opacity 0.5s ease, color 1.2s ease, text-shadow 1.2s ease",
          }}
        >
          "{tagline}"
        </p>
        {!tapped && (
          <span className="mt-4 text-[10px] text-muted-foreground/30 transition-opacity duration-500">
            tap to cycle
          </span>
        )}
      </div>
    </div>
  );
};

export default TaglineSpace;
