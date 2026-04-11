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

export const getMoodRing = (
  slug: string | null | undefined,
): { background: string } | null => {
  switch (slug) {
    case "floating":
      return {
        background:
          "conic-gradient(from 216deg, transparent 0deg 248deg, rgba(244, 247, 255, 0.5) 248deg 356deg, transparent 356deg 360deg)",
      };
    case "in_motion":
      return {
        background:
          "conic-gradient(from 216deg, transparent 0deg 248deg, rgba(214, 187, 120, 0.58) 248deg 356deg, transparent 356deg 360deg)",
      };
    case "outside":
      return {
        background:
          "conic-gradient(from 216deg, transparent 0deg 248deg, rgba(198, 180, 230, 0.5) 248deg 284deg, rgba(224, 181, 197, 0.42) 284deg 320deg, rgba(216, 192, 144, 0.48) 320deg 356deg, transparent 356deg 360deg)",
      };
    case "in_my_feels":
      return {
        background:
          "conic-gradient(from 216deg, transparent 0deg 248deg, rgba(146, 171, 214, 0.55) 248deg 356deg, transparent 356deg 360deg)",
      };
    case "just_here":
      return {
        background:
          "conic-gradient(from 216deg, transparent 0deg 248deg, rgba(168, 168, 176, 0.28) 248deg 356deg, transparent 356deg 360deg)",
      };
    default:
      return null;
  }
};
