import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  getActiveWorkspaceForGeneration,
  NOT_FOUND,
  requireActiveWorkspace,
} from "./lib/auth";
import schema from "./schema";

type SendArgs = {
  approvalId: string;
  workspaceId: Id<"workspaces">;
  workspaceGeneration: number;
};
const sendApproved = makeFunctionReference<"action", SendArgs>(
  "agentMailActions:sendApproved",
);
const renewal = v.union(
  v.object({ kind: v.literal("fixed"), durationYears: v.number() }),
  v.object({ kind: v.literal("one_time") }),
  v.object({ kind: v.literal("nonrenewable") }),
  v.object({ kind: v.literal("conditional") }),
  v.object({ kind: v.literal("unknown") }),
);

export const listForWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(schema.doc("questions")),
  handler: async (ctx, { workspaceId }) => {
    await requireActiveWorkspace(ctx, workspaceId);
    return await ctx.db
      .query("questions")
      .withIndex("by_workspaceId", (query) =>
        query.eq("workspaceId", workspaceId),
      )
      .take(50);
  },
});

export const getDraftPage = query({
  args: { questionId: v.id("questions") },
  returns: v.object({
    question: schema.doc("questions"),
    school: schema.doc("schools"),
    draft: v.union(schema.doc("mailDrafts"), v.null()),
    proposal: v.union(schema.doc("replyProposals"), v.null()),
    lineItem: v.union(schema.doc("lineItems"), v.null()),
  }),
  handler: async (ctx, { questionId }) => {
    const question = await ctx.db.get("questions", questionId);
    if (!question) throw new Error(NOT_FOUND);
    await requireActiveWorkspace(ctx, question.workspaceId);
    const [school, draft, proposal, lineItem] = await Promise.all([
      ctx.db.get("schools", question.schoolId),
      ctx.db
        .query("mailDrafts")
        .withIndex("by_questionId", (query) =>
          query.eq("questionId", questionId),
        )
        .unique(),
      ctx.db
        .query("replyProposals")
        .withIndex("by_questionId", (query) =>
          query.eq("questionId", questionId),
        )
        .order("desc")
        .first(),
      question.lineItemId
        ? ctx.db.get("lineItems", question.lineItemId)
        : Promise.resolve(null),
    ]);
    if (
      !school ||
      school.workspaceId !== question.workspaceId ||
      (proposal && proposal.workspaceId !== question.workspaceId) ||
      (lineItem && lineItem.workspaceId !== question.workspaceId)
    )
      throw new Error(NOT_FOUND);
    return { question, school, draft, proposal, lineItem };
  },
});

function recipientDomain(recipient: string) {
  const match = recipient
    .trim()
    .toLowerCase()
    .match(/^[^@\s]+@([^@\s]+)$/);
  if (!match || recipient.length > 320) throw new Error("INVALID_RECIPIENT");
  return match[1];
}

async function sha256(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const openDraft = mutation({
  args: { questionId: v.id("questions") },
  returns: schema.doc("mailDrafts"),
  handler: async (ctx, { questionId }) => {
    const question = await ctx.db.get("questions", questionId);
    if (!question) throw new Error(NOT_FOUND);
    const workspace = await requireActiveWorkspace(ctx, question.workspaceId);
    const existing = await ctx.db
      .query("mailDrafts")
      .withIndex("by_questionId", (query) => query.eq("questionId", questionId))
      .unique();
    if (existing) return existing;
    if (question.state !== "open") throw new Error("QUESTION_NOT_OPEN");
    const [school, profile] = await Promise.all([
      ctx.db.get("schools", question.schoolId),
      ctx.db.get("profiles", workspace.ownerProfileId),
    ]);
    if (
      !school ||
      school.workspaceId !== workspace._id ||
      school.identityState !== "confirmed" ||
      !school.officialDomain ||
      !profile
    )
      throw new Error(NOT_FOUND);
    const now = Date.now();
    const recipient =
      school.financialAidEmail ?? `financialaid@${school.officialDomain}`;
    const draftId = await ctx.db.insert("mailDrafts", {
      workspaceId: workspace._id,
      questionId,
      recipient,
      subject: `Financial aid question for ${school.name}`,
      bodyText: `Hello,\n\n${question.prompt}\n\nThank you.`,
      status: "draft",
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("questions", question._id, {
      state: "drafting",
      revision: question.revision + 1,
      updatedAt: now,
    });
    const draft = await ctx.db.get("mailDrafts", draftId);
    if (!draft) throw new Error(NOT_FOUND);
    return draft;
  },
});

export const getDraft = query({
  args: { draftId: v.id("mailDrafts") },
  returns: v.object({
    draft: schema.doc("mailDrafts"),
    question: schema.doc("questions"),
    school: schema.doc("schools"),
  }),
  handler: async (ctx, { draftId }) => {
    const draft = await ctx.db.get("mailDrafts", draftId);
    if (!draft) throw new Error(NOT_FOUND);
    await requireActiveWorkspace(ctx, draft.workspaceId);
    const question = await ctx.db.get("questions", draft.questionId);
    if (!question) throw new Error(NOT_FOUND);
    const confirmedSchool = await ctx.db.get("schools", question.schoolId);
    if (!confirmedSchool || confirmedSchool.workspaceId !== draft.workspaceId)
      throw new Error(NOT_FOUND);
    return { draft, question, school: confirmedSchool };
  },
});

export const saveDraft = mutation({
  args: {
    draftId: v.id("mailDrafts"),
    expectedRevision: v.number(),
    recipient: v.string(),
    subject: v.string(),
    bodyText: v.string(),
  },
  returns: v.object({ revision: v.number() }),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get("mailDrafts", args.draftId);
    if (!draft || draft.status !== "draft") throw new Error(NOT_FOUND);
    await requireActiveWorkspace(ctx, draft.workspaceId);
    if (draft.revision !== args.expectedRevision)
      throw new Error("STALE_REVISION");
    recipientDomain(args.recipient);
    if (
      args.subject.trim().length === 0 ||
      args.subject.length > 500 ||
      args.bodyText.trim().length === 0 ||
      args.bodyText.length > 100_000
    )
      throw new Error("INVALID_DRAFT");
    const revision = draft.revision + 1;
    await ctx.db.patch("mailDrafts", draft._id, {
      recipient: args.recipient.trim().toLowerCase(),
      subject: args.subject.trim(),
      bodyText: args.bodyText,
      revision,
      updatedAt: Date.now(),
    });
    return { revision };
  },
});

export const approveDraft = mutation({
  args: {
    draftId: v.id("mailDrafts"),
    expectedRevision: v.number(),
    offDomainConfirmed: v.boolean(),
  },
  returns: v.object({ approvalId: v.string(), bodyHash: v.string() }),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get("mailDrafts", args.draftId);
    if (!draft) throw new Error(NOT_FOUND);
    const workspace = await requireActiveWorkspace(ctx, draft.workspaceId);
    if (draft.revision !== args.expectedRevision)
      throw new Error("STALE_REVISION");
    if (draft.status === "queued" && draft.approvalId && draft.approvedBodyHash)
      return { approvalId: draft.approvalId, bodyHash: draft.approvedBodyHash };
    if (
      draft.status === "failed" &&
      draft.approvalId &&
      draft.approvedBodyHash
    ) {
      const [question, message, bodyHash] = await Promise.all([
        ctx.db.get("questions", draft.questionId),
        ctx.db
          .query("mailMessages")
          .withIndex("by_approvalId", (query) =>
            query.eq("approvalId", draft.approvalId),
          )
          .unique(),
        sha256(`${draft.recipient}\n${draft.subject}\n${draft.bodyText}`),
      ]);
      if (
        !question ||
        question.workspaceId !== workspace._id ||
        !message ||
        message.workspaceId !== workspace._id ||
        bodyHash !== draft.approvedBodyHash
      )
        throw new Error(NOT_FOUND);
      const now = Date.now();
      await ctx.db.patch("mailDrafts", draft._id, {
        status: "queued",
        updatedAt: now,
      });
      await ctx.db.patch("mailMessages", message._id, {
        deliveryState: "queued",
        updatedAt: now,
      });
      await ctx.db.patch("questions", question._id, {
        state: "queued",
        revision: question.revision + 1,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, sendApproved, {
        approvalId: draft.approvalId,
        workspaceId: workspace._id,
        workspaceGeneration: workspace.generation,
      });
      return { approvalId: draft.approvalId, bodyHash };
    }
    if (draft.status !== "draft") throw new Error(NOT_FOUND);
    const question = await ctx.db.get("questions", draft.questionId);
    const school = question
      ? await ctx.db.get("schools", question.schoolId)
      : null;
    const profile = await ctx.db.get("profiles", workspace.ownerProfileId);
    if (!question || !school?.officialDomain || !profile?.agentMailInboxAddress)
      throw new Error(NOT_FOUND);
    const domain = recipientDomain(draft.recipient);
    if (
      domain !== school.officialDomain &&
      !domain.endsWith(`.${school.officialDomain}`) &&
      !args.offDomainConfirmed
    )
      throw new Error("RECIPIENT_CONFIRMATION_REQUIRED");
    const bodyHash = await sha256(
      `${draft.recipient}\n${draft.subject}\n${draft.bodyText}`,
    );
    const approvalId = `approval:${draft._id}:${draft.revision}`;
    const now = Date.now();
    await ctx.db.insert("mailMessages", {
      workspaceId: draft.workspaceId,
      inboxId: profile.agentMailInboxId ?? profile.agentMailInboxAddress,
      providerMessageId: approvalId,
      approvalId,
      threadId: approvalId,
      direction: "outbound",
      subject: draft.subject,
      bodyText: draft.bodyText,
      sender: profile.agentMailInboxAddress,
      deliveryState: "queued",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("mailDrafts", draft._id, {
      status: "queued",
      approvalId,
      approvedBodyHash: bodyHash,
      updatedAt: now,
    });
    await ctx.db.patch("questions", question._id, {
      state: "queued",
      revision: question.revision + 1,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, sendApproved, {
      approvalId,
      workspaceId: workspace._id,
      workspaceGeneration: workspace.generation,
    });
    return { approvalId, bodyHash };
  },
});

export const confirmReply = mutation({
  args: {
    proposalId: v.id("replyProposals"),
    expectedProposalRevision: v.number(),
    expectedQuestionRevision: v.number(),
    expectedLineItemRevision: v.number(),
    renewal,
  },
  returns: v.object({
    proposalRevision: v.number(),
    questionRevision: v.number(),
    lineItemRevision: v.number(),
    offerRevision: v.number(),
  }),
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get("replyProposals", args.proposalId);
    if (!proposal || proposal.state !== "pending") throw new Error(NOT_FOUND);
    const workspace = await requireActiveWorkspace(ctx, proposal.workspaceId);
    const [question, item] = await Promise.all([
      ctx.db.get("questions", proposal.questionId),
      ctx.db.get("lineItems", proposal.lineItemId),
    ]);
    if (
      !question ||
      !item ||
      question.workspaceId !== workspace._id ||
      item.workspaceId !== workspace._id ||
      question.state !== "awaiting_confirmation" ||
      proposal.revision !== args.expectedProposalRevision ||
      question.revision !== args.expectedQuestionRevision ||
      item.revision !== args.expectedLineItemRevision
    )
      throw new Error("STALE_REVISION");
    const offer = await ctx.db.get("offers", item.offerId);
    if (!offer || !offer.active || offer.workspaceId !== workspace._id)
      throw new Error(NOT_FOUND);
    if (
      args.renewal.kind === "fixed" &&
      (!Number.isSafeInteger(args.renewal.durationYears) ||
        args.renewal.durationYears < 1 ||
        args.renewal.durationYears > 10)
    )
      throw new Error("INVALID_RENEWAL");
    const now = Date.now();
    const proposalRevision = proposal.revision + 1;
    const questionRevision = question.revision + 1;
    const lineItemRevision = item.revision + 1;
    const offerRevision = offer.revision + 1;
    await ctx.db.patch("replyProposals", proposal._id, {
      proposedRenewal: args.renewal,
      state: "confirmed",
      revision: proposalRevision,
      updatedAt: now,
    });
    await ctx.db.patch("lineItems", item._id, {
      renewal: args.renewal,
      verifiedByUserAt: now,
      correctedByProfileId: workspace.ownerProfileId,
      revision: lineItemRevision,
      updatedAt: now,
    });
    await ctx.db.patch("offers", offer._id, {
      revision: offerRevision,
      updatedAt: now,
    });
    await ctx.db.patch("questions", question._id, {
      state: "resolved",
      revision: questionRevision,
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      workspaceId: workspace._id,
      actor: "user",
      eventType: "school_reply_confirmed",
      documentId: offer.documentId,
      safeMetadata: { reason: "renewal_terms_confirmed" },
      createdAt: now,
    });
    return {
      proposalRevision,
      questionRevision,
      lineItemRevision,
      offerRevision,
    };
  },
});

const sendArgs = {
  approvalId: v.string(),
  workspaceId: v.id("workspaces"),
  workspaceGeneration: v.number(),
};

export const getApprovedForSend = internalQuery({
  args: sendArgs,
  returns: v.union(
    v.object({
      draftId: v.id("mailDrafts"),
      questionId: v.id("questions"),
      messageId: v.id("mailMessages"),
      inboxId: v.string(),
      recipient: v.string(),
      subject: v.string(),
      bodyText: v.string(),
      bodyHash: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    if (
      !(await getActiveWorkspaceForGeneration(
        ctx,
        args.workspaceId,
        args.workspaceGeneration,
      ))
    )
      return null;
    const [draft, message] = await Promise.all([
      ctx.db
        .query("mailDrafts")
        .withIndex("by_approvalId", (query) =>
          query.eq("approvalId", args.approvalId),
        )
        .unique(),
      ctx.db
        .query("mailMessages")
        .withIndex("by_approvalId", (query) =>
          query.eq("approvalId", args.approvalId),
        )
        .unique(),
    ]);
    if (
      !draft ||
      !message ||
      draft.workspaceId !== args.workspaceId ||
      message.workspaceId !== args.workspaceId ||
      draft.status !== "queued" ||
      message.deliveryState !== "queued" ||
      !draft.approvedBodyHash
    )
      return null;
    return {
      draftId: draft._id,
      questionId: draft.questionId,
      messageId: message._id,
      inboxId: message.inboxId,
      recipient: draft.recipient,
      subject: draft.subject,
      bodyText: draft.bodyText,
      bodyHash: draft.approvedBodyHash,
    };
  },
});

export const commitSend = internalMutation({
  args: {
    ...sendArgs,
    providerMessageId: v.string(),
    threadId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (
      !(await getActiveWorkspaceForGeneration(
        ctx,
        args.workspaceId,
        args.workspaceGeneration,
      ))
    )
      return false;
    const draft = await ctx.db
      .query("mailDrafts")
      .withIndex("by_approvalId", (query) =>
        query.eq("approvalId", args.approvalId),
      )
      .unique();
    const message = await ctx.db
      .query("mailMessages")
      .withIndex("by_approvalId", (query) =>
        query.eq("approvalId", args.approvalId),
      )
      .unique();
    if (!draft || !message || draft.status !== "queued") return false;
    const question = await ctx.db.get("questions", draft.questionId);
    if (!question || question.workspaceId !== args.workspaceId) return false;
    const now = Date.now();
    await ctx.db.patch("mailMessages", message._id, {
      providerMessageId: args.providerMessageId,
      threadId: args.threadId,
      deliveryState: "sent",
      updatedAt: now,
    });
    await ctx.db.patch("mailDrafts", draft._id, {
      status: "sent",
      updatedAt: now,
    });
    await ctx.db.patch("questions", question._id, {
      state: "sent",
      revision: question.revision + 1,
      updatedAt: now,
    });
    return true;
  },
});

export const failSend = internalMutation({
  args: { ...sendArgs, failureCode: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (
      !(await getActiveWorkspaceForGeneration(
        ctx,
        args.workspaceId,
        args.workspaceGeneration,
      ))
    )
      return false;
    const draft = await ctx.db
      .query("mailDrafts")
      .withIndex("by_approvalId", (query) =>
        query.eq("approvalId", args.approvalId),
      )
      .unique();
    const message = await ctx.db
      .query("mailMessages")
      .withIndex("by_approvalId", (query) =>
        query.eq("approvalId", args.approvalId),
      )
      .unique();
    if (
      !draft ||
      !message ||
      draft.workspaceId !== args.workspaceId ||
      draft.status !== "queued"
    )
      return false;
    const now = Date.now();
    await ctx.db.patch("mailDrafts", draft._id, {
      status: "failed",
      updatedAt: now,
    });
    await ctx.db.patch("mailMessages", message._id, {
      deliveryState: "failed",
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      workspaceId: args.workspaceId,
      actor: "agentmail",
      eventType: "outbound_send_failed",
      safeMetadata: { reason: args.failureCode.slice(0, 100) },
      createdAt: now,
    });
    return true;
  },
});
