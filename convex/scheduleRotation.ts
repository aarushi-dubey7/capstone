import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const set = mutation({
  args: { date: v.string(), dayLabel: v.string() },
  handler: async (ctx, { date, dayLabel }) => {
    const existing = await ctx.db
      .query("scheduleRotation")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { dayLabel });
    } else {
      await ctx.db.insert("scheduleRotation", { date, dayLabel });
    }
  },
});

export const getByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    return ctx.db
      .query("scheduleRotation")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();
  },
});

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("scheduleRotation").order("desc").take(14);
  },
});
