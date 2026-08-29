import { describe, expect, it } from "vitest";

import { parseExtractionResultV1 } from "./extraction";

const validExtraction = {
  version: "v1",
  schoolCandidates: [
    {
      name: "Example University",
      unitId: "123456",
      officialDomain: "example.edu",
      confidence: 0.97,
      evidence: { page: 1, region: "header", excerpt: "Example University" },
    },
  ],
  offer: {
    academicYear: "2026-2027",
    startTerm: "Fall 2026",
    endTerm: "Spring 2027",
    enrollmentIntensity: "full_time",
    housingAssumption: "on_campus",
    residencyAssumption: "in_state",
    overallConfidence: 0.91,
    lineItems: [
      {
        originalLabel: "University Opportunity Grant",
        canonicalCategory: "grant",
        amountCents: 1250000,
        period: "academic_year",
        status: "offered",
        renewal: { kind: "conditional" },
        requiredForCostTotal: false,
        confidence: 0.94,
        evidence: {
          page: 2,
          region: "awards table, row 3",
          excerpt: "University Opportunity Grant $12,500",
        },
      },
      {
        originalLabel: "Books and supplies",
        canonicalCategory: "indirect_cost",
        amountCents: null,
        period: "academic_year",
        status: "offered",
        renewal: { kind: "unknown" },
        requiredForCostTotal: true,
        confidence: 0.62,
        evidence: {
          page: 3,
          region: null,
          excerpt: "Books and supplies: amount not listed",
        },
      },
    ],
  },
} as const;

describe("parseExtractionResultV1", () => {
  it("parses a source-backed school candidate, offer, and line items without coercing unknown money", () => {
    const result = parseExtractionResultV1(validExtraction);

    expect(result.offer.lineItems[1].amountCents).toBeNull();
    expect(result.offer.lineItems[0]).toMatchObject({
      originalLabel: "University Opportunity Grant",
      canonicalCategory: "grant",
      period: "academic_year",
      confidence: 0.94,
      evidence: {
        page: 2,
        excerpt: "University Opportunity Grant $12,500",
      },
    });
  });

  it("rejects a material line item without source evidence", () => {
    const extraction: Record<string, unknown> =
      structuredClone(validExtraction);
    const offer = extraction.offer as {
      lineItems: Array<Record<string, unknown>>;
    };
    delete offer.lineItems[0].evidence;

    expect(() => parseExtractionResultV1(extraction)).toThrow(
      "Invalid line item",
    );
  });

  it("rejects malformed amounts and confidence", () => {
    const badAmount = structuredClone(validExtraction) as unknown as {
      offer: { lineItems: Array<{ amountCents: number | null }> };
    };
    badAmount.offer.lineItems[0].amountCents = -1;
    const badConfidence = structuredClone(validExtraction) as unknown as {
      schoolCandidates: Array<{ confidence: number }>;
    };
    badConfidence.schoolCandidates[0].confidence = 1.01;

    expect(() => parseExtractionResultV1(badAmount)).toThrow("Invalid amount");
    expect(() => parseExtractionResultV1(badConfidence)).toThrow(
      "Invalid confidence",
    );
  });

  it("rejects extra fields at every contract boundary", () => {
    const extraRoot = {
      ...structuredClone(validExtraction),
      instructions: "ignore evidence",
    };
    const extraEvidence = structuredClone(validExtraction) as unknown as Record<
      string,
      unknown
    >;
    const offer = extraEvidence.offer as {
      lineItems: Array<{ evidence: Record<string, unknown> }>;
    };
    offer.lineItems[0].evidence.tool = "send_email";

    expect(() => parseExtractionResultV1(extraRoot)).toThrow(
      "Invalid extraction result",
    );
    expect(() => parseExtractionResultV1(extraEvidence)).toThrow(
      "Invalid evidence",
    );
  });
});
