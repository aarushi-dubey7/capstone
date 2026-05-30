# Attendance System

This repository contains a school attendance platform built around three core ideas:

1. Students self-identify in the browser.
2. Classroom ESP32 beacons identify the room.
3. Convex turns those room check-ins into live attendance state for teachers.

The app is already usable, but it also contains a few partial or future-facing systems. This README is meant to help the next collaborators understand what is live today, what is experimental, and where to extend the system safely.

## What The System Actually Does

At a high level:

- Students create an account or log in on the web app.
- Each classroom has an ESP32 beacon broadcasting a room-specific BLE identity.
- On the student portal, the browser scans for nearby known beacons using Web Bluetooth.
- When a beacon is found, the frontend calls a Convex mutation to log that student as present in that room.
- Teachers use a dashboard to manage classes, rosters, attendance status, notifications, room/beacon assignments, and office reporting.

Important implementation note:

- This system does not track Chromebook Bluetooth MAC addresses.
- The implemented architecture is beacon-based room detection from the student browser.
- The student device actively scans for room beacons and then reports the check-in to Convex.

## Current Product Scope

Implemented and actively used:

- Student onboarding with school email, grade, and password-style student ID.
- Student login and local session persistence.
- Student check-in via Web Bluetooth.
- Teacher account creation, login, password change, and password reset generation.
- Teacher-managed classes and rosters.
- Attendance status management: `present`, `absent`, `activity`, `excused`, `unresolved`, and tardy.
- Teacher attendance reminders and notification center.
- Main office email sending through Resend.
- Bell schedule and day rotation management.
- Room and beacon configuration.
- Student movement visualization from attendance logs.
- Roster image parsing via Groq.

Implemented but only partially wired or future-facing:

- Schedule image parsing via Groq (`convex/groq.ts`).
- Per-student `schedules` table and schedule CRUD (`convex/schedules.ts`).
- `convex/classes.ts` as a generic class catalog used for room/period reference, separate from teacher-owned `teacherClasses`.
- `convex/calendarData.ts` as a fallback source of rotation dates.

## Tech Stack

- Frontend: React 18, TypeScript, Vite, React Router, Tailwind CSS
- Backend: Convex
- AI parsing: Groq vision API
- Email: Resend API
- Hardware: ESP32 BLE beacons
- Hosting pattern: static frontend plus hosted Convex backend

## Architecture

### Frontend

The frontend lives in `src/` and is a single-page application using `HashRouter`.

Routes:

- `#/` home / login selection
- `#/onboarding` student signup
- `#/student` student check-in portal
- `#/teacher` teacher dashboard
- `#/teacher/settings` teacher dashboard settings mode

Important nuance:

- `#/teacher/settings` is not a separate page component.
- The live settings view is rendered inside `src/pages/TeacherDashboard.tsx` based on `location.pathname`.

### Backend

The backend lives in `convex/`.

Convex is responsible for:

- storing user, class, room, and attendance data
- deriving live attendance state from raw check-in logs plus manual status overrides
- seeding and reading bell schedule / rotation data
- parsing roster or schedule images through Groq actions
- sending office emails through a Convex action

Before changing Convex code, always read:

- `convex/_generated/ai/guidelines.md`

That file contains project-specific Convex rules that should override generic habits.

### Hardware

The current beacon firmware lives in:

- `hardware/beacon/src/main.cpp`

There is also a legacy root-level file:

- `arduino.ino`

Treat `arduino.ino` as historical reference unless you intentionally decide to restore that workflow. The more current hardware project is the `hardware/beacon/` project.

## End-To-End Flow

### Student Signup And Login

1. Student opens `#/`.
2. If no local student session exists, they can either log in or create an account.
3. Signup happens in `src/pages/Onboarding.tsx` through `api.students.register`.
4. Login happens in `src/pages/Home.tsx` through `api.students.login`.
5. The frontend stores the student identifier in local storage using `src/hooks/useStudent.ts`.

Important nuance:

- Older sessions may store a legacy student password/ID instead of a Convex document ID.
- `api.students.getByStoredIdentifier` exists specifically to resolve either format.

### Student Check-In

1. Student opens `#/student`.
2. `src/pages/StudentPortal.tsx` loads the current student and all configured locations.
3. The app checks for `navigator.bluetooth`.
4. It first tries already-granted Bluetooth devices using `navigator.bluetooth.getDevices()`.
5. If none are available, it opens the browser device picker filtered to known beacon names or service UUIDs.
6. It matches the selected device to a room in the `locations` table.
7. It calls `api.attendance.markPresent`.
8. Convex inserts a raw log row into `logs` and upserts a daily status in `attendanceStatus`.

### Teacher Attendance Flow

1. Teacher logs in through `src/pages/TeacherDashboard.tsx`.
2. Dashboard queries teacher classes, roster data, notifications, rotation settings, room data, and today’s live attendance context.
3. Teachers can mark statuses manually, create scheduled activities, trigger reminders, and email the main office.
4. Summary cards and student lists are derived from a combination of:
   - `logs`
   - `attendanceStatus`
   - `scheduledActivities`
   - `teacherClasses`
   - `classRosterEntries`
   - `scheduleRotation`

### Office Reporting

1. Teacher triggers “Send to Main Office”.
2. `convex/attendanceReport.ts` calls `api.attendance.getTeacherRoster`.
3. The action builds an HTML email.
4. Resend delivers the email to the active addresses in `mainOfficeEmails`.

## Data Model

The schema lives in `convex/schema.ts`.

Core tables:

- `students`: student accounts, school email, grade, and current login credential string.
- `teachers`: teacher accounts, hashed passwords, tutorial state, password reset requirements.
- `locations`: room metadata plus BLE identifiers.
- `logs`: raw attendance check-ins. This is the append-only event trail.
- `attendanceStatus`: daily status overrides and derived status storage.
- `teacherClasses`: teacher-owned classes shown in the dashboard.
- `classRosterEntries`: roster rows for each teacher class, optionally linked to real students.
- `teacherDayBlocks`: teacher block assignments by rotation day.
- `scheduledActivities`: field trips, excused activity equivalents, or planned out-of-class attendance.
- `notifications`: teacher-facing reminders and alerts.
- `studentNotifications`: student-facing messages, currently used for password changes and general notices.
- `mainOfficeEmails`: recipients for attendance reports.
- `attendanceSettings`: tardy and reminder configuration.

Scheduling and reference tables:

- `scheduleRotation`: calendar date to day-label mapping.
- `weekDayMapping`: week-level weekday-to-day-label map.
- `bellSchedules`: named bell schedule templates.
- `classes`: generic room/subject/class reference data.
- `schedules`: parsed student schedule rows from images.

### The Two Attendance Layers

A future collaborator should understand this immediately:

- `logs` answers: “Where and when did a student physically check in?”
- `attendanceStatus` answers: “What should the official attendance state be for this day?”

This split is intentional and important.

Examples:

- A student may have a log and still be late.
- A student may have no log but be marked `activity` or `excused`.
- A teacher may manually change the official status even after a self check-in.

## Key Files By Responsibility

### Frontend

- `src/main.tsx`: bootstraps React, Convex, and `HashRouter`.
- `src/App.tsx`: route definitions.
- `src/pages/Home.tsx`: student entry point and login.
- `src/pages/Onboarding.tsx`: student registration.
- `src/pages/StudentPortal.tsx`: beacon-based check-in.
- `src/pages/TeacherDashboard.tsx`: main teacher app, settings, notifications, roster management, reporting, and tutorial.
- `src/components/AttendanceMap.tsx`: movement replay from daily logs.
- `src/hooks/useStudent.ts`: student session local storage.
- `src/hooks/useTeacher.ts`: teacher session local storage.
- `src/hooks/useTeacherTutorial.ts`: walkthrough state machine.

### Convex

- `convex/schema.ts`: source of truth for the database schema.
- `convex/attendance.ts`: attendance mutation/query core.
- `convex/students.ts`: student auth and insight logic.
- `convex/teachers.ts`: teacher auth and password flows.
- `convex/teacherClasses.ts`: teacher class, roster, and stats logic.
- `convex/scheduledActivities.ts`: planned off-roster attendance/activity records.
- `convex/notifications.ts`: teacher notifications.
- `convex/studentNotifications.ts`: student notifications.
- `convex/locations.ts`: room beacon config.
- `convex/attendanceReport.ts`: office email action.
- `convex/groq.ts`: AI-powered roster/schedule image parsing.
- `convex/scheduleRotation.ts`, `convex/weekDayMapping.ts`, `convex/bellSchedules.ts`: schedule calendar infrastructure.

### Hardware And Ops

- `hardware/beacon/src/main.cpp`: current ESP32 beacon firmware.
- `hardware/beacon/platformio.ini`: ESP32 project config.
- `Makefile`: convenience commands for dev, deploy, and flashing.
- `.env.example`: local env bootstrap documentation.

## Local Development

### Prerequisites

- Node.js 18+
- npm
- Convex CLI
- A Convex project/deployment
- Chrome or another browser with Web Bluetooth support
- Optional: Groq API key
- Optional: Resend API key
- Optional: ESP32 hardware for real beacon testing

### Setup

1. Install dependencies:

```bash
npm install
```

2. Start Convex and generate/update the client bindings:

```bash
npx convex dev
```

3. Confirm `.env.local` contains at least:

```env
VITE_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOYMENT=your-deployment-name
VITE_CONVEX_SITE_URL=https://your-project.convex.site
```

4. Add optional server-side secrets to Convex:

```bash
npx convex env set GROQ_API_KEY=gsk_...
npx convex env set RESEND_API_KEY=re_...
```

5. Start the frontend:

```bash
npm run dev
```

6. Open:

- [http://localhost:5173/#/](http://localhost:5173/#/)
- [http://localhost:5173/#/teacher](http://localhost:5173/#/teacher)

### Scripts

```bash
npm run dev
npm run build
npm run preview
npm run convex:dev
npm run convex:deploy
make f
make b
make flash
```

## Hardware Workflow

The repository assumes one ESP32 beacon per room.

Each beacon advertises:

- a room-specific name such as `Room-B16-Beacon`
- a room-specific BLE service UUID

Current firmware setup:

1. Update `ROOM_NAME` and `ROOM_UUID` in `hardware/beacon/src/main.cpp`.
2. Flash the ESP32.
3. Add the same room in the teacher dashboard Rooms area.
4. Store the room number, display name, UUID, and optional `deviceName` in Convex.
5. Student browsers can then match a selected BLE device back to that room.

Important limitation:

- Web Bluetooth requires user permission and browser support.
- Local testing is easiest in Chrome on a supported laptop.
- This is room detection, not passive background tracking.

## AI Parsing

### Roster Parsing

Currently active in the teacher workflow:

- `convex/groq.ts -> parseRosterImage`

Teachers can upload a roster image, Groq extracts a list of student names, and the dashboard tries to link those names to registered students.

### Schedule Parsing

Present in the backend but not fully integrated in the current UI:

- `convex/groq.ts -> parseScheduleImage`
- `convex/schedules.ts`

This is one of the clearest extension opportunities for future collaborators.

## How To Add Features Safely

### If You Need A New Frontend Feature

1. Find the existing page or hook that already owns the concept.
2. Check which Convex queries or mutations it already uses.
3. Prefer extending an existing query shape over adding duplicate client orchestration.
4. Keep local storage keys stable unless you intentionally write a migration path.

### If You Need A New Convex Feature

1. Read `convex/_generated/ai/guidelines.md`.
2. Update `convex/schema.ts` first if the data model changes.
3. Add validators for every query, mutation, action, and internal function.
4. Prefer helper functions over action-to-mutation/query chains when logic can remain in one runtime.
5. Think about whether the source of truth belongs in:
   - `logs`
   - `attendanceStatus`
   - `scheduledActivities`
   - teacher-owned roster/class data

### If You Need To Change Attendance Logic

Be explicit about which layer you are changing:

- raw event capture
- daily status derivation
- teacher roster summarization
- office report formatting

Most attendance behavior is concentrated in:

- `convex/attendance.ts`
- `convex/teacherClasses.ts`
- `src/pages/TeacherDashboard.tsx`

### If You Need To Change Scheduling Logic

Understand the distinction between:

- `scheduleRotation`: actual date-to-day mapping
- `weekDayMapping`: week editor for UI convenience
- `bellSchedules`: time templates
- `classes`: generic room/period reference records
- `teacherClasses`: teacher-owned dashboard classes
- `schedules`: student schedule imports

## Repo Conventions And Gotchas

- Teacher auth is custom and stored in Convex, not a third-party auth provider.
- Student login currently uses school email plus a short password-like student ID string.
- Student and teacher sessions are stored in local storage.
- The teacher settings route is inside `TeacherDashboard`, not a separate page.
- Some data is derived, not authoritative. Do not assume a `present` summary came directly from a single table.
- Existing Convex deployments may contain older documents. Schema changes should be made carefully.
- The README may mention GitHub Pages because that was part of the original deployment path, but the app is not tightly coupled to GitHub Pages.

## Known Gaps And Technical Debt

These are the main areas the next team should know about:

- The student schedule import path exists in backend code but is not fully connected to the current onboarding UX.
- There are overlapping concepts between `classes` and `teacherClasses`; they serve different purposes but need continued discipline.
- There is no formal automated test suite yet.
- Security is functional but still school-project level, especially around account/session hardening and secrets governance.
- BLE check-in depends on the browser/device experience and may need school-specific operational guidance.

## Recommended Next Steps For Future Collaborators

### 1. Increased Data Protection

This should be treated as a priority handoff improvement.

Recommended work:

- replace simple student credential handling with a stronger authentication design
- move toward secure password reset flows that do not expose temporary passwords in the UI
- evaluate encrypting or minimizing sensitive student data at rest
- add explicit audit logging for account changes, attendance overrides, and roster imports
- review FERPA/privacy expectations before expanding deployments
- add session expiration and stronger logout/session invalidation behavior

### 2. Integration With Google Classroom

Best opportunities:

- import class rosters instead of relying only on image parsing
- sync teacher-owned classes from Classroom courses
- map Google Classroom students to `students` records
- optionally sync assignment/activity context to explain why a student is out of room

Suggested implementation shape:

- add a server-side integration module in `convex/`
- store external IDs on `teacherClasses`, `classRosterEntries`, or a dedicated sync table
- keep manual roster editing available as a fallback

### 3. Integration With SmartPass

This would strengthen out-of-room context.

Best opportunities:

- use SmartPass pass data to auto-mark legitimate movement or activity status
- show “in SmartPass” context in teacher roster and movement views
- reduce false unresolved/absent states for students who are legitimately out of class

Suggested implementation shape:

- add a scheduled or on-demand sync action in Convex
- normalize SmartPass events into `scheduledActivities` or a dedicated integration table
- make the derivation rules explicit in `convex/attendance.ts`

## Suggested Handoff Checklist

Before another team starts major development, they should:

1. Run `npm install` and `npx convex dev`.
2. Confirm `npm run build` succeeds.
3. Read `convex/_generated/ai/guidelines.md`.
4. Read `convex/schema.ts`.
5. Trace the three main entry flows:
   - `Home.tsx`
   - `StudentPortal.tsx`
   - `TeacherDashboard.tsx`
6. Decide whether schedule import will be completed, removed, or left dormant.
7. Decide whether the hardware workflow will stay on the current beacon model or be redesigned.

## Verification

At the time of this handoff, the repository builds successfully with:

```bash
npm run build
```
