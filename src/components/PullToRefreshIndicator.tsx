import { useMemo } from "react";

interface Props {
  pullDistance: number;
  progress: number;
  ready: boolean;
  refreshing: boolean;
  released: boolean;
}

const PARTICLE_COLORS = [
  "hsl(340 100% 59%)",   // primary pink
  "hsl(280 60% 65%)",    // soft purple
  "hsl(210 80% 70%)",    // cool blue
  "hsl(172, 78%, 51%)",  // teal
  "hsl(0 0% 90%)",       // pale white
  "hsl(320 70% 70%)",    // rose
];

const PullToRefreshIndicator = ({ pullDistance, progress, ready, refreshing, released }: Props) => {
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: 4 + Math.random() * 92, // full width spread
        delay: Math.random() * 0.5,
        size: 0.8 + Math.random() * 1.8,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        shimmerDuration: 1.5 + Math.random() * 2,
      })),
    [],
  );

  if (pullDistance <= 0 && !refreshing) return null;

  const opacity = released ? 1 : Math.min(progress * 0.85, 0.85);
  const glowIntensity = ready || released ? 1 : progress * 0.6;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] overflow-hidden"
      style={{
        height: Math.max(pullDistance, refreshing ? 40 : 0),
        transition: pullDistance <= 0 ? "height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease" : "none",
        opacity: pullDistance <= 0 && !refreshing ? 0 : 1,
      }}
    >
      {/* Full-width atmospheric glow — anchored to bottom edge */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: Math.min(pullDistance * 0.8, 80),
          background: `radial-gradient(ellipse 100% 60% at 50% 100%, hsl(340 100% 59% / ${glowIntensity * 0.18}) 0%, hsl(280 60% 65% / ${glowIntensity * 0.08}) 40%, transparent 80%)`,
          opacity,
          transition: released ? "opacity 0.6s ease" : "none",
        }}
      />

      {/* Secondary wide glow for atmosphere */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 40,
          background: `linear-gradient(to top, hsl(340 100% 59% / ${glowIntensity * 0.06}) 0%, transparent 100%)`,
          opacity,
          transition: released ? "opacity 0.6s ease" : "none",
        }}
      />

      {/* Particles — spread full width */}
      {particles.map((p) => {
        const particleOpacity = released
          ? 0.5 + Math.random() * 0.3
          : progress > 0.25
            ? (progress - 0.25) * 1.3 * 0.5
            : 0;
        return (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              bottom: released ? 4 + Math.random() * 20 : Math.max(2, pullDistance * 0.25),
              width: p.size,
              height: p.size,
              background: ready || released ? p.color : "hsl(var(--foreground))",
              opacity: particleOpacity,
              boxShadow: (ready || released) ? `0 0 ${p.size * 2}px ${p.color}` : "none",
              transition: released
                ? `opacity 0.8s ease ${p.delay}s, bottom 0.6s ease ${p.delay}s`
                : "opacity 0.15s ease",
              animation: (ready || released) ? `shimmer ${p.shimmerDuration}s ease-in-out infinite` : "none",
            }}
          />
        );
      })}

      {/* Full-width horizon line — sits flush at the bottom divider */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, hsl(340 100% 59% / ${glowIntensity * 0.5}) 20%, hsl(340 100% 59% / ${glowIntensity * 0.7}) 50%, hsl(340 100% 59% / ${glowIntensity * 0.5}) 80%, transparent 100%)`,
          opacity,
          transition: released ? "opacity 0.6s ease" : "none",
        }}
      />
    </div>
  );
};

export default PullToRefreshIndicator;
