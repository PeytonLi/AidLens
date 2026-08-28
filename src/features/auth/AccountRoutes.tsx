import { useAuthActions } from "@convex-dev/auth/react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import AgeConfirmationPage from "./AgeConfirmationPage";
import AuthPage, { type AuthCredentials, type AuthMode } from "./AuthPage";

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
  const remove = useMutation(removeWorkspace);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (workspace === undefined) return <SessionStatus />;
  if (workspace === null) return <Navigate to="/" replace />;
  const workspaceId = workspace._id;

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
      <p>0 of 4 offers added</p>
      <button type="button" disabled>
        Upload an offer
      </button>
      <p>Email forwarding will be available soon.</p>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
      {!confirmingDelete ? (
        <button type="button" onClick={() => setConfirmingDelete(true)}>
          Delete workspace
        </button>
      ) : (
        <section aria-labelledby="delete-workspace-heading">
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

function PrivateRoute() {
  const { pathname } = useLocation();
  if (pathname === "/workspace") return <WorkspacePage />;
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
