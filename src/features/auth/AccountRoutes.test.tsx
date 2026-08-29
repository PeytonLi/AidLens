import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface AuthTestState {
  status: "loading" | "signedOut" | "signedIn";
  profile:
    | undefined
    | null
    | {
        ageConfirmedAt?: number;
        agentMailProvisioningState?: string;
        agentMailInboxAddress?: string;
      };
  workspace:
    undefined | null | { _id: string; name: string; generation: number };
  documents: unknown[] | undefined;
  review: unknown;
  offers: unknown[] | undefined;
  comparison: unknown;
  questions: unknown[] | undefined;
  questionDraft: unknown;
  token: string | null;
  signIn: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  confirmAge: ReturnType<typeof vi.fn>;
  removeWorkspace: ReturnType<typeof vi.fn>;
  generateUploadUrl: ReturnType<typeof vi.fn>;
  finalizeUpload: ReturnType<typeof vi.fn>;
  resolveDuplicate: ReturnType<typeof vi.fn>;
  retryValidation: ReturnType<typeof vi.fn>;
  deleteRaw: ReturnType<typeof vi.fn>;
  confirmSchool: ReturnType<typeof vi.fn>;
  updateComparisonSettings: ReturnType<typeof vi.fn>;
  retryInbox: ReturnType<typeof vi.fn>;
}

const auth = vi.hoisted((): AuthTestState => ({
  status: "signedOut",
  profile: undefined,
  workspace: undefined,
  documents: undefined,
  review: undefined,
  offers: undefined,
  comparison: undefined,
  questions: undefined,
  questionDraft: undefined,
  token: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  confirmAge: vi.fn(),
  removeWorkspace: vi.fn(),
  generateUploadUrl: vi.fn(),
  finalizeUpload: vi.fn(),
  resolveDuplicate: vi.fn(),
  retryValidation: vi.fn(),
  deleteRaw: vi.fn(),
  confirmSchool: vi.fn(),
  updateComparisonSettings: vi.fn(),
  retryInbox: vi.fn(),
}));

vi.mock("convex/react", () => ({
  AuthLoading: ({ children }: { children: ReactNode }) =>
    auth.status === "loading" ? children : null,
  Authenticated: ({ children }: { children: ReactNode }) =>
    auth.status === "signedIn" ? children : null,
  Unauthenticated: ({ children }: { children: ReactNode }) =>
    auth.status === "signedOut" ? children : null,
  useQuery: (reference: object) => {
    const name = Object.getOwnPropertySymbols(reference)
      .map((symbol) => String(Reflect.get(reference, symbol)))
      .join();
    if (name.startsWith("profiles:")) return auth.profile;
    if (name === "workspaces:getCurrent") return auth.workspace;
    if (name === "offers:getReview") return auth.review;
    if (name === "offers:listForWorkspace") return auth.offers;
    if (name === "offers:getComparison") return auth.comparison;
    if (name === "questions:listForWorkspace") return auth.questions;
    if (name === "questions:getDraftPage") return auth.questionDraft;
    return auth.documents;
  },
  useMutation: (reference: object) => {
    const name = Object.getOwnPropertySymbols(reference)
      .map((symbol) => String(Reflect.get(reference, symbol)))
      .join();
    if (name === "profiles:retryInboxProvisioning") return auth.retryInbox;
    if (name.startsWith("profiles:")) return auth.confirmAge;
    if (name === "workspaces:remove") return auth.removeWorkspace;
    if (name === "documents:generateUploadUrl") return auth.generateUploadUrl;
    if (name === "documents:finalizeUpload") return auth.finalizeUpload;
    if (name === "documents:resolveDuplicate") return auth.resolveDuplicate;
    if (name === "documents:deleteRaw") return auth.deleteRaw;
    if (name === "offers:confirmSchool") return auth.confirmSchool;
    if (name === "offers:updateComparisonSettings")
      return auth.updateComparisonSettings;
    return auth.retryValidation;
  },
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: auth.signIn, signOut: auth.signOut }),
  useAuthToken: () => auth.token,
}));

import AccountRoutes from "./AccountRoutes";

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AccountRoutes />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.status = "signedOut";
  auth.profile = undefined;
  auth.workspace = undefined;
  auth.documents = undefined;
  auth.review = undefined;
  auth.offers = undefined;
  auth.comparison = undefined;
  auth.questions = [];
  auth.questionDraft = undefined;
  auth.token = null;
  auth.signIn.mockReset();
  auth.signOut.mockReset();
  auth.confirmAge.mockReset();
  auth.removeWorkspace.mockReset();
  auth.generateUploadUrl.mockReset();
  auth.finalizeUpload.mockReset();
  auth.resolveDuplicate.mockReset();
  auth.retryValidation.mockReset();
  auth.deleteRaw.mockReset();
  auth.confirmSchool.mockReset();
  auth.updateComparisonSettings.mockReset();
  auth.retryInbox.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("private account routes", () => {
  it("shows only a neutral state while authentication is loading", () => {
    auth.status = "loading";

    renderRoute("/workspace");

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking your session",
    );
    expect(
      screen.queryByText("Your private workspace"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /sign in/i }),
    ).not.toBeInTheDocument();
  });

  it("sends a signed-out private route to sign in without rendering private content", async () => {
    renderRoute("/workspace");

    expect(
      await screen.findByRole("heading", { name: "Sign in to AidLens" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Your private workspace"),
    ).not.toBeInTheDocument();
  });

  it("requires an unchecked adult confirmation before creating a workspace", async () => {
    auth.status = "signedIn";
    auth.profile = null;

    renderRoute("/workspace");

    const checkbox = await screen.findByRole("checkbox", {
      name: "I am at least 18 years old.",
    });
    expect(checkbox).not.toBeChecked();
    expect(auth.confirmAge).not.toHaveBeenCalled();
  });

  it("restores the intended private route after authentication and confirmation", async () => {
    auth.status = "signedOut";
    const view = renderRoute("/workspace");
    await screen.findByRole("heading", { name: "Sign in to AidLens" });

    auth.status = "signedIn";
    auth.profile = { ageConfirmedAt: 1 };
    auth.workspace = {
      _id: "workspace-1",
      name: "My offers",
      generation: 0,
    };
    view.rerender(
      <MemoryRouter initialEntries={["/workspace"]}>
        <AccountRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Your private workspace" }),
    ).toBeInTheDocument();
  });

  it("deletes the current workspace only after explicit confirmation", async () => {
    const user = userEvent.setup();
    auth.status = "signedIn";
    auth.profile = { ageConfirmedAt: 1 };
    auth.workspace = {
      _id: "workspace-1",
      name: "My offers",
      generation: 0,
    };
    auth.removeWorkspace.mockResolvedValue(undefined);

    renderRoute("/workspace");
    await user.click(
      await screen.findByRole("button", { name: "Delete workspace" }),
    );
    expect(auth.removeWorkspace).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    await waitFor(() =>
      expect(auth.removeWorkspace).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
      }),
    );
  });

  it("unmounts private content when authentication expires", async () => {
    auth.status = "signedIn";
    auth.profile = { ageConfirmedAt: 1 };
    auth.workspace = {
      _id: "workspace-1",
      name: "My offers",
      generation: 0,
    };
    const view = renderRoute("/workspace");
    await screen.findByRole("heading", { name: "Your private workspace" });

    auth.status = "signedOut";
    view.rerender(
      <MemoryRouter initialEntries={["/workspace"]}>
        <AccountRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Sign in to AidLens" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("My offers")).not.toBeInTheDocument();
  });

  it("keeps the workspace visible when deletion fails", async () => {
    const user = userEvent.setup();
    auth.status = "signedIn";
    auth.profile = { ageConfirmedAt: 1 };
    auth.workspace = {
      _id: "workspace-1",
      name: "My offers",
      generation: 0,
    };
    auth.removeWorkspace.mockRejectedValue(new Error("provider detail"));

    renderRoute("/workspace");
    await user.click(
      await screen.findByRole("button", { name: "Delete workspace" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't delete your workspace. Try again.",
    );
    expect(screen.getByText("My offers")).toBeInTheDocument();
    expect(screen.queryByText("provider detail")).not.toBeInTheDocument();
  });

  it("uploads a supported offer through the owner-scoped Convex flow", async () => {
    const user = userEvent.setup();
    auth.status = "signedIn";
    auth.profile = { ageConfirmedAt: 1 };
    auth.workspace = {
      _id: "workspace-1",
      name: "My offers",
      generation: 0,
    };
    auth.documents = [];
    auth.generateUploadUrl.mockResolvedValue("https://upload.example.test");
    auth.finalizeUpload.mockResolvedValue({
      status: "created",
      documentId: "document-1",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ storageId: "storage-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderRoute("/workspace");
    const file = new File(["%PDF-1.7\n%%EOF"], "award.pdf", {
      type: "application/pdf",
    });
    await user.upload(await screen.findByLabelText("Upload an offer"), file);

    await waitFor(() =>
      expect(auth.generateUploadUrl).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
      }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://upload.example.test",
      expect.objectContaining({ method: "POST", body: file }),
    );
    expect(auth.finalizeUpload).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      storageId: "storage-1",
      fileName: "award.pdf",
    });
  });

  it("fetches a private preview with the current auth token", async () => {
    auth.status = "signedIn";
    auth.profile = { ageConfirmedAt: 1 };
    auth.workspace = {
      _id: "workspace-1",
      name: "My offers",
      generation: 0,
    };
    auth.token = "private-jwt";
    auth.documents = [
      {
        _id: "document-1",
        fileName: "award.pdf",
        mimeType: "application/pdf",
        byteSize: 12,
        processingState: "extracting",
        rawState: "present",
        updatedAt: 1,
      },
    ];
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://aidlens.convex.site");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("private", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:private-preview"),
      revokeObjectURL: vi.fn(),
    });

    renderRoute("/workspace");

    expect(await screen.findByTitle("award.pdf preview")).toHaveAttribute(
      "src",
      "blob:private-preview",
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://aidlens.convex.site/documents/preview?documentId=document-1",
      expect.objectContaining({
        headers: { Authorization: "Bearer private-jwt" },
      }),
    );
  });

  it("deletes an offer's raw file through the owner-scoped mutation", async () => {
    const user = userEvent.setup();
    auth.status = "signedIn";
    auth.profile = { ageConfirmedAt: 1 };
    auth.workspace = {
      _id: "workspace-1",
      name: "My offers",
      generation: 0,
    };
    auth.documents = [
      {
        _id: "document-1",
        fileName: "award.pdf",
        mimeType: "application/pdf",
        byteSize: 12,
        processingState: "extracting",
        rawState: "present",
        updatedAt: 1,
      },
    ];
    auth.deleteRaw.mockResolvedValue(true);

    renderRoute("/workspace");
    await user.click(
      await screen.findByRole("button", { name: "Delete raw award.pdf" }),
    );

    expect(auth.deleteRaw).toHaveBeenCalledWith({ documentId: "document-1" });
  });

  it("routes an extracted offer through explicit school confirmation", async () => {
    const user = userEvent.setup();
    auth.status = "signedIn";
    auth.profile = { ageConfirmedAt: 1 };
    auth.workspace = {
      _id: "workspace-1",
      name: "My offers",
      generation: 0,
    };
    auth.review = {
      offer: { _id: "offer-1", reviewState: "preliminary", revision: 0 },
      school: {
        _id: "school-1",
        name: "Example University",
        officialDomain: "example.edu",
        identityState: "candidate",
      },
      candidates: [
        {
          _id: "school-1",
          name: "Example University",
          officialDomain: "example.edu",
          identityState: "candidate",
        },
      ],
      items: [],
      rawDeletedAt: null,
    };
    auth.confirmSchool.mockResolvedValue({ status: "confirmed" });

    renderRoute("/offers/offer-1/review");
    await user.click(
      await screen.findByRole("radio", { name: /Example University/ }),
    );
    await user.click(screen.getByRole("button", { name: "Confirm school" }));

    expect(auth.confirmSchool).toHaveBeenCalledWith({
      offerId: "offer-1",
      schoolId: "school-1",
    });
  });

  it("links a processed workspace document to its review flow", async () => {
    auth.status = "signedIn";
    auth.profile = { ageConfirmedAt: 1 };
    auth.workspace = {
      _id: "workspace-1",
      name: "My offers",
      generation: 0,
    };
    auth.documents = [
      {
        _id: "document-1",
        fileName: "award.pdf",
        mimeType: "application/pdf",
        byteSize: 12,
        processingState: "needs_school_confirmation",
        rawState: "present",
        updatedAt: 1,
      },
    ];
    auth.offers = [
      {
        _id: "offer-1",
        documentId: "document-1",
        reviewState: "preliminary",
      },
    ];

    renderRoute("/workspace");

    expect(
      await screen.findByRole("link", { name: "Confirm school for award.pdf" }),
    ).toHaveAttribute("href", "/offers/offer-1/review");
  });

  it("renders the authenticated private comparison route", async () => {
    auth.status = "signedIn";
    auth.profile = { ageConfirmedAt: 1 };
    auth.workspace = { _id: "workspace-1", name: "My offers", generation: 0 };
    auth.comparison = {
      settings: { annualCostGrowthBps: 300, scenario: "conservative" },
      offers: [],
    };

    renderRoute("/compare");

    expect(await screen.findByText("0 of 2 offers ready")).toBeVisible();
  });

  it("shows a retry when private forwarding inbox provisioning failed", async () => {
    const user = userEvent.setup();
    auth.status = "signedIn";
    auth.profile = {
      ageConfirmedAt: 1,
      agentMailProvisioningState: "failed",
    };
    auth.workspace = { _id: "workspace-1", name: "My offers", generation: 0 };
    auth.documents = [];
    auth.offers = [];
    auth.retryInbox.mockResolvedValue({ status: "scheduled" });

    renderRoute("/workspace");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email forwarding setup is unavailable",
    );
    await user.click(screen.getByRole("button", { name: "Retry inbox setup" }));
    expect(auth.retryInbox).toHaveBeenCalledOnce();
  });
});
