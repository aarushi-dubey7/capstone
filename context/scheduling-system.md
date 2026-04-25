# Columbia Middle School — Scheduling System Context

> **Purpose**: This document gives a complete picture of how the school scheduling system works at Columbia Middle School (CMS) in Berkeley Heights, NJ, and how it's implemented in this Convex-backed attendance app. Use this as reference when adding or improving schedule-related features.

---

## 1. Overview: Rotate-and-Drop Schedule

CMS uses a **4-day rotating schedule** (Day 1 → Day 2 → Day 3 → Day 4 → Day 1 …). This rotation is **independent of the calendar weekday** — Monday is not always Day 1. The school publishes a rotation calendar each year that maps every school day to its rotation label.

### Key concepts

| Term | Meaning |
|---|---|
| **Block A – H** | The 8 unique class blocks a student has across their full schedule |
| **Day 1 – Day 4** | The 4 rotation labels; each day picks 6 of the 8 blocks |
| **Dropped blocks** | The 2 blocks that do NOT meet on a given rotation day |
| **Bell schedule** | The specific time slots for blocks on a given day (Standard, Advisory, Assembly, etc.) |
| **EP / Lunch** | Enrichment Period and Lunch, which are **constant every day** regardless of rotation |

---

## 2. Rotate-and-Drop Pattern

Each rotation day selects 6 of the 8 blocks (A–H). The blocks are split into a **morning set** (Blocks 1–3) and an **afternoon set** (Blocks 4–6), with EP/Lunch in between.

| Rotation Day | Block 1 | Block 2 | Block 3 | *EP / Lunch* | Block 4 | Block 5 | Block 6 | Dropped |
|---|---|---|---|---|---|---|---|---|
| **Day 1** | A | B | C | ✓ | E | F | G | **D, H** |
| **Day 2** | B | C | D | ✓ | F | G | H | **A, E** |
| **Day 3** | C | D | A | ✓ | G | H | E | **B, F** |
| **Day 4** | D | A | B | ✓ | H | E | F | **C, G** |

### How to read this with the PowerSchool image

When a student views their schedule in PowerSchool (the screenshot the app parses), it shows a **weekly view** — e.g., Monday through Friday of that specific week. Under each weekday column, it shows the 6 classes that meet **that day**, using the rotation day assigned to that calendar date.

For example, during the week of 04/20/2026:
- **Monday 04/20** → Day 1 → Blocks A, B, C, E, F, G
- **Tuesday 04/21** → Day 2 → Blocks B, C, D, F, G, H
- **Wednesday 04/22** → Day 3 → Blocks C, D, A, G, H, E
- **Thursday 04/23** → Day 4 → Blocks D, A, B, H, E, F
- **Friday 04/24** → Day 1 → Blocks A, B, C, E, F, G

Notice that Friday can be the same rotation day as Monday if the cycle loops back.

---

## 3. Bell Schedule Types & Times

The school has multiple bell schedule formats. The most common is **Standard**.

### 3a. Standard (Regular) Bell Schedule

| Slot | Label | Start | End |
|---|---|---|---|
| 1 | Block 1 | 8:17 AM | 9:13 AM |
| 2 | Block 2 | 9:15 AM | 10:08 AM |
| 3 | Block 3 | 10:10 AM | 11:03 AM |
| 4 | EP 1 / Lunch | 11:05 AM | 11:35 AM |
| 5 | EP 2 / Lunch | 11:40 AM | 12:10 PM |
| 6 | Block 4 | 12:12 PM | 1:05 PM |
| 7 | Block 5 | 1:07 PM | 2:00 PM |
| 8 | Block 6 | 2:02 PM | 2:55 PM |

### 3b. Advisory Day Bell Schedule

| Slot | Label | Start | End |
|---|---|---|---|
| 1 | Block 1 | 8:17 AM | 9:08 AM |
| 2 | Block 2 | 9:10 AM | 9:58 AM |
| 3 | Block 3 | 10:00 AM | 10:48 AM |
| 4 | Advisory | 10:50 AM | 11:20 AM |
| 5 | Lunch 6/7 & EP 8 | 11:22 AM | 11:52 AM |
| 6 | EP 6/7 & Lunch 8 | 11:57 AM | 12:27 PM |
| 7 | Block 4 | 12:29 PM | 1:17 PM |
| 8 | Block 5 | 1:19 PM | 2:07 PM |
| 9 | Block 6 | 2:09 PM | 2:57 PM |

### 3c. Morning Assembly Bell Schedule

| Slot | Label | Start | End |
|---|---|---|---|
| 1 | Block 1 | 8:17 AM | 9:03 AM |
| 2 | Block 2 | 9:05 AM | 9:48 AM |
| 3 | Assembly | 9:50 AM | 10:50 AM |
| 4 | Lunch 6/7 & EP 8 | 10:52 AM | 11:22 AM |
| 5 | EP 6/7 & Lunch 8 | 11:27 AM | 11:57 AM |
| 6 | Block 3 | 12:00 PM | 12:43 PM |
| 7 | Block 4 | 12:45 PM | 1:28 PM |
| 8 | Block 5 | 1:30 PM | 2:13 PM |
| 9 | Block 6 | 2:15 PM | 2:58 PM |

### 3d. Afternoon Assembly Bell Schedule

On Afternoon Assembly days, the schedule runs Blocks 1–6 with shortened periods, then an assembly at the end of the day.

### 3e. Early Dismissal Schedule

Shortened blocks with dismissal at approximately 12:45 PM.

### 3f. Delayed Opening Schedule

School starts at 10:17 AM with shortened blocks.

### 3g. 1–8 Periods Schedule

A special schedule where **all 8 blocks** meet on the same day (no drops). Used rarely, typically near the beginning or end of the year or for special occasions.

---

## 4. Rotation Calendar (2025–2026)

The school publishes a rotation calendar that maps every school day to its rotation label. The data currently stored in `convex/calendarData.ts` covers **April–June 2026**. Below is the data present in the codebase:

| Date | Day Label |
|---|---|
| 2026-04-13 | Day 4 |
| 2026-04-14 | Day 1 |
| 2026-04-15 | Day 2 |
| 2026-04-16 | Day 3 |
| 2026-04-17 | Day 4 |
| 2026-04-20 | Day 1 |
| 2026-04-21 | Day 2 |
| 2026-04-22 | Day 3 |
| 2026-04-23 | Day 4 |
| 2026-04-24 | Day 1 |
| 2026-04-27 | Day 2 |
| 2026-04-28 | Day 3 |
| 2026-04-29 | Day 4 |
| 2026-04-30 | Day 1 |
| 2026-05-01 | Day 2 |
| 2026-05-04 | Day 3 |
| 2026-05-05 | Day 4 |
| 2026-05-06 | Day 1 |
| 2026-05-07 | Day 2 |
| 2026-05-08 | Day 3 |
| 2026-05-11 | Day 4 |
| 2026-05-12 | Day 1 |
| 2026-05-13 | Day 2 |
| 2026-05-14 | Day 3 |
| 2026-05-15 | Day 4 |
| 2026-05-18 | Day 1 |
| 2026-05-19 | Day 2 |
| 2026-05-20 | Day 3 |
| 2026-05-21 | Day 4 |
| 2026-05-22 | Day 1 |
| 2026-05-25 | Closed |
| 2026-05-26 | Day 2 |
| 2026-05-27 | Day 3 |
| 2026-05-28 | Day 4 |
| 2026-05-29 | Day 1 |
| 2026-06-01 | Day 2 |
| 2026-06-02 | Day 3 |
| 2026-06-03 | Day 4 |
| 2026-06-04 | Day 1 |
| 2026-06-05 | Day 2 |
| 2026-06-08 | Day 3 |
| 2026-06-09 | 1-8 Day |
| 2026-06-10 | Day 4 |
| 2026-06-11 | Day 1 |
| 2026-06-12 | Day 2 |
| 2026-06-15 | Day 3 |
| 2026-06-16 | Day 4 |
| 2026-06-17 | Day 1 |

> **Gap**: The codebase does not currently include September 2025 – March 2026 rotation data. The full year calendar is published at https://www.bhpsnj.org/o/cms/page/cms-rotation-day-schedule

---

## 5. How the System Currently Works (Implementation)

### 5a. Data Flow

```
PowerSchool Screenshot
       │
       ▼
  Groq Vision API  ──────►  Parsed JSON entries
  (convex/groq.ts)           (day_of_week, start_time, end_time,
                              subject, room, teacher_name, block_label)
       │
       ▼
  Saved to `schedules` table  (convex/schedules.ts)
  Per-student, per-block entries
       │
       ▼
  At check-in time (convex/attendance.ts):
  1. Look up today's date → rotation day label (via scheduleRotation / calendarData)
  2. Find the student's schedule entries matching that day label + room
  3. Compare check-in time against bell schedule → mark late if > 5 min past start
```

### 5b. Convex Schema (key tables)

| Table | Purpose | Key Fields |
|---|---|---|
| `students` | Registered students | `name`, `studentId`, `role` |
| `schedules` | Per-student class entries parsed from PowerSchool | `studentId`, `dayOfWeek`, `startTime`, `endTime`, `subject`, `room`, `teacherName`, `blockLabel` |
| `scheduleRotation` | Maps a calendar date → rotation day label | `date`, `dayLabel`, `bellScheduleType` |
| `bellSchedules` | Defines time slots for each schedule type | `type`, `blocks[]` (label, start, end) |
| `weekDayMapping` | Maps weekday names → day labels for a given week | `weekStart`, `monday`…`friday` |
| `locations` | Physical rooms mapped to BLE beacon UUIDs | `name`, `roomNumber`, `uuid`, `deviceName` |
| `logs` | Attendance check-in records | `studentId`, `locationUuid`, `locationName`, `timestamp`, `date`, `isLate` |

### 5c. Key Files

| File | Role |
|---|---|
| `convex/calendarData.ts` | Hardcoded `CALENDAR_ROTATION` map (date string → day label) |
| `convex/scheduleRotation.ts` | CRUD for scheduleRotation table; falls back to calendarData |
| `convex/bellSchedules.ts` | Seed data + queries for bell schedule time slots |
| `convex/schedules.ts` | CRUD for per-student schedule entries |
| `convex/weekDayMapping.ts` | Maps weekday names to rotation days for a specific week |
| `convex/groq.ts` | Groq Vision API action to parse PowerSchool screenshot |
| `convex/attendance.ts` | Mark student present, determine lateness, live location queries |
| `src/pages/Onboarding.tsx` | Student registration + schedule image upload + AI parsing |
| `src/pages/StudentPortal.tsx` | BLE-based check-in flow |
| `src/pages/TeacherDashboard.tsx` | Teacher view of attendance data |

---

## 6. How the Groq Parser Handles the Schedule

When a student uploads a PowerSchool screenshot during onboarding:

1. The image is sent to **Groq's Vision API** (Llama 4 Scout model)
2. The AI extracts each class block from the grid and returns:
   - `day_of_week` — the column header (e.g., "Monday", or if parsing labels: "Day 1")
   - `start_time` / `end_time` — the class times
   - `subject` — full class name (e.g., "Health & Physical Education 8")
   - `room` — room code (e.g., "C2", "B12")
   - `teacher_name` — the teacher's name
   - `block_label` — mapped to: "Block 1", "Block 2", "Block 3", "EP 1/Lunch", "EP 2/Lunch", "Block 4", "Block 5", "Block 6"

### Important nuance: `dayOfWeek` values

The PowerSchool screenshot shows **weekday names** (Monday, Tuesday, etc.), NOT rotation day labels. The system needs to translate:

- **"Monday" → What rotation day was that Monday?** (looked up in `scheduleRotation` or `calendarData`)
- Currently, the Groq prompt asks for the day label "as shown" in the image, which means it usually returns "Monday", "Tuesday", etc.
- The `attendance.ts` code then uses `scheduleRotation` to find the **rotation day** for today's date, and matches it against the stored `dayOfWeek` field.

**This is a known design tension**: the `dayOfWeek` field sometimes contains weekday names and sometimes rotation labels depending on how the schedule was parsed.

---

## 7. Example: Tracing a Full Check-In

1. **Setup**: Student uploads PowerSchool screenshot during onboarding. It shows the week of 04/20–04/24/2026.
2. **Parsed entries** include `{ dayOfWeek: "Monday", subject: "Band 8", room: "104", blockLabel: "Block 1" }` etc.
3. **Today is Friday 04/24/2026**. The `CALENDAR_ROTATION` says `"2026-04-24": "Day 1"`.
4. Student walks into Room 104 and checks in via BLE.
5. `attendance.ts` looks up `scheduleRotation` for `2026-04-24` → `"Day 1"`.
6. It searches the student's `schedules` for entries where `dayOfWeek === "Day 1"` AND `room === "104"`.
7. **Problem**: The stored `dayOfWeek` is `"Monday"` (from the PowerSchool screenshot), not `"Day 1"`.
8. The system needs a translation layer: "Day 1 on this particular week was Monday" → match `"Monday"` entries.

---

## 8. Known Gaps & Improvement Opportunities

1. **dayOfWeek inconsistency**: Schedule entries use weekday names from the PowerSchool screenshot, but the rotation system uses "Day 1"–"Day 4" labels. The current attendance code tries to handle both but this should be unified.

2. **Incomplete rotation calendar**: Only April–June 2026 is in `calendarData.ts`. The full year should be populated from the school's published calendar.

3. **No automatic rotation inference**: If the calendar data is missing, the system can't determine today's rotation day. It could infer it from the 4-day cycle pattern if a seed date is known.

4. **Bell schedule type not tracked per date**: The `scheduleRotation` table has a `bellScheduleType` field but it's rarely populated. Advisory/Assembly days should be pre-loaded.

5. **weekDayMapping underutilized**: The `weekDayMapping` table exists but isn't well integrated with attendance lookups. It could bridge the gap between weekday names and rotation labels.

6. **No UI for managing rotation calendar**: Teachers currently can't view or edit the rotation calendar from the dashboard.

7. **Missing schedule types in bellSchedules**: Only Standard, Advisory, and Morning Assembly are seeded. Afternoon Assembly, Early Dismissal, Delayed Opening, and 1-8 Periods are not yet implemented.

---

## 9. External References

- **Bell schedules**: https://www.bhpsnj.org/o/cms/page/2023-2024-bell-schedules
- **Rotate/drop schedule**: https://www.bhpsnj.org/o/cms/page/25-26-rotate-drop-schedule
- **Rotation day calendar (this year)**: https://www.bhpsnj.org/o/cms/page/cms-rotation-day-schedule
