"use node";

import { renderPdfPages } from "./pdfRendering";

type SupportedMimeType = "application/pdf" | "image/jpeg" | "image/png";

export async function blobToVisionInput(
  blob: Blob,
  mimeType: SupportedMimeType,
  render: typeof renderPdfPages = renderPdfPages,
): Promise<{
  mimeType: "image/jpeg" | "image/png";
  base64: string | string[];
}> {
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (mimeType === "application/pdf") {
    return { mimeType: "image/png", base64: await render(bytes) };
  }
  return { mimeType, base64: bytes.toString("base64") };
}
