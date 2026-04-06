const core = [
  "it pleases me",
  "if you like it, i love it",
  "i love your taste",
  "you're onto something",
  "come listen to this",
  "i think you'll like this",
  "taste speaks louder",
  "good ears only",
  "say less, just play",
];

const language = [
  "j'aime bien",
  "me gusta",
  "mi piace",
  "gefällt mir",
  "gosto disso",
];

const playful = [
  "your taste… noted",
  "i see you",
  "between us, i love your taste",
  "you got that on",
  "okay, now i'm paying attention",
];

// Weighted pool: 60% core, 20% language, 20% playful
const pool: string[] = [
  ...core, ...core, ...core, // 27
  ...language, ...language, // 10
  ...playful, // 5
];

export function getRandomTagline(exclude?: string): string {
  const filtered = pool.filter((t) => t !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export const allTaglines = [...new Set(pool)];
