import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type DatabaseContext = Pick<QueryCtx | MutationCtx, "auth" | "db">;
export const NOT_FOUND = "Not found";

export async function requireAuthUserId(ctx: Pick<DatabaseContext, "auth">) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export async function requireProfile(ctx: DatabaseContext) {
  const userId = await requireAuthUserId(ctx);
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_authUserId", (query) => query.eq("authUserId", userId))
    .unique();
  if (!profile) throw new Error(NOT_FOUND);
  return profile;
}

export async function requireActiveWorkspace(
  ctx: DatabaseContext,
  workspaceId?: Id<"workspaces">,
) {
  const profile = await requireProfile(ctx);
  const workspace = workspaceId
    ? await ctx.db.get("workspaces", workspaceId)
    : await ctx.db
        .query("workspaces")
        .withIndex("by_ownerProfileId_status", (query) =>
          query.eq("ownerProfileId", profile._id).eq("status", "active"),
        )
        .unique();

  if (
    !workspace ||
    workspace.ownerProfileId !== profile._id ||
    workspace.status !== "active"
  ) {
    throw new Error(NOT_FOUND);
  }
  return workspace;
}

export async function getActiveWorkspaceForGeneration(
  ctx: Pick<DatabaseContext, "db">,
  workspaceId: Id<"workspaces">,
  generation: number,
) {
  const workspace = await ctx.db.get("workspaces", workspaceId);
  return workspace?.status === "active" && workspace.generation === generation
    ? workspace
    : null;
}
