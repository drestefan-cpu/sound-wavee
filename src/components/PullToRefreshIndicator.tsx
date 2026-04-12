import { useMemo } from "react";

interface Props {
  pullDistance: number;
  progress: number;
  ready: boolean;
  refreshing: boolean;
  released: boolean;
}

const PullToRefreshIndicator = ({ pullDistance, progress, ready, refreshing, released }: Props) => {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: 50 + (Math.random() - 0.5) * 60,
        delay: Math.random() * 0.4,
        size: 1 + Math.random() * 1.5,
      })),
    [],
  );

  if (pullDistance <= 0 && !refreshing) return null;

  const opacity = released ? 1 : Math.min(progress * 0.8, 0.8);
  const glowIntensity = ready || released ? 1 : progress * 0.5;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-center overflow-hidden"
      style={{
        height: Math.max(pullDistance, refreshing ? 40 : 0),
        transition: pullDistance <= 0 ? "height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease" : "none",
        opacity: pullDistance <= 0 && !refreshing ? 0 : 1,
      }}
    >
      {/* Soft glow */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 200,
          height: 60,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, hsl(340 100% 59% / ${glowIntensity * 0.25}) 0%, transparent 70%)`,
          opacity,
          transition: released ? "opacity 0.6s ease" : "none",
        }}
      />

      {/* Particles */}
      {particles.map((p) => {
        const particleOpacity = released
          ? 0.6
          : progress > 0.3
            ? (progress - 0.3) * 1.4 * 0.5
            : 0;
        return (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              bottom: released ? 8 + Math.random() * 16 : Math.max(4, pullDistance * 0.3),
              width: p.size,
              height: p.size,
              background: ready || released
                ? "hsl(340 100% 59%)"
                : "hsl(var(--foreground))",
              opacity: particleOpacity,
              transition: released
                ? `opacity 0.8s ease ${p.delay}s, bottom 0.6s ease ${p.delay}s`
                : "opacity 0.15s ease",
            }}
          />
        );
      })}

      {/* Subtle line */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: `${40 + progress * 30}%`,
          maxWidth: 280,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, hsl(340 100% 59% / ${glowIntensity * 0.4}) 50%, transparent 100%)`,
          opacity,
          transition: released ? "opacity 0.6s ease" : "none",
        }}
      />
    </div>
  );
};

export default PullToRefreshIndicator;
