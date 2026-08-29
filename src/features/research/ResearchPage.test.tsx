import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ResearchPage from "./ResearchPage";

it("S7.10: distinguishes official evidence and exposes recoverable research state", async () => {
  const user = userEvent.setup();
  const start = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <ResearchPage
      schoolName="Example University"
      data={{ run: null, sources: [] }}
      onStart={start}
    />,
  );
  expect(screen.getByText("No official pages researched yet.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Research official sources" }));
  expect(start).toHaveBeenCalledOnce();

  rerender(
    <ResearchPage
      schoolName="Example University"
      data={{
        run: { state: "succeeded" },
        sources: [
          {
            _id: "source-1",
            kind: "official_page",
            title: "Financial aid policy",
            url: "https://example.edu/aid",
            excerpt: "Scholarships require full-time enrollment.",
            retrievedAt: Date.now(),
          },
        ],
      }}
      onStart={start}
    />,
  );
  expect(screen.getByText("Official school page")).toBeVisible();
  expect(screen.getByText("Scholarships require full-time enrollment.")).toBeVisible();
  expect(screen.getByRole("link", { name: /Open Financial aid policy/ })).toHaveAttribute(
    "rel",
    "noreferrer",
  );
});
