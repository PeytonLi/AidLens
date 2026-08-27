/**
 * Immutable synthetic public-sample fixtures (§25.1).
 *
 * Both offers are fictional and not issued by UC San Diego or Loyola
 * University Maryland. Marked synthetic: true.
 *
 * Expected totals from calculateComparison
 * (assumptions: annualCostGrowthBps=300, scenario as noted):
 *
 * UC San Diego (complete):
 *   COA $32,200.00 | gift aid $25,000.00 | annual net $7,200.00
 *   work-study $2,400.00 | Parent PLUS $8,000.00 | student loans $0
 *   conservative 4-year net total: $88,712.79
 *     Y1 $7,200.00 | Y2 $26,166.00 | Y3 $27,160.98 | Y4 $28,185.81
 *   optimistic 4-year net total: $34,712.79
 *     (conditional Regents Scholarship renews in optimistic only)
 *
 * Loyola University Maryland (incomplete — missing Housing and food):
 *   known COA $59,200.00 | gift aid $17,000.00 | annual net Incomplete ($0)
 *   student loans $7,500.00 | work-study $0 | Parent PLUS $0
 *   conservative/optimistic 4-year net total (known costs only): $179,670.72
 *     Y1 $42,200.00 | Y2 $43,976.00 | Y3 $45,805.28 | Y4 $47,689.44
 */

import type {
  Assumptions,
  ComparisonInput,
  OfferInput,
} from "../../domain/comparison";

export type SourceKind = "fictional_document" | "official_policy";

export type SampleSource = {
  id: string;
  kind: SourceKind;
  title: string;
  hostname: string;
  type: string;
  retrievalDate: string;
  excerpt: string;
};

export type ClarificationStoryState =
  "question_open" | "reply_received" | "confirmed";

export type ClarificationStoryStep = {
  id: string;
  state: ClarificationStoryState;
  label: string;
  detail: string;
};

export type SampleFixture = {
  synthetic: true;
  offers: OfferInput[];
  defaultAssumptions: Assumptions;
  sources: SampleSource[];
  clarificationStory: ClarificationStoryStep[];
};

export const SAMPLE_ASSUMPTIONS: Assumptions = {
  annualCostGrowthBps: 300,
  scenario: "conservative",
};

/** Deterministic UCSD fictional offer — larger scholarship, renewal ambiguity. */
export const ucsdOffer: OfferInput = {
  id: "ucsd",
  schoolName: "UC San Diego",
  assumptionTags: {
    housing: "on_campus",
    residency: "in_state",
    enrollment: "full_time",
    period: "2025-26",
  },
  lineItems: [
    {
      id: "ucsd-tuition",
      category: "direct_cost",
      amountCents: 1_500_000,
      label: "Tuition and fees",
      required: true,
      period: "2025-26",
    },
    {
      id: "ucsd-housing",
      category: "direct_cost",
      amountCents: 1_600_000,
      label: "Housing and food",
      required: true,
      period: "2025-26",
    },
    {
      id: "ucsd-books",
      category: "indirect_cost",
      amountCents: 120_000,
      label: "Books and supplies",
      required: true,
      period: "2025-26",
    },
    {
      id: "ucsd-scholarship",
      category: "scholarship",
      amountCents: 1_800_000,
      label: "Regents Scholarship",
      // Renewal ambiguity: conditional — only optimistic renews beyond year 1
      renewal: { kind: "conditional" },
      period: "2025-26",
    },
    {
      id: "ucsd-pell",
      category: "grant",
      amountCents: 700_000,
      label: "Federal Pell Grant",
      renewal: { kind: "fixed", durationYears: 4 },
      period: "2025-26",
    },
    {
      id: "ucsd-ws",
      category: "work_study",
      amountCents: 240_000,
      label: "Federal Work-Study",
      period: "2025-26",
    },
    {
      id: "ucsd-plus",
      category: "parent_plus",
      amountCents: 800_000,
      label: "Parent PLUS Loan",
      period: "2025-26",
    },
  ],
};

/**
 * Deterministic Loyola fictional offer — different direct-cost mix, clear loans,
 * smaller renewable gift aid, one missing required cost → Incomplete.
 */
export const loyolaOffer: OfferInput = {
  id: "loyola",
  schoolName: "Loyola University Maryland",
  assumptionTags: {
    housing: "on_campus",
    residency: "out_of_state",
    enrollment: "full_time",
    period: "2025-26",
  },
  lineItems: [
    {
      id: "loy-tuition",
      category: "direct_cost",
      amountCents: 5_600_000,
      label: "Tuition",
      required: true,
      period: "2025-26",
    },
    {
      id: "loy-fees",
      category: "direct_cost",
      amountCents: 180_000,
      label: "Mandatory fees",
      required: true,
      period: "2025-26",
    },
    {
      id: "loy-housing",
      category: "direct_cost",
      amountCents: null,
      label: "Housing and food",
      required: true,
      period: "2025-26",
    },
    {
      id: "loy-books",
      category: "indirect_cost",
      amountCents: 140_000,
      label: "Books and supplies",
      required: true,
      period: "2025-26",
    },
    {
      id: "loy-merit",
      category: "scholarship",
      amountCents: 1_200_000,
      label: "Presidential Merit Scholarship",
      renewal: { kind: "fixed", durationYears: 4 },
      period: "2025-26",
    },
    {
      id: "loy-grant",
      category: "grant",
      amountCents: 500_000,
      label: "Loyola Grant",
      renewal: { kind: "fixed", durationYears: 4 },
      period: "2025-26",
    },
    {
      id: "loy-stafford",
      category: "student_loan",
      amountCents: 550_000,
      label: "Federal Direct Subsidized Loan",
      period: "2025-26",
    },
    {
      id: "loy-unsub",
      category: "student_loan",
      amountCents: 200_000,
      label: "Federal Direct Unsubsidized Loan",
      period: "2025-26",
    },
  ],
};

export const sampleSources: SampleSource[] = [
  {
    id: "src-ucsd-award",
    kind: "fictional_document",
    title: "UC San Diego Financial Aid Award Letter (synthetic)",
    hostname: "sample.aidlens.local",
    type: "Offer document",
    retrievalDate: "2026-03-01",
    excerpt:
      "This fictional award letter is not issued by UC San Diego. Regents Scholarship: $18,000 — renewal subject to satisfactory academic progress (terms not fully stated on this letter).",
  },
  {
    id: "src-loyola-award",
    kind: "fictional_document",
    title: "Loyola University Maryland Award Summary (synthetic)",
    hostname: "sample.aidlens.local",
    type: "Offer document",
    retrievalDate: "2026-03-01",
    excerpt:
      "This fictional award summary is not issued by Loyola University Maryland. Housing and food: amount not listed on the award letter.",
  },
  {
    id: "src-loyola-housing-policy",
    kind: "official_policy",
    title: "Cost of Attendance — Housing and Food",
    hostname: "www.loyola.edu",
    type: "Official school policy",
    retrievalDate: "2026-03-12",
    excerpt:
      "Official Loyola University Maryland cost-of-attendance pages list on-campus housing and food as a required budget component for full-time undergraduates.",
  },
];

export const clarificationStory: ClarificationStoryStep[] = [
  {
    id: "story-open",
    state: "question_open",
    label: "Question open",
    detail:
      "Ask Loyola whether on-campus housing and food is required for this award year and what amount belongs on the award letter.",
  },
  {
    id: "story-reply",
    state: "reply_received",
    label: "Reply received",
    detail:
      "School reply (sanitized): Housing and food for on-campus students is $16,450 for 2025–26 and should appear on the award.",
  },
  {
    id: "story-confirmed",
    state: "confirmed",
    label: "Confirmed",
    detail:
      "After you confirm the reply, AidLens would update the Loyola offer and recalculate the comparison. This demo stops at the guided story — no send or edit.",
  },
];

export const sampleFixture: SampleFixture = {
  synthetic: true,
  offers: [ucsdOffer, loyolaOffer],
  defaultAssumptions: SAMPLE_ASSUMPTIONS,
  sources: sampleSources,
  clarificationStory,
};

export function buildSampleComparisonInput(
  scenario: Assumptions["scenario"] = "conservative",
): ComparisonInput {
  return {
    offers: sampleFixture.offers,
    assumptions: {
      ...sampleFixture.defaultAssumptions,
      scenario,
    },
  };
}
