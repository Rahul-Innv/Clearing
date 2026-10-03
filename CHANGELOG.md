# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Organizer console: brief → extracted requirements → market → deterministic clearing →
  approval, with every run labelled "Demo suppliers · Local rules · Simulated orders".
- Two bounded negotiation rounds that change real terms (ready times, volume pricing).
- Disruptions (supplier cancels, delivery delayed, headcount changes) with repair ranked by
  fewest changes, then exposure, then slack, and the exact gap shown when no plan fits.
- Agent front door at `/api/agent` (submit, confirm, read plans; approval stays with the
  organizer unless `CLEARING_AGENT_CAN_APPROVE=true`).
- Attendee opt-in link collecting Vegetarian / Flexible counts plus party size, no personal
  data.
- Supply assembly: up to two kitchens plus a courier form one package when no single kitchen
  can serve the headcount.
- Browser-runtime mode (`NEXT_PUBLIC_CLEARING_RUNTIME=browser`) for a credential-free host
  such as Vercel: the market simulation runs on-device and state lives in `localStorage`.
- Optional serverless store on Supabase Postgres (`CLEARING_STORE` + `SUPABASE_DB_URL`);
  SQLite via `node:sqlite` otherwise.
- Env-flagged integrations: ZooWork reasoning and Tavily web discovery configured on the demo
  machine; Anthropic live mode, Novita, BAND and Moss implemented but not configured. Each is
  reported as "not connected" or unverified until a real successful call is recorded as an event.
- Novita AI reasoning transport (`CLEARING_REASONING=novita`, OpenAI-compatible Chat Completions),
  offline-tested and shown as unverified until a schema-valid reply is recorded.
- Simple view readable for anyone, with a desktop layout.
- 347 Vitest tests and Playwright journeys for the server and browser runtimes.
- Open-source governance: CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, issue and PR templates,
  and a CI workflow.
- README: CI, license and Node badges, a how-it-works diagram, contributing and security
  pointers, and a corrected test count (347 across 19 files).
- ROADMAP.md stating the deliberate current scope, near-term work, and non-goals; SUBMISSION.md
  test count corrected and the team and video placeholders filled.

- Dockerfile and Render blueprint for the hosted server mode; a `/market` page with the market
  graph; Simple view cards, stat tiles and plan rows.

[Unreleased]: https://github.com/Rahul-Innv/Clearing/commits/main
