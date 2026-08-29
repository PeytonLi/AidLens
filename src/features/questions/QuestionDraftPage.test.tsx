import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import QuestionDraftPage from "./QuestionDraftPage";

it("S8.8-S8.12: edits without sending and requires explicit off-domain approval", async () => {
  const user = userEvent.setup();
  const save = vi.fn().mockResolvedValue({ revision: 2 });
  const approve = vi.fn().mockResolvedValue({ approvalId: "approval-1" });
  render(
    <QuestionDraftPage
      data={{
        question: { prompt: "Is the scholarship renewable?" },
        school: { name: "Example University", officialDomain: "example.edu" },
        draft: {
          _id: "draft-1",
          recipient: "aid@example.edu",
          subject: "Renewal question",
          bodyText: "Please confirm renewal terms.",
          status: "draft",
          revision: 1,
        },
      }}
      onOpen={vi.fn()}
      onSave={save}
      onApprove={approve}
    />,
  );

  await user.clear(screen.getByLabelText("Message"));
  await user.type(
    screen.getByLabelText("Message"),
    "Please confirm four-year renewal terms.",
  );
  expect(
    window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
  ).toBe(false);
  expect(approve).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      bodyText: "Please confirm four-year renewal terms.",
    }),
  );

  await user.clear(screen.getByLabelText("Recipient"));
  await user.type(screen.getByLabelText("Recipient"), "counselor@example.net");
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  await user.click(
    screen.getByRole("button", { name: "Approve and queue email" }),
  );
  expect(approve).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("checkbox", {
      name: /confirm this off-domain recipient/i,
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Approve and queue email" }),
  );
  expect(approve).toHaveBeenCalledWith({
    expectedRevision: 2,
    offDomainConfirmed: true,
  });
});

it("S8.17-S8.21: shows reply evidence and confirms an edited proposal explicitly", async () => {
  const user = userEvent.setup();
  const confirmReply = vi.fn().mockResolvedValue(undefined);
  render(
    <QuestionDraftPage
      data={{
        question: { prompt: "Is it renewable?", revision: 3 },
        school: { name: "Example University", officialDomain: "example.edu" },
        draft: {
          _id: "draft-1",
          recipient: "aid@example.edu",
          subject: "Renewal",
          bodyText: "Is it renewable?",
          status: "delivered",
          revision: 1,
        },
        proposal: {
          _id: "proposal-1",
          supportingText: "Renewable for four years with full-time enrollment.",
          revision: 0,
        },
        lineItem: { revision: 0 },
      }}
      onOpen={vi.fn()}
      onSave={vi.fn()}
      onApprove={vi.fn()}
      onConfirmReply={confirmReply}
    />,
  );

  expect(
    screen.getByText("Renewable for four years with full-time enrollment."),
  ).toBeVisible();
  await user.selectOptions(screen.getByLabelText("Confirmed renewal"), "fixed");
  await user.clear(screen.getByLabelText("Renewal years"));
  await user.type(screen.getByLabelText("Renewal years"), "4");
  await user.click(screen.getByRole("button", { name: "Confirm reply fact" }));
  expect(confirmReply).toHaveBeenCalledWith({
    proposalId: "proposal-1",
    expectedProposalRevision: 0,
    expectedQuestionRevision: 3,
    expectedLineItemRevision: 0,
    renewal: { kind: "fixed", durationYears: 4 },
  });
});

it("S8.15: retries a failed approved payload only after an explicit click", async () => {
  const user = userEvent.setup();
  const approve = vi.fn().mockResolvedValue({ approvalId: "approval-1" });
  render(
    <QuestionDraftPage
      data={{
        question: { prompt: "Is it renewable?" },
        school: { name: "Example University", officialDomain: "example.edu" },
        draft: {
          _id: "draft-1",
          recipient: "counselor@example.net",
          subject: "Renewal",
          bodyText: "Is it renewable?",
          status: "failed",
          revision: 2,
        },
      }}
      onOpen={vi.fn()}
      onSave={vi.fn()}
      onApprove={approve}
    />,
  );

  expect(approve).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Retry approved email" }),
  );
  expect(approve).toHaveBeenCalledWith({
    expectedRevision: 2,
    offDomainConfirmed: false,
  });
});
