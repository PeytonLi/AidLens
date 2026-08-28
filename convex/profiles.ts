import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("profiles")
      .withIndex("by_authUserId", (query) => query.eq("authUserId", userId))
      .unique();
  },
});

export const confirmAge = mutation({
  args: { confirmed: v.boolean() },
  handler: async (ctx, { confirmed }) => {
    const userId = await requireAuthUserId(ctx);
    if (!confirmed) throw new Error("Age confirmation required");
    const user = await ctx.db.get("users", userId);
    if (!user?.email) throw new Error("Email required");

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_authUserId", (query) => query.eq("authUserId", userId))
      .unique();
    const now = Date.now();
    const profileId =
      existingProfile?._id ??
      (await ctx.db.insert("profiles", {
        authUserId: userId,
        email: user.email,
        ageConfirmedAt: now,
        createdAt: now,
        updatedAt: now,
      }));

    if (existingProfile && !existingProfile.ageConfirmedAt) {
      await ctx.db.patch("profiles", profileId, {
        ageConfirmedAt: now,
        updatedAt: now,
      });
    }

    const existingWorkspace = await ctx.db
      .query("workspaces")
      .withIndex("by_ownerProfileId", (query) =>
        query.eq("ownerProfileId", profileId),
      )
      .unique();
    const workspaceId =
      existingWorkspace?._id ??
      (await ctx.db.insert("workspaces", {
        ownerProfileId: profileId,
        name: "My offers",
        status: "active",
        generation: 0,
        createdAt: now,
        updatedAt: now,
      }));

    return { profileId, workspaceId };
  },
});
