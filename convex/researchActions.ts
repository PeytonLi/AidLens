"use node";

import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { scrapeOfficialPage, searchOfficialPages } from "./lib/firecrawl";

type Args = {
  researchRunId: Id<"researchRuns">;
  workspaceId: Id<"workspaces">;
  workspaceGeneration: number;
  generation: number;
};
const prepare = makeFunctionReference<
  "mutation",
  Args,
  { schoolId: Id<"schools">; officialDomain: string } | null
>("research:prepare");
const commit = makeFunctionReference<
  "mutation",
  Args & { evidence: Array<{ url: string; title: string; excerpt: string }> },
  boolean
>("research:commit");
const fail = makeFunctionReference<
  "mutation",
  Args & { failureCode: string },
  boolean
>("research:fail");

export const run = internalAction({
  args: {
    researchRunId: v.id("researchRuns"),
    workspaceId: v.id("workspaces"),
    workspaceGeneration: v.number(),
    generation: v.number(),
  },
  returns: v.object({
    status: v.union(
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("stale"),
    ),
  }),
  handler: async (ctx, args) => {
    const school = await ctx.runMutation(prepare, args);
    if (!school) return { status: "stale" as const };
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(fail, { ...args, failureCode: "NOT_CONFIGURED" });
      return { status: "failed" as const };
    }
    try {
      const results = await searchOfficialPages({
        apiKey,
        domain: school.officialDomain,
        query: "financial aid costs scholarships renewal deadlines",
      });
      const evidence = [];
      for (const result of results.slice(0, 3)) {
        evidence.push(
          await scrapeOfficialPage({
            apiKey,
            domain: school.officialDomain,
            url: result.url,
          }),
        );
      }
      await ctx.runMutation(commit, { ...args, evidence });
      return { status: "succeeded" as const };
    } catch (error) {
      const failureCode =
        error instanceof Error && /^FIRECRAWL_\d+$/.test(error.message)
          ? error.message
          : "PROVIDER_FAILURE";
      await ctx.runMutation(fail, { ...args, failureCode });
      return { status: "failed" as const };
    }
  },
});

export const smoke = internalAction({
  args: {},
  returns: v.object({
    ok: v.literal(true),
    domain: v.string(),
    resultCount: v.number(),
  }),
  handler: async () => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY is required");
    const domain = process.env.SMOKE_FIRECRAWL_DOMAIN ?? "www.ucsd.edu";
    const results = await searchOfficialPages({
      apiKey,
      domain,
      query: "cost of attendance financial aid",
    });
    return {
      ok: true as const,
      domain,
      resultCount: results.length,
    };
  },
});
