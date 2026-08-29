"use node";

import { pdf } from "pdf-to-img";

const maxPages = 10;
const maxPageBytes = 3_500_000;
const maxTotalBytes = 7_000_000;

type PdfDocument = {
  length: number;
  getPage(pageNumber: number): Promise<Buffer>;
  destroy(): Promise<void>;
};

type PdfLoader = (
  input: Buffer,
  options: { scale: number },
) => Promise<PdfDocument>;

export function syntheticOfferPdf(): Buffer {
  const content =
    "BT /F1 18 Tf 72 720 Td (AidLens Synthetic Financial Aid Offer) Tj 0 -30 Td /F1 14 Tf (Tuition and Fees: $25,000) Tj 0 -24 Td (University Grant: $10,000) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(body);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "ascii");
}

export async function renderPdfPages(
  input: Buffer,
  load: PdfLoader = pdf,
): Promise<string[]> {
  const document = await load(input, { scale: 2 });
  try {
    if (document.length > maxPages) throw new Error("PDF_PAGE_LIMIT_EXCEEDED");
    const pages: string[] = [];
    let totalBytes = 0;
    for (let pageNumber = 1; pageNumber <= document.length; pageNumber++) {
      const page = await document.getPage(pageNumber);
      if (page.byteLength > maxPageBytes)
        throw new Error("PDF_PAGE_IMAGE_TOO_LARGE");
      totalBytes += page.byteLength;
      if (totalBytes > maxTotalBytes)
        throw new Error("PDF_RENDERED_IMAGES_TOO_LARGE");
      pages.push(page.toString("base64"));
    }
    return pages;
  } finally {
    await document.destroy();
  }
}
