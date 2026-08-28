import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test, vi } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const createTest = () => convexTest(schema, modules);

async function authenticated(t: ReturnType<typeof createTest>, email: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  return t.withIdentity({ subject: `${userId}|test-session` });
}

const confirmAge = makeFunctionReference<
  "mutation",
  { confirmed: boolean },
  { profileId: Id<"profiles">; workspaceId: Id<"workspaces"> }
>("profiles:confirmAge");
const generateUploadUrl = makeFunctionReference<
  "mutation",
  { workspaceId: Id<"workspaces"> },
  string
>("documents:generateUploadUrl");
const finalizeUpload = makeFunctionReference<
  "mutation",
  {
    workspaceId: Id<"workspaces">;
    storageId: Id<"_storage">;
    fileName: string;
  },
  { status: "created"; documentId: Id<"offerDocuments"> }
>("documents:finalizeUpload");
const finalizeUploadWithDuplicate = makeFunctionReference<
  "mutation",
  {
    workspaceId: Id<"workspaces">;
    storageId: Id<"_storage">;
    fileName: string;
  },
  | { status: "created"; documentId: Id<"offerDocuments"> }
  | { status: "duplicate"; existingDocumentId: Id<"offerDocuments"> }
>("documents:finalizeUpload");
const getDocument = makeFunctionReference<
  "query",
  { documentId: Id<"offerDocuments"> }
>("documents:getDocument");
const listDocuments = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces"> },
  Array<Omit<Doc<"offerDocuments">, "storageId" | "sha256">>
>("documents:listDocuments");
const resolveDuplicate = makeFunctionReference<
  "mutation",
  {
    workspaceId: Id<"workspaces">;
    existingDocumentId: Id<"offerDocuments">;
    storageId: Id<"_storage">;
    fileName: string;
    choice: "replace" | "keep_new" | "cancel";
  }
>("documents:resolveDuplicate");
const getPreviewFile = makeFunctionReference<
  "query",
  { documentId: Id<"offerDocuments"> },
  { storageId: Id<"_storage">; mimeType: string; fileName: string }
>("documents:getPreviewFile");
const deleteRaw = makeFunctionReference<
  "mutation",
  { documentId: Id<"offerDocuments"> },
  { status: "deleted" | "already_deleted" }
>("documents:deleteRaw");
const retryValidation = makeFunctionReference<
  "mutation",
  { documentId: Id<"offerDocuments"> },
  { status: "scheduled" }
>("documents:retryValidation");
const cleanupDue = makeFunctionReference<
  "mutation",
  { limit?: number },
  { processed: number; hasMore: boolean }
>("retention:cleanupDue");
const advanceProcessing = makeFunctionReference<
  "mutation",
  {
    workspaceId: Id<"workspaces">;
    workspaceGeneration: number;
    documentId: Id<"offerDocuments">;
    expectedGeneration: number;
    nextState:
      | "received"
      | "validating"
      | "extracting"
      | "needs_school_confirmation"
      | "researching"
      | "needs_review"
      | "ready"
      | "failed";
  },
  boolean
>("documents:advanceProcessing");

test("only the workspace owner can obtain an upload URL", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const bob = await authenticated(t, "bob@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  await bob.mutation(confirmAge, { confirmed: true });

  await expect(
    alice.mutation(generateUploadUrl, { workspaceId }),
  ).resolves.toMatch(/^https:\/\//);
  await expect(
    bob.mutation(generateUploadUrl, { workspaceId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(t.mutation(generateUploadUrl, { workspaceId })).rejects.toThrow(
    "Not authenticated",
  );
});

test("finalizing an upload creates an owner-scoped received record from storage metadata", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  const bytes = new Blob(["%PDF-1.7\nsynthetic offer"]);
  const storageId = await t.run((ctx) => ctx.storage.store(bytes));

  const result = await alice.mutation(finalizeUpload, {
    workspaceId,
    storageId,
    fileName: "aid-offer.pdf",
  });

  expect(result.status).toBe("created");
  await expect(
    alice.query(getDocument, { documentId: result.documentId }),
  ).resolves.toEqual(
    expect.objectContaining({
      _id: result.documentId,
      fileName: "aid-offer.pdf",
      byteSize: bytes.size,
      processingState: "received",
      rawState: "present",
    }),
  );
  expect(
    await alice.query(getDocument, { documentId: result.documentId }),
  ).not.toHaveProperty("storageId");
});

test("finalization rejects an unsafe filename at the trust boundary", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["bytes"])),
  );

  await expect(
    alice.mutation(finalizeUploadWithDuplicate, {
      workspaceId,
      storageId,
      fileName: `offer\u0000${"x".repeat(256)}.pdf`,
    }),
  ).resolves.toEqual({
    status: "rejected",
    errorCode: "INVALID_FILE_NAME",
  });
  await expect(
    t.run(async (ctx) => (await ctx.storage.get(storageId)) === null),
  ).resolves.toBe(true);
  await expect(alice.query(listDocuments, { workspaceId })).resolves.toEqual(
    [],
  );
});

test("concurrent duplicate finalization creates one document and one validation job", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  const firstStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["same bytes"])),
  );
  const secondStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["same bytes"])),
  );

  const results = await Promise.all([
    alice.mutation(finalizeUploadWithDuplicate, {
      workspaceId,
      storageId: firstStorageId,
      fileName: "first.pdf",
    }),
    alice.mutation(finalizeUpload, {
      workspaceId,
      storageId: secondStorageId,
      fileName: "duplicate.pdf",
    }),
  ]);
  const first = results.find(({ status }) => status === "created");
  const duplicate = results.find(({ status }) => status === "duplicate");

  expect(first?.status).toBe("created");
  expect(duplicate).toEqual({
    status: "duplicate",
    existingDocumentId: first?.status === "created" ? first.documentId : "",
  });
  await expect(
    alice.query(listDocuments, { workspaceId }),
  ).resolves.toHaveLength(1);
  await expect(
    t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()),
  ).resolves.toHaveLength(2);
});

test("an abandoned duplicate upload is removed by scheduled orphan cleanup", async () => {
  vi.useFakeTimers();
  try {
    const t = createTest();
    const alice = await authenticated(t, "alice@example.com");
    const { workspaceId } = await alice.mutation(confirmAge, {
      confirmed: true,
    });
    const firstStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["same bytes"])),
    );
    const orphanStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["same bytes"])),
    );
    await alice.mutation(finalizeUpload, {
      workspaceId,
      storageId: firstStorageId,
      fileName: "first.pdf",
    });
    await alice.mutation(finalizeUpload, {
      workspaceId,
      storageId: orphanStorageId,
      fileName: "duplicate.pdf",
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await expect(
      t.run(async (ctx) => (await ctx.storage.get(orphanStorageId)) === null),
    ).resolves.toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

test("cancelling a duplicate removes its unclaimed raw upload", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  const firstStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["same bytes"])),
  );
  const duplicateStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["same bytes"])),
  );
  const first = await alice.mutation(finalizeUpload, {
    workspaceId,
    storageId: firstStorageId,
    fileName: "first.pdf",
  });

  await expect(
    alice.mutation(resolveDuplicate, {
      workspaceId,
      existingDocumentId: first.documentId,
      storageId: duplicateStorageId,
      fileName: "duplicate.pdf",
      choice: "cancel",
    }),
  ).resolves.toEqual({
    status: "cancelled",
    documentId: first.documentId,
  });
  await expect(
    t.run((ctx) => ctx.storage.get(duplicateStorageId)),
  ).resolves.toBeNull();
  await expect(
    alice.query(listDocuments, { workspaceId }),
  ).resolves.toHaveLength(1);
});

test("replacing a duplicate reuses the document identity and removes the old raw file", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  const oldStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["same bytes"])),
  );
  const replacementStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["same bytes"])),
  );
  const first = await alice.mutation(finalizeUpload, {
    workspaceId,
    storageId: oldStorageId,
    fileName: "old.pdf",
  });

  await expect(
    alice.mutation(resolveDuplicate, {
      workspaceId,
      existingDocumentId: first.documentId,
      storageId: replacementStorageId,
      fileName: "replacement.pdf",
      choice: "replace",
    }),
  ).resolves.toEqual({
    status: "replaced",
    documentId: first.documentId,
  });
  await expect(
    alice.query(getDocument, { documentId: first.documentId }),
  ).resolves.toEqual(
    expect.objectContaining({
      fileName: "replacement.pdf",
      processingGeneration: 1,
      processingState: "received",
      rawState: "present",
    }),
  );
  await expect(
    t.run((ctx) => ctx.storage.get(oldStorageId)),
  ).resolves.toBeNull();
  await expect(
    t.run(
      async (ctx) => (await ctx.storage.get(replacementStorageId)) !== null,
    ),
  ).resolves.toBe(true);
});

test("keeping a duplicate as a new version creates a separate document", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  const oldStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["same bytes"])),
  );
  const newStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["same bytes"])),
  );
  const first = await alice.mutation(finalizeUpload, {
    workspaceId,
    storageId: oldStorageId,
    fileName: "first.pdf",
  });

  const kept = await alice.mutation(resolveDuplicate, {
    workspaceId,
    existingDocumentId: first.documentId,
    storageId: newStorageId,
    fileName: "second.pdf",
    choice: "keep_new",
  });

  expect(kept).toEqual({
    status: "created",
    documentId: expect.not.stringMatching(first.documentId),
  });
  await expect(alice.query(listDocuments, { workspaceId })).resolves.toEqual([
    expect.objectContaining({ _id: first.documentId, fileName: "first.pdf" }),
    expect.objectContaining({ _id: kept.documentId, fileName: "second.pdf" }),
  ]);
});

test("the private preview lookup returns raw storage only to the document owner", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const bob = await authenticated(t, "bob@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  await bob.mutation(confirmAge, { confirmed: true });
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["private bytes"])),
  );
  const created = await alice.mutation(finalizeUpload, {
    workspaceId,
    storageId,
    fileName: "private.pdf",
  });

  await expect(
    alice.query(getPreviewFile, { documentId: created.documentId }),
  ).resolves.toMatchObject({ storageId, fileName: "private.pdf" });
  await expect(
    bob.query(getPreviewFile, { documentId: created.documentId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    t.query(getPreviewFile, { documentId: created.documentId }),
  ).rejects.toThrow("Not authenticated");
});

test("the owner can delete raw storage immediately and repeated deletion is harmless", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["private bytes"])),
  );
  const created = await alice.mutation(finalizeUpload, {
    workspaceId,
    storageId,
    fileName: "private.pdf",
  });

  await expect(
    alice.mutation(deleteRaw, { documentId: created.documentId }),
  ).resolves.toEqual({ status: "deleted" });
  await expect(
    alice.mutation(deleteRaw, { documentId: created.documentId }),
  ).resolves.toEqual({ status: "already_deleted" });
  await expect(t.run((ctx) => ctx.storage.get(storageId))).resolves.toBeNull();
  await expect(
    alice.query(getDocument, { documentId: created.documentId }),
  ).resolves.toEqual(
    expect.objectContaining({
      rawState: "deleted",
      processingGeneration: 1,
      rawDeletedAt: expect.any(Number),
    }),
  );
  await expect(
    alice.query(getPreviewFile, { documentId: created.documentId }),
  ).rejects.toHaveProperty("message", "Not found");
});

test("document reads, duplicate choices, and deletion are owner-only", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const bob = await authenticated(t, "bob@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  await bob.mutation(confirmAge, { confirmed: true });
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["private bytes"])),
  );
  const duplicateStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["private bytes"])),
  );
  const created = await alice.mutation(finalizeUpload, {
    workspaceId,
    storageId,
    fileName: "private.pdf",
  });

  await expect(
    bob.query(getDocument, { documentId: created.documentId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    bob.query(listDocuments, { workspaceId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    bob.mutation(deleteRaw, { documentId: created.documentId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    bob.mutation(resolveDuplicate, {
      workspaceId,
      existingDocumentId: created.documentId,
      storageId: duplicateStorageId,
      fileName: "duplicate.pdf",
      choice: "cancel",
    }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    t.run(async (ctx) => (await ctx.storage.get(duplicateStorageId)) !== null),
  ).resolves.toBe(true);
});

test("scheduled validation cannot commit after raw deletion", async () => {
  vi.useFakeTimers();
  try {
    const t = createTest();
    const alice = await authenticated(t, "alice@example.com");
    const { workspaceId } = await alice.mutation(confirmAge, {
      confirmed: true,
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(
        new Blob(["%PDF-1.7\nsynthetic\n%%EOF"], {
          type: "application/pdf",
        }),
      ),
    );
    const created = await alice.mutation(finalizeUpload, {
      workspaceId,
      storageId,
      fileName: "deleted-before-validation.pdf",
    });
    await alice.mutation(deleteRaw, { documentId: created.documentId });

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await expect(
      alice.query(getDocument, { documentId: created.documentId }),
    ).resolves.toMatchObject({
      rawState: "deleted",
      processingState: "received",
      processingGeneration: 1,
    });
  } finally {
    vi.useRealTimers();
  }
});

test("retention cleanup deletes only a bounded due batch and audits each deletion once", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-03T12:00:00Z"));
  try {
    const t = createTest();
    const alice = await authenticated(t, "alice@example.com");
    const { workspaceId } = await alice.mutation(confirmAge, {
      confirmed: true,
    });
    const created: Array<{ storageId: Id<"_storage"> }> = [];
    for (const [index, deadline] of [
      Date.now() - 3,
      Date.now() - 2,
      Date.now() - 1,
      Date.now() + 60_000,
    ].entries()) {
      const storageId = await t.run((ctx) =>
        ctx.storage.store(new Blob([`unique-${index}`])),
      );
      const document = await alice.mutation(finalizeUpload, {
        workspaceId,
        storageId,
        fileName: `${index}.pdf`,
      });
      await t.run((ctx) =>
        ctx.db.patch("offerDocuments", document.documentId, {
          retentionDeadline: deadline,
        }),
      );
      created.push({ ...document, storageId });
    }

    await expect(t.mutation(cleanupDue, { limit: 2 })).resolves.toEqual({
      processed: 2,
      hasMore: true,
    });
    const afterFirstBatch = await alice.query(listDocuments, { workspaceId });
    expect(
      afterFirstBatch.filter((document) => document.rawState === "deleted"),
    ).toHaveLength(2);
    expect(
      afterFirstBatch.find((document) => document.fileName === "3.pdf"),
    ).toMatchObject({
      rawState: "present",
    });
    await expect(t.mutation(cleanupDue, { limit: 2 })).resolves.toEqual({
      processed: 1,
      hasMore: false,
    });
    await expect(t.mutation(cleanupDue, { limit: 2 })).resolves.toEqual({
      processed: 0,
      hasMore: false,
    });
    await expect(
      t.run((ctx) => ctx.db.query("auditEvents").collect()),
    ).resolves.toHaveLength(3);
    await expect(
      t.run(
        async (ctx) => (await ctx.storage.get(created[3].storageId)) !== null,
      ),
    ).resolves.toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

test("retention cleanup schedules another bounded batch while due files remain", async () => {
  vi.useFakeTimers();
  try {
    const t = createTest();
    const alice = await authenticated(t, "alice@example.com");
    const { workspaceId } = await alice.mutation(confirmAge, {
      confirmed: true,
    });
    for (let index = 0; index < 3; index += 1) {
      const storageId = await t.run((ctx) =>
        ctx.storage.store(new Blob([`due-${index}`])),
      );
      const created = await alice.mutation(finalizeUpload, {
        workspaceId,
        storageId,
        fileName: `${index}.pdf`,
      });
      await t.run((ctx) =>
        ctx.db.patch("offerDocuments", created.documentId, {
          retentionDeadline: Date.now() - 1,
        }),
      );
    }

    await t.mutation(cleanupDue, { limit: 2 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const documents = await alice.query(listDocuments, { workspaceId });
    expect(documents.every(({ rawState }) => rawState === "deleted")).toBe(
      true,
    );
  } finally {
    vi.useRealTimers();
  }
});

test("finalization schedules byte validation and valid content advances reactively", async () => {
  vi.useFakeTimers();
  try {
    const t = createTest();
    const alice = await authenticated(t, "alice@example.com");
    const { workspaceId } = await alice.mutation(confirmAge, {
      confirmed: true,
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(
        new Blob(["%PDF-1.7\nsynthetic\n%%EOF"], { type: "application/pdf" }),
      ),
    );
    const created = await alice.mutation(finalizeUpload, {
      workspaceId,
      storageId,
      fileName: "valid.pdf",
    });

    await expect(
      alice.query(getDocument, { documentId: created.documentId }),
    ).resolves.toMatchObject({ processingState: "received" });
    await expect(
      t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()),
    ).resolves.toHaveLength(1);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await expect(
      alice.query(getDocument, { documentId: created.documentId }),
    ).resolves.toMatchObject({
      processingState: "extracting",
      mimeType: "application/pdf",
      byteSize: 24,
    });
  } finally {
    vi.useRealTimers();
  }
});

test("scheduled validation records a recoverable error for invalid bytes", async () => {
  vi.useFakeTimers();
  try {
    const t = createTest();
    const alice = await authenticated(t, "alice@example.com");
    const { workspaceId } = await alice.mutation(confirmAge, {
      confirmed: true,
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["plain text"], { type: "text/plain" })),
    );
    const created = await alice.mutation(finalizeUpload, {
      workspaceId,
      storageId,
      fileName: "not-an-offer.txt",
    });

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await expect(
      alice.query(getDocument, { documentId: created.documentId }),
    ).resolves.toMatchObject({
      processingState: "failed",
      failedStage: "validating",
      errorCode: "UNSUPPORTED_FILE_TYPE",
      errorMessage: "Use a PDF, JPEG, or PNG file.",
    });
  } finally {
    vi.useRealTimers();
  }
});

test("an owner can explicitly retry validation while a non-owner cannot", async () => {
  vi.useFakeTimers();
  try {
    const t = createTest();
    const alice = await authenticated(t, "alice@example.com");
    const bob = await authenticated(t, "bob@example.com");
    const { workspaceId } = await alice.mutation(confirmAge, {
      confirmed: true,
    });
    await bob.mutation(confirmAge, { confirmed: true });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["plain text"], { type: "text/plain" })),
    );
    const created = await alice.mutation(finalizeUpload, {
      workspaceId,
      storageId,
      fileName: "retry.pdf",
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await expect(
      bob.mutation(retryValidation, { documentId: created.documentId }),
    ).rejects.toHaveProperty("message", "Not found");
    await expect(
      alice.mutation(retryValidation, { documentId: created.documentId }),
    ).resolves.toEqual({ status: "scheduled" });
    await expect(
      alice.query(getDocument, { documentId: created.documentId }),
    ).resolves.toMatchObject({
      processingState: "failed",
      processingGeneration: 1,
      failedStage: "validating",
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await expect(
      alice.query(getDocument, { documentId: created.documentId }),
    ).resolves.toMatchObject({
      processingState: "failed",
      processingGeneration: 1,
      errorCode: "UNSUPPORTED_FILE_TYPE",
    });
  } finally {
    vi.useRealTimers();
  }
});

test("processing commits allow canonical transitions and reject forbidden or stale writes", async () => {
  vi.useFakeTimers();
  try {
    const t = createTest();
    const alice = await authenticated(t, "alice@example.com");
    const { workspaceId } = await alice.mutation(confirmAge, {
      confirmed: true,
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(
        new Blob(["%PDF-1.7\nsynthetic\n%%EOF"], { type: "application/pdf" }),
      ),
    );
    const created = await alice.mutation(finalizeUpload, {
      workspaceId,
      storageId,
      fileName: "valid.pdf",
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await expect(
      t.mutation(advanceProcessing, {
        workspaceId,
        workspaceGeneration: 0,
        documentId: created.documentId,
        expectedGeneration: 0,
        nextState: "researching",
      }),
    ).resolves.toBe(true);
    await expect(
      t.mutation(advanceProcessing, {
        workspaceId,
        workspaceGeneration: 0,
        documentId: created.documentId,
        expectedGeneration: 0,
        nextState: "received",
      }),
    ).rejects.toMatchObject({ code: "INVALID_PROCESSING_TRANSITION" });
    await expect(
      t.mutation(advanceProcessing, {
        workspaceId,
        workspaceGeneration: 0,
        documentId: created.documentId,
        expectedGeneration: 99,
        nextState: "ready",
      }),
    ).rejects.toMatchObject({ code: "STALE_GENERATION" });
  } finally {
    vi.useRealTimers();
  }
});
