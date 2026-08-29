/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const confirmAge = makeFunctionReference<
  "mutation",
  { confirmed: boolean },
  { profileId: Id<"profiles">; workspaceId: Id<"workspaces"> }
>("profiles:confirmAge");
const getCurrent = makeFunctionReference<
  "query",
  Record<string, never>,
  Doc<"profiles"> | null
>("profiles:getCurrent");
const retry = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { status: "scheduled" | "ready" | "active" }
>("profiles:retryInboxProvisioning");

it("S8.1: workspace inbox provisioning is idempotent and retryable", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "owner@example.com" }),
  );
  const owner = t.withIdentity({ subject: `${userId}|session` });
  await owner.mutation(confirmAge, { confirmed: true });
  await expect(owner.query(getCurrent, {})).resolves.toMatchObject({
    agentMailProvisioningState: "queued",
  });
  await t.finishAllScheduledFunctions(() => {});
  await expect(owner.query(getCurrent, {})).resolves.toMatchObject({
    agentMailProvisioningState: "failed",
    agentMailProvisioningError: "NOT_CONFIGURED",
  });
  await expect(owner.mutation(retry, {})).resolves.toEqual({
    status: "scheduled",
  });
  await expect(owner.mutation(retry, {})).resolves.toEqual({
    status: "active",
  });
});
