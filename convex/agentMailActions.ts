"use node";

import { createHash } from "node:crypto";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { createAgentMailInbox, sendAgentMail } from "./lib/agentMail";

type Args = {
  approvalId: string;
  workspaceId: Id<"workspaces">;
  workspaceGeneration: number;
};
type Approved = {
  draftId: Id<"mailDrafts">;
  questionId: Id<"questions">;
  messageId: Id<"mailMessages">;
  inboxId: string;
  recipient: string;
  subject: string;
  bodyText: string;
  bodyHash: string;
} | null;
const getApproved = makeFunctionReference<"query", Args, Approved>(
  "questions:getApprovedForSend",
);
const commitSend = makeFunctionReference<
  "mutation",
  Args & { providerMessageId: string; threadId: string },
  boolean
>("questions:commitSend");
const failSend = makeFunctionReference<
  "mutation",
  Args & { failureCode: string },
  boolean
>("questions:failSend");

type ProvisionArgs = {
  profileId: Id<"profiles">;
  workspaceId: Id<"workspaces">;
  workspaceGeneration: number;
};
const prepareInbox = makeFunctionReference<
  "mutation",
  ProvisionArgs,
  { clientId: string } | null
>("profiles:prepareInboxProvisioning");
const commitInbox = makeFunctionReference<
  "mutation",
  ProvisionArgs & { inboxId: string; address: string },
  boolean
>("profiles:commitInboxProvisioning");
const failInbox = makeFunctionReference<
  "mutation",
  ProvisionArgs & { errorCode: string },
  boolean
>("profiles:failInboxProvisioning");

export const provisionInbox = internalAction({
  args: {
    profileId: v.id("profiles"),
    workspaceId: v.id("workspaces"),
    workspaceGeneration: v.number(),
  },
  returns: v.object({
    status: v.union(
      v.literal("ready"),
      v.literal("failed"),
      v.literal("stale"),
    ),
  }),
  handler: async (ctx, args) => {
    const prepared = await ctx.runMutation(prepareInbox, args);
    if (!prepared) return { status: "stale" as const };
    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(failInbox, {
        ...args,
        errorCode: "NOT_CONFIGURED",
      });
      return { status: "failed" as const };
    }
    try {
      const inbox = await createAgentMailInbox({
        apiKey,
        clientId: prepared.clientId,
      });
      await ctx.runMutation(commitInbox, { ...args, ...inbox });
      return { status: "ready" as const };
    } catch (error) {
      await ctx.runMutation(failInbox, {
        ...args,
        errorCode:
          error instanceof Error && /^AGENTMAIL_[A-Z0-9_]+$/.test(error.message)
            ? error.message
            : "PROVIDER_FAILURE",
      });
      return { status: "failed" as const };
    }
  },
});

export const sendApproved = internalAction({
  args: {
    approvalId: v.string(),
    workspaceId: v.id("workspaces"),
    workspaceGeneration: v.number(),
  },
  returns: v.object({
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("stale")),
  }),
  handler: async (ctx, args) => {
    const approved = await ctx.runQuery(getApproved, args);
    if (!approved) return { status: "stale" as const };
    const currentHash = createHash("sha256")
      .update(
        `${approved.recipient}\n${approved.subject}\n${approved.bodyText}`,
      )
      .digest("hex");
    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (currentHash !== approved.bodyHash || !apiKey) {
      await ctx.runMutation(failSend, {
        ...args,
        failureCode: apiKey ? "BODY_HASH_MISMATCH" : "NOT_CONFIGURED",
      });
      return { status: "failed" as const };
    }
    try {
      const result = await sendAgentMail({
        apiKey,
        inboxId: approved.inboxId,
        approvalId: args.approvalId,
        recipient: approved.recipient,
        subject: approved.subject,
        bodyText: approved.bodyText,
      });
      await ctx.runMutation(commitSend, { ...args, ...result });
      return { status: "sent" as const };
    } catch (error) {
      await ctx.runMutation(failSend, {
        ...args,
        failureCode:
          error instanceof Error && /^AGENTMAIL_[A-Z0-9_]+$/.test(error.message)
            ? error.message
            : "PROVIDER_FAILURE",
      });
      return { status: "failed" as const };
    }
  },
});
