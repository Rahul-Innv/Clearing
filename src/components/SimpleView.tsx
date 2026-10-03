"use client";
/**
 * Simple view: the same run, the same commands, in plain words for anyone.
 *
 * Display only. Every number shown here comes straight from the run (plan totals,
 * budget, offer times); every button calls a command the full console also uses.
 * Nothing here decides feasibility, totals, IDs or authority.
 */
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import type { DisruptionInput, Plan, PlanSelection, RequestInput, Run } from "@/lib/contracts";
import type { ApprovalGate } from "./derive";
import { PRESET_TEXT, SIMPLE_PRESET_TEXT } from "@/lib/fixtures";
import { PHASE_META, activePlan, formatCents, formatLocal } from "./format";
import { IconCircle, Meter, cx } from "./ui";

/*
 * Visual language (Refero references, Monarch Money web app: Transactions list 0c65d6c2, Add transaction
 * form 1cb4608a, Assign accounts goal progress 82d63b0e, Dashboard cards 7c28401a), translated to the
 * app's dark tokens: cards one step above the canvas with a soft hairline and a title row, 12px form
 * fields with the label above, stat tiles with a label over a big number, a thin budget bar,
 * transaction rows (icon circle, name, muted detail, right-aligned amount), and one solid primary button.
 * Mint stays the single accent.
 */
const BIG_BUTTON =
  "inline-flex h-12 min-h-12 items-center justify-center gap-2 rounded-[10px] px-6 text-[16px] font-semibold tracking-[-0.005em] transition-[filter,background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed";
const PRIMARY =
  "border border-mint bg-mint text-ink hover:brightness-110 disabled:border-hairline disabled:bg-card-2 disabled:text-muted disabled:hover:brightness-100";
const SECONDARY =
  "border border-hairline bg-white/[0.06] text-text hover:bg-white/[0.10] disabled:text-muted/80 disabled:hover:bg-white/[0.06]";
const FIELD =
  "w-full rounded-field border border-white/[0.09] bg-field px-3.5 py-3 text-[16px] leading-snug text-text placeholder:text-muted/70 transition-[border-color,box-shadow] duration-150 hover:border-white/[0.16] focus-visible:border-mint/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint/25 disabled:opacity-60";
const LABEL = "mb-1.5 block text-[14px] font-medium text-text";
const HINT = "mt-1.5 text-[13px] leading-snug text-muted";
const TILE =
  "flex w-full items-center gap-3.5 rounded-2xl border border-hairline bg-card-2 p-4 text-left text-[16px] font-medium leading-snug text-text transition-[background-color,border-color] duration-150 sm:flex-col sm:items-start sm:justify-between sm:gap-6";

/** Simple 18px line icons, drawn inline (no icon font, no network). */
const ICON_PATHS = {
  food: "M6 3v6a2 2 0 0 0 4 0V3M8 3v18M17 21V3c-2 1.4-3 3.9-3 7v4h3",
  cup: "M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8zM16 9.5h1.5a2.5 2.5 0 0 1 0 5H16M5 21h11",
  truck: "M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3.5v2.5h-7M7 19.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM17 19.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z",
  cancel: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  people: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.3a3 3 0 0 1 0 5.4M17.5 14.3c2 .8 3.5 3 3.5 5.7",
  swap: "M4 8h14l-3.5-3.5M20 16H6l3.5 3.5",
  refund: "M9 14l-4-4 4-4M5 10h9.5a4.5 4.5 0 0 1 0 9H12",
  arrow: "M5 12h14M13 6l6 6-6 6",
} as const;

function Icon({ name, size = 18 }: { name: keyof typeof ICON_PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

const ROLE_ICON: Record<PlanSelection["group"], keyof typeof ICON_PATHS> = {
  meals: "food",
  drinks_consumables: "cup",
  delivery: "truck",
};

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
    <section aria-labelledby={id} className="rounded-card border border-hairline bg-card shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-hairline px-5 py-4 sm:px-6">
        <h2 id={id} className="text-[19px] font-semibold leading-tight tracking-[-0.01em] text-text">
          <span className="sr-only">Step {n} of 3: </span>
          {title}
        </h2>
        <p aria-hidden className="text-[14px] text-muted">
          Step {n} of 3
        </p>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function mealCount(s: PlanSelection): number {
  return (s.coverage.meal_vegetarian ?? 0) + (s.coverage.meal_standard ?? 0);
}

type Row = { role: string; name: string; detail: string | null; price: string };

function rowFor(run: Run, s: PlanSelection, deliveryName: string | null): Row {
  const offer = run.offers.find((o) => o.id === s.offerId && o.revision === s.offerRevision);
  const time = offer ? formatLocal(offer.fulfillment.timeLocal) : null;
  const detail: string[] = [];
  if (s.group === "meals") {
    detail.push(`${mealCount(s)} meals (${s.coverage.meal_vegetarian ?? 0} vegetarian)`);
    if (time) {
      if (offer?.fulfillment.mode !== "pickup_only") detail.push(`at your hall by ${time}`);
      else detail.push(deliveryName ? `picked up by ${deliveryName} at ${time}` : `ready at ${time}`);
    }
  } else if (s.group === "delivery" && time) {
    detail.push(`at your hall by ${time}`);
  }
  return { role: GROUP_WORD[s.group], name: s.merchantName, detail: detail.length ? detail.join(" · ") : null, price: formatCents(s.totalCents) };
}

/** Screen-reader (and text) separator so each row still reads as one sentence: "Food · Name · … · $565.40". */
function Sep() {
  return <span className="sr-only"> · </span>;
}

/** A soft tinted notice row: small icon, one sentence. */
function Notice({ icon, children }: { icon: keyof typeof ICON_PATHS; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-mint/[0.06] px-3.5 py-3 text-[15px] leading-snug text-text">
      <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint/[0.14] text-mint">
        <Icon name={icon} size={14} />
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Why a supplier that did NOT cancel or run late was still swapped out, in plain words.
 * Reuses the fact the server already derived for the plan ("Keeping X would exceed the budget by $Y"
 * or "Keeping X fails <timing checks>", the note the full console shows as "Widened repair").
 * Returns null when that note does not name the supplier or gives another reason: never guessed.
 */
function swapReason(plan: Plan, from: string): string | null {
  const note = plan.changeSummary.widened;
  if (!note) return null;
  const name = escapeRe(from);
  if (new RegExp(`Keeping ${name} would exceed the budget by`).test(note)) return `to stay under ${formatCents(plan.budget.budgetCents)}`;
  const fails = new RegExp(`Keeping ${name} fails ([a-z_, ]+?)(?:;|\\.)`).exec(note)?.[1];
  if (fails) {
    const codes = fails.split(",").map((c) => c.trim());
    if (codes.length && codes.every((c) => c === "arrival_too_late" || c === "pickup_too_late")) return "so everything is there on time";
  }
  return null;
}

function changeSentences(plan: Plan): string[] {
  const out: string[] = [];
  const groupOf = (name: string) => plan.selections.find((s) => s.merchantName === name)?.group;
  for (const r of plan.changeSummary.replaced) {
    const g = groupOf(r.to);
    const what = g === "delivery" ? "Delivery" : g === "drinks_consumables" ? "Drinks and plates" : "Food";
    const reason = swapReason(plan, r.from);
    out.push(`${what} now comes from ${r.to} instead of ${r.from}${reason ? `, ${reason}` : ""}.`);
  }
  const replacedTo = new Set(plan.changeSummary.replaced.map((r) => r.to));
  for (const name of plan.changeSummary.added) if (!replacedTo.has(name)) out.push(`${name} joins the plan.`);
  for (const name of plan.changeSummary.removed) out.push(`${name} is no longer in the plan.`);
  for (const s of plan.selections) if (s.change === "requoted") out.push(`${s.merchantName} changed its price or time.`);
  return out;
}

function Stat({ label, value, tone, className }: { label: string; value: string; tone: "text" | "mint" | "muted"; className?: string }) {
  return (
    <div className={cx("rounded-xl border border-hairline bg-card-2 px-4 py-3.5", className)}>
      <p className={cx("text-[13px] font-medium", tone === "mint" ? "text-mint" : "text-muted")}>{label}</p>{" "}
      <p
        className={cx(
          "num mt-1 font-semibold leading-none tracking-[-0.02em]",
          tone === "text" ? "text-[28px] text-text" : tone === "mint" ? "text-[22px] text-mint" : "text-[22px] text-muted",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PlanList({ run, plan }: { run: Run; plan: Plan }) {
  const order: PlanSelection["group"][] = ["meals", "drinks_consumables", "delivery"];
  const rows = [...plan.selections].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  const deliveryName = plan.selections.find((s) => s.group === "delivery")?.merchantName ?? null;
  const refunds = run.orders.filter((o) => (o.cancellation?.refundCents ?? 0) > 0);
  const total = plan.totals.totalCents;
  const budget = plan.budget.budgetCents;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Total" value={formatCents(total)} tone="text" className="col-span-2 sm:col-span-1" />
        <Stat label="Money left" value={formatCents(plan.budget.remainingCents)} tone="mint" />
        {budget > 0 ? <Stat label="Budget" value={formatCents(budget)} tone="muted" /> : null}
      </div>
      {budget > 0 ? (
        <div className="mt-5">
          <Meter value={total} max={budget} />
          <p className="num mt-2 flex justify-between gap-4 text-[13px] text-muted">
            <span>{formatCents(total)} planned</span> <span>{formatCents(budget)} budget</span>
          </p>
        </div>
      ) : null}
      <ul className="mt-5 divide-y divide-hairline border-y border-hairline">
        {rows.map((s) => {
          const r = rowFor(run, s, deliveryName);
          return (
            <li key={`${s.offerId}@${s.offerRevision}`} className="flex items-center gap-3.5 py-3.5 sm:gap-4 sm:py-4">
              <IconCircle>
                <Icon name={ROLE_ICON[s.group]} />
              </IconCircle>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium uppercase tracking-[0.06em] text-muted">{r.role}</span>
                <Sep />
                <span className="block text-[16px] font-medium leading-snug tracking-[-0.01em] text-text">{r.name}</span>
                {r.detail ? (
                  <>
                    <Sep />
                    <span className="mt-0.5 block text-[14px] leading-snug text-muted">{r.detail}</span>
                  </>
                ) : null}
              </span>
              <Sep />
              <span className="num shrink-0 text-right text-[16px] font-medium text-text">{r.price}</span>
            </li>
          );
        })}
      </ul>
      {refunds.length ? (
        <ul className="mt-4 space-y-2">
          {refunds.map((o) => (
            <Notice key={o.id} icon="refund">{`You would get ${formatCents(o.cancellation!.refundCents)} back from ${o.merchantName}.`}</Notice>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-[13px] text-muted">This is a practice run. Nothing is really ordered.</p>
    </div>
  );
}

/** Quiet secondary link to the page that shows how the plan was put together. */
function HowFound({ className }: { className?: string }) {
  return (
    <Link
      href="/market"
      prefetch={false}
      className={cx(
        "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[15px] font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        className,
      )}
    >
      See how the plan was found
      <Icon name="arrow" size={16} />
    </Link>
  );
}

function ApproveButton({ gate, onApprove, busy }: { gate: ApprovalGate; onApprove: () => void; busy: boolean }) {
  return (
    <button type="button" className={cx(BIG_BUTTON, PRIMARY, "w-full sm:w-auto")} disabled={!gate.enabled} onClick={onApprove}>
      {busy ? "Saving…" : "Yes, use this plan"}
    </button>
  );
}

function AskStep({ run, busy, onFind }: { run: Run; busy: boolean; onFind: (input: RequestInput, changed: boolean) => void }) {
  const id = useId();
  // The stored example is written for the full console; here the same request is offered in plain words.
  // Submitting it counts as a change, so it goes in as a new request before the plan is searched for.
  const [text, setText] = useState(run.request.text === PRESET_TEXT ? SIMPLE_PRESET_TEXT : run.request.text);
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
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <label htmlFor={`${id}-date`} className={LABEL}>
              Day of the event
            </label>
            <input id={`${id}-date`} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={FIELD} disabled={busy} required />
          </div>
          <div>
            <label htmlFor={`${id}-time`} className={LABEL}>
              Pretend it is this time on the day
            </label>
            <input
              id={`${id}-time`}
              type="time"
              step={60}
              value={nowLocal}
              onChange={(e) => setNowLocal(e.target.value)}
              className={FIELD}
              disabled={busy}
              required
              aria-describedby={`${id}-time-hint`}
            />
            <p id={`${id}-time-hint`} className={HINT}>
              We use this to check the food arrives in time.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 lg:flex-col lg:items-stretch lg:gap-3">
          <button type="submit" className={cx(BIG_BUTTON, PRIMARY, "w-full whitespace-nowrap sm:w-auto lg:w-full")} disabled={!canFind}>
            Find me a plan
          </button>
          <p className="text-center text-[14px] text-muted sm:text-left lg:text-center">Try the example, or write your own.</p>
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
        <HowFound className="-ml-2 mt-3" />
      </div>
    );
  } else if (plan && (run.phase === "proposed" || run.phase === "needs_approval")) {
    const fixed = run.phase === "needs_approval";
    const changes = fixed ? changeSentences(plan) : [];
    body = (
      <div>
        <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-text">{fixed ? "Here is the fixed plan." : "Here is your plan."}</h3>
        {changes.length ? (
          <ul className="mt-4 space-y-2">
            {changes.map((c) => (
              <Notice key={c} icon="swap">
                {c}
              </Notice>
            ))}
          </ul>
        ) : null}
        <div className="mt-5">
          <PlanList run={run} plan={plan} />
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <ApproveButton gate={gate} onApprove={onApprove} busy={pending === "Approve"} />
          <HowFound />
        </div>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr]">
        <button
          type="button"
          className={cx(TILE, "min-h-16 hover:border-white/[0.16] hover:bg-[#222327] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-hairline disabled:hover:bg-card-2")}
          disabled={!enabled || !meal}
          onClick={() => meal && onDisrupt({ type: "supplier_unavailable", merchantId: meal.merchantId })}
        >
          <IconCircle>
            <Icon name="cancel" />
          </IconCircle>
          The food place cancelled
        </button>
        <button
          type="button"
          className={cx(TILE, "min-h-16 hover:border-white/[0.16] hover:bg-[#222327] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-hairline disabled:hover:bg-card-2")}
          disabled={!enabled || !late}
          onClick={() => late && onDisrupt({ type: "delivery_delayed", offerId: late.offerId, delayMinutes: 25 })}
        >
          <IconCircle>
            <Icon name="clock" />
          </IconCircle>
          Delivery is late
        </button>
        <form
          className="flex flex-col gap-3 rounded-2xl border border-hairline bg-card-2 p-4 sm:col-span-2 xl:col-span-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (enabled && peopleOk) onDisrupt({ type: "headcount_changed", headcount: n });
          }}
        >
          <div className="flex items-center gap-3.5 xl:flex-col xl:items-start xl:gap-3">
            <IconCircle>
              <Icon name="people" />
            </IconCircle>
            <div>
              <label htmlFor={`${id}-people`} className="block text-[16px] font-medium leading-snug text-text">
                More or fewer people
              </label>
              <p id={`${id}-people-hint`} className="mt-0.5 text-[13px] leading-snug text-muted">
                How many people now?
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              id={`${id}-people`}
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              value={people}
              placeholder="How many people now?"
              aria-describedby={`${id}-people-hint`}
              onChange={(e) => setPeople(e.target.value)}
              className={cx(FIELD, "num h-12 min-h-12 min-w-0 flex-1 py-0")}
              disabled={!enabled}
            />
            <button type="submit" className={cx(BIG_BUTTON, SECONDARY, "shrink-0 px-4")} disabled={!enabled || !peopleOk}>
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
    <main data-phase={run.phase} className="mx-auto w-full max-w-[720px] flex-1 px-4 pb-24 pt-8 text-[17px] sm:px-6 sm:pt-20 lg:max-w-[1200px] lg:px-8 lg:pt-16">
      <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[44px]">Plan the food for your event</h1>
      <p className="mt-3 max-w-[46ch] text-[17px] leading-relaxed text-muted sm:mt-4 sm:text-[19px]">Tell us what you need. We ask food places and delivery companies, then put a plan together. You decide.</p>
      {/* Below lg: one column, steps in order. lg and up: step 1 sticks on the left; steps 2 and 3 stack on the right. */}
      <div className="mt-10 grid gap-6 sm:mt-14 lg:grid-cols-12 lg:items-start lg:gap-x-8">
        <div className="lg:sticky lg:top-[88px] lg:col-span-5">
        <AskStep
          key={`${run.id}:${run.requestVersion}`}
          run={run}
          busy={busy}
          onFind={async (input, changed) => {
            if (changed && !(await onSubmit(input))) return;
            await onConfirm();
          }}
        />
        </div>
        <div className="grid gap-6 lg:col-span-7">
          <PlanStep run={run} gate={gate} pending={pending} onApprove={onApprove} onBudget={onBudget} />
          <ChangeStep key={`${run.id}:${run.requestVersion}:${activePlan(run)?.revision ?? 0}`} run={run} pending={pending} onDisrupt={onDisrupt} />
        </div>
      </div>
    </main>
  );
}
