import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AgeConfirmationPage from "./AgeConfirmationPage";

afterEach(() => {
  cleanup();
});

describe("AgeConfirmationPage", () => {
  it("S3.3: blocks and announces an unchecked age confirmation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onSignOut = vi.fn();
    render(<AgeConfirmationPage onConfirm={onConfirm} onSignOut={onSignOut} />);
    expect(
      screen.getByRole("heading", { name: "Confirm your age" }),
    ).toBeInTheDocument();
    const confirmation = screen.getByRole("checkbox", {
      name: "I am at least 18 years old.",
    });

    expect(confirmation).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent(
      "Confirm that you are at least 18 years old to continue.",
    );
    expect(error).toHaveFocus();
    expect(confirmation).toHaveAccessibleDescription(
      "Confirm that you are at least 18 years old to continue.",
    );
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(confirmation);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onConfirm).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("S3.4: disables repeated confirmation while creating the workspace", () => {
    render(
      <AgeConfirmationPage
        submitting
        onConfirm={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("checkbox", {
        name: "I am at least 18 years old.",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Creating workspace…" }),
    ).toBeDisabled();
  });

  it("S3.9: links to privacy and service-provider disclosures", () => {
    render(<AgeConfirmationPage onConfirm={vi.fn()} onSignOut={vi.fn()} />);

    expect(
      screen.getByRole("link", { name: "Privacy and data handling" }),
    ).toHaveAttribute("href", "/#privacy");
    expect(
      screen.getByRole("link", { name: "Service providers" }),
    ).toHaveAttribute("href", "/#service-providers");
  });

  it("announces a workspace-creation error without clearing confirmation", async () => {
    const user = userEvent.setup();
    const view = render(
      <AgeConfirmationPage onConfirm={vi.fn()} onSignOut={vi.fn()} />,
    );
    const confirmation = screen.getByRole("checkbox", {
      name: "I am at least 18 years old.",
    });
    await user.click(confirmation);

    view.rerender(
      <AgeConfirmationPage
        submitError="We couldn't create your workspace. Try again."
        onConfirm={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveFocus();
    expect(confirmation).toBeChecked();
  });
});
