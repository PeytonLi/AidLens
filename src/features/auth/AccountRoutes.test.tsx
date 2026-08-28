import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface AuthTestState {
  status: "loading" | "signedOut" | "signedIn";
  profile: undefined | null | { ageConfirmedAt?: number };
  workspace:
    undefined | null | { _id: string; name: string; generation: number };
  signIn: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  confirmAge: ReturnType<typeof vi.fn>;
  removeWorkspace: ReturnType<typeof vi.fn>;
}

const auth = vi.hoisted((): AuthTestState => ({
  status: "signedOut",
  profile: undefined,
  workspace: undefined,
  signIn: vi.fn(),
  signOut: vi.fn(),
  confirmAge: vi.fn(),
  removeWorkspace: vi.fn(),
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
    return name.startsWith("profiles:") ? auth.profile : auth.workspace;
  },
  useMutation: (reference: object) => {
    const name = Object.getOwnPropertySymbols(reference)
      .map((symbol) => String(Reflect.get(reference, symbol)))
      .join();
    return name.startsWith("profiles:")
      ? auth.confirmAge
      : auth.removeWorkspace;
  },
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: auth.signIn, signOut: auth.signOut }),
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
  auth.signIn.mockReset();
  auth.signOut.mockReset();
  auth.confirmAge.mockReset();
  auth.removeWorkspace.mockReset();
});

afterEach(cleanup);

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
});
