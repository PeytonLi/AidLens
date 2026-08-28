import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import {
  getActiveWorkspaceForGeneration,
  NOT_FOUND,
  requireActiveWorkspace,
  requireProfile,
} from "./lib/auth";

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    return await ctx.db
      .query("workspaces")
      .withIndex("by_ownerProfileId_status", (query) =>
        query.eq("ownerProfileId", profile._id).eq("status", "active"),
      )
      .unique();
  },
});

export const getById = query({
  args: { workspaceId: v.id("workspaces") },
  handler: (ctx, { workspaceId }) => requireActiveWorkspace(ctx, workspaceId),
});

export const chooseCurrentSchool = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, { workspaceId, schoolId }) => {
    await requireActiveWorkspace(ctx, workspaceId);
    const school = await ctx.db.get("schools", schoolId);
    if (!school || school.workspaceId !== workspaceId) {
      throw new Error(NOT_FOUND);
    }
    await ctx.db.patch("workspaces", workspaceId, {
      currentChoiceSchoolId: schoolId,
      updatedAt: Date.now(),
    });
    return schoolId;
  },
});

export const remove = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const workspace = await requireActiveWorkspace(ctx, workspaceId);
    const now = Date.now();
    await ctx.db.patch("workspaces", workspaceId, {
      status: "deleting",
      generation: workspace.generation + 1,
      deletionStartedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("profiles", workspace.ownerProfileId, {
      agentMailInboxId: undefined,
      agentMailInboxAddress: undefined,
      updatedAt: now,
    });
    const schools = await ctx.db
      .query("schools")
      .withIndex("by_workspaceId", (query) =>
        query.eq("workspaceId", workspaceId),
      )
      .collect();
    await Promise.all(
      schools.map((school) => ctx.db.delete("schools", school._id)),
    );
    await ctx.db.delete("workspaces", workspaceId);
  },
});

export const isGenerationCurrent = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    generation: v.number(),
  },
  handler: async (ctx, { workspaceId, generation }) =>
    (await getActiveWorkspaceForGeneration(ctx, workspaceId, generation)) !==
    null,
});
