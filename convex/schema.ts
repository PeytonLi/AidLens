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
});
