"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import {
  readFireworksConfig,
  requestFireworksExtraction,
} from "./lib/fireworks";
import { renderPdfPages, syntheticOfferPdf } from "./lib/pdfRendering";

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
