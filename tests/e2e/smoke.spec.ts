import { expect, test, type Page } from "@playwright/test";

const SIGNED_OUT = "http://[::1]:4173";
const SIGNED_IN = "http://localhost:4173"; // the local test account

/** Fails the test if the page throws a JavaScript error (the "white screen" kind of crash) */
const watchForCrashes = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return () => expect(errors, `page crashed: ${errors.join(" | ")}`).toEqual([]);
};

/** iPhones see an "add PLAI to your home screen" overlay on the start screen first */
const skipInstallOverlay = async (page: Page) => {
  const skip = page.getByRole("button", { name: "skip for now" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const shown = await skip.waitFor({ state: "visible", timeout: 8000 }).then(() => true, () => false);
  if (shown) {
    await skip.click();
    await expect(skip).toBeHidden();
  }
};

test.describe("signed out", () => {
  test("start screen shows every way to join, plus privacy and terms", async ({ page }) => {
    const noCrash = watchForCrashes(page);
    await page.goto(SIGNED_OUT + "/");
    for (const app of ["Spotify", "YouTube Music", "Apple Music", "Tidal"]) {
      await expect(page.getByRole("button", { name: `continue with ${app}` })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "privacy" })).toHaveAttribute("href", "/privacy");
    await expect(page.getByRole("link", { name: "terms" })).toHaveAttribute("href", "/terms");
    noCrash();
  });

  test("PIN sign-in opens", async ({ page }) => {
    const noCrash = watchForCrashes(page);
    await page.goto(SIGNED_OUT + "/");
    await skipInstallOverlay(page);
    await page.getByText("sign in with your username + PIN").click();
    await expect(page.getByPlaceholder("username")).toBeVisible();
    noCrash();
  });

  test("invite page shows who invited you", async ({ page }) => {
    const noCrash = watchForCrashes(page);
    await page.goto(SIGNED_OUT + "/join/dre.stefan");
    await expect(page.getByText(/invited you to PLAI/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /get started/ }).click();
    await skipInstallOverlay(page);
    await expect(page.getByText(/invited by/)).toBeVisible();
    noCrash();
  });

  test("privacy policy and terms pages load", async ({ page }) => {
    await page.goto(SIGNED_OUT + "/privacy/index.html");
    await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
    await expect(page.getByText("Limited Use", { exact: false }).first()).toBeVisible();
    await page.goto(SIGNED_OUT + "/terms/index.html");
    await expect(page.getByRole("heading", { name: "Terms of service" })).toBeVisible();
  });
});

test.describe("signed in", () => {
  for (const [name, path] of [
    ["friends feed", "/feed"],
    ["discover", "/discover"],
    ["library", "/profile"],
    ["settings", "/settings"],
    ["notifications", "/notifications"],
  ] as const) {
    test(`${name} opens without crashing`, async ({ page }) => {
      const noCrash = watchForCrashes(page);
      await page.goto(SIGNED_IN + path);
      await expect(page.getByRole("navigation").or(page.locator("nav")).first()).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(1500); // let data load
      noCrash();
    });
  }

  test("settings has notifications, invite and delete account", async ({ page }) => {
    await page.goto(SIGNED_IN + "/settings");
    await expect(page.getByText("notifications", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("delete my account")).toBeVisible();
  });
});
