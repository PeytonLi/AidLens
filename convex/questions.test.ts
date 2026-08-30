/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const getDraftPage = makeFunctionReference<
  "query",
  { questionId: Id<"questions"> }
>("questions:getDraftPage");
const openDraft = makeFunctionReference<
  "mutation",
  { questionId: Id<"questions"> }
>("questions:openDraft");
const saveDraft = makeFunctionReference<
  "mutation",
  {
    draftId: Id<"mailDrafts">;
    expectedRevision: number;
    recipient: string;
    subject: string;
    bodyText: string;
  }
>("questions:saveDraft");
const approveDraft = makeFunctionReference<
  "mutation",
  {
    draftId: Id<"mailDrafts">;
    expectedRevision: number;
    offDomainConfirmed: boolean;
  }
>("questions:approveDraft");
const confirmReply = makeFunctionReference<
  "mutation",
  {
    proposalId: Id<"replyProposals">;
    expectedProposalRevision: number;
    expectedQuestionRevision: number;
    expectedLineItemRevision: number;
    renewal: { kind: "fixed"; durationYears: number };
  }
>("questions:confirmReply");
const ingestReply = makeFunctionReference<
  "mutation",
  {
    eventId: string;
    eventType: "message.received";
    inboxId: string;
    providerMessageId: string;
    threadId: string;
    subject: string;
    bodyText: string;
    sender: string;
  }
>("agentMail:ingestWebhook");

it("S8.7-S8.12: editing never sends and exact approval queues once", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "owner@example.com" });
    const now = Date.now();
    const profileId = await ctx.db.insert("profiles", {
      authUserId: userId,
      email: "owner@example.com",
      ageConfirmedAt: now,
      agentMailInboxId: "inbox-1",
      agentMailInboxAddress: "case@agentmail.to",
      createdAt: now,
      updatedAt: now,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerProfileId: profileId,
      name: "Offers",
      status: "active",
      generation: 0,
      createdAt: now,
      updatedAt: now,
    });
    const schoolId = await ctx.db.insert("schools", {
      workspaceId,
      name: "Example University",
      officialDomain: "example.edu",
      financialAidEmail: "aid@example.edu",
      identityState: "confirmed",
      createdAt: now,
      updatedAt: now,
    });
    const documentId = await ctx.db.insert("offerDocuments", {
      workspaceId,
      schoolId,
      fileName: "offer.pdf",
      mimeType: "application/pdf",
      byteSize: 1,
      sha256: "question-fixture",
      sourceRoute: "upload",
      retentionDeadline: now,
      rawState: "deleted",
      processingState: "ready",
      processingGeneration: 0,
      createdAt: now,
      updatedAt: now,
    });
    const offerId = await ctx.db.insert("offers", {
      workspaceId,
      schoolId,
      documentId,
      version: 1,
      active: true,
      reviewState: "reviewed",
      academicYear: "2026-2027",
      startTerm: "Fall 2026",
      endTerm: "Spring 2027",
      enrollmentIntensity: "full_time",
      housingAssumption: "unknown",
      residencyAssumption: "unknown",
      overallConfidence: 1,
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
    const lineItemId = await ctx.db.insert("lineItems", {
      workspaceId,
      offerId,
      originalLabel: "Merit Scholarship",
      canonicalCategory: "scholarship",
      extractedAmountCents: 1_000_000,
      extractedPeriod: "academic_year",
      extractedStatus: "offered",
      extractedRenewal: { kind: "unknown" },
      extractedConfidence: 0.8,
      amountCents: 1_000_000,
      period: "academic_year",
      status: "offered",
      renewal: { kind: "unknown" },
      requiredForCostTotal: false,
      documentPage: 1,
      sourceExcerpt: "Merit Scholarship $10,000",
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
    const questionId = await ctx.db.insert("questions", {
      workspaceId,
      schoolId,
      lineItemId,
      triggerCode: "unknown_renewal",
      prompt: "Is the scholarship renewable for four years?",
      state: "open",
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { userId, workspaceId, questionId, offerId, lineItemId };
  });
  const owner = t.withIdentity({ subject: `${ids.userId}|session` });

  const opened = await owner.mutation(openDraft, {
    questionId: ids.questionId,
  });
  expect(opened).toMatchObject({
    recipient: "aid@example.edu",
    status: "draft",
    revision: 0,
  });
  const saved = await owner.mutation(saveDraft, {
    draftId: opened._id,
    expectedRevision: 0,
    recipient: "aid@example.edu",
    subject: "Scholarship renewal question",
    bodyText:
      "Could you confirm whether this scholarship renews for four years?",
  });
  expect(saved.revision).toBe(1);
  await expect(
    t.run((ctx) =>
      ctx.db
        .query("mailMessages")
        .withIndex("by_workspaceId", (query) =>
          query.eq("workspaceId", ids.workspaceId),
        )
        .take(2),
    ),
  ).resolves.toEqual([]);

  await expect(
    owner.mutation(saveDraft, {
      draftId: opened._id,
      expectedRevision: 1,
      recipient: "counselor@example.net",
      subject: "Scholarship renewal question",
      bodyText:
        "Could you confirm whether this scholarship renews for four years?",
    }),
  ).resolves.toEqual({ revision: 2 });
  await expect(
    owner.mutation(approveDraft, {
      draftId: opened._id,
      expectedRevision: 2,
      offDomainConfirmed: false,
    }),
  ).rejects.toThrow("RECIPIENT_CONFIRMATION_REQUIRED");

  const approved = await owner.mutation(approveDraft, {
    draftId: opened._id,
    expectedRevision: 2,
    offDomainConfirmed: true,
  });
  await expect(
    owner.mutation(approveDraft, {
      draftId: opened._id,
      expectedRevision: 2,
      offDomainConfirmed: true,
    }),
  ).resolves.toEqual(approved);
  await expect(
    t.run((ctx) =>
      ctx.db
        .query("mailMessages")
        .withIndex("by_workspaceId", (query) =>
          query.eq("workspaceId", ids.workspaceId),
        )
        .take(2),
    ),
  ).resolves.toEqual([
    expect.objectContaining({
      direction: "outbound",
      deliveryState: "queued",
      providerMessageId: approved.approvalId,
    }),
  ]);
  await t.finishAllScheduledFunctions(() => {});
  await expect(
    t.run(async (ctx) => ({
      draft: await ctx.db.get("mailDrafts", opened._id),
      message: await ctx.db
        .query("mailMessages")
        .withIndex("by_workspaceId", (query) =>
          query.eq("workspaceId", ids.workspaceId),
        )
        .unique(),
    })),
  ).resolves.toMatchObject({
    draft: {
      status: "failed",
      bodyText:
        "Could you confirm whether this scholarship renews for four years?",
    },
    message: { deliveryState: "failed" },
  });
  const retried = await owner.mutation(approveDraft, {
    draftId: opened._id,
    expectedRevision: 2,
    offDomainConfirmed: false,
  });
  await expect(
    owner.mutation(approveDraft, {
      draftId: opened._id,
      expectedRevision: 2,
      offDomainConfirmed: false,
    }),
  ).resolves.toEqual(retried);
  await expect(
    t.run(async (ctx) => ({
      messages: await ctx.db
        .query("mailMessages")
        .withIndex("by_workspaceId", (query) =>
          query.eq("workspaceId", ids.workspaceId),
        )
        .take(2),
      draft: await ctx.db.get("mailDrafts", opened._id),
    })),
  ).resolves.toMatchObject({
    messages: [{ deliveryState: "queued" }],
    draft: { status: "queued", approvalId: approved.approvalId },
  });

  await t.run(async (ctx) => {
    const question = await ctx.db.get("questions", ids.questionId);
    if (!question) throw new Error("fixture missing");
    await ctx.db.patch("questions", question._id, {
      state: "sent",
    });
  });
  await t.mutation(ingestReply, {
    eventId: "reply-event-1",
    eventType: "message.received",
    inboxId: "inbox-1",
    providerMessageId: "reply-message-1",
    threadId: approved.approvalId,
    subject: "Re: Scholarship renewal question",
    bodyText: "Renewable for four years with full-time enrollment.",
    sender: "aid@example.edu",
  });
  const createdProposal = await t.run((ctx) =>
    ctx.db
      .query("replyProposals")
      .withIndex("by_questionId", (query) =>
        query.eq("questionId", ids.questionId),
      )
      .unique(),
  );
  expect(createdProposal).toMatchObject({
    state: "pending",
    supportingText: "Renewable for four years with full-time enrollment.",
  });
  if (!createdProposal) throw new Error("proposal missing");
  await expect(
    owner.query(getDraftPage, { questionId: ids.questionId }),
  ).resolves.toMatchObject({
    proposal: { _id: createdProposal._id, state: "pending" },
    lineItem: { _id: ids.lineItemId, revision: 0 },
  });
  const currentQuestion = await t.run((ctx) =>
    ctx.db.get("questions", ids.questionId),
  );
  if (!currentQuestion) throw new Error("question missing");
  await owner.mutation(confirmReply, {
    proposalId: createdProposal._id,
    expectedProposalRevision: 0,
    expectedQuestionRevision: currentQuestion.revision,
    expectedLineItemRevision: 0,
    renewal: { kind: "fixed", durationYears: 4 },
  });
  await expect(
    t.run(async (ctx) => ({
      item: await ctx.db.get("lineItems", ids.lineItemId),
      offer: await ctx.db.get("offers", ids.offerId),
      question: await ctx.db.get("questions", ids.questionId),
    })),
  ).resolves.toMatchObject({
    item: {
      extractedRenewal: { kind: "unknown" },
      renewal: { kind: "fixed", durationYears: 4 },
      revision: 1,
    },
    offer: { revision: 1 },
    question: { state: "resolved" },
  });
});

it("S8.21: keep unresolved rejects the proposal and leaves line items unchanged", async () => {
  const t = convexTest(schema, modules);
  const rejectReply = makeFunctionReference<
    "mutation",
    {
      proposalId: Id<"replyProposals">;
      expectedProposalRevision: number;
      expectedQuestionRevision: number;
    }
  >("questions:rejectReply");
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "reject@example.com",
    });
    const now = Date.now();
    const profileId = await ctx.db.insert("profiles", {
      authUserId: userId,
      email: "reject@example.com",
      ageConfirmedAt: now,
      agentMailInboxId: "inbox-reject",
      agentMailInboxAddress: "reject@agentmail.to",
      createdAt: now,
      updatedAt: now,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerProfileId: profileId,
      name: "Offers",
      status: "active",
      generation: 0,
      createdAt: now,
      updatedAt: now,
    });
    const schoolId = await ctx.db.insert("schools", {
      workspaceId,
      name: "Example University",
      officialDomain: "example.edu",
      identityState: "confirmed",
      createdAt: now,
      updatedAt: now,
    });
    const documentId = await ctx.db.insert("offerDocuments", {
      workspaceId,
      schoolId,
      fileName: "award.pdf",
      mimeType: "application/pdf",
      byteSize: 100,
      sha256: "reject-sha",
      sourceRoute: "upload",
      retentionDeadline: now + 7 * 24 * 60 * 60 * 1000,
      rawState: "deleted",
      processingState: "ready",
      processingGeneration: 1,
      createdAt: now,
      updatedAt: now,
    });
    const offerId = await ctx.db.insert("offers", {
      workspaceId,
      schoolId,
      documentId,
      version: 1,
      active: true,
      reviewState: "reviewed",
      academicYear: "2026-2027",
      startTerm: "fall",
      endTerm: "spring",
      enrollmentIntensity: "full_time",
      housingAssumption: "on_campus",
      residencyAssumption: "resident",
      overallConfidence: 0.9,
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
    const lineItemId = await ctx.db.insert("lineItems", {
      workspaceId,
      offerId,
      originalLabel: "Merit Scholarship",
      canonicalCategory: "scholarship",
      extractedAmountCents: 1000000,
      extractedPeriod: "academic_year",
      extractedStatus: "offered",
      extractedRenewal: { kind: "unknown" },
      extractedConfidence: 0.8,
      amountCents: 1000000,
      period: "academic_year",
      status: "offered",
      renewal: { kind: "unknown" },
      requiredForCostTotal: false,
      documentPage: 1,
      sourceExcerpt: "Merit Scholarship $10,000",
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
    const questionId = await ctx.db.insert("questions", {
      workspaceId,
      schoolId,
      lineItemId,
      triggerCode: "unknown_renewal",
      prompt: "Is the scholarship renewable?",
      state: "awaiting_confirmation",
      revision: 2,
      createdAt: now,
      updatedAt: now,
    });
    const messageId = await ctx.db.insert("mailMessages", {
      workspaceId,
      inboxId: "inbox-reject",
      providerMessageId: "reply-reject-1",
      threadId: "thread-reject",
      direction: "inbound",
      subject: "Re: Scholarship",
      bodyText: "Maybe renewable.",
      sender: "aid@example.edu",
      deliveryState: "received",
      createdAt: now,
      updatedAt: now,
    });
    const proposalId = await ctx.db.insert("replyProposals", {
      workspaceId,
      questionId,
      lineItemId,
      messageId,
      supportingText: "Maybe renewable.",
      proposedRenewal: { kind: "conditional" },
      state: "pending",
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { userId, proposalId, questionId, lineItemId };
  });
  const owner = t.withIdentity({ subject: String(ids.userId) });
  await owner.mutation(rejectReply, {
    proposalId: ids.proposalId,
    expectedProposalRevision: 0,
    expectedQuestionRevision: 2,
  });
  await expect(
    t.run(async (ctx) => ({
      proposal: await ctx.db.get("replyProposals", ids.proposalId),
      question: await ctx.db.get("questions", ids.questionId),
      item: await ctx.db.get("lineItems", ids.lineItemId),
    })),
  ).resolves.toMatchObject({
    proposal: { state: "rejected", revision: 1 },
    question: { state: "open", revision: 3 },
    item: { renewal: { kind: "unknown" }, revision: 0 },
  });
});
