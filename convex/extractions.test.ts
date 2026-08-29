/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const commitExtraction = makeFunctionReference<
  "mutation",
  {
    workspaceId: Id<"workspaces">;
    workspaceGeneration: number;
    documentId: Id<"offerDocuments">;
    processingGeneration: number;
    result: typeof extraction;
  }
>("extractions:commit");

const extraction = {
  version: "v1" as const,
  schoolCandidates: [
    {
      name: "Example University",
      unitId: null,
      officialDomain: "example.edu",
      confidence: 0.96,
      evidence: { page: 1, region: "header", excerpt: "Example University" },
    },
  ],
  offer: {
    academicYear: "2026-2027",
    startTerm: "Fall 2026",
    endTerm: "Spring 2027",
    enrollmentIntensity: "full_time",
    housingAssumption: "on_campus",
    residencyAssumption: "resident",
    overallConfidence: 0.91,
    lineItems: [
      {
        originalLabel: "University Grant",
        canonicalCategory: "grant" as const,
        amountCents: 1_000_000,
        period: "academic_year",
        status: "offered" as const,
        renewal: { kind: "unknown" as const },
        requiredForCostTotal: false,
        confidence: 0.9,
        evidence: {
          page: 1,
          region: "aid table",
          excerpt: "University Grant $10,000",
        },
      },
    ],
  },
};

test("S5.2: a validated extraction commits cited preliminary facts atomically", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "test@example.com" });
    const profileId = await ctx.db.insert("profiles", {
      authUserId: userId,
      email: "test@example.com",
      ageConfirmedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerProfileId: profileId,
      name: "Aid offers",
      status: "active",
      generation: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const documentId = await ctx.db.insert("offerDocuments", {
      workspaceId,
      fileName: "offer.pdf",
      mimeType: "application/pdf",
      byteSize: 100,
      sha256: "synthetic",
      sourceRoute: "upload",
      retentionDeadline: Date.now() + 60_000,
      rawState: "present",
      processingState: "extracting",
      processingGeneration: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { workspaceId, documentId };
  });

  const firstCommit = await t.mutation(commitExtraction, {
    ...ids,
    workspaceGeneration: 0,
    processingGeneration: 0,
    result: extraction,
  });
  expect(firstCommit).toMatchObject({ status: "created" });
  await expect(
    t.mutation(commitExtraction, {
      ...ids,
      workspaceGeneration: 0,
      processingGeneration: 0,
      result: extraction,
    }),
  ).resolves.toEqual({
    status: "duplicate",
    offerId:
      firstCommit.status === "created" ? firstCommit.offerId : "unreachable",
  });
  await t.run((ctx) =>
    ctx.db.patch("offerDocuments", ids.documentId, {
      processingGeneration: 1,
    }),
  );
  await expect(
    t.mutation(commitExtraction, {
      ...ids,
      workspaceGeneration: 0,
      processingGeneration: 0,
      result: extraction,
    }),
  ).resolves.toEqual({ status: "stale" });

  const persisted = await t.run(async (ctx) => ({
    document: await ctx.db.get("offerDocuments", ids.documentId),
    offers: await ctx.db
      .query("offers")
      .withIndex("by_documentId", (q) => q.eq("documentId", ids.documentId))
      .take(2),
    items: await ctx.db.query("lineItems").take(2),
    schools: await ctx.db.query("schools").take(2),
  }));
  expect(persisted.document?.processingState).toBe("needs_school_confirmation");
  expect(persisted.offers).toEqual([
    expect.objectContaining({ reviewState: "preliminary", revision: 0 }),
  ]);
  expect(persisted.items).toEqual([
    expect.objectContaining({
      originalLabel: "University Grant",
      extractedAmountCents: 1_000_000,
      amountCents: 1_000_000,
      documentPage: 1,
      sourceExcerpt: "University Grant $10,000",
    }),
  ]);
  expect(persisted.schools).toEqual([
    expect.objectContaining({
      name: "Example University",
      identityState: "candidate",
    }),
  ]);
});
