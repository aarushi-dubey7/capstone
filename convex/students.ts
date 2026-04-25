import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const register = mutation({
  args: {
    name: v.string(),
    studentId: v.string(),
    email: v.optional(v.string()),
    role: v.union(v.literal("student"), v.literal("teacher")),
    grade: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("students")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("students", { ...args, createdAt: Date.now() });
  },
});

export const getByStudentId = query({
  args: { studentId: v.string() },
  handler: async (ctx, { studentId }) => {
    return ctx.db
      .query("students")
      .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
      .first();
  },
});

// Login: verify email + studentId match
export const login = query({
  args: {
    email: v.string(),
    studentId: v.string(),
  },
  handler: async (ctx, { email, studentId }) => {
    const student = await ctx.db
      .query("students")
      .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
      .first();
    if (!student) return null;
    // Check that the stored email matches (case-insensitive)
    if (!student.email || student.email.toLowerCase() !== email.toLowerCase()) {
      return null;
    }
    return student;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("students").order("asc").collect();
  },
});
