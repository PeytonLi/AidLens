# AidLens — New All Gas Hackathon

**AidLens** turns messy college financial-aid offers into an evidence-backed comparison: students upload or forward two to four letters, see grants vs loans and estimated four-year cost with every figure cited, then draft and approve clarifying emails to schools and update the comparison when replies arrive—student-controlled, not an adviser or recommender.

## Stack (substantive use)

| Sponsor          | Role in the product loop                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Convex**       | Auth, workspace isolation, typed schema, storage retention, scheduled jobs, HTTP webhooks, and `convex.site` hosting for the Vite frontend. |
| **Fireworks AI** | Vision extraction of offer PDFs/images into structured line items (cents, categories, renewal hints). Students review before comparison.    |
| **Firecrawl**    | Search and scrape **official school domains only** for cost/aid evidence that backs clarification questions.                                |
| **AgentMail**    | Per-user forwarding inbox, approved outbound school email, inbound reply ingest. Send happens only after explicit **Approve and send**.     |

## Demo path (judges)

1. Open `/` → **Try the sample** → UCSD vs Loyola synthetic comparison (no login).
2. Toggle **Conservative** / **Optimistic**; open offer and official sources.
3. Sign in → upload two offers → review extraction → **Compare my offers**.
4. Open unresolved questions → edit draft → **Approve and send**.
5. Ingest a controlled reply → **Confirm update** (or **Keep unresolved**).
6. Mark **Your decision** without any AidLens ranking or “best school.”

## Trust boundaries (summary)

- Public: landing, `/sample`, `/auth`. Sample has **no** mutation controls.
- Private queries/mutations require the signed-in workspace owner (`requireActiveWorkspace`).
- Provider actions and webhooks are internal/HTTP with generation stamps so deleted workspaces cannot be revived.
- Money is integer cents; gift aid reduces net price; loans and work-study never do.

## Release checklist (founder)

- [ ] Convex Auth + production env vars from `.env.example` (never committed).
- [ ] `pnpm check` and Chromium E2E green locally.
- [ ] Dev live smokes with `RUN_LIVE_SMOKE=1`: `smoke:convex`, `smoke:fireworks`, `smoke:firecrawl`, `smoke:agentmail` (or `smoke:all`).
- [ ] Deploy (`npx convex deploy`) and confirm public `convex.site` URL.
- [ ] Manual a11y pass: keyboard, 200% zoom, 320px width, contrast, reduced motion.
- [ ] Sub-3-minute demo video of the path above.
- [ ] LinkedIn or X post tagging sponsors.
- [ ] Submit repo, live URL, and video before the hackathon deadline.

Operational prerequisites (API keys, controlled demo recipient) are founder-owned; the codebase gates live smokes behind `RUN_LIVE_SMOKE=1` and never stores secrets in the repo.
