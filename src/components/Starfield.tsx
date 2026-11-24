import { useMemo } from "react";

const Starfield = () => {
  const stars = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        opacity: 0.05 + Math.random() * 0.15,
        size: 1 + Math.random() * 1.5,
        dx: (Math.random() - 0.5) * 4,
        dy: (Math.random() - 0.5) * 4,
        dur: 8 + Math.random() * 7,
      })),
    []
  );

  return (
    <>
      <style>{`
        @keyframes star-drift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(var(--dx), var(--dy)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .star-dot { animation: none !important; }
        }
      `}</style>
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={{ opacity: "var(--star-opacity)" }}
      >
        {/* Horizon glow — transparent at Night, a faint pink first-light glow at Dawn */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(120% 50% at 50% 110%, var(--sky-glow), transparent 70%)" }}
        />
        {stars.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full bg-foreground star-dot"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
              "--dx": `${s.dx}px`,
              "--dy": `${s.dy}px`,
              animation: `star-drift ${s.dur}s ease-in-out infinite`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  );
};

export default Starfield;
