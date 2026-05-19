import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listForTeacher = query({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, { teacherId }) => {
    return ctx.db
      .query("notifications")
      .withIndex("by_teacher", (q) => q.eq("teacherId", teacherId))
      .order("desc")
      .collect();
  },
});

export const markAsRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { read: true });
  },
});

export const markAllAsRead = mutation({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, { teacherId }) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_teacher", (q) => q.eq("teacherId", teacherId).eq("read", false))
      .collect();
    for (const notification of unread) {
      await ctx.db.patch(notification._id, { read: true });
    }
  },
});
