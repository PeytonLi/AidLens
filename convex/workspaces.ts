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
  requireProfile,
} from "./lib/auth";

const continueRemovalRef = makeFunctionReference<
  "mutation",
  { workspaceId: Id<"workspaces">; generation: number }
>("workspaces:continueRemoval");
const DELETE_BATCH_SIZE = 50;

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
    await ctx.scheduler.runAfter(0, continueRemovalRef, {
      workspaceId,
      generation: workspace.generation + 1,
    });
  },
});

export const continueRemoval = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    generation: v.number(),
  },
  handler: async (ctx, { workspaceId, generation }) => {
    const workspace = await ctx.db.get("workspaces", workspaceId);
    if (
      !workspace ||
      workspace.status !== "deleting" ||
      workspace.generation !== generation
    ) {
      return false;
    }

    const audits = await ctx.db
      .query("auditEvents")
      .withIndex("by_workspaceId_createdAt", (query) =>
        query.eq("workspaceId", workspaceId),
      )
      .take(DELETE_BATCH_SIZE);
    if (audits.length) {
      await Promise.all(
        audits.map(({ _id }) => ctx.db.delete("auditEvents", _id)),
      );
      await ctx.scheduler.runAfter(0, continueRemovalRef, {
        workspaceId,
        generation,
      });
      return false;
    }

    const documents = await ctx.db
      .query("offerDocuments")
      .withIndex("by_workspaceId", (query) =>
        query.eq("workspaceId", workspaceId),
      )
      .take(DELETE_BATCH_SIZE);
    if (documents.length) {
      for (const document of documents) {
        if (document.storageId) await ctx.storage.delete(document.storageId);
        await ctx.db.delete("offerDocuments", document._id);
      }
      await ctx.scheduler.runAfter(0, continueRemovalRef, {
        workspaceId,
        generation,
      });
      return false;
    }

    const schools = await ctx.db
      .query("schools")
      .withIndex("by_workspaceId", (query) =>
        query.eq("workspaceId", workspaceId),
      )
      .take(DELETE_BATCH_SIZE);
    if (schools.length) {
      await Promise.all(
        schools.map(({ _id }) => ctx.db.delete("schools", _id)),
      );
      await ctx.scheduler.runAfter(0, continueRemovalRef, {
        workspaceId,
        generation,
      });
      return false;
    }

    await ctx.db.delete("workspaces", workspaceId);
    return true;
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
