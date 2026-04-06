const core = [
  "it pleases me",
  "if you like it, i love it",
];

const personal = [
  "i love your taste",
  "you're onto something",
  "come listen to this",
  "i think you'll like this",
  "oh yeah, you like that?",
  "stay here a minute",
];

const language = [
  "j'aime bien",
  "me gusta",
  "mi piace",
  "gefällt mir",
  "gosto disso",
];

const ambient = [
  "have a great day",
  "make somebody else's day",
  "this is a good moment",
  "enjoy this one",
];

const playful = [
  "your taste… noted",
  "i see you",
  "between us, i love your taste",
  "you got that on",
  "okay, now i'm paying attention",
];

// Weighted pool: core heavy, then personal, language, ambient, playful
const pool: string[] = [
  ...core, ...core, ...core,       // 6
  ...personal, ...personal,        // 12
  ...language,                     // 5
  ...ambient,                      // 4
  ...playful,                      // 5
];

export function getRandomTagline(exclude?: string): string {
  const filtered = pool.filter((t) => t !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export const allTaglines = [...new Set(pool)];
