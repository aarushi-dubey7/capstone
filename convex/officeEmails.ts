import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("mainOfficeEmails").order("desc").collect();
  },
});

export const add = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return ctx.db.insert("mainOfficeEmails", {
      email: email.trim().toLowerCase(),
      active: true,
      createdAt: Date.now(),
    });
  },
});

export const toggleActive = mutation({
  args: { id: v.id("mainOfficeEmails"), active: v.boolean() },
  handler: async (ctx, { id, active }) => {
    await ctx.db.patch(id, { active });
  },
});

export const remove = mutation({
  args: { id: v.id("mainOfficeEmails") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
