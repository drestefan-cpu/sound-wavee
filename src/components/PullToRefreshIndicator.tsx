import { useMemo } from "react";

interface Props {
  pullDistance: number;
  progress: number;
  ready: boolean;
  refreshing: boolean;
  released: boolean;
}

const PARTICLE_COLORS = [
  "hsl(0 0% 100%)",
  "hsl(340 100% 74%)",
  "hsl(210 72% 78%)",
  "hsl(0 0% 100%)",
  "hsl(340 100% 66%)",
  "hsl(215 60% 72%)",
];

const PullToRefreshIndicator = ({ pullDistance, progress, ready, refreshing, released }: Props) => {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: 3 + Math.random() * 94,
        delay: Math.random() * 0.5,
        size: 0.8 + Math.random() * 1.2,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        shimmerDuration: 1.8 + Math.random() * 2.2,
        drift: -6 + Math.random() * 12,
        kind: i % 7 === 0 ? "streak" : "dot",
      })),
    [],
  );

  if (pullDistance <= 0 && !refreshing) return null;

  const opacity = released ? 1 : Math.min(progress * 0.85, 0.85);
  const glowIntensity = ready || released ? 1 : progress * 0.55;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] overflow-hidden"
      style={{
        height: Math.max(pullDistance, refreshing ? 30 : 0),
        transition: pullDistance <= 0 ? "height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease" : "none",
        opacity: pullDistance <= 0 && !refreshing ? 0 : 1,
      }}
    >
      {/* Soft atmospheric haze */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: Math.min(pullDistance * 0.42, 28),
          background: `linear-gradient(to top, hsl(340 100% 59% / ${glowIntensity * 0.045}) 0%, hsl(210 72% 78% / ${glowIntensity * 0.025}) 48%, transparent 100%)`,
          opacity,
          transition: released ? "opacity 0.6s ease" : "none",
        }}
      />

      {/* Fine shimmer sweep */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 14,
          background: `linear-gradient(90deg, transparent 0%, hsl(0 0% 100% / ${glowIntensity * 0.1}) 18%, hsl(340 100% 74% / ${glowIntensity * 0.16}) 50%, hsl(210 72% 78% / ${glowIntensity * 0.1}) 82%, transparent 100%)`,
          opacity,
          transition: released ? "opacity 0.6s ease" : "none",
        }}
      />

      {/* Sparkles — spread full width */}
      {particles.map((p) => {
        const particleOpacity = released
          ? 0.45 + Math.random() * 0.25
          : progress > 0.25
            ? (progress - 0.25) * 1.3 * 0.58
            : 0;
        return (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              bottom: released ? 3 + Math.random() * 12 : Math.max(2, pullDistance * 0.16),
              width: p.kind === "streak" ? p.size * 3.2 : p.size,
              height: p.size,
              background: ready || released ? p.color : "hsl(var(--foreground))",
              opacity: particleOpacity,
              boxShadow: (ready || released) ? `0 0 ${p.size * 4}px ${p.color}` : "none",
              transition: released
                ? `opacity 0.8s ease ${p.delay}s, bottom 0.6s ease ${p.delay}s, transform 0.7s ease ${p.delay}s`
                : "opacity 0.15s ease",
              transform: released ? `translate3d(${p.drift}px, -2px, 0)` : "translate3d(0, 0, 0)",
              animation: (ready || released) ? `shimmer ${p.shimmerDuration}s ease-in-out infinite` : "none",
            }}
          />
        );
      })}

      {/* Fine horizon line */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, hsl(0 0% 100% / ${glowIntensity * 0.16}) 18%, hsl(340 100% 66% / ${glowIntensity * 0.3}) 50%, hsl(210 72% 78% / ${glowIntensity * 0.16}) 82%, transparent 100%)`,
          opacity,
          transition: released ? "opacity 0.6s ease" : "none",
        }}
      />
    </div>
  );
};

export default PullToRefreshIndicator;
