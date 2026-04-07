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
  "いいね",
  "감사해요",
  "obrigado",
  "merci",
  "gracias de nada",
];

const ambient = [
  "have a great day",
  "make somebody else's day",
  "this is a good moment",
  "enjoy this one",
];

// Cheeky messages for 10+ taps easter egg
export const cheekyMessages = [
  "oh yeah, you like that?",
  "tap me again...",
  "ok one sec, i need a breather",
  "...still here?",
  "honestly same",
  "you found something",
  "ok i'm back",
  "worth it?",
];

// Wholesome-only taglines for home screen
export const homeTaglines = [
  "it pleases me",
  "come listen to this",
  "i think you'll like this",
  "you're onto something",
  "have a great day",
  "make somebody else's day",
  "good ears only",
  "j'aime bien",
  "me gusta",
  "mi piace",
  "gefällt mir",
  "gosto disso",
  "いいね",
  "감사해요",
  "obrigado",
  "merci",
  "gracias de nada",
];

// Weighted pool: core heavy, then personal, language, ambient
const pool: string[] = [
  ...core, ...core, ...core,       // 6
  ...personal, ...personal,        // 12
  ...language,                     // 10
  ...ambient,                      // 4
];

export function getRandomTagline(exclude?: string): string {
  const filtered = pool.filter((t) => t !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export function getRandomHomeTagline(exclude?: string): string {
  const filtered = homeTaglines.filter((t) => t !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export const allTaglines = [...new Set(pool)];
