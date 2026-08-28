import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
});

describe("landing shell", () => {
  it("shows AidLens brand and primary CTAs", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "AidLens" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Try the sample" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Compare my offers" }),
    ).toBeInTheDocument();
  });

  it("renders a safe not-found page without echoing an unknown path", () => {
    render(
      <MemoryRouter initialEntries={["/missing/private-secret"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Not found" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/private-secret/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
