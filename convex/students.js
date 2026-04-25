import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
export const register = mutation({
    args: {
        name: v.string(),
        studentId: v.string(),
        role: v.union(v.literal("student"), v.literal("teacher")),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("students")
            .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
            .first();
        if (existing)
            return existing._id;
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
export const list = query({
    args: {},
    handler: async (ctx) => {
        return ctx.db.query("students").order("asc").collect();
    },
});
