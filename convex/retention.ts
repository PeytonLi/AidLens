import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const MAX_CLEANUP_BATCH = 50;
const cleanupDueRef = makeFunctionReference<
  "mutation",
  { limit?: number },
  { processed: number; hasMore: boolean }
>("retention:cleanupDue");

export const cleanupDue = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = Math.max(
      1,
      Math.min(limit ?? MAX_CLEANUP_BATCH, MAX_CLEANUP_BATCH),
    );
    const due = await ctx.db
      .query("offerDocuments")
      .withIndex("by_rawState_retentionDeadline", (index) =>
        index.eq("rawState", "present").lte("retentionDeadline", Date.now()),
      )
      .take(batchSize + 1);
    const batch = due.slice(0, batchSize);

    for (const document of batch) {
      if (
        document.storageId &&
        (await ctx.db.system.get("_storage", document.storageId))
      ) {
        await ctx.storage.delete(document.storageId);
      }
      const now = Date.now();
      await ctx.db.patch("offerDocuments", document._id, {
        storageId: undefined,
        rawState: "deleted",
        processingGeneration: document.processingGeneration + 1,
        updatedAt: now,
        rawDeletedAt: now,
      });
      await ctx.db.insert("auditEvents", {
        workspaceId: document.workspaceId,
        actor: "system",
        eventType: "raw_retention_deleted",
        documentId: document._id,
        safeMetadata: { reason: "retention_deadline" },
        createdAt: now,
      });
    }

    const hasMore = due.length > batchSize;
    if (hasMore) await ctx.scheduler.runAfter(0, cleanupDueRef, { limit });
    return { processed: batch.length, hasMore };
  },
});
