import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const createTest = () => convexTest(schema, modules);
async function authenticated(t: ReturnType<typeof createTest>, email: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  return {
    client: t.withIdentity({ subject: `${userId}|test-session` }),
    userId,
  };
}
const getCurrent = makeFunctionReference<"query">("workspaces:getCurrent");
const getById = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces"> }
>("workspaces:getById");
const remove = makeFunctionReference<
  "mutation",
  { workspaceId: Id<"workspaces"> }
>("workspaces:remove");
const isGenerationCurrent = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces">; generation: number },
  boolean
>("workspaces:isGenerationCurrent");
const chooseCurrentSchool = makeFunctionReference<
  "mutation",
  { workspaceId: Id<"workspaces">; schoolId: Id<"schools"> },
  Id<"schools">
>("workspaces:chooseCurrentSchool");
const getCurrentProfile = makeFunctionReference<"query">("profiles:getCurrent");
const confirmAge = makeFunctionReference<
  "mutation",
  { confirmed: boolean },
  { profileId: Id<"profiles">; workspaceId: Id<"workspaces"> }
>("profiles:confirmAge");

test("anonymous users cannot query a private workspace", async () => {
  const t = createTest();
  const { client } = await authenticated(t, "owner@example.com");
  const { workspaceId } = await client.mutation(confirmAge, {
    confirmed: true,
  });

  await expect(t.query(getCurrent, {})).rejects.toThrow("Not authenticated");
  await expect(t.query(getById, { workspaceId })).rejects.toThrow(
    "Not authenticated",
  );
  await expect(t.mutation(remove, { workspaceId })).rejects.toThrow(
    "Not authenticated",
  );
});

test("an authenticated new user has no profile status yet", async () => {
  const t = createTest();
  const { client } = await authenticated(t, "new@example.com");

  await expect(client.query(getCurrentProfile, {})).resolves.toBeNull();
});

test("explicit age confirmation creates exactly one profile and workspace", async () => {
  const t = createTest();
  const { client: alice, userId } = await authenticated(t, "alice@example.com");

  const first = await alice.mutation(confirmAge, { confirmed: true });
  const second = await alice.mutation(confirmAge, { confirmed: true });

  expect(second).toEqual(first);
  await expect(alice.query(getCurrentProfile, {})).resolves.toMatchObject({
    _id: first.profileId,
    authUserId: userId,
    email: "alice@example.com",
  });
  await expect(alice.query(getCurrent, {})).resolves.toMatchObject({
    _id: first.workspaceId,
    ownerProfileId: first.profileId,
    status: "active",
    generation: 0,
  });
});

test("age confirmation is required before workspace creation", async () => {
  const t = createTest();
  const { client: alice } = await authenticated(t, "alice@example.com");

  await expect(
    alice.mutation(confirmAge, { confirmed: false }),
  ).rejects.toThrow("Age confirmation required");
  await expect(alice.query(getCurrentProfile, {})).resolves.toBeNull();
  await expect(alice.query(getCurrent, {})).rejects.toHaveProperty(
    "message",
    "Not found",
  );
  await expect(
    t.run(async (ctx) => ({
      profiles: (await ctx.db.query("profiles").collect()).length,
      workspaces: (await ctx.db.query("workspaces").collect()).length,
    })),
  ).resolves.toEqual({ profiles: 0, workspaces: 0 });
});

test("one user cannot query or delete another user's workspace", async () => {
  const t = createTest();
  const { client: alice } = await authenticated(t, "alice@example.com");
  const { client: bob } = await authenticated(t, "bob@example.com");
  await alice.mutation(confirmAge, { confirmed: true });
  const bobIds = await bob.mutation(confirmAge, { confirmed: true });
  const missingId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("workspaces", {
      ownerProfileId: bobIds.profileId,
      name: "Deleted fixture",
      status: "active",
      generation: 0,
      createdAt: 0,
      updatedAt: 0,
    });
    await ctx.db.delete("workspaces", id);
    return id;
  });
  const deletingId = await t.run((ctx) =>
    ctx.db.insert("workspaces", {
      ownerProfileId: bobIds.profileId,
      name: "Deleting fixture",
      status: "deleting",
      generation: 1,
      createdAt: 0,
      updatedAt: 0,
      deletionStartedAt: 0,
    }),
  );

  await expect(
    alice.query(getById, { workspaceId: bobIds.workspaceId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    alice.query(getById, { workspaceId: missingId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    bob.query(getById, { workspaceId: deletingId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    alice.mutation(remove, { workspaceId: bobIds.workspaceId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    alice.mutation(remove, { workspaceId: missingId }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    bob.mutation(remove, { workspaceId: deletingId }),
  ).rejects.toHaveProperty("message", "Not found");
});

test("owner deletion blocks access and late work observes a stale generation", async () => {
  const t = createTest();
  const { client: alice } = await authenticated(t, "alice@example.com");
  const { workspaceId } = await alice.mutation(confirmAge, { confirmed: true });
  const workspace = await alice.query(getById, { workspaceId });
  await t.run((ctx) =>
    ctx.db.patch("profiles", workspace.ownerProfileId, {
      agentMailInboxId: "inbox-fixture",
      agentMailInboxAddress: "fixture@agentmail.test",
    }),
  );

  await expect(
    t.query(isGenerationCurrent, {
      workspaceId,
      generation: workspace.generation,
    }),
  ).resolves.toBe(true);

  await alice.mutation(remove, { workspaceId });

  await expect(alice.query(getById, { workspaceId })).rejects.toHaveProperty(
    "message",
    "Not found",
  );
  await expect(alice.query(getCurrent, {})).resolves.toBeNull();
  await expect(
    t.query(isGenerationCurrent, {
      workspaceId,
      generation: workspace.generation,
    }),
  ).resolves.toBe(false);
  await expect(
    t.run((ctx) => ctx.db.get("profiles", workspace.ownerProfileId)),
  ).resolves.not.toMatchObject({
    agentMailInboxId: expect.anything(),
    agentMailInboxAddress: expect.anything(),
  });
});

test("only an owner can choose a school and deletion cascades private children", async () => {
  const t = createTest();
  const { client: alice } = await authenticated(t, "alice@example.com");
  const { client: bob } = await authenticated(t, "bob@example.com");
  const aliceIds = await alice.mutation(confirmAge, { confirmed: true });
  const bobIds = await bob.mutation(confirmAge, { confirmed: true });
  const { aliceSchoolId, bobSchoolId, missingSchoolId } = await t.run(
    async (ctx) => {
      const school = (workspaceId: Id<"workspaces">, name: string) =>
        ctx.db.insert("schools", {
          workspaceId,
          name,
          identityState: "confirmed",
          createdAt: 0,
          updatedAt: 0,
        });
      const aliceSchoolId = await school(aliceIds.workspaceId, "UC San Diego");
      const bobSchoolId = await school(
        bobIds.workspaceId,
        "Loyola University Maryland",
      );
      const missingSchoolId = await school(
        aliceIds.workspaceId,
        "Deleted fixture",
      );
      await ctx.db.delete("schools", missingSchoolId);
      return { aliceSchoolId, bobSchoolId, missingSchoolId };
    },
  );

  await expect(
    alice.mutation(chooseCurrentSchool, {
      workspaceId: aliceIds.workspaceId,
      schoolId: aliceSchoolId,
    }),
  ).resolves.toBe(aliceSchoolId);
  await expect(
    alice.query(getById, { workspaceId: aliceIds.workspaceId }),
  ).resolves.toMatchObject({ currentChoiceSchoolId: aliceSchoolId });

  await expect(
    t.mutation(chooseCurrentSchool, {
      workspaceId: aliceIds.workspaceId,
      schoolId: aliceSchoolId,
    }),
  ).rejects.toThrow("Not authenticated");

  await expect(
    alice.mutation(chooseCurrentSchool, {
      workspaceId: aliceIds.workspaceId,
      schoolId: bobSchoolId,
    }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    alice.mutation(chooseCurrentSchool, {
      workspaceId: bobIds.workspaceId,
      schoolId: bobSchoolId,
    }),
  ).rejects.toHaveProperty("message", "Not found");
  await expect(
    alice.mutation(chooseCurrentSchool, {
      workspaceId: aliceIds.workspaceId,
      schoolId: missingSchoolId,
    }),
  ).rejects.toHaveProperty("message", "Not found");

  const { storageId, documentId, auditId } = await t.run(async (ctx) => {
    const now = Date.now();
    const storageId = await ctx.storage.store(new Blob(["private offer"]));
    const documentId = await ctx.db.insert("offerDocuments", {
      workspaceId: aliceIds.workspaceId,
      schoolId: aliceSchoolId,
      storageId,
      fileName: "offer.pdf",
      mimeType: "application/pdf",
      byteSize: 13,
      sha256: "workspace-delete-fixture",
      sourceRoute: "upload",
      retentionDeadline: now + 60_000,
      rawState: "present",
      processingState: "received",
      processingGeneration: 0,
      createdAt: now,
      updatedAt: now,
    });
    const auditId = await ctx.db.insert("auditEvents", {
      workspaceId: aliceIds.workspaceId,
      actor: "system",
      eventType: "fixture",
      documentId,
      createdAt: now,
    });
    return { storageId, documentId, auditId };
  });

  await alice.mutation(remove, { workspaceId: aliceIds.workspaceId });
  await t.finishAllScheduledFunctions(() => {});
  await expect(
    t.run((ctx) => ctx.db.get("schools", aliceSchoolId)),
  ).resolves.toBeNull();
  await expect(
    t.run((ctx) => ctx.db.get("offerDocuments", documentId)),
  ).resolves.toBeNull();
  await expect(
    t.run((ctx) => ctx.db.get("auditEvents", auditId)),
  ).resolves.toBeNull();
  await expect(t.run((ctx) => ctx.storage.get(storageId))).resolves.toBeNull();
});
