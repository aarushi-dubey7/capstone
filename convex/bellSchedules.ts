import { mutation, query } from "./_generated/server";
// Force re-deploy
import { v } from "convex/values";

export const getByType = query({
  args: { type: v.string() },
  handler: async (ctx, { type }) => {
    return ctx.db
      .query("bellSchedules")
      .withIndex("by_type", (q) => q.eq("type", type))
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("bellSchedules").collect();
  },
});

export const initialize = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("bellSchedules").collect();
    if (existing.length > 0) return;

    const schedules = [
      {
        type: "Standard",
        blocks: [
          { label: "Block 1", start: "08:17 AM", end: "09:13 AM" },
          { label: "Block 2", start: "09:15 AM", end: "10:08 AM" },
          { label: "Block 3", start: "10:10 AM", end: "11:03 AM" },
          { label: "EP 1/Lunch", start: "11:05 AM", end: "11:35 AM" },
          { label: "EP 2/Lunch", start: "11:40 AM", end: "12:10 PM" },
          { label: "Block 4", start: "12:12 PM", end: "01:05 PM" },
          { label: "Block 5", start: "01:07 PM", end: "02:00 PM" },
          { label: "Block 6", start: "02:02 PM", end: "02:55 PM" },
        ],
      },
      {
        type: "Advisory",
        blocks: [
          { label: "Block 1", start: "08:17 AM", end: "09:08 AM" },
          { label: "Block 2", start: "09:10 AM", end: "09:58 AM" },
          { label: "Block 3", start: "10:00 AM", end: "10:48 AM" },
          { label: "Advisory", start: "10:50 AM", end: "11:20 AM" },
          { label: "Lunch 6/7 & EP 8", start: "11:22 AM", end: "11:52 AM" },
          { label: "EP 6/7 & Lunch 8", start: "11:57 AM", end: "12:27 PM" },
          { label: "Block 4", start: "12:29 PM", end: "01:17 PM" },
          { label: "Block 5", start: "01:19 PM", end: "02:07 PM" },
          { label: "Block 6", start: "02:09 PM", end: "02:57 PM" },
        ],
      },
      {
        type: "Morning Assembly",
        blocks: [
          { label: "Block 1", start: "08:17 AM", end: "09:03 AM" },
          { label: "Block 2", start: "09:05 AM", end: "09:48 AM" },
          { label: "Assembly", start: "09:50 AM", end: "10:50 AM" },
          { label: "Lunch 6/7 & EP 8", start: "10:52 AM", end: "11:22 AM" },
          { label: "EP 6/7 & Lunch 8", start: "11:27 AM", end: "11:57 AM" },
          { label: "Block 3", start: "12:00 PM", end: "12:43 PM" },
          { label: "Block 4", start: "12:45 PM", end: "01:28 PM" },
          { label: "Block 5", start: "01:30 PM", end: "02:13 PM" },
          { label: "Block 6", start: "02:15 PM", end: "02:58 PM" },
        ],
      },
    ];

    for (const s of schedules) {
      await ctx.db.insert("bellSchedules", s);
    }
  },
});
