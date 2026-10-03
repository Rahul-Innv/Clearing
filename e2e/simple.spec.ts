import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { SCRATCH, phaseChip, watchConsole } from "./helpers";

/**
 * Simple view (the default at "/"): the same journey in plain words, driven only through the UI.
 * Works against a server-mode build and a browser-runtime build alike (no API calls here).
 *   find a plan -> approve -> a supplier cancels -> fixed plan -> approve -> show details.
 * Numbers are the ones DEMO_SCRIPT.md and docs/LLD.md section 9 compute from the fictional catalog.
 */
test.describe.configure({ mode: "serial" });

const BADGE = "Demo suppliers · Local rules · Simulated orders";
const JARGON = /\b(revisions?|r\d+|candidates?|feasible|solver|idempotent|exposure|slack|market cleared|offers?|negotiation|clearing|pipeline|simulated_confirmed)\b/i;

async function chromeVisible(page: Page) {
  await expect(phaseChip(page)).toBeVisible();
  await expect(page.locator("header").getByText(BADGE)).toBeVisible();
}

async function plainWordsOnly(page: Page) {
  const text = await page.locator("main").innerText();
  expect(text.match(JARGON)?.[0] ?? null, "simple view uses plain words").toBeNull();
}

async function snap(page: Page, name: string) {
  mkdirSync(SCRATCH, { recursive: true });
  await page.screenshot({ path: `${SCRATCH}/${name}.png`, fullPage: true, animations: "disabled" });
}

/** Back to the preset request through the top-bar Reset (asks first), unless already there. */
async function freshStart(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Find me a plan" })).toBeVisible({ timeout: 30_000 });
  await expect(phaseChip(page)).toBeVisible();
  if ((await phaseChip(page).getAttribute("title")) !== "Phase: confirming") {
    await page.locator("header").getByRole("button", { name: "Reset", exact: true }).click();
    await page.getByRole("dialog", { name: "Reset the demo?" }).getByRole("button", { name: "Reset run" }).click();
  }
  await expect(phaseChip(page, "confirming")).toBeVisible({ timeout: 30_000 });
}

test("simple view: find, approve, supplier cancels, fixed plan, approve, show details", async ({ page }) => {
  test.setTimeout(120_000);
  const consoleWatch = watchConsole(page);
  await freshStart(page);

  // ---- Step 1 ---------------------------------------------------------------------------------
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: /What do you need\?/ })).toBeVisible();
  await expect(page.getByRole("region", { name: /Your plan/ })).toBeVisible();
  await expect(page.getByRole("region", { name: /Something changed\?/ })).toBeVisible();
  await expect(page.getByText("Try the example, or write your own.")).toBeVisible();
  await expect(page.getByRole("button", { name: "A supplier cancelled" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Show details" })).toBeVisible();
  await chromeVisible(page);
  await plainWordsOnly(page);
  await snap(page, "simple-1");

  // ---- Step 2: plan found ------------------------------------------------------------------------
  await page.getByRole("button", { name: "Find me a plan" }).click();
  await expect(page.getByText("Total $784.40")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Money left $215.60")).toBeVisible();
  await expect(page.getByText("Food · Golden Hour Taqueria · 60 meals (20 vegetarian) · ready 5:00 PM · $565.40")).toBeVisible();
  await expect(page.getByText("Drinks and plates · Bodega Marquez · $147.00")).toBeVisible();
  await expect(page.getByText("Delivery · Pelican Couriers · arrives 5:50 PM · $72.00")).toBeVisible();
  await expect(page.getByText("This is a practice run. Nothing is really ordered.")).toBeVisible();
  await expect(phaseChip(page, "proposed")).toBeVisible();
  await chromeVisible(page);
  await plainWordsOnly(page);
  await snap(page, "simple-2");

  await page.getByRole("button", { name: "Approve this plan" }).click();
  await expect(page.getByText("Your plan is set.")).toBeVisible({ timeout: 30_000 });
  await expect(phaseChip(page, "simulated_confirmed")).toBeVisible();
  await expect(page.getByText("Total $784.40")).toBeVisible();
  await chromeVisible(page);

  // ---- Step 3: a supplier cancels -> fixed plan ----------------------------------------------------
  await page.getByRole("button", { name: "A supplier cancelled" }).click();
  await expect(page.getByText("Here is the fixed plan.")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Total $994.14")).toBeVisible();
  await expect(page.getByText("Food now comes from Juniper & Rye Catering instead of Golden Hour Taqueria.")).toBeVisible();
  await expect(phaseChip(page, "needs_approval")).toBeVisible();
  await chromeVisible(page);
  await plainWordsOnly(page);
  await snap(page, "simple-3");

  await page.getByRole("button", { name: "Approve this plan" }).click();
  await expect(page.getByText("Your plan is set.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Total $994.14")).toBeVisible();
  await expect(phaseChip(page, "simulated_confirmed")).toBeVisible();
  await chromeVisible(page);

  // ---- Show details: the full console, same run ------------------------------------------------------
  await page.getByRole("button", { name: "Show details" }).click();
  await expect(page.getByRole("complementary", { name: "Plan and approval" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Brief and requirements" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Simple view" })).toBeVisible();
  await expect(page.getByText("Your plan is set.")).toHaveCount(0);
  await chromeVisible(page);

  // The choice is remembered; ?view=simple still forces the simple view.
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Plan and approval" })).toBeVisible();
  await page.goto("/?view=simple");
  await expect(page.getByText("Your plan is set.")).toBeVisible();
  await page.getByRole("button", { name: "Show details" }).click();
  await page.getByRole("button", { name: "Simple view" }).click();
  await expect(page.getByText("Your plan is set.")).toBeVisible();

  consoleWatch.expectClean();
});

test.describe("simple view on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("one column at 390px with no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Find me a plan" })).toBeVisible({ timeout: 30_000 });
    await chromeVisible(page);
    await expect(page.getByRole("button", { name: "Show details" })).toBeVisible();
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(fits, "no horizontal scroll at 390px").toBe(true);
    const box = await page.getByRole("button", { name: "A supplier cancelled" }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  });
});
