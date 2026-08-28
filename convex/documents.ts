import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  getActiveWorkspaceForGeneration,
  NOT_FOUND,
  requireActiveWorkspace,
} from "./lib/auth";
import {
  FileValidationError,
  inspectStoredFile,
  validateProcessingTransition,
} from "./lib/fileValidation";

const RAW_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ORPHAN_GRACE_MS = 60 * 60 * 1000;
function safeFileName(fileName: string) {
  const normalized = fileName.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 255 ||
    Array.from(normalized).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    throw new Error("Invalid file name");
  }
  return normalized;
}
const validationArgs = {
  workspaceId: v.id("workspaces"),
  workspaceGeneration: v.number(),
  documentId: v.id("offerDocuments"),
  processingGeneration: v.number(),
  retry: v.optional(v.boolean()),
};
type ValidationArgs = {
  workspaceId: import("./_generated/dataModel").Id<"workspaces">;
  workspaceGeneration: number;
  documentId: import("./_generated/dataModel").Id<"offerDocuments">;
  processingGeneration: number;
  retry?: boolean;
};
const validateUploadedFileRef = makeFunctionReference<"action", ValidationArgs>(
  "documents:validateUploadedFile",
);
const beginValidationRef = makeFunctionReference<"mutation", ValidationArgs>(
  "documents:beginValidation",
);
const completeValidationRef = makeFunctionReference<
  "mutation",
  ValidationArgs & {
    result:
      | {
          status: "valid";
          mimeType: "application/pdf" | "image/jpeg" | "image/png";
          byteSize: number;
          sha256: string;
        }
      | { status: "failed"; errorCode: string; errorMessage: string };
  }
>("documents:completeValidation");
const cleanupOrphanStorageRef = makeFunctionReference<
  "mutation",
  { storageId: import("./_generated/dataModel").Id<"_storage"> }
>("documents:cleanupOrphanStorage");

export const generateUploadUrl = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireActiveWorkspace(ctx, workspaceId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const finalizeUpload = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, { workspaceId, storageId, fileName }) => {
    const workspace = await requireActiveWorkspace(ctx, workspaceId);
    const metadata = await ctx.db.system.get("_storage", storageId);
    if (!metadata) throw new Error("Uploaded file not found");
    try {
      fileName = safeFileName(fileName);
    } catch {
      await ctx.storage.delete(storageId);
      return {
        status: "rejected" as const,
        errorCode: "INVALID_FILE_NAME" as const,
      };
    }
    const existing = await ctx.db
      .query("offerDocuments")
      .withIndex("by_workspaceId_sha256", (index) =>
        index.eq("workspaceId", workspaceId).eq("sha256", metadata.sha256),
      )
      .first();
    if (existing) {
      await ctx.scheduler.runAfter(ORPHAN_GRACE_MS, cleanupOrphanStorageRef, {
        storageId,
      });
      return {
        status: "duplicate" as const,
        existingDocumentId: existing._id,
      };
    }
    const now = Date.now();
    const documentId = await ctx.db.insert("offerDocuments", {
      workspaceId,
      storageId,
      fileName,
      mimeType: metadata.contentType ?? "application/octet-stream",
      byteSize: metadata.size,
      sha256: metadata.sha256,
      sourceRoute: "upload",
      retentionDeadline: now + RAW_RETENTION_MS,
      rawState: "present",
      processingState: "received",
      processingGeneration: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, validateUploadedFileRef, {
      workspaceId,
      workspaceGeneration: workspace.generation,
      documentId,
      processingGeneration: 0,
    });
    return { status: "created" as const, documentId };
  },
});

export const cleanupOrphanStorage = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const attached = await ctx.db
      .query("offerDocuments")
      .withIndex("by_storageId", (query) => query.eq("storageId", storageId))
      .first();
    if (attached) return false;
    await ctx.storage.delete(storageId);
    return true;
  },
});

export const resolveDuplicate = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    existingDocumentId: v.id("offerDocuments"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    choice: v.union(
      v.literal("replace"),
      v.literal("keep_new"),
      v.literal("cancel"),
    ),
  },
  handler: async (
    ctx,
    { workspaceId, existingDocumentId, storageId, fileName, choice },
  ) => {
    const workspace = await requireActiveWorkspace(ctx, workspaceId);
    fileName = safeFileName(fileName);
    const existing = await ctx.db.get("offerDocuments", existingDocumentId);
    const metadata = await ctx.db.system.get("_storage", storageId);
    if (
      !existing ||
      existing.workspaceId !== workspaceId ||
      !metadata ||
      metadata.sha256 !== existing.sha256
    ) {
      throw new Error(NOT_FOUND);
    }
    if (choice === "cancel") {
      await ctx.storage.delete(storageId);
      return { status: "cancelled" as const, documentId: existingDocumentId };
    }
    const now = Date.now();
    if (choice === "keep_new") {
      const documentId = await ctx.db.insert("offerDocuments", {
        workspaceId,
        storageId,
        fileName,
        mimeType: metadata.contentType ?? "application/octet-stream",
        byteSize: metadata.size,
        sha256: metadata.sha256,
        sourceRoute: "upload",
        retentionDeadline: now + RAW_RETENTION_MS,
        rawState: "present",
        processingState: "received",
        processingGeneration: 0,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, validateUploadedFileRef, {
        workspaceId,
        workspaceGeneration: workspace.generation,
        documentId,
        processingGeneration: 0,
      });
      return { status: "created" as const, documentId };
    }
    if (existing.storageId && existing.storageId !== storageId) {
      await ctx.storage.delete(existing.storageId);
    }
    await ctx.db.patch("offerDocuments", existingDocumentId, {
      storageId,
      fileName,
      mimeType: metadata.contentType ?? "application/octet-stream",
      byteSize: metadata.size,
      retentionDeadline: now + RAW_RETENTION_MS,
      rawState: "present",
      processingState: "received",
      processingGeneration: existing.processingGeneration + 1,
      failedStage: undefined,
      errorCode: undefined,
      errorMessage: undefined,
      updatedAt: now,
      rawDeletedAt: undefined,
    });
    await ctx.scheduler.runAfter(0, validateUploadedFileRef, {
      workspaceId,
      workspaceGeneration: workspace.generation,
      documentId: existingDocumentId,
      processingGeneration: existing.processingGeneration + 1,
    });
    return { status: "replaced" as const, documentId: existingDocumentId };
  },
});

export const getDocument = query({
  args: { documentId: v.id("offerDocuments") },
  handler: async (ctx, { documentId }) => {
    const document = await ctx.db.get("offerDocuments", documentId);
    if (!document) throw new Error(NOT_FOUND);
    await requireActiveWorkspace(ctx, document.workspaceId);
    const { storageId: _storageId, sha256: _sha256, ...summary } = document;
    return summary;
  },
});

export const listDocuments = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireActiveWorkspace(ctx, workspaceId);
    const documents = await ctx.db
      .query("offerDocuments")
      .withIndex("by_workspaceId", (index) =>
        index.eq("workspaceId", workspaceId),
      )
      .collect();
    return documents.map(
      ({ storageId: _storageId, sha256: _sha256, ...summary }) => summary,
    );
  },
});

export const getPreviewFile = internalQuery({
  args: { documentId: v.id("offerDocuments") },
  handler: async (ctx, { documentId }) => {
    const document = await ctx.db.get("offerDocuments", documentId);
    if (!document) throw new Error(NOT_FOUND);
    await requireActiveWorkspace(ctx, document.workspaceId);
    if (document.rawState !== "present" || !document.storageId) {
      throw new Error(NOT_FOUND);
    }
    return {
      storageId: document.storageId,
      mimeType: document.mimeType,
      fileName: document.fileName,
    };
  },
});

export const deleteRaw = mutation({
  args: { documentId: v.id("offerDocuments") },
  handler: async (ctx, { documentId }) => {
    const document = await ctx.db.get("offerDocuments", documentId);
    if (!document) throw new Error(NOT_FOUND);
    await requireActiveWorkspace(ctx, document.workspaceId);
    if (document.rawState === "deleted") {
      return { status: "already_deleted" as const };
    }
    if (document.storageId) await ctx.storage.delete(document.storageId);
    const now = Date.now();
    await ctx.db.patch("offerDocuments", documentId, {
      storageId: undefined,
      rawState: "deleted",
      processingGeneration: document.processingGeneration + 1,
      updatedAt: now,
      rawDeletedAt: now,
    });
    return { status: "deleted" as const };
  },
});

export const retryValidation = mutation({
  args: { documentId: v.id("offerDocuments") },
  handler: async (ctx, { documentId }) => {
    const document = await ctx.db.get("offerDocuments", documentId);
    if (!document) throw new Error(NOT_FOUND);
    const workspace = await requireActiveWorkspace(ctx, document.workspaceId);
    if (
      document.rawState !== "present" ||
      !document.storageId ||
      document.processingState !== "failed" ||
      document.failedStage !== "validating"
    ) {
      throw new Error("Validation retry unavailable");
    }
    const processingGeneration = document.processingGeneration + 1;
    await ctx.db.patch("offerDocuments", documentId, {
      processingGeneration,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, validateUploadedFileRef, {
      workspaceId: workspace._id,
      workspaceGeneration: workspace.generation,
      documentId,
      processingGeneration,
      retry: true,
    });
    return { status: "scheduled" as const };
  },
});

export const beginValidation = internalMutation({
  args: validationArgs,
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
      document.rawState !== "present" ||
      !document.storageId ||
      document.processingGeneration !== args.processingGeneration
    ) {
      return null;
    }
    validateProcessingTransition({
      currentState: document.processingState,
      nextState: "validating",
      currentGeneration: document.processingGeneration,
      expectedGeneration: args.processingGeneration,
      explicitRetry: args.retry,
      failedStage:
        document.failedStage === "validating" ||
        document.failedStage === "extracting" ||
        document.failedStage === "researching"
          ? document.failedStage
          : undefined,
    });
    await ctx.db.patch("offerDocuments", document._id, {
      processingState: "validating",
      updatedAt: Date.now(),
    });
    return { storageId: document.storageId };
  },
});

export const completeValidation = internalMutation({
  args: {
    ...validationArgs,
    result: v.union(
      v.object({
        status: v.literal("valid"),
        mimeType: v.union(
          v.literal("application/pdf"),
          v.literal("image/jpeg"),
          v.literal("image/png"),
        ),
        byteSize: v.number(),
        sha256: v.string(),
      }),
      v.object({
        status: v.literal("failed"),
        errorCode: v.string(),
        errorMessage: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (
      !(await getActiveWorkspaceForGeneration(
        ctx,
        args.workspaceId,
        args.workspaceGeneration,
      ))
    ) {
      return false;
    }
    const document = await ctx.db.get("offerDocuments", args.documentId);
    if (
      !document ||
      document.workspaceId !== args.workspaceId ||
      document.rawState !== "present" ||
      document.processingGeneration !== args.processingGeneration ||
      document.processingState !== "validating"
    ) {
      return false;
    }
    const now = Date.now();
    if (args.result.status === "failed") {
      validateProcessingTransition({
        currentState: document.processingState,
        nextState: "failed",
        currentGeneration: document.processingGeneration,
        expectedGeneration: args.processingGeneration,
      });
      await ctx.db.patch("offerDocuments", document._id, {
        processingState: "failed",
        failedStage: "validating",
        errorCode: args.result.errorCode,
        errorMessage: args.result.errorMessage,
        updatedAt: now,
      });
      return true;
    }
    validateProcessingTransition({
      currentState: document.processingState,
      nextState: "extracting",
      currentGeneration: document.processingGeneration,
      expectedGeneration: args.processingGeneration,
    });
    await ctx.db.patch("offerDocuments", document._id, {
      mimeType: args.result.mimeType,
      byteSize: args.result.byteSize,
      sha256: args.result.sha256,
      processingState: "extracting",
      failedStage: undefined,
      errorCode: undefined,
      errorMessage: undefined,
      updatedAt: now,
    });
    return true;
  },
});

const processingState = v.union(
  v.literal("received"),
  v.literal("validating"),
  v.literal("extracting"),
  v.literal("needs_school_confirmation"),
  v.literal("researching"),
  v.literal("needs_review"),
  v.literal("ready"),
  v.literal("failed"),
);

export const advanceProcessing = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    workspaceGeneration: v.number(),
    documentId: v.id("offerDocuments"),
    expectedGeneration: v.number(),
    nextState: processingState,
  },
  handler: async (ctx, args) => {
    if (
      !(await getActiveWorkspaceForGeneration(
        ctx,
        args.workspaceId,
        args.workspaceGeneration,
      ))
    ) {
      return false;
    }
    const document = await ctx.db.get("offerDocuments", args.documentId);
    if (!document || document.workspaceId !== args.workspaceId) return false;
    validateProcessingTransition({
      currentState: document.processingState,
      nextState: args.nextState,
      currentGeneration: document.processingGeneration,
      expectedGeneration: args.expectedGeneration,
    });
    await ctx.db.patch("offerDocuments", document._id, {
      processingState: args.nextState,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const validateUploadedFile = internalAction({
  args: validationArgs,
  handler: async (ctx, args) => {
    const started = await ctx.runMutation(beginValidationRef, args);
    if (!started) return { status: "stale" as const };
    const blob = await ctx.storage.get(started.storageId);
    if (!blob) {
      await ctx.runMutation(completeValidationRef, {
        ...args,
        result: {
          status: "failed",
          errorCode: "FILE_NOT_FOUND",
          errorMessage: "The uploaded file is no longer available.",
        },
      });
      return { status: "failed" as const };
    }
    try {
      const inspected = await inspectStoredFile(blob);
      await ctx.runMutation(completeValidationRef, {
        ...args,
        result: { status: "valid", ...inspected },
      });
      return { status: "valid" as const };
    } catch (error) {
      if (!(error instanceof FileValidationError)) throw error;
      await ctx.runMutation(completeValidationRef, {
        ...args,
        result: {
          status: "failed",
          errorCode: error.code,
          errorMessage: error.message,
        },
      });
      return { status: "failed" as const };
    }
  },
});
