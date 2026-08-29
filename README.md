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

Useful scripts:

| Command                | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `pnpm test:react`      | React behavior tests (jsdom)             |
| `pnpm test:domain`     | Pure domain tests (Node)                 |
| `pnpm test:convex`     | Convex authorization/database tests      |
| `pnpm e2e`             | Chromium journeys and axe checks         |
| `pnpm smoke:convex`    | Disposable live dev ingestion flow       |
| `pnpm smoke:fireworks` | One synthetic offer through Fireworks AI |
| `pnpm typecheck`       | TypeScript                               |
| `pnpm lint`            | ESLint                                   |
| `pnpm build`           | Production frontend build                |

`pnpm smoke:convex` requires a configured development deployment and Convex Auth. It creates only synthetic data and deletes its workspace before finishing; it is not part of pull-request CI.

`pnpm smoke:fireworks` requires `FIREWORKS_API_KEY` and `FIREWORKS_MODEL` in the Convex development environment. It uses a synthetic document and is never part of pull-request CI.

## Deploy

When you are ready to publish AidLens:

1. Ensure Convex Auth and site hosting are configured for this project.
2. Set dashboard environment variables from `.env.example` (vendor keys later).
3. Deploy with the scaffold-supported Convex flow, typically:

```bash
npx convex deploy
```

4. Confirm the deployed site shows the **AidLens** heading and primary CTAs.

Do not commit secrets or generated credentials. See [hackathon.md](./hackathon.md) for the product pitch.
