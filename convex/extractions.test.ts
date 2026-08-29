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
const getSource = makeFunctionReference<
  "query",
  {
    workspaceId: Id<"workspaces">;
    workspaceGeneration: number;
    documentId: Id<"offerDocuments">;
    processingGeneration: number;
  }
>("extractions:getSource");
const recordFailure = makeFunctionReference<
  "mutation",
  {
    workspaceId: Id<"workspaces">;
    workspaceGeneration: number;
    documentId: Id<"offerDocuments">;
    processingGeneration: number;
    attempt: number;
  }
>("extractions:recordFailure");
const confirmSchool = makeFunctionReference<
  "mutation",
  { offerId: Id<"offers">; schoolId: Id<"schools"> },
  { status: "confirmed" }
>("offers:confirmSchool");
const getReview = makeFunctionReference<"query", { offerId: Id<"offers"> }>(
  "offers:getReview",
);
const correctLineItem = makeFunctionReference<
  "mutation",
  {
    lineItemId: Id<"lineItems">;
    expectedRevision: number;
    amountCents: number | null;
    canonicalCategory: "direct_cost";
    period: string;
    status: "offered";
    renewal: { kind: "unknown" };
  }
>("offers:correctLineItem");
const confirmReviewed = makeFunctionReference<
  "mutation",
  { offerId: Id<"offers">; expectedRevision: number },
  { status: "reviewed"; revision: number }
>("offers:confirmReviewed");
const confirmManualSchool = makeFunctionReference<
  "mutation",
  { offerId: Id<"offers">; name: string; officialDomain: string },
  { status: "confirmed"; schoolId: Id<"schools"> }
>("offers:confirmManualSchool");
const listForWorkspace = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces"> }
>("offers:listForWorkspace");

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
      {
        originalLabel: "Tuition and fees",
        canonicalCategory: "direct_cost" as const,
        amountCents: null,
        period: "academic_year",
        status: "offered" as const,
        renewal: { kind: "unknown" as const },
        requiredForCostTotal: true,
        confidence: 0.4,
        evidence: {
          page: 1,
          region: "cost table",
          excerpt: "Tuition and fees amount unavailable",
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
    const storageId = await ctx.storage.store(
      new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }),
    );
    const documentId = await ctx.db.insert("offerDocuments", {
      workspaceId,
      storageId,
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
    return { userId, workspaceId, documentId, storageId };
  });

  await expect(
    t.query(getSource, {
      workspaceId: ids.workspaceId,
      workspaceGeneration: 0,
      documentId: ids.documentId,
      processingGeneration: 0,
    }),
  ).resolves.toEqual({
    storageId: ids.storageId,
    mimeType: "application/pdf",
  });

  const firstCommit = await t.mutation(commitExtraction, {
    workspaceId: ids.workspaceId,
    documentId: ids.documentId,
    workspaceGeneration: 0,
    processingGeneration: 0,
    result: extraction,
  });
  expect(firstCommit).toMatchObject({ status: "created" });
  await expect(
    t.mutation(commitExtraction, {
      workspaceId: ids.workspaceId,
      documentId: ids.documentId,
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
      workspaceId: ids.workspaceId,
      documentId: ids.documentId,
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
  expect(persisted.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        originalLabel: "University Grant",
        extractedAmountCents: 1_000_000,
        amountCents: 1_000_000,
        documentPage: 1,
        sourceExcerpt: "University Grant $10,000",
      }),
    ]),
  );
  expect(persisted.schools).toEqual([
    expect.objectContaining({
      name: "Example University",
      identityState: "candidate",
    }),
  ]);
  const owner = t.withIdentity({ subject: `${ids.userId}|test-session` });
  const otherUserId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "other@example.com" }),
  );
  const other = t.withIdentity({ subject: `${otherUserId}|test-session` });
  const offerId = persisted.offers[0]._id;
  const schoolId = persisted.schools[0]._id;
  await expect(
    owner.query(listForWorkspace, { workspaceId: ids.workspaceId }),
  ).resolves.toEqual([
    expect.objectContaining({ _id: offerId, documentId: ids.documentId }),
  ]);
  await expect(owner.query(getReview, { offerId })).resolves.toMatchObject({
    school: { _id: schoolId, identityState: "candidate" },
    candidates: [{ _id: schoolId, name: "Example University" }],
  });
  await expect(
    other.mutation(confirmSchool, { offerId, schoolId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    owner.mutation(confirmSchool, { offerId, schoolId }),
  ).resolves.toEqual({ status: "confirmed" });
  await expect(
    t.run(async (ctx) => ({
      offer: await ctx.db.get("offers", offerId),
      school: await ctx.db.get("schools", schoolId),
      document: await ctx.db.get("offerDocuments", ids.documentId),
    })),
  ).resolves.toMatchObject({
    offer: { schoolId },
    school: { identityState: "confirmed" },
    document: { schoolId, processingState: "needs_review" },
  });
  const review = await owner.query(getReview, { offerId });
  expect(review).toMatchObject({
    offer: { _id: offerId, reviewState: "preliminary" },
    school: { _id: schoolId, name: "Example University" },
    items: [
      {
        originalLabel: "Tuition and fees",
        amountCents: null,
        requiredForCostTotal: true,
        extractedConfidence: 0.4,
      },
      { originalLabel: "University Grant" },
    ],
  });
  await expect(other.query(getReview, { offerId })).rejects.toHaveProperty(
    "message",
    "Not found",
  );
  const tuition = review.items[0];
  await expect(
    owner.mutation(confirmReviewed, { offerId, expectedRevision: 0 }),
  ).rejects.toThrow("REVIEW_INCOMPLETE");
  await expect(
    owner.mutation(correctLineItem, {
      lineItemId: tuition._id,
      expectedRevision: 0,
      amountCents: 2_500_000,
      canonicalCategory: "direct_cost",
      period: "academic_year",
      status: "offered",
      renewal: { kind: "unknown" },
    }),
  ).resolves.toEqual({ revision: 1, offerRevision: 1 });
  await expect(
    owner.mutation(correctLineItem, {
      lineItemId: tuition._id,
      expectedRevision: 0,
      amountCents: 1,
      canonicalCategory: "direct_cost",
      period: "academic_year",
      status: "offered",
      renewal: { kind: "unknown" },
    }),
  ).rejects.toThrow("STALE_REVISION");
  await expect(
    t.run((ctx) => ctx.db.get("lineItems", tuition._id)),
  ).resolves.toMatchObject({
    extractedAmountCents: null,
    extractedCanonicalCategory: "direct_cost",
    amountCents: 2_500_000,
    revision: 1,
  });
  await expect(
    owner.mutation(confirmReviewed, { offerId, expectedRevision: 1 }),
  ).resolves.toEqual({ status: "reviewed", revision: 1 });
  await expect(
    t.run(async (ctx) => ({
      offer: await ctx.db.get("offers", offerId),
      document: await ctx.db.get("offerDocuments", ids.documentId),
    })),
  ).resolves.toMatchObject({
    offer: { reviewState: "reviewed", revision: 1 },
    document: { processingState: "ready" },
  });

  const manualIds = await t.run(async (ctx) => {
    const now = Date.now();
    const documentId = await ctx.db.insert("offerDocuments", {
      workspaceId: ids.workspaceId,
      fileName: "manual.pdf",
      mimeType: "application/pdf",
      byteSize: 10,
      sha256: "manual-fixture",
      sourceRoute: "upload",
      retentionDeadline: now + 60_000,
      rawState: "present",
      processingState: "needs_school_confirmation",
      processingGeneration: 0,
      createdAt: now,
      updatedAt: now,
    });
    const offerId = await ctx.db.insert("offers", {
      workspaceId: ids.workspaceId,
      documentId,
      version: 1,
      active: true,
      reviewState: "preliminary",
      academicYear: "2026-2027",
      startTerm: "Fall 2026",
      endTerm: "Spring 2027",
      enrollmentIntensity: "full_time",
      housingAssumption: "unknown",
      residencyAssumption: "unknown",
      overallConfidence: 0.5,
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { documentId, offerId };
  });
  await expect(
    owner.mutation(confirmManualSchool, {
      offerId: manualIds.offerId,
      name: "Manual College",
      officialDomain: "HTTPS://WWW.Manual.EDU/path",
    }),
  ).resolves.toMatchObject({ status: "confirmed" });
  await expect(
    t.run(async (ctx) => {
      const offer = await ctx.db.get("offers", manualIds.offerId);
      return offer?.schoolId
        ? await ctx.db.get("schools", offer.schoolId)
        : null;
    }),
  ).resolves.toMatchObject({
    name: "Manual College",
    officialDomain: "manual.edu",
    identityState: "confirmed",
  });

  await t.run((ctx) =>
    ctx.db.patch("offerDocuments", ids.documentId, {
      processingState: "extracting",
    }),
  );
  await expect(
    t.mutation(recordFailure, {
      workspaceId: ids.workspaceId,
      workspaceGeneration: 0,
      documentId: ids.documentId,
      processingGeneration: 1,
      attempt: 0,
    }),
  ).resolves.toEqual({ status: "retrying" });
  await expect(
    t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()),
  ).resolves.toHaveLength(1);
  await expect(
    t.mutation(recordFailure, {
      workspaceId: ids.workspaceId,
      workspaceGeneration: 0,
      documentId: ids.documentId,
      processingGeneration: 1,
      attempt: 1,
    }),
  ).resolves.toEqual({ status: "failed" });
  await expect(
    t.run((ctx) => ctx.db.get("offerDocuments", ids.documentId)),
  ).resolves.toMatchObject({
    processingState: "failed",
    failedStage: "extracting",
    errorCode: "EXTRACTION_FAILED",
    errorMessage: "We couldn't read this offer. Try extraction again.",
  });
});
