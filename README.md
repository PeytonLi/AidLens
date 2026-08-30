# AidLens

Evidence-backed financial-aid offer comparison for U.S. college students.

## Requirements

- Node.js 20 or 22 LTS
- [pnpm](https://pnpm.io) (version pinned via `packageManager` in `package.json`)

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Set `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` from `pnpm dev` or the Convex dashboard. Vendor API keys belong in the Convex environment, not in Vite env files.

## Develop

```bash
pnpm dev
```

Starts Convex and Vite together.

## Quality gate

```bash
pnpm check
```

Runs format check, typecheck, lint, unit/behavior tests, and production build.

Pull-request CI also runs Chromium Playwright for the public sample and signed-out private-route boundaries (`pnpm e2e:sample`, `pnpm e2e:auth`).

Useful scripts:

| Command                | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `pnpm test:react`      | React behavior tests (jsdom)                                    |
| `pnpm test:domain`     | Pure domain tests (Node)                                        |
| `pnpm test:convex`     | Convex authorization/database tests                             |
| `pnpm test:contract`   | Provider contract fixtures (Fireworks / Firecrawl / AgentMail)  |
| `pnpm test:eval`       | Extraction fixture regression (`convex/lib/fireworks.test.ts`)  |
| `pnpm e2e`             | Chromium journeys and axe checks                                |
| `pnpm e2e:sample`      | Public sample journey (CI)                                      |
| `pnpm e2e:auth`        | Signed-out private routes + approval-safety (CI)                |
| `pnpm smoke:convex`    | Disposable live dev ingestion flow                              |
| `pnpm smoke:fireworks` | One synthetic offer through Fireworks AI                        |
| `pnpm smoke:firecrawl` | Official-domain Firecrawl search (requires `RUN_LIVE_SMOKE=1`)  |
| `pnpm smoke:agentmail` | Controlled AgentMail inbox create (requires `RUN_LIVE_SMOKE=1`) |
| `pnpm smoke:all`       | All development-deployment smokes                               |
| `pnpm typecheck`       | TypeScript                                                      |
| `pnpm lint`            | ESLint                                                          |
| `pnpm build`           | Production frontend build                                       |

Live smokes require a configured development deployment and Convex Auth / vendor keys. They create only synthetic or disposable data where possible and are **not** part of pull-request CI.

## Product surfaces

| Route                  | Access  | Notes                                                                |
| ---------------------- | ------- | -------------------------------------------------------------------- |
| `/`                    | Public  | Landing CTAs                                                         |
| `/sample`              | Public  | UCSD / Loyola synthetic comparison; no mutations                     |
| `/auth`                | Public  | Convex Auth email/password + 18+ confirmation                        |
| `/workspace`           | Private | Upload, offers, questions, delete workspace                          |
| `/compare`             | Private | Private comparison; Conservative / Optimistic                        |
| `/decision`            | Private | Student marks current choice; AidLens never ranks schools            |
| `/schools/:id`         | Private | Official-page research evidence                                      |
| `/questions/:id/draft` | Private | Draft, **Approve and send**, **Confirm update**, **Keep unresolved** |

## Deploy

When you are ready to publish AidLens:

1. Ensure Convex Auth and site hosting are configured for this project.
2. Set dashboard environment variables from `.env.example` (vendor keys never in git).
3. Deploy with:

```bash
npx convex deploy
```

4. Confirm the deployed site shows the **AidLens** heading and primary CTAs.
5. Run `pnpm smoke:all` against the development deployment before promoting production credentials.
6. Complete the founder checklist in [hackathon.md](./hackathon.md).

Do not commit secrets or generated credentials. Trust boundaries are summarized in [docs/TRUST_BOUNDARIES.md](./docs/TRUST_BOUNDARIES.md). See [hackathon.md](./hackathon.md) for the product pitch and founder release checklist.
