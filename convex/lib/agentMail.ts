export async function createAgentMailInbox({
  apiKey,
  clientId,
  fetcher = fetch,
}: {
  apiKey: string;
  clientId: string;
  fetcher?: typeof fetch;
}) {
  const response = await fetcher("https://api.agentmail.to/v0/inboxes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": clientId,
    },
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!response.ok) throw new Error(`AGENTMAIL_${response.status}`);
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null)
    throw new Error("AGENTMAIL_INVALID_RESPONSE");
  const value = payload as Record<string, unknown>;
  const inboxId = value.inbox_id ?? value.inboxId;
  const address = value.email ?? value.address;
  if (typeof inboxId !== "string" || typeof address !== "string")
    throw new Error("AGENTMAIL_INVALID_RESPONSE");
  return { inboxId, address };
}

export async function sendAgentMail({
  apiKey,
  inboxId,
  approvalId,
  recipient,
  subject,
  bodyText,
  fetcher = fetch,
}: {
  apiKey: string;
  inboxId: string;
  approvalId: string;
  recipient: string;
  subject: string;
  bodyText: string;
  fetcher?: typeof fetch;
}) {
  const response = await fetcher(
    `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": approvalId,
      },
      body: JSON.stringify({ to: [recipient], subject, text: bodyText }),
    },
  );
  if (!response.ok) throw new Error(`AGENTMAIL_${response.status}`);
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null)
    throw new Error("AGENTMAIL_INVALID_RESPONSE");
  const value = payload as Record<string, unknown>;
  const providerMessageId = value.message_id ?? value.messageId;
  const threadId = value.thread_id ?? value.threadId;
  if (typeof providerMessageId !== "string" || typeof threadId !== "string")
    throw new Error("AGENTMAIL_INVALID_RESPONSE");
  return { providerMessageId, threadId };
}
