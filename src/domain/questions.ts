export type QuestionFacts = {
  missingRequiredCosts: string[];
  ambiguousFinancing: string[];
  unknownRenewals: string[];
  unclearPeriods: string[];
  componentMismatch: boolean;
  assumptionMismatch: string[];
  deadlineState: "known" | "missing" | "conflicting";
  sourceConflict: boolean;
};

export type QuestionTrigger = { code: string; subjects: string[] };

export function questionTriggers(facts: QuestionFacts): QuestionTrigger[] {
  const triggers: QuestionTrigger[] = [];
  if (facts.missingRequiredCosts.length)
    triggers.push({
      code: "missing_required_cost",
      subjects: facts.missingRequiredCosts,
    });
  if (facts.ambiguousFinancing.length)
    triggers.push({
      code: "ambiguous_financing",
      subjects: facts.ambiguousFinancing,
    });
  if (facts.unknownRenewals.length)
    triggers.push({ code: "unknown_renewal", subjects: facts.unknownRenewals });
  if (facts.unclearPeriods.length)
    triggers.push({ code: "unclear_period", subjects: facts.unclearPeriods });
  if (facts.componentMismatch)
    triggers.push({ code: "component_mismatch", subjects: [] });
  if (facts.assumptionMismatch.length)
    triggers.push({
      code: "assumption_mismatch",
      subjects: facts.assumptionMismatch,
    });
  if (facts.deadlineState !== "known")
    triggers.push({ code: `${facts.deadlineState}_deadline`, subjects: [] });
  if (facts.sourceConflict)
    triggers.push({ code: "source_conflict", subjects: [] });
  return triggers;
}
