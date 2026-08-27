import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("landing shell", () => {
  it("shows AidLens brand and primary CTAs", () => {
    render(<App />);

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
});
