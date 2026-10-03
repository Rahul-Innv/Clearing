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

/*
 * Visual language (Refero references: Aesop dark cart, Square receipt, Apple Invites welcome,
 * Kinhive onboarding): one near-black canvas, raised cards with a hairline border and a faint
 * top highlight, a small uppercase eyebrow over each heading, and mint as the single accent.
 */
const BIG_BUTTON =
  "inline-flex h-[52px] min-h-12 items-center justify-center gap-2 rounded-xl px-7 text-[16px] font-semibold tracking-[-0.01em] transition-[filter,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed";
const PRIMARY =
  "border border-mint bg-mint text-ink shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_24px_rgba(94,234,212,0.18)] hover:brightness-[1.04] disabled:border-white/[0.08] disabled:bg-surface-2 disabled:text-muted disabled:shadow-none disabled:hover:brightness-100";
const SECONDARY =
  "border border-white/[0.08] bg-surface-2 text-text hover:border-white/[0.16] hover:bg-[#1f2024] disabled:text-muted/80 disabled:hover:border-white/[0.08] disabled:hover:bg-surface-2";
const FIELD =
  "w-full rounded-xl border border-white/[0.10] bg-ink/70 px-3.5 py-3.5 text-[17px] leading-snug text-text placeholder:text-muted/80 transition-[border-color,box-shadow] duration-150 hover:border-white/[0.18] focus-visible:border-mint/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint/30 disabled:opacity-60";
const LABEL = "mb-2 block text-[13px] font-medium tracking-[0.005em] text-muted";
const EYEBROW = "text-[12px] font-medium uppercase tracking-[0.08em] text-muted";

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

/** Calm "working" state: a soft pulsing dot, the sentence, and a slim moving line. */
function Working({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" className={className}>
      <p className="flex items-center gap-3 text-[17px] text-text">
        <span aria-hidden className="pulse inline-block h-2 w-2 shrink-0 rounded-full bg-mint shadow-[0_0_12px_rgba(94,234,212,0.6)]" />
        {children}
      </p>
      <div aria-hidden className="mt-4 h-[2px] overflow-hidden rounded-full bg-white/[0.06]">
        <div className="progress-slide h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-mint/80 to-transparent" />
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="rounded-[20px] border border-white/[0.08] bg-surface p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.25)] sm:p-8"
    >
      <p aria-hidden className={EYEBROW}>
        Step {n} of 3
      </p>
      <h2 id={id} className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.015em] text-text sm:text-[24px]">
        <span className="sr-only">Step {n} of 3: </span>
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function mealCount(s: PlanSelection): number {
  return (s.coverage.meal_vegetarian ?? 0) + (s.coverage.meal_standard ?? 0);
}

type Row = { role: string; name: string; detail: string | null; price: string };

function rowFor(run: Run, s: PlanSelection): Row {
  const offer = run.offers.find((o) => o.id === s.offerId && o.revision === s.offerRevision);
  const time = offer ? formatLocal(offer.fulfillment.timeLocal) : null;
  const detail: string[] = [];
  if (s.group === "meals") {
    detail.push(`${mealCount(s)} meals (${s.coverage.meal_vegetarian ?? 0} vegetarian)`);
    if (time) detail.push(`${offer?.fulfillment.mode === "pickup_only" ? "ready" : "arrives"} ${time}`);
  } else if (s.group === "delivery" && time) {
    detail.push(`arrives ${time}`);
  }
  return { role: GROUP_WORD[s.group], name: s.merchantName, detail: detail.length ? detail.join(" · ") : null, price: formatCents(s.totalCents) };
}

/** Screen-reader (and text) separator so each row still reads as one sentence: "Food · Name · … · $565.40". */
function Sep() {
  return <span className="sr-only"> · </span>;
}

function Dot({ tone = "mint" }: { tone?: "mint" | "muted" }) {
  return <span aria-hidden className={cx("mt-[9px] inline-block h-1.5 w-1.5 shrink-0 rounded-full", tone === "mint" ? "bg-mint" : "bg-muted/60")} />;
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
      <ul className="border-t border-white/[0.08]">
        {rows.map((s) => {
          const r = rowFor(run, s);
          return (
            <li
              key={`${s.offerId}@${s.offerRevision}`}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-b border-white/[0.06] py-4 sm:grid-cols-[148px_1fr_auto] sm:py-5"
            >
              <span className={cx(EYEBROW, "col-span-2 sm:col-span-1")}>{r.role}</span>
              <Sep />
              <span className="min-w-0">
                <span className="block text-[17px] font-medium leading-snug tracking-[-0.01em] text-text">{r.name}</span>
                {r.detail ? (
                  <>
                    <Sep />
                    <span className="mt-1 block text-[14px] leading-snug text-muted">{r.detail}</span>
                  </>
                ) : null}
              </span>
              <Sep />
              <span className="num text-right text-[17px] text-text">{r.price}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 grid gap-2">
        <p className="flex items-baseline justify-between gap-4">
          <span className="text-[15px] text-muted">Total</span>{" "}
          <span className="num text-[30px] font-semibold leading-none tracking-[-0.02em] text-text sm:text-[32px]">{formatCents(plan.totals.totalCents)}</span>
        </p>
        <p className="flex items-baseline justify-between gap-4 text-mint">
          <span className="text-[15px]">Money left</span>{" "}
          <span className="num text-[17px] font-medium">{formatCents(plan.budget.remainingCents)}</span>
        </p>
      </div>
      {refunds.length ? (
        <ul className="mt-5 space-y-2 border-t border-white/[0.06] pt-5">
          {refunds.map((o) => (
            <li key={o.id} className="flex gap-3 text-[15px] leading-relaxed text-text">
              <Dot />
              <span>{`${formatCents(o.cancellation!.refundCents)} comes back to you from ${o.merchantName}.`}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-5 text-[13px] text-muted">This is a practice run. Nothing is really ordered.</p>
    </div>
  );
}

function ApproveButton({ gate, onApprove, busy }: { gate: ApprovalGate; onApprove: () => void; busy: boolean }) {
  return (
    <button type="button" className={cx(BIG_BUTTON, PRIMARY, "mt-7 w-full sm:w-auto")} disabled={!gate.enabled} onClick={onApprove}>
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
        <label htmlFor={`${id}-text`} className={LABEL}>
          Tell us about your event
        </label>
        <textarea id={`${id}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={5} className={cx(FIELD, "resize-y leading-relaxed")} disabled={busy} spellCheck />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-date`} className={LABEL}>
              Day of the event
            </label>
            <input id={`${id}-date`} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={FIELD} disabled={busy} required />
          </div>
          <div>
            <label htmlFor={`${id}-time`} className={LABEL}>
              Time it is now (pretend)
            </label>
            <input id={`${id}-time`} type="time" step={60} value={nowLocal} onChange={(e) => setNowLocal(e.target.value)} className={FIELD} disabled={busy} required />
          </div>
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <button type="submit" className={cx(BIG_BUTTON, PRIMARY, "w-full sm:w-auto")} disabled={!canFind}>
            Find me a plan
          </button>
          <p className="text-center text-[14px] text-muted sm:text-left">Try the example, or write your own.</p>
        </div>
      </form>
    </Step>
  );
}

function PlanStep({ run, gate, pending, onApprove, onBudget }: { run: Run; gate: ApprovalGate; pending: string | null; onApprove: () => void; onBudget: (cents: number) => void }) {
  const plan = activePlan(run);
  const working = WORKING[run.phase] ?? (pending === "Submit request" || pending === "Confirm requirements" ? "Reading your note…" : null);
  let body: ReactNode;
  if (working && run.phase !== "no_feasible_plan") {
    body = <Working>{working}</Working>;
  } else if (run.phase === "no_feasible_plan") {
    const inf = run.infeasibility;
    const ci = inf?.cheapestInvalid;
    body = (
      <div>
        <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-red">We couldn&rsquo;t fit everything.</h3>
        {inf ? <p className="mt-2 text-[17px] leading-relaxed text-text/90">{inf.summary}</p> : null}
        {ci && inf?.kind === "over_budget" ? (
          <>
            <button
              type="button"
              className={cx(BIG_BUTTON, PRIMARY, "mt-7 w-full sm:w-auto")}
              disabled={pending !== null || PHASE_META[run.phase].busy}
              onClick={() => onBudget(ci.totalCents)}
            >
              Raise my budget to {formatCents(ci.totalCents)}
            </button>
            <p className="mt-3 text-[14px] text-muted">That is {formatCents(ci.budgetGapCents)} more. You still get to say yes before anything is set.</p>
          </>
        ) : (
          <p className="mt-3 text-[14px] text-muted">Try changing what you need in step 1.</p>
        )}
      </div>
    );
  } else if (plan && run.phase === "simulated_confirmed") {
    body = (
      <div>
        <h3 className="flex items-center gap-2.5 text-[20px] font-semibold tracking-[-0.01em] text-mint">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.18" />
            <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Your plan is set.
        </h3>
        <div className="mt-5">
          <PlanList run={run} plan={plan} />
        </div>
      </div>
    );
  } else if (plan && (run.phase === "proposed" || run.phase === "needs_approval")) {
    const fixed = run.phase === "needs_approval";
    const changes = fixed ? changeSentences(plan) : [];
    body = (
      <div>
        <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-text">{fixed ? "Here is the fixed plan." : "Here is your plan."}</h3>
        {changes.length ? (
          <ul className="mt-4 space-y-2 rounded-xl border border-white/[0.06] bg-ink/40 px-4 py-3.5">
            {changes.map((c) => (
              <li key={c} className="flex gap-3 text-[15px] leading-relaxed text-text">
                <Dot />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-5">
          <PlanList run={run} plan={plan} />
        </div>
        <ApproveButton gate={gate} onApprove={onApprove} busy={pending === "Approve"} />
      </div>
    );
  } else {
    body = <p className="text-[16px] leading-relaxed text-muted">Your plan will show up here after you press &ldquo;Find me a plan&rdquo;.</p>;
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
        <Working className="mb-6">Fixing your plan…</Working>
      ) : !plan ? (
        <p className="mb-5 text-[16px] text-muted">These work once you have a plan.</p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          className="flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:col-span-2 sm:mt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (enabled && peopleOk) onDisrupt({ type: "headcount_changed", headcount: n });
          }}
        >
          <label htmlFor={`${id}-people`} className="block text-[16px] font-medium text-text">
            More or fewer people
          </label>
          <div className="flex gap-2 sm:w-[300px]">
            <input
              id={`${id}-people`}
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              className={cx(FIELD, "num h-[52px] min-h-12 min-w-0 flex-1 py-0")}
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
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 pb-24 pt-8 text-[17px] sm:px-6 sm:pt-20">
      <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[44px]">Plan the food for your event</h1>
      <p className="mt-3 max-w-[46ch] text-[17px] leading-relaxed text-muted sm:mt-4 sm:text-[19px]">Tell us what you need. We find suppliers and put a plan together. You decide.</p>
      <div className="mt-10 grid gap-6 sm:mt-14">
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
