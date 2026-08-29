import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const renewal = v.union(
  v.object({ kind: v.literal("fixed"), durationYears: v.number() }),
  v.object({ kind: v.literal("one_time") }),
  v.object({ kind: v.literal("nonrenewable") }),
  v.object({ kind: v.literal("conditional") }),
  v.object({ kind: v.literal("unknown") }),
);

const aidCategory = v.union(
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

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  profiles: defineTable({
    authUserId: v.id("users"),
    email: v.string(),
    ageConfirmedAt: v.optional(v.number()),
    agentMailInboxId: v.optional(v.string()),
    agentMailInboxAddress: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_agentMailInboxId", ["agentMailInboxId"]),
  workspaces: defineTable({
    ownerProfileId: v.id("profiles"),
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("deleting")),
    currentChoiceSchoolId: v.optional(v.id("schools")),
    generation: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletionStartedAt: v.optional(v.number()),
  })
    .index("by_ownerProfileId", ["ownerProfileId"])
    .index("by_ownerProfileId_status", ["ownerProfileId", "status"]),
  schools: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    unitId: v.optional(v.string()),
    officialDomain: v.optional(v.string()),
    identityState: v.union(
      v.literal("candidate"),
      v.literal("needs_confirmation"),
      v.literal("confirmed"),
    ),
    financialAidEmail: v.optional(v.string()),
    bursarEmail: v.optional(v.string()),
    sourceDocumentId: v.optional(v.id("offerDocuments")),
    extractedConfidence: v.optional(v.number()),
    documentPage: v.optional(v.number()),
    sourceRegion: v.optional(v.string()),
    sourceExcerpt: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_sourceDocumentId", ["sourceDocumentId"]),
  offerDocuments: defineTable({
    workspaceId: v.id("workspaces"),
    schoolId: v.optional(v.id("schools")),
    storageId: v.optional(v.id("_storage")),
    fileName: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
    sha256: v.string(),
    sourceRoute: v.union(v.literal("upload"), v.literal("agentmail")),
    agentMailAttachmentId: v.optional(v.string()),
    retentionDeadline: v.number(),
    rawState: v.union(
      v.literal("present"),
      v.literal("deleting"),
      v.literal("deleted"),
    ),
    processingState: v.union(
      v.literal("received"),
      v.literal("validating"),
      v.literal("extracting"),
      v.literal("needs_school_confirmation"),
      v.literal("researching"),
      v.literal("needs_review"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    processingGeneration: v.number(),
    failedStage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    statementDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    rawDeletedAt: v.optional(v.number()),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_schoolId_createdAt", ["schoolId", "createdAt"])
    .index("by_workspaceId_sha256", ["workspaceId", "sha256"])
    .index("by_rawState_retentionDeadline", ["rawState", "retentionDeadline"])
    .index("by_agentMailAttachmentId", ["agentMailAttachmentId"])
    .index("by_storageId", ["storageId"]),
  offers: defineTable({
    workspaceId: v.id("workspaces"),
    schoolId: v.optional(v.id("schools")),
    documentId: v.id("offerDocuments"),
    version: v.number(),
    active: v.boolean(),
    reviewState: v.union(v.literal("preliminary"), v.literal("reviewed")),
    academicYear: v.string(),
    startTerm: v.string(),
    endTerm: v.string(),
    enrollmentIntensity: v.string(),
    housingAssumption: v.string(),
    residencyAssumption: v.string(),
    overallConfidence: v.number(),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    supersededAt: v.optional(v.number()),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_schoolId_active", ["schoolId", "active"])
    .index("by_schoolId_version", ["schoolId", "version"])
    .index("by_documentId", ["documentId"]),
  lineItems: defineTable({
    workspaceId: v.id("workspaces"),
    offerId: v.id("offers"),
    originalLabel: v.string(),
    extractedCanonicalCategory: v.optional(aidCategory),
    canonicalCategory: aidCategory,
    extractedAmountCents: v.union(v.number(), v.null()),
    extractedPeriod: v.string(),
    extractedStatus: v.union(
      v.literal("offered"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("selected"),
    ),
    extractedRenewal: renewal,
    extractedConfidence: v.number(),
    amountCents: v.union(v.number(), v.null()),
    period: v.string(),
    status: v.union(
      v.literal("offered"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("selected"),
    ),
    renewal,
    requiredForCostTotal: v.boolean(),
    documentPage: v.number(),
    sourceRegion: v.optional(v.string()),
    sourceExcerpt: v.string(),
    verifiedByUserAt: v.optional(v.number()),
    correctedByProfileId: v.optional(v.id("profiles")),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_offerId", ["offerId"]),
  auditEvents: defineTable({
    workspaceId: v.id("workspaces"),
    actor: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("fireworks"),
      v.literal("firecrawl"),
      v.literal("agentmail"),
      v.literal("school_reply"),
    ),
    eventType: v.string(),
    documentId: v.optional(v.id("offerDocuments")),
    safeMetadata: v.optional(v.object({ reason: v.optional(v.string()) })),
    createdAt: v.number(),
  }).index("by_workspaceId_createdAt", ["workspaceId", "createdAt"]),
});
