import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
export const upsert = mutation({
    args: {
        name: v.string(),
        roomNumber: v.string(),
        uuid: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("locations")
            .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, args);
            return existing._id;
        }
        return ctx.db.insert("locations", args);
    },
});
export const remove = mutation({
    args: { id: v.id("locations") },
    handler: async (ctx, { id }) => ctx.db.delete(id),
});
export const list = query({
    args: {},
    handler: async (ctx) => ctx.db.query("locations").collect(),
});
export const getByUuid = query({
    args: { uuid: v.string() },
    handler: async (ctx, { uuid }) => {
        return ctx.db
            .query("locations")
            .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
            .first();
    },
});
