import { useEffect, useState } from "react";

type Draft = {
  _id: string;
  recipient: string;
  subject: string;
  bodyText: string;
  status: string;
  revision: number;
};

export type QuestionDraftData = {
  question: { prompt: string; revision?: number };
  school: { name: string; officialDomain?: string };
  draft: Draft | null;
  proposal?: {
    _id: string;
    supportingText: string;
    revision: number;
  } | null;
  lineItem?: { revision: number } | null;
};

export default function QuestionDraftPage({
  data,
  onOpen,
  onSave,
  onApprove,
  onConfirmReply,
}: {
  data: QuestionDraftData;
  onOpen: () => Promise<unknown>;
  onSave: (draft: {
    recipient: string;
    subject: string;
    bodyText: string;
    expectedRevision: number;
  }) => Promise<{ revision: number }>;
  onApprove: (approval: {
    expectedRevision: number;
    offDomainConfirmed: boolean;
  }) => Promise<unknown>;
  onConfirmReply?: (confirmation: {
    proposalId: string;
    expectedProposalRevision: number;
    expectedQuestionRevision: number;
    expectedLineItemRevision: number;
    renewal:
      | { kind: "fixed"; durationYears: number }
      | { kind: "one_time" | "nonrenewable" | "conditional" | "unknown" };
  }) => Promise<unknown>;
}) {
  const [recipient, setRecipient] = useState(data.draft?.recipient ?? "");
  const [subject, setSubject] = useState(data.draft?.subject ?? "");
  const [bodyText, setBodyText] = useState(data.draft?.bodyText ?? "");
  const [saved, setSaved] = useState({ recipient, subject, bodyText });
  const [revision, setRevision] = useState(data.draft?.revision ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [showRecipientWarning, setShowRecipientWarning] = useState(false);
  const [offDomainConfirmed, setOffDomainConfirmed] = useState(false);
  const [renewalKind, setRenewalKind] = useState("unknown");
  const [renewalYears, setRenewalYears] = useState("1");
  const dirty =
    recipient !== saved.recipient ||
    subject !== saved.subject ||
    bodyText !== saved.bodyText;
  const recipientDomain = recipient.toLowerCase().split("@")[1] ?? "";
  const officialDomain = data.school.officialDomain?.toLowerCase();
  const offDomain = Boolean(
    officialDomain &&
    recipientDomain !== officialDomain &&
    !recipientDomain.endsWith(`.${officialDomain}`),
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!data.draft) {
    return (
      <main id="main" className="question-draft-page">
        <h1>{data.question.prompt}</h1>
        <p>
          Generate an editable draft from verified case facts. Nothing sends
          automatically.
        </p>
        <button type="button" onClick={() => void onOpen()}>
          Generate email draft
        </button>
      </main>
    );
  }

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await onSave({
        recipient,
        subject,
        bodyText,
        expectedRevision: revision,
      });
      setRevision(result.revision);
      setSaved({ recipient, subject, bodyText });
    } catch {
      setError("This draft changed elsewhere. Reload and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (dirty) {
      setError("Save this draft before approving it.");
      return;
    }
    if (data.draft?.status === "draft" && offDomain && !offDomainConfirmed) {
      setShowRecipientWarning(true);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onApprove({ expectedRevision: revision, offDomainConfirmed });
    } catch {
      setError("This draft could not be approved. Review it and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="question-draft-page">
      <p className="eyebrow">Explicit approval required</p>
      <h1>{data.question.prompt}</h1>
      <p>Saving or closing this page never sends email.</p>
      {error ? <p role="alert">{error}</p> : null}
      {data.draft.status !== "draft" ? (
        <p role="status">Delivery status: {data.draft.status}</p>
      ) : null}
      <label>
        Recipient
        <input
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
        />
      </label>
      <label>
        Subject
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </label>
      <label>
        Message
        <textarea
          value={bodyText}
          onChange={(event) => setBodyText(event.target.value)}
        />
      </label>
      <button type="button" disabled={busy} onClick={() => void save()}>
        Save draft
      </button>
      <button
        type="button"
        disabled={busy || !["draft", "failed"].includes(data.draft.status)}
        onClick={() => void approve()}
      >
        {data.draft.status === "failed"
          ? "Retry approved email"
          : "Approve and queue email"}
      </button>
      {showRecipientWarning ? (
        <label>
          <input
            type="checkbox"
            checked={offDomainConfirmed}
            onChange={(event) => setOffDomainConfirmed(event.target.checked)}
          />
          I confirm this off-domain recipient is intended
        </label>
      ) : null}
      {data.proposal && data.lineItem ? (
        <section aria-labelledby="reply-proposal-heading">
          <h2 id="reply-proposal-heading">School reply proposal</h2>
          <blockquote>{data.proposal.supportingText}</blockquote>
          <p>This reply changes no totals until you confirm the fact below.</p>
          <label>
            Confirmed renewal
            <select
              value={renewalKind}
              onChange={(event) => setRenewalKind(event.target.value)}
            >
              <option value="unknown">Unknown</option>
              <option value="fixed">Fixed number of years</option>
              <option value="conditional">Conditional</option>
              <option value="one_time">One time</option>
              <option value="nonrenewable">Nonrenewable</option>
            </select>
          </label>
          {renewalKind === "fixed" ? (
            <label>
              Renewal years
              <input
                type="number"
                min="1"
                max="10"
                step="1"
                value={renewalYears}
                onChange={(event) => setRenewalYears(event.target.value)}
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (!onConfirmReply) return;
              const renewal =
                renewalKind === "fixed"
                  ? {
                      kind: "fixed" as const,
                      durationYears: Number(renewalYears),
                    }
                  : {
                      kind: renewalKind as
                        "one_time" | "nonrenewable" | "conditional" | "unknown",
                    };
              void onConfirmReply({
                proposalId: data.proposal?._id ?? "",
                expectedProposalRevision: data.proposal?.revision ?? 0,
                expectedQuestionRevision: data.question.revision ?? 0,
                expectedLineItemRevision: data.lineItem?.revision ?? 0,
                renewal,
              });
            }}
          >
            Confirm reply fact
          </button>
        </section>
      ) : null}
    </main>
  );
}
