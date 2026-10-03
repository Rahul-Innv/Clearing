# Contributing to Clearing

Thanks for your interest. Clearing is a hackathon demo of self-forming, self-repairing markets
for event supply. Please read the guardrails below before opening a PR; they are what keep the
demo honest.

## Ground rules (non-negotiable)
- **Every run stays labelled.** Never remove or soften the "Demo suppliers · Local rules ·
  Simulated orders" badge. "MARKET CLEARED" means a feasible proposed solution exists for the
  modelled requirements. It never means a reservation, purchase, or delivery happened.
- **Measured facts only.** Never show fabricated probabilities, confidence scores, savings,
  throughput, or reliability metrics. Cost, capacity, slack, candidates checked, changed
  selections, and solver time are the only numbers the UI may show.
- **Integrations are unverified until proven.** Never claim Anthropic live mode, Novita, Tavily, Moss,
  ZooWork, or BAND is connected without a real credential and a real successful call recorded
  as an event.
- **The solver owns the numbers.** Models never own IDs, revisions, totals, authorization, or
  event sequence numbers. All money is integer cents with fees itemised. Seller policy
  (`Merchant.policy`) must never reach the buyer, the UI, or a buyer prompt.
- **One schema source.** `src/lib/contracts.ts` is the single schema source; change it
  deliberately and update `docs/LLD.md` alongside.
- **Approval is the organizer's act.** Every changed package needs fresh approval. Mutating
  commands are idempotent by key and use optimistic `run.version`.
- **No new runtime dependencies** without an issue agreed first.

## Dev setup
- Requires Node ≥ 22.13 (uses the built-in `node:sqlite`). No credentials needed.
- Install: `npm ci`
- Run the tests: `npm test` (Vitest)
- Full gate before a PR: `npm run check` (typecheck, lint, test, build)
- Dev server: `npm run dev` on http://localhost:3100
- Everything runs offline in local mode: fictional demo suppliers, local rules, simulated
  orders. Nothing is bought, reserved, or sent, and no external service is called unless you
  set a key in `.env.local` (never in `.env.example`).
- End-to-end tests (`npm run test:e2e`) use the pre-installed Chromium. Do not run
  `playwright install`.

## Making a change
1. Fork and create a branch (`git checkout -b my-change`).
2. Make a focused change that matches the surrounding style.
3. **Add or update tests** and make sure `npm run check` passes.
4. Open a pull request describing **what** changed and **why**, and note any guardrail it
   touches.

### Commit checklist
- [ ] `npm run check` passes.
- [ ] `src/lib/contracts.ts` changes are mirrored in `docs/LLD.md`.
- [ ] No new dependencies (or an issue agreed one).
- [ ] No secrets staged: `git status` shows no `.env.local` / keys / `*.pem` / `*.key`.
- [ ] The demo badge and honesty rules above are intact.

## Reporting bugs & security issues
Open an [issue](../../issues) for bugs and ideas. For anything security-sensitive, follow
[SECURITY.md](SECURITY.md) instead of a public issue.
