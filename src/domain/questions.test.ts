import { expect, it } from "vitest";
import { questionTriggers } from "./questions";

it("S7.8: creates deterministic triggers from unresolved facts", () => {
  expect(
    questionTriggers({
      missingRequiredCosts: ["Housing and food"],
      ambiguousFinancing: ["Federal Direct Loan"],
      unknownRenewals: ["Merit Scholarship"],
      unclearPeriods: ["Technology fee"],
      componentMismatch: true,
      assumptionMismatch: ["housing"],
      deadlineState: "conflicting",
      sourceConflict: true,
    }).map(({ code }) => code),
  ).toEqual([
    "missing_required_cost",
    "ambiguous_financing",
    "unknown_renewal",
    "unclear_period",
    "component_mismatch",
    "assumption_mismatch",
    "conflicting_deadline",
    "source_conflict",
  ]);
});
