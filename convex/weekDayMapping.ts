import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const dayLabel = v.optional(v.string());

export const setWeek = mutation({
  args: {
    weekStart: v.string(),
    monday: dayLabel,
    tuesday: dayLabel,
    wednesday: dayLabel,
    thursday: dayLabel,
    friday: dayLabel,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weekDayMapping")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("weekDayMapping", args);
    }
  },
});

export const getWeek = query({
  args: { weekStart: v.string() },
  handler: async (ctx, { weekStart }) => {
    return ctx.db
      .query("weekDayMapping")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", weekStart))
      .first();
  },
});
