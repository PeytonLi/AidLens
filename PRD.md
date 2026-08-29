# AidLens Product Requirements Document

**Status:** Ready for implementation  
**Version:** 1.0  
**Date:** August 27, 2026  
**Product owner:** Founder  
**Build constraint:** New All Gas Hackathon project; package manager must be `pnpm`

## 1. Product summary

### One-line promise

**Forward every college offer to one inbox. See what each school will actually cost—and get answers when the letters do not explain why.**

### Product concept

AidLens is an evidence-backed financial-aid offer comparison and clarification workspace for U.S. college students. A student uploads or forwards two to four financial-aid offers. AidLens converts inconsistent letters, emails, PDFs, and images into a common model; separates grants from loans and work-study; compares annual and estimated four-year costs; highlights renewal risks and missing information; and cites the source for every extracted figure.

Unlike a static award-letter decoder, AidLens also closes information gaps. It finds the school's official cost and aid policies, drafts a precise question for the appropriate Financial Aid or Bursar office, sends it only after the student approves it, and updates the comparison when the school replies.

### Positioning

AidLens is not a college recommender, financial adviser, appeal service, lender marketplace, or autonomous agent. It is a student-controlled comparison and clarification tool.

### Headline and supporting copy

- **Headline:** Know what each college will really cost.
- **Supporting copy:** Forward your financial-aid offers. AidLens separates free aid from borrowing, estimates the four-year cost, flags missing terms, and helps you get answers from each school.
- **Trust line:** Every number links back to the offer, an official school page, or a school reply.

## 2. Background and rationale

Financial-aid offers do not use a universal format. They frequently mix grants, loans, work-study, direct costs, indirect estimates, and financing options in ways that make headline totals hard to compare. The U.S. Government Accountability Office found that 41% of sampled colleges omitted net price and another 50% understated it. Federal Student Aid advises families to calculate net price, distinguish grants from earned or borrowed money, and account for costs missing from the offer.

Offer-upload and comparison products already exist. AidLens therefore cannot win by producing only a cleaner table. Its distinctive product loop is:

> **offers → normalized comparison → unresolved questions → approved school email → reply → live updated comparison**

That loop also makes each hackathon sponsor perform indispensable product work and produces a visible three-minute demo.

The supporting research and citations are in [research/aidlens-research.md](research/aidlens-research.md).

## 3. Target user

### Primary persona

**A U.S. undergraduate applicant, age 18 or older, comparing two to four admission and financial-aid offers.**

Typical characteristics:

- Has limited familiarity with financial-aid terminology.
- Receives offers in inconsistent formats through email, portals, PDFs, scans, or screenshots.
- Needs to make a consequential decision under a deadline.
- May be the first person in their family to navigate U.S. college aid.
- Wants family input but remains the sole account owner in the MVP.
- Is anxious about choosing an unaffordable school or misunderstanding a scholarship.

### Secondary future users

Parents, counselors, transfer applicants, graduate students, returning students, and students reconciling their first tuition bill are not separately supported in the MVP. The data model may represent a household later, but the MVP must not add sharing roles or permissions.

### Jobs to be done

1. When I receive offers from different colleges, help me compare the same categories so I can see the real difference.
2. When an offer uses confusing labels, show whether the money is free, earned, borrowed, or still uncertain.
3. When a scholarship or cost is conditional, show what could change over four years.
4. When the letters omit something important, tell me exactly what is unknown and why it matters.
5. When only the school can answer a question, help me ask it clearly and keep the answer attached to my comparison.
6. When AI extracts something incorrectly, let me correct it before it affects the decision.

## 4. Goals and non-goals

### MVP goals

1. Normalize and compare two to four financial-aid offers in under five minutes after ingestion completes.
2. Show annual net price, likely borrowing, remaining funding gap, and a transparent four-year estimate without counting loans or work-study as discounts.
3. Make uncertainty visible instead of silently filling missing values.
4. Cite every extracted amount, policy, renewal condition, and school-derived answer.
5. Let a student resolve at least one uncertainty through a real, approved email exchange.
6. Demonstrate substantive Convex, Fireworks AI, Firecrawl, and AgentMail usage in a polished public product.
7. Protect sensitive documents through authentication, authorization, short retention, deletion, and a synthetic public demo.

### Non-goals

- Recommending which college the student should attend.
- Producing a single opaque school score.
- Guaranteeing the exact amount a student will pay or borrow.
- Logging into FAFSA, StudentAid.gov, or school portals.
- Collecting portal credentials, tax returns, bank details, or Social Security numbers.
- Submitting appeals, accepting loans, making deposits, paying bills, or changing enrollment.
- Negotiating aid autonomously.
- Supporting users under 18 in the MVP.
- Parent/counselor collaboration, multilingual support, or native mobile apps.
- Monitoring every school page continuously.
- Supporting international aid systems or non-U.S. institutions.

## 5. Product principles

1. **Gift aid is not financing.** Grants and scholarships reduce net price; loans and work-study do not.
2. **Unknown is a valid answer.** Missing or conflicting evidence creates a question, not a guess.
3. **Source before summary.** Every important conclusion must link to a document region, official URL, or school reply.
4. **Math is deterministic.** The model extracts and explains; application code calculates totals.
5. **The student remains in control.** The student reviews uncertain fields and explicitly approves every outbound email.
6. **Do not hide assumptions.** Four-year estimates expose cost growth, renewal, and borrowing assumptions.
7. **Minimize sensitive data.** Collect only what the comparison requires and delete raw files after seven days.

## 6. MVP scope

### Included

- Email-based account sign-in for users who confirm they are at least 18.
- One AidLens forwarding inbox per student.
- Upload or forward PDF, JPEG, and PNG offer documents.
- Two to four schools per comparison.
- One active financial-aid offer per school, with replacement/version history.
- AI extraction into a strict canonical schema.
- Side-by-side annual comparison.
- Transparent four-year scenario using editable assumptions.
- Confidence indicators and source-region review.
- Manual correction of extracted fields.
- Targeted Firecrawl search and scrape of official school domains.
- Renewal-condition, missing-cost, deadline, and ambiguity flags.
- One or more clarification questions per school.
- Draft, edit, approve, send, delivery tracking, inbound reply parsing, and manual confirmation of resolution.
- Reactive status and audit timeline through Convex.
- Full case deletion plus automatic raw-file deletion after seven days.
- Public synthetic demo that requires no private data.

### Deferred

- Family sharing and roles.
- Automated appeal generation as a separate workflow.
- Benchmarking an offer against peer students.
- Tuition-bill reconciliation.
- Scholarship search.
- School-fit or outcomes recommendations beyond optional factual context.
- OCR or extraction for unsupported formats.
- Bulk counselor dashboards.
- Export to PDF.
- Continuous policy monitoring.

## 7. Core user journey

### 7.1 Public entry

1. Visitor lands on the home page.
2. Visitor sees the product promise, a sample comparison, and two actions:
   - **Try the sample**
   - **Compare my offers**
3. **Try the sample** opens a complete synthetic case with two schools and a guided demo. No login is required and no mutation may affect shared fixture data.
4. **Compare my offers** starts authentication and age confirmation.

### 7.2 Account and inbox creation

1. User signs in through email-based authentication.
2. User confirms: “I am at least 18 years old.”
3. AidLens creates a private workspace and AgentMail forwarding address.
4. The workspace displays both ingestion choices:
   - Upload an offer.
   - Forward an offer to the displayed address.
5. AidLens warns the user not to upload FAFSA forms, tax documents, Social Security numbers, bank information, or portal credentials and recommends redaction.

### 7.3 Offer ingestion

1. User selects or forwards a PDF/JPEG/PNG.
2. AidLens validates type and size before processing.
3. The comparison board immediately shows a new school card with live stages:
   - Received
   - Reading offer
   - Identifying school
   - Checking official sources
   - Needs review or Ready
4. Fireworks AI extracts the offer into the canonical schema from rendered page images, with source-page references and confidence.
5. Firecrawl verifies the school's official domain and retrieves only relevant public pages: cost of attendance, aid/renewal policy, appeal or clarification instructions, and office contacts.
6. If school identity is ambiguous, the user selects the correct institution before crawling continues.

### 7.4 Review and correction

1. The user opens the extracted offer.
2. AidLens groups line items into:
   - Costs paid to the school
   - Other estimated costs
   - Grants and scholarships
   - Work-study
   - Student loans
   - Parent/private financing
   - Other or unknown
3. Low-confidence or calculation-critical fields appear first.
4. Selecting a field opens the source page/image region and original label.
5. The user can edit the amount, category, period, status, and renewal condition.
6. The user confirms the reviewed offer. Unreviewed offers remain visible but are labeled **Preliminary**.

### 7.5 Comparison

1. With at least two offers, AidLens displays a side-by-side comparison.
2. The default sort is lowest annual net price; the user may reorder schools manually.
3. The comparison never labels a school “best.”
4. The board shows:
   - Total annual cost of attendance
   - Direct/billable costs
   - Indirect estimated costs
   - Gift aid
   - Annual net price
   - Student loans offered
   - Parent/private financing offered
   - Work-study offered
   - Remaining funding gap
   - Estimated four-year net price
   - Estimated four-year student borrowing
   - Renewal risk
   - Unresolved question count
5. A plain-language insight strip calls out the largest meaningful differences without ranking overall fit.

Example:

> North Valley costs about $3,800 less in year one, but $12,000 of its scholarship has no confirmed renewal terms. Lakeside's offer is more expensive today but has fewer unresolved conditions.

### 7.6 Clarification

1. AidLens creates a question when a material field is missing, contradictory, conditional, or not supported by official evidence.
2. Each question states:
   - What is unknown
   - Why it affects the comparison
   - Evidence already checked
   - Recommended recipient: Financial Aid or Bursar
3. The user selects **Draft question**.
4. Fireworks AI drafts a concise email using only verified case facts.
5. The user edits the recipient, subject, and body.
6. The user explicitly selects **Approve and send**.
7. AgentMail sends within the existing school thread and reports queued, sent, delivered, or failed status.
8. When a reply arrives, the board updates live to **Reply received**.
9. Fireworks AI extracts answer candidates and supporting text but does not silently change money fields.
10. The user confirms the proposed update. The comparison recalculates and the question becomes **Resolved**, **Partially resolved**, or **Still unclear**.

### 7.7 Decision and cleanup

1. The user may mark one school **My current choice**; this is not an AidLens recommendation.
2. The decision view summarizes the reviewed comparison, unresolved issues, and evidence freshness.
3. The user may delete individual source documents or the entire workspace.
4. Raw files are automatically deleted seven days after ingestion. Extracted structured records and source excerpts remain until the case is deleted.

## 8. Functional requirements

Priorities use **P0** for hackathon MVP, **P1** for post-MVP, and **P2** for future exploration.

### 8.1 Authentication and ownership

- **P0:** Users must authenticate before uploading or forwarding real documents.
- **P0:** Each query and mutation must verify that the authenticated user owns the requested workspace or record.
- **P0:** Users must confirm they are at least 18.
- **P0:** Public demo records must be read-only synthetic fixtures isolated from private records.
- **P0:** Signing out must remove access to private content from the client.
- **P1:** Account email change.
- **P2:** Parent and counselor roles.

### 8.2 File ingestion

- **P0:** Accept PDF, JPEG, and PNG only.
- **P0:** Maximum file size is 10 MB per file.
- **P0:** Reject encrypted/password-protected PDFs with an actionable message.
- **P0:** Store file type, size, ingestion route, upload time, retention deadline, and processing status.
- **P0:** Forwarded email attachments follow the same validation rules as uploads.
- **P0:** If an email contains multiple supported attachments, ask the user which are financial-aid offers unless exactly one can be identified confidently.
- **P0:** Never render arbitrary attachment HTML.
- **P0:** Automatically delete raw files after seven days and allow immediate deletion.
- **P1:** HEIC support.

### 8.3 School identification

- **P0:** Extract school name and candidate identity from the document.
- **P0:** Match to a College Scorecard institution when possible.
- **P0:** Require user confirmation when the match is not unique or confidence is low.
- **P0:** Store official domain separately from document-provided URLs.
- **P0:** Firecrawl may only treat the confirmed official domain and government sources as authoritative policy evidence.

### 8.4 Offer extraction

- **P0:** Use strict Structured Outputs and validate every result before persistence.
- **P0:** Preserve each original label alongside the canonical category.
- **P0:** Record document page and quoted/extracted source text or bounding reference for each material field.
- **P0:** Record confidence as high, medium, or low.
- **P0:** Never coerce a missing amount to zero.
- **P0:** Detect whether amounts are annual, term-specific, one-time, or unknown.
- **P0:** Separate offered, accepted, declined, pending, and unknown statuses when present.
- **P0:** Mark ambiguous line items for review.
- **P0:** User corrections supersede AI extraction and are recorded in the audit trail.
- **P0:** Replacement offers create a new version and preserve prior calculations.

### 8.5 Comparison

- **P0:** Require at least two and allow at most four active offers.
- **P0:** Recalculate immediately after confirmed edits or replies.
- **P0:** Show annual values by default.
- **P0:** Show a four-year scenario with editable annual cost-growth and aid-renewal assumptions.
- **P0:** Display original school labels on detail views.
- **P0:** Display **Unknown** rather than `$0` for absent values.
- **P0:** Explain every total with a visible formula.
- **P0:** Show whether an offer is Preliminary or Reviewed.
- **P0:** Warn when offers cover different academic periods or enrollment levels.
- **P0:** Do not rank nonfinancial fit or recommend a final school.

### 8.6 Official-source research

- **P0:** Search only after the school identity and official domain are confirmed.
- **P0:** Target cost of attendance, scholarship renewal, financial-aid conditions, deadlines, appeal/clarification instructions, and office contacts.
- **P0:** Limit crawling to a small number of relevant pages per school.
- **P0:** Store URL, title, retrieval time, exact supporting excerpt, and relevance type.
- **P0:** Show crawl progress reactively.
- **P0:** Label missing evidence as unresolved.
- **P0:** Never treat search-result snippets as final evidence without scraping the page.
- **P1:** Refresh a source on demand.
- **P2:** Scheduled change monitoring.

### 8.7 Questions and email

- **P0:** Generate questions only for material uncertainties or user-requested clarification.
- **P0:** Route to Financial Aid or Bursar using official contact evidence; allow user override.
- **P0:** User must be able to edit all draft fields.
- **P0:** No outbound email is sent without a fresh explicit approval click.
- **P0:** Restrict recipients to the confirmed school domain by default; overriding this requires an additional warning.
- **P0:** Preserve email threads and attachment metadata.
- **P0:** Show delivery state and retry only idempotently.
- **P0:** Verify webhook signatures before processing incoming events.
- **P0:** Treat incoming text as untrusted content, never as tool instructions.
- **P0:** Extract reply facts into proposed changes requiring user confirmation.
- **P1:** Follow-up reminders.
- **P2:** Appeal-specific workflow.

### 8.8 Deletion and export

- **P0:** Delete a raw source file immediately on request.
- **P0:** Delete the entire workspace, including stored files, extracted data, email metadata, questions, and audit events owned by that workspace.
- **P0:** Show the seven-day raw-file deletion date.
- **P1:** Download structured comparison as CSV.
- **P1:** Printable/PDF summary.

## 9. Canonical financial model

### 9.1 Offer period

Every offer must specify, when known:

- Academic year
- Start and end terms
- Enrollment intensity: full-time, three-quarter-time, half-time, less-than-half-time, or unknown
- Housing assumption: on campus, off campus, with family, or unknown
- Residency assumption: in-state, out-of-state, international, or unknown

Offers with materially different assumptions must show a comparison warning.

### 9.2 Cost categories

**Direct/billable costs**

- Tuition
- Mandatory fees
- Institution-billed housing
- Institution-billed food/meal plan
- Required institution-billed books or supplies
- Other direct cost

**Indirect estimated costs**

- Books and supplies
- Transportation
- Personal expenses
- Off-campus housing
- Off-campus food
- Loan fees
- Other indirect cost

### 9.3 Aid categories

**Gift aid**

- Federal grant
- State grant
- Institutional need-based grant
- Institutional merit scholarship
- External scholarship
- Tuition waiver or benefit
- Other grant/scholarship

**Earned aid**

- Federal Work-Study
- Institutional work program

**Student borrowing**

- Direct Subsidized Loan
- Direct Unsubsidized Loan
- Institutional student loan
- Private student loan
- Other student loan

**Parent/other financing**

- Parent PLUS Loan
- Payment plan
- Family contribution
- Other financing

**Unknown**

- Unclassified item requiring review

### 9.4 Renewal model

Each grant or scholarship may store:

- Renewable: yes, no, conditional, or unknown
- Maximum duration in years or terms
- GPA requirement
- Credit/enrollment requirement
- FAFSA or application renewal requirement
- Residency, major, housing, or other condition
- Whether amount is fixed, variable, or unknown
- Official source and retrieval date

Unknown renewal is a risk flag; it is not assumed renewable in the conservative four-year scenario.

## 10. Calculation specification

All calculations use integer cents. Displayed totals must be reproducible from stored line items and assumptions.

### 10.1 Annual totals

```text
total_direct_cost = sum(known direct costs)
total_indirect_cost = sum(known indirect costs)
total_cost_of_attendance = total_direct_cost + total_indirect_cost
gift_aid = sum(grants and scholarships)
annual_net_price = total_cost_of_attendance - gift_aid
student_loans_offered = sum(student borrowing)
parent_financing_offered = sum(parent/other financing classified as borrowing)
work_study_offered = sum(work-study)
known_resources = confirmed user-entered savings + confirmed external resources
remaining_funding_gap = annual_net_price - student_loans selected - known_resources
```

Rules:

- Work-study never reduces annual net price or current funding gap by default because it is earned over time and not guaranteed.
- Loans never reduce annual net price.
- Parent PLUS and private loans must never appear as gift aid.
- Negative net price may be displayed but must explain that indirect costs and refund timing can differ.
- If a required cost is unknown, the total is labeled **Incomplete** and lists missing components.
- If line items cover different periods, do not sum them until normalized or confirmed.

### 10.2 Four-year estimate

The default scenario is conservative and editable.

For each year `y` from 1 through 4:

```text
cost_y = year_1_cost × (1 + annual_cost_growth)^(y - 1)
renewable_gift_aid_y = gift aid eligible for year y under known renewal duration
net_price_y = cost_y - renewable_gift_aid_y
```

Defaults:

- Annual cost growth: 3%, visibly labeled as an assumption.
- Fixed-dollar renewable aid: remains nominally fixed unless the offer states otherwise.
- Aid with confirmed duration covers only stated years.
- One-time aid appears only in year one.
- Aid with unknown renewal appears only in year one in the conservative scenario.
- User may toggle a clearly labeled optimistic scenario that assumes conditionally renewable aid continues at the same nominal amount.
- Estimated borrowing includes only loans the user explicitly selects for the scenario.
- Interest accrual and repayment projections are deferred; do not present them in the MVP.

### 10.3 Comparison insights

Insights are generated from deterministic differences, then phrased by the model. Supported insight types:

- Lowest reviewed annual net price
- Largest gift-aid amount
- Largest remaining funding gap
- Highest selected student borrowing
- Material missing cost
- One-time aid cliff
- Unknown or conditional renewal
- Direct/indirect cost mix difference
- Different housing, residency, enrollment, or period assumptions
- Newly resolved question that changes a total

No insight may say a school is the best overall choice.

## 11. Uncertainty and evidence model

### Confidence

- **High:** Clear amount and label with direct source support.
- **Medium:** Likely interpretation, but label, period, or category has some ambiguity.
- **Low:** Incomplete, contradictory, visually unclear, or inferred from surrounding context.

Calculation-critical medium and low-confidence fields must be surfaced in review. A user-confirmed field becomes **Verified by user** while retaining its original extraction record.

### Evidence precedence

1. User-confirmed correction for that offer version
2. Case-specific written reply from the school
3. The student's current offer document
4. Current official school policy page
5. Government dataset or guidance
6. Model inference

Precedence does not silently erase conflicts. Conflicting values are displayed with dates and sources until the user resolves them.

### Material question triggers

- Missing cost-of-attendance component
- Loan or work-study presented ambiguously
- Scholarship renewal unknown or conditional
- Aid amount does not state its period
- Total aid does not equal listed components
- Net price shown by school differs from AidLens deterministic calculation
- Enrollment, residency, or housing assumption is missing
- Deposit or response deadline is missing or conflicting
- School contact or policy contradicts the offer
- User manually asks for clarification

## 12. Screen specifications

### 12.1 Landing page

Must include:

- Headline and supporting copy
- Static preview of a two-school comparison
- **Try the sample** and **Compare my offers** actions
- Three-step explanation: Forward, Compare, Clarify
- Trust statement and privacy summary
- Sponsor attribution appropriate for the hackathon

### 12.2 Empty workspace

Must include:

- Personal forwarding address with copy button
- Upload drop zone and file picker
- Forwarding instructions
- Supported file types and size
- Sensitive-data warning
- Progress toward minimum two offers

### 12.3 Processing board

Each school card shows current live stage, elapsed status, failure/retry action, and whether user input is needed. Completed schools may be opened while other schools continue processing.

### 12.4 Offer review

Desktop layout uses source document on the left and extracted fields on the right. Mobile stacks source above fields. Each field shows original label, canonical category, amount, period, confidence, and edit action.

### 12.5 Comparison board

Must include:

- Sticky school headers
- Annual summary cards
- Expandable detailed rows
- Gift aid visually separated from loans and work-study
- Reviewed/preliminary state
- Four-year scenario switcher and assumptions
- Risk and unresolved-question rail
- Source links on row details
- Accessible table semantics or equivalent labeled structure

### 12.6 School detail

Must include:

- Offer summary
- Source documents and versions
- Official sources
- Renewal conditions
- Unresolved questions
- Email thread and delivery state
- Audit timeline

### 12.7 Draft approval

Must include editable recipient, subject, and body; evidence used; warning that AidLens does not represent the student; and a distinct **Approve and send** action. Closing or navigating away must not send.

### 12.8 Decision view

Must summarize reviewed annual and four-year comparisons, selected assumptions, remaining unknowns, and the user's marked current choice. It must not display an AidLens recommendation.

## 13. States and failure behavior

### Processing states

```text
received → validating → extracting → needs_school_confirmation? → researching
→ needs_review | ready | failed
```

### Question states

```text
open → drafting → awaiting_approval → queued → sent → delivered
→ reply_received → awaiting_user_confirmation → resolved | partially_resolved | open
```

### Required failure handling

- Unsupported or oversized file: reject before model processing and explain limits.
- Encrypted PDF: request an unlocked export or screenshot.
- Unreadable scan: preserve file until retention deadline and request a clearer upload.
- Duplicate offer: show detected duplicate and allow replace or keep as new version.
- Ambiguous school: pause and ask user to select.
- Model schema failure: retry once; then mark failed without persisting partial authoritative data.
- Firecrawl finds no official source: keep the field unresolved and allow manual official URL input.
- Official page blocked or unavailable: show failure and retrieval time; never substitute an unofficial source silently.
- AgentMail delivery failure: preserve draft and thread; show retry action.
- Suspicious inbound content: store safely as text, do not execute links or instructions, and require review.
- Deleted raw file: retain structured record and deletion event unless the user deletes the whole workspace.
- Partial vendor outage: comparison remains usable with last confirmed data and clear stale/degraded labels.

## 14. Data model

The exact database schema may combine small lookup concepts, but the following product entities and relationships are required.

### `users`

- Auth identity
- Email
- Age confirmation timestamp
- Created timestamp
- AgentMail inbox identifier/address

### `workspaces`

- Owner user ID
- Name
- Status
- Current-choice school ID, optional
- Created/updated timestamps

### `schools`

- Workspace ID
- College Scorecard/UNITID, optional
- Name
- Official domain
- Financial Aid contact
- Bursar contact
- Identity confirmation state

### `offerDocuments`

- Workspace and school IDs
- Storage ID, nullable after deletion
- AgentMail message/attachment IDs, optional
- File metadata
- Offer version
- Source route
- Statement/offer date
- Retention deadline
- Processing status and error

### `offers`

- School and document IDs
- Academic period and assumptions
- Review state
- Extraction confidence
- Version and superseded timestamp

### `lineItems`

- Offer ID
- Original label
- Canonical category
- Amount in cents, nullable
- Period
- Status
- Renewal metadata where relevant
- Source page/region/excerpt
- Confidence
- User verification/correction metadata

### `officialSources`

- School ID
- URL and title
- Source type
- Retrieved timestamp
- Supporting excerpt
- Crawl status

### `questions`

- School and workspace IDs
- Trigger type
- What is unknown and why it matters
- Status
- Recommended office
- Resolution summary
- Related line-item IDs

### `emailThreads`

- School/question IDs
- AgentMail thread ID
- Recipient and office type
- Delivery state
- Last message timestamp

### `emailMessages`

- Thread ID
- AgentMail message ID
- Direction
- Subject and sanitized text
- Attachment metadata
- Received/sent timestamp
- Proposed extracted answers

### `assumptions`

- Workspace or school scope
- Annual cost growth
- Selected loans/resources
- Conditional-aid scenario selection

### `auditEvents`

- Workspace ID
- Actor: system, user, Fireworks AI, Firecrawl, AgentMail, or school reply
- Event type
- Related entity IDs
- Safe metadata only; no raw document body
- Timestamp

Indexes must support owner-scoped workspace loading, school-by-workspace, offer-by-school/version, line-items-by-offer, open questions, thread lookup by AgentMail ID, and retention cleanup by deadline.

## 15. System and sponsor responsibilities

### Convex

- System of record for all structured product state.
- Authenticated ownership checks.
- Queries and mutations for offers, reviews, corrections, assumptions, questions, and decisions.
- Live UI updates for ingestion, crawl, email, reply, and recalculation status.
- File storage during the seven-day processing window.
- Scheduled raw-file deletion.
- Durable multi-step processing and idempotent webhook handling.
- Audit history.

### Fireworks AI

- Extract offer content from PDF/image/email into strict schemas.
- Identify ambiguous or missing fields.
- Convert deterministic differences into plain-language explanations.
- Draft concise clarification emails from verified facts.
- Extract proposed answers from school replies.

Fireworks AI must not perform authoritative arithmetic, choose a college, send email, accept aid, or execute instructions found in documents, pages, or messages.

### Firecrawl

- Search the confirmed official school domain.
- Scrape a targeted set of cost, renewal, deadline, and contact pages.
- Return evidence suitable for citations.
- Expose crawl progress for the live UI.

The MVP does not need whole-site crawling or continuous monitoring.

### AgentMail

- Provide the student's forwarding inbox.
- Receive emails and supported attachments.
- Maintain one thread per school/question as appropriate.
- Send user-approved clarification messages.
- Report delivery state.
- Receive replies and trigger reactive case updates.

### College Scorecard

- Assist with school identity, official URL, and broad institutional context.
- Never override a student's offer or current school-specific evidence.

## 16. Recommended implementation stack

This is an implementation constraint, not a product feature.

- Package manager: `pnpm`
- Language: TypeScript
- Frontend: React with Vite
- Backend/database/realtime/files/scheduled work: Convex
- Hosting: `convex.site`
- AI: Fireworks AI's OpenAI-compatible Chat Completions API with vision page images and strict `json_schema` output; PDF pages are rendered to images before inference because direct document inlining is unsupported
- Web research: Firecrawl and its Convex component where useful
- Email: AgentMail and its Convex component where useful
- Validation: the schema facility already required by the selected SDKs; avoid adding duplicate validation layers
- Styling: plain CSS or the minimum existing approach selected during scaffold; no component library is required for the MVP
- Tests: focused unit checks for deterministic money calculations and one end-to-end synthetic demo flow

Do not add a separate application database, job queue, object store, email provider, analytics vendor, or state-management library unless a verified blocker requires it.

## 17. Privacy, security, and safety requirements

- All real records require authentication and owner authorization.
- Real user data is never included in the public repository, screenshots, fixtures, logs, analytics, or demo.
- Synthetic documents must be obviously fictional and contain no copied real student identifiers.
- Raw uploads expire after seven days; users can delete them immediately.
- The UI must disclose that structured extracted data persists until workspace deletion.
- Storage URLs must not be exposed as permanent public links.
- API keys remain server-side.
- Webhooks require signature verification and idempotency checks.
- Uploaded files, scraped pages, and emails are untrusted input.
- HTML email is sanitized or rendered as plain text.
- Outbound email requires explicit approval every time.
- Recipient defaults to a verified official-school address; overrides produce a warning.
- Logs contain IDs/statuses, not raw PII or document/email bodies.
- The app does not claim FERPA compliance, legal advice, financial advice, or guaranteed accuracy.
- The app must visibly encourage verification before deadlines or financial commitments.
- The user can report an incorrect extraction and edit it directly.

## 18. Accessibility and responsive behavior

- Meet WCAG 2.2 AA for the core flow.
- All upload and email actions must be keyboard accessible.
- The comparison must not rely on color alone to distinguish grants, loans, risks, or status.
- Monetary values and table headers must have accessible labels.
- Live processing and reply updates must use non-disruptive status announcements.
- Focus moves to validation errors and returns predictably after dialogs.
- Source-page previews require text alternatives or extracted text.
- Mobile supports ingestion, review, comparison, and email approval without horizontal page overflow; a controlled comparison scroller is acceptable.
- Respect reduced-motion preferences.

## 19. Analytics and success metrics

Use privacy-preserving aggregate events only; do not send monetary values, school choices, document text, or email content to analytics.

### Core funnel

- Landing viewed
- Sample opened/completed
- Account created
- First offer ingested
- Second offer ingested
- Offer review completed
- Comparison viewed
- Question drafted
- Email approved/sent
- Reply received
- Question resolved
- Workspace deleted

### MVP success criteria

- At least 80% of the seeded extraction fields match expected fixtures without manual correction.
- 100% of calculation outputs match deterministic fixture expectations.
- A new user can reach a two-school comparison from the sample landing page in under 60 seconds.
- A real supported document can reach **Needs review** or **Ready** without developer intervention.
- Every material displayed number has a source or is explicitly user-entered/assumed.
- No loan or work-study amount is counted as gift aid in any fixture.
- The full draft → approve → send → reply → confirm → recalculate loop works in the deployed app.
- The public demo exposes no private data and requires no invite.
- Raw-file deletion works automatically and manually.

## 20. Acceptance criteria by epic

### Epic A: Ingestion and extraction

- Given an authenticated adult user and a valid supported offer, when they upload or forward it, then a private school card appears immediately and progresses reactively.
- Given a document with grants, loans, and work-study, when extraction completes, then each is stored and displayed in its correct canonical category with original labels and sources.
- Given an ambiguous amount or period, when extraction completes, then the value is marked for review rather than defaulted.
- Given a raw document older than seven days, when cleanup runs, then the stored file is deleted and the audit event records the deletion without retaining its contents.

### Epic B: Comparison

- Given two reviewed offers, when the user opens comparison, then annual cost, gift aid, net price, borrowing, work-study, gap, renewal risk, and four-year estimate are shown side by side.
- Given a loan mislabeled as an award in the source, then it appears under borrowing and does not reduce net price.
- Given unknown scholarship renewal, then the conservative four-year scenario excludes it after year one and explains why.
- Given a user correction, then all affected totals update live and the correction is visible in the audit trail.

### Epic C: Evidence

- Given a confirmed school, when research runs, then only official-domain pages are presented as school-policy evidence.
- Given a renewal conclusion, then selecting it opens the official source URL, excerpt, and retrieval date.
- Given no authoritative page, then AidLens labels the term unresolved and offers a clarification workflow.

### Epic D: Email resolution

- Given an unresolved material question, when the user requests a draft, then the generated email contains only verified case facts and an editable official recipient.
- Given a draft, when the user leaves without approval, then no email is sent.
- Given explicit approval, when AgentMail accepts the message, then queued/sent/delivered states appear live.
- Given a school reply, when it arrives, then the thread and proposed answer appear live without silently changing financial totals.
- Given user confirmation of the answer, then the affected field, comparison, question state, and audit timeline update together.

### Epic E: Safety and deletion

- Given one user, they cannot access another user's workspace by guessing IDs or calling backend functions directly.
- Given a deleted workspace, no associated private records or files remain accessible.
- Given prompt-like instructions in a webpage or email, they cannot trigger sending, data changes, or new tool calls without a permitted server workflow and explicit user action.

## 21. Synthetic demo fixture

The public demo uses two fictional institutions and two fictional students/offers created for AidLens.

### Offer A: North Valley University

- Higher total cost
- Large headline scholarship
- Scholarship renewal terms omitted from the offer
- Work-study included near gift aid
- Parent PLUS listed as an option
- Official page states a GPA and full-time enrollment renewal requirement

### Offer B: Lakeside State College

- Lower direct costs but higher transport estimate
- Smaller renewable grant
- Clear student-loan section
- One mandatory fee missing from the offer but present on the official cost page

### Demo resolution

AidLens flags North Valley's renewal condition as unresolved, drafts a question, sends it after approval, and receives a prepared real email reply through AgentMail confirming the GPA requirement and four-year duration. The comparison updates live and changes North Valley's four-year risk state without claiming the school is the better choice.

## 22. Three-minute demo script

### 0:00–0:20 — Problem

Show two visually incompatible fictional offers and say: “Both schools call this financial aid, but one includes loans and work-study in the headline number.”

### 0:20–0:45 — Ingest

Forward one offer to the AidLens AgentMail address. Show the school card appear immediately.

### 0:45–1:15 — Reactive processing

Show live states as Fireworks AI extracts the offer and Firecrawl finds official cost and renewal pages. Open one source-backed field.

### 1:15–1:45 — Compare

Reveal the side-by-side annual and four-year view. Highlight gift aid versus loans, remaining gap, and the unknown scholarship-renewal condition.

### 1:45–2:15 — Clarify

Open the question, review the cited evidence, edit the draft, and select **Approve and send**. Show AgentMail delivery state.

### 2:15–2:40 — Resolve live

Trigger or reveal the prepared inbound school reply. Show the question move to **Reply received**, confirm the extracted answer, and watch the four-year comparison recalculate through Convex.

### 2:40–3:00 — Close

Show the decision view: reviewed offers, remaining uncertainty, citations, and student-controlled choice. End with: “AidLens does not just read the letters. It gets the missing answers into the decision.”

## 23. Delivery plan and cut line

### Days 1–4

- New public repository and hackathon setup
- Vite/React/TypeScript/Convex project using `pnpm`
- `hackathon.md`
- Data ownership model
- Synthetic fixture and read-only public demo shell

### Days 5–8

- Upload and AgentMail forwarding ingestion
- Strict extraction schema
- Review/correction UI
- Raw-file retention and deletion

### Days 9–12

- Deterministic annual calculations
- Four-year conservative/optimistic scenarios
- Comparison board and insights
- Calculation checks against fixtures

### Days 13–15

- School identity confirmation
- Targeted Firecrawl research
- Citations, renewal risks, and question triggers

### Days 16–18

- Draft/edit/approve/send workflow
- Webhook verification and idempotency
- Reply extraction, confirmation, and reactive recalculation

### Days 19–21

- Authorization and deletion audit
- Failure states and accessibility pass
- Deployment to `convex.site`
- Public repository cleanup
- Social post, `hackathon.md` completion, and sub-three-minute video

### Cut order if schedule slips

Cut in this order:

1. Optimistic four-year scenario; keep conservative only.
2. User-entered savings/resources.
3. More than one active question per school.
4. College Scorecard contextual outcomes.
5. Email attachment handling for replies.

Do not cut source evidence, user review, deterministic calculations, approval before send, authorization, deletion, the synthetic public demo, or the end-to-end reply update.

## 24. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Comparison is perceived as a copycat | Weak creativity score | Lead the demo with the closed-loop clarification and reply-driven update; comparison remains the user promise, not the only capability. |
| Offer comparison is seasonally weaker during the event | Fewer live users during judging | Support rolling-admission, transfer, and current-student offers in copy; use a polished synthetic case and recruit testers with current/revised offers. |
| Extraction error changes a consequential total | Loss of trust or harmful decision | Strict schemas, source evidence, review-critical fields, deterministic math, editable values, and visible Preliminary state. |
| Four-year estimate appears authoritative | Misleading planning | Conservative defaults, exposed assumptions, incomplete labels, no hidden scoring, and explicit estimate language. |
| School policy is stale or conflicts with a reply | Incorrect guidance | Store retrieval dates, show conflicts, prefer case-specific replies after user confirmation, and never silently overwrite. |
| Email agent sends something unintended | Reputational harm | Explicit approval every time, editable draft, official-domain recipient restriction, verified webhooks, and idempotent sending. |
| Sensitive PII leaks in a public build | Severe privacy harm | Private authenticated records, synthetic-only demo/repo, seven-day raw retention, immediate deletion, safe logging, and authorization tests. |
| Provider use appears superficial | Lower hackathon score | Make live Convex state, Firecrawl evidence, Fireworks AI extraction, and AgentMail reply resolution visible in the primary flow. |
| Three-week scope expands | Missed deadline | Enforce two-to-four offers, one user role, common categories, targeted crawling, and the explicit cut order. |

## 25. Launch checklist

- New app implementation began on or after August 25, 2026.
- Public GitHub repository contains no secrets or real user data.
- `hackathon.md` documents the build, stack, live URL, and demo.
- App is publicly reachable at `convex.site` without an invite.
- Public sample completes the core flow without authentication.
- Private upload flow requires authentication and age confirmation.
- Convex queries, mutations, live updates, auth, storage, scheduling, and components are substantive and visible.
- Fireworks AI, Firecrawl, and AgentMail each perform indispensable work.
- Real outbound email requires approval.
- Manual and automatic deletion are verified.
- Accessibility and mobile core flows are checked.
- Three-minute video is under the limit and demonstrates the real deployed product.
- Social post tags Convex, Fireworks AI, Firecrawl, and AgentMail.
- Submission includes repository, live URL, and demo video before September 22 at 12:00 PM PT.

## 26. Locked founder decisions

- Offer comparison remains the headline product.
- Active clarification is the competitive differentiator.
- MVP user is the student only.
- MVP is limited to users age 18 or older.
- Input promise is upload or forward.
- Questions may route to Financial Aid or Bursar, with user override.
- Raw files are retained for seven days unless deleted sooner.
- Real outbound email ships in the MVP and always requires explicit user approval.
- `pnpm` is the required package manager.

## 27. Definition of done

AidLens MVP is done when an unauthenticated judge can open a polished synthetic comparison and an authenticated adult user can upload or forward two supported offers, review source-backed extraction, compare annual and conservative four-year costs, identify an unresolved material question, approve a real email to the correct school office, receive a reply, confirm the proposed answer, and watch the comparison update live—without loans or work-study being misrepresented as gift aid and without exposing another user's data.
