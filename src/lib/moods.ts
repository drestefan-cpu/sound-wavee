export const MOODS = [
  { slug: "floating", emoji: "☁️", label: "floating" },
  { slug: "in_motion", emoji: "⚡", label: "in motion" },
  { slug: "outside", emoji: "🪩", label: "outside" },
  { slug: "in_my_feels", emoji: "💙", label: "in my feels" },
  { slug: "just_here", emoji: "🌫️", label: "just here" },
] as const;

export type MoodSlug = (typeof MOODS)[number]["slug"];

export const getMoodBySlug = (slug: string | null | undefined) =>
  MOODS.find((m) => m.slug === slug) || null;

// Moon glow color + intensity mapping per mood
// Returns [glowColor, glowColorDim] to override --moon-color vars
export const getMoodGlow = (slug: string | null | undefined): { color: string; dim: string } | null => {
  switch (slug) {
    case "floating":
      return { color: "rgba(200, 220, 255, 0.5)", dim: "rgba(200, 220, 255, 0.15)" };
    case "in_motion":
      return { color: "rgba(255, 240, 180, 0.7)", dim: "rgba(255, 240, 180, 0.25)" };
    case "outside":
      return { color: "rgba(200, 170, 255, 0.6)", dim: "rgba(220, 190, 140, 0.2)" };
    case "in_my_feels":
      return { color: "rgba(100, 140, 255, 0.5)", dim: "rgba(100, 140, 255, 0.15)" };
    case "just_here":
      return { color: "rgba(140, 140, 150, 0.3)", dim: "rgba(140, 140, 150, 0.1)" };
    default:
      return null;
  }
};
