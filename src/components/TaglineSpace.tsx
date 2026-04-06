import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import PlaiLogo from "./PlaiLogo";
import { getRandomTagline, cheekyMessages } from "@/lib/taglines";

const MiniStarfield = () => {
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        opacity: 0.08 + Math.random() * 0.17,
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
  const [cheekyMode, setCheekyMode] = useState(false);
  const tapCountRef = useRef(0);
  const cheekyIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const cycle = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      if (cheekyMode) {
        const msg = cheekyMessages[cheekyIndexRef.current % cheekyMessages.length];
        cheekyIndexRef.current++;
        setTagline(msg);
      } else {
        setTagline((prev) => getRandomTagline(prev));
      }
      setFading(false);
      setGlowing(true);
      setTimeout(() => setGlowing(false), 1200);
    }, 400);
  }, [cheekyMode]);

  useEffect(() => {
    const interval = cheekyMode ? 3000 : 5500;
    timerRef.current = setInterval(cycle, interval);
    return () => clearInterval(timerRef.current);
  }, [cycle, cheekyMode]);

  const handleLogoTap = () => {
    tapCountRef.current++;

    if (tapCountRef.current >= 10 && !cheekyMode) {
      setCheekyMode(true);
      cheekyIndexRef.current = 0;
      clearInterval(timerRef.current);
      cycle();
      return;
    }

    if (!tapped) {
      setTapped(true);
      clearInterval(timerRef.current);
      cycle();
      timerRef.current = setInterval(cycle, cheekyMode ? 3000 : 5500);
    }
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center cursor-pointer select-none rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(180deg, hsl(218 32% 6%) 0%, hsl(218 32% 4%) 100%)",
        paddingTop: 60,
        paddingBottom: 60,
      }}
    >
      <MiniStarfield />

      <div className="relative z-10 flex flex-col items-center">
        <button onClick={handleLogoTap} className="focus:outline-none">
          <PlaiLogo className="text-5xl" glow />
        </button>
        <p
          className="mt-5 text-sm italic text-center transition-all duration-500 ease-in-out max-w-[240px]"
          style={{
            opacity: fading ? 0 : 1,
            color: glowing
              ? "hsl(340 100% 59%)"
              : "hsl(210 30% 40%)",
            textShadow: glowing
              ? "0 0 12px hsl(340 100% 59% / 0.4)"
              : "none",
            transition: "opacity 0.4s ease, color 1.2s ease, text-shadow 1.2s ease",
          }}
        >
          "{tagline}"
        </p>
      </div>
    </div>
  );
};

export default TaglineSpace;
