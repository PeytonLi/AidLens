import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  getActiveWorkspaceForGeneration,
  requireActiveWorkspace,
  requireAuthUserId,
  requireProfile,
} from "./lib/auth";
import schema from "./schema";

type ProvisionArgs = {
  profileId: Id<"profiles">;
  workspaceId: Id<"workspaces">;
  workspaceGeneration: number;
};
const provisionInbox = makeFunctionReference<"action", ProvisionArgs>(
  "agentMailActions:provisionInbox",
);

export const getCurrent = query({
  args: {},
  returns: v.union(schema.doc("profiles"), v.null()),
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("profiles")
      .withIndex("by_authUserId", (query) => query.eq("authUserId", userId))
      .unique();
  },
});

export const confirmAge = mutation({
  args: { confirmed: v.boolean() },
  returns: v.object({
    profileId: v.id("profiles"),
    workspaceId: v.id("workspaces"),
  }),
  handler: async (ctx, { confirmed }) => {
    const userId = await requireAuthUserId(ctx);
    if (!confirmed) throw new Error("Age confirmation required");
    const user = await ctx.db.get("users", userId);
    if (!user?.email) throw new Error("Email required");

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_authUserId", (query) => query.eq("authUserId", userId))
      .unique();
    const now = Date.now();
    const profileId =
      existingProfile?._id ??
      (await ctx.db.insert("profiles", {
        authUserId: userId,
        email: user.email,
        ageConfirmedAt: now,
        agentMailProvisioningState: "queued",
        createdAt: now,
        updatedAt: now,
      }));

    if (existingProfile && !existingProfile.ageConfirmedAt) {
      await ctx.db.patch("profiles", profileId, {
        ageConfirmedAt: now,
        updatedAt: now,
      });
    }

    const existingWorkspace = await ctx.db
      .query("workspaces")
      .withIndex("by_ownerProfileId", (query) =>
        query.eq("ownerProfileId", profileId),
      )
      .unique();
    const workspaceId =
      existingWorkspace?._id ??
      (await ctx.db.insert("workspaces", {
        ownerProfileId: profileId,
        name: "My offers",
        status: "active",
        generation: 0,
        createdAt: now,
        updatedAt: now,
      }));

    if (
      !existingProfile?.agentMailInboxId &&
      existingProfile?.agentMailProvisioningState !== "queued" &&
      existingProfile?.agentMailProvisioningState !== "provisioning"
    ) {
      await ctx.db.patch("profiles", profileId, {
        agentMailProvisioningState: "queued",
        agentMailProvisioningError: undefined,
        updatedAt: now,
      });
    }
    if (
      !existingProfile?.agentMailInboxId &&
      existingProfile?.agentMailProvisioningState !== "provisioning"
    ) {
      await ctx.scheduler.runAfter(0, provisionInbox, {
        profileId,
        workspaceId,
        workspaceGeneration: existingWorkspace?.generation ?? 0,
      });
    }

    return { profileId, workspaceId };
  },
});

export const retryInboxProvisioning = mutation({
  args: {},
  returns: v.object({
    status: v.union(
      v.literal("scheduled"),
      v.literal("ready"),
      v.literal("active"),
    ),
  }),
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const workspace = await requireActiveWorkspace(ctx);
    if (profile.agentMailInboxId) return { status: "ready" as const };
    if (
      profile.agentMailProvisioningState === "queued" ||
      profile.agentMailProvisioningState === "provisioning"
    )
      return { status: "active" as const };
    await ctx.db.patch("profiles", profile._id, {
      agentMailProvisioningState: "queued",
      agentMailProvisioningError: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, provisionInbox, {
      profileId: profile._id,
      workspaceId: workspace._id,
      workspaceGeneration: workspace.generation,
    });
    return { status: "scheduled" as const };
  },
});

const provisionArgs = {
  profileId: v.id("profiles"),
  workspaceId: v.id("workspaces"),
  workspaceGeneration: v.number(),
};

export const prepareInboxProvisioning = internalMutation({
  args: provisionArgs,
  returns: v.union(v.object({ clientId: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const workspace = await getActiveWorkspaceForGeneration(
      ctx,
      args.workspaceId,
      args.workspaceGeneration,
    );
    const profile = await ctx.db.get("profiles", args.profileId);
    if (
      !workspace ||
      workspace.ownerProfileId !== args.profileId ||
      !profile ||
      profile.agentMailInboxId ||
      profile.agentMailProvisioningState !== "queued"
    )
      return null;
    await ctx.db.patch("profiles", profile._id, {
      agentMailProvisioningState: "provisioning",
      updatedAt: Date.now(),
    });
    return { clientId: `aidlens-${profile._id}` };
  },
});

export const commitInboxProvisioning = internalMutation({
  args: { ...provisionArgs, inboxId: v.string(), address: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const workspace = await getActiveWorkspaceForGeneration(
      ctx,
      args.workspaceId,
      args.workspaceGeneration,
    );
    const profile = await ctx.db.get("profiles", args.profileId);
    if (
      !workspace ||
      workspace.ownerProfileId !== args.profileId ||
      !profile ||
      profile.agentMailProvisioningState !== "provisioning"
    )
      return false;
    await ctx.db.patch("profiles", profile._id, {
      agentMailInboxId: args.inboxId,
      agentMailInboxAddress: args.address,
      agentMailProvisioningState: "ready",
      agentMailProvisioningError: undefined,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const failInboxProvisioning = internalMutation({
  args: { ...provisionArgs, errorCode: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const workspace = await getActiveWorkspaceForGeneration(
      ctx,
      args.workspaceId,
      args.workspaceGeneration,
    );
    const profile = await ctx.db.get("profiles", args.profileId);
    if (
      !workspace ||
      workspace.ownerProfileId !== args.profileId ||
      !profile ||
      profile.agentMailProvisioningState !== "provisioning"
    )
      return false;
    await ctx.db.patch("profiles", profile._id, {
      agentMailProvisioningState: "failed",
      agentMailProvisioningError: args.errorCode.slice(0, 100),
      updatedAt: Date.now(),
    });
    return true;
  },
});
