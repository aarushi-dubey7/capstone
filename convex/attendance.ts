import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const DEFAULT_TARDY_THRESHOLD = 3;
const DEFAULT_REMINDER_MINUTES = 15;
const VALID_CLASS_BLOCKS = ["A", "B", "C", "D", "E", "F", "G", "H", "EP1", "EP2"] as const;
const ROTATION_DAY_SLOTS = {
  "Day 1": ["A", "B", "C", "EP 1/Lunch", "EP 2/Lunch", "E", "F", "G"],
  "Day 2": ["B", "C", "D", "EP 1/Lunch", "EP 2/Lunch", "F", "G", "H"],
  "Day 3": ["C", "D", "A", "EP 1/Lunch", "EP 2/Lunch", "G", "H", "E"],
  "Day 4": ["D", "A", "B", "EP 1/Lunch", "EP 2/Lunch", "H", "E", "F"],
} as const;

const attendanceStatusValidator = v.union(
  v.literal("present"),
  v.literal("absent"),
  v.literal("activity"),
  v.literal("excused"),
  v.literal("unresolved"),
);

type AttendanceStatus = "present" | "absent" | "activity" | "excused" | "unresolved";

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRoomCode(locationName: string) {
  return locationName.replace(/^Room\s+/i, "").trim().toLowerCase();
}

function parseTimeToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function isLateForTime(startTime: string, now = new Date()) {
  const scheduleMinutes = parseTimeToMinutes(startTime);
  if (scheduleMinutes === null) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > scheduleMinutes + 5;
}

function latestByStudent(logs: Doc<"logs">[]) {
  const latest = new Map<string, Doc<"logs">>();
  for (const log of logs) {
    const key = log.studentId.toString();
    const current = latest.get(key);
    if (!current || log.timestamp > current.timestamp) {
      latest.set(key, log);
    }
  }
  return latest;
}

function uniqueLabels(values: string[]) {
  return [...new Set(values)].filter(Boolean);
}

function normalizeClassBlock(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  if (normalized === "EP1/LUNCH") return "EP1";
  if (normalized === "EP2/LUNCH") return "EP2";
  return VALID_CLASS_BLOCKS.includes(normalized as (typeof VALID_CLASS_BLOCKS)[number]) ? normalized : normalized;
}

function activityAppliesToBlock(
  activity: Doc<"scheduledActivities"> | null | undefined,
  activeBlock: string | null,
) {
  if (!activity) return false;
  const activityBlock = normalizeClassBlock(activity.block);
  if (!activityBlock) return true;
  if (!activeBlock) return false;
  return activityBlock === normalizeClassBlock(activeBlock);
}

async function loadSettings(ctx: QueryCtx | MutationCtx) {
  const settings = await ctx.db.query("attendanceSettings").first();
  return settings ?? {
    _id: "default" as Id<"attendanceSettings">,
    _creationTime: 0,
    tardyThreshold: DEFAULT_TARDY_THRESHOLD,
    reminderMinutesAfterStart: DEFAULT_REMINDER_MINUTES,
  };
}

async function upsertAttendanceStatus(
  ctx: MutationCtx,
  args: {
    studentId: Id<"students">;
    date: string;
    status: AttendanceStatus;
    source: "teacher" | "self_check_in" | "system";
    activityLabel?: string;
    reason?: string;
  },
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("attendanceStatus")
    .withIndex("by_student_and_date", (q) => q.eq("studentId", args.studentId).eq("date", args.date))
    .first();
  const patch = {
    status: args.status,
    source: args.source,
    updatedAt: now,
    activityLabel: args.status === "activity" ? args.activityLabel : undefined,
    reason: args.reason,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }

  return ctx.db.insert("attendanceStatus", {
    studentId: args.studentId,
    date: args.date,
    status: args.status,
    source: args.source,
    updatedAt: now,
    activityLabel: args.status === "activity" ? args.activityLabel : undefined,
    reason: args.reason,
  });
}

async function getBellScheduleStartInfo(
  ctx: QueryCtx | MutationCtx,
  date: string,
) {
  const rotation = await ctx.db
    .query("scheduleRotation")
    .withIndex("by_date", (q) => q.eq("date", date))
    .first();
  const bellType = rotation?.bellScheduleType ?? "Standard";
  const bellSchedule = await ctx.db
    .query("bellSchedules")
    .withIndex("by_type", (q) => q.eq("type", bellType))
    .first();
  return { rotation, bellType, bellSchedule };
}

async function getTeacherAssignmentContext(
  ctx: QueryCtx | MutationCtx,
  args: {
    teacherId: Id<"teachers">;
    date: string;
    dayLabel?: string;
    blockLabel?: string;
  },
) {
  const [{ rotation, bellSchedule }, teacherClasses] = await Promise.all([
    getBellScheduleStartInfo(ctx, args.date),
    ctx.db
      .query("teacherClasses")
      .withIndex("by_teacherId", (q) => q.eq("teacherId", args.teacherId))
      .collect(),
  ]);

  const classMap = new Map(teacherClasses.map((classDoc) => [classDoc._id.toString(), classDoc]));
  const effectiveDayLabel = args.dayLabel ?? rotation?.dayLabel ?? null;
  const slotLabels = effectiveDayLabel
    ? [...(ROTATION_DAY_SLOTS[effectiveDayLabel as keyof typeof ROTATION_DAY_SLOTS] ?? [])]
    : [];
  const assignments = slotLabels
    .map((blockLabel) => {
      const classDoc =
        teacherClasses.find((entry) => entry.rotationBlock === blockLabel) ?? null;
      return classDoc
        ? {
            _id: `${args.teacherId.toString()}-${effectiveDayLabel}-${blockLabel}` as Id<"teacherDayBlocks">,
            _creationTime: 0,
            teacherId: args.teacherId,
            dayLabel: effectiveDayLabel!,
            blockLabel,
            classId: classDoc._id,
            updatedAt: classDoc.updatedAt,
          }
        : null;
    })
    .filter((assignment): assignment is NonNullable<typeof assignment> => assignment !== null);
  const blockOptions = slotLabels.length
    ? uniqueLabels(slotLabels)
    : uniqueLabels(bellSchedule?.blocks.map((block) => block.label) ?? []);
  const selectedBlockLabel =
    args.blockLabel ??
    assignments.find((assignment) => classMap.has(assignment.classId.toString()))?.blockLabel ??
    blockOptions[0] ??
    null;
  const activeAssignment =
    selectedBlockLabel === null
      ? null
      : assignments.find((assignment) => assignment.blockLabel === selectedBlockLabel) ?? null;
  const activeClass =
    activeAssignment === null ? null : classMap.get(activeAssignment.classId.toString()) ?? null;

  return {
    rotation,
    bellSchedule,
    teacherClasses,
    classMap,
    effectiveDayLabel,
    assignments,
    blockOptions,
    selectedBlockLabel,
    activeAssignment,
    activeClass,
  };
}

export const markPresent = mutation({
  args: {
    studentId: v.id("students"),
    locationUuid: v.string(),
    locationName: v.string(),
  },
  handler: async (ctx, { studentId, locationUuid, locationName }) => {
    const now = Date.now();
    const today = new Date();
    const date = localDateString(today);
    const { bellType, bellSchedule } = await getBellScheduleStartInfo(ctx, date);

    const roomCode = locationName.replace("Room ", "").trim();
    const classEntry = await ctx.db
      .query("classes")
      .withIndex("by_room", (q) => q.eq("room", roomCode))
      .first();

    let isLate = false;
    if (classEntry?.period) {
      const block = bellSchedule?.blocks.find((entry) => entry.label === classEntry.period);
      if (block) {
        isLate = isLateForTime(block.start, today);
      }
    }

    await ctx.db.insert("logs", {
      studentId,
      locationUuid,
      locationName,
      timestamp: now,
      date,
      isLate,
    });

    await upsertAttendanceStatus(ctx, {
      studentId,
      date,
      status: "present",
      source: "self_check_in",
      reason: bellType === "Standard" ? undefined : `Self check-in during ${bellType} schedule`,
    });

    return { success: true, isLate };
  },
});

export const getTodayLogs = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("logs")
      .withIndex("by_date", (q) => q.eq("date", localDateString()))
      .order("desc")
      .collect();
  },
});

export const getStudentLogs = query({
  args: { studentId: v.id("students"), date: v.optional(v.string()) },
  handler: async (ctx, { studentId, date }) => {
    return ctx.db
      .query("logs")
      .withIndex("by_student_date", (q) => q.eq("studentId", studentId).eq("date", date ?? localDateString()))
      .order("asc")
      .collect();
  },
});

export const getLiveLocations = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_date", (q) => q.eq("date", localDateString()))
      .order("desc")
      .collect();
    return [...latestByStudent(logs).values()].sort((a, b) => b.timestamp - a.timestamp);
  },
});

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("attendanceSettings").first();
    return settings ?? {
      tardyThreshold: DEFAULT_TARDY_THRESHOLD,
      reminderMinutesAfterStart: DEFAULT_REMINDER_MINUTES,
    };
  },
});

export const updateSettings = mutation({
  args: {
    tardyThreshold: v.optional(v.number()),
    reminderMinutesAfterStart: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("attendanceSettings").first();
    const next = {
      tardyThreshold: args.tardyThreshold ?? existing?.tardyThreshold ?? DEFAULT_TARDY_THRESHOLD,
      reminderMinutesAfterStart:
        args.reminderMinutesAfterStart ?? existing?.reminderMinutesAfterStart ?? DEFAULT_REMINDER_MINUTES,
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }

    return ctx.db.insert("attendanceSettings", next);
  },
});

export const setStudentStatus = mutation({
  args: {
    studentId: v.id("students"),
    date: v.optional(v.string()),
    status: attendanceStatusValidator,
    activityLabel: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.status === "activity" && !args.activityLabel?.trim()) {
      throw new Error("Activity label is required when marking a student for an activity.");
    }

    const date = args.date ?? localDateString();
    await upsertAttendanceStatus(ctx, {
      studentId: args.studentId,
      date,
      status: args.status,
      source: "teacher",
      activityLabel: args.activityLabel?.trim() || undefined,
      reason: args.reason?.trim() || undefined,
    });

    return { success: true };
  },
});

export const batchMarkUnresolvedAbsent = mutation({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    const targetDate = date ?? localDateString();
    const students = await ctx.db
      .query("students")
      .withIndex("by_role", (q) => q.eq("role", "student"))
      .collect();
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_date", (q) => q.eq("date", targetDate))
      .collect();
    const statuses = await ctx.db
      .query("attendanceStatus")
      .withIndex("by_date_and_status", (q) => q.eq("date", targetDate))
      .collect();
    const scheduledActivities = await ctx.db
      .query("scheduledActivities")
      .withIndex("by_date", (q) => q.eq("date", targetDate))
      .collect();

    const latestLogs = latestByStudent(logs);
    const statusByStudent = new Map(statuses.map((status) => [status.studentId.toString(), status]));
    const activityByStudent = new Map(
      scheduledActivities.map((activity) => [activity.studentId.toString(), activity]),
    );

    let updated = 0;
    for (const student of students) {
      const studentKey = student._id.toString();
      const explicit = statusByStudent.get(studentKey);
      const hasLog = latestLogs.has(studentKey);
      const hasScheduledActivity = activityByStudent.has(studentKey);
      const derivedStatus =
        explicit?.status ??
        (hasScheduledActivity ? "activity" : hasLog ? "present" : "unresolved");

      if (derivedStatus !== "unresolved") continue;

      await upsertAttendanceStatus(ctx, {
        studentId: student._id,
        date: targetDate,
        status: "absent",
        source: "teacher",
        reason: "Marked from batch unresolved action",
      });
      updated += 1;
    }

    return { updated };
  },
});

export const getRoster = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    const targetDate = date ?? localDateString();
    const [students, todayLogs, statuses, scheduledActivities, settings, allLogs, classes] = await Promise.all([
      ctx.db.query("students").withIndex("by_role", (q) => q.eq("role", "student")).collect(),
      ctx.db.query("logs").withIndex("by_date", (q) => q.eq("date", targetDate)).collect(),
      ctx.db.query("attendanceStatus").withIndex("by_date_and_status", (q) => q.eq("date", targetDate)).collect(),
      ctx.db.query("scheduledActivities").withIndex("by_date", (q) => q.eq("date", targetDate)).collect(),
      loadSettings(ctx),
      ctx.db.query("logs").collect(),
      ctx.db.query("classes").collect(),
    ]);

    const latestLogs = latestByStudent(todayLogs);
    const statusByStudent = new Map(statuses.map((status) => [status.studentId.toString(), status]));
    const activityByStudent = new Map(
      scheduledActivities.map((activity) => [activity.studentId.toString(), activity]),
    );
    const classByRoom = new Map(classes.map((classEntry) => [classEntry.room.toLowerCase(), classEntry]));
    const tardyCountByStudent = new Map<string, number>();

    for (const log of allLogs) {
      if (!log.isLate) continue;
      const key = log.studentId.toString();
      tardyCountByStudent.set(key, (tardyCountByStudent.get(key) ?? 0) + 1);
    }

    const rows = students
      .map((student) => {
        const key = student._id.toString();
        const latestLog = latestLogs.get(key) ?? null;
        const explicit = statusByStudent.get(key) ?? null;
        const scheduledActivity = activityByStudent.get(key) ?? null;
        const tardyCount = tardyCountByStudent.get(key) ?? 0;
        const derivedStatus: AttendanceStatus =
          explicit?.status ??
          (scheduledActivity ? "activity" : latestLog ? "present" : "unresolved");
        const roomCode = latestLog ? formatRoomCode(latestLog.locationName) : null;
        const classEntry = roomCode ? classByRoom.get(roomCode) ?? null : null;

        return {
          studentId: student._id,
          name: student.name,
          studentNumber: student.studentId,
          email: student.email ?? null,
          grade: student.grade ?? null,
          status: derivedStatus,
          explicitStatus: explicit?.status ?? null,
          source: explicit?.source ?? null,
          activityLabel:
            explicit?.status === "activity"
              ? explicit.activityLabel ?? null
              : scheduledActivity?.activityLabel ?? null,
          reason: explicit?.reason ?? null,
          latestCheckInTime: latestLog?.timestamp ?? null,
          latestLocationName: latestLog?.locationName ?? null,
          latestRoom: roomCode ? roomCode.toUpperCase() : null,
          subject: classEntry?.subject ?? null,
          teacherName: classEntry?.teacherName ?? null,
          period: classEntry?.period ?? null,
          isLateToday: latestLog?.isLate ?? false,
          tardyCount,
          thresholdReached: tardyCount >= settings.tardyThreshold,
          scheduledActivityId: scheduledActivity?._id ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const summary = {
      present: rows.filter((row) => row.status === "present").length,
      absent: rows.filter((row) => row.status === "absent").length,
      activityExcused: rows.filter((row) => row.status === "activity" || row.status === "excused").length,
      unresolved: rows.filter((row) => row.status === "unresolved").length,
      tardy: rows.filter((row) => row.isLateToday).length,
    };

    const { rotation, bellSchedule } = await getBellScheduleStartInfo(ctx, targetDate);
    const firstBlockStart = bellSchedule?.blocks[0]?.start ?? null;
    const reminderCutoff =
      firstBlockStart === null
        ? null
        : (() => {
            const minutes = parseTimeToMinutes(firstBlockStart);
            if (minutes === null) return null;
            return minutes + settings.reminderMinutesAfterStart;
          })();
    const now = new Date();
    const shouldShowReminder =
      targetDate === localDateString(now) &&
      summary.unresolved > 0 &&
      reminderCutoff !== null &&
      now.getHours() * 60 + now.getMinutes() >= reminderCutoff;

    return {
      date: targetDate,
      rotation,
      settings: {
        tardyThreshold: settings.tardyThreshold,
        reminderMinutesAfterStart: settings.reminderMinutesAfterStart,
      },
      summary,
      shouldShowReminder,
      firstBlockStart,
      students: rows,
    };
  },
});

export const getTeacherRoster = query({
  args: {
    teacherId: v.id("teachers"),
    date: v.optional(v.string()),
    dayLabel: v.optional(v.string()),
    blockLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetDate = args.date ?? localDateString();
    const settings = await loadSettings(ctx);
    const assignmentContext = await getTeacherAssignmentContext(ctx, {
      teacherId: args.teacherId,
      date: targetDate,
      dayLabel: args.dayLabel,
      blockLabel: args.blockLabel,
    });

    const rosterEntries = assignmentContext.activeClass
      ? await ctx.db
          .query("classRosterEntries")
          .withIndex("by_classId", (q) => q.eq("classId", assignmentContext.activeClass!._id))
          .collect()
      : [];
    const linkedEntries = rosterEntries.filter((entry) => entry.linkedStudentId);
    const linkedStudents = (
      await Promise.all(linkedEntries.map((entry) => ctx.db.get(entry.linkedStudentId!)))
    ).filter((student): student is NonNullable<typeof student> => student !== null && student.role === "student");
    const studentIds = new Set(linkedStudents.map((student) => student._id.toString()));
    const activeBlockCode = normalizeClassBlock(
      assignmentContext.activeClass?.block ?? assignmentContext.selectedBlockLabel,
    );

    const [statusDocs, scheduledActivities, allLogsByStudent] = await Promise.all([
      ctx.db
        .query("attendanceStatus")
        .withIndex("by_date_and_status", (q) => q.eq("date", targetDate))
        .collect(),
      ctx.db
        .query("scheduledActivities")
        .withIndex("by_date", (q) => q.eq("date", targetDate))
        .collect(),
      Promise.all(
        linkedStudents.map(async (student) => ({
          studentId: student._id.toString(),
          logs: await ctx.db
            .query("logs")
            .withIndex("by_student", (q) => q.eq("studentId", student._id))
            .order("desc")
            .collect(),
        })),
      ),
    ]);

    const filteredStatuses = statusDocs.filter((status) => studentIds.has(status.studentId.toString()));
    const filteredActivities = scheduledActivities.filter(
      (activity) =>
        studentIds.has(activity.studentId.toString()) &&
        activityAppliesToBlock(activity, activeBlockCode),
    );
    const statusByStudent = new Map(filteredStatuses.map((status) => [status.studentId.toString(), status]));
    const activityByStudent = new Map(filteredActivities.map((activity) => [activity.studentId.toString(), activity]));
    const todayLogs = allLogsByStudent.flatMap((entry) => entry.logs.filter((log) => log.date === targetDate));
    const latestLogs = latestByStudent(todayLogs);
    const tardyCountByStudent = new Map<string, number>();

    for (const entry of allLogsByStudent) {
      tardyCountByStudent.set(
        entry.studentId,
        entry.logs.reduce((count, log) => count + (log.isLate ? 1 : 0), 0),
      );
    }

    const rows = linkedStudents
      .map((student) => {
        const key = student._id.toString();
        const latestLog = latestLogs.get(key) ?? null;
        const explicit = statusByStudent.get(key) ?? null;
        const scheduledActivity = activityByStudent.get(key) ?? null;
        const tardyCount = tardyCountByStudent.get(key) ?? 0;
        const status: AttendanceStatus =
          explicit?.status ??
          (scheduledActivity ? "activity" : latestLog ? "present" : "unresolved");
        const recommendedAction =
          scheduledActivity && explicit?.status !== "activity" ? "activity" : null;

        return {
          studentId: student._id,
          name: student.name,
          studentNumber: student.studentId,
          email: student.email ?? null,
          grade: student.grade ?? null,
          status,
          explicitStatus: explicit?.status ?? null,
          activityLabel:
            explicit?.status === "activity"
              ? explicit.activityLabel ?? null
              : scheduledActivity?.activityLabel ?? null,
          reason: explicit?.reason ?? null,
          latestCheckInTime: latestLog?.timestamp ?? null,
          latestLocationName: latestLog?.locationName ?? null,
          latestRoom: latestLog ? formatRoomCode(latestLog.locationName).toUpperCase() : null,
          className: assignmentContext.activeClass?.name ?? null,
          block: assignmentContext.activeClass?.block ?? null,
          assignedRoom: assignmentContext.activeClass?.room ?? null,
          blockLabel: assignmentContext.selectedBlockLabel,
          isLateToday: latestLog?.isLate ?? false,
          tardyCount,
          thresholdReached: tardyCount >= settings.tardyThreshold,
          scheduledActivityId: scheduledActivity?._id ?? null,
          scheduledActivityBlock: scheduledActivity?.block ?? null,
          recommendedAction,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const summary = {
      present: rows.filter((row) => row.status === "present").length,
      absent: rows.filter((row) => row.status === "absent").length,
      activityExcused: rows.filter((row) => row.status === "activity" || row.status === "excused").length,
      unresolved: rows.filter((row) => row.status === "unresolved").length,
      tardy: rows.filter((row) => row.isLateToday).length,
    };

    const activeBlockDef =
      assignmentContext.selectedBlockLabel === null
        ? null
        : assignmentContext.bellSchedule?.blocks.find(
            (block) => block.label === assignmentContext.selectedBlockLabel,
          ) ?? null;
    const reminderCutoff =
      activeBlockDef === null
        ? null
        : (() => {
            const minutes = parseTimeToMinutes(activeBlockDef.start);
            if (minutes === null) return null;
            return minutes + settings.reminderMinutesAfterStart;
          })();
    const now = new Date();
    const shouldShowReminder =
      targetDate === localDateString(now) &&
      summary.unresolved > 0 &&
      reminderCutoff !== null &&
      now.getHours() * 60 + now.getMinutes() >= reminderCutoff;

    const recentCheckIns = [...todayLogs]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6)
      .map((log) => {
        const student = linkedStudents.find((entry) => entry._id.toString() === log.studentId.toString()) ?? null;
        return {
          studentId: log.studentId,
          studentName: student?.name ?? "Unknown student",
          timestamp: log.timestamp,
          locationName: log.locationName,
          isLate: log.isLate,
        };
      });

    const liveRooms = [...latestLogs.values()].reduce<Array<{ locationName: string; count: number }>>((acc, log) => {
      const existing = acc.find((entry) => entry.locationName === log.locationName);
      if (existing) {
        existing.count += 1;
      } else {
        acc.push({ locationName: log.locationName, count: 1 });
      }
      return acc;
    }, []);

    return {
      date: targetDate,
      dayLabel: assignmentContext.effectiveDayLabel,
      rotation: assignmentContext.rotation,
      settings: {
        tardyThreshold: settings.tardyThreshold,
        reminderMinutesAfterStart: settings.reminderMinutesAfterStart,
      },
      blockOptions: assignmentContext.blockOptions,
      selectedBlockLabel: assignmentContext.selectedBlockLabel,
      assignments: assignmentContext.assignments
        .map((assignment) => ({
          _id: assignment._id,
          blockLabel: assignment.blockLabel,
          classId: assignment.classId,
          className: assignmentContext.classMap.get(assignment.classId.toString())?.name ?? "Unknown class",
        }))
        .sort((a, b) => a.blockLabel.localeCompare(b.blockLabel)),
      activeClass: assignmentContext.activeClass
        ? {
            _id: assignmentContext.activeClass._id,
            name: assignmentContext.activeClass.name,
            block: assignmentContext.activeClass.block ?? null,
            room: assignmentContext.activeClass.room,
            grade: assignmentContext.activeClass.grade ?? null,
          }
        : null,
      placeholders: rosterEntries
        .filter((entry) => !entry.linkedStudentId)
        .map((entry) => ({
          _id: entry._id,
          displayName: entry.displayName,
          source: entry.source,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      summary,
      shouldShowReminder,
      activeBlockStart: activeBlockDef?.start ?? null,
      students: rows,
      recentCheckIns,
      liveRooms: liveRooms.sort((a, b) => a.locationName.localeCompare(b.locationName)),
    };
  },
});

export const batchMarkClassUnresolvedAbsent = mutation({
  args: {
    teacherId: v.id("teachers"),
    classId: v.id("teacherClasses"),
    date: v.optional(v.string()),
  },
  handler: async (ctx, { teacherId, classId, date }) => {
    const targetDate = date ?? localDateString();
    const classDoc = await ctx.db.get(classId);
    if (!classDoc || classDoc.teacherId !== teacherId) {
      throw new Error("Class not found.");
    }
    const activeBlockCode = normalizeClassBlock(classDoc.block ?? classDoc.rotationBlock ?? null);

    const rosterEntries = await ctx.db
      .query("classRosterEntries")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    const linkedStudentIds = rosterEntries
      .filter((entry) => entry.linkedStudentId)
      .map((entry) => entry.linkedStudentId!);

    const [logs, statusDocs, scheduledActivities] = await Promise.all([
      ctx.db.query("logs").withIndex("by_date", (q) => q.eq("date", targetDate)).collect(),
      ctx.db
        .query("attendanceStatus")
        .withIndex("by_date_and_status", (q) => q.eq("date", targetDate))
        .collect(),
      ctx.db
        .query("scheduledActivities")
        .withIndex("by_date", (q) => q.eq("date", targetDate))
        .collect(),
    ]);

    const linkedStudentKeys = new Set(linkedStudentIds.map((studentId) => studentId.toString()));
    const latestLogs = latestByStudent(logs.filter((log) => linkedStudentKeys.has(log.studentId.toString())));
    const statusByStudent = new Map(
      statusDocs
        .filter((status) => linkedStudentKeys.has(status.studentId.toString()))
        .map((status) => [status.studentId.toString(), status]),
    );
    const activityByStudent = new Map(
      scheduledActivities
        .filter(
          (activity) =>
            linkedStudentKeys.has(activity.studentId.toString()) &&
            activityAppliesToBlock(activity, activeBlockCode),
        )
        .map((activity) => [activity.studentId.toString(), activity]),
    );

    let updated = 0;
    for (const studentId of linkedStudentIds) {
      const key = studentId.toString();
      const explicit = statusByStudent.get(key) ?? null;
      const latestLog = latestLogs.get(key) ?? null;
      const scheduledActivity = activityByStudent.get(key) ?? null;
      const status: AttendanceStatus =
        explicit?.status ??
        (scheduledActivity ? "activity" : latestLog ? "present" : "unresolved");

      if (status !== "unresolved") continue;
      await upsertAttendanceStatus(ctx, {
        studentId,
        date: targetDate,
        status: "absent",
        source: "teacher",
        reason: "Marked from batch unresolved action",
      });
      updated += 1;
    }

    return { updated };
  },
});
