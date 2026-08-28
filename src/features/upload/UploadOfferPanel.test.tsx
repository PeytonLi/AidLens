import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import UploadOfferPanel from "./UploadOfferPanel";

it("S4.13: accepts a supported offer and explains redaction before upload", async () => {
  const user = userEvent.setup();
  const onUpload = vi.fn();
  render(<UploadOfferPanel onUpload={onUpload} />);

  expect(screen.getByText(/redact.*social security/i)).toBeInTheDocument();

  const input = screen.getByLabelText("Upload an offer");
  expect(input).toHaveAttribute(
    "accept",
    "application/pdf,image/jpeg,image/png",
  );

  const file = new File(["offer"], "award.pdf", {
    type: "application/pdf",
  });
  await user.upload(input, file);

  expect(onUpload).toHaveBeenCalledWith(file);
  expect(screen.getByText("award.pdf")).toBeInTheDocument();
  expect(screen.getByText("application/pdf · 5 B")).toBeInTheDocument();
});

it("S4.13: rejects files larger than 10 MB before upload", async () => {
  const user = userEvent.setup();
  const onUpload = vi.fn();
  render(<UploadOfferPanel onUpload={onUpload} />);

  await user.upload(
    screen.getByLabelText("Upload an offer"),
    new File(["old"], "old.pdf", { type: "application/pdf" }),
  );
  expect(screen.getByText("old.pdf")).toBeInTheDocument();

  const file = new File([new Uint8Array(10_000_001)], "large.pdf", {
    type: "application/pdf",
  });
  await user.upload(screen.getByLabelText("Upload an offer"), file);

  expect(onUpload).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("old.pdf")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Choose a file no larger than 10 MB.",
  );
});

it("S4.13: rejects unsupported file types before upload", async () => {
  const user = userEvent.setup({ applyAccept: false });
  const onUpload = vi.fn();
  render(<UploadOfferPanel onUpload={onUpload} />);

  await user.upload(
    screen.getByLabelText("Upload an offer"),
    new File(["offer"], "award.txt", { type: "text/plain" }),
  );

  expect(onUpload).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Choose a PDF, JPEG, or PNG file.",
  );
});

it("S4.8: contains an interrupted upload and leaves a recoverable message", async () => {
  const user = userEvent.setup();
  const onUpload = vi.fn().mockRejectedValue(new Error("offline"));
  render(<UploadOfferPanel onUpload={onUpload} />);

  await user.upload(
    screen.getByLabelText("Upload an offer"),
    new File(["offer"], "award.pdf", { type: "application/pdf" }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Upload interrupted. Try again.",
  );
  expect(screen.getByText("award.pdf")).toBeInTheDocument();
});

it("S4.6: replaces the current offer when chosen from the duplicate dialog", async () => {
  const user = userEvent.setup();
  const onDuplicateChoice = vi.fn();
  render(
    <UploadOfferPanel
      onUpload={vi.fn()}
      duplicate={{
        filename: "award.pdf",
        currentOfferName: "UC San Diego",
      }}
      onDuplicateChoice={onDuplicateChoice}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "Duplicate offer" });
  expect(dialog).toHaveTextContent("award.pdf");
  expect(dialog).toHaveTextContent("UC San Diego");
  await user.click(
    screen.getByRole("button", { name: "Replace current offer" }),
  );

  expect(onDuplicateChoice).toHaveBeenCalledWith("replace");
});

it("S4.6: keeps a duplicate as a new version when chosen", async () => {
  const user = userEvent.setup();
  const onDuplicateChoice = vi.fn();
  render(
    <UploadOfferPanel
      onUpload={vi.fn()}
      duplicate={{ filename: "award.pdf", currentOfferName: "UC San Diego" }}
      onDuplicateChoice={onDuplicateChoice}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Keep as new version" }));

  expect(onDuplicateChoice).toHaveBeenCalledWith("new-version");
});

it("S4.6: cancels duplicate handling without replacing or versioning", async () => {
  const user = userEvent.setup();
  const onDuplicateChoice = vi.fn();
  render(
    <UploadOfferPanel
      onUpload={vi.fn()}
      duplicate={{ filename: "award.pdf", currentOfferName: "UC San Diego" }}
      onDuplicateChoice={onDuplicateChoice}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onDuplicateChoice).toHaveBeenCalledWith("cancel");
});

it("S4.13: moves focus into the duplicate dialog and returns it after close", () => {
  const props = { onUpload: vi.fn(), onDuplicateChoice: vi.fn() };
  const { rerender } = render(<UploadOfferPanel {...props} />);
  const input = screen.getByLabelText("Upload an offer");
  input.focus();

  rerender(
    <UploadOfferPanel
      {...props}
      duplicate={{ filename: "award.pdf", currentOfferName: "UC San Diego" }}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Replace current offer" }),
  ).toHaveFocus();

  rerender(<UploadOfferPanel {...props} />);
  expect(input).toHaveFocus();
});

it("S4.13: lets a keyboard user cancel the duplicate dialog with Escape", async () => {
  const user = userEvent.setup();
  const onDuplicateChoice = vi.fn();
  render(
    <UploadOfferPanel
      onUpload={vi.fn()}
      duplicate={{ filename: "award.pdf", currentOfferName: "UC San Diego" }}
      onDuplicateChoice={onDuplicateChoice}
    />,
  );

  await user.keyboard("{Escape}");

  expect(onDuplicateChoice).toHaveBeenCalledWith("cancel");
});

it("S4.8: renders reactive processing transitions and announces each state", () => {
  const item = {
    id: "doc-1",
    filename: "award.pdf",
    mimeType: "application/pdf",
    sizeBytes: 5,
    updatedAtLabel: "Updated just now",
  } as const;
  const { rerender } = render(
    <UploadOfferPanel
      onUpload={vi.fn()}
      uploads={[{ ...item, processingState: "received" }]}
    />,
  );

  expect(screen.getByText("Received")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("award.pdf: Received.");

  rerender(
    <UploadOfferPanel
      onUpload={vi.fn()}
      uploads={[{ ...item, processingState: "validating" }]}
    />,
  );
  expect(screen.getByText("Checking file")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(
    "award.pdf: Checking file.",
  );

  rerender(
    <UploadOfferPanel
      onUpload={vi.fn()}
      uploads={[{ ...item, processingState: "extracting" }]}
    />,
  );
  expect(screen.getByText("Ready for extraction")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(
    "award.pdf: Ready for extraction.",
  );
});

it("S4.13: replaces a failed private preview with the retained excerpt", () => {
  render(
    <UploadOfferPanel
      onUpload={vi.fn()}
      uploads={[
        {
          id: "doc-1",
          filename: "award.pdf",
          mimeType: "application/pdf",
          sizeBytes: 5,
          processingState: "needs_review",
          updatedAtLabel: "Updated just now",
          previewState: "unavailable",
          privatePreviewUrl: "/private/documents/doc-1",
          retainedExcerpt: "Estimated grant: $25,000",
          rawDeletedAtLabel: "Raw file deleted August 27, 2026",
        },
      ]}
    />,
  );

  expect(screen.queryByTitle("award.pdf preview")).not.toBeInTheDocument();
  expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
  expect(screen.getByText("Estimated grant: $25,000")).toBeInTheDocument();
  expect(
    screen.getByText("Raw file deleted August 27, 2026"),
  ).toBeInTheDocument();
});

it("S4.8: announces a recoverable failure and retries it without losing the filename", async () => {
  const user = userEvent.setup();
  const onRetry = vi.fn();
  render(
    <UploadOfferPanel
      onUpload={vi.fn()}
      onRetry={onRetry}
      uploads={[
        {
          id: "doc-1",
          filename: "award.pdf",
          mimeType: "application/pdf",
          sizeBytes: 5,
          processingState: "failed",
          updatedAtLabel: "Updated just now",
          errorMessage:
            "The PDF could not be read. Export a new copy and try again.",
          requiredAction: "Upload a readable copy.",
        },
      ]}
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent(
    "award.pdf: Processing failed. The PDF could not be read.",
  );
  await user.click(screen.getByRole("button", { name: "Retry award.pdf" }));

  expect(onRetry).toHaveBeenCalledWith("doc-1");
  expect(
    screen.getByRole("heading", { name: "award.pdf" }),
  ).toBeInTheDocument();
});

it("S4.10: lets the owner delete a retained raw file immediately", async () => {
  const user = userEvent.setup();
  const onDeleteRaw = vi.fn();
  render(
    <UploadOfferPanel
      onUpload={vi.fn()}
      onDeleteRaw={onDeleteRaw}
      uploads={[
        {
          id: "doc-1",
          filename: "award.pdf",
          mimeType: "application/pdf",
          sizeBytes: 5,
          processingState: "extracting",
          updatedAtLabel: "Updated just now",
          previewState: "available",
          rawAvailable: true,
        },
      ]}
    />,
  );

  await user.click(
    screen.getByRole("button", { name: "Delete raw award.pdf" }),
  );

  expect(onDeleteRaw).toHaveBeenCalledWith("doc-1");
});
