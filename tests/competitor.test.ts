/** "Why this supplier lost": the winner of the same slot and the price gap. */
import { afterEach, describe, expect, it } from "vitest";
import { closestPackageFor, competitorFor, competitorSentence, type PackageExplanation } from "../src/components/derive";
import type { Offer, Run } from "../src/lib/contracts";
import { fixedClock, MERCHANT_IDS as M } from "../src/lib/fixtures";
import { localProvider } from "../src/lib/providers/local";
import { createService } from "../src/lib/service";
import { openStore, type Store } from "../src/lib/store";

let store: Store;
afterEach(() => store?.close());

async function freshPlan(): Promise<Run> {
  store = openStore(":memory:");
  const service = createService({ store, clock: fixedClock(), provider: localProvider(), paceMs: 0 });
  const created = await service.createPresetRun();
  await service.confirmRequirements(created.id);
  const run = await service.drain(created.id);
  expect(run.phase).toBe("proposed");
  return run;
}

function latestOpen(run: Run, merchantId: string): Offer {
  const open = run.offers.filter((o) => o.merchantId === merchantId && o.status === "open" && o.requestVersion === run.requestVersion);
  return open.sort((a, b) => b.revision - a.revision)[0]!;
}

describe("competitorFor", () => {
  it("names the selected supplier in the same role and the price gap", async () => {
    const run = await freshPlan();
    const fogline = latestOpen(run, M.fogline);
    expect(competitorFor(run, fogline)).toEqual({ merchantName: "Bodega Marquez", competitorCents: 14_700, offerCents: 19_900, diffCents: 5_200 });
    expect(competitorSentence(run, fogline, closestPackageFor(run, fogline))).toBe("Bodega Marquez won this slot at $147.00; this offer was $199.00 ($52.00 more).");

    const juniper = latestOpen(run, M.juniper);
    const meals = competitorFor(run, juniper)!;
    expect(meals.merchantName).toBe("Golden Hour Taqueria");
    expect(meals.competitorCents).toBe(56_540);
    expect(meals.diffCents).toBe(juniper.totalCents - 56_540);
  });

  it("returns null for a selected supplier and when there is no active plan", async () => {
    const run = await freshPlan();
    const bodega = latestOpen(run, M.bodega);
    expect(competitorFor(run, bodega)).toBeNull();
    expect(competitorFor({ ...run, currentPlanRevision: null }, latestOpen(run, M.fogline))).toBeNull();
  });

  it("returns null when the role is held by more than one supplier", async () => {
    const run = await freshPlan();
    const plan = run.plans.find((p) => p.revision === run.currentPlanRevision)!;
    const bodega = plan.selections.find((s) => s.merchantId === M.bodega)!;
    const twoDrinks = { ...plan, selections: [...plan.selections, { ...bodega, merchantId: "m-other", merchantName: "Other" }] };
    const crafted: Run = { ...run, plans: run.plans.map((p) => (p.revision === plan.revision ? twoDrinks : p)) };
    expect(competitorFor(crafted, latestOpen(run, M.fogline))).toBeNull();
  });

  it("gives a reason, not a price claim, when this offer was cheaper; omits the sentence when no reason is derivable", async () => {
    const run = await freshPlan();
    const fogline = latestOpen(run, M.fogline);
    const plan = run.plans.find((p) => p.revision === run.currentPlanRevision)!;
    const dearer = { ...plan, selections: plan.selections.map((s) => (s.merchantId === M.bodega ? { ...s, totalCents: 25_000 } : s)) };
    const crafted: Run = { ...run, plans: run.plans.map((p) => (p.revision === plan.revision ? dearer : p)) };
    expect(competitorFor(crafted, fogline)?.diffCents).toBe(-5_100);

    const failing: PackageExplanation = { offers: [fogline], rejects: ["arrival_too_late"], totalCents: 90_000, exposureCents: 90_000, budgetCents: 100_000, candidatesTried: 12 };
    expect(competitorSentence(crafted, fogline, failing)).toBe(
      "Bodega Marquez won this slot at $250.00. This offer was $199.00 ($51.00 less), but every package re-checked with it fails a rule (below).",
    );
    const dearerPackage: PackageExplanation = { ...failing, rejects: [], totalCents: plan.totals.totalCents + 5_200 };
    expect(competitorSentence(crafted, fogline, dearerPackage)).toBe(
      "Bodega Marquez won this slot at $250.00. This offer was $199.00 ($51.00 less), but the cheapest package with it totals $836.40, above the plan's $784.40.",
    );
    const cheaperPackage: PackageExplanation = { ...failing, rejects: [], totalCents: plan.totals.totalCents - 100 };
    expect(competitorSentence(crafted, fogline, cheaperPackage)).toBeNull();
    expect(competitorSentence(crafted, fogline, null)).toBeNull();
  });
});
