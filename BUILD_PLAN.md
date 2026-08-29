# AidLens Build Plan

**Status:** Founder-approved; detailed implementation contract complete; implementation not started  
**Source of truth:** [PRD.md](PRD.md)  
**Method:** Vertical-slice TDD, one failing behavior at a time  
**Package manager:** `pnpm`  
**Repository:** [PeytonLi/AidLens](https://github.com/PeytonLi/AidLens) (public, `main`, no application commit yet)

## 1. Build outcome

Ship a public `convex.site` app where:

1. Anyone can run a read-only synthetic comparison.
2. An authenticated adult can upload or forward two offers.
3. AidLens extracts and cites each amount, then asks the user to review uncertain fields.
4. Deterministic code compares annual and conservative four-year costs.
5. Firecrawl finds official school evidence for missing terms.
6. The user approves a clarification email.
7. AgentMail receives the school reply and the comparison updates after user confirmation.
8. Private data stays private and raw files disappear after seven days.

## 2. Decisions locked for implementation

- React + Vite + TypeScript frontend.
- Convex for auth, database, files, reactive state, HTTP endpoints, schedules, and durable work.
- Convex Auth with email and password for the MVP. This avoids adding another vendor solely for magic links.
- Fireworks AI's OpenAI-compatible Chat Completions API with strict `json_schema` outputs and vision page images.
- Firecrawl for targeted official-domain search and scrape.
- AgentMail for forwarding inboxes and approved school threads.
- Vitest for pure logic, React behavior, and Convex function tests.
- `convex-test` for Convex queries, mutations, identities, and scheduled work it can simulate.
- Playwright on Chromium for a small set of critical end-to-end flows.
- No custom queue, ORM, state-management library, component library, storage provider, or analytics service.
- Product direction is deliberately locked to two-to-four-offer comparison. The research brief's alternative bill-reconciliation recommendation remains market context, not implementation scope.
- The demo institutions are UC San Diego and Loyola University Maryland. Their offer documents and all student data are fictional; only official-school web evidence is real.

The demo-institution decision above supersedes the fictional North Valley/Lakeside names in PRD Section 21; no other PRD scope is changed.

Package versions are selected and locked when the project is scaffolded, not guessed in this plan.

## 3. What already exists

| Existing artifact | Reuse |
|---|---|
| [PRD.md](PRD.md) | Product behavior, calculations, states, acceptance criteria, demo, and cut order. |
| [research/aidlens-research.md](research/aidlens-research.md) | Canonical terminology, official sources, competitor context, privacy limits, and integration facts. |
| Application code | None. Git is initialized on `main`, the public `origin` exists, and there is no scaffold or application commit yet. |
| Test infrastructure | None. It will be installed with the first application slice. |

## 4. Scope challenge

The full PRD is larger than one safe implementation change. Build it as ten deployable vertical slices, numbered 0 through 9. Each slice must end GREEN, produce observable behavior, and leave the deployed app usable.

The minimum winning loop is:

```text
synthetic comparison
        |
private upload -> reviewed extraction -> comparison
        |                                  |
        +-> official evidence -> approved question
                                      |
                                 school reply
                                      |
                               confirmed update
```

Anything not on that path is deferred. The codebase will exceed eight files because it is a full-stack application, but it should stay within a few cohesive modules rather than creating a service class for every noun in the PRD.

## 5. Architecture

### 5.1 Runtime data flow

```text
Browser
  |
  | query / mutation / upload
  v
Convex functions ---- ownership guard on every private operation
  |       |
  |       +---------------------> Convex storage (raw file, <= 7 days)
  |
  +--> durable processing workflow
         |
         +--> Fireworks action ---> strict offer extraction
         |
         +--> Firecrawl action ---> official pages + citations
         |
         +--> mutations ----------> reviewed structured records
                                      |
                                      v
                              reactive comparison UI

AgentMail webhook -> verified Convex HTTP endpoint -> idempotent event mutation
       |                                             |
       +-- received attachment/message -------------+
       +-- school reply -> proposed answer -> user confirmation -> recalculation
```

### 5.2 Module boundaries

Keep boundaries boring and shallow:

- `src/domain/`: pure aid categories, money calculations, four-year projections, and presentation-ready comparison facts.
- `src/features/`: public sample, authentication, workspace, offer review, comparison, sources, and clarification UI.
- `convex/`: schema plus owner-scoped functions grouped by offers, processing, sources, and email.
- `convex/lib/`: only shared ownership, validation, and idempotency helpers that have multiple callers.
- `test/fixtures/`: synthetic offers, extraction responses, official-page responses, and school replies.
- `e2e/`: only critical deployed-like user journeys.

Do not create interfaces with one implementation or generic repositories around Convex.

### 5.3 State machines

```text
DOCUMENT
received -> validating -> extracting
extracting -> needs_school_confirmation | researching | failed
needs_school_confirmation -> researching | failed
researching -> needs_review | ready | failed
needs_review -> ready
failed -> failed_stage after explicit retry

QUESTION
open -> awaiting_reply -> reply_received -> awaiting_user_confirmation
awaiting_user_confirmation -> resolved | partially_resolved | open

OUTBOUND MESSAGE
drafting -> awaiting_approval -> queued -> sent -> delivered
queued | sent -> failed | bounced
```

State transitions belong in one mutation per state machine. Do not let UI components write arbitrary status strings.

## 6. TDD operating rules

Every slice uses this loop:

1. **RED:** Write one behavior test through the narrowest public interface that proves the next capability.
2. Run that one test and verify it fails for the intended reason.
3. **GREEN:** Add only enough code to pass it.
4. Run the focused test, then all tests affected by the slice.
5. Add the next behavior test only after GREEN.
6. **REFACTOR:** Remove duplication or deepen a module only while all tests pass.
7. Run typecheck, lint, unit/integration tests, and the relevant Playwright flow before closing the slice.

Tests verify behavior, not internal function calls. External vendors are replaced with deterministic fixture responses in automated tests. One live smoke test per vendor is run separately against the development deployment after credentials exist.

### Test layers

| Layer | Tool | Responsibility |
|---|---|---|
| Pure domain | Vitest, Node environment | Money math, categorization, assumptions, discrepancies, state-transition rules. |
| Convex functions | Vitest + `convex-test`, edge-runtime project | Authorization, CRUD behavior, indexes, idempotency, schedules, and reactive state changes. |
| React behavior | Vitest + jsdom + Testing Library | What the user sees, edits, approves, retries, and cannot submit. |
| AI quality | Fixture-based eval tests | Required schema, category accuracy, source evidence, refusal to guess, prompt-injection resistance. |
| Browser flow | Playwright, Chromium | Public sample, private upload/review/compare, approval safety, deletion. |
| Live integration smoke | Manual or explicit non-CI command | Real Fireworks AI, Firecrawl, AgentMail, Convex workflow, and deployed webhook behavior. |

`convex-test` does not run Node-only Convex actions faithfully. Test the deterministic code and database transitions locally; cover Node actions with mocked fetch contract tests plus one development-deployment smoke test.

## 7. Dependency-ordered implementation slices

### Slice 0: Repository, scaffold, and quality gate

**User-visible result:** The deployed shell loads and says the sample is coming next.

**RED**

- A React behavior test expects the AidLens headline and **Try the sample** action.

**GREEN**

- Preserve the initialized Git repository and merge the current official `pnpm create convex@latest` React/Vite/TypeScript/Convex Auth scaffold into it without overwriting the approved documents.
- Add Vitest projects for Node domain tests, jsdom React tests, and edge-runtime Convex tests.
- Add Playwright with Chromium and a Vite web-server configuration.
- Add formatting, typecheck, lint, test, coverage, and E2E scripts.
- Add a GitHub Actions workflow for install, typecheck, lint, and tests. E2E joins CI after the sample flow exists.
- Add `.env.example`, secret-safe `.gitignore`, `README.md`, and required `hackathon.md`.

**Exit checks**

- Fresh clone can run `pnpm install`, `pnpm test`, and `pnpm build`.
- No secrets or generated Convex credentials are tracked.
- The first UI test and production build pass.

### Slice 1: Deterministic aid engine

**User-visible result:** None alone; this is the one deep module every later comparison uses.

Add behaviors one at a time:

1. Grants and scholarships reduce net price.
2. Loans never reduce net price.
3. Work-study never reduces net price or default funding gap.
4. Missing required costs mark a total incomplete rather than using zero.
5. One-time aid ends after year one.
6. Unknown renewal ends after year one in the conservative scenario.
7. Confirmed renewable fixed aid carries for its stated duration.
8. Currency uses integer cents and displayed formulas reconcile exactly.
9. Offers with mismatched periods or assumptions emit comparison warnings.

**RED**

- Write the first pure test against the exported comparison function.

**GREEN**

- Implement one pure domain module and typed inputs/outputs.
- Add each behavior through a new RED/GREEN cycle.

**Exit checks**

- Branch and statement coverage are 100% for the money module.
- Table-driven fixtures cover boundaries, negative net price, unknown values, and four-year duration.

### Slice 2: Public synthetic comparison tracer bullet

**User-visible result:** A judge can open a read-only two-school comparison without signing in.

**RED**

- Playwright opens `/sample`, sees two fictional offers, and verifies gift aid, loans, annual net price, and conservative four-year totals.

**GREEN**

- Store one immutable synthetic case in code or a public Convex seed query, whichever is smaller after scaffold inspection.
- Render the comparison through the real domain engine.
- Add source labels, Preliminary/Reviewed state, and an explicit synthetic-data banner.
- Make public mutations impossible for the sample.

**Exit checks**

- Chromium sample flow passes without authentication.
- Keyboard navigation reaches all comparison rows and source details.
- No loan or work-study appears as gift aid.

This is the first deploy checkpoint.

### Slice 3: Private account and workspace isolation

**User-visible result:** An adult can register, confirm age, sign in, and see an empty private workspace with an upload prompt.

Add behaviors one at a time:

1. Anonymous users cannot query private workspaces.
2. User A cannot read, mutate, or delete User B's workspace.
3. The age confirmation is required before workspace creation.
4. Signed-out clients stop rendering private content.
5. Owner can delete the workspace; access stops immediately and late work cannot restore it.

**RED**

- Use `convex-test.withIdentity()` to prove cross-user access is rejected.

**GREEN**

- Configure Convex Auth email/password.
- Add one shared `requireUser`/`requireOwnedWorkspace` helper used by every private function.
- Add the private workspace shell.
- Add the base mark-deleting/delete-last workflow; extend its cascade whenever later slices add a private table.

**Exit checks**

- Authorization tests cover every private query and mutation added so far.
- Playwright verifies registration/sign-in and sign-out behavior using an isolated test account.
- The base deletion regression proves the workspace and all Slice 3 data become inaccessible.

### Slice 4: Upload, validation, status, and retention

**User-visible result:** A user uploads a supported offer and immediately sees a reactive processing card.

Add behaviors one at a time:

1. Valid PDF/JPEG/PNG up to 10 MB is accepted.
2. Unsupported, oversized, and encrypted inputs receive recoverable messages.
3. Upload creates a private document in `received`, then validation advances its state.
4. Invalid state transitions are rejected.
5. Raw file can be deleted immediately.
6. Scheduled cleanup deletes raw storage after seven days but preserves safe structured metadata.
7. Duplicate submission does not create two processing jobs.

**RED**

- A Convex test expects a valid owner-scoped document record and rejects another user.

**GREEN**

- Add storage upload URL flow, metadata validation, state-transition mutation, SHA-256/file-event idempotency, and scheduled cleanup.
- Render status through a reactive query.

**Exit checks**

- Scheduler test advances fake timers and confirms cleanup.
- Playwright uploads a fixture and sees status without arbitrary sleeps.
- Storage URLs are never placed in public query results.

### Slice 5: Fireworks AI extraction and human review

**User-visible result:** The uploaded offer becomes a source-backed editable review screen.

Add behaviors one at a time:

1. Strict extraction response validates before persistence.
2. Missing amount remains `unknown`, never zero.
3. Original label, canonical category, period, page/source excerpt, and confidence persist together.
4. Low-confidence calculation-critical fields appear first.
5. User correction recalculates the offer and records an audit event.
6. A failed/invalid model response retries once, then becomes a clear recoverable failure.
7. Prompt-like text in the document cannot request tools or outbound actions.

**RED**

- A fixture-based contract test feeds a realistic synthetic offer and expects the canonical schema and evidence.

**GREEN**

- Add a single Fireworks AI action using its OpenAI-compatible Chat Completions API, vision page images, and strict `json_schema` output. Render PDF pages to images before inference because direct document inlining is unsupported.
- Persist only after schema validation.
- Build document/field review with edit-and-confirm behavior.
- Add an eval corpus of at least three synthetic formats: clear table, ambiguous prose, and misleading loan/work-study presentation.

**Exit checks**

- Fixture evals hit the agreed category/evidence baseline.
- A live development smoke processes one synthetic PDF.
- User confirmation is required before an offer becomes Reviewed.

### Slice 6: Two-to-four-offer comparison

**User-visible result:** Reviewed offers update the real annual and four-year comparison live.

Add behaviors one at a time:

1. Comparison unlocks at two offers and caps at four.
2. Preliminary offers are visibly labeled.
3. Corrections update all affected totals reactively.
4. Conservative assumptions are visible and editable.
5. Mismatched period, housing, residency, or enrollment assumptions create warnings.
6. The app never labels a school best overall.
7. An explicitly labeled optimistic scenario carries conditionally renewable aid, while the conservative scenario remains the default.

**RED**

- A React behavior test edits one amount and expects the visible comparison to change using the deterministic engine.

**GREEN**

- Connect reviewed offer records to the comparison UI.
- Store user assumptions separately from extracted facts.
- Phrase only deterministic insight types.
- Add the optimistic toggle only after every conservative-path test is GREEN.

**Exit checks**

- Playwright completes upload fixture -> review -> second offer -> compare.
- All displayed totals trace to source facts or visible assumptions.

This is the second deploy checkpoint and the minimum usable product.

### Slice 7: Firecrawl official evidence and questions

**User-visible result:** AidLens cites official cost/renewal pages and creates focused unresolved questions.

Add behaviors one at a time:

1. Research cannot start until the user confirms school identity and official domain.
2. Only confirmed school domains and government sources are accepted as authoritative.
3. Search snippets are not evidence until the page is scraped.
4. URL, title, excerpt, retrieval time, and evidence type persist together.
5. Missing or conflicting evidence creates an unresolved question, not a guessed answer.
6. Crawl timeout/blocking produces a clear retry/manual-URL state.

**RED**

- A contract test supplies mixed official and unofficial search results and expects only confirmed-domain evidence.

**GREEN**

- Add one targeted Firecrawl action with a strict page limit and allowed-domain validation.
- Render live research progress and citations.
- Generate questions from deterministic triggers; Fireworks AI only phrases them.

**Exit checks**

- Fixture tests cover redirects, subdomains, lookalike domains, missing pages, stale retrievals, and conflicting evidence.
- Live smoke retrieves evidence from the two chosen demo schools.

### Slice 8: AgentMail approved clarification loop

**User-visible result:** The user edits and approves a real question, sees delivery state, receives a reply, confirms the answer, and sees the comparison update.

Add behaviors one at a time:

1. Every user receives one forwarding inbox.
2. Inbound offer attachments reuse the same validation/ingestion path as uploads.
3. Draft contains only verified case facts and defaults to an official school recipient.
4. Navigating away or closing the draft never sends.
5. One approval produces at most one outbound message.
6. Webhook signature and event idempotency are required before mutation.
7. Reply text creates proposed facts but never silently changes totals.
8. User confirmation updates facts, question status, comparison, and audit history together.
9. Delivery failure preserves the editable draft and offers a safe retry.
10. A webhook or provider action arriving after workspace deletion cannot recreate records or orphan files.

**RED**

- A React behavior test closes an unapproved draft and asserts no send request occurs.

**GREEN**

- Add AgentMail inbox creation, verified HTTP webhook, deduplicated message/thread storage, draft/approval mutation, send action, and reply proposal flow.
- Restrict default recipients to the confirmed school domain; warn before override.
- Require every asynchronous write to verify the workspace still exists and the offer/question version is current.

**Exit checks**

- Contract tests cover valid/invalid signatures, duplicate events, bounce, late reply, malicious reply text, and retry.
- Playwright verifies draft -> edit -> approve using a deterministic test endpoint.
- Live development smoke verifies real send and reply through AgentMail.

This is the hackathon-complete product loop.

### Slice 9: Security, accessibility, resilience, and release

**User-visible result:** The core product is safe, recoverable, polished, and publicly deployable.

**RED**

- Add failing regression tests for each issue found during the authorization, accessibility, and failure-state audit.

**GREEN**

- Audit every query, mutation, action, storage path, and webhook for ownership/idempotency.
- Re-audit whole-workspace deletion and prove every table, file, provider mapping, and late asynchronous path added since Slice 3 is covered.
- Sanitize email display, minimize logs, and add clear vendor/deletion disclosures.
- Complete keyboard, focus, color-independent status, responsive, reduced-motion, and live-region behavior.
- Add recoverable UI for vendor outages and stale data.
- Deploy to `convex.site`, finish `README.md`/`hackathon.md`, and record the sub-three-minute demo.

**Exit checks**

- CI is green from a fresh checkout.
- All Playwright critical paths pass without time-based waits.
- No real PII exists in repo, screenshots, logs, fixtures, or demo.
- Manual deletion and scheduled retention are verified on the deployment.
- Public app, repo, video, and social submission requirements are complete.

## 8. Test-path coverage plan

```text
CODE PATHS
===========
[UNIT] calculateComparison
  +-- gift aid / loans / work-study / unknowns
  +-- annual / four-year / renewal duration / growth assumption
  +-- mismatched periods and incomplete totals

[CONVEX] private workspace and documents
  +-- anonymous / owner / non-owner
  +-- valid / invalid state transition
  +-- first event / duplicate event
  +-- retained file / immediate deletion / scheduled deletion

[EVAL] Fireworks AI extraction and reply parsing
  +-- clear / ambiguous / misleading / malformed / injected input
  +-- schema valid / retryable invalid / permanent failure

[CONTRACT] Firecrawl and AgentMail actions
  +-- official / unofficial / redirect / missing / timeout
  +-- signed / invalid signature / duplicate / bounced / malicious reply

USER FLOWS
==========
[E2E] public sample -> inspect sources
[E2E] register -> age confirm -> private workspace -> sign out
[E2E] upload -> live status -> review -> correct -> confirm
[E2E] second offer -> compare -> change assumption
[E2E] question -> edit draft -> cancel (no send) -> approve once
[E2E] reply -> review proposed answer -> confirm -> recalculated comparison
[E2E] delete workspace -> private route no longer accessible
```

No path above is complete until its failure state is both tested and visible to the user.

## 9. Failure-mode audit

| Code path | Real production failure | Planned test | Handling | User sees |
|---|---|---|---|---|
| Authentication | Expired or missing session | Convex identity + Playwright sign-out test | Ownership guard rejects | Sign-in prompt, no leaked data |
| Upload | Unsupported, oversized, encrypted, or interrupted file | Validation and upload-flow tests | Reject or retry without starting workflow | Specific corrective message |
| Workflow | Same upload/message schedules twice | Idempotency test | Unique event/document key | One processing card |
| Storage cleanup | Schedule runs after file already deleted | Scheduled mutation test | Idempotent no-op plus audit | No error interruption |
| Fireworks AI | Timeout or schema-invalid output | Contract/eval test | One retry, then failed state | Retry action and unchanged facts |
| Extraction | Loan classified as grant | Golden fixture eval | User review plus category correction | Low-confidence flag and source |
| Comparison | Missing cost treated as zero | Pure domain test | Incomplete total | Unknown row and explanation |
| Firecrawl | Lookalike or unofficial domain returned | Allowed-domain contract test | Reject as authority | Unresolved question |
| Firecrawl | Target page times out or blocks | Timeout contract test | Retry/manual official URL | Clear degraded state |
| AgentMail send | Double-click or retried action sends twice | Approval idempotency test | One approval token/event key | One sent message |
| AgentMail webhook | Invalid signature or replay | Webhook tests | Reject or no-op | No false update; safe logged status |
| School reply | Reply includes prompt injection | Reply eval test | Treat content as data only | Proposed facts for review |
| Reply application | Two tabs confirm conflicting values | Mutation concurrency test | Transaction checks current version | Stale-update message and refresh |
| Deletion | Partial cascade or late async write recreates records | Owner/deletion and late-write integration tests | Cascade plus workspace/version guard on every async write | Completion or recoverable failure |
| Vendor outage | One integration is unavailable | UI degraded-state test | Preserve last confirmed data | Explicit stale/failed badge |

Critical silent gaps allowed: **zero**.

## 10. Performance budget

- Public sample interactive target: under 2 seconds on a normal broadband connection after deployment warm-up.
- Private workspace initial query: one owner-scoped aggregate query, not one query per school row.
- Comparison calculation: client or server pure computation over at most four offers; no caching layer needed.
- Fireworks AI: one extraction call per accepted document version.
- Firecrawl: targeted search plus a small page cap per school; cache citations by school URL and retrieval date.
- AgentMail: webhook-driven updates; no inbox polling loop.
- Raw document bodies and full crawled pages are not copied into Convex documents; persist only required excerpts and metadata.

Measure before adding caches or concurrency controls beyond provider limits and Convex workflow settings.

## 11. Parallelization strategy

Parallelism begins only after Slice 2 establishes schema conventions, domain types, test commands, and a stable sample UI. Before that, parallel agents would mostly create merge conflicts in a tiny repository.

| Workstream | Modules | Depends on |
|---|---|---|
| Foundation and aid engine | project config, `src/domain/`, test config | None |
| Public sample | `src/features/sample/`, `e2e/` | Aid engine |
| Auth and private workspace | `convex/auth*`, workspace functions, auth UI | Foundation |
| Upload and retention | offer/document Convex functions, upload UI | Auth/workspace |
| Extraction/review | processing actions, review UI, eval fixtures | Upload + aid engine |
| Comparison UI | comparison feature, E2E | Extraction + aid engine |
| Official evidence | source actions/functions, source UI, fixtures | School identity + extraction |
| Email loop | webhook/email functions, clarification UI, fixtures | Auth + questions |
| Release hardening | cross-cutting app/e2e/docs | All MVP slices |

Recommended lanes:

- **Lane A:** Foundation -> aid engine -> public sample -> auth -> upload -> extraction -> comparison. Sequential because these define shared contracts.
- **Lane B:** After extraction schema freezes, Firecrawl evidence fixtures and contract tests.
- **Lane C:** After question and ownership contracts freeze, AgentMail webhook/signature/idempotency tests.
- **Lane D:** After the sample route stabilizes, accessibility and visual polish without changing domain contracts.

Launch B, C, and D in parallel only at those gates. Merge B and C before the final email-resolution E2E. Lane A owns shared schema and generated Convex files; other lanes must not edit them without coordination.

For the initial build, one primary agent is faster. Subagents become useful for vendor contract tests, accessibility review, and final adversarial/security audit.

## 12. Checkpoints

| Checkpoint | Required evidence |
|---|---|
| A. Skeleton | Fresh install, test, and build succeed; shell deployed. |
| B. Judgeable sample | Public synthetic comparison Playwright test passes on deployed-like server. |
| C. Private ingestion | Cross-user authorization, upload, status, and deletion tests pass. |
| D. Usable comparison | Two real-format synthetic offers reach Reviewed and compare correctly. |
| E. Evidence | Official pages are cited and unsupported conclusions remain unresolved. |
| F. Closed loop | Approved email sends once; reply requires confirmation and updates comparison. |
| G. Submission | Security/accessibility audits green; public app, repo, log, video, and social post ready. |

Do not move to the next checkpoint with a RED test, broken deployment, or known private-data leak.

## 13. NOT in scope

- Parent or counselor sharing: adds roles and consent before the single-user path is proven.
- Magic-link auth: adds another outbound-email dependency; email/password satisfies the MVP.
- Tuition-bill reconciliation: researched and useful, but not the founder-selected headline MVP.
- Automatic appeals or follow-ups: too consequential for the first email loop.
- Portal login or credential handling: unacceptable privacy and security expansion.
- Loan repayment/interest forecasts: four-year borrowing totals are enough for this release.
- Continuous Firecrawl monitoring: one current evidence run per case is sufficient.
- Multi-browser E2E in CI: Chromium covers the hackathon critical path; add Firefox/WebKit after MVP stability.
- Native mobile, multilingual UI, exports, analytics vendor, and counselor dashboard: no impact on the winning loop.
- Custom design system or component library: style the small surface directly and revisit only if repetition appears.

## 14. Inputs needed from the founder

### Needed before vendor integration slices

1. **Hackathon registration:** confirmation that registration is complete so the project is eligible and Firecrawl credits are available.
2. **Convex account/project access:** a development and production deployment, or authorization for the build agent to create them.
3. **Fireworks AI API key with credits enabled:** stored locally and in Convex environment variables, never pasted into source files or chat.
4. **Firecrawl API key/credits:** from the registered hackathon account.
5. **AgentMail API key/account:** with permission to create inboxes and webhooks.
6. **GitHub destination:** complete — public repository created at `https://github.com/PeytonLi/AidLens` and connected as `origin`.
7. **Controlled demo recipient:** an inbox we are authorized to email and reply from while proving the live loop; staged demo messages must not go to an uninvolved college office.

### Needed before demo polish

8. **Two real schools for the synthetic demo:** complete — UC San Diego and Loyola University Maryland are approved. The offer documents remain fictional and clearly labeled synthetic.
9. **Optional redacted samples:** two to five real offer formats materially improve extraction evaluation. Remove names, addresses, student IDs, barcodes, SSNs, tax data, and portal identifiers before sharing.
10. **Social account choice:** X or LinkedIn for the required launch post.

### Not needed to start

Vendor keys are not required for Slices 0-3. Work can begin with deterministic fixtures while accounts are prepared.

## 15. Definition of ready

Implementation can start when:

- The founder approves this plan. **Complete.**
- The GitHub destination is known. **Complete.**
- The two demo schools are accepted. **Complete.**

The definition of ready is satisfied. Implementation still requires a separate start instruction; approval of this document alone does not authorize vendor-account changes, deployment, email sending, or application construction.

Everything else can arrive before its corresponding vendor slice.

## 16. Definition of done

The build is complete when all PRD P0 acceptance criteria pass, every code path in the coverage diagram has a test and recoverable error state, the deployed public sample works without login, the authenticated closed loop works with real sponsor services, raw-file retention/deletion is verified, and the submission artifacts are ready before the deadline.

## 17. Engineering review report

| Review | Why | Runs | Status | Findings |
|---|---|---:|---|---|
| Engineering plan review | Architecture, tests, failure modes, performance | 1 | Clear | One late-async-write deletion gap found and added to the plan; zero critical gaps remain. |
| Independent subagent audit | Backend/security, frontend/accessibility, and integration/release coverage | 3 | Complete | Tightened schemas, state machines, deletion, provider contracts, routes, fixtures, and gates. |
| Design review | UI/UX detail | 1 plan audit | Complete for implementation planning | Screen states, accessibility, mobile comparison, selectors, and E2E contracts are locked below; visual polish remains iterative. |

**Unresolved decisions:** 0 product or architectural decisions; credentials and controlled demo accounts in Section 14 remain operational prerequisites for their corresponding integration slices.  
**Verdict:** Engineering plan cleared for implementation.

## 18. Execution contract and drift controls

This section converts the approved product into an implementation contract. Earlier sections explain intent; Sections 18 onward control execution when wording is ambiguous.

### 18.1 Authority order

When two instructions conflict, use this order:

1. Security, privacy, data-loss prevention, and explicit user-control requirements.
2. The founder approvals recorded in this plan.
3. P0 acceptance criteria in `PRD.md`.
4. The detailed contracts in Sections 18 onward.
5. Earlier architectural guidance in this plan.
6. Research recommendations and post-MVP ideas.

The approved comparison direction must not drift into bill reconciliation. Do not add bill entities, payment calculations, portal access, autonomous appeals, or reconciliation statuses.

### 18.2 P0 product boundary

The implementation is limited to this loop:

```text
public synthetic UCSD/Loyola sample
  -> adult account and private workspace
  -> upload or forward 2-4 synthetic/real-format offers
  -> source-backed extraction and user review
  -> deterministic annual + conservative four-year comparison
  -> official-domain evidence and unresolved question
  -> editable draft and explicit approval
  -> AgentMail send, reply, proposed fact, user confirmation
  -> reactive recalculation, audit history, and deletion
```

Anything that does not directly support that loop is deferred unless the founder changes scope in writing. Specifically do not add a component library, generic repository layer, custom queue, custom workflow framework, generalized AI agent, analytics vendor, PDF export, family sharing, multi-browser CI, or bill reconciliation.

### 18.3 Change-control rule

Before making a change during implementation:

1. Name the PRD acceptance criterion or behavior ID it satisfies.
2. Identify the narrowest public interface that can prove it.
3. Search for an existing helper, type, state transition, or fixture before adding one.
4. Write one failing test and run it to prove the intended failure.
5. Implement only enough to make that test pass.
6. Run the focused test and all affected suites.
7. Refactor only while green.
8. Update the slice checklist and commit only a coherent green state.

If a requested change has no P0 criterion and is not required by a failing test, record it under deferred work instead of implementing it.

### 18.4 TDD enforcement

Scaffolding is the only test-first exception: configuration and test runners must exist before a test can run. No product behavior is added during that bootstrap. The first product change is the failing landing-page test.

For every non-trivial behavior:

```text
RED: add one behavior test -> run it -> confirm the failure is the missing behavior
GREEN: add the minimum implementation -> run the focused test -> run affected suites
REFACTOR: remove duplication only while all affected tests remain green
```

Invalid RED states include syntax errors, missing imports unrelated to the behavior, a test that already passes, or a failure caused only by an incorrectly configured fixture. Fix the test harness first, then re-establish a meaningful RED.

Tests assert public behavior, persisted state, authorization results, or provider request/response contracts. They do not assert hook call counts, private helper calls, CSS class names, or incidental DOM nesting.

### 18.5 Completion discipline

- At most one behavior ID is in RED at a time in the active lane.
- A slice is complete only when its focused tests, full affected suite, typecheck, lint, build, and named E2E check pass.
- A checkpoint cannot advance with a known authorization leak, secret leak, silent data loss, unhandled failure state, arbitrary sleep, or flaky test.
- External fixtures run in ordinary CI with zero network access and zero provider keys.
- Live smokes are explicit opt-in commands against synthetic data and never run on fork pull requests.
- Accessibility acceptance is implemented inside each slice; Slice 9 is a regression audit, not the first accessibility pass.
- Whole-workspace deletion begins in Slice 3 and is extended whenever a private table or provider mapping is added.

## 19. Locked routes and screen contracts

### 19.1 Route map

| Route | Access | Required outcome |
|---|---|---|
| `/` | Public | Product promise, sample preview, `Try the sample`, `Compare my offers`, three-step explanation, privacy/trust copy, sponsor footer. |
| `/sample` | Public, immutable | Synthetic UCSD/Loyola comparison, source drill-down, unresolved-question and reply-resolution story, no mutation controls. |
| `/auth` | Signed-out | Register/sign in with email and password; restore intended private route after success. |
| `/age` | Authenticated, not confirmed | Unchecked 18+ confirmation, privacy/vendor links, continue, sign out. No workspace before confirmation. |
| `/workspace` | Authenticated adult | Minimum-offer progress, upload and forwarding choices, processing cards, four-offer cap. |
| `/offers/:offerId/review` | Owner only | Source-backed extraction review, corrections, confirmation, deleted-source fallback. |
| `/compare` | Owner only | Two-to-four-offer annual and four-year comparison, visible assumptions, risks, questions, sources. |
| `/schools/:schoolId` | Owner only | Offer versions, official sources, questions, thread, and audit history. |
| `/questions/:questionId/draft` | Owner only | Editable recipient, subject, body, evidence, save, cancel, and distinct approval. |
| `/decision` | Owner only | User-selected current choice, assumptions, unresolved items, evidence freshness; no AidLens recommendation. |
| fallback | Public/private-safe | Not-found message with a safe return action and no leaked private identifiers. |

The global shell has a skip link, semantic `header`, `nav`, `main`, and `footer`, current-page indication, and an authentication-loading state that never flashes private content.

### 19.2 Stable accessible names

These labels are test and UX contracts:

- `Try the sample`
- `Compare my offers`
- `Upload an offer`
- `Confirm school`
- `Confirm reviewed offer`
- `Conservative`
- `Optimistic`
- `Draft question`
- `Approve and send`
- `Confirm update`
- `Delete workspace`

Prefer `getByRole`, `getByLabelText`, and visible text in tests. Use `data-testid` only for repeated dynamic records with no stable accessible identity:

- `offer-card-{fixtureId}`
- `line-item-{fixtureId}`
- `comparison-row-{category}`
- `processing-status-{fixtureId}`
- `delivery-status`
- `reply-proposal`

### 19.3 Screen-state requirements

Every screen implements loading, empty, success, recoverable failure, and permission-loss states that apply to it.

- Landing: sample unavailable still leaves the CTA visible with retry copy.
- Sample: persistent `Synthetic demo` banner; fictional offers are visually distinct from real official-policy evidence; no edit, send, upload, or delete controls.
- Auth: visible labels, password reveal, inline field errors, submit-level error summary, duplicate-submit guard, invalid-credential and network-failure states.
- Age: checkbox is never preselected; failed submission focuses and announces the error.
- Workspace: `0 of 2 offers added`, one-offer state, comparison-ready state, four-offer cap, inbox provisioning and retry state.
- Upload: show filename/type/size; never fake upload percentage; unsupported, oversized, encrypted, interrupted, unreadable, and duplicate states remain recoverable.
- Processing: show status text, last update, required user action, and retry; do not encode state by color alone.
- School confirmation: candidate name, city/state, and domain; include `None of these`; research cannot begin before confirmation.
- Review: calculation-critical low-confidence fields first, `Show all fields`, literal `Unknown`, visible original label/category/amount/period/confidence/evidence, save/cancel, stale-revision recovery.
- Comparison: annual net price, gift aid, and funding gap first; then borrowing, work-study, four-year estimate, risks, and questions. Preliminary/incomplete offers never silently outrank reviewed complete offers.
- Sources: title, verified hostname, bounded excerpt, retrieval time, evidence type, and external-link warning. Unofficial/lookalike pages never receive an official badge.
- Draft: save/cancel do not send; official-domain override requires a second confirmation; failures preserve the exact draft.
- Reply: sanitized plain text, old versus proposed value, confirm/edit/keep unresolved; receipt alone never changes totals.
- Deletion: raw-file deletion and whole-workspace deletion are separate; pending/failure/success states clear private client state safely.

### 19.4 Responsive and accessibility contract

- WCAG 2.2 AA applies to the core flow.
- One `h1` per page, logical heading order, semantic landmarks, visible focus, no keyboard trap, and predictable focus return after dialogs.
- Field errors use `aria-describedby`; blocking errors use a focusable summary; background status uses concise `aria-live="polite"` announcements.
- The comparison uses a semantic table on wide screens with row and column headers.
- At 320 CSS pixels and 200% zoom, the page has no horizontal overflow except one labeled comparison scroller. The first column remains understandable, and previous/next-school controls are keyboard accessible.
- Primary touch controls target at least 44 by 44 CSS pixels.
- Contrast is at least 4.5:1 for normal text and 3:1 for large text and meaningful UI boundaries.
- Status, risk, grants, loans, and work-study never depend on color alone.
- Reduced-motion mode removes decorative movement and smooth scrolling without hiding state changes.
- Source previews include extracted text. After raw-file deletion, show the retained excerpt and deletion date instead of a broken preview.
- Automated axe checks cover landing, sample, workspace, review, comparison, and draft with zero critical or serious violations. Manual keyboard, 200% zoom, 320px width, and NVDA/Chrome checks remain release gates.

### 19.5 Visual direction and base tokens

Use a calm, document-review visual language: editorial hierarchy, dense but readable financial tables, restrained status surfaces, and no generic dashboard card grid.

- Background: warm off-white; primary data surfaces: white; primary text: near-black green.
- Brand green is reserved for identity and positive confirmed state, not for every action.
- Amber communicates uncertainty, red communicates actionable failure, and both always include text/icons.
- Use the system sans-serif stack and tabular numerals for money. Do not add a font-loading dependency.
- Base spacing uses a 4px unit with 8/12/16/24/32/48px steps.
- Main content max-width is approximately 1200px; source-review view may use the full viewport.
- Borders and whitespace separate financial rows; shadows are minimal and never carry hierarchy alone.
- Motion is limited to short state/focus transitions and disabled under reduced motion.

Finalize exact color values in Slice 0 only after automated contrast checks. Store them as a small set of CSS custom properties; do not create a token package or design-system abstraction.

## 20. Target repository shape

Create files only when their slice needs them. This is the maximum intended shape, not a scaffolding checklist.

```text
AidLens/
  .github/workflows/ci.yml
  e2e/
    public-sample.spec.ts
    private-comparison.spec.ts
    approval-safety.spec.ts
    reply-resolution.spec.ts
    deletion.spec.ts
  src/
    domain/
      comparison.ts
      comparison.test.ts
    features/
      sample/
      auth/
      workspace/
      offers/
      comparison/
      sources/
      questions/
    App.tsx
    main.tsx
    styles.css
  convex/
    lib/
      auth.ts
      transitions.ts
      validation.ts
      idempotency.ts
    auth.ts
    auth.config.ts
    schema.ts
    profiles.ts
    workspaces.ts
    schools.ts
    documents.ts
    offers.ts
    research.ts
    processing.ts
    email.ts
    http.ts
    crons.ts
  test/fixtures/
    sample/
    extraction/
    firecrawl/
    agentmail/
    files/
  scripts/smoke/
  BUILD_PLAN.md
  PRD.md
  README.md
  hackathon.md
  package.json
  pnpm-lock.yaml
  playwright.config.ts
  vite.config.ts
  vitest.config.ts
```

Rules:

- Start the money engine in one `comparison.ts` file. Split it only after concrete duplication or file complexity appears.
- Create a helper in `convex/lib` only after it has multiple callers, except the ownership guard and transition validator, which are cross-cutting security boundaries from their first use.
- Do not create vendor interfaces with one implementation. Export concrete Fireworks AI, Firecrawl, and AgentMail functions.
- Do not persist calculated comparison totals. Persist facts and assumptions; derive totals through the pure domain engine so every reactive update uses one source of truth.
- Do not create a separate repository, service, controller, DTO, or queue layer around Convex.
- Use the routing facility already present in the official scaffold; if none exists, add `react-router-dom` as the single routing dependency rather than implementing a custom router for ten routes.
- Use Convex validators for Convex function boundaries. Use one runtime schema source for Fireworks AI structured output; if the existing stack does not already supply one, add `zod` and no second general validation library.
- Use native `fetch` for Firecrawl and AgentMail unless their required official package demonstrably removes more code than it adds. Use the official `svix` verifier for AgentMail signatures rather than implementing cryptography.
- Add dependencies only in the slice that first exercises them with a failing test.

## 21. Data schema and indexes

Every private child record carries `workspaceId`. Authorization always resolves the workspace and verifies its owner; it never trusts a client-supplied owner, email, status, provider ID, timestamp, or total.

### 21.1 `profiles`

Fields:

- `authUserId`: stable auth identity key
- `email`
- `ageConfirmedAt?: number`
- `agentMailInboxId?: string`
- `agentMailInboxAddress?: string`
- `createdAt`, `updatedAt`

Indexes: `by_authUserId`, `by_agentMailInboxId`.

### 21.2 `workspaces`

Fields:

- `ownerProfileId`
- `name`
- `status: active | deleting`
- `currentChoiceSchoolId?: Id<"schools">`
- `generation`
- `createdAt`, `updatedAt`, `deletionStartedAt?: number`

Indexes: `by_ownerProfileId`, `by_ownerProfileId_status`.

The workspace row is deleted last during cascade deletion. `generation` invalidates late asynchronous work.

### 21.3 `schools`

Fields:

- `workspaceId`
- `name`
- `unitId?: string`
- `officialDomain?: string`
- `identityState: candidate | needs_confirmation | confirmed`
- `financialAidEmail?: string`
- `bursarEmail?: string`
- `createdAt`, `updatedAt`

Index: `by_workspaceId`.

Normalize domains to lowercase ASCII hostnames with no protocol, port, path, query, fragment, or trailing dot.

### 21.4 `offerDocuments`

Fields:

- `workspaceId`, `schoolId?: Id<"schools">`
- `storageId?: Id<"_storage">`
- `fileName`, `mimeType`, `byteSize`, `sha256`
- `sourceRoute: upload | agentmail`
- `agentMailAttachmentId?: string`
- `retentionDeadline`
- `rawState: present | deleting | deleted`
- `processingState`
- `processingGeneration`
- `failedStage?: string`, `errorCode?: string`, `errorMessage?: string`
- `statementDate?: number`
- `createdAt`, `updatedAt`, `rawDeletedAt?: number`

Indexes:

- `by_workspaceId`
- `by_schoolId_createdAt`
- `by_workspaceId_sha256`
- `by_rawState_retentionDeadline`
- `by_agentMailAttachmentId`

The server derives MIME, byte size, digest, and encryption state from stored bytes. Client metadata is display-only until verified.

### 21.5 `offers`

Fields:

- `workspaceId`, `schoolId`, `documentId`
- `version`, `active`
- `reviewState: preliminary | reviewed`
- `academicYear`, `startTerm`, `endTerm`
- `enrollmentIntensity`, `housingAssumption`, `residencyAssumption`
- `overallConfidence`
- `revision`
- `createdAt`, `updatedAt`, `supersededAt?: number`

Indexes: `by_schoolId_active`, `by_schoolId_version`, `by_documentId`.

Only one active offer version exists per school. Replacing an offer supersedes the old version transactionally and does not consume another slot in the four-school cap.

### 21.6 `lineItems`

Fields:

- `workspaceId`, `offerId`
- `originalLabel`
- `canonicalCategory`
- immutable extracted fields: `extractedAmountCents?: number`, `extractedPeriod`, `extractedStatus`, `extractedRenewal`, `extractedConfidence`
- effective reviewed fields: `amountCents?: number`, `period`, `status`, `renewal`
- `requiredForCostTotal: boolean` for explicit missing-cost completeness checks
- evidence: `documentPage`, `sourceRegion?: string`, `sourceExcerpt`
- `verifiedByUserAt?: number`, `correctedByProfileId?: Id<"profiles">`
- `revision`, `createdAt`, `updatedAt`

Index: `by_offerId`.

Missing money is absent/null and displays as `Unknown`; it is never coerced to zero.

### 21.7 `officialSources`

Fields:

- `workspaceId`, `schoolId`
- `normalizedUrl`, `finalUrl`, `hostname`, `title`
- `evidenceType`
- `retrievedAt`
- bounded `excerpt`
- `crawlState`, `contentDigest`, `truncated`
- `researchRunId`

Indexes: `by_schoolId`, `by_schoolId_normalizedUrl`.

Never persist full crawled page bodies. Search-result snippets are discovery metadata and never stored as evidence excerpts.

### 21.8 `questions`

Fields:

- `workspaceId`, `schoolId`
- `triggerType`, `unknownSummary`, `whyItMatters`
- `state`, `version`
- `recommendedOffice: financial_aid | bursar`
- `relatedLineItemIds`
- `resolutionSummary?: string`
- `createdAt`, `updatedAt`

Indexes: `by_workspaceId_state`, `by_schoolId_state`.

### 21.9 `emailThreads`

Fields:

- `workspaceId`, `schoolId`, `questionId`
- `agentMailThreadId?: string`
- `recipient`, `officeType`
- `createdAt`, `updatedAt`

Indexes: `by_questionId`, `by_agentMailThreadId`.

### 21.10 `emailMessages`

Fields:

- `workspaceId`, `threadId`
- `agentMailMessageId?: string`
- `direction: outbound | inbound`
- `state`
- `recipient`, `subject`, sanitized bounded `plainText`
- bounded attachment metadata only
- `draftRevision`, `approvedRevision?: number`, `approvalId?: string`, `bodyHash`
- `proposedFacts?: ProposedFact[]`
- `createdAt`, `sentAt?: number`, `receivedAt?: number`, `updatedAt`

Indexes: `by_threadId_createdAt`, `by_agentMailMessageId`, `by_approvalId`.

### 21.11 `assumptions`

Fields:

- `workspaceId`, `schoolId?: Id<"schools">`
- `annualGrowthBasisPoints`
- `scenario: conservative | optimistic`
- selected loan/resource identifiers and amounts
- `revision`, `updatedAt`

Index: `by_workspaceId_schoolId`.

Use basis points rather than floating-point percentages in persistence. The default 3% is stored as `300`.

### 21.12 `auditEvents`

Fields:

- `workspaceId`
- `actor: system | user | fireworks | firecrawl | agentmail | school_reply`
- `eventType`
- related entity IDs
- fixed allowlisted safe metadata only
- `createdAt`

Index: `by_workspaceId_createdAt`.

Do not store raw documents, model prompts, full model outputs, full webpage bodies, email HTML, secrets, or arbitrary vendor payloads.

### 21.13 `webhookEvents`

Fields:

- `provider`
- SHA-256 `eventHash`
- `outcome`
- `receivedAt`, `expiresAt`

Indexes: `by_provider_eventHash`, `by_expiresAt`.

Retain only PII-free hashes and operational status for at most 30 days.

## 22. Authorization, trust, and concurrency contracts

### 22.1 Function visibility

| Entry point | Callable by | Required guard |
|---|---|---|
| Public sample query | Anyone | Returns compile-time synthetic fixtures only; accepts no private ID. |
| Private query/mutation | Authenticated browser | Derive identity from `ctx.auth`, resolve profile and workspace, require active ownership, verify every supplied child belongs to that workspace. |
| Upload URL mutation | Authenticated adult | Active owned workspace, below four-active-school cap, rate/size intent checks. |
| Processing action | Internal scheduler/workflow only | Recheck active workspace and document generation before vendor call and before commit. |
| Provider-result mutation | Internal only | Exact entity ID, generation/revision, current version, and idempotency claim. |
| AgentMail webhook HTTP action | Internet | Raw-body signature and timestamp verification, body-size cap, event dedupe, trusted inbox/thread mapping. |
| Private-file HTTP action | Authenticated browser | Verify bearer auth, active workspace ownership, document/storage relationship, and raw-file state before streaming. |

Use the auth provider's canonical stable identity key. Never authorize using a client-supplied email or user ID. Owner and non-owner lookups return the same safe not-found response when distinguishability could leak record existence.

### 22.2 Parent-child integrity

Every mutation accepting multiple IDs proves they belong together before writing. Examples:

- `document.workspaceId === workspaceId`
- `offer.documentId === documentId` and `offer.schoolId === schoolId`
- `lineItem.offerId === offerId`
- `question.schoolId === schoolId`
- `thread.questionId === questionId`
- `message.threadId === threadId`

No update object may contain `ownerProfileId`, `workspaceId`, provider IDs, status strings, revisions, timestamps, or derived totals from the browser.

### 22.3 Idempotency keys

| Operation | Stable key | Transactional behavior |
|---|---|---|
| Upload finalization | `workspaceId + sha256` | Find-or-create document and schedule one processing job in the same mutation. |
| Forwarded attachment | `agentMailAttachmentId` plus digest | Reuse the same ingestion mutation; exact replay returns existing document. |
| Extraction | `documentId + processingGeneration` | Claim one current attempt; stale commits no-op. |
| Research | `schoolId + researchRunId` | One run is active; duplicate starts return existing state. |
| Draft approval/send | immutable `approvalId` bound to draft revision and body hash | First approval transitions to queued; repeats return the same outbound record. |
| Webhook | provider plus verified event ID hash | Verify, then atomic find-or-insert before dispatch. |
| Reply confirmation | `questionId + expectedVersion` | One transaction applies facts, question state, and audit; stale version rejects all. |
| Raw deletion | `documentId + rawState` | Already-deleted is a safe no-op without duplicate audit. |

### 22.4 Async generation checks

Every scheduled or vendor-backed job carries the entity ID and expected generation/revision. It checks:

1. The workspace still exists and is `active`.
2. The entity still belongs to that workspace.
3. The document/offer/question is still the current version.
4. The generation/revision matches the job.
5. The terminal result has not already been committed.

Check both before spending vendor credits and immediately before committing results. A duplicated vendor call after a crash is tolerable; duplicated database effects, sends, or recreated deleted records are not.

### 22.5 Workspace deletion algorithm

Workspace deletion ships in Slice 3 and expands with every later table:

1. Owner mutation marks the workspace `deleting` and increments `generation`.
2. All reads and writes immediately reject a deleting workspace.
3. Clear/deactivate the AgentMail inbox mapping so late webhooks cannot attach records.
4. Delete raw storage and child rows in bounded indexed batches.
5. Best-effort remote inbox cleanup must not block local deletion.
6. Delete the workspace row last.
7. Scheduled actions and webhooks that arrive later observe no active workspace and no-op.

The deletion E2E retains previously returned child IDs and a file URL attempt, then proves each is inaccessible after deletion.

## 23. Canonical state machines

State transitions happen only in dedicated mutations that validate the current state, requested transition, ownership, and expected revision. UI code never writes raw status strings.

### 23.1 Document processing

```text
received -> validating -> extracting
extracting -> needs_school_confirmation | researching | failed
needs_school_confirmation -> researching | failed
researching -> needs_review | ready | failed
needs_review -> ready
failed -> the failed stage after explicit retry
any non-deleted state -> raw file deleted without erasing safe structured facts
```

`failedStage` records the retry target. Raw-file state is separate from processing state, preventing an extracted offer from becoming invalid merely because retention deleted its source file.

### 23.2 Research

```text
idle -> queued -> searching -> scraping -> complete
searching | scraping -> needs_input | failed
needs_input | failed -> queued after explicit retry or manual official URL
```

### 23.3 Offer review

```text
preliminary -> reviewed
reviewed -> preliminary only when a replacement version or confirmed source conflict changes a calculation-critical fact
```

### 23.4 Question resolution

```text
open -> awaiting_reply -> reply_received -> awaiting_user_confirmation
awaiting_user_confirmation -> resolved | partially_resolved | open
```

Question state does not encode outbound transport details.

### 23.5 Outbound message

```text
drafting -> awaiting_approval -> queued -> sent -> delivered
queued | sent -> failed | bounced
failed | bounced -> queued only through the same immutable approval or a newly approved revision
```

Delivery updates are monotonic. A late `sent` event cannot regress `delivered`, `failed`, or `bounced`.

### 23.6 Workspace

```text
active -> deleting -> physically absent
```

There is no restore path in the MVP.

## 24. Provider contracts

Concrete provider functions are allowed; generic adapter interfaces are not.

### 24.1 Fireworks AI

Functions:

```text
extractOffer(documentVersionId) -> ExtractionResultV1
draftQuestion(questionId, draftRevision) -> DraftV1
extractReply(messageId) -> ProposedReplyFactsV1
```

Contract:

- Use Fireworks AI's OpenAI-compatible Chat Completions API.
- Send JPEG/PNG as vision image content from a server-side action. Render every PDF page to an image first because Fireworks AI does not support direct document inlining; preserve page numbers for evidence citations.
- Do not expose a Convex storage bearer URL to the browser. If a provider URL is required, use a short-lived server-authorized path or provider file and delete it after use.
- Freeze one `FIREWORKS_MODEL` environment value for the MVP and log only model name, response ID, timing, token counts, and safe status.
- Use `response_format.type = json_schema`, a versioned schema name, strict JSON Schema, all properties required, `additionalProperties: false`, and explicit nullable/unknown values.
- Validate parsed output again at the persistence boundary.
- Detect refusal, incomplete status/reason, absent output, and schema failure before any authoritative persistence.
- The model returns facts, categories, confidence, and evidence only. It never returns authoritative totals, status transitions, recipients, tool calls, or send instructions.
- Treat document, webpage, and email text as quoted untrusted data in prompts.
- Retry once for timeout, 429, and 5xx. Make SDK retry behavior explicit so nested retries cannot multiply. A single corrective retry for schema-invalid output is allowed; refusal and other 4xx failures do not blindly retry.

Persistence is one internal mutation that first rechecks active workspace, document generation, and current version. Invalid or partial model data never creates authoritative line items.

### 24.2 Firecrawl and school identification

Functions:

```text
lookupSchoolCandidates(query) -> SchoolCandidate[]
researchSchool(schoolId, confirmedDomain, researchRunId) -> OfficialSourceV1[]
```

Contract:

- College Scorecard assists candidate identity when possible; the user confirms the school and official domain before Firecrawl starts.
- Use targeted Firecrawl Search plus Scrape, not broad crawl or an autonomous web agent.
- Default to the direct v2 API through native `fetch`; do not install the crawl component for two bounded one-shot operations that do not need page-body persistence.
- Search with a small result limit and `includeDomains: [confirmedDomain]`.
- Search snippets are discovery only. Revalidate and scrape the final page before storing evidence.
- Parse URLs with `new URL`. Require HTTPS; reject credentials, custom ports, IP hosts, invalid URLs, and redirects outside the confirmed domain.
- Accept only the exact confirmed hostname or a hostname ending in `.` plus that domain. A raw string suffix check is forbidden.
- Government context uses an explicit hostname allowlist and cannot replace school-specific policy evidence.
- Scrape main content only with bounded timeout and page count.
- Persist only normalized URL, final URL, hostname, title, exact bounded excerpt, type, retrieval time, digest, and truncation state.
- Retry 408, 429 while respecting `Retry-After`, and 5xx with bounded backoff. Do not retry 400, 401, 402, 403, 404, 409, or 413 automatically.
- Timeout, block, credit exhaustion, or no authoritative page becomes a clear retry/manual-official-URL state and leaves the question unresolved.

For the MVP, one current research run per case is enough. Do not add continuous monitoring or a cache layer before measurement.

### 24.3 AgentMail

Functions:

```text
provisionInbox(workspaceId)
sendApprovedQuestion(approvalId)
handleWebhook(rawBody, svixHeaders)
```

Contract:

- Provision one inbox per workspace in Slice 8 with a deterministic client ID. Existing workspaces are backfilled idempotently.
- Default to the direct AgentMail API plus verified webhooks so AidLens controls its bounded sanitized message retention. Do not add the Convex component if it would duplicate full message bodies in component tables.
- Forwarded attachments call the exact same internal validation/ingestion mutation as browser uploads.
- Fetch attachment bodies separately from webhook metadata. Never render arbitrary HTML; store and display sanitized bounded plain text.
- The Convex HTTP action reads the exact raw body before parsing and verifies Svix `svix-id`, `svix-timestamp`, and `svix-signature` with `AGENTMAIL_WEBHOOK_SECRET`.
- Missing, malformed, tampered, or expired signatures return 400 with zero writes.
- Verified duplicate, ignored, or late-after-delete events return 204 without recreating state.
- Map events through trusted AgentMail inbox/thread/message IDs, never through sender-provided workspace identifiers.
- Subscribe only to needed events. Handle received, sent, delivered, bounced, rejected, and complained states; blocked/spam/unauthenticated inbound mail is not ingested by default.
- Approval freezes recipient, subject, body, draft revision, and body hash. Recipient override outside the confirmed official domain requires a second explicit confirmation.
- Send with the local immutable `approvalId` as the provider idempotency key. Local revision/idempotency rules remain authoritative even if the provider expires keys.
- Reply extraction creates proposals only. One user-confirmation mutation applies the accepted fact, question result, and audit event with an optimistic revision check.

Live smoke email goes only to the founder-controlled recipient, never an uninvolved college office.

### 24.4 Convex orchestration decision

Use native scheduled internal actions plus persisted attempt/status fields for the initial pipeline. Do not add a custom queue. Add the Convex Workflow component only if a Slice 5 development-deployment test demonstrates that native scheduling cannot provide the required recovery or observability.

Queries are read-only, mutations own transactional writes, actions own vendor calls, HTTP actions own authenticated file streaming and verified webhooks, and cron/schedulers initiate bounded cleanup or retries.

## 25. Fixture and test-data contract

All committed fixtures are fictional, visibly marked `synthetic: true`, and contain deterministic IDs and timestamps. No fixture contains a real student name, address, ID, barcode, SSN, tax detail, account number, portal identifier, email body from a real person, or copied award.

### 25.1 Public sample

- Synthetic UC San Diego offer: larger headline scholarship, renewal ambiguity, work-study near gift aid, Parent PLUS option.
- Synthetic Loyola University Maryland offer: different direct-cost mix, clear loans, smaller renewable gift aid, missing mandatory cost found on an official page.
- Exact expected annual totals, conservative four-year totals, optimistic deltas, warnings, and source labels are written beside the fixtures.
- Both documents say they are fictional and not issued by either institution.

### 25.2 File fixtures

- clear-table PDF
- ambiguous-prose PDF
- misleading loan/work-study PDF
- valid JPEG and PNG
- encrypted PDF
- unreadable scan
- MIME-spoofed file
- exact 10 MB file and generated 10 MB + 1 byte file

Do not commit a large oversized binary; generate it during the test.

### 25.3 Fireworks AI fixtures

- valid clear extraction
- ambiguous extraction with unknown amount
- misleading loan/work-study classification
- malformed/schema-invalid output
- refusal
- incomplete due to output limit/content filter
- injected instructions inside a document
- timeout, 429, and 5xx
- stale/deleted document result

### 25.4 Firecrawl fixtures

- official apex domain
- valid official subdomain
- government context source
- lookalike hostname
- HTTP URL
- IP/credentialed/custom-port URL
- redirect off-domain
- snippet without scrape result
- timeout, 429, 5xx, credit exhaustion
- blocked page, stale page, and conflicting official evidence
- deleted workspace before commit

### 25.5 AgentMail fixtures

- queued, sent, delivered, bounced, rejected, and complained events
- valid Svix signature from a test secret
- missing, bad, tampered, and expired signatures
- exact replay and out-of-order delivery events
- valid, partial, and malicious replies
- multiple forwarded attachments
- duplicate attachment
- workspace deleted before event/action
- double approval and crash/retry using the same approval key

Fixture tests prove parsing, trust boundaries, and deterministic behavior. They do not prove real model accuracy. The 80% extraction target belongs to an explicit live evaluation over approved synthetic/redacted documents.

## 26. Test projects, scripts, and commands

Lock these script names in `package.json`; implementation details may follow the scaffold, but later slices must not rename the public commands.

| Command | Purpose | Network/secrets |
|---|---|---|
| `pnpm dev` | Vite plus Convex development processes | Development Convex only |
| `pnpm build` | Production frontend build and generated-code compatibility | None after codegen |
| `pnpm typecheck` | TypeScript checks for browser, tests, and Convex | None |
| `pnpm lint` | ESLint or scaffold-selected linter | None |
| `pnpm format:check` | Formatting check | None |
| `pnpm test:domain` | Pure comparison/state tests in Node | None |
| `pnpm test:react` | React behavior tests in jsdom | None |
| `pnpm test:convex` | `convex-test` queries/mutations/schedules | None |
| `pnpm test:contract` | Fireworks AI/Firecrawl/AgentMail request-response fixtures | None |
| `pnpm test:eval` | Deterministic extraction/reply fixture evaluation | None |
| `pnpm test` | All non-browser, non-live suites | None |
| `pnpm e2e` | Critical Chromium journeys | Local/development fixture endpoints only |
| `pnpm e2e:sample` | Public sample journey | None beyond local server |
| `pnpm check` | format, typecheck, lint, test, build | None |
| `pnpm smoke:fireworks` | One synthetic document through the real API | Explicit opt-in |
| `pnpm smoke:firecrawl` | UCSD/Loyola official pages | Explicit opt-in |
| `pnpm smoke:agentmail` | Controlled inbox send/reply | Explicit opt-in |
| `pnpm smoke:convex` | Storage, scheduler, auth, deployed HTTP routes | Explicit opt-in |
| `pnpm smoke:all` | All development-deployment smokes | Explicit opt-in |

Live scripts require `RUN_LIVE_SMOKE=1`, fail fast when required environment values are absent, redact output, use only synthetic data, and clean up test files/inboxes/webhooks when supported. They are excluded from Vitest globs and ordinary CI.

Vitest uses separate Node, jsdom, and edge-runtime projects. `convex-test` registers component test helpers when the selected packages expose them. Node-only actions are covered with concrete fetch contract tests and development-deployment smokes rather than pretending the local runtime is faithful.

Playwright uses:

- a Vite `webServer` with `reuseExistingServer: !process.env.CI`
- one Chromium project for MVP
- an auth setup project and isolated storage state for private flows
- semantic locators and web-first assertions
- no `waitForTimeout` or arbitrary sleeps
- trace on first retry, screenshots on failure, and retained failure artifacts in CI

## 27. Detailed vertical-slice work packets

Execute strictly in order unless the parallelization gates in Section 11 are satisfied. Within each slice, complete behavior IDs in order. Each behavior gets its own RED/GREEN cycle.

### Slice 0 — repository, scaffold, quality gate, and deployment spike

**Goal:** A public shell exists, its first behavior test is green, and every later slice has a reliable gate.

**Preparation**

- Record the approved documents in the first commit before scaffolding.
- Confirm Git `main` and `origin` point to `PeytonLi/AidLens`.
- Generate the current official React/Vite/TypeScript/Convex Auth scaffold in a temporary directory because the repository already contains documents; merge only required generated files and preserve all existing Markdown.
- Use the scaffold's supported Convex Auth email/password path. Do not swap auth vendors.
- Record exact selected versions in `pnpm-lock.yaml`; pin the actual pnpm version in `packageManager`; use the same supported Node major locally and in CI.
- Inspect scaffold dependencies before adding any. Reuse its styling and validation facilities.

**Behavior cycles**

- **S0.1 RED:** React test expects the AidLens heading, `Try the sample`, and `Compare my offers`.
- **S0.1 GREEN:** Add the smallest landing shell that renders them.
- **S0.2 RED:** Build/check command fails when typecheck or tests fail.
- **S0.2 GREEN:** Configure the scripts in Section 26 and a single `pnpm check` gate.
- **S0.3 RED:** CI workflow test/config inspection detects missing frozen install or gate.
- **S0.3 GREEN:** Add GitHub Actions: checkout, supported Node/pnpm, `pnpm install --frozen-lockfile`, generated-code check if required, and `pnpm check`.
- **S0.4 RED:** Deployment smoke cannot find the public heading at the deployed URL.
- **S0.4 GREEN:** Establish and document the scaffold-supported Convex site deployment command and deploy the shell.

**Files expected:** scaffold/config files, `src/App.tsx`, first React test, `.env.example`, `.gitignore`, CI workflow, `README.md`, `hackathon.md`.

**Exit gate:** fresh clone install/test/build succeeds; CI is green; public shell loads at `convex.site`; no secret or generated credential is tracked. Commit: `chore: scaffold AidLens and quality gates`.

### Slice 1 — deterministic financial-aid engine and transition rules

**Goal:** One pure module owns all authoritative arithmetic and warnings.

Define `calculateComparison(input): ComparisonResult`. Inputs contain offers, normalized line items, required-cost flags, and explicit assumptions. Outputs contain per-offer annual facts, four-year facts, completeness, warnings, and deterministic insight facts. No prose generation and no persistence occur here.

**Behavior cycles**

- **S1.1:** Grants and scholarships reduce annual net price.
- **S1.2:** Student loans never reduce annual net price.
- **S1.3:** Parent PLUS/private financing never reduce annual net price.
- **S1.4:** Work-study never reduces annual net price or the default funding gap.
- **S1.5:** Declined items are excluded; offered/accepted states remain visibly distinguishable.
- **S1.6:** A required cost with no amount makes the applicable total `Incomplete` and lists the missing component.
- **S1.7:** Mismatched academic periods are not summed and produce a warning.
- **S1.8:** One-time gift aid applies only to year one.
- **S1.9:** Unknown renewal applies only to year one in the conservative scenario.
- **S1.10:** Confirmed fixed renewable aid continues only for its stated duration.
- **S1.11:** Optimistic mode carries only conditionally renewable aid under the visible assumption; it does not convert one-time or explicitly nonrenewable aid.
- **S1.12:** Remaining gap subtracts only user-selected student loans and confirmed resources.
- **S1.13:** Negative net price is allowed and accompanied by the required explanation flag.
- **S1.14:** Housing, residency, enrollment, or period mismatches emit warnings.
- **S1.15:** Every currency calculation uses integer cents and display formulas reconcile exactly.
- **S1.16:** Four-year cost growth compounds annually from nonnegative cost using basis points and rounds each year's cost to the nearest cent before subtracting aid.
- **S1.17:** The fifth active school is rejected by the domain constraint; replacing one active offer does not increase the count.
- **S1.18:** Deterministic insight facts never contain a `best school` conclusion.
- **S1.19:** Table-test every allowed document, question, message, and workspace transition plus representative forbidden transitions.

Start with one test per behavior. Add table-driven cases only after the first case is green. Include zero, one cent, exact boundary, unknown, negative result, and safe-integer validation.

**Exit gate:** `pnpm test:domain`, typecheck, lint, and build pass; statement and branch coverage for the comparison module are 100%. Commit: `feat: add deterministic aid comparison engine`.

### Slice 2 — public synthetic tracer bullet

**Goal:** A judge can understand the full product promise without signing in, using the real comparison engine.

**Behavior cycles**

- **S2.1 RED E2E:** `/` -> `Try the sample` opens `/sample` without authentication.
- **S2.1 GREEN:** Add public routing and the immutable sample fixture.
- **S2.2 RED:** Sample shows synthetic UCSD and Loyola offers, gift aid, loans, work-study, annual net price, conservative four-year totals, and `Incomplete/Unknown` where expected.
- **S2.2 GREEN:** Render the semantic comparison through `calculateComparison`.
- **S2.3 RED:** A source control reveals the fictional document excerpt or real official-policy citation, title, hostname, type, and retrieval date.
- **S2.3 GREEN:** Add read-only source details.
- **S2.4 RED:** Conservative/optimistic controls alter only the eligible fixture aid and announce the change.
- **S2.4 GREEN:** Add the labeled radio group and visible formulas/assumptions.
- **S2.5 RED:** The sample exposes the clarification/reply-resolution story without enabling an edit, mutation, delete, or send.
- **S2.5 GREEN:** Render immutable guided states from fixture data.
- **S2.6 RED:** Keyboard and axe checks fail on inaccessible source/table controls.
- **S2.6 GREEN:** Complete semantic table, focus, live-region, contrast, reduced-motion, and mobile scroller acceptance.

The sample may live entirely in code unless scaffold inspection proves a public Convex query is smaller. It must never reuse private tables or accept mutation input.

**Exit gate:** `pnpm e2e:sample`, React tests, domain tests, axe checks, typecheck, lint, and build pass. Deploy and verify unauthenticated access. Commit: `feat: add read-only synthetic comparison`.

### Slice 3 — authentication, adult confirmation, ownership, and base deletion

**Goal:** An authenticated adult receives exactly one private workspace; cross-user and deleted access are impossible.

**Behavior cycles**

- **S3.1:** Anonymous private query and mutation are rejected.
- **S3.2:** Registration/sign-in succeeds through Convex Auth email/password and restores the intended route.
- **S3.3:** Workspace creation fails until an unchecked 18+ confirmation is explicitly submitted.
- **S3.4:** Repeated confirmation creates one profile/workspace.
- **S3.5:** User A cannot read, mutate, choose, or delete User B's workspace or child record; response does not reveal existence.
- **S3.6:** Signed-out/auth-expired UI clears private content before rendering the sign-in prompt.
- **S3.7:** Owner can mark a current-choice school without changing calculations or ranking language.
- **S3.8:** Owner can initiate workspace deletion; workspace immediately becomes inaccessible and late scheduled work with the old generation no-ops.
- **S3.9:** Keyboard, focus, validation summary, loading, error, and mobile behavior pass for auth, age, and empty workspace.

Create the shared `requireProfile`, `requireActiveWorkspace`, and parent-child guard here. Every later private function must use them.

The workspace initially shows inbox provisioning as unavailable/pending until Slice 8; do not fake an address.

**Exit gate:** all auth/ownership Convex tests, auth/age React tests, isolated-account Playwright flow, deletion regression, and full gate pass. Commit: `feat: add private adult workspaces`.

### Slice 4 — upload, byte validation, private preview, status, and retention

**Goal:** A private supported file becomes one validated processing record and can be securely viewed or deleted.

**Behavior cycles**

- **S4.1:** Owner can obtain a short-lived upload URL; anonymous/non-owner cannot.
- **S4.2:** Exact 10 MB PDF/JPEG/PNG is accepted; 10 MB + 1 byte and unsupported types are rejected before processing.
- **S4.3:** Server inspection rejects MIME spoofing, encrypted PDF, and unreadable input with distinct recoverable error codes.
- **S4.4:** Upload finalization uses authoritative metadata and digest, creates one `received` document, and schedules one validation job transactionally.
- **S4.5:** Concurrent duplicate finalization produces one document/job and a duplicate-choice UI.
- **S4.6:** `Replace current offer`, `Keep as new version`, and `Cancel` have distinct tested outcomes.
- **S4.7:** Every allowed processing transition works; forbidden/stale transitions reject.
- **S4.8:** Reactive UI observes transitions without fixed sleeps and retains filename/retry action on failure.
- **S4.9:** Owner-only HTTP preview streams the file; non-owner, signed-out, deleted, and mismatched storage ID requests fail without exposing a storage URL.
- **S4.10:** Immediate raw deletion removes storage, preserves safe record/excerpt state, increments generation, and is idempotent.
- **S4.11:** Hourly cleanup uses `by_rawState_retentionDeadline` in bounded batches; due files are deleted, future files remain, already-deleted files no-op, and one audit event is created.
- **S4.12:** An in-flight result after raw or workspace deletion cannot commit; orphan cleanup is recoverable.
- **S4.13:** Upload, duplicate dialog, processing status, preview fallback, focus return, live announcements, and mobile behavior pass accessibility tests.

`convex-test` proves schedules and record transitions. Real blob upload/read/delete receives a development-deployment smoke because local action/storage emulation is not treated as authoritative.

**Exit gate:** ingestion/retention/security tests, upload React tests, private-ingestion E2E, `pnpm smoke:convex`, and full gate pass. Extend workspace cascade to documents/storage. Commit: `feat: add secure offer ingestion and retention`.

### Slice 5 — Fireworks AI extraction and user-reviewed facts

**Goal:** A document produces validated, cited, editable facts; model failure never creates partial authority.

**Behavior cycles**

- **S5.1:** PDF and image requests use the expected Responses API input shape and versioned strict schema.
- **S5.2:** A valid `ExtractionResultV1` persists school candidates, offer, line items, evidence, confidence, and original labels in one commit.
- **S5.3:** Missing amount remains null/`Unknown`; no loan, PLUS, or work-study is categorized as gift aid in golden fixtures.
- **S5.4:** Every material field requires page/region/excerpt evidence; missing evidence makes the result invalid.
- **S5.5:** Refusal, incomplete response, missing output, and schema-invalid response create recoverable failure without partial line items.
- **S5.6:** Timeout/429/5xx and the one corrective schema retry obey the exact retry budget.
- **S5.7:** Prompt-like document text remains inert and cannot add tools, recipients, actions, or status transitions.
- **S5.8:** Low-confidence calculation-critical fields sort first while all fields remain reachable.
- **S5.9:** User edit validates money/category/period/status/renewal, preserves immutable extraction, increments revision, and creates a safe audit event.
- **S5.10:** Cancel restores the saved value; stale-tab correction rejects without partial write.
- **S5.11:** `Confirm reviewed offer` is blocked until required review items are addressed, then changes only the current offer revision to reviewed.
- **S5.12:** Raw-file deletion after extraction leaves retained evidence excerpts and a clear deletion date.
- **S5.13:** Review focus, source fallback, unknown values, errors, unsaved-change warning, zoom, mobile, and axe checks pass.

Run deterministic fixtures first. After they are green and credentials exist, `pnpm smoke:fireworks` renders and processes one synthetic PDF. A separate opt-in live evaluation reports field-level accuracy; it is not ordinary CI.

**Exit gate:** extraction contracts/evals, review behavior, stale-write/security tests, live synthetic smoke, and full gate pass. Extend workspace cascade to offers/line items. Commit: `feat: add source-backed offer review`.

### Slice 6 — private two-to-four-offer comparison

**Goal:** Reviewed facts and explicit assumptions drive the real reactive comparison.

**Behavior cycles**

- **S6.1:** Fewer than two active offers shows progress and an add-offer action; comparison unlocks at two.
- **S6.2:** Four active offers are allowed; a fifth is blocked before upload; replacement preserves the count.
- **S6.3:** Annual table shows cost, gift aid, net price, loans, Parent PLUS/private financing, work-study, funding gap, completeness, and warnings from the domain engine.
- **S6.4:** Conservative four-year scenario is default and shows growth/renewal assumptions beside formulas.
- **S6.5:** Optimistic scenario changes only eligible conditional aid.
- **S6.6:** Preliminary, reviewed, incomplete, mismatched-period/housing/residency/enrollment, and stale-source states are explicit and not color-only.
- **S6.7:** Confirmed correction or assumption mutation causes a reactive recalculation and concise announcement.
- **S6.8:** Annual growth validation uses bounded basis points and reset-to-default behavior.
- **S6.9:** Default sorting is labeled; incomplete/preliminary data does not masquerade as a definitive cheapest result; manual order persists for the session.
- **S6.10:** No screen, insight, accessible label, or empty state calls a school `best` or recommends attendance.
- **S6.11:** Desktop semantic table, labeled source expanders, mobile comparison scroller, previous/next controls, keyboard, 200% zoom, 320px, reduced motion, and axe checks pass.

The private UI calls the same `calculateComparison` function and uses the same currency/formula presentation helpers as `/sample`.

**Exit gate:** React/domain/Convex tests and upload -> review -> second offer -> compare Playwright flow pass. Deploy the minimum usable product checkpoint. Commit: `feat: add reactive private comparisons`.

### Slice 7 — school identity, official evidence, and deterministic questions

**Goal:** Only confirmed official evidence supports conclusions; absence creates a question.

**Behavior cycles**

- **S7.1:** School candidate lookup returns bounded College Scorecard candidates when available and always allows manual confirmation.
- **S7.2:** Ambiguous identity pauses research until the user confirms name and normalized official domain.
- **S7.3:** Exact official host and valid subdomain pass; lookalike, HTTP, IP, credentialed, custom-port, and off-domain redirect URLs fail.
- **S7.4:** Search uses the confirmed domain and bounded result cap; snippets alone never persist as evidence.
- **S7.5:** Scraped official page persists only the bounded evidence record and retrieval metadata, not the full body.
- **S7.6:** Duplicate research start returns the active run; stale/deleted run cannot commit.
- **S7.7:** Timeout, block, credits/rate limit, no page, and conflicting/stale evidence produce explicit retry/manual-URL/unresolved states.
- **S7.8:** Deterministic triggers create questions for missing required cost, ambiguous loan/work-study, unknown renewal, unclear period, component mismatch, assumption mismatch, missing/conflicting deadline, and source conflict.
- **S7.9:** Fireworks AI may phrase a question from verified facts but cannot decide whether a trigger exists.
- **S7.10:** Source and question screens distinguish document, official page, government context, user correction, and school reply.
- **S7.11:** Keyboard, external-link warning, focus, live progress, empty/failure state, mobile, and axe checks pass.

Run `pnpm smoke:firecrawl` only against approved UCSD and Loyola official domains after fixture contracts are green.

**Exit gate:** domain validation, provider contract, question trigger, source UI, identity confirmation, live smoke, and full gate pass. Extend workspace cascade to sources/questions/research state. Commit: `feat: add official evidence and questions`.

### Slice 8 — AgentMail inbox, forwarding, approval, delivery, reply, and resolution

**Goal:** The real closed loop works once, safely, with one controlled recipient.

Implement in four sub-slices, each independently green.

#### Slice 8A — inbox and forwarded ingestion

- **S8.1:** Workspace provisions one inbox idempotently; failure shows retry; existing workspaces backfill safely.
- **S8.2:** Valid signed inbound event deduplicates by verified event ID and maps through the known inbox.
- **S8.3:** Missing/bad/tampered/expired signature produces zero writes.
- **S8.4:** Supported forwarded attachment reuses the upload ingestion mutation and produces an equivalent document record.
- **S8.5:** Multiple attachments require user selection unless exactly one is confidently supported; duplicate attachment does not create another job.
- **S8.6:** HTML and suspicious text remain inert plain text; late event after deletion no-ops.

#### Slice 8B — draft and explicit approval

- **S8.7:** Material open question can request a draft containing only verified case facts and an evidence summary.
- **S8.8:** User can edit recipient, subject, and body; save changes without sending.
- **S8.9:** Cancel, close, navigation, refresh, or draft generation never sends.
- **S8.10:** Off-domain recipient requires a second explicit warning/confirmation.
- **S8.11:** Approval binds exact revision/body hash and atomically queues one outbound record.
- **S8.12:** Double click, retry, and stale draft cannot create a second logical send.

#### Slice 8C — sending and delivery

- **S8.13:** Internal send action uses `approvalId` idempotency, updates queued/sent state, and never accepts arbitrary browser payload.
- **S8.14:** Duplicate/out-of-order sent/delivered events preserve monotonic delivery state.
- **S8.15:** Bounce/reject/complaint preserves the exact draft, marks failure, and exposes a safe retry requiring the valid approval rule.
- **S8.16:** Delivery status and timestamp are visible persistently, not only in a toast.

#### Slice 8D — reply proposal and confirmation

- **S8.17:** Verified reply appears reactively as sanitized text and changes no total.
- **S8.18:** Reply extraction returns proposed facts with supporting text; malicious instructions remain inert.
- **S8.19:** User can edit, confirm, or keep the proposal unresolved.
- **S8.20:** Confirmation transaction updates the effective fact, question state, and audit event with expected revisions; the derived comparison reacts afterward.
- **S8.21:** Partial response becomes partially resolved/open; stale conflict requests refresh; rejected proposal leaves totals unchanged.
- **S8.22:** Draft, warning, delivery, reply, confirmation, focus, keyboard, live-region, mobile, and axe checks pass.

Automated tests use signed synthetic fixtures and a deterministic send endpoint. `pnpm smoke:agentmail` uses only the controlled demo inbox/recipient and proves a real send plus reply.

**Exit gate:** all webhook/approval/delivery/reply tests, approval-safety and reply-resolution Playwright flows, controlled live smoke, and full gate pass. Extend workspace cascade to inbox mapping, threads, messages, and webhook events. Commit: `feat: close the approved clarification loop`.

### Slice 9 — adversarial hardening, accessibility regression, deployment, and submission

**Goal:** Prove the complete product remains safe and usable under failure before public submission.

**Behavior cycles derive from audit findings; every discovered defect starts RED before its fix. Required audits:**

- Enumerate every public query, private query/mutation, internal action/mutation, HTTP route, storage path, cron, and provider callback; document its trust boundary and matching test.
- User B attempts every previously observed User A ID and private file route.
- Delete a populated workspace, then replay extraction, research, send, delivery, attachment, and reply events; none may recreate data.
- Scan tracked files and built artifacts for secret patterns and real PII.
- Verify logs contain IDs/statuses only, not source bodies, prompts, model outputs, page bodies, or email text.
- Verify raw retention dates, immediate deletion, scheduled deletion, structured-data disclosure, and vendor-processing disclosure.
- Run axe on all core screens and complete keyboard, NVDA/Chrome, 200% zoom, 320px, contrast, touch target, focus, and reduced-motion checks.
- Verify vendor degraded states preserve last confirmed comparison data and never show stale content as current.
- Measure the public sample after deployment; target interactive under two seconds after warm-up. Measure before adding caching.
- Run every critical E2E without fixed sleeps.
- Run all four live provider/deployment smokes in development before production promotion.
- Execute a controlled production rehearsal of sample, auth boundary, synthetic upload/review/compare, evidence, approved email, reply confirmation, raw deletion, and workspace deletion.

**Release artifacts:**

- public `convex.site` URL
- public GitHub repository with no secrets/PII
- complete `README.md`
- `hackathon.md` describing substantive Convex, Fireworks AI, Firecrawl, and AgentMail use
- sub-three-minute demo video following the PRD flow
- founder-selected LinkedIn or X post tagging all sponsors
- submission with repo, URL, and video before September 22 at 12:00 PM PT

**Exit gate:** `pnpm check`, all Chromium E2E, automated accessibility checks, manual audit checklist, dev live smokes, production rehearsal, deletion verification, and submission artifact review are green. Commit: `chore: prepare AidLens hackathon release`.

## 28. Critical end-to-end journeys

Keep the browser suite small. Lower-level suites prove edge cases; these journeys prove cross-layer wiring.

### E2E 1 — public judge

```text
/ -> Try the sample -> UCSD/Loyola comparison
-> inspect one offer source and one official source
-> switch conservative/optimistic
-> inspect the immutable resolved-reply story
```

Assertions: no login, no mutation controls, synthetic banner persists, loans/work-study are not gift aid, formulas reconcile, source types are clear, keyboard path works.

### E2E 2 — private comparison happy path

```text
register -> age confirmation -> empty workspace
-> upload synthetic UCSD -> confirm identity -> observe live processing
-> correct one field -> confirm review
-> upload synthetic Loyola -> confirm review
-> comparison unlocks -> edit one assumption -> reactive recalculation
```

Assertions: no private flash before auth, statuses update without sleeps, correction is audited, second offer unlocks comparison, assumptions are visible.

### E2E 3 — approval safety

```text
open question -> generate/edit draft -> navigate away
-> prove unsent -> reopen -> approve with rapid double activation
-> one queued/sent/delivered record
```

Assertions: zero send before approval, exact draft retained, one logical send, persistent delivery state.

### E2E 4 — reply safety

```text
deliver synthetic malicious/ambiguous reply
-> show inert text and proposed fact only
-> comparison remains unchanged
-> confirm edited proposal
-> fact/question/audit update -> comparison reacts
```

Assertions: no tool behavior from reply text, no pre-confirmation total change, atomic confirmed update.

### E2E 5 — failure and recovery

```text
reject invalid upload -> accept corrected upload
-> Firecrawl timeout -> manual official URL/retry
-> send bounce -> safe retry
```

Assertions: each failure explains the correction, saved facts/draft survive, retry creates no duplicates.

### E2E 6 — ownership and deletion

```text
User A creates populated workspace
-> User B attempts workspace/child/file access and fails
-> User A deletes workspace
-> refresh, old IDs, old file request, scheduled result, and late webhook all fail/no-op
```

Assertions: no existence leak, no private record remains accessible, nothing is recreated.

## 29. Environment, CI, deployment, and smoke contract

### 29.1 Environment variables

Browser-visible values may contain public endpoints only:

- `VITE_CONVEX_URL`
- any additional public site URL generated by the selected official Convex Auth scaffold

Local generated and uncommitted values:

- `CONVEX_DEPLOYMENT`
- scaffold-generated local Convex URLs

Convex deployment environment:

- exact auth secrets required by the selected official Convex Auth scaffold
- `FIREWORKS_API_KEY`
- `FIREWORKS_MODEL`
- `FIRECRAWL_API_KEY`
- `FIRECRAWL_WEBHOOK_SECRET` if the selected component/webhook mode uses it
- `AGENTMAIL_API_KEY`
- `AGENTMAIL_WEBHOOK_SECRET`
- `COLLEGE_SCORECARD_API_KEY`
- `PUBLIC_SITE_URL` only if callback or absolute-link construction needs it

GitHub protected secret:

- `CONVEX_DEPLOY_KEY`

Test-only local/development value:

- `E2E_TEST_MODE=1` enables deterministic provider endpoints outside production
- `RUN_LIVE_SMOKE=1` explicitly enables live scripts

`.env.example` lists names and descriptions without values. Vendor keys live only in protected development/production Convex environments, never normal pull-request CI, browser variables, source, logs, fixtures, screenshots, or chat.

### 29.2 Pull-request CI

Run in this order:

1. Checkout.
2. Install the pinned Node and pnpm versions.
3. `pnpm install --frozen-lockfile`.
4. Verify generated Convex code/schema consistency using the scaffold-supported command.
5. `pnpm format:check`.
6. `pnpm typecheck`.
7. `pnpm lint`.
8. `pnpm test`.
9. `pnpm build`.
10. From Slice 2 onward, run `pnpm e2e:sample` against the CI web server.
11. From Slice 6 onward, run the deterministic private critical paths against fixture provider endpoints.

No pull-request job calls Fireworks AI, Firecrawl, AgentMail, College Scorecard, or a production deployment.

### 29.3 Main deployment

- Deploy only from a green main revision.
- Use the official scaffold-supported Convex deployment/hosting command with `CONVEX_DEPLOY_KEY`; document the exact verified command in `README.md` during Slice 0.
- Development deploys receive vendor credentials first. Production credentials are added only after deterministic tests and corresponding development smoke pass.
- The deployed sample route must remain public and immutable even when private integrations are degraded.
- Keep the prior known-good deployment/revision identifiable for rollback. A failed production smoke stops promotion; it does not trigger speculative fixes directly in production.

### 29.4 Live smoke matrix

| Smoke | Synthetic input | Required proof | Cleanup |
|---|---|---|---|
| Fireworks AI | One fictional offer PDF rendered to page images | Valid strict extraction, evidence, unknown handling, no tool/action output | Delete rendered images and local raw file when requested. |
| Firecrawl | UCSD and Loyola official URLs only | Domain restriction, scraped excerpt, retrieval metadata, clear blocked/no-page state | Remove temporary research run if not part of demo fixture. |
| AgentMail | Founder-controlled inbox and recipient | Provision, approved send, delivery state, inbound reply, proposal-only update | Delete temporary inbox/webhook when supported. |
| Convex | Synthetic account/workspace/files | Auth boundary, reactive state, private file path, scheduler cleanup, full deletion | Delete smoke workspace and verify absence. |

### 29.5 Retry matrix

| Boundary | Retry automatically | Do not retry automatically |
|---|---|---|
| Fireworks AI | timeout, 429, 5xx once; one explicit corrective schema retry | refusal, auth/payment/other permanent 4xx |
| Firecrawl | 408, 429 with `Retry-After`, 5xx with bounded backoff | 400, 401, 402, 403, 404, 409, 413 |
| AgentMail send | provider/component bounded transient retry under same approval key | recipient/content/auth rejection without new user action |
| Webhooks | Provider may redeliver; app deduplicates | App never recursively retries an invalid signature |
| Cleanup | Next bounded cron run safely retries remaining work | No unbounded transaction or loop |

The provider SDK's internal retry count must be known and configured so it cannot multiply an outer retry policy.

## 30. Requirements traceability

| Requirement family | Implemented in | Primary proof |
|---|---|---|
| Public read-only synthetic demo | Slices 1-2 | Domain tests, sample React tests, public E2E |
| Email/password auth and 18+ gate | Slice 3 | Convex identity tests, React form tests, private E2E |
| Owner isolation | Slices 3-9 | Shared guard tests plus per-function non-owner matrix |
| Upload PDF/JPEG/PNG <=10 MB | Slice 4 | Byte/signature tests and upload E2E |
| Forwarded offers | Slice 8A | Signed webhook and shared-ingestion equivalence tests |
| Seven-day/immediate raw deletion | Slice 4 onward | Scheduler, idempotency, storage smoke, deletion E2E |
| School identity/official domain | Slices 5 and 7 | Candidate/confirmation and URL adversarial tests |
| Strict source-backed extraction | Slice 5 | Fireworks AI contract/eval tests and live synthetic smoke |
| User review/correction/versioning | Slice 5 | React behavior and revision-safe Convex tests |
| Two-to-four annual/four-year comparison | Slices 1 and 6 | Pure math suite and comparison E2E |
| Official evidence and unresolved questions | Slice 7 | Firecrawl/domain/trigger tests and smoke |
| Editable explicit email approval | Slice 8B | Cancel/no-send and double-approval tests |
| Delivery and inbound reply | Slices 8C-8D | Signed events, monotonic state, proposal/confirmation tests |
| Audit trail | Slices 3-8 | Per-mutation audit assertions and UI detail tests |
| Whole-workspace deletion | Slice 3, extended every slice | Cascade regressions and deletion E2E |
| Accessibility/mobile | Every slice | Component axe plus manual release audit |
| Security/privacy/resilience | Every slice, audited in 9 | Trust-boundary matrix, adversarial tests, smokes |
| Hackathon submission | Slice 9 | Artifact checklist and production rehearsal |

No P0 requirement is considered implemented merely because a component renders. It requires the primary proof above and a visible recoverable failure state.

## 31. Execution schedule and cut discipline

The schedule is dependency-based; calendar days are estimates, not permission to advance while red.

| Day target | Work | Checkpoint |
|---|---|---|
| 1-2 | Slice 0 scaffold, test runners, CI, deployed shell | A — Skeleton |
| 3-4 | Slice 1 domain engine and transitions | Internal green gate |
| 5 | Slice 2 public sample | B — Judgeable sample |
| 6-7 | Slice 3 auth, age, ownership, base deletion | Private shell |
| 8-9 | Slice 4 ingestion, preview, retention | C — Private ingestion |
| 10-12 | Slice 5 extraction and review | Reviewed offers |
| 13 | Slice 6 private comparison | D — Usable comparison |
| 14-15 | Slice 7 identity, evidence, questions | E — Evidence |
| 16-18 | Slice 8A-D inbox, forwarding, approval, delivery, reply | F — Closed loop |
| 19-21 | Slice 9 adversarial audit, deployment, docs, demo, submission | G — Submission |

If the schedule slips, cut only in this order:

1. Optimistic scenario; retain conservative four-year behavior.
2. User-entered savings/resources beyond selected loans.
3. More than one active clarification question per school.
4. College Scorecard contextual data beyond identity assistance/manual confirmation.
5. Reply attachment ingestion; retain text replies.

Do not cut source evidence, user review, deterministic math, two-offer comparison, explicit approval, webhook verification, authorization, raw retention, workspace deletion, public sample, or the reply-driven confirmed update.

## 32. Remaining founder inputs by gate

No further product decision is needed to begin Slice 0 when the founder gives the start instruction.

Before Slice 0 deployment:

- Confirm hackathon registration/new-app eligibility.
- Provide or authorize Convex development and production deployments.

Before Slice 5 live smoke:

- Store a Fireworks AI API key with credits in the Convex development environment.
- Approve `FIREWORKS_MODEL` after a small quality/cost check; keep it fixed for the MVP.

Before Slice 7 live smoke:

- Store Firecrawl credentials/credits.
- Store a College Scorecard API key or explicitly accept manual identity confirmation when the API is unavailable.

Before Slice 8 live smoke:

- Store AgentMail API and webhook credentials.
- Provide the controlled inbox/recipient authorized for send/reply testing.

Before Slice 9 submission:

- Choose LinkedIn or X for the launch post.
- Approve the final public URL, demo video, and post copy.
- Optionally provide fully redacted offer samples for the live extraction evaluation.

Credentials are never pasted into source files, committed documents, fixtures, logs, screenshots, or chat.

## 33. Final completion checklist

AidLens is complete only when every item is true:

- [ ] All Slice 0-9 behavior IDs have a recorded RED/GREEN cycle.
- [ ] `pnpm check` passes from a fresh checkout with a frozen lockfile.
- [ ] All six critical Chromium E2E journeys pass without arbitrary waits.
- [ ] Public `/sample` works without authentication and cannot mutate shared data.
- [ ] Authenticated users cannot access any other user's records or files.
- [ ] Two to four reviewed offers compare with deterministic annual and conservative four-year math.
- [ ] Loans, Parent PLUS/private financing, and work-study never appear as gift aid or reduce net price.
- [ ] Missing required values remain `Unknown` and make affected totals incomplete.
- [ ] Every material figure traces to a document excerpt, official source, school reply, user correction, or visible assumption.
- [ ] Firecrawl evidence is restricted to confirmed official domains or allowlisted government context.
- [ ] No outbound email sends without explicit approval of the exact revision.
- [ ] Duplicate approvals and webhook replays produce one logical effect.
- [ ] Replies propose changes but do not affect totals before user confirmation.
- [ ] Immediate and seven-day raw-file deletion are verified.
- [ ] Populated workspace deletion removes access and survives late async work/webhooks.
- [ ] No real PII or secret exists in the repository, build artifacts, fixtures, screenshots, logs, or video.
- [ ] Automated and manual accessibility gates pass.
- [ ] Fireworks AI, Firecrawl, AgentMail, and Convex development smokes pass with synthetic data.
- [ ] Production rehearsal passes on the deployed app.
- [ ] README, `hackathon.md`, public repo, live URL, video, social post, and submission are complete before the deadline.

Until all applicable boxes are checked, report the exact incomplete behavior or gate; do not summarize the product as done.
