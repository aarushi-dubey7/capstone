# Capstone Rebuild Prompt — Full Feature Set (April 25, 2026)

> Use this prompt to rebuild all features added on April 25 from scratch.
> The project is a **BLE-based school attendance system** built with **Vite + React + TypeScript + Tailwind CSS** on the frontend and **Convex** as the backend. ESP32 beacons broadcast BLE service UUIDs per classroom; students check in via Web Bluetooth.

---

## 1. Convex Schema (`convex/schema.ts`)

Define the following tables exactly:

### `students`
| Field | Type | Notes |
|-------|------|-------|
| name | `v.string()` | Full name |
| studentId | `v.string()` | School-issued ID (e.g. "123456") |
| email | `v.optional(v.string())` | School email, format `username@bhpsnj.org` |
| role | `v.union(v.literal("student"), v.literal("teacher"))` | |
| grade | `v.optional(v.string())` | "6", "7", or "8" |
| createdAt | `v.number()` | `Date.now()` at registration |

**Indexes:** `by_studentId` → `["studentId"]`, `by_email` → `["email"]`, `by_role` → `["role"]`

### `locations`
| Field | Type | Notes |
|-------|------|-------|
| name | `v.string()` | "Room B16" |
| roomNumber | `v.string()` | "B16" |
| uuid | `v.string()` | BLE service UUID, lowercase |
| deviceName | `v.optional(v.string())` | BLE advertised name, e.g. "Room-B16-Beacon" |

**Index:** `by_uuid` → `["uuid"]`

### `weekDayMapping`
Maps each weekday to a rotation day label for the current school week.

| Field | Type |
|-------|------|
| weekStart | `v.string()` | ISO date of Monday (e.g. "2026-04-21") |
| monday–friday | `v.optional(v.string())` | "Day 1" through "Day 4" |

**Index:** `by_weekStart` → `["weekStart"]`

### `scheduleRotation`
Records which Day label and bell schedule type applies on a given date.

| Field | Type |
|-------|------|
| date | `v.string()` | ISO date |
| dayLabel | `v.string()` | "Day 1", "Day 2", etc. |
| bellScheduleType | `v.optional(v.string())` | "Standard", "Advisory", "Morning Assembly" |

**Index:** `by_date` → `["date"]`

### `bellSchedules`
Stores block timing definitions for each schedule type.

| Field | Type |
|-------|------|
| type | `v.string()` | "Standard", "Advisory", "Morning Assembly" |
| blocks | `v.array(v.object({ label, start, end }))` | Each is `v.string()` |

**Index:** `by_type` → `["type"]`

### `schedules`
Per-student schedule entries (parsed from PowerSchool screenshots via Groq).

| Field | Type |
|-------|------|
| studentId | `v.id("students")` |
| dayOfWeek | `v.string()` | "Day 1", "Day 2", etc. |
| startTime | `v.string()` | "08:17 AM" |
| endTime | `v.string()` | "09:13 AM" |
| subject | `v.string()` | "Social Studies 8" |
| room | `v.string()` | "B16" |
| teacherName | `v.optional(v.string())` |
| blockLabel | `v.optional(v.string())` | "Block 1", "EP 1/Lunch" |

**Index:** `by_student` → `["studentId"]`

### `classes`
Teacher-managed class definitions, independent of student schedules. Allows teachers to manually add classes to the system.

| Field | Type | Notes |
|-------|------|-------|
| room | `v.string()` | "B16" |
| subject | `v.string()` | "Social Studies" |
| teacherName | `v.string()` | "Mr. Buonaspina" |
| grade | `v.optional(v.string())` | "8" |
| period | `v.optional(v.string())` | "Block 3" |

**Indexes:** `by_room` → `["room"]`, `by_grade` → `["grade"]`

### `logs`
Every BLE check-in is appended here.

| Field | Type |
|-------|------|
| studentId | `v.id("students")` |
| locationUuid | `v.string()` |
| locationName | `v.string()` |
| timestamp | `v.number()` |
| date | `v.string()` | ISO date for daily queries |
| isLate | `v.boolean()` |

**Indexes:** `by_student`, `by_date`, `by_student_date` → `["studentId", "date"]`

---

## 2. Convex Functions

### `convex/students.ts`
- **`register`** (mutation): Args = `{ name, studentId, email?, role, grade? }`. Check `by_studentId` for duplicates; if exists return existing `_id`, else insert with `createdAt: Date.now()`.
- **`getByStudentId`** (query): Lookup by `studentId` index, return first match.
- **`login`** (query): Args = `{ email, studentId }`. Find student by `studentId` index, then verify `student.email` matches (case-insensitive). Return the student doc or `null`.
- **`list`** (query): Return all students ordered ascending.

### `convex/classes.ts`
- **`add`** (mutation): Insert a new class with `{ room, subject, teacherName, grade?, period? }`.
- **`update`** (mutation): Args = `{ id: v.id("classes"), room?, subject?, teacherName?, grade?, period? }`. Patch only provided fields.
- **`remove`** (mutation): Delete by `id`.
- **`list`** (query): Return all classes.
- **`listByGrade`** (query): Filter by `by_grade` index.

### `convex/locations.ts`
- **`upsert`** (mutation): Check `by_uuid`; if exists patch, else insert. Args = `{ name, roomNumber, uuid, deviceName? }`.
- **`remove`** (mutation): Delete by id.
- **`list`** (query): Return all.
- **`getByUuid`** (query): Lookup by uuid index.

### `convex/schedules.ts`
- **`save`** (mutation): Takes `{ studentId, entries[] }`. Deletes existing entries for that student, then inserts new ones.
- **`getForStudent`** (query): Return all schedule entries for a student.
- **`listAll`** (query): Return every schedule entry (used by teacher dashboard to derive rooms).

---

## 3. Frontend Pages

### Home Page (`src/pages/Home.tsx`)
- Two main buttons: **Student Check-In** and **Teacher Dashboard**
- **Login flow**: When clicking Student Check-In and no `localStorage` session exists:
  - Show a **"Welcome Back"** login card with:
    - School Email input: text field + fixed `@bhpsnj.org` suffix badge (strips `@` and spaces from input)
    - Student ID input
    - "Log In" button → calls `api.students.login` query with `{ email: prefix@bhpsnj.org, studentId }`
    - On match: store `studentId` in localStorage via `setStoredStudentId()`, navigate to `/student`
    - On no match: show red error "No account found..."
    - Divider with "or"
    - "Create New Account" button → navigates to `/onboarding`
    - "Cancel" button to dismiss
- If already logged in (stored ID exists), clicking Student Check-In goes directly to `/student`
- Subtitle dynamically shows "Tap to mark your attendance" vs "Log in or register"

### Onboarding (`src/pages/Onboarding.tsx`)
3-step wizard:

**Step 1 — Your Info:**
- Full Name input
- Student ID input
- **School Email input**: Split input — left text field + right `@bhpsnj.org` badge. Auto-strips `@` and spaces. Shows preview below: `"username@bhpsnj.org"`. Required field.
- **Grade selector**: Three buttons (6th, 7th, 8th Grade) styled as toggle pills. Defaults to 8th. Active button uses `bg-brand-700 text-white border-brand-700 shadow-md`.
- Continue button disabled until name + studentId + email are filled
- Calls `registerStudent({ name, studentId, email: prefix@bhpsnj.org, role: "student", grade })`
- Stores studentId in localStorage

**Step 2 — Schedule:**
- Upload/paste PowerSchool screenshot
- Parse via Groq AI action
- Confirm parsed schedule entries
- Optional: select today's day rotation
- Save schedule to Convex

**Step 3 — Done:**
- Success message, button to go to check-in

### Student Portal (`src/pages/StudentPortal.tsx`)
- Reads stored studentId from localStorage
- Redirects to onboarding if no ID
- Shows "Hi, {firstName}" greeting
- **"Tap to Check In"** button triggers Web Bluetooth:
  1. Try `navigator.bluetooth.getDevices()` for previously-granted beacons
  2. If not found, show picker filtered by known device names from `locations` table
  3. Match detected device to a location record
  4. Call `markPresent` mutation
- Shows success/error/scanning states with countdown auto-close

### Teacher Dashboard (`src/pages/TeacherDashboard.tsx`)
4-tab layout: **Attendance | Schedules | Rooms | Movement**

**Header:** Shows today's date, current day rotation badge, "Home" link.

**Stats bar:** 3 cards — Checked In (green), Not Checked In (amber), Total Check-ins Today (brand).

#### Attendance Tab
- Room-grouped live check-in cards with pulse indicator
- Click student → sidebar shows today's timeline
- "Not checked in" section with student chips
- Recent check-ins list

#### Schedules Tab
- Student selector dropdown (filtered to role=student)
- Selected student's full schedule grouped by day
- Right sidebar: Day rotation picker (Day 1–4), Bell schedule type selector (Standard/Advisory/Morning Assembly with preview), Week setup form (Mon–Fri → Day X mapping)

#### Rooms Tab — KEY FEATURES ADDED TODAY
- **Description**: "All 8th grade classes and rooms. Assign a BLE beacon to each..."
- **"+ Add Class" button** (top right, brand primary style with plus icon)
- **Add Class Form** (shown when button clicked):
  - Card with `border-2 border-brand-200 bg-brand-50/30`
  - Heading with plus icon: "Add a New Class"
  - Grid form: Room*, Subject*, Teacher*, Grade (select: 6th/7th/8th), Period/Block
  - Save Class + Cancel buttons
  - All required fields must be filled to enable Save

- **Class Cards Grid** (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`):
  Each card shows:
  - **Badge**: "From Schedule" (slate) or "Manually Added" (brand-100/700) with ring-1
  - **Edit + Remove buttons** (for manual classes only): pencil icon Edit link, red Remove link
  - **Subject**: bold text
  - **Room & Beacon Status**: room code + green "Beacon set" or amber "No beacon" pill + Edit/Assign link
  - **Teacher**: name or "No teacher listed"
  - **Grade & Period** (when available): shows "8th" format
  - **Beacon Info** (when assigned): device name (brand-700), UUID (mono font), "Remove beacon" link
  - **Beacon Assignment Form** (when editing):
    - "Scan for Beacon" button (uses Web Bluetooth `requestDevice` with `namePrefix: "Room-"`)
    - Room name input, BLE device name input, Service UUID input (mono font)
    - "Save Configuration" button

  - **Inline Edit Mode** (for manual classes, when Edit clicked):
    - Replaces card content with editable fields: Subject, Teacher, Grade (select), Period
    - Save + Cancel buttons
    - Calls `updateClass` mutation

- **Room entries derivation** (useMemo):
  1. Build from `allSchedules` — look up student's grade via `studentMap`
  2. Merge in `allClasses` (teacher-added) — if room exists, merge subjects/teachers; if new, create entry with `isManual: true`
  3. Sort by room code

#### Movement Tab
- `<AttendanceMap>` component with today's logs and students

---

## 4. ESP32 Beacon Firmware (`hardware/beacon/src/main.cpp`)

- Platform: ESP32 (PlatformIO, `espressif32` platform, `arduino` framework)
- Uses `BLEDevice`, `BLEServer`, `BLEService`, `BLEAdvertising`
- Configuration via `#define`:
  - `ROOM_NAME` = `"Room-B16-Beacon"` (format: `Room-{ROOM_CODE}-Beacon`)
  - `ROOM_UUID` = `"00000B16-0000-1000-8000-00805f9b34fb"` (first block encodes room number)
- Setup: init BLE, create server + service, configure advertising with scan response
- Loop: `delay(10000)` — BLE stack handles advertising automatically
- Flashed via `platformio run --target upload --environment esp32dev`

---

## 5. Auth / Session Model

- **No external auth provider** — simple localStorage-based session
- `useStudent.ts` hook exports: `getStoredStudentId()`, `setStoredStudentId(id)`, `clearStoredStudentId()`
- Key = `"attendance_student_id"` in localStorage
- Login verification happens server-side via `students.login` query (email + studentId match)

---

## 6. Styling Notes

- Tailwind CSS with custom `brand` color palette (configured in `tailwind.config.ts`)
- Card class: `.card` (custom utility in `index.css`)
- Button class: `.btn-primary` (custom utility)
- Uses `animate-pulse-slow` for live indicators
- Grade pills use `border-2` toggle pattern (brand-700 active vs slate-300 inactive)
- Email input uses split design: `rounded-l-xl` input + `rounded-r-xl` suffix badge with `bg-slate-100`
- Badges use `text-[10px] uppercase font-bold tracking-wider` pattern

---

## 7. Key Technical Decisions

1. **`classes` table is separate from `schedules`**: schedules are per-student parsed from PowerSchool; classes are teacher-managed room/subject/teacher definitions. The Rooms tab merges both.
2. **Grade flows from student record**: When building room entries from schedules, the student's `grade` field is looked up to tag the room. When adding classes manually, grade is set directly.
3. **Login uses query, not mutation**: The `students.login` function is a query so it can be used reactively with `useQuery`. It verifies email+studentId match server-side.
4. **Email domain is enforced client-side**: The input strips `@` and spaces, and the `@bhpsnj.org` suffix is always appended programmatically before sending to Convex.
5. **Beacon scan uses Web Bluetooth**: `navigator.bluetooth.requestDevice()` with name prefix filters. The teacher dashboard also has a scan button per room card.
