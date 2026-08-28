import { useEffect, useRef, useState, type ChangeEvent } from "react";

const MAX_FILE_BYTES = 10_000_000;
const SUPPORTED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export type DuplicateChoice = "replace" | "new-version" | "cancel";

export interface DuplicateOffer {
  filename: string;
  currentOfferName: string;
}

export type ProcessingState =
  | "received"
  | "validating"
  | "extracting"
  | "needs_school_confirmation"
  | "researching"
  | "needs_review"
  | "ready"
  | "failed";

export interface UploadItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  processingState: ProcessingState;
  updatedAtLabel: string;
  errorMessage?: string;
  requiredAction?: string;
  previewState?: "available" | "unavailable";
  privatePreviewUrl?: string;
  retainedExcerpt?: string;
  rawDeletedAtLabel?: string;
  rawAvailable?: boolean;
}

const STATUS_LABELS: Record<ProcessingState, string> = {
  received: "Received",
  validating: "Checking file",
  extracting: "Ready for extraction",
  needs_school_confirmation: "Needs school confirmation",
  researching: "Researching official sources",
  needs_review: "Ready for review",
  ready: "Reviewed",
  failed: "Processing failed",
};

export interface UploadOfferPanelProps {
  onUpload: (file: File) => void | Promise<void>;
  uploads?: UploadItem[];
  duplicate?: DuplicateOffer;
  onDuplicateChoice?: (choice: DuplicateChoice) => void;
  onRetry?: (uploadId: string) => void | Promise<void>;
  onDeleteRaw?: (uploadId: string) => void | Promise<void>;
}

export default function UploadOfferPanel({
  onUpload,
  uploads = [],
  duplicate,
  onDuplicateChoice,
  onRetry,
  onDeleteRaw,
}: UploadOfferPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File>();
  const [fileError, setFileError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const hadDuplicate = useRef(false);

  useEffect(() => {
    if (duplicate) firstChoiceRef.current?.focus();
    else if (hadDuplicate.current) inputRef.current?.focus();
    hadDuplicate.current = Boolean(duplicate);
  }, [duplicate]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!SUPPORTED_FILE_TYPES.has(file.type)) {
      setSelectedFile(undefined);
      setFileError("Choose a PDF, JPEG, or PNG file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setSelectedFile(undefined);
      setFileError("Choose a file no larger than 10 MB.");
      return;
    }
    setFileError(undefined);
    setSelectedFile(file);
    try {
      await onUpload(file);
    } catch {
      setFileError("Upload interrupted. Try again.");
    }
  }

  return (
    <section className="upload-panel" aria-label="Offer upload">
      <h2>Upload an offer</h2>
      <p>
        Before uploading, redact Social Security numbers and bank account
        details.
      </p>
      <label className="file-picker">
        Upload an offer
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(event) => void handleFile(event)}
        />
      </label>
      {fileError ? <p role="alert">{fileError}</p> : null}
      {selectedFile ? (
        <p className="selected-file">
          <strong>{selectedFile.name}</strong>
          <span>
            {selectedFile.type} · {selectedFile.size} B
          </span>
        </p>
      ) : null}
      {uploads.length ? (
        <div className="upload-list" aria-label="Processing offers">
          {uploads.map((upload) => (
            <article
              className="upload-card"
              key={upload.id}
              data-testid={`processing-status-${upload.id}`}
            >
              <h3>{upload.filename}</h3>
              <p>
                {upload.mimeType} · {upload.sizeBytes} B
              </p>
              <p>{STATUS_LABELS[upload.processingState]}</p>
              <p>{upload.updatedAtLabel}</p>
              {upload.requiredAction ? <p>{upload.requiredAction}</p> : null}
              {upload.errorMessage ? (
                <p role="alert">{upload.errorMessage}</p>
              ) : null}
              {upload.privatePreviewUrl &&
              upload.previewState !== "unavailable" ? (
                <iframe
                  title={`${upload.filename} preview`}
                  src={upload.privatePreviewUrl}
                />
              ) : upload.previewState === "unavailable" ||
                upload.retainedExcerpt ? (
                <section aria-label={`${upload.filename} retained preview`}>
                  <h4>Preview unavailable</h4>
                  {upload.retainedExcerpt ? (
                    <p>{upload.retainedExcerpt}</p>
                  ) : null}
                  {upload.rawDeletedAtLabel ? (
                    <p>{upload.rawDeletedAtLabel}</p>
                  ) : null}
                </section>
              ) : null}
              {upload.processingState === "failed" && onRetry ? (
                <button type="button" onClick={() => void onRetry(upload.id)}>
                  Retry {upload.filename}
                </button>
              ) : null}
              {upload.rawAvailable && onDeleteRaw ? (
                <button
                  type="button"
                  onClick={() => void onDeleteRaw(upload.id)}
                >
                  Delete raw {upload.filename}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {uploads
          .map(
            (upload) =>
              `${upload.filename}: ${STATUS_LABELS[upload.processingState]}.${upload.errorMessage ? ` ${upload.errorMessage}` : ""}`,
          )
          .join(" ")}
      </p>
      {duplicate ? (
        <div
          className="duplicate-dialog"
          role="dialog"
          aria-label="Duplicate offer"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onDuplicateChoice?.("cancel");
            }
          }}
        >
          <h3>Duplicate offer</h3>
          <p>
            {duplicate.filename} matches the current{" "}
            {duplicate.currentOfferName}
            offer.
          </p>
          <button
            ref={firstChoiceRef}
            type="button"
            onClick={() => onDuplicateChoice?.("replace")}
          >
            Replace current offer
          </button>
          <button
            type="button"
            onClick={() => onDuplicateChoice?.("new-version")}
          >
            Keep as new version
          </button>
          <button type="button" onClick={() => onDuplicateChoice?.("cancel")}>
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  );
}
