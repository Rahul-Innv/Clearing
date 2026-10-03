# Roadmap

Clearing is a hackathon build. This file states what is deliberately in scope today, what comes
next, and what this build will never claim. Everything here matches the honesty box in
[SUBMISSION.md](SUBMISSION.md); update both together.

## Current scope (deliberate)
- **Fictional demo catalog, local rules, simulated orders.** Every run is labelled on four axes
  (reasoning, supply, coordination, execution). "MARKET CLEARED" means a feasible proposed
  solution exists for the modelled requirements, never that anything was reserved or bought.
- **Deterministic clearing and repair.** The solver owns every total, feasibility check, ID,
  revision, and event sequence number. The optional language model only extracts requirements
  and suggests counteroffer levers.
- **Public demo runs in the browser.** The hosted site uses the browser runtime (organizer
  console only, state in `localStorage`, every `/api` route answers 501). The full server mode
  (agent front door, attendee links, SSE) needs one long-lived Node process or the Supabase
  Postgres store.
- **No organizer login.** Runs are per device in browser mode and per SQLite file in server
  mode.
- **Integrations are wired but unverified live.** Anthropic live reasoning, Novita, ZooWork, BAND,
  Moss, and Tavily each have an adapter with offline tests and sit behind env flags. Each is
  reported as "not connected" until a real successful call is recorded as an event.

## Near-term
- Live-verify each integration with a real credential and record the successful call as an
  event, starting with `npx tsx scripts/zoowork-verify.mts` for ZooWork.
- Console fixes observed in an organizer walkthrough: the "Supplier cancels" dropdown
  preselects a live supplier once a plan is approved (one stray click cancels the wrong one),
  and the discovered-suppliers panel promises "Runs at market open" before clearing but then
  reports that no discovery result was recorded.
- Keep the test counts in README, SUBMISSION.md, and BUILD_PLAN.md in step with the suite.

## Later
- A real supplier-side surface, so sellers are more than deterministic policy functions.
- Organizer accounts, so a run can be shared across devices.

## Non-goals for this build
- Real purchases, reservations, deliveries, or payments of any kind.
- Fabricated probabilities, confidence scores, savings, throughput, or reliability metrics.
- Any model-owned total, authorization, or event ordering.
