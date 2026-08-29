import { useState } from "react";
import { Link } from "react-router-dom";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  calculateComparison,
  type Assumptions,
  type OfferInput,
} from "../../domain/comparison";
import { formatUsd } from "../sample/money";

export type ComparisonData = {
  settings: Assumptions;
  offers: Array<{
    offer: Doc<"offers">;
    school: Doc<"schools">;
    items: Doc<"lineItems">[];
  }>;
};

type Props = {
  data: ComparisonData;
  onUpdateSettings: (settings: Assumptions) => Promise<unknown>;
};

function toInput({
  offer,
  school,
  items,
}: ComparisonData["offers"][number]): OfferInput {
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
    selectedStudentLoanIds: items
      .filter(
        ({ canonicalCategory, status }) =>
          canonicalCategory === "student_loan" && status === "selected",
      )
      .map(({ _id }) => _id),
    assumptionTags: {
      housing: offer.housingAssumption,
      residency: offer.residencyAssumption,
      enrollment: offer.enrollmentIntensity,
      period: offer.academicYear,
    },
  };
}

export default function ComparisonPage({ data, onUpdateSettings }: Props) {
  const [growth, setGrowth] = useState(
    String(data.settings.annualCostGrowthBps / 100),
  );
  const [error, setError] = useState<string>();
  const [announce, setAnnounce] = useState("Showing conservative assumptions.");

  if (data.offers.length < 2) {
    return (
      <main id="main" className="comparison-page">
        <h1>Compare offers</h1>
        <p>{data.offers.length} of 2 offers ready</p>
        <p>Add one more reviewed offer to unlock the comparison.</p>
        <Link to="/workspace">Add another offer</Link>
      </main>
    );
  }

  const result = calculateComparison({
    offers: data.offers.map(toInput),
    assumptions: data.settings,
  });
  const rows = [
    ["Total cost", "totalCostOfAttendanceCents"],
    ["Gift aid", "giftAidCents"],
    ["Annual net price", "annualNetPriceCents"],
    ["Student loans", "studentLoansOfferedCents"],
    ["Parent/private financing", "parentFinancingOfferedCents"],
    ["Work-study", "workStudyOfferedCents"],
    ["Remaining funding gap", "remainingFundingGapCents"],
  ] as const;

  async function update(settings: Assumptions, message: string) {
    setError(undefined);
    try {
      await onUpdateSettings(settings);
      setAnnounce(message);
    } catch {
      setError("We couldn't update those assumptions. Try again.");
    }
  }

  function applyGrowth() {
    const bps = Number(growth) * 100;
    if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10_000) {
      setError(
        "Enter annual growth from 0% to 100% with at most two decimals.",
      );
      return;
    }
    void update(
      { ...data.settings, annualCostGrowthBps: bps },
      `Annual cost growth updated to ${growth} percent.`,
    );
  }

  return (
    <main id="main" className="comparison-page">
      <p className="eyebrow">Private comparison</p>
      <h1>Compare offers</h1>
      <p>Uploaded order — preliminary or incomplete offers are not ranked.</p>
      <fieldset className="scenario-controls">
        <legend>Four-year scenario</legend>
        {(["conservative", "optimistic"] as const).map((scenario) => (
          <label key={scenario}>
            <input
              type="radio"
              name="comparison-scenario"
              checked={data.settings.scenario === scenario}
              onChange={() =>
                void update(
                  { ...data.settings, scenario },
                  `${scenario === "optimistic" ? "Optimistic" : "Conservative"} scenario applied.`,
                )
              }
            />
            {scenario === "optimistic" ? "Optimistic" : "Conservative"}
          </label>
        ))}
        <p>
          Conservative assumes conditional gift aid does not renew; optimistic
          assumes it does.
        </p>
        <label>
          Annual cost growth percent
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={growth}
            onChange={(event) => setGrowth(event.target.value)}
          />
        </label>
        <button type="button" onClick={applyGrowth}>
          Apply growth
        </button>
        <button type="button" onClick={() => setGrowth("3")}>
          Reset to 3%
        </button>
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      {result.warnings.map((warning) => (
        <p key={warning.code} role="note">
          {warning.message}
        </p>
      ))}
      <div
        className="comparison-scroller"
        aria-label="Private offer comparison table"
      >
        <table className="comparison-table">
          <caption>
            Annual figures and conservative or optimistic four-year projections
          </caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              {result.offers.map((offer, index) => (
                <th scope="col" key={offer.offerId}>
                  {offer.schoolName}
                  <span>
                    {data.offers[index].offer.reviewState === "reviewed"
                      ? "Reviewed"
                      : "Preliminary"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, key]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                {result.offers.map((offer) => (
                  <td key={offer.offerId}>
                    {offer.completeness.status === "incomplete" &&
                    (key === "annualNetPriceCents" ||
                      key === "remainingFundingGapCents")
                      ? "Incomplete"
                      : formatUsd(offer[key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Four-year net price</th>
              {result.offers.map((offer) => (
                <td key={offer.offerId}>
                  {offer.completeness.status === "incomplete"
                    ? "Incomplete"
                    : formatUsd(offer.fourYear.totalNetPriceCents)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
