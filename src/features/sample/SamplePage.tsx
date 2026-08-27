import { useId, useState, type ReactNode } from "react";
import {
  calculateComparison,
  type Assumptions,
  type OfferComparison,
} from "../../domain/comparison";
import {
  buildSampleComparisonInput,
  sampleFixture,
  type SampleSource,
} from "./fixtures";
import { formatUsd } from "./money";

function moneyOrIncomplete(offer: OfferComparison, cents: number): ReactNode {
  if (offer.completeness.status === "incomplete" && cents === 0) {
    return <span className="status-incomplete">Incomplete</span>;
  }
  return <span className="money">{formatUsd(cents)}</span>;
}

function SourcePanel({ source }: { source: SampleSource }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const isFictional = source.kind === "fictional_document";

  return (
    <div
      className={`source-item ${isFictional ? "source-item--fictional" : "source-item--official"}`}
    >
      <button
        type="button"
        className="source-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {source.title}
      </button>
      {open ? (
        <div
          id={panelId}
          data-testid={`source-detail-${source.id}`}
          className={`source-detail ${isFictional ? "source-detail--fictional" : "source-detail--official"}`}
        >
          <dl className="source-meta">
            <div>
              <dt>Type</dt>
              <dd>{source.type}</dd>
            </div>
            <div>
              <dt>Hostname</dt>
              <dd>{source.hostname}</dd>
            </div>
            <div>
              <dt>Retrieved</dt>
              <dd>
                <time dateTime={source.retrievalDate}>
                  {source.retrievalDate}
                </time>
              </dd>
            </div>
          </dl>
          <p className="source-excerpt">{source.excerpt}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function SamplePage() {
  const [scenario, setScenario] =
    useState<Assumptions["scenario"]>("conservative");
  const [announce, setAnnounce] = useState(
    "Showing the conservative four-year estimate.",
  );

  const result = calculateComparison(buildSampleComparisonInput(scenario));
  const [ucsd, loyola] = result.offers;
  const growthPct = sampleFixture.defaultAssumptions.annualCostGrowthBps / 100;

  function onScenarioChange(next: Assumptions["scenario"]) {
    setScenario(next);
    setAnnounce(
      next === "optimistic"
        ? "Optimistic scenario applied. Eligible conditional gift aid renews in later years."
        : "Conservative scenario applied. Conditional gift aid does not renew after year one.",
    );
  }

  return (
    <main id="main" className="sample">
      <div className="synthetic-banner" role="note">
        <strong>Synthetic demo</strong>
        <span>
          Fictional award letters · not issued by UC San Diego or Loyola
          University Maryland
        </span>
      </div>

      <div className="sample__intro">
        <h1>Sample comparison</h1>
        <p className="sample__lede">
          Two fictional award letters run through AidLens&apos;s real comparison
          engine. Numbers are synthetic; official policy citations are labeled
          separately.
        </p>
      </div>

      <fieldset className="scenario-controls">
        <legend>Four-year scenario</legend>
        <div className="scenario-controls__options" role="radiogroup">
          <label className="scenario-option">
            <input
              type="radio"
              name="sample-scenario"
              value="conservative"
              checked={scenario === "conservative"}
              onChange={() => onScenarioChange("conservative")}
            />
            Conservative
          </label>
          <label className="scenario-option">
            <input
              type="radio"
              name="sample-scenario"
              value="optimistic"
              checked={scenario === "optimistic"}
              onChange={() => onScenarioChange("optimistic")}
            />
            Optimistic
          </label>
        </div>
        <p className="scenario-assumptions">
          Assumptions: {growthPct}% annual cost growth; optimistic renews
          conditional scholarships; conservative does not.
        </p>
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
      </fieldset>

      <div className="offer-labels" aria-label="Offers in this comparison">
        {result.offers.map((offer) => (
          <article
            key={offer.offerId}
            data-testid={`offer-card-${offer.offerId}`}
            className="offer-label"
          >
            <h2>{offer.schoolName}</h2>
            <p className="offer-label__meta">
              Fictional award · not issued by the institution
            </p>
            <p className="offer-label__status">
              {offer.completeness.status === "complete"
                ? "Reviewed"
                : `Incomplete — missing ${offer.completeness.missingComponents.join(", ")}`}
            </p>
          </article>
        ))}
      </div>

      <div className="comparison-scroller" aria-label="Offer comparison table">
        <table className="comparison-table">
          <caption className="sr-only">
            Side-by-side annual and four-year cost comparison for UC San Diego
            and Loyola University Maryland synthetic offers
          </caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">{ucsd.schoolName}</th>
              <th scope="col">{loyola.schoolName}</th>
            </tr>
          </thead>
          <tbody>
            <tr data-testid="comparison-row-gift_aid">
              <th scope="row">Gift aid</th>
              <td className="money">{formatUsd(ucsd.giftAidCents)}</td>
              <td className="money">{formatUsd(loyola.giftAidCents)}</td>
            </tr>
            <tr data-testid="comparison-row-student_loans">
              <th scope="row">Student loans</th>
              <td className="money">
                {formatUsd(ucsd.studentLoansOfferedCents)}
              </td>
              <td className="money">
                {formatUsd(loyola.studentLoansOfferedCents)}
              </td>
            </tr>
            <tr data-testid="comparison-row-parent_plus">
              <th scope="row">Parent financing</th>
              <td className="money">
                {formatUsd(ucsd.parentFinancingOfferedCents)}
              </td>
              <td className="money">
                {formatUsd(loyola.parentFinancingOfferedCents)}
              </td>
            </tr>
            <tr data-testid="comparison-row-work_study">
              <th scope="row">Work-study</th>
              <td className="money">{formatUsd(ucsd.workStudyOfferedCents)}</td>
              <td className="money">
                {formatUsd(loyola.workStudyOfferedCents)}
              </td>
            </tr>
            <tr data-testid="comparison-row-annual_net_price">
              <th scope="row">Annual net price</th>
              <td className="money">{formatUsd(ucsd.annualNetPriceCents)}</td>
              <td>{moneyOrIncomplete(loyola, loyola.annualNetPriceCents)}</td>
            </tr>
            <tr data-testid={`comparison-row-four_year_${scenario}`}>
              <th scope="row">
                {scenario === "conservative"
                  ? "Conservative four-year total"
                  : "Optimistic four-year total"}
              </th>
              <td className="money">
                {formatUsd(ucsd.fourYear.totalNetPriceCents)}
              </td>
              <td className="money">
                {loyola.completeness.status === "incomplete" ? (
                  <>
                    <span className="money">
                      {formatUsd(loyola.fourYear.totalNetPriceCents)}
                    </span>
                    <span className="status-unknown"> Unknown housing</span>
                  </>
                ) : (
                  formatUsd(loyola.fourYear.totalNetPriceCents)
                )}
              </td>
            </tr>
            <tr data-testid="comparison-row-housing">
              <th scope="row">Housing and food</th>
              <td className="money">
                {formatUsd(
                  sampleFixture.offers[0].lineItems.find(
                    (i) => i.id === "ucsd-housing",
                  )?.amountCents ?? 0,
                )}
              </td>
              <td>
                <span className="status-unknown">Unknown</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="sample-sources" aria-labelledby="sources-heading">
        <h2 id="sources-heading">Sources</h2>
        <p className="sample-section-lede">
          Fictional documents stay visually distinct from official school
          policy.
        </p>
        <div className="source-list">
          {sampleFixture.sources.map((source) => (
            <SourcePanel key={source.id} source={source} />
          ))}
        </div>
      </section>

      <section
        className="clarification-story"
        aria-labelledby="clarification-heading"
      >
        <h2 id="clarification-heading">Clarification story</h2>
        <p className="sample-section-lede">
          Read-only guided states showing how a school reply would resolve a
          missing cost. This demo cannot send, edit, or delete.
        </p>
        <ol className="story-steps">
          {sampleFixture.clarificationStory.map((step) => (
            <li
              key={step.id}
              data-testid={`reply-proposal-${step.state}`}
              className={`story-step story-step--${step.state}`}
            >
              <h3>{step.label}</h3>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
