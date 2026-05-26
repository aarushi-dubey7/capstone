import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const MAX_STUDENT_ID_LENGTH = 7;

async function assertTeacherManagesStudent(
  ctx: MutationCtx,
  teacherId: Id<"teachers">,
  studentId: Id<"students">,
) {
  const classes = await ctx.db
    .query("teacherClasses")
    .withIndex("by_teacherId", (q) => q.eq("teacherId", teacherId))
    .collect();
  const classIds = new Set(classes.map((classDoc) => classDoc._id.toString()));
  const rosterEntries = await ctx.db.query("classRosterEntries").collect();
  const isLinked = rosterEntries.some(
    (entry) =>
      entry.linkedStudentId?.toString() === studentId.toString() &&
      classIds.has(entry.classId.toString()),
  );
  if (!isLinked) {
    throw new Error("You can only manage students linked to your class rosters.");
  }
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeRoom(locationName: string) {
  return locationName.replace(/^Room\s+/i, "").trim().toLowerCase();
}

function formatActivityWithBlock(activity: { activityLabel: string; block?: string | null }) {
  return activity.block ? `${activity.activityLabel} · Block ${activity.block}` : activity.activityLabel;
}

function normalizeStudentId(studentId: string) {
  return studentId.trim();
}

function assertStudentIdLength(studentId: string) {
  if (studentId.length > MAX_STUDENT_ID_LENGTH) {
    throw new Error(`Password must be ${MAX_STUDENT_ID_LENGTH} characters or fewer.`);
  }
}

export const register = mutation({
  args: {
    name: v.string(),
    studentId: v.string(),
    email: v.optional(v.string()),
    role: v.union(v.literal("student"), v.literal("teacher")),
    grade: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const studentId = normalizeStudentId(args.studentId);
    assertStudentIdLength(studentId);

    const existing = await ctx.db
      .query("students")
      .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("students", { ...args, studentId, createdAt: Date.now() });
  },
});

export const getByStudentId = query({
  args: { studentId: v.string() },
  handler: async (ctx, { studentId }) => {
    const normalizedStudentId = normalizeStudentId(studentId);
    assertStudentIdLength(normalizedStudentId);

    return ctx.db
      .query("students")
      .withIndex("by_studentId", (q) => q.eq("studentId", normalizedStudentId))
      .first();
  },
});

export const login = query({
  args: {
    email: v.string(),
    studentId: v.string(),
  },
  handler: async (ctx, { email, studentId }) => {
    const normalizedStudentId = normalizeStudentId(studentId);
    assertStudentIdLength(normalizedStudentId);

    const student = await ctx.db
      .query("students")
      .withIndex("by_studentId", (q) => q.eq("studentId", normalizedStudentId))
      .first();
    if (!student) return null;
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

export const getInsights = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const [student, logs, explicitStatuses, allLogs, allRotations, classes, scheduledActivities] = await Promise.all([
      ctx.db.get(studentId),
      ctx.db
        .query("logs")
        .withIndex("by_student", (q) => q.eq("studentId", studentId))
        .order("desc")
        .collect(),
      ctx.db
        .query("attendanceStatus")
        .withIndex("by_student_and_date", (q) => q.eq("studentId", studentId))
        .collect(),
      ctx.db.query("logs").collect(),
      ctx.db.query("scheduleRotation").collect(),
      ctx.db.query("classes").collect(),
      ctx.db
        .query("scheduledActivities")
        .withIndex("by_student_and_date", (q) => q.eq("studentId", studentId))
        .collect(),
    ]);

    if (!student) return null;

    const classByRoom = new Map(classes.map((entry) => [entry.room.toLowerCase(), entry]));
    const logsByDate = new Map<string, typeof logs>();
    const explicitByDate = new Map(explicitStatuses.map((status) => [status.date, status]));
    const scheduledByDate = new Map<string, typeof scheduledActivities>();
    for (const activity of scheduledActivities) {
      const existing = scheduledByDate.get(activity.date) ?? [];
      existing.push(activity);
      scheduledByDate.set(activity.date, existing);
    }
    const schoolDays = new Set<string>();
    const today = localDateString();

    for (const rotation of allRotations) {
      if (rotation.dayLabel !== "No School" && rotation.date <= today) {
        schoolDays.add(rotation.date);
      }
    }
    if (schoolDays.size === 0) {
      for (const log of allLogs) {
        if (log.date <= today) schoolDays.add(log.date);
      }
    }

    for (const log of logs) {
      const existing = logsByDate.get(log.date) ?? [];
      existing.push(log);
      logsByDate.set(log.date, existing);
    }

    const dates = new Set<string>([...logsByDate.keys(), ...explicitByDate.keys(), ...scheduledByDate.keys()]);
    const attendanceByDay = [...dates]
      .sort((a, b) => b.localeCompare(a))
      .map((date) => {
        const dayLogs = [...(logsByDate.get(date) ?? [])].sort((a, b) => a.timestamp - b.timestamp);
        const explicit = explicitByDate.get(date);
        const scheduled = scheduledByDate.get(date) ?? [];
        const firstScheduled = scheduled[0] ?? null;
        const derivedStatus =
          explicit?.status ??
          (firstScheduled ? "activity" : dayLogs.length > 0 ? "present" : "unresolved");

        return {
          date,
          status: derivedStatus,
          activityLabel:
            explicit?.status === "activity"
              ? explicit.activityLabel ?? null
              : firstScheduled
                ? scheduled.map((activity) => formatActivityWithBlock(activity)).join(", ")
                : null,
          reason: explicit?.reason ?? null,
          entries: dayLogs.map((log) => {
            const classEntry = classByRoom.get(normalizeRoom(log.locationName));
            return {
              timestamp: log.timestamp,
              locationName: log.locationName,
              isLate: log.isLate,
              subject: classEntry?.subject ?? null,
              teacherName: classEntry?.teacherName ?? null,
              period: classEntry?.period ?? null,
            };
          }),
        };
      });

    let tardyCount = 0;
    let presentDays = 0;
    let absenceCount = 0;
    let activityCount = 0;
    let excusedCount = 0;

    for (const log of logs) {
      if (log.isLate) tardyCount += 1;
    }

    for (const date of schoolDays) {
      const explicit = explicitByDate.get(date);
      const dayLogs = logsByDate.get(date) ?? [];
      const scheduled = scheduledByDate.get(date)?.[0] ?? null;
      const derivedStatus =
        explicit?.status ?? (scheduled ? "activity" : dayLogs.length > 0 ? "present" : "unresolved");

      if (derivedStatus === "activity") {
        activityCount += 1;
      } else if (derivedStatus === "excused") {
        excusedCount += 1;
      } else if (derivedStatus === "absent" || derivedStatus === "unresolved") {
        absenceCount += 1;
      } else if (derivedStatus === "present") {
        presentDays += 1;
      }
    }

    const todayExplicit = explicitByDate.get(today);
    const todayLogs = logsByDate.get(today) ?? [];
    const todayScheduled = scheduledByDate.get(today)?.[0] ?? null;
    const currentDayStatus =
      todayExplicit?.status ??
      (todayScheduled ? "activity" : todayLogs.length > 0 ? "present" : "unresolved");

    return {
      student,
      stats: {
        tardyCount,
        absenceCount,
        activityCount,
        excusedCount,
        attendedDays: presentDays,
        totalSchoolDays: schoolDays.size,
        totalCheckIns: logs.length,
      },
      currentDayStatus,
      attendanceByDay,
      upcomingActivities: scheduledActivities
        .filter((activity) => activity.date >= today)
        .sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date);
          if (dateCompare !== 0) return dateCompare;
          return (a.block ?? "").localeCompare(b.block ?? "");
        }),
    };
  },
});

export const updatePasswordByTeacher = mutation({
  args: {
    teacherId: v.id("teachers"),
    studentId: v.id("students"),
    newPassword: v.string(),
  },
  handler: async (ctx, { teacherId, studentId, newPassword }) => {
    const teacher = await ctx.db.get(teacherId);
    if (!teacher) throw new Error("Teacher not found.");

    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found.");

    await assertTeacherManagesStudent(ctx, teacherId, studentId);

    const normalizedPassword = normalizeStudentId(newPassword);
    if (!normalizedPassword) {
      throw new Error("Password is required.");
    }
    assertStudentIdLength(normalizedPassword);

    if (normalizedPassword === student.studentId) {
      throw new Error("That is already this student's password.");
    }

    const taken = await ctx.db
      .query("students")
      .withIndex("by_studentId", (q) => q.eq("studentId", normalizedPassword))
      .first();
    if (taken && taken._id !== studentId) {
      throw new Error("That password is already used by another student.");
    }

    await ctx.db.patch(studentId, { studentId: normalizedPassword });

    const date = localDateString();
    const studentMessage = `Your teacher (${teacher.name}) updated your login password. Your new password is "${normalizedPassword}". Use it with your school email the next time you sign in.`;

    await ctx.db.insert("studentNotifications", {
      studentId,
      teacherId,
      message: studentMessage,
      type: "password_changed",
      read: false,
      createdAt: Date.now(),
    });

    await ctx.db.insert("notifications", {
      teacherId,
      studentId,
      date,
      message: `Password updated for ${student.name}. They were notified in the student portal to use their new password.`,
      type: "password_reset",
      dedupeKey: `password_reset:${studentId.toString()}:${Date.now()}`,
      read: false,
      createdAt: Date.now(),
    });

    return { studentId, newPassword: normalizedPassword };
  },
});

export const remove = mutation({
  args: { id: v.id("students") },
  handler: async (ctx, { id }) => {
    const student = await ctx.db.get(id);
    if (!student) return null;

    const [logs, schedules, statuses, activities, rosterEntries] = await Promise.all([
      ctx.db
        .query("logs")
        .withIndex("by_student", (q) => q.eq("studentId", id))
        .collect(),
      ctx.db
        .query("schedules")
        .withIndex("by_student", (q) => q.eq("studentId", id))
        .collect(),
      ctx.db
        .query("attendanceStatus")
        .withIndex("by_student_and_date", (q) => q.eq("studentId", id))
        .collect(),
      ctx.db
        .query("scheduledActivities")
        .withIndex("by_student_and_date", (q) => q.eq("studentId", id))
        .collect(),
      ctx.db
        .query("classRosterEntries")
        .withIndex("by_linkedStudentId", (q) => q.eq("linkedStudentId", id))
        .collect(),
    ]);

    for (const log of logs) await ctx.db.delete(log._id);
    for (const schedule of schedules) await ctx.db.delete(schedule._id);
    for (const status of statuses) await ctx.db.delete(status._id);
    for (const activity of activities) await ctx.db.delete(activity._id);
    for (const rosterEntry of rosterEntries) {
      await ctx.db.patch(rosterEntry._id, {
        linkedStudentId: undefined,
        status: "placeholder",
        updatedAt: Date.now(),
      });
    }

    await ctx.db.delete(id);
    return {
      deletedId: id,
      deletedName: student.name,
      deletedLogs: logs.length,
      deletedActivities: activities.length,
    };
  },
});
