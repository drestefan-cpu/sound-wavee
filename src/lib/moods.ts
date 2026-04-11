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
): { borderColor?: string; background?: string } | null => {
  switch (slug) {
    case "floating":
      return { borderColor: "rgba(244, 247, 255, 0.55)" };
    case "in_motion":
      return { borderColor: "rgba(214, 187, 120, 0.6)" };
    case "outside":
      return {
        background:
          "linear-gradient(135deg, rgba(198, 180, 230, 0.55), rgba(224, 181, 197, 0.45), rgba(216, 192, 144, 0.5))",
      };
    case "in_my_feels":
      return { borderColor: "rgba(146, 171, 214, 0.55)" };
    case "just_here":
      return { borderColor: "rgba(168, 168, 176, 0.3)" };
    default:
      return null;
  }
};
