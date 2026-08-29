import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import OfferReviewPage, { type OfferReview } from "./OfferReviewPage";

const review = {
  offer: {
    _id: "offer-1",
    reviewState: "preliminary",
    revision: 0,
    academicYear: "2026-2027",
  },
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
} as unknown as OfferReview;

it("S5 school confirmation: requires an explicit candidate choice", async () => {
  const user = userEvent.setup();
  const confirmSchool = vi.fn().mockResolvedValue(undefined);
  const confirmManual = vi.fn().mockResolvedValue(undefined);
  render(
    <OfferReviewPage
      review={review}
      onConfirmSchool={confirmSchool}
      onConfirmManual={confirmManual}
      onSaveItem={vi.fn()}
      onConfirmReviewed={vi.fn()}
    />,
  );

  const submit = screen.getByRole("button", { name: "Confirm school" });
  expect(submit).toBeDisabled();
  await user.click(
    screen.getByRole("radio", { name: /Example University.*example.edu/ }),
  );
  await user.click(submit);

  expect(confirmSchool).toHaveBeenCalledWith("school-1");
  await user.click(screen.getByRole("button", { name: "None of these" }));
  await user.type(screen.getByLabelText("School name"), "Manual College");
  await user.type(screen.getByLabelText("Official domain"), "manual.edu");
  await user.click(
    screen.getAllByRole("button", { name: "Confirm school" })[1],
  );
  expect(confirmManual).toHaveBeenCalledWith("Manual College", "manual.edu");
});

it("S5 review: edits an unknown cited amount without mutating on cancel", async () => {
  const user = userEvent.setup();
  const saveItem = vi.fn().mockResolvedValue(undefined);
  const confirmReviewed = vi.fn().mockRejectedValue(new Error("incomplete"));
  const confirmed = {
    ...review,
    school: { ...review.school, identityState: "confirmed" },
    items: [
      {
        _id: "item-1",
        originalLabel: "Tuition and fees",
        canonicalCategory: "direct_cost",
        amountCents: null,
        period: "academic_year",
        status: "offered",
        renewal: { kind: "unknown" },
        requiredForCostTotal: true,
        extractedConfidence: 0.4,
        sourceExcerpt: "Tuition and fees amount unavailable",
        documentPage: 1,
        revision: 0,
      },
      {
        _id: "item-2",
        originalLabel: "University Grant",
        canonicalCategory: "grant",
        amountCents: 1_000_000,
        period: "academic_year",
        status: "offered",
        renewal: { kind: "unknown" },
        requiredForCostTotal: false,
        extractedConfidence: 0.9,
        sourceExcerpt: "University Grant $10,000",
        documentPage: 1,
        revision: 0,
      },
    ],
  } as unknown as OfferReview;
  render(
    <OfferReviewPage
      review={confirmed}
      onConfirmSchool={vi.fn()}
      onConfirmManual={vi.fn()}
      onSaveItem={saveItem}
      onConfirmReviewed={confirmReviewed}
    />,
  );

  expect(screen.getByText("Unknown")).toBeVisible();
  expect(screen.getByText("40% confidence")).toBeVisible();
  expect(screen.getByText("Tuition and fees amount unavailable")).toBeVisible();
  expect(screen.queryByText("University Grant")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Show all fields" }));
  expect(screen.getByText("University Grant")).toBeVisible();

  await user.click(
    screen.getByRole("button", { name: "Edit Tuition and fees" }),
  );
  expect(screen.getByLabelText("Amount in dollars")).toHaveFocus();
  await user.type(screen.getByLabelText("Amount in dollars"), "25000");
  expect(
    window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
  ).toBe(false);
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
  ).toBe(true);
  expect(saveItem).not.toHaveBeenCalled();
  expect(screen.getByText("Unknown")).toBeVisible();

  await user.click(
    screen.getByRole("button", { name: "Edit Tuition and fees" }),
  );
  await user.type(screen.getByLabelText("Amount in dollars"), "25000");
  await user.selectOptions(screen.getByLabelText("Category"), "grant");
  await user.selectOptions(screen.getByLabelText("Period"), "semester");
  await user.selectOptions(screen.getByLabelText("Status"), "accepted");
  await user.selectOptions(screen.getByLabelText("Renewal"), "fixed");
  await user.clear(screen.getByLabelText("Renewal years"));
  await user.type(screen.getByLabelText("Renewal years"), "4");
  await user.click(screen.getByRole("button", { name: "Save field" }));
  expect(saveItem).toHaveBeenCalledWith(
    expect.objectContaining({
      _id: "item-1",
      amountCents: 2_500_000,
      canonicalCategory: "grant",
      period: "semester",
      status: "accepted",
      renewal: { kind: "fixed", durationYears: 4 },
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Confirm reviewed offer" }),
  );
  expect(confirmReviewed).toHaveBeenCalledWith(0);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Address the highlighted fields before confirming this offer.",
  );
});
