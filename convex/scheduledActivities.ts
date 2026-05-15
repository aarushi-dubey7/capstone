import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function assertFutureOrToday(date: string) {
  if (date < localDateString()) {
    throw new Error("Scheduled activities can only be managed for today or a future date.");
  }
}

export const create = mutation({
  args: {
    studentId: v.id("students"),
    date: v.string(),
    activityLabel: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertFutureOrToday(args.date);
    const existing = await ctx.db
      .query("scheduledActivities")
      .withIndex("by_student_and_date", (q) => q.eq("studentId", args.studentId).eq("date", args.date))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        activityLabel: args.activityLabel.trim(),
        notes: args.notes?.trim() || undefined,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return ctx.db.insert("scheduledActivities", {
      studentId: args.studentId,
      date: args.date,
      activityLabel: args.activityLabel.trim(),
      notes: args.notes?.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("scheduledActivities"),
    date: v.string(),
    activityLabel: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertFutureOrToday(args.date);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Scheduled activity not found.");
    }

    await ctx.db.patch(args.id, {
      date: args.date,
      activityLabel: args.activityLabel.trim(),
      notes: args.notes?.trim() || undefined,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("scheduledActivities") },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return null;
    assertFutureOrToday(existing.date);
    await ctx.db.delete(id);
    return id;
  },
});

export const listForStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const activities = await ctx.db
      .query("scheduledActivities")
      .withIndex("by_student_and_date", (q) => q.eq("studentId", studentId))
      .collect();
    return activities.sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const listByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    return ctx.db
      .query("scheduledActivities")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
  },
});
