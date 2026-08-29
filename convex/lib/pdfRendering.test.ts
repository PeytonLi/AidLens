import { expect, it, vi } from "vitest";
import { renderPdfPages, syntheticOfferPdf } from "./pdfRendering";

it("S5.1: renders the synthetic offer smoke fixture as PNG", async () => {
  const [page] = await renderPdfPages(syntheticOfferPdf());
  expect(Buffer.from(page, "base64").subarray(1, 4).toString()).toBe("PNG");
});

it("S5.1: renders bounded PDF pages and destroys the document", async () => {
  const destroy = vi.fn();
  const load = vi.fn().mockResolvedValue({
    length: 2,
    getPage: vi
      .fn()
      .mockResolvedValueOnce(Buffer.from("page-one"))
      .mockResolvedValueOnce(Buffer.from("page-two")),
    destroy,
  });

  await expect(renderPdfPages(Buffer.from("pdf"), load)).resolves.toEqual([
    Buffer.from("page-one").toString("base64"),
    Buffer.from("page-two").toString("base64"),
  ]);
  expect(load).toHaveBeenCalledWith(expect.any(Buffer), { scale: 2 });
  expect(destroy).toHaveBeenCalledOnce();
});

it("S5.1: rejects PDFs above the page limit before rendering", async () => {
  const destroy = vi.fn();
  const getPage = vi.fn();
  const load = vi.fn().mockResolvedValue({ length: 11, getPage, destroy });

  await expect(renderPdfPages(Buffer.from("pdf"), load)).rejects.toThrow(
    "PDF_PAGE_LIMIT_EXCEEDED",
  );
  expect(getPage).not.toHaveBeenCalled();
  expect(destroy).toHaveBeenCalledOnce();
});

it("S5.1: rejects rendered pages too large for Fireworks image input", async () => {
  const destroy = vi.fn();
  const load = vi.fn().mockResolvedValue({
    length: 1,
    getPage: vi.fn().mockResolvedValue(Buffer.alloc(3_500_001)),
    destroy,
  });

  await expect(renderPdfPages(Buffer.from("pdf"), load)).rejects.toThrow(
    "PDF_PAGE_IMAGE_TOO_LARGE",
  );
  expect(destroy).toHaveBeenCalledOnce();
});
