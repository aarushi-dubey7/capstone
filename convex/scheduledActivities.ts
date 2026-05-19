import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

async function notifyTeachersForStudentActivity(
  ctx: MutationCtx,
  studentId: Id<"students">,
  date: string,
  activityLabel: string
) {
  const student = await ctx.db.get(studentId);
  if (!student) return;

  const rotation = await ctx.db
    .query("scheduleRotation")
    .withIndex("by_date", (q) => q.eq("date", date))
    .first();
  
  const dayLabel = rotation?.dayLabel;
  if (!dayLabel || dayLabel === "No School") return;

  const studentSchedules = await ctx.db
    .query("schedules")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  
  const todaySchedules = studentSchedules.filter(s => s.dayOfWeek === dayLabel);

  for (const schedule of todaySchedules) {
    const classesInRoom = await ctx.db
      .query("teacherClasses")
      .withIndex("by_room", q => q.eq("room", schedule.room))
      .collect();

    const matchingClass = classesInRoom.find(c => 
      c.active && 
      (c.rotationBlock === schedule.blockLabel || c.block === schedule.blockLabel)
    );

    if (matchingClass) {
      const existing = await ctx.db
        .query("notifications")
        .withIndex("by_teacher_date", q => q.eq("teacherId", matchingClass.teacherId).eq("date", date))
        .collect();
      
      const alreadyNotified = existing.some(n => n.studentId === studentId && n.type === "activity_recommendation");

      if (!alreadyNotified) {
        await ctx.db.insert("notifications", {
          teacherId: matchingClass.teacherId,
          studentId,
          date,
          message: `${student.name} is tagged in "${activityLabel}" on ${date}. Recommend marking as excused absence.`,
          type: "activity_recommendation",
          read: false,
          createdAt: Date.now(),
        });
      }
    }
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

    let id;
    if (existing) {
      await ctx.db.patch(existing._id, {
        activityLabel: args.activityLabel.trim(),
        notes: args.notes?.trim() || undefined,
        updatedAt: Date.now(),
      });
      id = existing._id;
    } else {
      id = await ctx.db.insert("scheduledActivities", {
        studentId: args.studentId,
        date: args.date,
        activityLabel: args.activityLabel.trim(),
        notes: args.notes?.trim() || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await notifyTeachersForStudentActivity(ctx, args.studentId, args.date, args.activityLabel);
    return id;
  },
});

export const createBatch = mutation({
  args: {
    studentIds: v.array(v.id("students")),
    date: v.string(),
    activityLabel: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertFutureOrToday(args.date);
    const results = [];
    for (const studentId of args.studentIds) {
      const existing = await ctx.db
        .query("scheduledActivities")
        .withIndex("by_student_and_date", (q) => q.eq("studentId", studentId).eq("date", args.date))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          activityLabel: args.activityLabel.trim(),
          notes: args.notes?.trim() || undefined,
          updatedAt: Date.now(),
        });
        results.push(existing._id);
      } else {
        const id = await ctx.db.insert("scheduledActivities", {
          studentId,
          date: args.date,
          activityLabel: args.activityLabel.trim(),
          notes: args.notes?.trim() || undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        results.push(id);
      }
      await notifyTeachersForStudentActivity(ctx, studentId, args.date, args.activityLabel);
    }
    return results;
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

    await notifyTeachersForStudentActivity(ctx, existing.studentId, args.date, args.activityLabel);
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
