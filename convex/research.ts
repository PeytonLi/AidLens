import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  getActiveWorkspaceForGeneration,
  NOT_FOUND,
  requireActiveWorkspace,
} from "./lib/auth";
import { requireOfficialHttpsUrl } from "./lib/officialUrl";
import schema from "./schema";

const runResearch = makeFunctionReference<
  "action",
  {
    researchRunId: Id<"researchRuns">;
    workspaceId: Id<"workspaces">;
    workspaceGeneration: number;
    generation: number;
  }
>("researchActions:run");
const researchArgs = {
  researchRunId: v.id("researchRuns"),
  workspaceId: v.id("workspaces"),
  workspaceGeneration: v.number(),
  generation: v.number(),
};

export const start = mutation({
  args: { schoolId: v.id("schools") },
  returns: v.object({
    researchRunId: v.id("researchRuns"),
    status: v.union(v.literal("scheduled"), v.literal("active")),
  }),
  handler: async (ctx, { schoolId }) => {
    const school = await ctx.db.get("schools", schoolId);
    if (!school) throw new Error(NOT_FOUND);
    const workspace = await requireActiveWorkspace(ctx, school.workspaceId);
    if (school.identityState !== "confirmed" || !school.officialDomain)
      throw new Error("SCHOOL_NOT_CONFIRMED");
    for (const state of ["queued", "running"] as const) {
      const active = await ctx.db
        .query("researchRuns")
        .withIndex("by_schoolId_state", (index) =>
          index.eq("schoolId", schoolId).eq("state", state),
        )
        .first();
      if (active)
        return { researchRunId: active._id, status: "active" as const };
    }
    const now = Date.now();
    const researchRunId = await ctx.db.insert("researchRuns", {
      workspaceId: workspace._id,
      schoolId,
      generation: 0,
      state: "queued",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, runResearch, {
      researchRunId,
      workspaceId: workspace._id,
      workspaceGeneration: workspace.generation,
      generation: 0,
    });
    return { researchRunId, status: "scheduled" as const };
  },
});

export const getForSchool = query({
  args: { schoolId: v.id("schools") },
  returns: v.object({
    school: schema.doc("schools"),
    run: v.union(schema.doc("researchRuns"), v.null()),
    sources: v.array(schema.doc("sources")),
  }),
  handler: async (ctx, { schoolId }) => {
    const school = await ctx.db.get("schools", schoolId);
    if (!school) throw new Error(NOT_FOUND);
    await requireActiveWorkspace(ctx, school.workspaceId);
    const runs = await ctx.db
      .query("researchRuns")
      .withIndex("by_workspaceId", (index) =>
        index.eq("workspaceId", school.workspaceId),
      )
      .take(50);
    const run =
      runs.filter((candidate) => candidate.schoolId === schoolId).at(-1) ??
      null;
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_schoolId", (index) => index.eq("schoolId", schoolId))
      .take(20);
    return { school, run, sources };
  },
});

export const prepare = internalMutation({
  args: researchArgs,
  returns: v.union(
    v.object({
      schoolId: v.id("schools"),
      officialDomain: v.string(),
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
    const run = await ctx.db.get("researchRuns", args.researchRunId);
    if (
      !run ||
      run.workspaceId !== args.workspaceId ||
      run.generation !== args.generation ||
      run.state !== "queued"
    )
      return null;
    const school = await ctx.db.get("schools", run.schoolId);
    if (
      !school ||
      school.workspaceId !== args.workspaceId ||
      school.identityState !== "confirmed" ||
      !school.officialDomain
    )
      return null;
    await ctx.db.patch("researchRuns", run._id, {
      state: "running",
      updatedAt: Date.now(),
    });
    return { schoolId: school._id, officialDomain: school.officialDomain };
  },
});

export const commit = internalMutation({
  args: {
    ...researchArgs,
    evidence: v.array(
      v.object({ url: v.string(), title: v.string(), excerpt: v.string() }),
    ),
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
    const run = await ctx.db.get("researchRuns", args.researchRunId);
    if (
      !run ||
      run.workspaceId !== args.workspaceId ||
      run.generation !== args.generation ||
      run.state !== "running" ||
      args.evidence.length > 5
    )
      return false;
    const school = await ctx.db.get("schools", run.schoolId);
    if (!school?.officialDomain || school.workspaceId !== args.workspaceId)
      return false;
    const now = Date.now();
    for (const evidence of args.evidence) {
      await ctx.db.insert("sources", {
        workspaceId: args.workspaceId,
        schoolId: school._id,
        researchRunId: run._id,
        kind: "official_page",
        url: requireOfficialHttpsUrl(evidence.url, school.officialDomain),
        title: evidence.title.slice(0, 200),
        excerpt: evidence.excerpt.slice(0, 500),
        retrievedAt: now,
      });
    }
    await ctx.db.patch("researchRuns", run._id, {
      state: args.evidence.length ? "succeeded" : "unresolved",
      updatedAt: now,
    });
    return true;
  },
});

export const fail = internalMutation({
  args: { ...researchArgs, failureCode: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("researchRuns", args.researchRunId);
    if (
      !run ||
      run.workspaceId !== args.workspaceId ||
      run.generation !== args.generation ||
      run.state !== "running"
    )
      return false;
    await ctx.db.patch("researchRuns", run._id, {
      state: "failed",
      failureCode: args.failureCode.slice(0, 100),
      updatedAt: Date.now(),
    });
    return true;
  },
});
