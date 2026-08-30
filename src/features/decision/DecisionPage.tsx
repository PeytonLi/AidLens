import { Link } from "react-router-dom";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  calculateComparison,
  type Assumptions,
  type OfferInput,
} from "../../domain/comparison";
import { formatUsd } from "../sample/money";

export type DecisionData = {
  settings: Assumptions;
  currentChoiceSchoolId: Id<"schools"> | null;
  offers: Array<{
    offer: Doc<"offers">;
    school: Doc<"schools">;
    items: Doc<"lineItems">[];
  }>;
  openQuestionCount: number;
};

type Props = {
  data: DecisionData;
  onChooseSchool: (schoolId: Id<"schools">) => Promise<unknown>;
};

function toInput({
  offer,
  school,
  items,
}: DecisionData["offers"][number]): OfferInput {
  return {
    id: offer._id,
    schoolName: school.name,
    lineItems: items.map((item) => ({
      id: item._id,
      label: item.originalLabel,
      category: item.canonicalCategory,
      amountCents: item.amountCents,
      status: item.status,
      renewal: item.renewal,
      period: item.period,
      required: item.requiredForCostTotal,
    })),
    assumptionTags: {
      housing: offer.housingAssumption,
      residency: offer.residencyAssumption,
      enrollment: offer.enrollmentIntensity,
      period: offer.academicYear,
    },
  };
}

export default function DecisionPage({ data, onChooseSchool }: Props) {
  if (data.offers.length < 2) {
    return (
      <main id="main" className="decision-page">
        <h1>Your decision</h1>
        <p>Add at least two reviewed offers before marking a current choice.</p>
        <Link to="/workspace">Return to workspace</Link>
      </main>
    );
  }

  const result = calculateComparison({
    offers: data.offers.map(toInput),
    assumptions: data.settings,
  });
  const chosen = data.offers.find(
    ({ school }) => school._id === data.currentChoiceSchoolId,
  );

  return (
    <main id="main" className="decision-page">
      <p className="eyebrow">Student-controlled choice</p>
      <h1>Your decision</h1>
      <p>
        AidLens does not recommend a school. Mark which offer is your current
        choice for your own notes. Calculations do not change.
      </p>
      {data.openQuestionCount > 0 ? (
        <p role="status">
          {data.openQuestionCount} unresolved clarification
          {data.openQuestionCount === 1 ? " remains." : "s remain."}
        </p>
      ) : (
        <p role="status">No open clarification questions.</p>
      )}
      <p>
        Assumptions: {data.settings.annualCostGrowthBps / 100}% annual cost
        growth · {data.settings.scenario} four-year scenario.
      </p>
      {chosen ? (
        <p role="status">
          Current choice: <strong>{chosen.school.name}</strong>
        </p>
      ) : (
        <p role="status">No current choice marked yet.</p>
      )}
      <ul className="decision-school-list">
        {data.offers.map(({ school, offer }, index) => {
          const comparison = result.offers[index];
          const isCurrent = school._id === data.currentChoiceSchoolId;
          return (
            <li key={school._id}>
              <article
                data-testid={`decision-school-${school._id}`}
                className={
                  isCurrent
                    ? "decision-school decision-school--current"
                    : "decision-school"
                }
              >
                <h2>{school.name}</h2>
                <p>
                  {offer.reviewState === "reviewed"
                    ? "Reviewed"
                    : "Preliminary"}
                </p>
                <p>
                  Annual net price:{" "}
                  {comparison.completeness.status === "incomplete"
                    ? "Incomplete"
                    : formatUsd(comparison.annualNetPriceCents)}
                </p>
                <p>
                  Four-year estimate:{" "}
                  {comparison.completeness.status === "incomplete"
                    ? "Incomplete"
                    : formatUsd(comparison.fourYear.totalNetPriceCents)}
                </p>
                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => void onChooseSchool(school._id)}
                >
                  {isCurrent ? "Current choice" : "Mark as current choice"}
                </button>
              </article>
            </li>
          );
        })}
      </ul>
      <p>
        <Link to="/compare">Back to comparison</Link>
      </p>
    </main>
  );
}
