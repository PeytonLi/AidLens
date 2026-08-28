import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthPage from "./AuthPage";

afterEach(() => {
  cleanup();
});

describe("AuthPage", () => {
  it("S3.2: switches between sign-in and registration modes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onBack = vi.fn();
    render(<AuthPage onSubmit={onSubmit} onBack={onBack} />);

    expect(
      screen.getByRole("heading", { name: "Sign in to AidLens" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "type",
      "email",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );

    await user.click(screen.getByRole("button", { name: "Create an account" }));
    expect(
      screen.getByRole("heading", { name: "Create your AidLens account" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email address"), "student@test.dev");
    await user.type(screen.getByLabelText("Password"), "safe password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(onSubmit).toHaveBeenCalledWith("register", {
      email: "student@test.dev",
      password: "safe password",
    });

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("S3.9: reports field errors in a focused validation summary", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AuthPage onSubmit={onSubmit} onBack={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const summary = screen.getByRole("alert");
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent("Check the highlighted fields");
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(
      "Enter your email address.",
    );
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "Enter your password.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("S3.9: rejects a malformed email inline", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AuthPage onSubmit={onSubmit} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText("Email address"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "safe password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("alert")).toHaveFocus();
    expect(
      screen.getByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("S3.9: reveals and hides the password", async () => {
    const user = userEvent.setup();
    render(<AuthPage onSubmit={vi.fn()} onBack={vi.fn()} />);
    const password = screen.getByLabelText("Password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("S3.2: disables the form while authentication is submitting", () => {
    render(<AuthPage submitting onSubmit={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByLabelText("Email address")).toBeDisabled();
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create an account" }),
    ).toBeDisabled();
  });

  it("S3.9: focuses a submit-level authentication error", () => {
    const props = { onSubmit: vi.fn(), onBack: vi.fn() };
    const { rerender } = render(<AuthPage {...props} />);

    rerender(
      <AuthPage
        {...props}
        submitError="Email or password is incorrect. Try again."
      />,
    );

    const summary = screen.getByRole("alert");
    expect(summary).toHaveTextContent(
      "Email or password is incorrect. Try again.",
    );
    expect(summary).toHaveFocus();
  });
});
