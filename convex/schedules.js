import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
const scheduleEntry = v.object({
    dayOfWeek: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    subject: v.string(),
    room: v.string(),
});
export const save = mutation({
    args: {
        studentId: v.id("students"),
        entries: v.array(scheduleEntry),
    },
    handler: async (ctx, { studentId, entries }) => {
        // Replace any existing schedule for this student
        const existing = await ctx.db
            .query("schedules")
            .withIndex("by_student", (q) => q.eq("studentId", studentId))
            .collect();
        for (const row of existing)
            await ctx.db.delete(row._id);
        for (const entry of entries)
            await ctx.db.insert("schedules", { studentId, ...entry });
    },
});
export const getForStudent = query({
    args: { studentId: v.id("students") },
    handler: async (ctx, { studentId }) => {
        return ctx.db
            .query("schedules")
            .withIndex("by_student", (q) => q.eq("studentId", studentId))
            .collect();
    },
});
