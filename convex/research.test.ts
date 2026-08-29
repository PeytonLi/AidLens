/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const start = makeFunctionReference<
  "mutation",
  { schoolId: Id<"schools"> },
  { researchRunId: Id<"researchRuns">; status: "scheduled" | "active" }
>("research:start");
const getForSchool = makeFunctionReference<
  "query",
  { schoolId: Id<"schools"> }
>("research:getForSchool");
const prepare = makeFunctionReference<
  "mutation",
  {
    researchRunId: Id<"researchRuns">;
    workspaceId: Id<"workspaces">;
    workspaceGeneration: number;
    generation: number;
  }
>("research:prepare");
const commit = makeFunctionReference<
  "mutation",
  {
    researchRunId: Id<"researchRuns">;
    workspaceId: Id<"workspaces">;
    workspaceGeneration: number;
    generation: number;
    evidence: Array<{ url: string; title: string; excerpt: string }>;
  },
  boolean
>("research:commit");

it("S7.6: research start is owner-only and idempotent while active", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "owner@example.com" });
    const profileId = await ctx.db.insert("profiles", {
      authUserId: userId,
      email: "owner@example.com",
      ageConfirmedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerProfileId: profileId,
      name: "Offers",
      status: "active",
      generation: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const schoolId = await ctx.db.insert("schools", {
      workspaceId,
      name: "Example University",
      officialDomain: "example.edu",
      identityState: "confirmed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { userId, schoolId, workspaceId };
  });
  const owner = t.withIdentity({ subject: `${ids.userId}|session` });
  const otherUserId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "other@example.com" }),
  );
  const other = t.withIdentity({ subject: `${otherUserId}|session` });

  const first = await owner.mutation(start, { schoolId: ids.schoolId });
  expect(first.status).toBe("scheduled");
  await expect(
    owner.mutation(start, { schoolId: ids.schoolId }),
  ).resolves.toEqual({
    researchRunId: first.researchRunId,
    status: "active",
  });
  await expect(
    other.query(getForSchool, { schoolId: ids.schoolId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    owner.query(getForSchool, { schoolId: ids.schoolId }),
  ).resolves.toMatchObject({
    run: { _id: first.researchRunId, state: "queued" },
    sources: [],
  });
  await expect(
    t.mutation(prepare, {
      researchRunId: first.researchRunId,
      workspaceId: ids.workspaceId,
      workspaceGeneration: 0,
      generation: 0,
    }),
  ).resolves.toMatchObject({ officialDomain: "example.edu" });
  const commitArgs = {
    researchRunId: first.researchRunId,
    workspaceId: ids.workspaceId,
    workspaceGeneration: 0,
    generation: 0,
    evidence: [
      {
        url: "https://example.edu/aid",
        title: "Financial aid",
        excerpt: "Official renewal policy.",
      },
    ],
  };
  await expect(t.mutation(commit, commitArgs)).resolves.toBe(true);
  await expect(t.mutation(commit, commitArgs)).resolves.toBe(false);
  await expect(
    owner.query(getForSchool, { schoolId: ids.schoolId }),
  ).resolves.toMatchObject({
    run: { state: "succeeded" },
    sources: [{ kind: "official_page", url: "https://example.edu/aid" }],
  });
});
