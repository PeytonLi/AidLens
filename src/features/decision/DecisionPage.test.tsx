import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import DecisionPage, { type DecisionData } from "./DecisionPage";

const offer = (id: string, schoolId: string, name: string) => ({
  offer: {
    _id: id,
    reviewState: "reviewed",
    housingAssumption: "on_campus",
    residencyAssumption: "resident",
    enrollmentIntensity: "full_time",
    academicYear: "2026-2027",
  },
  school: { _id: schoolId, name },
  items: [
    {
      _id: `${id}-cost`,
      originalLabel: "Tuition",
      canonicalCategory: "direct_cost",
      amountCents: 3_000_000,
      period: "academic_year",
      status: "offered",
      renewal: { kind: "unknown" },
      requiredForCostTotal: true,
    },
    {
      _id: `${id}-grant`,
      originalLabel: "Grant",
      canonicalCategory: "grant",
      amountCents: id === "one" ? 1_000_000 : 500_000,
      period: "academic_year",
      status: "offered",
      renewal: { kind: "conditional" },
      requiredForCostTotal: false,
    },
  ],
});

it("S3.7: marks a current-choice school without ranking language", async () => {
  const user = userEvent.setup();
  const choose = vi.fn().mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <DecisionPage
        data={
          {
            settings: { annualCostGrowthBps: 300, scenario: "conservative" },
            currentChoiceSchoolId: null,
            openQuestionCount: 1,
            offers: [
              offer("one", "school-a", "Alpha College"),
              offer("two", "school-b", "Beta University"),
            ],
          } as DecisionData
        }
        onChooseSchool={choose}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: "Your decision" })).toBeVisible();
  expect(screen.getByText(/does not recommend a school/i)).toBeVisible();
  expect(screen.getByText("1 unresolved clarification remains.")).toBeVisible();
  expect(screen.queryByText(/best/i)).not.toBeInTheDocument();

  await user.click(
    screen.getAllByRole("button", { name: "Mark as current choice" })[0],
  );
  expect(choose).toHaveBeenCalledWith("school-a");
});

it("shows the existing current choice and keeps totals informational", () => {
  render(
    <MemoryRouter>
      <DecisionPage
        data={
          {
            settings: { annualCostGrowthBps: 300, scenario: "conservative" },
            currentChoiceSchoolId: "school-b",
            openQuestionCount: 0,
            offers: [
              offer("one", "school-a", "Alpha College"),
              offer("two", "school-b", "Beta University"),
            ],
          } as DecisionData
        }
        onChooseSchool={vi.fn()}
      />
    </MemoryRouter>,
  );

  expect(screen.getByText(/Current choice:/)).toHaveTextContent(
    "Beta University",
  );
  expect(screen.getByRole("button", { name: "Current choice" })).toBeDisabled();
  expect(screen.getAllByText(/Annual net price/).length).toBeGreaterThan(0);
});
