# AidLens research brief

_Research date: August 27, 2026. Primary and first-party sources were preferred. Product-gap conclusions are inferences from the cited market scan, not proof that no competitor exists._

## Executive recommendation

Do **not** lead with “upload several financial-aid offers and compare them.” That problem is real, but by 2026 it is a crowded feature and it is seasonally mismatched to an August 25–September 22 hackathon. Niche launched a free Financial Aid Decoder in March 2026 with document upload, standardized side-by-side views, direct/indirect costs, loans, net price, funding gaps, and four-year estimates; Award Advisor, TuitionFit, College Aid Pro, DecidED, and others cover similar ground.

The stronger product is a narrower, late-summer **aid-to-bill reconciliation desk**:

> **Forward your aid offer and first tuition bill. AidLens shows what changed, what is merely pending, what you actually owe now, and the exact question to send—then tracks the school’s reply until the discrepancy is resolved.**

This preserves the best original insight—turning inconsistent documents into an evidence-backed financial picture—but changes the job from passive comparison to active resolution. It is timely during the hackathon, less directly crowded, and makes AgentMail indispensable rather than decorative.

The MVP should reconcile **one school, one aid offer, one current bill/account statement, and public school policies**. It should not attempt autonomous payment, portal login, legal determinations, or a universal four-year forecast.

## The user problem is well established

The underlying information problem is unusually well documented:

- The U.S. Government Accountability Office reviewed a nationally representative sample of 176 colleges. Nearly two-thirds followed half or fewer of ten best practices; no sampled college followed all ten. An estimated **41% omitted net price** and **50% understated it**, often by excluding key costs or counting loans as if they reduced price. Federal law still does not require all colleges to use a clear standard offer. [GAO-23-104708](https://www.gao.gov/products/gao-23-104708)
- Federal Student Aid says there is **no standardized format or delivery method** for aid offers and that an offer may not give the full picture of attendance costs. It tells families to compare net price, distinguish money that is free, earned, or borrowed, and remember that work-study income is not guaranteed because the student must obtain and work a job. [Federal Student Aid: evaluating aid offers](https://studentaid.gov/articles/evaluating-financial-aid-offers/)
- The College Cost Transparency Initiative (CCT) requires participating schools to show cost of attendance split into costs paid to the school and costs paid to others; separate grants/scholarships, loans, and work; calculate net price using only grants and scholarships; disclose renewal conditions; and give actionable next steps and dates. Yet participation is voluntary. As of July 2026, CCT reports 758 partner institutions serving about 7.18 million students. [CCT standards](https://www.collegeprice.org/standards) · [CCT participation](https://www.collegeprice.org/home)
- The Department of Education’s current College Financing Plan remains a **voluntary/legacy consumer tool**, though its current HTML specification supports an XML download. This is useful as a canonical schema and optional fast path, not a document format AidLens can assume schools use. [2026–27 College Financing Plan](https://www.ed.gov/higher-education/paying-college/college-financing-plan)

The late-summer billing problem is a second, distinct layer. An aid offer is an annual eligibility communication; a bill is a time-specific ledger snapshot. Public university guidance shows why they diverge:

- Michigan says fall bills are issued before aid can be credited, so bills show a snapshot called “Pending Aid.” Private scholarships, private and PLUS loans, and some third-party credits may not appear there; a student may need to subtract pending aid manually. [University of Michigan: understanding the student bill](https://finaid.umich.edu/understanding-student-bill)
- UC San Diego says aid may be missing or lower because of enrollment units, waitlisted courses, missing documents, or late packaging; it directs students to contact financial aid after checking those conditions. [UCSD: troubleshooting missing or pending aid](https://support.ucsd.edu/students?id=kb_article_view&sysparm_article=KB0035930)
- Loyola says Direct Loans can remain pending until accepted, and accepted loans still require a Master Promissory Note and entrance counseling before funds can reach the account. [Loyola billing FAQ](https://www.loyola.edu/department/financial-aid/undergraduate/faqs/billing.html)
- MIT distinguishes “memoed” expected aid from posted payments, explains that a monthly bill is only a snapshot, and warns that the current portal balance can differ after later activity. [MIT: breaking down the bill](https://sfs.mit.edu/how-to-pay/understand-your-bill/sample-bill/)
- Federal rules add timing complexity: when Title IV funds create a credit balance, schools generally must pay it within 14 days after the balance occurs or 14 days after the first day of class, depending on timing. This is different from an institutional refund policy. [Federal Student Aid Handbook: disbursing funds](https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2024-2025/vol4/ch2-disbursing-fsa-funds)

This supports a concrete user question that existing comparison tools largely stop before answering: **“My offer said one thing, my bill says another, the deadline is close—do I owe this, is aid pending, or is something wrong?”**

## Canonical language and reconciliation model

AidLens should use the CCT/NASFAA vocabulary in storage and UI, while preserving each school’s original label beside it. NASFAA’s current glossary says “financial aid offer” is preferred over “award”; cost of attendance combines direct/billable costs and indirect costs paid to others; net price is cost of attendance minus grants and scholarships; loans must be repaid; Federal Work-Study is paid only as the student earns it; enrollment status can change eligibility; and verification may change the offer. [NASFAA glossary](https://www.nasfaa.org/glossary)

The product needs three separate totals. Collapsing them would recreate the confusion it is meant to solve:

1. **Annual estimated net price** = annual cost of attendance − grants and scholarships. This includes indirect estimates and is not the current bill.
2. **Current billed balance** = charges actually posted − payments/credits actually posted. This is a dated ledger snapshot.
3. **Actionable amount due** = the school’s stated current due, adjusted only for anticipated aid that the school’s own bill/policy says may be deducted. This must always show its evidence and confidence; AidLens should never silently invent the number.

Each offer/bill line should normalize to: original label; canonical category; amount; term/period; status (`offered`, `accepted`, `anticipated/pending`, `posted`, `reversed`, `earned later`, or `unknown`); source document/page; and confidence. Each discrepancy should be one of:

- **Timing:** offered/accepted aid has not disbursed yet.
- **Prerequisite:** loan acceptance, MPN, entrance counseling, verification, enrollment, or another document is incomplete.
- **Coverage mismatch:** work-study or an indirect cost was mistaken for a bill credit; private scholarship/PLUS/third-party aid is not yet received.
- **Charge change:** housing, meal plan, health insurance, course/program fee, prior balance, or enrollment changed.
- **Amount change/reversal:** the aid or charge genuinely differs from the offer.
- **Snapshot mismatch:** the PDF bill is older than the portal’s current balance.
- **Unresolved:** evidence is insufficient; ask the office rather than guessing.

The primary output is not “AI says the answer.” It is a short, cited resolution card:

> **$4,260 is due August 31.** $18,400 of grants are pending and already excluded from the amount due. Your $2,750 Direct Loan is absent; the school says first-year loans require acceptance, an MPN, and entrance counseling. **Check those three items.** If complete, send the drafted question to Financial Aid.

## Market and differentiation

### Direct competitors to the original comparison concept

| Product | First-party promise | Gap AidLens should exploit |
|---|---|---|
| Niche Financial Aid Decoder / True Cost | Free upload; standardized side-by-side direct/indirect costs, loans, net price, funding gap, and four-year estimates. [Niche](https://www.niche.com/about/niche-launches-college-financial-aid-comparison-tool-to-help-families-decode-and-compare-offers/) | Makes a pre-enrollment decision; no claimed bill reconciliation or closed-loop office correspondence. |
| Award Advisor | Upload/scan offers, normalize them, add family resources, compare up to four schools, and share results. [Award Advisor](https://awardadvisor.org/) | Stops at understanding and comparison. |
| TuitionFit | Upload an offer, benchmark real net price against peers, and identify negotiation room. [TuitionFit](https://tuitionfit.org/) | Stronger on market benchmarking/negotiation; not a post-enrollment account-resolution workflow. |
| College Aid Pro | Upload and compare offers, score appeal likelihood, and offer expert appeal help. [College Aid Pro](https://collegeaidpro.com/mycap-award-analyzer/) | Appeals are covered; routine bill-to-offer discrepancy resolution is a different job. |
| DecidED | Upload an offer photo, calculate affordability, compare fit, and support advisors with real-time progress. [DecidED](https://decided.org/) | Counselor-supported selection, not ongoing reconciliation. |
| CollegeBinder | Offer upload/comparison plus sourced deadline tracking. It explicitly says uploads are not stored and users can delete account data. [CollegeBinder](https://collegebinder.com/) | Shows that privacy and sourced deadlines are table stakes; still does not claim bill reconciliation or email resolution. |

The scan found many offer analyzers and manual worksheets, but no first-party consumer product clearly promising the full chain **offer + bill + school policy → discrepancy diagnosis → approved email → reply-driven update**. That is a credible wedge, not a defensible long-term moat by itself.

### Original versus refined concept

| Dimension | Pre-enrollment offer comparison | Late-summer bill reconciliation |
|---|---|---|
| Immediate 2026 competition | High; Niche and several focused tools already upload and normalize letters | Lower in this scan |
| Seasonal fit for Aug 25–Sep 22 | Weak; the normal U.S. commitment deadline is generally in spring | Strong; fall bills, pending aid, disbursement, and missing requirements are live |
| AgentMail necessity | Optional unless the app invents an appeal flow | Core: draft, approve, send, receive, and resolve a real discrepancy thread |
| Firecrawl necessity | Useful for costs and renewal terms | Core evidence for school-specific billing, disbursement, fee, waiver, and contact policies |
| Demo clarity | “Here is a prettier comparison” | “The scary $22k balance becomes $4,260 due; one missing loan requirement is identified; the school reply resolves it live” |
| Repeat use | A few weeks during college selection | Every bill/term, especially first year, aid changes, or enrollment changes |
| Main risk | Commodity feature | School-specific rules and stale/snapshot documents can make conclusions unsafe |

Recommendation: make reconciliation the product headline. Retain a simple normalized offer view only because it is an input to the bill check. Add multi-school comparison later if users ask for it.

## Sponsor fit and current implementation facts

The official hackathon asks for something ordinary people can use “this week,” deep Convex use, and substantive OpenAI, Firecrawl, and AgentMail work. The build runs August 25–September 22; only new apps qualify; the frontend must be publicly reachable at `convex.site` or `chatgpt.site`; and the entry needs a public repository, `hackathon.md`, social post, and sub-three-minute video. No OpenAI or Convex build credits are included, while registered participants receive substantial Firecrawl credits. [Official All Gas page](https://www.convex.dev/hackathons/all-gas)

- **Convex:** store households, cases, extracted line items, discrepancies, evidence, questions, and audit events. Reactive queries make the case status update as extraction, crawling, email delivery, and replies finish. The Firecrawl component can persist crawl pages/progress reactively and validates webhooks; the AgentMail component persists full threads and delivery states and provides durable sending/retries. [Firecrawl Convex component](https://www.convex.dev/components/firecrawl/firecrawl-convex) · [AgentMail Convex component](https://www.convex.dev/components/agentmail/convex)
- **OpenAI:** accept PDF files by URL, file ID, or base64; vision-capable models process both extracted PDF text and page images. Strict Structured Outputs can force extracted line items and evidence fields into a JSON schema. This fits document normalization, discrepancy classification, and drafting—but arithmetic and state transitions should be deterministic code, not model prose. [OpenAI PDF inputs](https://developers.openai.com/api/docs/guides/pdf-files) · [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- **Firecrawl:** search official school domains, scrape billing/disbursement/fee/waiver pages, and return markdown or structured JSON. Its Convex component can show live crawl progress and retry transient failures. Limit the MVP to a small allowlisted set of official domains/pages; whole-site crawling adds latency, noisy evidence, and a 1 MB Convex document ceiling that can truncate stored pages. [Firecrawl component limits](https://www.convex.dev/components/firecrawl/firecrawl-convex)
- **AgentMail:** create a case inbox, receive forwards and attachments, preserve thread context, create drafts/replies, and expose delivered/bounced status. Incoming mail receives spam/virus checks; attachment bodies are fetched separately from webhook metadata. Webhook signatures must be verified. Sending should require an explicit user click and preferably a recipient allowlist. [Inbox capabilities](https://docs.agentmail.to/knowledge-base/inbox-capabilities) · [Webhook verification](https://docs.agentmail.to/webhook-verification) · [Human-in-the-loop guardrails](https://docs.agentmail.to/knowledge-base/human-in-the-loop)

### Useful public data

- **College Scorecard API/data:** institution IDs, official URLs, price-calculator URLs, reported cost/net-price context, outcomes, and debt metrics. Use it to identify a school and sanity-check broad context, never to override the student’s current bill or offer; reported data lag and averages are not personalized. [College Scorecard technical documentation](https://collegescorecard.ed.gov/files/InstitutionDataDocumentation.pdf) · [API query specification](https://github.com/18F/open-data-maker/blob/dev/API.md)
- **IPEDS downloads:** current institutional cost, tuition/fees, housing/food, student-aid, and derived cost-of-attendance files. These are better for research/baselines than a three-week transactional MVP. [IPEDS Data Center](https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx)
- **College Financing Plan XML:** a machine-readable fast path when a school provides it, plus a strong canonical field model. PDF/image/email extraction remains necessary because adoption and format are not universal. [Department of Education CFP](https://www.ed.gov/higher-education/paying-college/college-financing-plan)
- **Official school pages:** the most relevant live source for payment due dates, pending-aid treatment, disbursement schedules, health-insurance waivers, enrollment requirements, late fees, and office contacts. Firecrawl should capture URL, retrieval time, and exact supporting excerpt for every conclusion.

## Privacy, security, and trust boundaries

Financial-aid offers and bills commonly contain names, student identifiers, addresses, aid amounts, and other education-record PII. FERPA defines PII broadly, including direct and indirect identifiers. FERPA primarily regulates education institutions and their disclosures; a student-chosen consumer app should not market itself as “FERPA compliant” without counsel and an institutional relationship. [Department of Education: education-record PII](https://studentprivacy.ed.gov/content/personally-identifiable-information-education-records) · [FERPA financial-aid disclosure FAQ](https://studentprivacy.ed.gov/faq/may-postsecondary-institution-disclose-financial-aid-records-without-written-consent)

Minimum product safeguards:

1. Require authentication and enforce ownership in every query/mutation. A public synthetic demo mode can satisfy judge access; real documents must never be public.
2. Accept only PDF/JPEG/PNG within strict size limits. Do not request FAFSA forms, tax returns, Social Security numbers, bank details, credentials, or portal access. Warn users to redact those fields.
3. Store extracted fields and source snippets; delete raw documents automatically after a short disclosed period, with an immediate “delete case and files” control. Avoid logging document bodies or email text.
4. Do not expose raw Convex storage URLs. Convex documents that `storage.getUrl()` links are bearer URLs accessible to anyone who has the link; sensitive files need an authorization-checked HTTP path or deletion after extraction. [Convex file-storage security model](https://docs.convex.dev/file-storage/overview)
5. Use OpenAI’s API, not a consumer chat workflow. API inputs/outputs are not used for model training by default, but may ordinarily be retained for abuse monitoring for up to 30 days; disclose vendor processing and do not claim zero retention unless the account/endpoint is actually approved for it. [OpenAI enterprise privacy](https://openai.com/enterprise-privacy/) · [API data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)
6. Treat all document, webpage, and email text as untrusted data. Never let it issue tool instructions. OWASP specifically identifies indirect prompt injection from email/web content and recommends least privilege plus human approval for high-risk actions. [OWASP prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) · [OWASP excessive agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
7. Never auto-send, auto-accept aid, change enrollment, initiate payment, or state that a bill is legally invalid. Show extraction confidence, evidence, and “needs confirmation.” Let the student edit every amount and approve every outbound message.
8. For the MVP, serve users 16+ (or 18+) and avoid collecting data from children. COPPA governs services directed to children under 13 or those with actual knowledge they collect children’s personal information. [FTC COPPA rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa)

## Three-week MVP

### Must ship

1. **Synthetic public demo + authenticated private case:** judges can run a complete seeded case without exposing real PII.
2. **Ingest two document types:** one financial-aid offer and one current bill/account statement, by upload or forwarding to an AgentMail address.
3. **Strict extraction with correction:** OpenAI returns canonical line items, page/source evidence, and confidence; the user reviews/corrects uncertain fields before reconciliation.
4. **Deterministic reconciliation:** code matches aid and charges by category/amount/term/status and emits a small set of discrepancy types. The model may explain the result but must not perform the authoritative arithmetic.
5. **School-policy evidence:** Firecrawl searches/scrapes only the identified school’s public domain for billing, pending-aid/disbursement, and contact guidance; every suggested action links to a source and retrieval date.
6. **Approved question workflow:** AidLens drafts one focused question, user edits and approves it, AgentMail sends it, delivery status is live, and an incoming reply updates the discrepancy from `waiting` to `resolved` or `needs review`.
7. **Audit trail and deletion:** show what came from the offer, bill, official page, user correction, and school reply; support deletion of the case and raw files.

### Explicitly skip

- Multi-school comparison and four-year projections.
- FAFSA/StudentAid.gov or school-portal login and credential handling.
- Automatic appeals, payment, loan acceptance, or enrollment changes.
- Whole-site continuous monitoring; one current crawl per case is enough.
- Parent/counselor collaboration, multilingual support, native mobile apps, and a generalized inbox.
- A large taxonomy of every possible aid program. Support the common CCT categories plus `other/unknown` and manual correction.

### Suggested 21-day cut line

- **Days 1–5:** seeded demo, schema, upload/forward, raw document lifecycle, one offer and one bill extractor.
- **Days 6–10:** reviewed extraction UI, deterministic reconciliation, evidence links, three representative synthetic fixtures.
- **Days 11–14:** Firecrawl official-policy retrieval and school contact discovery.
- **Days 15–17:** approved AgentMail draft/send/reply loop with webhook verification and delivery states.
- **Days 18–21:** auth/authorization audit, deletion, failure states, deployment, `hackathon.md`, and video polish.

The most important demo fixture should contain: a frightening total balance; grants shown as pending; work-study that does not reduce the bill; an absent first-year loan because a prerequisite is incomplete; a new health-insurance or program fee; and a school reply that resolves one item. This creates a visual before/after while remaining realistic.

## Feasibility and principal risks

| Risk | Why it matters | MVP control |
|---|---|---|
| Document extraction error | A wrong amount can cause a late payment or false reassurance | Require source-page evidence and review uncertain fields before calculation; deterministic totals |
| School-specific semantics | “Pending,” “memoed,” “anticipated,” and amount-due formulas differ | Crawl and cite that school’s policy; unresolved beats guessed |
| Stale statements | PDF bills are snapshots while the portal changes | Show statement date and ask user to confirm current balance before acting |
| Portal-only documents | Bills often require authenticated portals; Firecrawl cannot safely access them | User downloads/uploads or forwards the document; never collect portal credentials |
| Email agency and prompt injection | Incoming email/web text could manipulate an agent | Treat content as data, restrict tools/recipients, verify webhooks, require review-and-send |
| Sensitive PII in a public hackathon | Public repo/demo creates accidental exposure risk | Synthetic fixtures only in repo and demo; authenticated real cases; raw-file deletion |
| Weak sponsor fit | A simple upload analyzer could look like a thin AI wrapper | Show live crawl progress, extraction/review, delivery states, reply arrival, and case resolution through Convex |
| Scope | Universal reconciliation is not possible in three weeks | One school per case, two documents, common categories, manual correction, `unknown` state |
| Cost/latency | Multiple PDF model calls and whole-site crawls can be slow/expensive | One extraction per document, targeted official pages, cache results by school/URL, small model for drafts if quality permits |

## Open product decisions for the founder

1. **Primary user:** first-year undergraduate alone, or student plus parent? The latter increases sharing/consent complexity; default to the student for MVP.
2. **Age floor:** 16+ or 18+? An 18+ beta is simplest; a 16+ product better matches applicants but requires more careful minor/privacy design.
3. **Input promise:** uploads only, or “forward everything”? Forwarding is a stronger AgentMail story, but many bills live behind portals. Recommended copy: **“Upload or forward your offer and bill.”**
4. **Resolution boundary:** questions to Financial Aid only, or route between Financial Aid and Bursar? Recommended: support both, choosing from official contact evidence and letting the user override.
5. **Raw-document retention:** delete immediately after reviewed extraction, or retain briefly for reprocessing? Recommended MVP default: seven days or immediate user-triggered deletion, clearly disclosed.
6. **Truth standard:** should an official policy page override a human school reply? Recommended: no. Show conflicts and dates; the latest case-specific reply is stronger evidence but still not silently authoritative.
7. **Brand promise:** “explain my bill” is safer and clearer than “tell me exactly what I owe.” Recommended headline: **“Know what changed. Know what to do next.”**

## Bottom line

AidLens is promising if it stops trying to be another college-offer comparator. The high-value, seasonally aligned product is a **case-resolution system for the gap between promised aid and the first real bill**. Its durable loop—documents → cited discrepancy → approved question → school reply → live resolution—uses every sponsor for indispensable work, produces a strong three-minute demo, and addresses a user problem that official guidance shows is both common and consequential.
