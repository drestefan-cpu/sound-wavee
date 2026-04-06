import { useState, useEffect, useCallback, useRef } from "react";
import PlaiLogo from "./PlaiLogo";
import { getRandomTagline } from "@/lib/taglines";

const TaglineSpace = () => {
  const [tagline, setTagline] = useState(() => getRandomTagline());
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const cycle = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setTagline((prev) => getRandomTagline(prev));
      setFading(false);
    }, 300);
  }, []);

  // Auto-rotate every 5s
  useEffect(() => {
    const start = () => {
      timerRef.current = setInterval(cycle, 5000);
    };
    start();
    return () => clearInterval(timerRef.current);
  }, [cycle]);

  const handleTap = () => {
    clearInterval(timerRef.current);
    cycle();
    timerRef.current = setInterval(cycle, 5000);
  };

  return (
    <div
      onClick={handleTap}
      className="flex flex-col items-center justify-center py-12 cursor-pointer select-none"
    >
      <PlaiLogo className="text-4xl" glow />
      <p
        className="mt-4 text-sm text-muted-foreground italic text-center transition-opacity duration-300"
        style={{ opacity: fading ? 0 : 1 }}
      >
        "{tagline}"
      </p>
      <span className="mt-3 text-[10px] text-muted-foreground/40">
        tap to cycle
      </span>
    </div>
  );
};

export default TaglineSpace;
