import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import ComparisonPage, { type ComparisonData } from "./ComparisonPage";

const item = (id: string, category: string, amountCents: number | null) => ({
  _id: id,
  originalLabel: id,
  canonicalCategory: category,
  amountCents,
  period: "academic_year",
  status: "offered",
  renewal: { kind: category === "grant" ? "conditional" : "unknown" },
  requiredForCostTotal: category === "direct_cost",
});

const offer = (id: string, name: string, reviewed = true) => ({
  offer: {
    _id: id,
    reviewState: reviewed ? "reviewed" : "preliminary",
    housingAssumption: id === "one" ? "on_campus" : "off_campus",
    residencyAssumption: "resident",
    enrollmentIntensity: "full_time",
    academicYear: "2026-2027",
  },
  school: { name },
  items: [
    item(`${id}-cost`, "direct_cost", 3_000_000),
    item(`${id}-grant`, "grant", id === "one" ? 1_000_000 : 500_000),
  ],
});

it("S6.1: locks comparison until two offers exist", () => {
  render(
    <MemoryRouter>
      <ComparisonPage
        data={
          {
            settings: { annualCostGrowthBps: 300, scenario: "conservative" },
            offers: [offer("one", "Alpha")],
          } as ComparisonData
        }
        onUpdateSettings={vi.fn()}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText("1 of 2 offers ready")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Add another offer" }),
  ).toHaveAttribute("href", "/workspace");
});

it("S6 comparison: shows explicit states, assumptions, totals, and reactive controls", async () => {
  const user = userEvent.setup();
  const update = vi.fn().mockResolvedValue(undefined);
  render(
    <ComparisonPage
      data={
        {
          settings: { annualCostGrowthBps: 300, scenario: "conservative" },
          offers: [offer("one", "Alpha"), offer("two", "Beta", false)],
        } as ComparisonData
      }
      onUpdateSettings={update}
    />,
  );

  expect(screen.getByRole("heading", { name: "Compare offers" })).toBeVisible();
  expect(screen.getByText("Preliminary")).toBeVisible();
  expect(
    screen.getByText("Offers use different housing assumptions."),
  ).toBeVisible();
  expect(screen.getByRole("row", { name: /Annual net price/ })).toBeVisible();
  expect(
    screen.getByRole("row", { name: /Four-year net price/ }),
  ).toBeVisible();
  expect(screen.queryByText(/best/i)).not.toBeInTheDocument();

  await user.click(screen.getByRole("radio", { name: "Optimistic" }));
  expect(update).toHaveBeenCalledWith({
    annualCostGrowthBps: 300,
    scenario: "optimistic",
  });
  await user.clear(screen.getByLabelText("Annual cost growth percent"));
  await user.type(screen.getByLabelText("Annual cost growth percent"), "4.5");
  await user.click(screen.getByRole("button", { name: "Apply growth" }));
  expect(update).toHaveBeenCalledWith({
    annualCostGrowthBps: 450,
    scenario: "conservative",
  });
});
