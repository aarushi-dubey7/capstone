import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  students: defineTable({
    name: v.string(),
    studentId: v.string(),
    role: v.union(v.literal("student"), v.literal("teacher")),
    createdAt: v.number(),
  })
    .index("by_studentId", ["studentId"])
    .index("by_role", ["role"]),

  // Each ESP32 beacon maps to one location
  locations: defineTable({
    name: v.string(),                  // "Room C2"
    roomNumber: v.string(),            // "C2"
    uuid: v.string(),                  // "000000C2-0000-1000-8000-00805f9b34fb"
    deviceName: v.optional(v.string()), // BLE advertised name, e.g. "Attendance-Anchor-101"
  }).index("by_uuid", ["uuid"]),

  // Maps each weekday to a day-number label for the current school week
  weekDayMapping: defineTable({
    weekStart: v.string(),              // "2026-04-21" — Monday ISO date
    monday: v.optional(v.string()),     // "Day 1" | "Day 2" | "Day 3" | "Day 4"
    tuesday: v.optional(v.string()),
    wednesday: v.optional(v.string()),
    thursday: v.optional(v.string()),
    friday: v.optional(v.string()),
  }).index("by_weekStart", ["weekStart"]),

  // School-wide day rotation: records which schedule day label a given date maps to
  scheduleRotation: defineTable({
    date: v.string(),     // "2026-04-25"
    dayLabel: v.string(), // matches day_of_week values in schedules, e.g. "Day 1"
  }).index("by_date", ["date"]),

  // Groq-parsed schedule entries per student
  schedules: defineTable({
    studentId: v.id("students"),
    dayOfWeek: v.string(),  // "Monday" or "Day A" depending on school format
    startTime: v.string(),  // "08:17 AM"
    endTime: v.string(),    // "09:13 AM"
    subject: v.string(),    // "Health & Physical Education 8"
    room: v.string(),       // "C2"
  }).index("by_student", ["studentId"]),

  // Every check-in is appended here
  logs: defineTable({
    studentId: v.id("students"),
    locationUuid: v.string(),
    locationName: v.string(),
    timestamp: v.number(),
    date: v.string(), // "2025-04-25" — for daily queries
    isLate: v.boolean(),
  })
    .index("by_student", ["studentId"])
    .index("by_date", ["date"])
    .index("by_student_date", ["studentId", "date"]),
});
