import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function currentDayOfWeek() {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date().getDay()];
}

// Returns true if current wall-clock time is more than 5 min past `startTime` ("08:17 AM")
function isLateForTime(startTime: string): boolean {
  const match = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return false;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const scheduleMinutes = hours * 60 + minutes;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > scheduleMinutes + 5;
}

export const markPresent = mutation({
  args: {
    studentId: v.id("students"),
    locationUuid: v.string(),
    locationName: v.string(),
  },
  handler: async (ctx, { studentId, locationUuid, locationName }) => {
    const now = Date.now();
    const date = todayString();
    const dayOfWeek = currentDayOfWeek();

    // Use the school's day rotation label if set, otherwise fall back to weekday name
    const rotation = await ctx.db
      .query("scheduleRotation")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();
    const scheduleDay = rotation?.dayLabel ?? dayOfWeek;

    // Find the schedule entry that matches today + this room
    const schedule = await ctx.db
      .query("schedules")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .filter((q) =>
        q.and(
          q.eq(q.field("dayOfWeek"), scheduleDay),
          q.eq(q.field("room"), locationName.replace("Room ", "").trim())
        )
      )
      .first();

    const isLate = schedule ? isLateForTime(schedule.startTime) : false;

    await ctx.db.insert("logs", {
      studentId,
      locationUuid,
      locationName,
      timestamp: now,
      date,
      isLate,
    });

    return { success: true, isLate };
  },
});

// All check-ins for today, newest first
export const getTodayLogs = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("logs")
      .withIndex("by_date", (q) => q.eq("date", todayString()))
      .order("desc")
      .collect();
  },
});

// Check-in history for one student on a given date (defaults to today)
export const getStudentLogs = query({
  args: { studentId: v.id("students"), date: v.optional(v.string()) },
  handler: async (ctx, { studentId, date }) => {
    return ctx.db
      .query("logs")
      .withIndex("by_student_date", (q) =>
        q.eq("studentId", studentId).eq("date", date ?? todayString())
      )
      .order("asc")
      .collect();
  },
});

// Most recent location per student today — drives the live dashboard
export const getLiveLocations = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_date", (q) => q.eq("date", todayString()))
      .order("desc")
      .collect();

    const seen = new Set<string>();
    const latest: typeof logs = [];
    for (const log of logs) {
      const key = log.studentId.toString();
      if (!seen.has(key)) {
        seen.add(key);
        latest.push(log);
      }
    }
    return latest;
  },
});
