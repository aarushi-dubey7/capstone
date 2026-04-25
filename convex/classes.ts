import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const add = mutation({
  args: {
    room: v.string(),
    subject: v.string(),
    teacherName: v.string(),
    grade: v.optional(v.string()),
    period: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("classes", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("classes"),
    room: v.optional(v.string()),
    subject: v.optional(v.string()),
    teacherName: v.optional(v.string()),
    grade: v.optional(v.string()),
    period: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    // Only patch the fields that were provided
    const patch: Record<string, string | undefined> = {};
    if (fields.room !== undefined) patch.room = fields.room;
    if (fields.subject !== undefined) patch.subject = fields.subject;
    if (fields.teacherName !== undefined) patch.teacherName = fields.teacherName;
    if (fields.grade !== undefined) patch.grade = fields.grade;
    if (fields.period !== undefined) patch.period = fields.period;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("classes") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("classes").collect();
  },
});

export const listByGrade = query({
  args: { grade: v.string() },
  handler: async (ctx, { grade }) => {
    return ctx.db
      .query("classes")
      .withIndex("by_grade", (q) => q.eq("grade", grade))
      .collect();
  },
});
