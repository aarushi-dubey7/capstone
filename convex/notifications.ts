import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

export const createTestNotification = mutation({
  args: {
    teacherId: v.id("teachers"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { teacherId, message }) => {
    return await ctx.db.insert("notifications", {
      teacherId,
      date: localDateString(),
      message: message?.trim() || "Take Attendance Now!",
      type: "general",
      dedupeKey: `manual_test:${Date.now()}`,
      read: false,
      createdAt: Date.now(),
    });
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
