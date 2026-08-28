import { describe, expect, it } from "vitest";

import {
  inspectStoredFile,
  MAX_FILE_BYTES,
  type ProcessingState,
  validateProcessingTransition,
} from "./fileValidation";

function pdfOfSize(size: number, type = "application/pdf") {
  const start = new TextEncoder().encode("%PDF-1.7\n");
  const end = new TextEncoder().encode("\n%%EOF");
  return new Blob(
    [
      start.buffer,
      new ArrayBuffer(size - start.length - end.length),
      end.buffer,
    ],
    {
      type,
    },
  );
}

function imageOfSize(
  start: Uint8Array,
  end: Uint8Array,
  size: number,
  type: string,
) {
  return new Blob(
    [
      start.buffer as ArrayBuffer,
      new ArrayBuffer(size - start.length - end.length),
      end.buffer as ArrayBuffer,
    ],
    { type },
  );
}

describe("inspectStoredFile", () => {
  it("accepts a PDF at the exact 10 MB limit", async () => {
    const result = await inspectStoredFile(pdfOfSize(MAX_FILE_BYTES));

    expect(result).toMatchObject({
      mimeType: "application/pdf",
      byteSize: MAX_FILE_BYTES,
    });
  });

  it.each([
    [
      "JPEG",
      "image/jpeg",
      Uint8Array.from([0xff, 0xd8, 0xff]),
      Uint8Array.from([0xff, 0xd9]),
    ],
    [
      "PNG",
      "image/png",
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Uint8Array.from([
        0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]),
    ],
  ])(
    "accepts a %s at the exact 10 MB limit",
    async (_label, type, start, end) => {
      const result = await inspectStoredFile(
        imageOfSize(start, end, MAX_FILE_BYTES, type),
      );

      expect(result).toMatchObject({
        mimeType: type,
        byteSize: MAX_FILE_BYTES,
      });
    },
  );

  it("rejects a file one byte over the 10 MB limit", async () => {
    await expect(
      inspectStoredFile(pdfOfSize(MAX_FILE_BYTES + 1)),
    ).rejects.toMatchObject({
      code: "FILE_TOO_LARGE",
      recoverable: true,
    });
  });

  it("rejects bytes whose magic signature does not match the declared MIME type", async () => {
    const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

    await expect(
      inspectStoredFile(new Blob([pngBytes], { type: "application/pdf" })),
    ).rejects.toMatchObject({
      code: "MIME_MISMATCH",
      recoverable: true,
    });
  });

  it("rejects a supported MIME declaration when the bytes have no supported signature", async () => {
    await expect(
      inspectStoredFile(new Blob(["not a PDF"], { type: "application/pdf" })),
    ).rejects.toMatchObject({
      code: "MIME_MISMATCH",
      recoverable: true,
    });
  });

  it("rejects unsupported file types", async () => {
    await expect(
      inspectStoredFile(new Blob(["plain text"], { type: "text/plain" })),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE",
      recoverable: true,
    });
  });

  it("rejects an encrypted PDF with a recoverable error", async () => {
    const encryptedPdf = new Blob(
      ["%PDF-1.7\n1 0 obj<</Encrypt 2 0 R>>\n%%EOF"],
      {
        type: "application/pdf",
      },
    );

    await expect(inspectStoredFile(encryptedPdf)).rejects.toMatchObject({
      code: "ENCRYPTED_PDF",
      recoverable: true,
    });
  });

  it("rejects an unreadable PDF with a different recoverable error", async () => {
    const truncatedPdf = new Blob(["%PDF-1.7\ntruncated"], {
      type: "application/pdf",
    });

    await expect(inspectStoredFile(truncatedPdf)).rejects.toMatchObject({
      code: "UNREADABLE_PDF",
      recoverable: true,
    });
  });

  it("returns the SHA-256 digest of the stored bytes", async () => {
    const result = await inspectStoredFile(
      new Blob(["%PDF-1.7\n%%EOF"], { type: "application/pdf" }),
    );

    expect(result.sha256).toBe(
      "d5db70fbccdd8ccc6a553604b79a09cd33083b401340d546efa08a52142c972e",
    );
  });

  it.each([
    ["JPEG", "image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff, 0x00])],
    [
      "PNG",
      "image/png",
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ],
  ])("rejects a truncated %s image", async (_label, type, bytes) => {
    await expect(
      inspectStoredFile(new Blob([bytes], { type })),
    ).rejects.toMatchObject({
      code: "UNREADABLE_IMAGE",
      recoverable: true,
    });
  });
});

describe("validateProcessingTransition", () => {
  it("allows validation to enter a recoverable failed state", () => {
    expect(() =>
      validateProcessingTransition({
        currentState: "validating",
        nextState: "failed",
        currentGeneration: 3,
        expectedGeneration: 3,
      }),
    ).not.toThrow();
  });

  it.each<[ProcessingState, ProcessingState]>([
    ["received", "validating"],
    ["validating", "extracting"],
    ["validating", "failed"],
    ["extracting", "needs_school_confirmation"],
    ["extracting", "researching"],
    ["extracting", "failed"],
    ["needs_school_confirmation", "researching"],
    ["needs_school_confirmation", "failed"],
    ["researching", "needs_review"],
    ["researching", "ready"],
    ["researching", "failed"],
    ["needs_review", "ready"],
  ])("allows %s -> %s at the current generation", (currentState, nextState) => {
    expect(() =>
      validateProcessingTransition({
        currentState,
        nextState,
        currentGeneration: 4,
        expectedGeneration: 4,
      }),
    ).not.toThrow();
  });

  it("rejects every undocumented transition", () => {
    const states: ProcessingState[] = [
      "received",
      "validating",
      "extracting",
      "needs_school_confirmation",
      "researching",
      "needs_review",
      "ready",
      "failed",
    ];
    const allowed = new Set([
      "received:validating",
      "validating:extracting",
      "validating:failed",
      "extracting:needs_school_confirmation",
      "extracting:researching",
      "extracting:failed",
      "needs_school_confirmation:researching",
      "needs_school_confirmation:failed",
      "researching:needs_review",
      "researching:ready",
      "researching:failed",
      "needs_review:ready",
    ]);

    for (const currentState of states) {
      for (const nextState of states) {
        if (allowed.has(`${currentState}:${nextState}`)) continue;

        expect(() =>
          validateProcessingTransition({
            currentState,
            nextState,
            currentGeneration: 4,
            expectedGeneration: 4,
          }),
        ).toThrowError(
          expect.objectContaining({ code: "INVALID_PROCESSING_TRANSITION" }),
        );
      }
    }
  });

  it("rejects an otherwise valid transition from a stale generation", () => {
    expect(() =>
      validateProcessingTransition({
        currentState: "received",
        nextState: "validating",
        currentGeneration: 5,
        expectedGeneration: 4,
      }),
    ).toThrowError(expect.objectContaining({ code: "STALE_GENERATION" }));
  });

  it("allows an explicit retry from failed to its failed stage", () => {
    expect(() =>
      validateProcessingTransition({
        currentState: "failed",
        nextState: "extracting",
        currentGeneration: 5,
        expectedGeneration: 5,
        explicitRetry: true,
        failedStage: "extracting",
      }),
    ).not.toThrow();
  });

  it.each([undefined, "researching" as const])(
    "rejects an explicit retry whose failed stage is %s",
    (failedStage) => {
      expect(() =>
        validateProcessingTransition({
          currentState: "failed",
          nextState: "extracting",
          currentGeneration: 5,
          expectedGeneration: 5,
          explicitRetry: true,
          failedStage,
        }),
      ).toThrowError(
        expect.objectContaining({ code: "INVALID_PROCESSING_TRANSITION" }),
      );
    },
  );
});
