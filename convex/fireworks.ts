import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import {
  readFireworksConfig,
  requestFireworksExtraction,
} from "./lib/fireworks";

const onePixelPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export const smoke = internalAction({
  args: {},
  returns: v.object({
    ok: v.literal(true),
    schoolCandidateCount: v.number(),
    lineItemCount: v.number(),
  }),
  handler: async () => {
    const config = readFireworksConfig(process.env);
    const result = await requestFireworksExtraction({
      ...config,
      mimeType: "image/png",
      base64: onePixelPng,
    });
    return {
      ok: true as const,
      schoolCandidateCount: result.schoolCandidates.length,
      lineItemCount: result.offer.lineItems.length,
    };
  },
});
