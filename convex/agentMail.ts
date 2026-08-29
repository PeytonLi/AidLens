import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const ingestWebhook = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.literal("message.received"),
    inboxId: v.string(),
    providerMessageId: v.string(),
    threadId: v.string(),
    subject: v.string(),
    bodyText: v.string(),
    sender: v.string(),
  },
  returns: v.union(
    v.object({ status: v.literal("created") }),
    v.object({ status: v.literal("duplicate") }),
    v.object({ status: v.literal("ignored") }),
  ),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_agentMailInboxId", (query) =>
        query.eq("agentMailInboxId", args.inboxId),
      )
      .unique();
    if (!profile) return { status: "ignored" as const };
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_ownerProfileId_status", (query) =>
        query.eq("ownerProfileId", profile._id).eq("status", "active"),
      )
      .unique();
    if (!workspace) return { status: "ignored" as const };
    const duplicate = await ctx.db
      .query("agentMailWebhookEvents")
      .withIndex("by_eventId", (query) => query.eq("eventId", args.eventId))
      .unique();
    if (duplicate) return { status: "duplicate" as const };
    const existingMessage = await ctx.db
      .query("mailMessages")
      .withIndex("by_inboxId_and_providerMessageId", (query) =>
        query
          .eq("inboxId", args.inboxId)
          .eq("providerMessageId", args.providerMessageId),
      )
      .unique();
    const outbound = await ctx.db
      .query("mailMessages")
      .withIndex("by_inboxId_and_threadId_and_direction", (query) =>
        query
          .eq("inboxId", args.inboxId)
          .eq("threadId", args.threadId)
          .eq("direction", "outbound"),
      )
      .unique();
    const now = Date.now();
    await ctx.db.insert("agentMailWebhookEvents", {
      workspaceId: workspace._id,
      eventId: args.eventId,
      eventType: args.eventType,
      receivedAt: now,
    });
    const ownedExistingMessage =
      existingMessage?.workspaceId === workspace._id &&
      existingMessage.inboxId === args.inboxId
        ? existingMessage
        : null;
    const ownedOutbound =
      outbound?.workspaceId === workspace._id &&
      outbound.inboxId === args.inboxId
        ? outbound
        : null;
    const messageId =
      ownedExistingMessage?._id ??
      (await ctx.db.insert("mailMessages", {
        workspaceId: workspace._id,
        inboxId: args.inboxId,
        providerMessageId: args.providerMessageId,
        threadId: args.threadId,
        direction: "inbound",
        subject: args.subject.slice(0, 500),
        bodyText: args.bodyText.slice(0, 100_000),
        sender: args.sender.slice(0, 320),
        deliveryState: "received",
        createdAt: now,
        updatedAt: now,
      }));
    if (ownedOutbound?.approvalId) {
      const draft = await ctx.db
        .query("mailDrafts")
        .withIndex("by_approvalId", (query) =>
          query.eq("approvalId", ownedOutbound.approvalId),
        )
        .unique();
      const question = draft
        ? await ctx.db.get("questions", draft.questionId)
        : null;
      if (
        draft?.workspaceId === workspace._id &&
        question?.workspaceId === workspace._id &&
        question.lineItemId &&
        ["sent", "delivered", "reply_received"].includes(question.state)
      ) {
        const existingProposal = await ctx.db
          .query("replyProposals")
          .withIndex("by_messageId", (query) =>
            query.eq("messageId", messageId),
          )
          .unique();
        if (!existingProposal) {
          await ctx.db.insert("replyProposals", {
            workspaceId: workspace._id,
            questionId: question._id,
            lineItemId: question.lineItemId,
            messageId,
            supportingText: args.bodyText.slice(0, 2_000),
            proposedRenewal: { kind: "unknown" },
            state: "pending",
            revision: 0,
            createdAt: now,
            updatedAt: now,
          });
          await ctx.db.patch("questions", question._id, {
            state: "awaiting_confirmation",
            revision: question.revision + 1,
            updatedAt: now,
          });
        }
      }
    }
    return { status: "created" as const };
  },
});

export const ingestDeliveryWebhook = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.union(
      v.literal("message.sent"),
      v.literal("message.delivered"),
      v.literal("message.bounced"),
      v.literal("message.rejected"),
      v.literal("message.complained"),
    ),
    inboxId: v.string(),
    providerMessageId: v.string(),
    threadId: v.string(),
  },
  returns: v.union(
    v.object({ status: v.literal("created") }),
    v.object({ status: v.literal("duplicate") }),
    v.object({ status: v.literal("ignored") }),
  ),
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query("agentMailWebhookEvents")
      .withIndex("by_eventId", (query) => query.eq("eventId", args.eventId))
      .unique();
    if (duplicate) return { status: "duplicate" as const };
    const message = await ctx.db
      .query("mailMessages")
      .withIndex("by_inboxId_and_providerMessageId", (query) =>
        query
          .eq("inboxId", args.inboxId)
          .eq("providerMessageId", args.providerMessageId),
      )
      .unique();
    if (!message || message.inboxId !== args.inboxId)
      return { status: "ignored" as const };
    const workspace = await ctx.db.get("workspaces", message.workspaceId);
    if (!workspace || workspace.status !== "active")
      return { status: "ignored" as const };
    const now = Date.now();
    await ctx.db.insert("agentMailWebhookEvents", {
      workspaceId: workspace._id,
      eventId: args.eventId,
      eventType: args.eventType,
      receivedAt: now,
    });
    const nextState =
      message.deliveryState === "delivered"
        ? "delivered"
        : args.eventType === "message.delivered"
          ? "delivered"
          : args.eventType === "message.sent"
            ? "sent"
            : "failed";
    await ctx.db.patch("mailMessages", message._id, {
      threadId: args.threadId,
      deliveryState: nextState,
      updatedAt: now,
    });
    if (message.approvalId) {
      const draft = await ctx.db
        .query("mailDrafts")
        .withIndex("by_approvalId", (query) =>
          query.eq("approvalId", message.approvalId),
        )
        .unique();
      if (draft && nextState !== "sent") {
        await ctx.db.patch("mailDrafts", draft._id, {
          status: nextState,
          updatedAt: now,
        });
        const question = await ctx.db.get("questions", draft.questionId);
        if (question && nextState === "delivered") {
          await ctx.db.patch("questions", question._id, {
            state: "delivered",
            revision: question.revision + 1,
            updatedAt: now,
          });
        }
      }
    }
    return { status: "created" as const };
  },
});
