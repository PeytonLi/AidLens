export const MAX_FILE_BYTES = 10_000_000;

export type SupportedMimeType = "application/pdf" | "image/jpeg" | "image/png";

export type ProcessingState =
  | "received"
  | "validating"
  | "extracting"
  | "needs_school_confirmation"
  | "researching"
  | "needs_review"
  | "ready"
  | "failed";

type ProcessingTransitionInput = {
  currentState: ProcessingState;
  nextState: ProcessingState;
  currentGeneration: number;
  expectedGeneration: number;
  explicitRetry?: boolean;
  failedStage?: "validating" | "extracting" | "researching";
};

const allowedProcessingTransitions: Record<
  ProcessingState,
  readonly ProcessingState[]
> = {
  received: ["validating"],
  validating: ["extracting", "failed"],
  extracting: ["needs_school_confirmation", "researching", "failed"],
  needs_school_confirmation: ["researching", "failed"],
  researching: ["needs_review", "ready", "failed"],
  needs_review: ["ready"],
  ready: [],
  failed: [],
};

export class ProcessingTransitionError extends Error {
  constructor(
    readonly code: "INVALID_PROCESSING_TRANSITION" | "STALE_GENERATION",
  ) {
    super(
      code === "STALE_GENERATION"
        ? "The document changed before this work completed."
        : "The document cannot move to that processing state.",
    );
    this.name = "ProcessingTransitionError";
  }
}

export function validateProcessingTransition(input: ProcessingTransitionInput) {
  if (input.currentGeneration !== input.expectedGeneration) {
    throw new ProcessingTransitionError("STALE_GENERATION");
  }
  if (
    input.currentState === "failed" &&
    input.explicitRetry &&
    input.failedStage === input.nextState
  ) {
    return;
  }
  if (
    !allowedProcessingTransitions[input.currentState].includes(input.nextState)
  ) {
    throw new ProcessingTransitionError("INVALID_PROCESSING_TRANSITION");
  }
}

type FileValidationErrorCode =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "MIME_MISMATCH"
  | "ENCRYPTED_PDF"
  | "UNREADABLE_PDF"
  | "UNREADABLE_IMAGE";

const errorMessages: Record<FileValidationErrorCode, string> = {
  FILE_TOO_LARGE: "The file is larger than 10 MB.",
  UNSUPPORTED_FILE_TYPE: "Use a PDF, JPEG, or PNG file.",
  MIME_MISMATCH: "The file contents do not match its declared type.",
  ENCRYPTED_PDF: "Remove the PDF password and try again.",
  UNREADABLE_PDF: "The PDF could not be read. Export a new copy and try again.",
  UNREADABLE_IMAGE:
    "The image could not be read. Export a new copy and try again.",
};

const supportedMimeTypes: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

export class FileValidationError extends Error {
  readonly recoverable = true;

  constructor(readonly code: FileValidationErrorCode) {
    super(errorMessages[code]);
    this.name = "FileValidationError";
  }
}

export async function inspectStoredFile(blob: Blob) {
  if (blob.size > MAX_FILE_BYTES) {
    throw new FileValidationError("FILE_TOO_LARGE");
  }
  if (!supportedMimeTypes.includes(blob.type)) {
    throw new FileValidationError("UNSUPPORTED_FILE_TYPE");
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mimeType = detectMimeType(bytes);
  if (!mimeType || mimeType !== blob.type) {
    throw new FileValidationError("MIME_MISMATCH");
  }
  if (mimeType === "application/pdf") {
    const pdfText = new TextDecoder().decode(bytes);
    if (/\/Encrypt\b/.test(pdfText))
      throw new FileValidationError("ENCRYPTED_PDF");
    if (!/%%EOF[\0\t\n\f\r ]*$/.test(pdfText)) {
      throw new FileValidationError("UNREADABLE_PDF");
    }
  }
  if (mimeType === "image/jpeg" && !endsWith(bytes, [0xff, 0xd9])) {
    throw new FileValidationError("UNREADABLE_IMAGE");
  }
  if (
    mimeType === "image/png" &&
    !endsWith(
      bytes,
      [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82],
    )
  ) {
    throw new FileValidationError("UNREADABLE_IMAGE");
  }

  return {
    mimeType,
    byteSize: blob.size,
    sha256: Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join(""),
  };
}

function detectMimeType(bytes: Uint8Array): SupportedMimeType | undefined {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return "application/pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function endsWith(bytes: Uint8Array, signature: number[]) {
  const offset = bytes.length - signature.length;
  return (
    offset >= 0 &&
    signature.every((byte, index) => bytes[offset + index] === byte)
  );
}
