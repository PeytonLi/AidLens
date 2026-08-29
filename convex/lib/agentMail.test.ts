import { expect, it, vi } from "vitest";
import { createAgentMailInbox, sendAgentMail } from "./agentMail";

it("S8.1: provisions an inbox with a stable client id", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        inbox_id: "inbox-1",
        email: "case@agentmail.to",
      }),
      { status: 200 },
    ),
  );
  await expect(
    createAgentMailInbox({
      apiKey: "synthetic",
      clientId: "aidlens-profile-1",
      fetcher,
    }),
  ).resolves.toEqual({ inboxId: "inbox-1", address: "case@agentmail.to" });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    client_id: "aidlens-profile-1",
  });
});

it("S8.13: sends the persisted payload with approval idempotency", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        message_id: "provider-message-1",
        thread_id: "thread-1",
      }),
      { status: 200 },
    ),
  );
  await expect(
    sendAgentMail({
      apiKey: "synthetic",
      inboxId: "inbox-1",
      approvalId: "approval-1",
      recipient: "aid@example.edu",
      subject: "Question",
      bodyText: "Plain text only",
      fetcher,
    }),
  ).resolves.toEqual({
    providerMessageId: "provider-message-1",
    threadId: "thread-1",
  });
  expect(fetcher).toHaveBeenCalledWith(
    "https://api.agentmail.to/v0/inboxes/inbox-1/messages/send",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Idempotency-Key": "approval-1" }),
      body: JSON.stringify({
        to: ["aid@example.edu"],
        subject: "Question",
        text: "Plain text only",
      }),
    }),
  );
});
