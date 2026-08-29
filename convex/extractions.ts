import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { getActiveWorkspaceForGeneration } from "./lib/auth";
import { parseExtractionResultV1 } from "../src/domain/extraction";

const evidence = v.object({
  page: v.number(),
  region: v.union(v.string(), v.null()),
  excerpt: v.string(),
});
const renewal = v.union(
  v.object({ kind: v.literal("fixed"), durationYears: v.number() }),
  v.object({ kind: v.literal("one_time") }),
  v.object({ kind: v.literal("nonrenewable") }),
  v.object({ kind: v.literal("conditional") }),
  v.object({ kind: v.literal("unknown") }),
);
const category = v.union(
  v.literal("direct_cost"),
  v.literal("indirect_cost"),
  v.literal("grant"),
  v.literal("scholarship"),
  v.literal("student_loan"),
  v.literal("parent_plus"),
  v.literal("private_loan"),
  v.literal("work_study"),
  v.literal("other_financing"),
  v.literal("family_contribution"),
  v.literal("payment_plan"),
  v.literal("unknown"),
);
const status = v.union(
  v.literal("offered"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("selected"),
);
const extractionResult = v.object({
  version: v.literal("v1"),
  schoolCandidates: v.array(
    v.object({
      name: v.string(),
      unitId: v.union(v.string(), v.null()),
      officialDomain: v.union(v.string(), v.null()),
      confidence: v.number(),
      evidence,
    }),
  ),
  offer: v.object({
    academicYear: v.string(),
    startTerm: v.string(),
    endTerm: v.string(),
    enrollmentIntensity: v.string(),
    housingAssumption: v.string(),
    residencyAssumption: v.string(),
    overallConfidence: v.number(),
    lineItems: v.array(
      v.object({
        originalLabel: v.string(),
        canonicalCategory: category,
        amountCents: v.union(v.number(), v.null()),
        period: v.string(),
        status,
        renewal,
        requiredForCostTotal: v.boolean(),
        confidence: v.number(),
        evidence,
      }),
    ),
  }),
});

const sourceArgs = {
  workspaceId: v.id("workspaces"),
  workspaceGeneration: v.number(),
  documentId: v.id("offerDocuments"),
  processingGeneration: v.number(),
};
type SourceArgs = {
  workspaceId: Id<"workspaces">;
  workspaceGeneration: number;
  documentId: Id<"offerDocuments">;
  processingGeneration: number;
};
const extractDocumentRef = makeFunctionReference<
  "action",
  SourceArgs & { attempt: number }
>("fireworks:extractDocument");

export const getSource = internalQuery({
  args: sourceArgs,
  returns: v.union(
    v.object({
      storageId: v.id("_storage"),
      mimeType: v.union(
        v.literal("application/pdf"),
        v.literal("image/jpeg"),
        v.literal("image/png"),
      ),
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
    ) {
      return null;
    }
    const document = await ctx.db.get("offerDocuments", args.documentId);
    if (
      !document ||
      document.workspaceId !== args.workspaceId ||
      document.processingGeneration !== args.processingGeneration ||
      document.processingState !== "extracting" ||
      document.rawState !== "present" ||
      !document.storageId ||
      !["application/pdf", "image/jpeg", "image/png"].includes(
        document.mimeType,
      )
    ) {
      return null;
    }
    return {
      storageId: document.storageId,
      mimeType: document.mimeType as
        "application/pdf" | "image/jpeg" | "image/png",
    };
  },
});

export const recordFailure = internalMutation({
  args: { ...sourceArgs, attempt: v.number() },
  returns: v.union(
    v.object({ status: v.literal("retrying") }),
    v.object({ status: v.literal("failed") }),
    v.object({ status: v.literal("stale") }),
  ),
  handler: async (ctx, args) => {
    if (
      !(await getActiveWorkspaceForGeneration(
        ctx,
        args.workspaceId,
        args.workspaceGeneration,
      ))
    ) {
      return { status: "stale" as const };
    }
    const document = await ctx.db.get("offerDocuments", args.documentId);
    if (
      !document ||
      document.workspaceId !== args.workspaceId ||
      document.processingGeneration !== args.processingGeneration ||
      document.processingState !== "extracting" ||
      document.rawState !== "present"
    ) {
      return { status: "stale" as const };
    }
    if (args.attempt === 0) {
      await ctx.scheduler.runAfter(0, extractDocumentRef, {
        workspaceId: args.workspaceId,
        workspaceGeneration: args.workspaceGeneration,
        documentId: args.documentId,
        processingGeneration: args.processingGeneration,
        attempt: 1,
      });
      return { status: "retrying" as const };
    }
    await ctx.db.patch("offerDocuments", args.documentId, {
      processingState: "failed",
      failedStage: "extracting",
      errorCode: "EXTRACTION_FAILED",
      errorMessage: "We couldn't read this offer. Try extraction again.",
      updatedAt: Date.now(),
    });
    return { status: "failed" as const };
  },
});

export const commit = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    workspaceGeneration: v.number(),
    documentId: v.id("offerDocuments"),
    processingGeneration: v.number(),
    result: extractionResult,
  },
  returns: v.union(
    v.object({ status: v.literal("created"), offerId: v.id("offers") }),
    v.object({ status: v.literal("duplicate"), offerId: v.id("offers") }),
    v.object({ status: v.literal("stale") }),
  ),
  handler: async (ctx, args) => {
    if (
      !(await getActiveWorkspaceForGeneration(
        ctx,
        args.workspaceId,
        args.workspaceGeneration,
      ))
    ) {
      return { status: "stale" as const };
    }
    const document = await ctx.db.get("offerDocuments", args.documentId);
    if (
      !document ||
      document.workspaceId !== args.workspaceId ||
      document.processingGeneration !== args.processingGeneration ||
      document.rawState !== "present"
    ) {
      return { status: "stale" as const };
    }
    const existing = await ctx.db
      .query("offers")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .unique();
    if (existing)
      return { status: "duplicate" as const, offerId: existing._id };
    if (document.processingState !== "extracting") {
      return { status: "stale" as const };
    }

    const result = parseExtractionResultV1(args.result);
    const now = Date.now();
    const candidateIds = [];
    for (const candidate of result.schoolCandidates) {
      candidateIds.push(
        await ctx.db.insert("schools", {
          workspaceId: args.workspaceId,
          name: candidate.name,
          unitId: candidate.unitId ?? undefined,
          officialDomain: candidate.officialDomain ?? undefined,
          identityState: "candidate",
          sourceDocumentId: args.documentId,
          extractedConfidence: candidate.confidence,
          documentPage: candidate.evidence.page,
          sourceRegion: candidate.evidence.region ?? undefined,
          sourceExcerpt: candidate.evidence.excerpt,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
    const offerId = await ctx.db.insert("offers", {
      workspaceId: args.workspaceId,
      schoolId: candidateIds.length === 1 ? candidateIds[0] : undefined,
      documentId: args.documentId,
      version: 1,
      active: true,
      reviewState: "preliminary",
      academicYear: result.offer.academicYear,
      startTerm: result.offer.startTerm,
      endTerm: result.offer.endTerm,
      enrollmentIntensity: result.offer.enrollmentIntensity,
      housingAssumption: result.offer.housingAssumption,
      residencyAssumption: result.offer.residencyAssumption,
      overallConfidence: result.offer.overallConfidence,
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
    for (const item of result.offer.lineItems) {
      await ctx.db.insert("lineItems", {
        workspaceId: args.workspaceId,
        offerId,
        originalLabel: item.originalLabel,
        canonicalCategory: item.canonicalCategory,
        extractedAmountCents: item.amountCents,
        extractedPeriod: item.period,
        extractedStatus: item.status,
        extractedRenewal: item.renewal,
        extractedConfidence: item.confidence,
        amountCents: item.amountCents,
        period: item.period,
        status: item.status,
        renewal: item.renewal,
        requiredForCostTotal: item.requiredForCostTotal,
        documentPage: item.evidence.page,
        sourceRegion: item.evidence.region ?? undefined,
        sourceExcerpt: item.evidence.excerpt,
        revision: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch("offerDocuments", args.documentId, {
      schoolId: candidateIds.length === 1 ? candidateIds[0] : undefined,
      processingState: "needs_school_confirmation",
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      workspaceId: args.workspaceId,
      actor: "fireworks",
      eventType: "extraction_committed",
      documentId: args.documentId,
      safeMetadata: { reason: "validated_schema_v1" },
      createdAt: now,
    });
    return { status: "created" as const, offerId };
  },
});
