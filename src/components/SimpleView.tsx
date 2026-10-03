"use client";
/**
 * Simple view: the same run, the same commands, in plain words for anyone.
 *
 * Display only. Every number shown here comes straight from the run (plan totals,
 * budget, offer times); every button calls a command the full console also uses.
 * Nothing here decides feasibility, totals, IDs or authority.
 */
import { useId, useState, type ReactNode } from "react";
import type { DisruptionInput, Plan, PlanSelection, RequestInput, Run } from "@/lib/contracts";
import type { ApprovalGate } from "./derive";
import { PHASE_META, activePlan, formatCents, formatLocal } from "./format";
import { cx } from "./ui";

const BIG_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-[17px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed";
const PRIMARY = "border border-mint bg-mint text-ink hover:bg-mint/90 disabled:border-line disabled:bg-surface-2 disabled:text-muted";
const SECONDARY = "border border-line bg-surface-2 text-text hover:border-muted/50 disabled:text-muted disabled:hover:border-line";
const FIELD =
  "w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-[17px] text-text placeholder:text-muted/80 hover:border-muted/50 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60";

const WORKING: Partial<Record<Run["phase"], string>> = {
  collecting: "Asking suppliers…",
  negotiating: "Talking prices…",
  clearing: "Picking the best mix…",
  approved: "Saving your plan…",
  disrupted: "Fixing your plan…",
  repairing: "Fixing your plan…",
};

/** Phases in which the "Something changed?" buttons may act (same rule as the full console, minus the no-plan case). */
const CHANGEABLE = new Set<Run["phase"]>(["proposed", "simulated_confirmed", "needs_approval"]);

const GROUP_WORD: Record<PlanSelection["group"], string> = {
  meals: "Food",
  drinks_consumables: "Drinks and plates",
  delivery: "Delivery",
};

function Spinner() {
  return <span aria-hidden className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" />;
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
      <h2 id={id} className="flex items-center gap-3 text-[24px] font-semibold leading-tight tracking-tight text-text sm:text-[26px]">
        <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[18px] text-muted">
          {n}
        </span>
        <span>
          <span className="sr-only">Step {n}: </span>
          {title}
        </span>
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function mealCount(s: PlanSelection): number {
  return (s.coverage.meal_vegetarian ?? 0) + (s.coverage.meal_standard ?? 0);
}

function lineFor(run: Run, s: PlanSelection): string {
  const offer = run.offers.find((o) => o.id === s.offerId && o.revision === s.offerRevision);
  const time = offer ? formatLocal(offer.fulfillment.timeLocal) : null;
  const parts = [GROUP_WORD[s.group], s.merchantName];
  if (s.group === "meals") {
    parts.push(`${mealCount(s)} meals (${s.coverage.meal_vegetarian ?? 0} vegetarian)`);
    if (time) parts.push(`${offer?.fulfillment.mode === "pickup_only" ? "ready" : "arrives"} ${time}`);
  } else if (s.group === "delivery" && time) {
    parts.push(`arrives ${time}`);
  }
  parts.push(formatCents(s.totalCents));
  return parts.join(" · ");
}

function changeSentences(plan: Plan): string[] {
  const out: string[] = [];
  const groupOf = (name: string) => plan.selections.find((s) => s.merchantName === name)?.group;
  for (const r of plan.changeSummary.replaced) {
    const g = groupOf(r.to);
    const what = g === "delivery" ? "Delivery" : g === "drinks_consumables" ? "Drinks and plates" : "Food";
    out.push(`${what} now comes from ${r.to} instead of ${r.from}.`);
  }
  const replacedTo = new Set(plan.changeSummary.replaced.map((r) => r.to));
  for (const name of plan.changeSummary.added) if (!replacedTo.has(name)) out.push(`${name} joins the plan.`);
  for (const name of plan.changeSummary.removed) out.push(`${name} is no longer in the plan.`);
  for (const s of plan.selections) if (s.change === "requoted") out.push(`${s.merchantName} changed its price or time.`);
  return out;
}

function PlanList({ run, plan }: { run: Run; plan: Plan }) {
  const order: PlanSelection["group"][] = ["meals", "drinks_consumables", "delivery"];
  const rows = [...plan.selections].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  const refunds = run.orders.filter((o) => (o.cancellation?.refundCents ?? 0) > 0);
  return (
    <div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {rows.map((s) => (
          <li key={`${s.offerId}@${s.offerRevision}`} className="px-4 py-3 text-[17px] leading-snug text-text">
            {lineFor(run, s)}
          </li>
        ))}
      </ul>
      <div className="mt-5 grid gap-1">
        <p className="text-[26px] font-semibold leading-tight text-text">{`Total ${formatCents(plan.totals.totalCents)}`}</p>
        <p className="text-[22px] font-medium leading-tight text-mint">{`Money left ${formatCents(plan.budget.remainingCents)}`}</p>
      </div>
      {refunds.length ? (
        <ul className="mt-3 space-y-1">
          {refunds.map((o) => (
            <li key={o.id} className="text-[17px] text-text">
              {`${formatCents(o.cancellation!.refundCents)} comes back to you from ${o.merchantName}.`}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-[15px] text-muted">This is a practice run. Nothing is really ordered.</p>
    </div>
  );
}

function ApproveButton({ gate, onApprove, busy }: { gate: ApprovalGate; onApprove: () => void; busy: boolean }) {
  return (
    <button type="button" className={cx(BIG_BUTTON, PRIMARY, "mt-5 w-full sm:w-auto")} disabled={!gate.enabled} onClick={onApprove}>
      {busy ? "Saving…" : "Approve this plan"}
    </button>
  );
}

function AskStep({ run, busy, onFind }: { run: Run; busy: boolean; onFind: (input: RequestInput, changed: boolean) => void }) {
  const id = useId();
  const [text, setText] = useState(run.request.text);
  const [eventDate, setEventDate] = useState(run.request.eventDate);
  const [nowLocal, setNowLocal] = useState(run.request.nowLocal);
  const changed = text.trim() !== run.request.text || eventDate !== run.request.eventDate || nowLocal !== run.request.nowLocal;
  const canFind = !busy && text.trim().length > 0 && text.length <= 2000 && (changed || run.phase === "draft" || run.phase === "confirming");
  return (
    <Step n={1} title="What do you need?">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canFind) return;
          onFind(
            { text: text.trim(), eventDate, timezone: run.request.timezone, nowLocal, ...(run.request.venueName ? { venueName: run.request.venueName } : {}) },
            changed || run.phase === "draft",
          );
        }}
      >
        <label htmlFor={`${id}-text`} className="mb-2 block text-[17px] font-medium text-text">
          Tell us about your event
        </label>
        <textarea id={`${id}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={5} className={cx(FIELD, "resize-y leading-relaxed")} disabled={busy} spellCheck />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-date`} className="mb-2 block text-[17px] text-text">
              Day of the event
            </label>
            <input id={`${id}-date`} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={FIELD} disabled={busy} required />
          </div>
          <div>
            <label htmlFor={`${id}-time`} className="mb-2 block text-[17px] text-text">
              Time it is now (pretend)
            </label>
            <input id={`${id}-time`} type="time" step={60} value={nowLocal} onChange={(e) => setNowLocal(e.target.value)} className={FIELD} disabled={busy} required />
          </div>
        </div>
        <button type="submit" className={cx(BIG_BUTTON, PRIMARY, "mt-5 w-full sm:w-auto")} disabled={!canFind}>
          Find me a plan
        </button>
        <p className="mt-2 text-[15px] text-muted">Try the example, or write your own.</p>
      </form>
    </Step>
  );
}

function PlanStep({ run, gate, pending, onApprove, onBudget }: { run: Run; gate: ApprovalGate; pending: string | null; onApprove: () => void; onBudget: (cents: number) => void }) {
  const plan = activePlan(run);
  const working = WORKING[run.phase] ?? (pending === "Submit request" || pending === "Confirm requirements" ? "Reading your note…" : null);
  let body: ReactNode;
  if (working && run.phase !== "no_feasible_plan") {
    body = (
      <p role="status" className="flex items-center gap-3 text-[19px] text-text">
        <Spinner />
        {working}
      </p>
    );
  } else if (run.phase === "no_feasible_plan") {
    const inf = run.infeasibility;
    const ci = inf?.cheapestInvalid;
    body = (
      <div>
        <h3 className="text-[22px] font-semibold text-red">We couldn&rsquo;t fit everything.</h3>
        {inf ? <p className="mt-2 text-[17px] leading-relaxed text-text">{inf.summary}</p> : null}
        {ci && inf?.kind === "over_budget" ? (
          <>
            <button
              type="button"
              className={cx(BIG_BUTTON, PRIMARY, "mt-5 w-full sm:w-auto")}
              disabled={pending !== null || PHASE_META[run.phase].busy}
              onClick={() => onBudget(ci.totalCents)}
            >
              Raise my budget to {formatCents(ci.totalCents)}
            </button>
            <p className="mt-2 text-[15px] text-muted">That is {formatCents(ci.budgetGapCents)} more. You still get to say yes before anything is set.</p>
          </>
        ) : (
          <p className="mt-3 text-[15px] text-muted">Try changing what you need in step 1.</p>
        )}
      </div>
    );
  } else if (plan && run.phase === "simulated_confirmed") {
    body = (
      <div>
        <h3 className="flex items-center gap-2 text-[22px] font-semibold text-mint">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.18" />
            <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Your plan is set.
        </h3>
        <div className="mt-4">
          <PlanList run={run} plan={plan} />
        </div>
      </div>
    );
  } else if (plan && (run.phase === "proposed" || run.phase === "needs_approval")) {
    const fixed = run.phase === "needs_approval";
    const changes = fixed ? changeSentences(plan) : [];
    body = (
      <div>
        <h3 className="text-[22px] font-semibold text-text">{fixed ? "Here is the fixed plan." : "Here is your plan."}</h3>
        {changes.length ? (
          <ul className="mt-3 space-y-1.5">
            {changes.map((c) => (
              <li key={c} className="text-[17px] leading-snug text-amber">
                {c}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4">
          <PlanList run={run} plan={plan} />
        </div>
        <ApproveButton gate={gate} onApprove={onApprove} busy={pending === "Approve"} />
      </div>
    );
  } else {
    body = <p className="text-[17px] text-muted">Your plan will show up here after you press &ldquo;Find me a plan&rdquo;.</p>;
  }
  return (
    <Step n={2} title="Your plan">
      <div aria-live="polite">{body}</div>
    </Step>
  );
}

function ChangeStep({ run, pending, onDisrupt }: { run: Run; pending: string | null; onDisrupt: (d: DisruptionInput) => void }) {
  const id = useId();
  const plan = activePlan(run);
  const enabled = Boolean(plan) && CHANGEABLE.has(run.phase) && !run.job && pending === null;
  const selections = plan?.selections ?? [];
  const meal = selections
    .filter((s) => s.group === "meals" && run.availability[s.merchantId]?.available !== false)
    .sort((a, b) => mealCount(b) - mealCount(a))[0];
  const delayable = selections.filter((s) => {
    const o = run.offers.find((x) => x.id === s.offerId && x.revision === s.offerRevision);
    return o && o.fulfillment.mode !== "pickup_only";
  });
  const late = delayable.find((s) => s.group === "delivery") ?? delayable[0];
  const current = run.requirements?.headcount ?? 60;
  const [people, setPeople] = useState(String(current));
  const n = Number(people);
  const peopleOk = Number.isInteger(n) && n >= 1 && n <= 5000 && n !== current;
  const fixing = run.phase === "disrupted" || run.phase === "repairing";

  return (
    <Step n={3} title="Something changed?">
      {fixing ? (
        <p role="status" className="mb-4 flex items-center gap-3 text-[19px] text-text">
          <Spinner />
          Fixing your plan…
        </p>
      ) : !plan ? (
        <p className="mb-4 text-[17px] text-muted">These work once you have a plan.</p>
      ) : null}
      <div className="grid gap-3">
        <button type="button" className={cx(BIG_BUTTON, SECONDARY, "w-full")} disabled={!enabled || !meal} onClick={() => meal && onDisrupt({ type: "supplier_unavailable", merchantId: meal.merchantId })}>
          A supplier cancelled
        </button>
        <button
          type="button"
          className={cx(BIG_BUTTON, SECONDARY, "w-full")}
          disabled={!enabled || !late}
          onClick={() => late && onDisrupt({ type: "delivery_delayed", offerId: late.offerId, delayMinutes: 25 })}
        >
          Delivery is late
        </button>
        <form
          className="rounded-lg border border-line bg-surface-2/50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (enabled && peopleOk) onDisrupt({ type: "headcount_changed", headcount: n });
          }}
        >
          <label htmlFor={`${id}-people`} className="block text-[17px] font-semibold text-text">
            More or fewer people
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id={`${id}-people`}
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              className={cx(FIELD, "min-h-12 min-w-0 flex-1")}
              disabled={!enabled}
            />
            <button type="submit" className={cx(BIG_BUTTON, SECONDARY)} disabled={!enabled || !peopleOk}>
              Change
            </button>
          </div>
        </form>
      </div>
    </Step>
  );
}

export function SimpleView({
  run,
  gate,
  pending,
  onSubmit,
  onConfirm,
  onApprove,
  onDisrupt,
  onBudget,
}: {
  run: Run;
  gate: ApprovalGate;
  pending: string | null;
  onSubmit: (input: RequestInput) => Promise<boolean>;
  onConfirm: () => Promise<boolean>;
  onApprove: () => void;
  onDisrupt: (d: DisruptionInput) => void;
  onBudget: (cents: number) => void;
}) {
  const busy = pending !== null || PHASE_META[run.phase].busy || run.job !== null;
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 pb-16 pt-8 text-[17px] sm:pt-10">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-text">Plan the food for your event</h1>
      <p className="mt-2 text-[17px] leading-relaxed text-muted">Tell us what you need. We find suppliers and put a plan together. You decide.</p>
      <div className="mt-8 grid gap-6">
        <AskStep
          key={`${run.id}:${run.requestVersion}`}
          run={run}
          busy={busy}
          onFind={async (input, changed) => {
            if (changed && !(await onSubmit(input))) return;
            await onConfirm();
          }}
        />
        <PlanStep run={run} gate={gate} pending={pending} onApprove={onApprove} onBudget={onBudget} />
        <ChangeStep key={`${run.id}:${run.requestVersion}:${activePlan(run)?.revision ?? 0}`} run={run} pending={pending} onDisrupt={onDisrupt} />
      </div>
    </main>
  );
}
