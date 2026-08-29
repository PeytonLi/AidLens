import type { AidCategory, ItemStatus, Renewal } from "./comparison";

export type ExtractionEvidence = {
  page: number;
  region: string | null;
  excerpt: string;
};

export type ExtractedSchoolCandidate = {
  name: string;
  unitId: string | null;
  officialDomain: string | null;
  confidence: number;
  evidence: ExtractionEvidence;
};

export type ExtractedLineItem = {
  originalLabel: string;
  canonicalCategory: AidCategory;
  amountCents: number | null;
  period: string;
  status: ItemStatus;
  renewal: Renewal;
  requiredForCostTotal: boolean;
  confidence: number;
  evidence: ExtractionEvidence;
};

export type ExtractionResultV1 = {
  version: "v1";
  schoolCandidates: ExtractedSchoolCandidate[];
  offer: {
    academicYear: string;
    startTerm: string;
    endTerm: string;
    enrollmentIntensity: string;
    housingAssumption: string;
    residencyAssumption: string;
    overallConfidence: number;
    lineItems: ExtractedLineItem[];
  };
};

const categoryValues: AidCategory[] = [
  "direct_cost",
  "indirect_cost",
  "grant",
  "scholarship",
  "student_loan",
  "parent_plus",
  "private_loan",
  "work_study",
  "other_financing",
  "family_contribution",
  "payment_plan",
  "unknown",
];
const statusValues: ItemStatus[] = [
  "offered",
  "accepted",
  "declined",
  "selected",
];

export const extractionResultV1JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { const: "v1" },
    schoolCandidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          unitId: { type: ["string", "null"] },
          officialDomain: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { $ref: "#/$defs/evidence" },
        },
        required: [
          "name",
          "unitId",
          "officialDomain",
          "confidence",
          "evidence",
        ],
      },
    },
    offer: {
      type: "object",
      additionalProperties: false,
      properties: {
        academicYear: { type: "string" },
        startTerm: { type: "string" },
        endTerm: { type: "string" },
        enrollmentIntensity: { type: "string" },
        housingAssumption: { type: "string" },
        residencyAssumption: { type: "string" },
        overallConfidence: { type: "number", minimum: 0, maximum: 1 },
        lineItems: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              originalLabel: { type: "string" },
              canonicalCategory: { type: "string", enum: categoryValues },
              amountCents: { type: ["integer", "null"], minimum: 0 },
              period: { type: "string" },
              status: { type: "string", enum: statusValues },
              renewal: {
                oneOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      kind: { const: "fixed" },
                      durationYears: { type: "integer", minimum: 1 },
                    },
                    required: ["kind", "durationYears"],
                  },
                  ...["one_time", "nonrenewable", "conditional", "unknown"].map(
                    (kind) => ({
                      type: "object",
                      additionalProperties: false,
                      properties: { kind: { const: kind } },
                      required: ["kind"],
                    }),
                  ),
                ],
              },
              requiredForCostTotal: { type: "boolean" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              evidence: { $ref: "#/$defs/evidence" },
            },
            required: [
              "originalLabel",
              "canonicalCategory",
              "amountCents",
              "period",
              "status",
              "renewal",
              "requiredForCostTotal",
              "confidence",
              "evidence",
            ],
          },
        },
      },
      required: [
        "academicYear",
        "startTerm",
        "endTerm",
        "enrollmentIntensity",
        "housingAssumption",
        "residencyAssumption",
        "overallConfidence",
        "lineItems",
      ],
    },
  },
  required: ["version", "schoolCandidates", "offer"],
  $defs: {
    evidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        page: { type: "integer", minimum: 1 },
        region: { type: ["string", "null"] },
        excerpt: { type: "string" },
      },
      required: ["page", "region", "excerpt"],
    },
  },
} as const;

const categories = new Set(categoryValues);
const statuses = new Set(statusValues);

function record(
  value: unknown,
  keys: string[],
  label: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !(key in value))
  ) {
    throw new Error(`Invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`Invalid ${label}`);
  return value;
}

function confidence(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error("Invalid confidence");
  }
  return value;
}

function evidence(value: unknown): ExtractionEvidence {
  const item = record(value, ["page", "region", "excerpt"], "evidence");
  if (!Number.isInteger(item.page) || (item.page as number) < 1)
    throw new Error("Invalid evidence");
  if (item.region !== null && typeof item.region !== "string")
    throw new Error("Invalid evidence");
  return {
    page: item.page as number,
    region: item.region,
    excerpt: text(item.excerpt, "evidence excerpt"),
  };
}

function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label);
}

function renewal(value: unknown): Renewal {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid renewal");
  const kind = (value as Record<string, unknown>).kind;
  if (kind === "fixed") {
    const item = record(value, ["kind", "durationYears"], "renewal");
    if (
      !Number.isInteger(item.durationYears) ||
      (item.durationYears as number) < 1
    ) {
      throw new Error("Invalid renewal");
    }
    return { kind, durationYears: item.durationYears as number };
  }
  if (
    !["one_time", "nonrenewable", "conditional", "unknown"].includes(
      kind as string,
    )
  ) {
    throw new Error("Invalid renewal");
  }
  record(value, ["kind"], "renewal");
  return { kind } as Renewal;
}

export function parseExtractionResultV1(value: unknown): ExtractionResultV1 {
  const root = record(
    value,
    ["version", "schoolCandidates", "offer"],
    "extraction result",
  );
  if (root.version !== "v1" || !Array.isArray(root.schoolCandidates)) {
    throw new Error("Invalid extraction result");
  }
  const schoolCandidates = root.schoolCandidates.map((value) => {
    const item = record(
      value,
      ["name", "unitId", "officialDomain", "confidence", "evidence"],
      "school candidate",
    );
    return {
      name: text(item.name, "school name"),
      unitId: nullableText(item.unitId, "unit ID"),
      officialDomain: nullableText(item.officialDomain, "official domain"),
      confidence: confidence(item.confidence),
      evidence: evidence(item.evidence),
    };
  });
  const offer = record(
    root.offer,
    [
      "academicYear",
      "startTerm",
      "endTerm",
      "enrollmentIntensity",
      "housingAssumption",
      "residencyAssumption",
      "overallConfidence",
      "lineItems",
    ],
    "offer",
  );
  if (!Array.isArray(offer.lineItems)) throw new Error("Invalid offer");
  const lineItems = offer.lineItems.map((value) => {
    const item = record(
      value,
      [
        "originalLabel",
        "canonicalCategory",
        "amountCents",
        "period",
        "status",
        "renewal",
        "requiredForCostTotal",
        "confidence",
        "evidence",
      ],
      "line item",
    );
    if (!categories.has(item.canonicalCategory as AidCategory))
      throw new Error("Invalid category");
    if (!statuses.has(item.status as ItemStatus))
      throw new Error("Invalid status");
    if (
      item.amountCents !== null &&
      (!Number.isSafeInteger(item.amountCents) ||
        (item.amountCents as number) < 0)
    ) {
      throw new Error("Invalid amount");
    }
    if (typeof item.requiredForCostTotal !== "boolean")
      throw new Error("Invalid required flag");
    return {
      originalLabel: text(item.originalLabel, "original label"),
      canonicalCategory: item.canonicalCategory as AidCategory,
      amountCents: item.amountCents as number | null,
      period: text(item.period, "period"),
      status: item.status as ItemStatus,
      renewal: renewal(item.renewal),
      requiredForCostTotal: item.requiredForCostTotal,
      confidence: confidence(item.confidence),
      evidence: evidence(item.evidence),
    };
  });
  return {
    version: "v1",
    schoolCandidates,
    offer: {
      academicYear: text(offer.academicYear, "academic year"),
      startTerm: text(offer.startTerm, "start term"),
      endTerm: text(offer.endTerm, "end term"),
      enrollmentIntensity: text(
        offer.enrollmentIntensity,
        "enrollment intensity",
      ),
      housingAssumption: text(offer.housingAssumption, "housing assumption"),
      residencyAssumption: text(
        offer.residencyAssumption,
        "residency assumption",
      ),
      overallConfidence: confidence(offer.overallConfidence),
      lineItems,
    },
  };
}
