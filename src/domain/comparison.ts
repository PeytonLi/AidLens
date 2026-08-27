export type MoneyCents = number;

export type AidCategory =
  | "direct_cost"
  | "indirect_cost"
  | "grant"
  | "scholarship"
  | "student_loan"
  | "parent_plus"
  | "private_loan"
  | "work_study"
  | "other_financing"
  | "family_contribution"
  | "payment_plan"
  | "unknown";

export type ItemStatus = "offered" | "accepted" | "declined" | "selected";

export type Renewal =
  | { kind: "one_time" }
  | { kind: "nonrenewable" }
  | { kind: "fixed"; durationYears: number }
  | { kind: "conditional" }
  | { kind: "unknown" };

export type LineItem = {
  id: string;
  category: AidCategory;
  amountCents: MoneyCents | null;
  label?: string;
  status?: ItemStatus;
  renewal?: Renewal;
  period?: string;
  required?: boolean;
};

export type AssumptionTags = {
  housing?: string;
  residency?: string;
  enrollment?: string;
  period?: string;
};

export type OfferInput = {
  id: string;
  schoolName: string;
  lineItems: LineItem[];
  selectedStudentLoanIds?: string[];
  confirmedResourceCents?: MoneyCents;
  assumptionTags?: AssumptionTags;
};

export type Assumptions = {
  annualCostGrowthBps: number;
  scenario: "conservative" | "optimistic";
};

export type ComparisonInput = {
  offers: OfferInput[];
  assumptions: Assumptions;
};

export type Completeness =
  | { status: "complete" }
  | { status: "incomplete"; missingComponents: string[] };

export type Warning = {
  code: string;
  message: string;
};

export type Insight = {
  code: string;
  message: string;
};

export type FourYearProjection = {
  years: Array<{
    year: number;
    costCents: MoneyCents;
    giftAidCents: MoneyCents;
    netPriceCents: MoneyCents;
  }>;
  totalNetPriceCents: MoneyCents;
};

export type OfferComparison = {
  offerId: string;
  schoolName: string;
  totalDirectCostCents: MoneyCents;
  totalIndirectCostCents: MoneyCents;
  totalCostOfAttendanceCents: MoneyCents;
  giftAidCents: MoneyCents;
  annualNetPriceCents: MoneyCents;
  studentLoansOfferedCents: MoneyCents;
  parentFinancingOfferedCents: MoneyCents;
  workStudyOfferedCents: MoneyCents;
  remainingFundingGapCents: MoneyCents;
  completeness: Completeness;
  warnings: Warning[];
  fourYear: FourYearProjection;
  negativeNetPrice: boolean;
};

export type ComparisonResult = {
  offers: OfferComparison[];
  warnings: Warning[];
  insights: Insight[];
};

const GIFT_AID: AidCategory[] = ["grant", "scholarship"];
const PARENT_FINANCING: AidCategory[] = [
  "parent_plus",
  "private_loan",
  "other_financing",
];
const MAX_ACTIVE_OFFERS = 4;

function assertIntegerCents(value: MoneyCents, context: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer cents (${context}), got ${value}`);
  }
}

function activeItems(items: LineItem[]): LineItem[] {
  return items.filter((item) => item.status !== "declined");
}

function sumByCategory(
  items: LineItem[],
  categories: AidCategory[],
): MoneyCents {
  return items
    .filter(
      (item) => categories.includes(item.category) && item.amountCents != null,
    )
    .reduce((sum, item) => sum + (item.amountCents as number), 0);
}

function collectDistinctPeriods(items: LineItem[]): string[] {
  const periods = new Set<string>();
  for (const item of items) {
    if (item.period !== undefined) {
      periods.add(item.period);
    }
  }
  return [...periods];
}

function missingRequiredComponents(items: LineItem[]): string[] {
  return items
    .filter(
      (item) =>
        item.required === true &&
        item.amountCents == null &&
        (item.category === "direct_cost" || item.category === "indirect_cost"),
    )
    .map((item) => item.label ?? item.id);
}

function giftAidAppliesInYear(
  item: LineItem,
  year: number,
  scenario: Assumptions["scenario"],
): boolean {
  if (item.amountCents == null) return false;
  if (!GIFT_AID.includes(item.category)) return false;

  const renewal = item.renewal ?? { kind: "unknown" as const };

  if (year === 1) return true;

  switch (renewal.kind) {
    case "one_time":
    case "nonrenewable":
    case "unknown":
      return false;
    case "fixed":
      return year <= renewal.durationYears;
    case "conditional":
      return scenario === "optimistic";
  }
}

function giftAidForYear(
  items: LineItem[],
  year: number,
  scenario: Assumptions["scenario"],
): MoneyCents {
  return items
    .filter((item) => giftAidAppliesInYear(item, year, scenario))
    .reduce((sum, item) => sum + (item.amountCents as number), 0);
}

function projectFourYear(
  year1CostCents: MoneyCents,
  items: LineItem[],
  assumptions: Assumptions,
): FourYearProjection {
  const growth = assumptions.annualCostGrowthBps / 10_000;
  const years = [];

  for (let year = 1; year <= 4; year++) {
    const costCents = Math.round(year1CostCents * (1 + growth) ** (year - 1));
    const giftAidCents = giftAidForYear(items, year, assumptions.scenario);
    years.push({
      year,
      costCents,
      giftAidCents,
      netPriceCents: costCents - giftAidCents,
    });
  }

  return {
    years,
    totalNetPriceCents: years.reduce((sum, y) => sum + y.netPriceCents, 0),
  };
}

function selectedStudentLoanCents(
  items: LineItem[],
  selectedIds: string[] | undefined,
): MoneyCents {
  if (!selectedIds || selectedIds.length === 0) return 0;
  const selected = new Set(selectedIds);
  return items
    .filter(
      (item) =>
        item.category === "student_loan" &&
        selected.has(item.id) &&
        item.amountCents != null,
    )
    .reduce((sum, item) => sum + (item.amountCents as number), 0);
}

function validateOfferMoney(offer: OfferInput): void {
  for (const item of offer.lineItems) {
    if (item.amountCents != null) {
      assertIntegerCents(item.amountCents, `line item ${item.id}`);
    }
  }
  if (offer.confirmedResourceCents != null) {
    assertIntegerCents(
      offer.confirmedResourceCents,
      `confirmed resources for ${offer.id}`,
    );
  }
}

function compareOffer(
  offer: OfferInput,
  assumptions: Assumptions,
): OfferComparison {
  validateOfferMoney(offer);

  const items = activeItems(offer.lineItems);
  const warnings: Warning[] = [];
  const missing = missingRequiredComponents(items);
  const periods = collectDistinctPeriods(items);
  const periodMismatch = periods.length > 1;

  if (periodMismatch) {
    warnings.push({
      code: "period_mismatch",
      message:
        "Line items cover different academic periods and were not summed.",
    });
  }

  let totalDirectCostCents = 0;
  let totalIndirectCostCents = 0;
  let totalCostOfAttendanceCents = 0;
  let giftAidCents = 0;
  let annualNetPriceCents = 0;
  let studentLoansOfferedCents = 0;
  let parentFinancingOfferedCents = 0;
  let workStudyOfferedCents = 0;

  if (!periodMismatch) {
    totalDirectCostCents = sumByCategory(items, ["direct_cost"]);
    totalIndirectCostCents = sumByCategory(items, ["indirect_cost"]);
    totalCostOfAttendanceCents = totalDirectCostCents + totalIndirectCostCents;
    giftAidCents = sumByCategory(items, GIFT_AID);
    annualNetPriceCents = totalCostOfAttendanceCents - giftAidCents;
    studentLoansOfferedCents = sumByCategory(items, ["student_loan"]);
    parentFinancingOfferedCents = sumByCategory(items, PARENT_FINANCING);
    workStudyOfferedCents = sumByCategory(items, ["work_study"]);
  }

  const completeness: Completeness =
    missing.length > 0 || periodMismatch
      ? {
          status: "incomplete",
          missingComponents: missing,
        }
      : { status: "complete" };

  // Incomplete required costs: do not report a usable net price.
  if (missing.length > 0) {
    annualNetPriceCents = 0;
  }

  const selectedLoans = selectedStudentLoanCents(
    items,
    offer.selectedStudentLoanIds,
  );
  const confirmedResources = offer.confirmedResourceCents ?? 0;
  const remainingFundingGapCents =
    annualNetPriceCents - selectedLoans - confirmedResources;

  const negativeNetPrice = annualNetPriceCents < 0;
  if (negativeNetPrice) {
    warnings.push({
      code: "negative_net_price",
      message:
        "Negative net price may reflect gift aid exceeding billed costs; indirect costs and refund timing can differ.",
    });
  }

  const year1CostForProjection = periodMismatch
    ? 0
    : totalCostOfAttendanceCents;
  const fourYear = projectFourYear(year1CostForProjection, items, assumptions);

  return {
    offerId: offer.id,
    schoolName: offer.schoolName,
    totalDirectCostCents,
    totalIndirectCostCents,
    totalCostOfAttendanceCents,
    giftAidCents,
    annualNetPriceCents,
    studentLoansOfferedCents,
    parentFinancingOfferedCents,
    workStudyOfferedCents,
    remainingFundingGapCents,
    completeness,
    warnings,
    fourYear,
    negativeNetPrice,
  };
}

function collectAssumptionMismatchWarnings(offers: OfferInput[]): Warning[] {
  const warnings: Warning[] = [];
  const keys: Array<keyof AssumptionTags> = [
    "housing",
    "residency",
    "enrollment",
    "period",
  ];

  for (const key of keys) {
    const values = new Set<string>();
    for (const offer of offers) {
      const value = offer.assumptionTags?.[key];
      if (value !== undefined) {
        values.add(value);
      }
    }
    if (values.size > 1) {
      warnings.push({
        code: `${key}_mismatch`,
        message: `Offers use different ${key} assumptions.`,
      });
    }
  }

  return warnings;
}

function buildInsights(offers: OfferComparison[]): Insight[] {
  if (offers.length === 0) return [];

  const insights: Insight[] = [];
  const byNet = [...offers].sort(
    (a, b) => a.annualNetPriceCents - b.annualNetPriceCents,
  );
  const lowest = byNet[0];
  insights.push({
    code: "lowest_reviewed_annual_net_price",
    message: `${lowest.schoolName} has the lowest annual net price (${lowest.annualNetPriceCents} cents).`,
  });

  const byGift = [...offers].sort((a, b) => b.giftAidCents - a.giftAidCents);
  const mostGift = byGift[0];
  if (mostGift.giftAidCents > 0) {
    insights.push({
      code: "largest_gift_aid",
      message: `${mostGift.schoolName} has the largest gift-aid amount (${mostGift.giftAidCents} cents).`,
    });
  }

  const byGap = [...offers].sort(
    (a, b) => b.remainingFundingGapCents - a.remainingFundingGapCents,
  );
  const largestGap = byGap[0];
  insights.push({
    code: "largest_remaining_funding_gap",
    message: `${largestGap.schoolName} has the largest remaining funding gap (${largestGap.remainingFundingGapCents} cents).`,
  });

  return insights;
}

export function calculateComparison(input: ComparisonInput): ComparisonResult {
  if (input.offers.length > MAX_ACTIVE_OFFERS) {
    throw new Error(
      `At most ${MAX_ACTIVE_OFFERS} active offers are allowed (received ${input.offers.length}).`,
    );
  }

  const offers = input.offers.map((offer) =>
    compareOffer(offer, input.assumptions),
  );

  return {
    offers,
    warnings: collectAssumptionMismatchWarnings(input.offers),
    insights: buildInsights(offers),
  };
}
