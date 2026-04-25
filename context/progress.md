# Progress Log — April 25, 2026

## What Was Accomplished

### 1. ESP32 Beacon Firmware (Hardware)
- Configured and flashed two ESP32 dev boards as BLE attendance beacons
- Each beacon broadcasts a unique service UUID encoding the room number (e.g., `00000B16-...` for Room B16)
- Device names follow the `Room-{CODE}-Beacon` pattern for Web Bluetooth filtering
- Successfully uploaded to two physical ESP32s (MAC: `70:4b:ca:27:4f:54` and `d4:e9:f4:6f:1f:d8`)

### 2. Teacher Dashboard — Classes & Rooms Management
- **New `classes` table**: Created a separate Convex table for teacher-managed class definitions (room, subject, teacher, grade, period), independent of student-parsed schedules
- **"+ Add Class" button**: Teachers can manually add classes with a form (Room, Subject, Teacher, Grade selector, Period/Block)
- **Merged room view**: The Rooms tab now merges schedule-derived rooms with manually added classes, showing both with distinct "From Schedule" / "Manually Added" badges
- **Inline edit mode**: Manually added class cards have Edit/Remove buttons; Edit opens inline fields for subject, teacher, grade, and period
- **Beacon assignment**: Each room card can scan for BLE beacons or manually enter UUID/device name
- **Added class**: Room B16 / Social Studies / Mr. Buonaspina / 8th Grade was added as the first manual class entry

### 3. Student Grade Tracking
- **Schema update**: Added `grade` field (optional) to the `students` table
- **Onboarding grade selector**: Step 1 now has three toggle buttons for 6th/7th/8th grade (defaults to 8th)
- **Grade propagation**: Schedule-derived room cards look up the student's grade from their record instead of hardcoding "8"

### 4. School Email & Login System
- **Schema update**: Added `email` field (optional) to students table with `by_email` index
- **Onboarding email input**: Split-design input with text field + `@bhpsnj.org` suffix badge; auto-strips invalid characters; shows full email preview
- **Login query**: New `students.login` query verifies email + studentId match (case-insensitive)
- **Home page login flow**: Clicking "Student Check-In" without a stored session now shows a "Welcome Back" login card with email + student ID fields, error handling, and a "Create New Account" fallback link to onboarding

---

## Issues Faced & Solutions

### Issue 1: Token Limit on Large Edits
**Problem**: When trying to update the entire Rooms tab rendering + add inline edit + update roomEntries logic all at once, the output exceeded the 64,000 token generation limit.

**Solution**: Broke the changes into multiple smaller, targeted edits:
1. First updated the `roomEntries` useMemo to use student grades
2. Then added state variables and mutation bindings
3. Then added handler functions
4. Then updated the card rendering in separate chunks
5. Finally closed the JSX fragment/ternary structure

### Issue 2: JSX Fragment Closure
**Problem**: After adding the inline edit ternary (`editingClassId === _id ? <form> : <display>`), the JSX fragment `<>...</>` needed to wrap the non-edit display path, but the closing tags had to be placed after the beacon editing section — several hundred lines down.

**Solution**: Located the exact closing `</div>` of the card component and inserted `</>` and `)` closers in the correct position, verified by TypeScript compilation (`npx tsc --noEmit` passed cleanly).

### Issue 3: Hardcoded Grade vs Dynamic Grade
**Problem**: Initially all schedule-derived rooms were hardcoded with `grade: "8"`. This wouldn't scale when students of different grades sign up.

**Solution**: Updated the `roomEntries` useMemo to look up the student's grade from `studentMap` using `s.studentId`. Falls back to "8" if the student record doesn't have a grade (backward compatibility).

### Issue 4: Login State Management with Convex Queries
**Problem**: Convex queries are reactive (via `useQuery`), but we needed the login to only fire when the user clicks "Log In", not on every keystroke.

**Solution**: Used a `submitted` boolean state flag. The `useQuery` call passes `"skip"` until `submitted` is true and both fields are filled. On input change, `submitted` resets to false so the query doesn't re-fire on edits.

---

## Files Modified/Created

| File | Action |
|------|--------|
| `convex/schema.ts` | Modified — added `email` to students, `grade` to students, new `classes` table |
| `convex/students.ts` | Modified — added `email`/`grade` to register, added `login` query |
| `convex/classes.ts` | **Created** — full CRUD for teacher-managed classes |
| `src/pages/Home.tsx` | Rewritten — added login form with email@bhpsnj.org + studentId |
| `src/pages/Onboarding.tsx` | Modified — added email input + grade selector to Step 1 |
| `src/pages/TeacherDashboard.tsx` | Modified — Add Class form, inline edit, grade display, merged room view |
| `hardware/beacon/src/main.cpp` | Configured for Room B16 beacon |
| `context/prompts.md` | **Created** — comprehensive rebuild prompt |
| `context/progress.md` | **Created** — this file |
