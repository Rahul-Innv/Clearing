# Clearing: AI Commerce Gallery submission

**Your event. Supplied. Even when plans change.**

## 1. Pitch

Clearing is an AI organizer with a marketplace behind it. Describe an already-booked gathering; supplier offers compete and are negotiated into one feasible, fully priced package; the organizer approves; and when a supplier cancels or headcount changes, Clearing repairs the plan and asks for fresh approval.

## 2. The problem and who pays

Organizers of small events (hackathons, meetups, team dinners) coordinate food, drinks and delivery by text, then redo it when a caterer cancels or attendance moves. The small caterers and couriers who supply them are hard to find and quote one request at a time.

- **Revenue (suppliers):** get found and compete for whole packages, not single orders.
- **Efficiency (organizers):** one brief replaces a thread of texts; changes are re-planned, not renegotiated by hand.
- **Risk:** feasibility (budget, deadline, dietary coverage) is validated, and nothing is ordered without explicit organizer approval.

These are the lines Clearing is designed to move. This build measures none of them; it shows only cost, capacity, slack and candidates checked.

## 3. What Clearing is

A market mechanism, not a chatbot: **request, competing offers, bounded negotiation that changes real terms** (ready times, volume prices), **deterministic clearing** (the solver owns totals and feasibility, never a model), **approval, disruption, repair, re-approval.**

- **Agent front door:** a personal agent can submit, confirm and read through `/api/agent`. Approval stays with the organizer (403 by default).
- **Attendee opt-in:** a shareable link collects Vegetarian or Flexible plus party size, with no personal data; the organizer applies the counts.
- **Supply assembly:** when no single kitchen can serve the headcount, up to two kitchens plus a courier form one package.

## 4. Live demo for judges (90 seconds)

Setup: open the hosted browser-runtime build at https://clearing-pied.vercel.app and press **Reset**
(organizer console only; per-device state). For the agent front door and attendee links run the
server mode locally: `npm run build && npm start`, open http://localhost:3100, press **Reset**.

1. **(0:00)** Preset: dinner for 60, at least 20 vegetarian, drinks, plates, utensils, ready by 6:30 PM, max $1,000. Click **Confirm requirements**.
2. **(0:10)** Suppliers quote; Harbor Kitchen declines (minimum 75). Round 0 has no feasible plan; rounds 1 and 2 change real terms.
3. **(0:25)** **MARKET CLEARED, $784.40**: Golden Hour $565.40 + Bodega Marquez $147.00 + Pelican $72.00. Click **Approve simulated orders**.
4. **(0:35)** **Simulate supplier cancellation** on Golden Hour. **PLAN RECOVERED, $994.14**: Juniper & Rye $803.14, Bodega kept, Swiftline $44.00 replaces Pelican (the panel explains keeping Pelican would exceed budget: the courier is widened). Approve; only changed orders are re-placed.
5. **(0:55)** Set headcount to 85. **NO FEASIBLE PLAN**: the cheapest valid option is $1,143.57, **$143.57** over budget; dietary needs are never relaxed. Click **Raise budget to $1,143.57**: the plan recovers at $1,143.57.
6. **(1:15)** Reset, then 130 attendees with a $2,600 budget. No kitchen serves 130 alone (max 120), so two assemble: Harbor 120 + Golden Hour 20-meal top-up + Bodega + Pelican, **$1,858.02**, one approval. Rehearse this step; it edits the request.

The numbers are computed by the solver, not scripted.

## 5. Honesty box

**Real:** the deterministic solver and negotiation, integer-cent money, idempotent commands with optimistic versioning, an append-only event log in local SQLite, approval gating, persistence across refresh.

**Simulated:** every supplier is fictional (demo catalog); orders, charges and refunds are simulated. MARKET CLEARED means a feasible proposed solution for the modelled requirements, never a reservation, purchase or delivery. Seller "agents" are deterministic policy functions; a real supplier-side surface is the next step.

**Reasoning:** local rules by default. The live-model adapter (request interpretation and counteroffer lever choice only) is implemented and unit-tested with a fake transport. For the demo it runs on **ZooWork Managed Agents** (`CLEARING_REASONING=zoowork`, key configured on the team's demo machine); the app's Integrations panel reports "live-verified" only after a real successful call is recorded as an event, and that panel is the evidence. The hosted browser demo always runs local rules.

**Integrations, exactly as BUILD_PLAN §2 states:**

| Integration | Status |
|---|---|
| Live model (Anthropic) | not used for the demo; adapter offline-tested only |
| ZooWork | **configured for the demo** (`CLEARING_REASONING=zoowork` + `ZOOWORK_API_KEY` on the demo machine): the planner/buyer role runs on a ZooWork Managed Agent (SDK 0.10.2). Offline-tested in CI; the live status is shown in the app (Integrations panel, "live-verified this process" after the first successful call) and by `npx tsx scripts/zoowork-verify.mts`. Not verified in the build environment, which had no network access to ZooWork |
| BAND | adapter implemented: buyer agent posts asks into a BAND room, seller agents answer by @mention as separate processes, replies are re-priced against policy before use; offline-tested (16 tests); **not live-verified** (needs registered BAND agents) |
| Moss | supplier discovery over a fictional directory via Moss hybrid search; results are unverified candidates, never offers; offline-tested; **not live-verified** (needs MOSS_PROJECT_ID/KEY) |
| Tavily | **configured for the demo** (`TAVILY_API_KEY` on the demo machine): web discovery appended to the Discovered suppliers panel as unverified candidates with source URL and retrieval time, never as offers. Offline-tested in CI; the live result is visible in the panel and recorded as a discovery event. Not verified in the build environment |

Setup for each is documented. ZooWork, BAND, Moss, Tavily and Novita are wired into the real pipeline behind the same validation as every other external source. ZooWork and Tavily are configured on the demo machine; BAND, Moss and Novita are implemented but not configured. Each is claimed only to the extent the running app records a successful call. Entire is configured at the repo level (`.entire/settings.json`) and must be enabled from a developer machine. Other limits: no organizer login; the public deployment is the browser-runtime demo mode (console only, no agent API or attendee links), and the full server mode needs one long-lived Node process or the Supabase mode.

## 6. Judging criteria

1. **Approach & Idea:** gives the organizer's personal agent a market to act in, for a real chore (event supply), with approval kept human.
2. **Technical Execution:** the primary features run live locally with no credentials; the solver is deterministic and every command is idempotent and verified by tests.
3. **Presentation:** a 90-second path with real, recomputable numbers, and honesty framing said aloud.
4. **Design:** an operations console with three clear states, an exact gap plus a one-click fix, an offer drawer showing why a supplier lost, and a phone-sized attendee page. Desktop and mobile are browser-tested.
5. **X-Factor:** the repair that explains itself, an honest "no" with the exact $143.57 gap, and two kitchens assembled when none can serve alone.

## 7. Run and verify

```bash
npm install                     # Node >= 22.13, no credentials
npm run dev                     # http://localhost:3100
npm run typecheck && npm run lint
npm test                        # 347 unit tests, 19 files
npm run build && npm start
npm run test:e2e                # Playwright: 13 passed, 1 skipped by project filter
```

Counts are as recorded in BUILD_PLAN §5; re-run before presenting. Do not run `playwright install`.

## 8. Team and links

- Team: Clearing
- Repo: https://github.com/Rahul-Innv/Clearing (branch main)
- Hosted demo (browser runtime, organizer console): https://clearing-pied.vercel.app
- Demo video: none; the hosted demo and DEMO_SCRIPT.md stand in
