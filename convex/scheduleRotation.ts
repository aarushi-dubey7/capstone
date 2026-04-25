import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { CALENDAR_ROTATION } from "./calendarData";

export const set = mutation({
  args: { 
    date: v.string(), 
    dayLabel: v.optional(v.string()), 
    bellScheduleType: v.optional(v.string()) 
  },
  handler: async (ctx, { date, dayLabel, bellScheduleType }) => {
    const existing = await ctx.db
      .query("scheduleRotation")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { 
        ...(dayLabel !== undefined ? { dayLabel } : {}),
        ...(bellScheduleType !== undefined ? { bellScheduleType } : {})
      });
    } else {
      await ctx.db.insert("scheduleRotation", { 
        date, 
        dayLabel: dayLabel ?? CALENDAR_ROTATION[date] ?? "No School",
        bellScheduleType: bellScheduleType ?? "Standard"
      });
    }
  },
});

export const getByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const manual = await ctx.db
      .query("scheduleRotation")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();
    
    if (manual) return manual;

    // Fallback to automatic lookup
    const autoDay = CALENDAR_ROTATION[date];
    if (autoDay) {
      return {
        date,
        dayLabel: autoDay,
        bellScheduleType: "Standard"
      };
    }

    return null;
  },
});

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("scheduleRotation").order("desc").take(14);
  },
});
