# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via GitHub's **Private vulnerability reporting**: the repo's **Security** tab →
**Report a vulnerability**. If that isn't available, open a minimal public issue saying *only*
that you'd like a private security contact (no details), and the maintainer will set up a
channel.

Include: what the issue is and where, how to reproduce it, and the potential impact.

This is a single-maintainer hackathon demo, so responses are best-effort, but security reports
are taken seriously and prioritized over features.

## Supported versions
Only the current `main` branch is supported.

## Secrets & security posture
- Secrets live only in `.env.local` and host environment variables, **never committed**.
  `.env.example` holds empty placeholders only. `.env`, `.env.*` (except `.env.example`),
  `*.pem`, and `*.key` are gitignored.
- If a key is ever exposed, **rotate it immediately**; treat anything that touched a commit,
  log, or transcript as compromised.
- Server-side keys (Anthropic, Novita, Tavily, Moss, ZooWork, BAND, Supabase) never reach the browser.
  The browser-runtime build used for the public demo runs with no credentials at all and
  answers 501 on every `/api` route.
- The agent front door (`/api/agent`) cannot approve a plan unless
  `CLEARING_AGENT_CAN_APPROVE=true` is set explicitly; approval stays with the organizer.
- Merchant descriptions, retrieved web pages, and discovery results are treated as untrusted
  data: they are never executable offers and are escaped before rendering.
