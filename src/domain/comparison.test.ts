import { describe, expect, it } from "vitest";
import {
  calculateComparison,
  type ComparisonInput,
  type LineItem,
  type OfferInput,
} from "./comparison";

const conservative = {
  annualCostGrowthBps: 300,
  scenario: "conservative" as const,
};

function offer(
  partial: Partial<OfferInput> & Pick<OfferInput, "id" | "lineItems">,
): OfferInput {
  return {
    schoolName: partial.schoolName ?? "North Valley",
    ...partial,
  };
}

function base(overrides: Partial<ComparisonInput> = {}): ComparisonInput {
  return {
    offers: overrides.offers ?? [],
    assumptions: overrides.assumptions ?? conservative,
  };
}

describe("calculateComparison", () => {
  it("S1.1: grants and scholarships reduce annual net price", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 40_000_00,
                required: true,
              },
              { id: "grant", category: "grant", amountCents: 10_000_00 },
              {
                id: "scholarship",
                category: "scholarship",
                amountCents: 5_000_00,
              },
            ],
          }),
        ],
      }),
    );

    const o = result.offers[0];
    expect(o.totalCostOfAttendanceCents).toBe(40_000_00);
    expect(o.giftAidCents).toBe(15_000_00);
    expect(o.annualNetPriceCents).toBe(25_000_00);
    expect(o.completeness.status).toBe("complete");
  });

  it("S1.2: student loans never reduce annual net price", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 40_000_00,
                required: true,
              },
              { id: "grant", category: "grant", amountCents: 10_000_00 },
              {
                id: "loan",
                category: "student_loan",
                amountCents: 5_500_00,
              },
            ],
          }),
        ],
      }),
    );

    const o = result.offers[0];
    expect(o.giftAidCents).toBe(10_000_00);
    expect(o.annualNetPriceCents).toBe(30_000_00);
    expect(o.studentLoansOfferedCents).toBe(5_500_00);
  });

  it("S1.3: parent PLUS and private financing never reduce annual net price", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 40_000_00,
                required: true,
              },
              { id: "grant", category: "grant", amountCents: 8_000_00 },
              {
                id: "plus",
                category: "parent_plus",
                amountCents: 12_000_00,
              },
              {
                id: "private",
                category: "private_loan",
                amountCents: 3_000_00,
              },
            ],
          }),
        ],
      }),
    );

    const o = result.offers[0];
    expect(o.annualNetPriceCents).toBe(32_000_00);
    expect(o.parentFinancingOfferedCents).toBe(15_000_00);
  });

  it("S1.4: work-study never reduces annual net price or default funding gap", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 40_000_00,
                required: true,
              },
              { id: "grant", category: "grant", amountCents: 10_000_00 },
              {
                id: "ws",
                category: "work_study",
                amountCents: 2_000_00,
              },
            ],
          }),
        ],
      }),
    );

    const o = result.offers[0];
    expect(o.annualNetPriceCents).toBe(30_000_00);
    expect(o.workStudyOfferedCents).toBe(2_000_00);
    expect(o.remainingFundingGapCents).toBe(30_000_00);
  });

  it("S1.5: declined items are excluded from sums", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 40_000_00,
                required: true,
              },
              { id: "grant", category: "grant", amountCents: 10_000_00 },
              {
                id: "extra",
                category: "scholarship",
                amountCents: 5_000_00,
                status: "declined",
              },
            ],
          }),
        ],
      }),
    );

    expect(result.offers[0].giftAidCents).toBe(10_000_00);
    expect(result.offers[0].annualNetPriceCents).toBe(30_000_00);
  });

  it("S1.6: required cost with null amount marks Incomplete", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 40_000_00,
                required: true,
              },
              {
                id: "housing",
                category: "indirect_cost",
                amountCents: null,
                required: true,
                label: "Housing",
              },
              { id: "grant", category: "grant", amountCents: 5_000_00 },
            ],
          }),
        ],
      }),
    );

    const o = result.offers[0];
    expect(o.completeness).toEqual({
      status: "incomplete",
      missingComponents: ["Housing"],
    });
    expect(o.annualNetPriceCents).toBe(0);
  });

  it("S1.7: mismatched academic periods are not summed", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 20_000_00,
                period: "2026-27",
                required: true,
              },
              {
                id: "fees",
                category: "direct_cost",
                amountCents: 1_000_00,
                period: "fall-only",
                required: true,
              },
            ],
          }),
        ],
      }),
    );

    const o = result.offers[0];
    expect(o.completeness.status).toBe("incomplete");
    expect(o.totalCostOfAttendanceCents).toBe(0);
    expect(o.warnings.some((w) => w.code === "period_mismatch")).toBe(true);
  });

  it("S1.8: one-time gift aid applies only to year one", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 10_000_00,
                required: true,
              },
              {
                id: "bonus",
                category: "scholarship",
                amountCents: 2_000_00,
                renewal: { kind: "one_time" },
              },
            ],
          }),
        ],
      }),
    );

    const years = result.offers[0].fourYear.years;
    expect(years[0].giftAidCents).toBe(2_000_00);
    expect(years[1].giftAidCents).toBe(0);
    expect(years[2].giftAidCents).toBe(0);
    expect(years[3].giftAidCents).toBe(0);
  });

  it("S1.9: unknown renewal applies only to year one in conservative", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 10_000_00,
                required: true,
              },
              {
                id: "merit",
                category: "scholarship",
                amountCents: 3_000_00,
                renewal: { kind: "unknown" },
              },
            ],
          }),
        ],
      }),
    );

    const years = result.offers[0].fourYear.years;
    expect(years[0].giftAidCents).toBe(3_000_00);
    expect(years[1].giftAidCents).toBe(0);
  });

  it("S1.10: confirmed fixed renewable aid continues for stated duration", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 10_000_00,
                required: true,
              },
              {
                id: "merit",
                category: "scholarship",
                amountCents: 4_000_00,
                renewal: { kind: "fixed", durationYears: 2 },
              },
            ],
          }),
        ],
      }),
    );

    const years = result.offers[0].fourYear.years;
    expect(years[0].giftAidCents).toBe(4_000_00);
    expect(years[1].giftAidCents).toBe(4_000_00);
    expect(years[2].giftAidCents).toBe(0);
    expect(years[3].giftAidCents).toBe(0);
  });

  it("S1.11: optimistic carries conditional aid; not one-time", () => {
    const items: LineItem[] = [
      {
        id: "tuition",
        category: "direct_cost",
        amountCents: 10_000_00,
        required: true,
      },
      {
        id: "conditional",
        category: "scholarship",
        amountCents: 2_000_00,
        renewal: { kind: "conditional" },
      },
      {
        id: "once",
        category: "grant",
        amountCents: 1_000_00,
        renewal: { kind: "one_time" },
      },
    ];

    const conservativeResult = calculateComparison(
      base({
        offers: [offer({ id: "a", lineItems: items })],
        assumptions: { annualCostGrowthBps: 0, scenario: "conservative" },
      }),
    );
    const optimisticResult = calculateComparison(
      base({
        offers: [offer({ id: "a", lineItems: items })],
        assumptions: { annualCostGrowthBps: 0, scenario: "optimistic" },
      }),
    );

    expect(conservativeResult.offers[0].fourYear.years[1].giftAidCents).toBe(0);
    expect(optimisticResult.offers[0].fourYear.years[1].giftAidCents).toBe(
      2_000_00,
    );
    expect(optimisticResult.offers[0].fourYear.years[0].giftAidCents).toBe(
      3_000_00,
    );
  });

  it("S1.12: remaining gap subtracts selected loans and confirmed resources", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            selectedStudentLoanIds: ["stafford"],
            confirmedResourceCents: 2_000_00,
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 40_000_00,
                required: true,
              },
              { id: "grant", category: "grant", amountCents: 10_000_00 },
              {
                id: "stafford",
                category: "student_loan",
                amountCents: 5_000_00,
              },
              {
                id: "other-loan",
                category: "student_loan",
                amountCents: 3_000_00,
              },
            ],
          }),
        ],
      }),
    );

    // net 30_000 - selected 5_000 - resources 2_000 = 23_000
    expect(result.offers[0].remainingFundingGapCents).toBe(23_000_00);
  });

  it("S1.13: negative net price is allowed with explanation flag", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 5_000_00,
                required: true,
              },
              { id: "grant", category: "grant", amountCents: 8_000_00 },
            ],
          }),
        ],
      }),
    );

    const o = result.offers[0];
    expect(o.annualNetPriceCents).toBe(-3_000_00);
    expect(o.negativeNetPrice).toBe(true);
    expect(o.warnings.some((w) => w.code === "negative_net_price")).toBe(true);
  });

  it("S1.14: housing/residency/enrollment mismatches emit warnings", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            schoolName: "A",
            assumptionTags: { housing: "on-campus", residency: "in-state" },
            lineItems: [
              {
                id: "t",
                category: "direct_cost",
                amountCents: 10_000_00,
                required: true,
              },
            ],
          }),
          offer({
            id: "b",
            schoolName: "B",
            assumptionTags: {
              housing: "off-campus",
              residency: "in-state",
            },
            lineItems: [
              {
                id: "t",
                category: "direct_cost",
                amountCents: 12_000_00,
                required: true,
              },
            ],
          }),
        ],
      }),
    );

    expect(result.warnings.some((w) => w.code === "housing_mismatch")).toBe(
      true,
    );
    expect(result.warnings.some((w) => w.code === "residency_mismatch")).toBe(
      false,
    );
  });

  it("S1.15: non-integer cents are rejected", () => {
    expect(() =>
      calculateComparison(
        base({
          offers: [
            offer({
              id: "a",
              lineItems: [
                {
                  id: "t",
                  category: "direct_cost",
                  amountCents: 10_000.5,
                  required: true,
                },
              ],
            }),
          ],
        }),
      ),
    ).toThrow(/integer cents/);
  });

  it("S1.16: four-year cost growth compounds and rounds before aid", () => {
    const result = calculateComparison(
      base({
        assumptions: { annualCostGrowthBps: 300, scenario: "conservative" },
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: 10_000_00,
                required: true,
              },
              {
                id: "merit",
                category: "scholarship",
                amountCents: 1_000_00,
                renewal: { kind: "fixed", durationYears: 4 },
              },
            ],
          }),
        ],
      }),
    );

    const years = result.offers[0].fourYear.years;
    expect(years[0].costCents).toBe(10_000_00);
    expect(years[1].costCents).toBe(Math.round(10_000_00 * 1.03));
    expect(years[2].costCents).toBe(Math.round(10_000_00 * 1.03 ** 2));
    expect(years[3].costCents).toBe(Math.round(10_000_00 * 1.03 ** 3));
    expect(years[1].netPriceCents).toBe(years[1].costCents - 1_000_00);
    expect(result.offers[0].fourYear.totalNetPriceCents).toBe(
      years.reduce((s, y) => s + y.netPriceCents, 0),
    );
  });

  it("S1.17: fifth active offer is rejected", () => {
    const offers = [1, 2, 3, 4, 5].map((n) =>
      offer({
        id: `o${n}`,
        schoolName: `School ${n}`,
        lineItems: [
          {
            id: "t",
            category: "direct_cost",
            amountCents: 1_000_00,
            required: true,
          },
        ],
      }),
    );

    expect(() => calculateComparison(base({ offers }))).toThrow(
      /At most 4 active offers/,
    );
  });

  it("S1.18: insights never contain a best-school conclusion", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            schoolName: "Alpha",
            lineItems: [
              {
                id: "t",
                category: "direct_cost",
                amountCents: 20_000_00,
                required: true,
              },
              { id: "g", category: "grant", amountCents: 5_000_00 },
            ],
          }),
          offer({
            id: "b",
            schoolName: "Beta",
            lineItems: [
              {
                id: "t",
                category: "direct_cost",
                amountCents: 30_000_00,
                required: true,
              },
              { id: "g", category: "grant", amountCents: 2_000_00 },
            ],
          }),
        ],
      }),
    );

    expect(result.insights.length).toBeGreaterThan(0);
    for (const insight of result.insights) {
      expect(insight.message.toLowerCase()).not.toMatch(
        /best school|best overall|recommend/,
      );
    }
    expect(
      result.insights.some(
        (i) => i.code === "lowest_reviewed_annual_net_price",
      ),
    ).toBe(true);
  });

  it("missing required cost without label uses item id in missingComponents", () => {
    const result = calculateComparison(
      base({
        offers: [
          offer({
            id: "a",
            lineItems: [
              {
                id: "tuition",
                category: "direct_cost",
                amountCents: null,
                required: true,
              },
            ],
          }),
        ],
      }),
    );

    expect(result.offers[0].completeness).toEqual({
      status: "incomplete",
      missingComponents: ["tuition"],
    });
  });

  it("empty offer list yields no insights", () => {
    const result = calculateComparison(base({ offers: [] }));
    expect(result.offers).toEqual([]);
    expect(result.insights).toEqual([]);
  });
});
