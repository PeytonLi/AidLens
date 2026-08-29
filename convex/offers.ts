import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { NOT_FOUND, requireActiveWorkspace } from "./lib/auth";
import schema from "./schema";

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
const itemStatus = v.union(
  v.literal("offered"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("selected"),
);
const renewal = v.union(
  v.object({ kind: v.literal("fixed"), durationYears: v.number() }),
  v.object({ kind: v.literal("one_time") }),
  v.object({ kind: v.literal("nonrenewable") }),
  v.object({ kind: v.literal("conditional") }),
  v.object({ kind: v.literal("unknown") }),
);

export const getReview = query({
  args: { offerId: v.id("offers") },
  returns: v.object({
    offer: schema.doc("offers"),
    school: schema.doc("schools"),
    items: v.array(schema.doc("lineItems")),
    rawDeletedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, { offerId }) => {
    const offer = await ctx.db.get("offers", offerId);
    if (!offer || !offer.schoolId || !offer.active) throw new Error(NOT_FOUND);
    await requireActiveWorkspace(ctx, offer.workspaceId);
    const [school, document, items] = await Promise.all([
      ctx.db.get("schools", offer.schoolId),
      ctx.db.get("offerDocuments", offer.documentId),
      ctx.db
        .query("lineItems")
        .withIndex("by_offerId", (index) => index.eq("offerId", offerId))
        .take(200),
    ]);
    if (
      !school ||
      school.workspaceId !== offer.workspaceId ||
      !document ||
      document.workspaceId !== offer.workspaceId
    ) {
      throw new Error(NOT_FOUND);
    }
    items.sort(
      (left, right) =>
        Number(
          !(left.requiredForCostTotal && left.extractedConfidence < 0.75),
        ) -
        Number(
          !(right.requiredForCostTotal && right.extractedConfidence < 0.75),
        ),
    );
    return {
      offer,
      school,
      items,
      rawDeletedAt: document.rawDeletedAt ?? null,
    };
  },
});

export const correctLineItem = mutation({
  args: {
    lineItemId: v.id("lineItems"),
    expectedRevision: v.number(),
    amountCents: v.union(v.number(), v.null()),
    canonicalCategory: category,
    period: v.string(),
    status: itemStatus,
    renewal,
  },
  returns: v.object({ revision: v.number(), offerRevision: v.number() }),
  handler: async (ctx, args) => {
    const item = await ctx.db.get("lineItems", args.lineItemId);
    if (!item) throw new Error(NOT_FOUND);
    const offer = await ctx.db.get("offers", item.offerId);
    if (!offer || !offer.active || offer.reviewState !== "preliminary") {
      throw new Error(NOT_FOUND);
    }
    const workspace = await requireActiveWorkspace(ctx, offer.workspaceId);
    if (item.workspaceId !== workspace._id) throw new Error(NOT_FOUND);
    if (item.revision !== args.expectedRevision)
      throw new Error("STALE_REVISION");
    if (
      (args.amountCents !== null &&
        (!Number.isSafeInteger(args.amountCents) || args.amountCents < 0)) ||
      args.period.trim().length === 0 ||
      args.period.length > 100 ||
      (args.renewal.kind === "fixed" &&
        (!Number.isSafeInteger(args.renewal.durationYears) ||
          args.renewal.durationYears < 1 ||
          args.renewal.durationYears > 10))
    ) {
      throw new Error("INVALID_CORRECTION");
    }
    const now = Date.now();
    const revision = item.revision + 1;
    const offerRevision = offer.revision + 1;
    await ctx.db.patch("lineItems", item._id, {
      amountCents: args.amountCents,
      canonicalCategory: args.canonicalCategory,
      period: args.period.trim(),
      status: args.status,
      renewal: args.renewal,
      verifiedByUserAt: now,
      correctedByProfileId: workspace.ownerProfileId,
      revision,
      updatedAt: now,
    });
    await ctx.db.patch("offers", offer._id, {
      revision: offerRevision,
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      workspaceId: offer.workspaceId,
      actor: "user",
      eventType: "line_item_corrected",
      documentId: offer.documentId,
      safeMetadata: { reason: "review_edit" },
      createdAt: now,
    });
    return { revision, offerRevision };
  },
});

export const confirmReviewed = mutation({
  args: { offerId: v.id("offers"), expectedRevision: v.number() },
  returns: v.object({
    status: v.literal("reviewed"),
    revision: v.number(),
  }),
  handler: async (ctx, { offerId, expectedRevision }) => {
    const offer = await ctx.db.get("offers", offerId);
    if (!offer || !offer.active || offer.reviewState !== "preliminary") {
      throw new Error(NOT_FOUND);
    }
    await requireActiveWorkspace(ctx, offer.workspaceId);
    if (offer.revision !== expectedRevision) throw new Error("STALE_REVISION");
    const [document, items] = await Promise.all([
      ctx.db.get("offerDocuments", offer.documentId),
      ctx.db
        .query("lineItems")
        .withIndex("by_offerId", (index) => index.eq("offerId", offerId))
        .take(200),
    ]);
    if (
      !document ||
      document.workspaceId !== offer.workspaceId ||
      document.processingState !== "needs_review"
    ) {
      throw new Error(NOT_FOUND);
    }
    if (
      items.length === 0 ||
      items.some(
        (item) =>
          item.requiredForCostTotal &&
          (item.amountCents === null || item.extractedConfidence < 0.75) &&
          item.verifiedByUserAt === undefined,
      )
    ) {
      throw new Error("REVIEW_INCOMPLETE");
    }
    const now = Date.now();
    await ctx.db.patch("offers", offerId, {
      reviewState: "reviewed",
      updatedAt: now,
    });
    await ctx.db.patch("offerDocuments", offer.documentId, {
      processingState: "ready",
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      workspaceId: offer.workspaceId,
      actor: "user",
      eventType: "offer_reviewed",
      documentId: offer.documentId,
      safeMetadata: { reason: "required_fields_addressed" },
      createdAt: now,
    });
    return { status: "reviewed" as const, revision: offer.revision };
  },
});

export const confirmSchool = mutation({
  args: { offerId: v.id("offers"), schoolId: v.id("schools") },
  returns: v.object({ status: v.literal("confirmed") }),
  handler: async (ctx, { offerId, schoolId }) => {
    const offer = await ctx.db.get("offers", offerId);
    if (!offer) throw new Error(NOT_FOUND);
    await requireActiveWorkspace(ctx, offer.workspaceId);
    const [school, document] = await Promise.all([
      ctx.db.get("schools", schoolId),
      ctx.db.get("offerDocuments", offer.documentId),
    ]);
    if (
      !offer.active ||
      offer.reviewState !== "preliminary" ||
      !school ||
      school.workspaceId !== offer.workspaceId ||
      school.sourceDocumentId !== offer.documentId ||
      !document ||
      document.workspaceId !== offer.workspaceId ||
      document.processingState !== "needs_school_confirmation"
    ) {
      throw new Error(NOT_FOUND);
    }
    const now = Date.now();
    await ctx.db.patch("schools", schoolId, {
      identityState: "confirmed",
      updatedAt: now,
    });
    await ctx.db.patch("offers", offerId, { schoolId, updatedAt: now });
    await ctx.db.patch("offerDocuments", offer.documentId, {
      schoolId,
      processingState: "needs_review",
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      workspaceId: offer.workspaceId,
      actor: "user",
      eventType: "school_confirmed",
      documentId: offer.documentId,
      safeMetadata: { reason: "candidate_selected" },
      createdAt: now,
    });
    return { status: "confirmed" as const };
  },
});
