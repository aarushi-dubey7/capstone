import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

const DAY_LABELS = ["Day 1", "Day 2", "Day 3", "Day 4"] as const;
const ROTATION_BLOCK_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const ROTATION_DAY_SLOTS = {
  "Day 1": [
    { timeRange: "8:17-9:13", label: "A" },
    { timeRange: "9:15-10:08", label: "B" },
    { timeRange: "10:10-11:03", label: "C" },
    { timeRange: "11:05-11:35", label: "EP 1/Lunch" },
    { timeRange: "11:40-12:10", label: "EP 2/Lunch" },
    { timeRange: "12:12-1:05", label: "E" },
    { timeRange: "1:07-2:00", label: "F" },
    { timeRange: "2:02-2:55", label: "G" },
  ],
  "Day 2": [
    { timeRange: "8:17-9:13", label: "B" },
    { timeRange: "9:15-10:08", label: "C" },
    { timeRange: "10:10-11:03", label: "D" },
    { timeRange: "11:05-11:35", label: "EP 1/Lunch" },
    { timeRange: "11:40-12:10", label: "EP 2/Lunch" },
    { timeRange: "12:12-1:05", label: "F" },
    { timeRange: "1:07-2:00", label: "G" },
    { timeRange: "2:02-2:55", label: "H" },
  ],
  "Day 3": [
    { timeRange: "8:17-9:13", label: "C" },
    { timeRange: "9:15-10:08", label: "D" },
    { timeRange: "10:10-11:03", label: "A" },
    { timeRange: "11:05-11:35", label: "EP 1/Lunch" },
    { timeRange: "11:40-12:10", label: "EP 2/Lunch" },
    { timeRange: "12:12-1:05", label: "G" },
    { timeRange: "1:07-2:00", label: "H" },
    { timeRange: "2:02-2:55", label: "E" },
  ],
  "Day 4": [
    { timeRange: "8:17-9:13", label: "D" },
    { timeRange: "9:15-10:08", label: "A" },
    { timeRange: "10:10-11:03", label: "B" },
    { timeRange: "11:05-11:35", label: "EP 1/Lunch" },
    { timeRange: "11:40-12:10", label: "EP 2/Lunch" },
    { timeRange: "12:12-1:05", label: "H" },
    { timeRange: "1:07-2:00", label: "E" },
    { timeRange: "2:02-2:55", label: "F" },
  ],
} as const;

function now() {
  return Date.now();
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: string, offset: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + offset);
  return localDateString(next);
}

function monthStart(date: string) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(1);
  return localDateString(next);
}

function monthEnd(date: string) {
  const next = new Date(`${date}T00:00:00`);
  next.setMonth(next.getMonth() + 1, 0);
  return localDateString(next);
}

function normalizeBlock(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  if (normalized === "EP1/LUNCH") return "EP1";
  if (normalized === "EP2/LUNCH") return "EP2";
  return normalized;
}

function blockRunsOnDay(dayLabel: string, block: string | null) {
  if (!block) return false;
  const slots = ROTATION_DAY_SLOTS[dayLabel as keyof typeof ROTATION_DAY_SLOTS] ?? [];
  return slots.some((slot) => normalizeBlock(slot.label) === block);
}

function latestByStudentForDate(logs: Doc<"logs">[]) {
  const latest = new Map<string, Doc<"logs">>();
  for (const log of logs) {
    const key = `${log.studentId.toString()}-${log.date}`;
    const current = latest.get(key);
    if (!current || log.timestamp > current.timestamp) {
      latest.set(key, log);
    }
  }
  return latest;
}

function activityAppliesToClassBlock(activity: Doc<"scheduledActivities"> | null | undefined, block: string | null) {
  if (!activity) return false;
  const activityBlock = normalizeBlock(activity.block);
  if (!activityBlock) return true;
  if (!block) return false;
  return activityBlock === block;
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(name: string) {
  return normalizeName(name).split(" ").filter(Boolean);
}

function buildStudentCandidates(student: { _id: string; name: string; studentId: string; grade?: string }) {
  return {
    studentId: student._id,
    name: student.name,
    studentNumber: student.studentId,
    grade: student.grade ?? null,
  };
}

export const create = mutation({
  args: {
    teacherId: v.id("teachers"),
    name: v.string(),
    subject: v.optional(v.string()),
    block: v.string(),
    room: v.string(),
    grade: v.optional(v.string()),
    rotationBlock: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const validBlocks = ["A", "B", "C", "D", "E", "F", "G", "H", "EP1", "EP2"];
    if (!validBlocks.includes(args.block.toUpperCase())) {
      throw new Error("Invalid block. Must be A-H or EP1/EP2.");
    }
    const classId = await ctx.db.insert("teacherClasses", {
      teacherId: args.teacherId,
      name: args.name.trim(),
      subject: args.subject?.trim() || undefined,
      block: args.block.trim().toUpperCase(),
      room: args.room.trim(),
      grade: args.grade?.trim() || undefined,
      rotationBlock: args.rotationBlock?.trim() || undefined,
      active: true,
      createdAt: now(),
      updatedAt: now(),
    });
    return classId;
  },
});

export const update = mutation({
  args: {
    classId: v.id("teacherClasses"),
    name: v.optional(v.string()),
    block: v.optional(v.string()),
    room: v.optional(v.string()),
    subject: v.optional(v.string()),
    grade: v.optional(v.string()),
    rotationBlock: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { classId, ...rest }) => {
    const patch: Record<string, string | boolean | number | undefined> = {
      updatedAt: now(),
    };
    if (rest.name !== undefined) patch.name = rest.name.trim();
    if (rest.block !== undefined) {
      const validBlocks = ["A", "B", "C", "D", "E", "F", "G", "H", "EP1", "EP2"];
      if (!validBlocks.includes(rest.block.toUpperCase())) {
        throw new Error("Invalid block. Must be A-H or EP1/EP2.");
      }
      patch.block = rest.block.trim().toUpperCase();
    }
    if (rest.room !== undefined) patch.room = rest.room.trim();
    if (rest.subject !== undefined) patch.subject = rest.subject.trim() || undefined;
    if (rest.grade !== undefined) patch.grade = rest.grade.trim() || undefined;
    if (rest.rotationBlock !== undefined) patch.rotationBlock = rest.rotationBlock.trim() || undefined;
    if (rest.active !== undefined) patch.active = rest.active;
    await ctx.db.patch(classId, patch);
  },
});

export const remove = mutation({
  args: {
    classId: v.id("teacherClasses"),
    teacherId: v.id("teachers"),
  },
  handler: async (ctx, { classId, teacherId }) => {
    const classDoc = await ctx.db.get(classId);
    if (!classDoc || classDoc.teacherId !== teacherId) return null;

    const rosterEntries = await ctx.db
      .query("classRosterEntries")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    for (const entry of rosterEntries) {
      await ctx.db.delete(entry._id);
    }

    const dayBlocks = await ctx.db.query("teacherDayBlocks").collect();
    for (const block of dayBlocks) {
      if (block.teacherId === teacherId && block.classId === classId) {
        await ctx.db.delete(block._id);
      }
    }

    await ctx.db.delete(classId);
    return classId;
  },
});

export const listForTeacher = query({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, { teacherId }) => {
    const classes = await ctx.db
      .query("teacherClasses")
      .withIndex("by_teacherId", (q) => q.eq("teacherId", teacherId))
      .collect();
    return classes.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getClassDetails = query({
  args: {
    teacherId: v.id("teachers"),
    classId: v.id("teacherClasses"),
  },
  handler: async (ctx, { teacherId, classId }) => {
    const classDoc = await ctx.db.get(classId);
    if (!classDoc || classDoc.teacherId !== teacherId) return null;

    const [rosterEntries, students] = await Promise.all([
      ctx.db
        .query("classRosterEntries")
        .withIndex("by_classId", (q) => q.eq("classId", classId))
        .collect(),
      ctx.db.query("students").withIndex("by_role", (q) => q.eq("role", "student")).collect(),
    ]);

    const studentMap = new Map(students.map((student) => [student._id.toString(), student]));
    return {
      class: classDoc,
      roster: rosterEntries
        .map((entry) => ({
          ...entry,
          linkedStudent:
            entry.linkedStudentId ? studentMap.get(entry.linkedStudentId.toString()) ?? null : null,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    };
  },
});

export const getClassStats = query({
  args: {
    teacherId: v.id("teachers"),
    classId: v.id("teacherClasses"),
    range: v.union(v.literal("week"), v.literal("month"), v.literal("3months")),
    focusDate: v.optional(v.string()),
  },
  handler: async (ctx, { teacherId, classId, range, focusDate }) => {
    const classDoc = await ctx.db.get(classId);
    if (!classDoc || classDoc.teacherId !== teacherId) return null;

    const targetBlock = normalizeBlock(classDoc.block ?? classDoc.rotationBlock);
    const today = localDateString();
    const safeFocusDate = focusDate ?? today;
    const rangeStart =
      range === "week" ? addDays(today, -6) : range === "month" ? addDays(today, -29) : addDays(today, -89);
    const calendarStart = monthStart(safeFocusDate);
    const calendarEnd = monthEnd(safeFocusDate);
    const earliestDate = [rangeStart, calendarStart, safeFocusDate].sort()[0];

    const [rosterEntries, students, statusDocs, scheduledActivities, rotations] = await Promise.all([
      ctx.db
        .query("classRosterEntries")
        .withIndex("by_classId", (q) => q.eq("classId", classId))
        .collect(),
      ctx.db.query("students").withIndex("by_role", (q) => q.eq("role", "student")).collect(),
      ctx.db.query("attendanceStatus").collect(),
      ctx.db.query("scheduledActivities").collect(),
      ctx.db.query("scheduleRotation").collect(),
    ]);

    const linkedStudentIds = rosterEntries
      .filter((entry) => entry.linkedStudentId)
      .map((entry) => entry.linkedStudentId!);
    const linkedStudentIdSet = new Set(linkedStudentIds.map((id) => id.toString()));
    const linkedStudents = students
      .filter((student) => linkedStudentIdSet.has(student._id.toString()))
      .sort((a, b) => a.name.localeCompare(b.name));

    const logsByStudent = await Promise.all(
      linkedStudents.map(async (student) => ({
        studentId: student._id,
        logs: (await ctx.db
          .query("logs")
          .withIndex("by_student", (q) => q.eq("studentId", student._id))
          .collect()).filter((log) => log.date >= earliestDate && log.date <= today),
      })),
    );

    const relevantRotations = rotations
      .filter((rotation) => rotation.date >= earliestDate && rotation.date <= today && rotation.dayLabel !== "No School")
      .sort((a, b) => a.date.localeCompare(b.date));
    const classDates = relevantRotations
      .filter((rotation) => blockRunsOnDay(rotation.dayLabel, targetBlock))
      .map((rotation) => ({
        date: rotation.date,
        dayLabel: rotation.dayLabel,
        bellScheduleType: rotation.bellScheduleType ?? null,
      }));
    const classDateSet = new Set(classDates.map((entry) => entry.date));

    const relevantStatuses = statusDocs.filter(
      (status) => linkedStudentIdSet.has(status.studentId.toString()) && classDateSet.has(status.date),
    );
    const relevantActivities = scheduledActivities.filter(
      (activity) => linkedStudentIdSet.has(activity.studentId.toString()) && classDateSet.has(activity.date),
    );
    const statusByStudentAndDate = new Map(
      relevantStatuses.map((status) => [`${status.studentId.toString()}-${status.date}`, status]),
    );
    const activityByStudentAndDate = new Map(
      relevantActivities
        .filter((activity) => activityAppliesToClassBlock(activity, targetBlock))
        .map((activity) => [`${activity.studentId.toString()}-${activity.date}`, activity]),
    );
    const allRelevantLogs = logsByStudent.flatMap((entry) => entry.logs.filter((log) => classDateSet.has(log.date)));
    const latestLogByStudentAndDate = latestByStudentForDate(allRelevantLogs);

    const summarizedDates = classDates.map((classDate) => {
      const studentsForDate = linkedStudents.map((student) => {
        const key = `${student._id.toString()}-${classDate.date}`;
        const explicit = statusByStudentAndDate.get(key) ?? null;
        const scheduledActivity = activityByStudentAndDate.get(key) ?? null;
        const latestLog = latestLogByStudentAndDate.get(key) ?? null;
        const status =
          explicit?.status ??
          (scheduledActivity ? "activity" : latestLog ? "present" : "unresolved");

        return {
          studentId: student._id,
          name: student.name,
          studentNumber: student.studentId,
          grade: student.grade ?? null,
          status,
          isLate: latestLog?.isLate ?? false,
          activityLabel:
            explicit?.status === "activity"
              ? explicit.activityLabel ?? null
              : scheduledActivity?.activityLabel ?? null,
          latestCheckInTime: latestLog?.timestamp ?? null,
          latestLocationName: latestLog?.locationName ?? null,
        };
      });

      return {
        ...classDate,
        summary: {
          present: studentsForDate.filter((student) => student.status === "present").length,
          absent: studentsForDate.filter((student) => student.status === "absent").length,
          excused: studentsForDate.filter((student) => student.status === "excused").length,
          activity: studentsForDate.filter((student) => student.status === "activity").length,
          unresolved: studentsForDate.filter((student) => student.status === "unresolved").length,
          tardy: studentsForDate.filter((student) => student.isLate).length,
        },
        students: studentsForDate,
      };
    });

    const rangeDates = summarizedDates.filter((entry) => entry.date >= rangeStart && entry.date <= today);
    const focusDateSummary =
      summarizedDates.find((entry) => entry.date === safeFocusDate) ?? null;
    const calendarDates = summarizedDates.filter(
      (entry) => entry.date >= calendarStart && entry.date <= calendarEnd,
    );

    return {
      class: {
        _id: classDoc._id,
        name: classDoc.name,
        subject: classDoc.subject ?? null,
        room: classDoc.room,
        grade: classDoc.grade ?? null,
        block: classDoc.block ?? null,
        rotationBlock: classDoc.rotationBlock ?? null,
      },
      linkedStudentCount: linkedStudents.length,
      range,
      rangeStart,
      rangeEnd: today,
      summary: {
        classDates: rangeDates.length,
        present: rangeDates.reduce((sum, entry) => sum + entry.summary.present, 0),
        absent: rangeDates.reduce((sum, entry) => sum + entry.summary.absent, 0),
        excused: rangeDates.reduce((sum, entry) => sum + entry.summary.excused, 0),
        activity: rangeDates.reduce((sum, entry) => sum + entry.summary.activity, 0),
        tardy: rangeDates.reduce((sum, entry) => sum + entry.summary.tardy, 0),
      },
      dates: rangeDates.sort((a, b) => b.date.localeCompare(a.date)),
      focusDate: safeFocusDate,
      focusDateSummary,
      calendarMonth: {
        monthStart: calendarStart,
        monthEnd: calendarEnd,
        dates: calendarDates,
      },
    };
  },
});

export const previewRosterMatches = query({
  args: {
    names: v.array(v.string()),
  },
  handler: async (ctx, { names }) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_role", (q) => q.eq("role", "student"))
      .collect();

    return names
      .map((rawName) => rawName.trim())
      .filter(Boolean)
      .map((displayName) => {
        const normalized = normalizeName(displayName);
        const tokens = nameTokens(displayName);
        const exactMatches = students.filter((student) => normalizeName(student.name) === normalized);
        if (exactMatches.length === 1) {
          const exact = exactMatches[0];
          return {
            displayName,
            matchType: "exact" as const,
            suggestedStudentId: exact._id,
            candidates: [buildStudentCandidates(exact)],
          };
        }

        const candidates = students.filter((student) => {
          const candidateTokens = nameTokens(student.name);
          return tokens.every((token) => candidateTokens.some((candidateToken) => candidateToken.startsWith(token)));
        });

        if (candidates.length === 1) {
          return {
            displayName,
            matchType: "likely" as const,
            suggestedStudentId: candidates[0]._id,
            candidates: candidates.map((student) => buildStudentCandidates(student)),
          };
        }

        return {
          displayName,
          matchType: candidates.length > 1 ? ("ambiguous" as const) : ("unmatched" as const),
          suggestedStudentId: null,
          candidates: candidates.slice(0, 5).map((student) => buildStudentCandidates(student)),
        };
      });
  },
});

export const saveUploadedRoster = mutation({
  args: {
    teacherId: v.id("teachers"),
    classId: v.id("teacherClasses"),
    entries: v.array(
      v.object({
        displayName: v.string(),
        linkedStudentId: v.union(v.id("students"), v.null()),
      }),
    ),
  },
  handler: async (ctx, { teacherId, classId, entries }) => {
    const classDoc = await ctx.db.get(classId);
    if (!classDoc || classDoc.teacherId !== teacherId) {
      throw new Error("Class not found.");
    }

    const existing = await ctx.db
      .query("classRosterEntries")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    for (const entry of existing) {
      if (entry.source === "uploaded") {
        await ctx.db.delete(entry._id);
      }
    }

    const timestamp = now();
    for (const entry of entries) {
      await ctx.db.insert("classRosterEntries", {
        classId,
        displayName: entry.displayName.trim(),
        linkedStudentId: entry.linkedStudentId ?? undefined,
        source: "uploaded",
        status: entry.linkedStudentId ? "linked" : "placeholder",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    await ctx.db.patch(classId, { updatedAt: timestamp });
  },
});

export const addManualRosterEntry = mutation({
  args: {
    teacherId: v.id("teachers"),
    classId: v.id("teacherClasses"),
    displayName: v.string(),
    linkedStudentId: v.optional(v.id("students")),
  },
  handler: async (ctx, args) => {
    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.teacherId !== args.teacherId) {
      throw new Error("Class not found.");
    }

    let displayName = args.displayName.trim();
    if (args.linkedStudentId) {
      const student = await ctx.db.get(args.linkedStudentId);
      if (!student) throw new Error("Student not found.");
      if (!displayName) displayName = student.name;
    }
    if (!displayName) {
      throw new Error("Display name is required.");
    }

    return ctx.db.insert("classRosterEntries", {
      classId: args.classId,
      displayName,
      linkedStudentId: args.linkedStudentId,
      source: "manual",
      status: args.linkedStudentId ? "linked" : "placeholder",
      createdAt: now(),
      updatedAt: now(),
    });
  },
});

export const updateRosterEntryDisplayName = mutation({
  args: {
    teacherId: v.id("teachers"),
    rosterEntryId: v.id("classRosterEntries"),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const displayName = args.displayName.trim();
    if (!displayName) {
      throw new Error("Display name is required.");
    }

    const rosterEntry = await ctx.db.get(args.rosterEntryId);
    if (!rosterEntry) throw new Error("Roster entry not found.");
    const classDoc = await ctx.db.get(rosterEntry.classId);
    if (!classDoc || classDoc.teacherId !== args.teacherId) {
      throw new Error("Class not found.");
    }

    await ctx.db.patch(args.rosterEntryId, {
      displayName,
      updatedAt: now(),
    });
    await ctx.db.patch(rosterEntry.classId, { updatedAt: now() });
    return args.rosterEntryId;
  },
});

export const linkRosterEntry = mutation({
  args: {
    teacherId: v.id("teachers"),
    rosterEntryId: v.id("classRosterEntries"),
    linkedStudentId: v.id("students"),
  },
  handler: async (ctx, args) => {
    const rosterEntry = await ctx.db.get(args.rosterEntryId);
    if (!rosterEntry) throw new Error("Roster entry not found.");
    const classDoc = await ctx.db.get(rosterEntry.classId);
    if (!classDoc || classDoc.teacherId !== args.teacherId) {
      throw new Error("Class not found.");
    }
    const student = await ctx.db.get(args.linkedStudentId);
    if (!student) throw new Error("Student not found.");

    await ctx.db.patch(args.rosterEntryId, {
      linkedStudentId: args.linkedStudentId,
      displayName: rosterEntry.displayName || student.name,
      status: "linked",
      updatedAt: now(),
    });
  },
});

export const removeRosterEntry = mutation({
  args: {
    teacherId: v.id("teachers"),
    rosterEntryId: v.id("classRosterEntries"),
  },
  handler: async (ctx, args) => {
    const rosterEntry = await ctx.db.get(args.rosterEntryId);
    if (!rosterEntry) return null;
    const classDoc = await ctx.db.get(rosterEntry.classId);
    if (!classDoc || classDoc.teacherId !== args.teacherId) return null;
    await ctx.db.delete(args.rosterEntryId);
    return args.rosterEntryId;
  },
});

export const saveDayAssignments = mutation({
  args: {
    teacherId: v.id("teachers"),
    dayLabel: v.string(),
    assignments: v.array(
      v.object({
        blockLabel: v.string(),
        classId: v.union(v.id("teacherClasses"), v.null()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teacherDayBlocks")
      .withIndex("by_teacherId_and_dayLabel", (q) => q.eq("teacherId", args.teacherId).eq("dayLabel", args.dayLabel))
      .collect();

    for (const entry of existing) {
      await ctx.db.delete(entry._id);
    }

    for (const assignment of args.assignments) {
      if (!assignment.classId) continue;
      await ctx.db.insert("teacherDayBlocks", {
        teacherId: args.teacherId,
        dayLabel: args.dayLabel,
        blockLabel: assignment.blockLabel,
        classId: assignment.classId,
        updatedAt: now(),
      });
    }
  },
});

export const getDayAssignments = query({
  args: {
    teacherId: v.id("teachers"),
  },
  handler: async (ctx, { teacherId }) => {
    const classes = await ctx.db
      .query("teacherClasses")
      .withIndex("by_teacherId", (q) => q.eq("teacherId", teacherId))
      .collect();

    const classByRotationBlock = new Map(
      classes
        .filter((classDoc) => classDoc.rotationBlock && ROTATION_BLOCK_OPTIONS.includes(classDoc.rotationBlock))
        .map((classDoc) => [classDoc.rotationBlock!, classDoc]),
    );

    const grouped: Record<
      string,
      Array<{
        timeRange: string;
        blockLabel: string;
        classId: string | null;
        className: string | null;
        room: string | null;
        subject: string | null;
      }>
    > = {};

    for (const dayLabel of DAY_LABELS) {
      grouped[dayLabel] = ROTATION_DAY_SLOTS[dayLabel].map((slot) => {
        const classDoc = classByRotationBlock.get(slot.label) ?? null;
        return {
          timeRange: slot.timeRange,
          blockLabel: slot.label,
          classId: classDoc?._id ?? null,
          className: classDoc?.name ?? null,
          room: classDoc?.room ?? null,
          subject: classDoc?.subject ?? null,
        };
      });
    }

    return grouped;
  },
});

export const getTeacherStudentDirectory = query({
  args: {
    teacherId: v.id("teachers"),
  },
  handler: async (ctx, { teacherId }) => {
    const teacherClasses = await ctx.db
      .query("teacherClasses")
      .withIndex("by_teacherId", (q) => q.eq("teacherId", teacherId))
      .collect();
    const classMap = new Map(teacherClasses.map((classDoc) => [classDoc._id.toString(), classDoc]));
    const classIds = new Set(teacherClasses.map((classDoc) => classDoc._id.toString()));

    const allEntries = await ctx.db.query("classRosterEntries").collect();
    const linkedEntries = allEntries.filter(
      (entry) => entry.linkedStudentId && classIds.has(entry.classId.toString()),
    );
    const linkedStudentIds = new Set(linkedEntries.map((entry) => entry.linkedStudentId!.toString()));
    const students = await ctx.db
      .query("students")
      .withIndex("by_role", (q) => q.eq("role", "student"))
      .collect();

    return students
      .filter((student) => linkedStudentIds.has(student._id.toString()))
      .map((student) => {
        const linkedClasses = linkedEntries
          .filter((entry) => entry.linkedStudentId?.toString() === student._id.toString())
          .map((entry) => classMap.get(entry.classId.toString()))
          .filter((classDoc): classDoc is NonNullable<typeof classDoc> => classDoc !== undefined)
          .map((classDoc) => ({
            classId: classDoc._id,
            className: classDoc.name,
            block: classDoc.block,
            room: classDoc.room,
          }))
          .sort((a, b) => a.className.localeCompare(b.className));

        return {
          _id: student._id,
          name: student.name,
          studentId: student.studentId,
          email: student.email ?? null,
          grade: student.grade ?? null,
          linkedClasses,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});
