import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listForStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    return ctx.db
      .query("studentNotifications")
      .withIndex("by_student_and_read", (q) => q.eq("studentId", studentId))
      .order("desc")
      .collect();
  },
});

export const markAsRead = mutation({
  args: { id: v.id("studentNotifications") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { read: true });
  },
});

export const markAllAsRead = mutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const unread = await ctx.db
      .query("studentNotifications")
      .withIndex("by_student_and_read", (q) => q.eq("studentId", studentId).eq("read", false))
      .collect();
    for (const notification of unread) {
      await ctx.db.patch(notification._id, { read: true });
    }
  },
});
