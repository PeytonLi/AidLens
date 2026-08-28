import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const createTest = () => convexTest(schema, modules);
const confirmAge = makeFunctionReference<
  "mutation",
  { confirmed: boolean },
  { profileId: Id<"profiles">; workspaceId: Id<"workspaces"> }
>("profiles:confirmAge");

async function authenticated(t: ReturnType<typeof createTest>, email: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  return t.withIdentity({ subject: `${userId}|test-session` });
}

test("only the owner can stream a present raw document", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const bob = await authenticated(t, "bob@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  await bob.mutation(confirmAge, { confirmed: true });
  const bytes = new Blob(["private offer"], { type: "application/pdf" });
  const { documentId } = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(bytes);
    const now = Date.now();
    const documentId = await ctx.db.insert("offerDocuments", {
      workspaceId,
      storageId,
      fileName: "offer.pdf",
      mimeType: "application/pdf",
      byteSize: bytes.size,
      sha256: "fixture-digest",
      sourceRoute: "upload",
      retentionDeadline: now + 60_000,
      rawState: "present",
      processingState: "received",
      processingGeneration: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { documentId, storageId };
  });
  const path = `/documents/preview?documentId=${documentId}`;

  const ownerResponse = await alice.fetch(path);
  expect(ownerResponse.status).toBe(200);
  expect(ownerResponse.headers.get("content-type")).toBe("application/pdf");
  expect(ownerResponse.headers.get("cache-control")).toBe("private, no-store");
  await expect(ownerResponse.text()).resolves.toBe("private offer");

  await expect(t.fetch(path).then(({ status }) => status)).resolves.toBe(404);
  await expect(bob.fetch(path).then(({ status }) => status)).resolves.toBe(404);
  await expect(
    alice
      .fetch(`${path}&storageId=attacker-controlled`)
      .then(({ status }) => status),
  ).resolves.toBe(404);
});

test("deleted or missing raw documents have the same preview response", async () => {
  const t = createTest();
  const alice = await authenticated(t, "alice@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  const documentId = await t.run((ctx) => {
    const now = Date.now();
    return ctx.db.insert("offerDocuments", {
      workspaceId,
      fileName: "deleted.pdf",
      mimeType: "application/pdf",
      byteSize: 0,
      sha256: "deleted-fixture",
      sourceRoute: "upload",
      retentionDeadline: now,
      rawState: "deleted",
      processingState: "failed",
      processingGeneration: 1,
      errorCode: "RAW_DELETED",
      errorMessage: "The raw file was deleted.",
      createdAt: now,
      updatedAt: now,
      rawDeletedAt: now,
    });
  });

  const deleted = await alice.fetch(
    `/documents/preview?documentId=${documentId}`,
  );
  const missing = await alice.fetch(
    "/documents/preview?documentId=j-invalid-document-id",
  );
  expect([deleted.status, missing.status]).toEqual([404, 404]);
  await expect(deleted.text()).resolves.toBe("Not found");
  await expect(missing.text()).resolves.toBe("Not found");
});

test("preview preflight allows only the configured browser origin and authorization header", async () => {
  vi.stubEnv("SITE_URL", "http://localhost:5173");
  const t = createTest();
  const allowed = await t.fetch("/documents/preview", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization",
    },
  });
  expect(allowed.status).toBe(204);
  expect(allowed.headers.get("access-control-allow-origin")).toBe(
    "http://localhost:5173",
  );
  expect(allowed.headers.get("access-control-allow-headers")).toContain(
    "Authorization",
  );

  const rejected = await t.fetch("/documents/preview", {
    method: "OPTIONS",
    headers: { Origin: "https://attacker.example" },
  });
  expect(rejected.status).toBe(403);
  expect(rejected.headers.has("access-control-allow-origin")).toBe(false);
});
