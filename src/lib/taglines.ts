import { supabase } from "@/integrations/supabase/client";

const core = ["it pleases me", "if you like it, i love it"];
const personal = [
  "i love your taste",
  "you're onto something",
  "come listen to this",
  "i think you'll like this",
  "oh yeah, you like that?",
  "stay here a minute",
  "I was just thinking about you",
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
const ambient = ["have a great day", "make somebody else's day", "this is a good moment", "enjoy this one"];

export const cheekyMessages = [
  "oh yeah, you like that?",
  "tap me again...",
  "i missed you too",
  "...still here?",
  "you must really like this",
  "you found something",
  "this is all about you",
  "hold on, I'll grab you a towel",
  "don't we sound good?",
  "don't forget to tell your friends :)",
];

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

const pool: string[] = [...core, ...core, ...core, ...personal, ...personal, ...language, ...ambient];

// DB-backed tagline cache
let dbTaglines: string[] | null = null;
let dbFetchAttempted = false;

export async function loadTaglinesFromDb(): Promise<string[]> {
  if (dbTaglines) return dbTaglines;
  if (dbFetchAttempted) return [];
  dbFetchAttempted = true;
  try {
    const { data } = await supabase
      .from("taglines" as any)
      .select("text, weight, category")
      .eq("active", true);
    if (data && data.length > 0) {
      const weighted: string[] = [];
      for (const t of data as any[]) {
        for (let i = 0; i < (t.weight || 1); i++) weighted.push(t.text);
      }
      dbTaglines = weighted;
      return weighted;
    }
  } catch {}
  return [];
}

export function getRandomTagline(exclude?: string): string {
  const source = dbTaglines && dbTaglines.length > 0 ? dbTaglines : pool;
  const filtered = source.filter((t) => t !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export function getRandomHomeTagline(exclude?: string): string {
  const source = dbTaglines && dbTaglines.length > 0 ? dbTaglines : homeTaglines;
  const filtered = source.filter((t) => t !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export const allTaglines = [...new Set(pool)];
