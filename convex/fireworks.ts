"use node";

import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import {
  readFireworksConfig,
  requestFireworksExtraction,
  requestFireworksExtractionWithRetry,
} from "./lib/fireworks";
import { blobToVisionInput } from "./lib/extractionPipeline";
import { renderPdfPages, syntheticOfferPdf } from "./lib/pdfRendering";

type ExtractionArgs = {
  workspaceId: Id<"workspaces">;
  workspaceGeneration: number;
  documentId: Id<"offerDocuments">;
  processingGeneration: number;
  attempt: number;
};
type Source = {
  storageId: Id<"_storage">;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
} | null;
const getSourceRef = makeFunctionReference<
  "query",
  Omit<ExtractionArgs, "attempt">,
  Source
>("extractions:getSource");
const commitRef = makeFunctionReference<
  "mutation",
  Omit<ExtractionArgs, "attempt"> & { result: unknown }
>("extractions:commit");
const recordFailureRef = makeFunctionReference<
  "mutation",
  ExtractionArgs,
  { status: "retrying" | "failed" | "stale" }
>("extractions:recordFailure");

export const extractDocument = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    workspaceGeneration: v.number(),
    documentId: v.id("offerDocuments"),
    processingGeneration: v.number(),
    attempt: v.number(),
  },
  returns: v.union(
    v.object({ status: v.literal("created"), offerId: v.id("offers") }),
    v.object({ status: v.literal("duplicate"), offerId: v.id("offers") }),
    v.object({ status: v.literal("retrying") }),
    v.object({ status: v.literal("failed") }),
    v.object({ status: v.literal("stale") }),
    v.object({ status: v.literal("not_configured") }),
  ),
  handler: async (ctx, args) => {
    if (!process.env.FIREWORKS_API_KEY || !process.env.FIREWORKS_MODEL) {
      return { status: "not_configured" as const };
    }
    const sourceArgs = {
      workspaceId: args.workspaceId,
      workspaceGeneration: args.workspaceGeneration,
      documentId: args.documentId,
      processingGeneration: args.processingGeneration,
    };
    const source: Source = await ctx.runQuery(getSourceRef, sourceArgs);
    if (!source) return { status: "stale" as const };
    const blob = await ctx.storage.get(source.storageId);
    if (!blob) return await ctx.runMutation(recordFailureRef, args);
    try {
      const config = readFireworksConfig(process.env);
      const vision = await blobToVisionInput(blob, source.mimeType);
      const result = await requestFireworksExtractionWithRetry({
        ...config,
        ...vision,
      });
      return await ctx.runMutation(commitRef, { ...sourceArgs, result });
    } catch {
      return await ctx.runMutation(recordFailureRef, args);
    }
  },
});

export const smoke = internalAction({
  args: {},
  returns: v.object({
    ok: v.literal(true),
    schoolCandidateCount: v.number(),
    lineItemCount: v.number(),
  }),
  handler: async () => {
    const config = readFireworksConfig(process.env);
    const pages = await renderPdfPages(syntheticOfferPdf());
    const result = await requestFireworksExtraction({
      ...config,
      mimeType: "image/png",
      base64: pages,
    });
    return {
      ok: true as const,
      schoolCandidateCount: result.schoolCandidates.length,
      lineItemCount: result.offer.lineItems.length,
    };
  },
});
