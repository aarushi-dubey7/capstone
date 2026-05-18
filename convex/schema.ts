import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  students: defineTable({
    name: v.string(),
    studentId: v.string(),
    email: v.optional(v.string()),     // "ajohnson@bhpsnj.org"
    role: v.union(v.literal("student"), v.literal("teacher")),
    grade: v.optional(v.string()),  // "6", "7", "8"
    createdAt: v.number(),
  })
    .index("by_studentId", ["studentId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  teachers: defineTable({
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

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
    bellScheduleType: v.optional(v.string()), // "Standard", "Advisory", "Morning Assembly"
  }).index("by_date", ["date"]),

  // Definitions for different bell schedule timings
  bellSchedules: defineTable({
    type: v.string(), // "Standard", "Advisory", "Morning Assembly"
    blocks: v.array(v.object({
      label: v.string(), // "Block 1", "Advisory", "Lunch"
      start: v.string(), // "08:17 AM"
      end: v.string(),   // "09:13 AM"
    }))
  }).index("by_type", ["type"]),

  // Groq-parsed schedule entries per student
  schedules: defineTable({
    studentId: v.id("students"),
    dayOfWeek: v.string(),  // "Monday" or "Day A" depending on school format
    startTime: v.string(),  // "08:17 AM"
    endTime: v.string(),    // "09:13 AM"
    subject: v.string(),    // "Health & Physical Education 8"
    room: v.string(),       // "C2"
    teacherName: v.optional(v.string()), // "Mr. Smith"
    blockLabel: v.optional(v.string()),  // "Block 1", "EP 1/Lunch", etc.
  }).index("by_student", ["studentId"]),

  // Teacher-managed class definitions (independent of student schedules)
  classes: defineTable({
    room: v.string(),              // "B16"
    subject: v.string(),           // "Social Studies"
    teacherName: v.string(),       // "Mr. Buonaspina"
    grade: v.optional(v.string()), // "8" for 8th grade
    period: v.optional(v.string()),// "Block 3"
  }).index("by_room", ["room"])
    .index("by_grade", ["grade"]),

  teacherClasses: defineTable({
    teacherId: v.id("teachers"),
    name: v.string(),
    subject: v.optional(v.string()),
    block: v.optional(v.string()), // "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "EP1" | "EP2"
    room: v.string(),
    grade: v.optional(v.string()),
    rotationBlock: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_teacherId", ["teacherId"])
    .index("by_teacherId_and_active", ["teacherId", "active"]),

  classRosterEntries: defineTable({
    classId: v.id("teacherClasses"),
    displayName: v.string(),
    linkedStudentId: v.optional(v.id("students")),
    source: v.union(v.literal("uploaded"), v.literal("manual")),
    status: v.union(v.literal("linked"), v.literal("placeholder")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_linkedStudentId", ["linkedStudentId"]),

  teacherDayBlocks: defineTable({
    teacherId: v.id("teachers"),
    dayLabel: v.string(),
    blockLabel: v.string(),
    classId: v.id("teacherClasses"),
    updatedAt: v.number(),
  })
    .index("by_teacherId_and_dayLabel", ["teacherId", "dayLabel"])
    .index("by_teacherId_and_dayLabel_and_blockLabel", ["teacherId", "dayLabel", "blockLabel"]),

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

  attendanceStatus: defineTable({
    studentId: v.id("students"),
    date: v.string(),
    status: v.union(
      v.literal("present"),
      v.literal("absent"),
      v.literal("activity"),
      v.literal("excused"),
      v.literal("unresolved"),
    ),
    activityLabel: v.optional(v.string()),
    reason: v.optional(v.string()),
    source: v.union(
      v.literal("teacher"),
      v.literal("self_check_in"),
      v.literal("system"),
    ),
    updatedAt: v.number(),
  })
    .index("by_student_and_date", ["studentId", "date"])
    .index("by_date_and_status", ["date", "status"]),

  scheduledActivities: defineTable({
    studentId: v.id("students"),
    date: v.string(),
    activityLabel: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_student_and_date", ["studentId", "date"])
    .index("by_date", ["date"]),

  attendanceSettings: defineTable({
    tardyThreshold: v.number(),
    reminderMinutesAfterStart: v.number(),
  }),
});
