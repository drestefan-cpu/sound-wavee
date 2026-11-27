/** "André Delaney" → "andre.delaney": a username suggestion from someone's name */
export const suggestUsername = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // é → e
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]/g, "") // emoji, punctuation
    .trim()
    .replace(/\s+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "") // no dots or dashes at the ends
    .slice(0, 24);
