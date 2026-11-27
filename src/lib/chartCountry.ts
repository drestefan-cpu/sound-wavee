/**
 * Which country's Apple Music chart Discover shows: the person's own pick, otherwise a guess from
 * the phone's time zone and region settings, otherwise the US.
 */

const KEY = "plai-chart-country";

// Apple Music storefronts offered in the picker (two-letter country codes)
export const CHART_COUNTRIES = [
  "us", "gb", "ca", "au", "nz", "ie", "de", "fr", "es", "it", "nl", "be", "se", "no", "dk", "fi", "pt", "at",
  "ch", "pl", "cz", "gr", "tr", "il", "ae", "sa", "eg", "za", "ng", "ke", "gh", "in", "jp", "kr", "cn", "hk",
  "tw", "sg", "my", "ph", "id", "th", "vn", "br", "mx", "ar", "co", "cl", "pe", "jm", "tt", "pr", "do",
] as const;

// Time zone → country, for the zones people in those countries most often have
const ZONES: Record<string, string> = {
  "America/New_York": "us", "America/Chicago": "us", "America/Denver": "us", "America/Los_Angeles": "us",
  "America/Phoenix": "us", "America/Anchorage": "us", "Pacific/Honolulu": "us", "America/Detroit": "us",
  "America/Indiana/Indianapolis": "us", "America/Boise": "us",
  "America/Toronto": "ca", "America/Vancouver": "ca", "America/Edmonton": "ca", "America/Winnipeg": "ca",
  "America/Halifax": "ca", "America/St_Johns": "ca", "America/Regina": "ca",
  "Europe/London": "gb", "Europe/Dublin": "ie", "Europe/Berlin": "de", "Europe/Paris": "fr", "Europe/Madrid": "es",
  "Europe/Rome": "it", "Europe/Amsterdam": "nl", "Europe/Brussels": "be", "Europe/Stockholm": "se",
  "Europe/Oslo": "no", "Europe/Copenhagen": "dk", "Europe/Helsinki": "fi", "Europe/Lisbon": "pt",
  "Europe/Vienna": "at", "Europe/Zurich": "ch", "Europe/Warsaw": "pl", "Europe/Prague": "cz", "Europe/Athens": "gr",
  "Europe/Istanbul": "tr", "Asia/Jerusalem": "il", "Asia/Dubai": "ae", "Asia/Riyadh": "sa", "Africa/Cairo": "eg",
  "Africa/Johannesburg": "za", "Africa/Lagos": "ng", "Africa/Nairobi": "ke", "Africa/Accra": "gh",
  "Asia/Kolkata": "in", "Asia/Calcutta": "in", "Asia/Tokyo": "jp", "Asia/Seoul": "kr", "Asia/Shanghai": "cn",
  "Asia/Hong_Kong": "hk", "Asia/Taipei": "tw", "Asia/Singapore": "sg", "Asia/Kuala_Lumpur": "my",
  "Asia/Manila": "ph", "Asia/Jakarta": "id", "Asia/Bangkok": "th", "Asia/Ho_Chi_Minh": "vn", "Asia/Saigon": "vn",
  "Australia/Sydney": "au", "Australia/Melbourne": "au", "Australia/Brisbane": "au", "Australia/Perth": "au",
  "Australia/Adelaide": "au", "Australia/Hobart": "au", "Australia/Darwin": "au", "Pacific/Auckland": "nz",
  "America/Sao_Paulo": "br", "America/Mexico_City": "mx", "America/Argentina/Buenos_Aires": "ar",
  "America/Buenos_Aires": "ar", "America/Bogota": "co", "America/Santiago": "cl", "America/Lima": "pe",
  "America/Jamaica": "jm", "America/Port_of_Spain": "tt", "America/Puerto_Rico": "pr",
  "America/Santo_Domingo": "do",
};

const offered = (cc: string | undefined | null): cc is string =>
  !!cc && (CHART_COUNTRIES as readonly string[]).includes(cc.toLowerCase());

export function detectCountry(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (offered(ZONES[zone])) return ZONES[zone];
  } catch {}
  try {
    for (const lang of navigator.languages || [navigator.language]) {
      const region = lang.split("-")[1]?.toLowerCase();
      if (offered(region)) return region;
    }
  } catch {}
  return "us";
}

export function getChartCountry(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (offered(saved)) return saved;
  } catch {}
  return detectCountry();
}

export function setChartCountry(cc: string) {
  try {
    localStorage.setItem(KEY, cc);
  } catch {}
}

const names = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

export const countryName = (cc: string) => names?.of(cc.toUpperCase()) || cc.toUpperCase();

/** "gb" → 🇬🇧 */
export const flag = (cc: string) =>
  String.fromCodePoint(...cc.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

export const chartKey = (cc: string) => `apple-${cc}-top-songs`;
