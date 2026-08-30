import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import AgeConfirmationPage from "./AgeConfirmationPage";
import AuthPage, { type AuthCredentials, type AuthMode } from "./AuthPage";
import UploadOfferPanel, {
  type DuplicateChoice,
  type UploadItem,
} from "../upload/UploadOfferPanel";
import OfferReviewPage, { type OfferReview } from "../review/OfferReviewPage";
import ComparisonPage, {
  type ComparisonData,
} from "../comparison/ComparisonPage";
import DecisionPage, { type DecisionData } from "../decision/DecisionPage";
import ResearchPage from "../research/ResearchPage";
import QuestionDraftPage, {
  type QuestionDraftData,
} from "../questions/QuestionDraftPage";

const getCurrentProfile = makeFunctionReference<
  "query",
  Record<string, never>,
  Doc<"profiles"> | null
>("profiles:getCurrent");
const confirmAge = makeFunctionReference<
  "mutation",
  { confirmed: boolean },
  { profileId: Id<"profiles">; workspaceId: Id<"workspaces"> }
>("profiles:confirmAge");
const retryInboxProvisioning = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { status: "scheduled" | "ready" | "active" }
>("profiles:retryInboxProvisioning");
const getCurrentWorkspace = makeFunctionReference<
  "query",
  Record<string, never>,
  Doc<"workspaces"> | null
>("workspaces:getCurrent");
const removeWorkspace = makeFunctionReference<
  "mutation",
  { workspaceId: Id<"workspaces"> },
  null
>("workspaces:remove");
type DocumentSummary = Omit<Doc<"offerDocuments">, "storageId" | "sha256">;
const listDocuments = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces"> },
  DocumentSummary[]
>("documents:listDocuments");
const listOffers = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces"> },
  Doc<"offers">[]
>("offers:listForWorkspace");
const generateUploadUrl = makeFunctionReference<
  "mutation",
  { workspaceId: Id<"workspaces"> },
  string
>("documents:generateUploadUrl");
const finalizeUpload = makeFunctionReference<
  "mutation",
  {
    workspaceId: Id<"workspaces">;
    storageId: Id<"_storage">;
    fileName: string;
  },
  | { status: "created"; documentId: Id<"offerDocuments"> }
  | { status: "duplicate"; existingDocumentId: Id<"offerDocuments"> }
  | { status: "rejected"; errorCode: "INVALID_FILE_NAME" }
>("documents:finalizeUpload");
const resolveDuplicate = makeFunctionReference<
  "mutation",
  {
    workspaceId: Id<"workspaces">;
    existingDocumentId: Id<"offerDocuments">;
    storageId: Id<"_storage">;
    fileName: string;
    choice: "replace" | "keep_new" | "cancel";
  },
  {
    status: "created" | "replaced" | "cancelled";
    documentId: Id<"offerDocuments">;
  }
>("documents:resolveDuplicate");
const retryValidation = makeFunctionReference<
  "mutation",
  { documentId: Id<"offerDocuments"> },
  { status: "scheduled" }
>("documents:retryValidation");
const deleteRaw = makeFunctionReference<
  "mutation",
  { documentId: Id<"offerDocuments"> },
  boolean
>("documents:deleteRaw");
const getOfferReview = makeFunctionReference<
  "query",
  { offerId: Id<"offers"> },
  OfferReview
>("offers:getReview");
const confirmOfferSchool = makeFunctionReference<
  "mutation",
  { offerId: Id<"offers">; schoolId: Id<"schools"> }
>("offers:confirmSchool");
const confirmManualSchool = makeFunctionReference<
  "mutation",
  { offerId: Id<"offers">; name: string; officialDomain: string }
>("offers:confirmManualSchool");
const correctOfferLineItem = makeFunctionReference<
  "mutation",
  {
    lineItemId: Id<"lineItems">;
    expectedRevision: number;
    amountCents: number | null;
    canonicalCategory: Doc<"lineItems">["canonicalCategory"];
    period: string;
    status: Doc<"lineItems">["status"];
    renewal: Doc<"lineItems">["renewal"];
  }
>("offers:correctLineItem");
const confirmReviewedOffer = makeFunctionReference<
  "mutation",
  { offerId: Id<"offers">; expectedRevision: number }
>("offers:confirmReviewed");
const getComparison = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces"> },
  ComparisonData
>("offers:getComparison");
const updateComparisonSettings = makeFunctionReference<
  "mutation",
  {
    workspaceId: Id<"workspaces">;
    annualCostGrowthBps: number;
    scenario: "conservative" | "optimistic";
  }
>("offers:updateComparisonSettings");
const getSchoolResearch = makeFunctionReference<
  "query",
  { schoolId: Id<"schools"> },
  {
    school: Doc<"schools">;
    run: Doc<"researchRuns"> | null;
    sources: Doc<"sources">[];
  }
>("research:getForSchool");
const startSchoolResearch = makeFunctionReference<
  "mutation",
  { schoolId: Id<"schools"> }
>("research:start");
const listQuestions = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces"> },
  Doc<"questions">[]
>("questions:listForWorkspace");
const getQuestionDraftPage = makeFunctionReference<
  "query",
  { questionId: Id<"questions"> },
  QuestionDraftData
>("questions:getDraftPage");
const openQuestionDraft = makeFunctionReference<
  "mutation",
  { questionId: Id<"questions"> }
>("questions:openDraft");
const saveQuestionDraft = makeFunctionReference<
  "mutation",
  {
    draftId: Id<"mailDrafts">;
    expectedRevision: number;
    recipient: string;
    subject: string;
    bodyText: string;
  },
  { revision: number }
>("questions:saveDraft");
const approveQuestionDraft = makeFunctionReference<
  "mutation",
  {
    draftId: Id<"mailDrafts">;
    expectedRevision: number;
    offDomainConfirmed: boolean;
  }
>("questions:approveDraft");
const confirmQuestionReply = makeFunctionReference<
  "mutation",
  {
    proposalId: Id<"replyProposals">;
    expectedProposalRevision: number;
    expectedQuestionRevision: number;
    expectedLineItemRevision: number;
    renewal: Doc<"lineItems">["renewal"];
  }
>("questions:confirmReply");
const rejectQuestionReply = makeFunctionReference<
  "mutation",
  {
    proposalId: Id<"replyProposals">;
    expectedProposalRevision: number;
    expectedQuestionRevision: number;
  }
>("questions:rejectReply");
const chooseCurrentSchool = makeFunctionReference<
  "mutation",
  { workspaceId: Id<"workspaces">; schoolId: Id<"schools"> },
  Id<"schools">
>("workspaces:chooseCurrentSchool");

function usePrivatePreviews(documents: DocumentSummary[] | undefined) {
  const token = useAuthToken();
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL?.replace(/\/$/, "");
  const [previews, setPreviews] = useState<{
    urls: Record<string, string>;
    failed: Set<string>;
  }>({ urls: {}, failed: new Set() });

  useEffect(() => {
    const present = (documents ?? []).filter(
      ({ rawState }) => rawState === "present",
    );
    if (!token || !siteUrl || present.length === 0) {
      return;
    }

    const controller = new AbortController();
    const objectUrls: string[] = [];
    void Promise.all(
      present.map(async ({ _id }) => {
        try {
          const response = await fetch(
            `${siteUrl}/documents/preview?documentId=${encodeURIComponent(_id)}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            },
          );
          if (!response.ok) return [_id, null] as const;
          const objectUrl = URL.createObjectURL(await response.blob());
          objectUrls.push(objectUrl);
          return [_id, objectUrl] as const;
        } catch {
          return [_id, null] as const;
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      const urls: Record<string, string> = {};
      const failed = new Set<string>();
      entries.forEach(([id, url]) => {
        if (url) urls[id] = url;
        else failed.add(id);
      });
      setPreviews({ urls, failed });
    });

    return () => {
      controller.abort();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [documents, siteUrl, token]);

  if (!token || !siteUrl) {
    return {
      urls: {},
      failed: new Set(
        (documents ?? [])
          .filter(({ rawState }) => rawState === "present")
          .map(({ _id }) => _id),
      ),
    };
  }
  return previews;
}

const PRIVATE_PATH =
  /^\/(workspace|compare|decision|offers\/[^/]+\/review|schools\/[^/]+|questions\/[^/]+\/draft)$/;

function intendedPath(value: unknown, fallback = "/workspace") {
  return typeof value === "string" && PRIVATE_PATH.test(value)
    ? value
    : fallback;
}

function SessionStatus() {
  return (
    <main id="main" className="status-page">
      <p role="status">Checking your session…</p>
    </main>
  );
}

function SignInRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (location.pathname !== "/auth") {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: intendedPath(location.pathname) }}
      />
    );
  }

  async function submit(mode: AuthMode, credentials: AuthCredentials) {
    setSubmitting(true);
    setSubmitError(null);
    const form = new FormData();
    form.set("email", credentials.email);
    form.set("password", credentials.password);
    form.set("flow", mode === "register" ? "signUp" : "signIn");
    try {
      await signIn("password", form);
    } catch {
      setSubmitError("Check your email and password, then try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPage
      onBack={() => void navigate("/")}
      onSubmit={(mode, credentials) => void submit(mode, credentials)}
      submitError={submitError}
      submitting={submitting}
    />
  );
}

function AgeGate({ profile }: { profile: Doc<"profiles"> | null | undefined }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const confirm = useMutation(confirmAge);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const target = intendedPath(
    (location.state as { from?: unknown } | null)?.from,
    location.pathname === "/auth" || location.pathname === "/age"
      ? "/workspace"
      : intendedPath(location.pathname),
  );

  if (profile === undefined) return <SessionStatus />;
  if (profile?.ageConfirmedAt) {
    if (location.pathname === "/auth" || location.pathname === "/age") {
      return <Navigate to={target} replace />;
    }
    return <PrivateRoute />;
  }
  if (location.pathname !== "/age") {
    return <Navigate to="/age" replace state={{ from: target }} />;
  }

  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await confirm({ confirmed: true });
      void navigate(target, { replace: true });
    } catch {
      setSubmitError("We couldn't create your workspace. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AgeConfirmationPage
      onConfirm={handleConfirm}
      onSignOut={() => void signOut()}
      submitError={submitError}
      submitting={submitting}
    />
  );
}

function WorkspacePage() {
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const workspace = useQuery(getCurrentWorkspace, {});
  const profile = useQuery(getCurrentProfile, {});
  const remove = useMutation(removeWorkspace);
  const documents = useQuery(
    listDocuments,
    workspace ? { workspaceId: workspace._id } : "skip",
  );
  const offers = useQuery(
    listOffers,
    workspace ? { workspaceId: workspace._id } : "skip",
  );
  const questions = useQuery(
    listQuestions,
    workspace ? { workspaceId: workspace._id } : "skip",
  );
  const createUploadUrl = useMutation(generateUploadUrl);
  const finalize = useMutation(finalizeUpload);
  const resolve = useMutation(resolveDuplicate);
  const retry = useMutation(retryValidation);
  const removeRaw = useMutation(deleteRaw);
  const retryInbox = useMutation(retryInboxProvisioning);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [inboxRetrying, setInboxRetrying] = useState(false);
  const [duplicate, setDuplicate] = useState<{
    existingDocumentId: Id<"offerDocuments">;
    storageId: Id<"_storage">;
    fileName: string;
  }>();
  const previews = usePrivatePreviews(documents);

  if (workspace === undefined) return <SessionStatus />;
  if (workspace === null) return <Navigate to="/" replace />;
  const workspaceId = workspace._id;

  async function handleUpload(file: File) {
    setUploadError(null);
    const uploadUrl = await createUploadUrl({ workspaceId });
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) throw new Error("Upload failed");
    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("storageId" in payload) ||
      typeof payload.storageId !== "string"
    ) {
      throw new Error("Upload response invalid");
    }
    const storageId = payload.storageId as Id<"_storage">;
    const result = await finalize({
      workspaceId,
      storageId,
      fileName: file.name,
    });
    if (result.status === "duplicate") {
      setDuplicate({
        existingDocumentId: result.existingDocumentId,
        storageId,
        fileName: file.name,
      });
    }
    if (result.status === "rejected") {
      throw new Error("Upload filename invalid");
    }
  }

  async function handleDuplicateChoice(choice: DuplicateChoice) {
    if (!duplicate) return;
    await resolve({
      workspaceId,
      existingDocumentId: duplicate.existingDocumentId,
      storageId: duplicate.storageId,
      fileName: duplicate.fileName,
      choice: choice === "new-version" ? "keep_new" : choice,
    });
    setDuplicate(undefined);
  }

  const uploadItems: UploadItem[] = (documents ?? []).map((document) => ({
    id: document._id,
    filename: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.byteSize,
    processingState: document.processingState,
    updatedAtLabel: new Date(document.updatedAt).toLocaleString(),
    errorMessage: document.errorMessage,
    requiredAction:
      document.processingState === "failed"
        ? "Correct the file and retry."
        : undefined,
    previewState:
      document.rawState === "present" && !previews.failed.has(document._id)
        ? "available"
        : "unavailable",
    privatePreviewUrl: previews.urls[document._id],
    rawDeletedAtLabel: document.rawDeletedAt
      ? `Raw file deleted ${new Date(document.rawDeletedAt).toLocaleString()}`
      : undefined,
    rawAvailable: document.rawState === "present",
  }));

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove({ workspaceId });
      void navigate("/", { replace: true });
    } catch {
      setDeleteError("We couldn't delete your workspace. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main id="main" className="workspace-page">
      <h1>Your private workspace</h1>
      <p>{workspace.name}</p>
      <p>{documents?.length ?? 0} of 4 offers added</p>
      {uploadError ? <p role="alert">{uploadError}</p> : null}
      <UploadOfferPanel
        uploads={uploadItems}
        duplicate={
          duplicate
            ? {
                filename: duplicate.fileName,
                currentOfferName:
                  documents?.find(
                    ({ _id }) => _id === duplicate.existingDocumentId,
                  )?.fileName ?? "matching",
              }
            : undefined
        }
        onUpload={handleUpload}
        onDuplicateChoice={(choice) => {
          void handleDuplicateChoice(choice).catch(() =>
            setUploadError("We couldn't apply that duplicate choice."),
          );
        }}
        onRetry={async (documentId) => {
          try {
            await retry({ documentId: documentId as Id<"offerDocuments"> });
          } catch {
            setUploadError("We couldn't retry that file.");
          }
        }}
        onDeleteRaw={async (documentId) => {
          try {
            await removeRaw({
              documentId: documentId as Id<"offerDocuments">,
            });
          } catch {
            setUploadError("We couldn't delete that raw file.");
          }
        }}
      />
      {(offers ?? []).map((offer) => {
        const document = documents?.find(({ _id }) => _id === offer.documentId);
        if (!document) return null;
        const action =
          document.processingState === "needs_school_confirmation"
            ? "Confirm school for"
            : offer.reviewState === "preliminary"
              ? "Review offer from"
              : "View reviewed offer from";
        return (
          <span key={offer._id}>
            <Link to={`/offers/${offer._id}/review`}>
              {action} {document.fileName}
            </Link>
            {offer.schoolId ? (
              <Link to={`/schools/${offer.schoolId}`}>
                View official sources
              </Link>
            ) : null}
          </span>
        );
      })}
      <Link to="/compare">Compare offers</Link>
      <Link to="/decision">Your decision</Link>
      {(questions ?? []).map((question) => (
        <Link key={question._id} to={`/questions/${question._id}/draft`}>
          Clarify: {question.prompt}
        </Link>
      ))}
      {profile?.agentMailProvisioningState === "ready" ? (
        <p>Forward offers to {profile.agentMailInboxAddress}</p>
      ) : profile?.agentMailProvisioningState === "failed" ? (
        <section aria-label="Email forwarding">
          <p role="alert">
            Email forwarding setup is unavailable. Your uploads still work.
          </p>
          <button
            type="button"
            disabled={inboxRetrying}
            onClick={() => {
              setInboxRetrying(true);
              void retryInbox({}).finally(() => setInboxRetrying(false));
            }}
          >
            {inboxRetrying ? "Retrying…" : "Retry inbox setup"}
          </button>
        </section>
      ) : (
        <p role="status">Setting up private email forwarding…</p>
      )}
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
      {!confirmingDelete ? (
        <button type="button" onClick={() => setConfirmingDelete(true)}>
          Delete workspace
        </button>
      ) : (
        <section
          className="delete-workspace"
          aria-labelledby="delete-workspace-heading"
        >
          <h2 id="delete-workspace-heading">Delete this workspace?</h2>
          <p>This permanently removes its schools and cannot be undone.</p>
          {deleteError ? <p role="alert">{deleteError}</p> : null}
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? "Deleting…" : "Delete permanently"}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => setConfirmingDelete(false)}
          >
            Cancel
          </button>
        </section>
      )}
    </main>
  );
}

function ComparisonRoute() {
  const workspace = useQuery(getCurrentWorkspace, {});
  const data = useQuery(
    getComparison,
    workspace ? { workspaceId: workspace._id } : "skip",
  );
  const updateSettings = useMutation(updateComparisonSettings);
  if (workspace === undefined || data === undefined) return <SessionStatus />;
  if (workspace === null) return <Navigate to="/" replace />;
  return (
    <ComparisonPage
      data={data}
      onUpdateSettings={(settings) =>
        updateSettings({ workspaceId: workspace._id, ...settings })
      }
    />
  );
}

function DecisionRoute() {
  const workspace = useQuery(getCurrentWorkspace, {});
  const comparison = useQuery(
    getComparison,
    workspace ? { workspaceId: workspace._id } : "skip",
  );
  const questions = useQuery(
    listQuestions,
    workspace ? { workspaceId: workspace._id } : "skip",
  );
  const chooseSchool = useMutation(chooseCurrentSchool);
  if (
    workspace === undefined ||
    comparison === undefined ||
    questions === undefined
  ) {
    return <SessionStatus />;
  }
  if (workspace === null) return <Navigate to="/" replace />;
  const openQuestionCount = questions.filter((question) =>
    [
      "open",
      "drafting",
      "queued",
      "sent",
      "delivered",
      "reply_received",
      "awaiting_confirmation",
      "partially_resolved",
    ].includes(question.state),
  ).length;
  const data: DecisionData = {
    settings: comparison.settings,
    currentChoiceSchoolId: workspace.currentChoiceSchoolId ?? null,
    offers: comparison.offers,
    openQuestionCount,
  };
  return (
    <DecisionPage
      data={data}
      onChooseSchool={(schoolId) =>
        chooseSchool({ workspaceId: workspace._id, schoolId })
      }
    />
  );
}

function ResearchRoute() {
  const match = useLocation().pathname.match(/^\/schools\/([^/]+)$/);
  const schoolId = match?.[1] as Id<"schools"> | undefined;
  const data = useQuery(getSchoolResearch, schoolId ? { schoolId } : "skip");
  const start = useMutation(startSchoolResearch);
  if (!schoolId) return <Navigate to="/workspace" replace />;
  if (data === undefined) return <SessionStatus />;
  return (
    <ResearchPage
      schoolName={data.school.name}
      data={data}
      onStart={() => start({ schoolId })}
    />
  );
}

function QuestionDraftRoute() {
  const match = useLocation().pathname.match(/^\/questions\/([^/]+)\/draft$/);
  const questionId = match?.[1] as Id<"questions"> | undefined;
  const data = useQuery(
    getQuestionDraftPage,
    questionId ? { questionId } : "skip",
  );
  const open = useMutation(openQuestionDraft);
  const save = useMutation(saveQuestionDraft);
  const approve = useMutation(approveQuestionDraft);
  const confirmReply = useMutation(confirmQuestionReply);
  const rejectReply = useMutation(rejectQuestionReply);
  if (!questionId) return <Navigate to="/workspace" replace />;
  if (data === undefined) return <SessionStatus />;
  return (
    <QuestionDraftPage
      data={data}
      onOpen={() => open({ questionId })}
      onSave={(draft) => {
        if (!data.draft) throw new Error("Draft not created");
        return save({ draftId: data.draft._id as Id<"mailDrafts">, ...draft });
      }}
      onApprove={(approval) => {
        if (!data.draft) throw new Error("Draft not created");
        return approve({
          draftId: data.draft._id as Id<"mailDrafts">,
          ...approval,
        });
      }}
      onConfirmReply={(confirmation) =>
        confirmReply({
          ...confirmation,
          proposalId: confirmation.proposalId as Id<"replyProposals">,
        })
      }
      onKeepUnresolved={(rejection) =>
        rejectReply({
          ...rejection,
          proposalId: rejection.proposalId as Id<"replyProposals">,
        })
      }
    />
  );
}

function OfferReviewRoute() {
  const match = useLocation().pathname.match(/^\/offers\/([^/]+)\/review$/);
  const id = match?.[1] as Id<"offers"> | undefined;
  const review = useQuery(getOfferReview, id ? { offerId: id } : "skip");
  const confirmSchool = useMutation(confirmOfferSchool);
  const confirmManual = useMutation(confirmManualSchool);
  const correctItem = useMutation(correctOfferLineItem);
  const confirmReviewed = useMutation(confirmReviewedOffer);

  if (!id) return <Navigate to="/workspace" replace />;
  if (review === undefined) return <SessionStatus />;
  return (
    <OfferReviewPage
      review={review}
      onConfirmSchool={(schoolId) => confirmSchool({ offerId: id, schoolId })}
      onConfirmManual={(name, officialDomain) =>
        confirmManual({ offerId: id, name, officialDomain })
      }
      onSaveItem={(item) =>
        correctItem({
          lineItemId: item._id,
          expectedRevision: item.revision,
          amountCents: item.amountCents,
          canonicalCategory: item.canonicalCategory,
          period: item.period,
          status: item.status,
          renewal: item.renewal,
        })
      }
      onConfirmReviewed={(expectedRevision) =>
        confirmReviewed({ offerId: id, expectedRevision })
      }
    />
  );
}

function PrivateRoute() {
  const { pathname } = useLocation();
  if (pathname === "/workspace") return <WorkspacePage />;
  if (pathname === "/compare") return <ComparisonRoute />;
  if (pathname === "/decision") return <DecisionRoute />;
  if (/^\/schools\/[^/]+$/.test(pathname)) return <ResearchRoute />;
  if (/^\/questions\/[^/]+\/draft$/.test(pathname))
    return <QuestionDraftRoute />;
  if (/^\/offers\/[^/]+\/review$/.test(pathname)) return <OfferReviewRoute />;
  return (
    <main id="main" className="not-found-page">
      <h1>Not found</h1>
      <p>That AidLens page is not available yet.</p>
      <Link to="/workspace">Return to your workspace</Link>
    </main>
  );
}

function SignedInRoute() {
  return <AgeGate profile={useQuery(getCurrentProfile, {})} />;
}

export default function AccountRoutes() {
  return (
    <>
      <AuthLoading>
        <SessionStatus />
      </AuthLoading>
      <Unauthenticated>
        <SignInRoute />
      </Unauthenticated>
      <Authenticated>
        <SignedInRoute />
      </Authenticated>
    </>
  );
}
