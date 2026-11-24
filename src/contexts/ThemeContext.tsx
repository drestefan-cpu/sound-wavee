import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** What the user picked in Settings → Appearance */
export type ThemePreference = "night" | "dawn" | "system";
/** What's actually on screen */
export type ResolvedTheme = "night" | "dawn";

const STORAGE_KEY = "plai-theme";
// Browser/OS chrome colour for each theme (iOS status bar, Android task switcher)
const THEME_COLOR: Record<ResolvedTheme, string> = { night: "#080B12", dawn: "#F4EFE7" };

interface ThemeContextType {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const readPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "night" || stored === "dawn" || stored === "system") return stored;
  } catch {
    // storage unavailable (private mode etc.) — fall back to the default
  }
  return "night";
};

const systemPrefersLight = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches;

const resolve = (pref: ThemePreference): ResolvedTheme =>
  pref === "system" ? (systemPrefersLight() ? "dawn" : "night") : pref;

/** Applies the theme to <html data-theme="…"> and the browser chrome colour. */
const applyTheme = (theme: ResolvedTheme) => {
  const root = document.documentElement;
  if (theme === "dawn") root.dataset.theme = "dawn";
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolve(readPreference()));

  useEffect(() => {
    const next = resolve(preference);
    setTheme(next);
    applyTheme(next);

    if (preference !== "system" || !window.matchMedia) return;
    // "Match my phone": follow the OS when it switches between light and dark
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const t = query.matches ? "dawn" : "night";
      setTheme(t);
      applyTheme(t);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = (pref: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // ignore — the choice still applies for this session
    }
    setPreferenceState(pref);
  };

  return <ThemeContext.Provider value={{ preference, theme, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
