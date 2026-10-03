import { expect, test } from "@playwright/test";
import { banner, confirmButton, phaseChip, shot, valueOf, watchConsole } from "./helpers";

/**
 * The market map on its own page (/market): open the market from the full console, follow the
 * "Map" link, check the page reads the same run, then go back. Drives only the UI, so it works
 * against a server-mode build and a browser-runtime build alike.
 */
test.describe.configure({ mode: "serial" });

test("market map: open from the console, same run, honest labels, back to plan", async ({ page }) => {
  test.setTimeout(120_000);
  const consoleWatch = watchConsole(page);

  // Start from the editable preset (reset through the UI so no API call is needed).
  await page.goto("/?view=full");
  const header = page.locator("header");
  await expect(header.getByRole("button", { name: "Reset", exact: true })).toBeVisible({ timeout: 30_000 });
  await header.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "Reset run", exact: true }).click();
  await expect(phaseChip(page, "confirming")).toBeVisible({ timeout: 30_000 });

  await expect(confirmButton(page)).toBeEnabled();
  await confirmButton(page).click();
  await expect(banner(page, "MARKET CLEARED")).toBeVisible({ timeout: 60_000 });

  await header.getByRole("link", { name: "Map", exact: true }).click();
  await expect(page).toHaveURL(/\/market$/);

  await expect(page.getByRole("heading", { level: 1, name: "How the plan was found" })).toBeVisible();
  await expect(page.locator("header").getByText("Demo suppliers · Local rules · Simulated orders")).toBeVisible();
  await expect(phaseChip(page, "proposed")).toBeVisible();

  const metrics = page.locator('header dl[aria-label="Run metrics"]');
  await expect(metrics).toBeVisible();
  await expect(valueOf(metrics, "Candidates")).toHaveText("41");

  const market = page.getByRole("region", { name: "Market" });
  await expect(market).toBeVisible();
  await expect(market.getByRole("button", { name: /^Golden Hour Taqueria\./ })).toBeVisible();
  await expect(banner(page, "MARKET CLEARED")).toBeVisible();

  await shot(page, "market-page");

  await page.getByRole("link", { name: "Back to plan" }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(page.locator("header").getByRole("link", { name: "Map", exact: true })).toBeVisible({ timeout: 30_000 });

  consoleWatch.expectClean();
});

test("market map: quiet empty state before the market opens", async ({ page }) => {
  await page.goto("/?view=full");
  const header = page.locator("header");
  await expect(header.getByRole("button", { name: "Reset", exact: true })).toBeVisible({ timeout: 30_000 });
  await header.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "Reset run", exact: true }).click();
  await expect(phaseChip(page, "confirming")).toBeVisible({ timeout: 30_000 });

  await page.goto("/market");
  await expect(page.getByText("Open the market from the plan page first.")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("header").getByText("Demo suppliers · Local rules · Simulated orders")).toBeVisible();
  await expect(page.getByRole("region", { name: "Market" })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to plan" }).last().click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
});
