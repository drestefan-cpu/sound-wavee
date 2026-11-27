import { afterEach, describe, expect, it, vi } from "vitest";
import { chartKey, countryName, detectCountry, flag, getChartCountry, setChartCountry } from "@/lib/chartCountry";

const withTimeZone = (timeZone: string) =>
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone }) }) as unknown as Intl.DateTimeFormat,
  );

describe("chart country", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("guesses the country from the phone's time zone", () => {
    withTimeZone("Europe/London");
    expect(detectCountry()).toBe("gb");
    vi.restoreAllMocks();
    withTimeZone("Asia/Tokyo");
    expect(detectCountry()).toBe("jp");
  });

  it("falls back to the US for places it doesn't know", () => {
    withTimeZone("Antarctica/Troll");
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en"]);
    expect(detectCountry()).toBe("us");
  });

  it("remembers the country someone picks", () => {
    withTimeZone("Europe/London");
    setChartCountry("br");
    expect(getChartCountry()).toBe("br");
  });

  it("names, flags and chart keys", () => {
    expect(chartKey("gb")).toBe("apple-gb-top-songs");
    expect(flag("gb")).toBe("🇬🇧");
    expect(countryName("jp")).toBe("Japan");
  });
});
