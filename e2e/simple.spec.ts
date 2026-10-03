import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { SCRATCH, phaseChip, watchConsole, type Phase } from "./helpers";

/**
 * Simple view (the default at "/"): the same journey in plain words, driven only through the UI.
 * Works against a server-mode build and a browser-runtime build alike (no API calls here).
 *   find a plan -> approve -> the food place cancels -> fixed plan -> approve -> show details -> reset.
 * The Simple view hides the phase chip, so the phase is read from the <main data-phase> attribute.
 * Numbers are the ones DEMO_SCRIPT.md and docs/LLD.md section 9 compute from the fictional catalog.
 */
test.describe.configure({ mode: "serial" });

const BADGE = "Demo suppliers · Local rules · Simulated orders";
const PRACTICE = "Practice mode: pretend suppliers, nothing is really ordered.";
const SIMPLE_BRIEF =
  "Dinner for 60 people at our hall. At least 20 need vegetarian meals. Include soft drinks, plates and forks. Everything ready by 6:30 PM. Spend at most $1,000 in total.";
const JARGON = /\b(revisions?|r\d+|candidates?|feasible|solver|idempotent|exposure|slack|market cleared|offers?|negotiation|clearing|pipeline|simulated_confirmed)\b/i;

/** Simple-view top bar: the honesty badge and the plain practice line stay; the phase chip and expert controls do not render. */
async function chromeVisible(page: Page) {
  const header = page.locator("header");
  await expect(header.getByText(BADGE)).toBeVisible();
  await expect(header.getByText(PRACTICE)).toBeVisible();
  await expect(phaseChip(page)).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Integration status" })).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Keyboard shortcuts" })).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Start over", exact: true })).toBeVisible();
}

function simplePhase(page: Page, phase: Phase) {
  return page.locator(`main[data-phase="${phase}"]`);
}

async function plainWordsOnly(page: Page) {
  const text = await page.locator("main").innerText();
  expect(text.match(JARGON)?.[0] ?? null, "simple view uses plain words").toBeNull();
}

async function snap(page: Page, name: string) {
  mkdirSync(SCRATCH, { recursive: true });
  await page.screenshot({ path: `${SCRATCH}/${name}.png`, fullPage: true, animations: "disabled" });
}

/** Back to the preset request through the top-bar "Start over" (asks first), unless already there. */
async function freshStart(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Find me a plan" })).toBeVisible({ timeout: 30_000 });
  if ((await page.locator("main").getAttribute("data-phase")) !== "confirming") {
    await page.locator("header").getByRole("button", { name: "Start over", exact: true }).click();
    await page.getByRole("dialog", { name: "Start over?" }).getByRole("button", { name: "Start over" }).click();
  }
  await expect(simplePhase(page, "confirming")).toBeVisible({ timeout: 30_000 });
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
  await expect(page.getByLabel("Tell us about your event")).toHaveValue(SIMPLE_BRIEF);
  await expect(page.getByLabel("Pretend it is this time on the day")).toBeVisible();
  await expect(page.getByRole("button", { name: "The food place cancelled" })).toBeDisabled();
  // Desktop (1440x900): step 1 sits in its own column to the left of step 2.
  const ask = await page.getByRole("region", { name: /What do you need\?/ }).boundingBox();
  const planBox = await page.getByRole("region", { name: /Your plan/ }).boundingBox();
  expect(ask && planBox && planBox.x > ask.x + ask.width, "step 1 is left of step 2 on desktop").toBe(true);
  await expect(page.getByRole("button", { name: "Show details" })).toBeVisible();
  await chromeVisible(page);
  await plainWordsOnly(page);
  await snap(page, "simple-1");

  // ---- Step 2: plan found ------------------------------------------------------------------------
  await page.getByRole("button", { name: "Find me a plan" }).click();
  await expect(page.getByText("Total $784.40")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Money left $215.60")).toBeVisible();
  await expect(page.getByText("Food · Golden Hour Taqueria · 60 meals (20 vegetarian) · picked up at 5:00 PM · $565.40")).toBeVisible();
  await expect(page.getByText("Drinks and plates · Bodega Marquez · $147.00")).toBeVisible();
  await expect(page.getByText("Delivery · Pelican Couriers · at your hall by 5:50 PM · $72.00")).toBeVisible();
  await expect(page.getByText("This is a practice run. Nothing is really ordered.")).toBeVisible();
  await expect(simplePhase(page, "proposed")).toBeVisible();
  // The plain-words brief went in as the request (same requirements as the original preset).
  await expect(page.getByLabel("Tell us about your event")).toHaveValue(SIMPLE_BRIEF);
  await chromeVisible(page);
  await plainWordsOnly(page);
  await snap(page, "simple-2");

  await page.getByRole("button", { name: "Yes, use this plan" }).click();
  await expect(page.getByText("Your plan is set.")).toBeVisible({ timeout: 30_000 });
  await expect(simplePhase(page, "simulated_confirmed")).toBeVisible();
  await expect(page.getByText("Total $784.40")).toBeVisible();
  await chromeVisible(page);

  // ---- Step 3: the food place cancels -> fixed plan -------------------------------------------------
  await page.getByRole("button", { name: "The food place cancelled" }).click();
  await expect(page.getByText("Here is the fixed plan.")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Total $994.14")).toBeVisible();
  await expect(page.getByText("Food now comes from Juniper & Rye Catering instead of Golden Hour Taqueria.")).toBeVisible();
  // The kept-but-swapped courier carries the reason the run itself derived (the full view's "Widened repair" note).
  await expect(page.getByText("Delivery now comes from Swiftline Runners instead of Pelican Couriers, to stay within the budget.")).toBeVisible();
  await expect(page.getByText("You would get $565.40 back from Golden Hour Taqueria.")).toBeVisible();
  await expect(simplePhase(page, "needs_approval")).toBeVisible();
  await chromeVisible(page);
  await plainWordsOnly(page);
  await snap(page, "simple-3");

  await page.getByRole("button", { name: "Yes, use this plan" }).click();
  await expect(page.getByText("Your plan is set.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Total $994.14")).toBeVisible();
  await expect(simplePhase(page, "simulated_confirmed")).toBeVisible();
  await chromeVisible(page);

  // ---- Show details: the full console, same run ------------------------------------------------------
  await page.getByRole("button", { name: "Show details" }).click();
  await expect(page.getByRole("complementary", { name: "Plan and approval" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Brief and requirements" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Simple view" })).toBeVisible();
  await expect(page.getByText("Your plan is set.")).toHaveCount(0);
  // Full view: the phase chip and the original "Reset" label are back; the practice line is not.
  await expect(phaseChip(page, "simulated_confirmed")).toBeVisible();
  await expect(page.locator("header").getByText(BADGE)).toBeVisible();
  await expect(page.locator("header").getByText(PRACTICE)).toHaveCount(0);
  await expect(page.locator("header").getByRole("button", { name: "Reset", exact: true })).toBeVisible();

  // The choice is remembered; ?view=simple still forces the simple view.
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Plan and approval" })).toBeVisible();
  await page.goto("/?view=simple");
  await expect(page.getByText("Your plan is set.")).toBeVisible();
  await page.getByRole("button", { name: "Show details" }).click();
  await page.getByRole("button", { name: "Simple view" }).click();
  await expect(page.getByText("Your plan is set.")).toBeVisible();

  // ---- Reset from the full view lands back on the Simple view (and forgets the remembered choice) ------
  await page.goto("/");
  await page.getByRole("button", { name: "Show details" }).click();
  await expect(page.getByRole("complementary", { name: "Plan and approval" })).toBeVisible();
  await page.locator("header").getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("dialog", { name: "Reset the demo?" }).getByRole("button", { name: "Reset run" }).click();
  await expect(simplePhase(page, "confirming")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Find me a plan" })).toBeVisible();
  await expect(page.getByLabel("Tell us about your event")).toHaveValue(SIMPLE_BRIEF);
  await chromeVisible(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Show details" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("complementary", { name: "Plan and approval" })).toHaveCount(0);

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
    // Top bar: the badge never overlaps the "Show details" button.
    const badge = await page.locator(`header span[title^="${BADGE}"]`).boundingBox();
    const toggle = await page.getByRole("button", { name: "Show details" }).boundingBox();
    expect(badge && toggle, "badge and toggle are laid out").toBeTruthy();
    const overlap =
      badge!.x < toggle!.x + toggle!.width && toggle!.x < badge!.x + badge!.width && badge!.y < toggle!.y + toggle!.height && toggle!.y < badge!.y + badge!.height;
    expect(overlap, "badge does not overlap the Show details button").toBe(false);
    const box = await page.getByRole("button", { name: "The food place cancelled" }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  });
});
