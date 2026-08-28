import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

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
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspaceId", ["workspaceId"]),
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
    .index("by_storageId", ["storageId"])
    .index("by_schoolId_createdAt", ["schoolId", "createdAt"])
    .index("by_workspaceId_sha256", ["workspaceId", "sha256"])
    .index("by_rawState_retentionDeadline", ["rawState", "retentionDeadline"])
    .index("by_agentMailAttachmentId", ["agentMailAttachmentId"])
    .index("by_storageId", ["storageId"]),
  auditEvents: defineTable({
    workspaceId: v.id("workspaces"),
    actor: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("openai"),
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
