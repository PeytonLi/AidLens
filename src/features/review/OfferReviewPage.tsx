import { useState } from "react";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { formatUsd } from "../sample/money";

export type OfferReview = {
  offer: Doc<"offers">;
  school: Doc<"schools"> | null;
  candidates: Doc<"schools">[];
  items: Doc<"lineItems">[];
  rawDeletedAt: number | null;
};

type Props = {
  review: OfferReview;
  onConfirmSchool: (schoolId: Id<"schools">) => Promise<unknown>;
  onConfirmManual: (name: string, officialDomain: string) => Promise<unknown>;
  onSaveItem: (item: Doc<"lineItems">) => Promise<unknown>;
  onConfirmReviewed: (revision: number) => Promise<unknown>;
};

function ReviewItem({
  item,
  onSave,
}: {
  item: Doc<"lineItems">;
  onSave: Props["onSaveItem"];
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(
    item.amountCents === null ? "" : String(item.amountCents / 100),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    if (amount !== "" && !/^\d+(\.\d{1,2})?$/.test(amount)) {
      setError("Enter a dollar amount with no more than two decimal places.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await onSave({
        ...item,
        amountCents: amount === "" ? null : Math.round(Number(amount) * 100),
      });
      setEditing(false);
    } catch {
      setError("This field changed elsewhere. Reload and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="review-field" data-testid={`line-item-${item._id}`}>
      <header>
        <div>
          <p className="review-field__category">
            {item.canonicalCategory.replace(/_/g, " ")}
          </p>
          <h2>{item.originalLabel}</h2>
        </div>
        <p className="review-field__confidence">
          {Math.round(item.extractedConfidence * 100)}% confidence
        </p>
      </header>
      {editing ? (
        <div className="review-field__editor">
          <label>
            Amount in dollars
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <button type="button" disabled={saving} onClick={() => void save()}>
            Save field
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setAmount(
                item.amountCents === null ? "" : String(item.amountCents / 100),
              );
              setEditing(false);
              setError(undefined);
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <p className="review-field__amount">
            {item.amountCents === null
              ? "Unknown"
              : formatUsd(item.amountCents)}
          </p>
          <p>Period: {item.period.replace(/_/g, " ")}</p>
          <blockquote>{item.sourceExcerpt}</blockquote>
          <p>Offer page {item.documentPage}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${item.originalLabel}`}
          >
            Edit
          </button>
        </>
      )}
    </article>
  );
}

export default function OfferReviewPage({
  review,
  onConfirmSchool,
  onConfirmManual,
  onSaveItem,
  onConfirmReviewed,
}: Props) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<Id<"schools">>();
  const [manual, setManual] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [officialDomain, setOfficialDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [showAll, setShowAll] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string>();

  async function submit(task: () => Promise<unknown>) {
    setSubmitting(true);
    setError(undefined);
    try {
      await task();
    } catch {
      setError("We couldn't confirm that school. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (review.school?.identityState === "confirmed") {
    const criticalItems = review.items.filter(
      (item) =>
        item.requiredForCostTotal &&
        (item.amountCents === null || item.extractedConfidence < 0.75),
    );
    const visibleItems =
      showAll || criticalItems.length === 0 ? review.items : criticalItems;
    return (
      <main id="main" className="offer-review-page">
        <p className="eyebrow">Source-backed offer review</p>
        <h1>{review.school.name}</h1>
        <p>Review each extracted amount before comparing this offer.</p>
        {review.rawDeletedAt ? (
          <p>Raw file deleted; retained evidence excerpts remain available.</p>
        ) : null}
        <section aria-label="Extracted offer fields">
          {visibleItems.map((item) => (
            <ReviewItem key={item._id} item={item} onSave={onSaveItem} />
          ))}
        </section>
        {!showAll && criticalItems.length < review.items.length ? (
          <button type="button" onClick={() => setShowAll(true)}>
            Show all fields
          </button>
        ) : null}
        {reviewError ? <p role="alert">{reviewError}</p> : null}
        <button
          type="button"
          disabled={reviewing}
          onClick={() => {
            setReviewing(true);
            setReviewError(undefined);
            void onConfirmReviewed(review.offer.revision)
              .catch(() =>
                setReviewError(
                  "Address the highlighted fields before confirming this offer.",
                ),
              )
              .finally(() => setReviewing(false));
          }}
        >
          {reviewing ? "Confirming…" : "Confirm reviewed offer"}
        </button>
      </main>
    );
  }

  return (
    <main id="main" className="school-confirmation-page">
      <p className="eyebrow">Identity check</p>
      <h1>Confirm school</h1>
      <p>
        Choose the school shown on this offer before AidLens uses its facts.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <fieldset>
        <legend>Which school issued this offer?</legend>
        {review.candidates.map((candidate) => (
          <label key={candidate._id} className="school-candidate">
            <input
              type="radio"
              name="school-candidate"
              checked={selectedSchoolId === candidate._id}
              onChange={() => setSelectedSchoolId(candidate._id)}
            />
            <span>
              <strong>{candidate.name}</strong>
              {candidate.officialDomain ? ` — ${candidate.officialDomain}` : ""}
            </span>
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        disabled={!selectedSchoolId || submitting}
        onClick={() =>
          selectedSchoolId &&
          void submit(() => onConfirmSchool(selectedSchoolId))
        }
      >
        Confirm school
      </button>
      <button type="button" onClick={() => setManual(true)}>
        None of these
      </button>
      {manual ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit(() => onConfirmManual(schoolName, officialDomain));
          }}
        >
          <label>
            School name
            <input
              required
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
            />
          </label>
          <label>
            Official domain
            <input
              required
              placeholder="example.edu"
              value={officialDomain}
              onChange={(event) => setOfficialDomain(event.target.value)}
            />
          </label>
          <button type="submit" disabled={submitting}>
            Confirm school
          </button>
        </form>
      ) : null}
    </main>
  );
}
