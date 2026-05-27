import { useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type DragEvent as ReactDragEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import AttendanceMap from "../components/AttendanceMap";
import DarkModeToggle from "../components/DarkModeToggle";
import TutorialOverlay from "../components/teacher-tutorial/TutorialOverlay";
import TutorialWelcomeModal from "../components/teacher-tutorial/TutorialWelcomeModal";
import { clearStoredTeacherId, getStoredTeacherId, setStoredTeacherId } from "../hooks/useTeacher";
import { isTutorialWelcomeDismissed, useTeacherTutorial } from "../hooks/useTeacherTutorial";

type Tab = "attendance" | "classes" | "schedules" | "rooms" | "movement";
type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
type RosterFilter = "all" | "present" | "absent" | "excused" | "activity" | "tardy";
type ManualStatus = "present" | "absent" | "excused";
type AuthMode = "login" | "register";
type BeaconScanState = "idle" | "scanning" | "connected" | "error";
type ClassesViewMode = "landing" | "creating" | "createSuccess" | "editing";
type ClassWorkspaceSection = "details" | "stats" | "rosterUpload" | "manualAdd" | "roster" | "planner";
type ClassStatsRange = "week" | "month" | "3months";
type ClassStatsBulkFilter = "present" | "absent" | "activityExcused" | "unresolved" | "tardy";

const DAY_OPTIONS = ["Day 1", "Day 2", "Day 3", "Day 4"] as const;
type DayOption = (typeof DAY_OPTIONS)[number];
const SCHEDULE_ACTIVITY_OPTIONS = ["Music Lesson", "NJHS Event", "Field Trip"] as const;
const ROTATION_BLOCK_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const CLASS_BLOCK_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "EP1", "EP2"] as const;
const CLASS_WORKSPACE_SECTIONS: Array<{ key: ClassWorkspaceSection; label: string }> = [
  { key: "details", label: "Class Details" },
  { key: "stats", label: "Class Stats" },
  { key: "rosterUpload", label: "Roster Upload" },
  { key: "manualAdd", label: "Manual Roster Add" },
  { key: "roster", label: "Class Roster" },
  { key: "planner", label: "Day Block Planner" },
];
const CLASS_PRIMARY_NAV_SECTIONS: Array<{ key: "details" | "stats"; label: string }> = [
  { key: "stats", label: "Class Stats" },
  { key: "details", label: "Class Details" },
];
const CLASS_DETAILS_NAV_SECTIONS = CLASS_WORKSPACE_SECTIONS.filter(
  (section) => section.key !== "details" && section.key !== "stats",
);
const MAX_STUDENT_PASSWORD_LENGTH = 7;
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
const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
function emptyClassForm() {
  return { name: "", subject: "", room: "", grade: "", rotationBlock: "" };
}

function todayStr(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayLong() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function weekStart() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return todayStr(date);
}

function todayWeekdayKey(): Weekday {
  const keys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return (keys[new Date().getDay()] ?? "monday") as Weekday;
}

function friendlyConvexErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;

  const explicitErrorMatch = error.message.match(/Uncaught Error:\s*([^\n]+)/);
  if (explicitErrorMatch?.[1]) {
    return explicitErrorMatch[1].trim();
  }

  const firstLine = error.message.split("\n")[0]?.trim();
  if (!firstLine) return fallback;
  if (firstLine.includes("[CONVEX")) return fallback;
  return firstLine;
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

type StudentPublicFields = {
  name: string;
  grade?: string | null;
  email?: string | null;
};

function studentPickerLabel(student: StudentPublicFields) {
  const parts = [student.name];
  if (student.grade) parts.push(`Grade ${student.grade}`);
  if (student.email) parts.push(student.email);
  return parts.join(" · ");
}

function studentPublicSubtitle(student: StudentPublicFields) {
  const parts: string[] = [];
  if (student.grade) parts.push(`Grade ${student.grade}`);
  if (student.email) parts.push(student.email);
  return parts.join(" · ") || "No grade or email on file";
}

function fmtDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtMonthLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function monthGridDays(date: string) {
  const base = new Date(`${date}T00:00:00`);
  const start = new Date(base);
  start.setDate(1);
  while (start.getDay() === 0 || start.getDay() === 6) {
    start.setDate(start.getDate() - 1);
  }
  while (start.getDay() !== 1) {
    start.setDate(start.getDate() - 1);
  }
  const days: string[] = [];
  let cursor = new Date(start);
  while (days.length < 30) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(todayStr(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseRosterText(text: string) {
  return [...new Set(
    text
      .split(/\r?\n|,/)
      .map((entry) => entry.replace(/\t+/g, " ").trim())
      .filter(Boolean),
  )];
}

function statusBadge(status: string) {
  if (status === "present") return "bg-emerald-100 text-emerald-700";
  if (status === "absent") return "bg-red-100 text-red-700";
  if (status === "activity") return "bg-sky-100 text-sky-700";
  if (status === "excused") return "bg-violet-100 text-violet-700";
  return "bg-amber-100 text-amber-800";
}

function statusLabel(status: string) {
  if (status === "present") return "Present";
  if (status === "absent") return "Absent";
  if (status === "activity") return "Activity";
  if (status === "excused") return "Excused";
  return "Unresolved";
}

function classStatsStatusBadge(status: string, isTardy: boolean) {
  if (isTardy) return "bg-violet-100 text-violet-700";
  if (status === "present") return "bg-emerald-100 text-emerald-700";
  if (status === "absent") return "bg-red-100 text-red-700";
  if (status === "activity" || status === "excused") return "bg-sky-100 text-sky-700";
  return "bg-amber-100 text-amber-800";
}

function classStatsStatusLabel(status: string, isTardy: boolean) {
  if (isTardy) return "Tardy";
  if (status === "activity" || status === "excused") return "Activity / Excused";
  return statusLabel(status);
}

function InfoTooltip({ label }: { label: string }) {
  return (
    <div className="relative group">
      <button
        type="button"
        aria-label="More information"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-semibold text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-700"
      >
        i
      </button>
      <div className="pointer-events-none absolute right-0 top-7 z-20 w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-5 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {label}
      </div>
    </div>
  );
}

function SummaryCard({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="card text-center bg-white">
      <div className={`text-4xl font-bold ${tone}`}>{value}</div>
      <div className="mt-2 text-slate-500">{label}</div>
    </div>
  );
}

function AuthPanel({
  mode,
  setMode,
  name,
  setName,
  emailPrefix,
  setEmailPrefix,
  password,
  setPassword,
  error,
  resetPasswordResult,
  onSubmit,
  onForgotPasswordSubmit,
  onCopyResetPassword,
  showForgotPassword,
  setShowForgotPassword,
  loading,
  resetLoading,
}: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  name: string;
  setName: (value: string) => void;
  emailPrefix: string;
  setEmailPrefix: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  error: string;
  resetPasswordResult: { password: string; copied: boolean } | null;
  onSubmit: () => void;
  onForgotPasswordSubmit: () => void;
  onCopyResetPassword: () => void;
  showForgotPassword: boolean;
  setShowForgotPassword: (value: boolean) => void;
  loading: boolean;
  resetLoading: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/70">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">Teacher Workspace</h1>
            <p className="mt-2 text-sm text-slate-500">
              Sign in with your school email to manage class rosters, attendance, and day-block planning.
            </p>
          </div>

          {!showForgotPassword && (
            <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
              {(["login", "register"] as AuthMode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${ mode === value ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700" }`}
                >
                  {value === "login" ? "Log In" : "Create Account"}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {showForgotPassword ? (
              <div className="rounded-2xl border border-brand-200 bg-brand-100 px-4 py-3 text-sm font-medium leading-6 text-brand-950">
                Enter your school email and a fresh 6-character temporary password will appear here for the teacher to copy.
                They&apos;ll be prompted to choose a new password immediately after logging in.
              </div>
            ) : mode === "register" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ms. Johnson"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">School Email</label>
              <div className="flex">
                <input
                  type="text"
                  value={emailPrefix}
                  onChange={(event) => setEmailPrefix(event.target.value.replace(/[@\s]/g, ""))}
                  placeholder="teachername"
                  className="flex-1 rounded-l-xl border border-slate-300 border-r-0 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="inline-flex items-center rounded-r-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-500">
                  @bhpsnj.org
                </span>
              </div>
            </div>

            {!showForgotPassword && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-xl border border-slate-300 pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 113.833 3.833M15.216 14.5a3 3 0 11-4.716-4.716" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm font-semibold text-red-950">
                {error}
              </div>
            )}

            {resetPasswordResult && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-950">
                <p>A new temporary password is ready. Copy it and use it to sign in once.</p>
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-300 bg-white px-3 py-2">
                  <code className="flex-1 text-base font-bold tracking-[0.2em] text-slate-900">{resetPasswordResult.password}</code>
                  <button
                    type="button"
                    onClick={onCopyResetPassword}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-emerald-800"
                  >
                    {resetPasswordResult.copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 text-xs font-medium text-emerald-900">
                  This password changes every time you reset it and is always 6 characters long.
                </p>
              </div>
            )}

            {showForgotPassword ? (
              <div className="space-y-3">
                <button onClick={onForgotPasswordSubmit} disabled={resetLoading} className="btn-primary w-full disabled:opacity-50">
                  {resetLoading ? "Resetting..." : "Reset Password"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-800"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <button onClick={onSubmit} disabled={loading} className="btn-primary w-full disabled:opacity-50">
                {loading ? "Working..." : mode === "login" ? "Log In" : "Create Teacher Account"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ForcePasswordChangePanel({
  teacherName,
  teacherEmail,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  error,
  onSubmit,
  onLogout,
  loading,
}: {
  teacherName: string;
  teacherEmail: string;
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  error: string;
  onSubmit: () => void;
  onLogout: () => void;
  loading: boolean;
}) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/70">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">Choose a New Password</h1>
            <p className="mt-2 text-sm text-slate-500">
              {teacherName} ({teacherEmail}) must replace the temporary school password before entering the teacher workspace.
            </p>
          </div>

          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Use the temporary reset password as your current password, then create a new password with at least 6 characters.
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-4 pr-14 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-4 pr-14 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirm New Password</label>
              <input
                type={showNewPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm font-semibold text-red-950">
                {error}
              </div>
            )}

            <button onClick={onSubmit} disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? "Saving..." : "Update Password"}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-800"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const rosterFileRef = useRef<HTMLInputElement>(null);
  const classWorkspaceResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [teacherId, setTeacherId] = useState<Id<"teachers"> | null>(() => {
    const stored = getStoredTeacherId();
    return stored ? (stored as Id<"teachers">) : null;
  });

  const [tab, setTab] = useState<Tab>("attendance");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authEmailPrefix, setAuthEmailPrefix] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [resetPasswordResult, setResetPasswordResult] = useState<{ password: string; copied: boolean } | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loginSubmitted, setLoginSubmitted] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResettingTeacherPassword, setIsResettingTeacherPassword] = useState(false);
  const [currentTeacherPassword, setCurrentTeacherPassword] = useState("");
  const [replacementTeacherPassword, setReplacementTeacherPassword] = useState("");
  const [confirmReplacementTeacherPassword, setConfirmReplacementTeacherPassword] = useState("");
  const [teacherPasswordUpdateError, setTeacherPasswordUpdateError] = useState("");
  const [isUpdatingTeacherPassword, setIsUpdatingTeacherPassword] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<Id<"teacherClasses"> | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<Id<"students"> | null>(null);
  const [attendanceLookupOpen, setAttendanceLookupOpen] = useState(false);
  const [attendanceLookupDate, setAttendanceLookupDate] = useState("");
  const [selectedBlockLabel, setSelectedBlockLabel] = useState("");
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("all");
  const [rosterSearch, setRosterSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [activityDate, setActivityDate] = useState(todayStr());
  const [activityType, setActivityType] = useState("");
  const [activityLabel, setActivityLabel] = useState("");
  const [activityBlock, setActivityBlock] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [editingScheduledActivityId, setEditingScheduledActivityId] = useState<Id<"scheduledActivities"> | null>(null);
  const [quickActivityStudentId, setQuickActivityStudentId] = useState<Id<"students"> | null>(null);
  const [quickActivityLabel, setQuickActivityLabel] = useState("");
  const [settingsForm, setSettingsForm] = useState({
    tardyThreshold: "3",
    reminderMinutesAfterStart: "1",
    attendanceReminderEnabled: true,
    followUpReminderMinutesAfterFirst: "1",
    manualReminderTimes: [] as string[],
  });
  const [attendanceSettingsMessage, setAttendanceSettingsMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  }>({
    text: "",
    type: "info",
  });
  const [notificationToast, setNotificationToast] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [editingRotation, setEditingRotation] = useState(false);
  const [rotationLabel, setRotationLabel] = useState("");
  const [selectedBellType, setSelectedBellType] = useState("Standard");
  const [editingWeek, setEditingWeek] = useState(false);
  const [weekForm, setWeekForm] = useState<Record<Weekday, string>>({
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
  });
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomUuid, setRoomUuid] = useState("");
  const [roomDeviceName, setRoomDeviceName] = useState("");
  const [beaconScanState, setBeaconScanState] = useState<BeaconScanState>("idle");
  const [beaconScanMessage, setBeaconScanMessage] = useState("");
  const [classesViewMode, setClassesViewMode] = useState<ClassesViewMode>("landing");
  const [classWorkspaceSection, setClassWorkspaceSection] = useState<ClassWorkspaceSection>("details");
  const [classStatsRange, setClassStatsRange] = useState<ClassStatsRange>("week");
  const [classStatsDate, setClassStatsDate] = useState(todayStr());
  const [classStatsCalendarView, setClassStatsCalendarView] = useState(false);
  const [classStatsBulkFilter, setClassStatsBulkFilter] = useState<ClassStatsBulkFilter | null>(null);
  const [classWorkspaceWidth, setClassWorkspaceWidth] = useState(980);
  const [isResizingClassWorkspace, setIsResizingClassWorkspace] = useState(false);
  const [recentlyCreatedClassName, setRecentlyCreatedClassName] = useState("");
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [createClassError, setCreateClassError] = useState("");
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [newClassForm, setNewClassForm] = useState(emptyClassForm);
  const [manualEntryName, setManualEntryName] = useState("");
  const [manualLinkedStudentId, setManualLinkedStudentId] = useState("");
  const [manualLinkedStudentQuery, setManualLinkedStudentQuery] = useState("");
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({});
  const [rosterLinkQueries, setRosterLinkQueries] = useState<Record<string, string>>({});
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [rosterPreviewImage, setRosterPreviewImage] = useState<string | null>(null);
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [rosterTextInput, setRosterTextInput] = useState("");
  const [parsedRosterNames, setParsedRosterNames] = useState<string[]>([]);
  const [rosterSelections, setRosterSelections] = useState<Record<string, string>>({});
  const [rosterNameDrafts, setRosterNameDrafts] = useState<Record<string, string>>({});
  const [editingRosterEntryIds, setEditingRosterEntryIds] = useState<Record<string, boolean>>({});
  const [savingRosterEntryId, setSavingRosterEntryId] = useState<string | null>(null);
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [confirmStudentPassword, setConfirmStudentPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState("");
  const [isUpdatingStudentPassword, setIsUpdatingStudentPassword] = useState(false);
  const [rosterParseError, setRosterParseError] = useState("");
  const [isParsingRoster, setIsParsingRoster] = useState(false);
  const [isRosterDragActive, setIsRosterDragActive] = useState(false);
  const shownBrowserNotificationIdsRef = useRef<Set<string>>(new Set());
  const [manualReminderTimeInput, setManualReminderTimeInput] = useState("");
  const [pendingTutorialWelcome, setPendingTutorialWelcome] = useState(false);
  const hasShownWelcomeThisMountRef = useRef(false);

  const tutorial = useTeacherTutorial();

  const teacherEmail = authEmailPrefix.trim() ? `${authEmailPrefix.trim().toLowerCase()}@bhpsnj.org` : "";
  const isSettingsPage = location.pathname === "/teacher/settings";

  const loginResult = useQuery(
    api.teachers.login,
    loginSubmitted && teacherEmail && authPassword
      ? { email: teacherEmail, password: authPassword }
      : "skip",
  );
  const teacherProfile = useQuery(api.teachers.getById, teacherId ? { teacherId } : "skip");
  const authenticatedTeacherId = teacherProfile && !teacherProfile.mustChangePassword ? teacherId : null;
  const allStudents = useQuery(api.students.list) ?? [];
  const teacherClasses = useQuery(
    api.teacherClasses.listForTeacher,
    authenticatedTeacherId ? { teacherId: authenticatedTeacherId } : "skip",
  ) ?? [];
  const teacherStudents = useQuery(
    api.teacherClasses.getTeacherStudentDirectory,
    authenticatedTeacherId ? { teacherId: authenticatedTeacherId } : "skip",
  ) ?? [];
  const classDetails = useQuery(
    api.teacherClasses.getClassDetails,
    authenticatedTeacherId && selectedClassId ? { teacherId: authenticatedTeacherId, classId: selectedClassId } : "skip",
  );
  const classStats = useQuery(
    api.teacherClasses.getClassStats,
    authenticatedTeacherId && selectedClassId
      ? {
          teacherId: authenticatedTeacherId,
          classId: selectedClassId,
          range: classStatsRange,
          focusDate: classStatsDate || undefined,
        }
      : "skip",
  );
  const dayAssignments = useQuery(
    api.teacherClasses.getDayAssignments,
    authenticatedTeacherId ? { teacherId: authenticatedTeacherId } : "skip",
  ) ?? {};
  const teacherRoster = useQuery(
    api.attendance.getTeacherRoster,
    authenticatedTeacherId ? { teacherId: authenticatedTeacherId, date: todayStr(), blockLabel: selectedBlockLabel || undefined } : "skip",
  );
  const studentInsights = useQuery(
    api.students.getInsights,
    selectedStudentId ? { studentId: selectedStudentId } : "skip",
  );
  const notifications = useQuery(
    api.notifications.listForTeacher,
    authenticatedTeacherId ? { teacherId: authenticatedTeacherId } : "skip"
  );
  const liveLocations = useQuery(api.attendance.getLiveLocations) ?? [];
  const allLocations = useQuery(api.locations.list) ?? [];
  const bellSchedules = useQuery(api.bellSchedules.list) ?? [];
  const todayRotation = useQuery(api.scheduleRotation.getByDate, { date: todayStr() });
  const recentRotation = useQuery(api.scheduleRotation.listRecent) ?? [];
  const weekMapping = useQuery(api.weekDayMapping.getWeek, { weekStart: weekStart() });
  const rosterMatches = useQuery(
    api.teacherClasses.previewRosterMatches,
    parsedRosterNames.length > 0 ? { names: parsedRosterNames } : "skip",
  ) ?? [];

  const registerTeacher = useMutation(api.teachers.register);
  const changeTeacherPassword = useMutation(api.teachers.changeOwnPassword);
  const markTutorialComplete = useMutation(api.teachers.markTutorialComplete);
  const createTeacherClass = useMutation(api.teacherClasses.create);
  const updateTeacherClass = useMutation(api.teacherClasses.update);
  const removeTeacherClass = useMutation(api.teacherClasses.remove);
  const saveUploadedRoster = useMutation(api.teacherClasses.saveUploadedRoster);
  const addManualRosterEntry = useMutation(api.teacherClasses.addManualRosterEntry);
  const linkRosterEntry = useMutation(api.teacherClasses.linkRosterEntry);
  const removeRosterEntry = useMutation(api.teacherClasses.removeRosterEntry);
  const updateRosterEntryDisplayName = useMutation(api.teacherClasses.updateRosterEntryDisplayName);
  const setStudentStatus = useMutation(api.attendance.setStudentStatus);
  const batchMarkClassUnresolvedAbsent = useMutation(api.attendance.batchMarkClassUnresolvedAbsent);
  const updateSettings = useMutation(api.attendance.updateSettings);
  const ensureTeacherAttendanceNotifications = useMutation(api.attendance.ensureTeacherAttendanceNotifications);
  const sendToMainOffice = useAction(api.attendanceReport.sendToMainOffice);
  const officeEmails = useQuery(api.officeEmails.list) ?? [];
  const addOfficeEmail = useMutation(api.officeEmails.add);
  const removeOfficeEmail = useMutation(api.officeEmails.remove);
  const toggleOfficeEmail = useMutation(api.officeEmails.toggleActive);
  const createScheduledActivity = useMutation(api.scheduledActivities.create);
  const createBatchScheduledActivity = useMutation(api.scheduledActivities.createBatch);
  const updateScheduledActivity = useMutation(api.scheduledActivities.update);
  const removeScheduledActivity = useMutation(api.scheduledActivities.remove);
  const markNotificationRead = useMutation(api.notifications.markAsRead);
  const markAllNotificationsRead = useMutation(api.notifications.markAllAsRead);
  const createTestNotification = useMutation(api.notifications.createTestNotification);
  const removeStudent = useMutation(api.students.remove);
  const updateStudentPasswordByTeacher = useMutation(api.students.updatePasswordByTeacher);
  const parseRosterImage = useAction(api.groq.parseRosterImage);
  const initBellSchedules = useMutation(api.bellSchedules.initialize);
  const setRotation = useMutation(api.scheduleRotation.set);
  const setWeekMap = useMutation(api.weekDayMapping.setWeek);
  const upsertLocation = useMutation(api.locations.upsert);
  const removeLocation = useMutation(api.locations.remove);
  const requestTeacherPasswordReset = useAction(api.teachers.requestPasswordReset);

  const [taggedStudentIds, setTaggedStudentIds] = useState<Id<"students">[]>([]);
  const [newOfficeEmail, setNewOfficeEmail] = useState("");
  const [isSendingToOffice, setIsSendingToOffice] = useState(false);
  const [sendToOfficeMessage, setSendToOfficeMessage] = useState({ text: "", type: "info" });

  useEffect(() => {
    if (!teacherProfile || teacherProfile.tutorialCompletedAt) return;
    if (tutorial.phase !== "idle") return;
    if (pendingTutorialWelcome) {
      tutorial.showWelcome();
      setPendingTutorialWelcome(false);
      hasShownWelcomeThisMountRef.current = true;
      return;
    }
    if (!hasShownWelcomeThisMountRef.current && !isTutorialWelcomeDismissed()) {
      tutorial.showWelcome();
      hasShownWelcomeThisMountRef.current = true;
    }
  }, [teacherProfile, pendingTutorialWelcome, tutorial.phase, tutorial.showWelcome]);

  useEffect(() => {
    if (!tutorial.isActive || tutorial.currentStep?.id !== "classes-intro") return;
    setTab("classes");
    exitClassesWorkspace();
    const timer = window.setTimeout(() => tutorial.nextStep(), 350);
    return () => window.clearTimeout(timer);
  }, [tutorial.isActive, tutorial.currentStep?.id, tutorial.nextStep]);

  useEffect(() => {
    if (!tutorial.isActive || tutorial.currentStep?.id !== "create-class-btn") return;
    if (classesViewMode === "creating") {
      tutorial.nextStep();
    }
  }, [tutorial.isActive, tutorial.currentStep?.id, classesViewMode, tutorial.nextStep]);

  useEffect(() => {
    if (!tutorial.isActive || tutorial.currentStep?.id !== "class-form-submit") return;
    if (selectedClassId) {
      tutorial.nextStep();
    }
  }, [tutorial.isActive, tutorial.currentStep?.id, selectedClassId, tutorial.nextStep]);

  useEffect(() => {
    if (!tutorial.isActive || tutorial.currentStep?.id !== "roster-section") return;
    if (classesViewMode === "createSuccess") {
      tutorial.nextStep();
    }
  }, [tutorial.isActive, tutorial.currentStep?.id, classesViewMode, tutorial.nextStep]);

  useEffect(() => {
    initBellSchedules();
  }, [initBellSchedules]);

  useEffect(() => {
    if (!loginSubmitted || loginResult === undefined) return;
    if (loginResult) {
      setStoredTeacherId(loginResult._id);
      setTeacherId(loginResult._id);
      setAuthError("");
      setResetPasswordResult(null);
      setCurrentTeacherPassword(authPassword);
      setReplacementTeacherPassword("");
      setConfirmReplacementTeacherPassword("");
      setTeacherPasswordUpdateError("");
      if (!loginResult.mustChangePassword) {
        setAuthPassword("");
      }
    } else {
      setAuthError("Incorrect school email or password.");
      setResetPasswordResult(null);
    }
    setLoginSubmitted(false);
  }, [authPassword, loginResult, loginSubmitted]);

  useEffect(() => {
    if (teacherId && teacherProfile === null) {
      clearStoredTeacherId();
      setTeacherId(null);
    }
  }, [teacherId, teacherProfile]);

  useEffect(() => {
    if (!isResizingClassWorkspace) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!classWorkspaceResizeRef.current) return;
      const nextWidth =
        classWorkspaceResizeRef.current.startWidth +
        (classWorkspaceResizeRef.current.startX - event.clientX);
      setClassWorkspaceWidth(Math.min(Math.max(nextWidth, 760), 1600));
    };

    const handleMouseUp = () => {
      classWorkspaceResizeRef.current = null;
      setIsResizingClassWorkspace(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingClassWorkspace]);

  useEffect(() => {
    if (selectedClassId && !teacherClasses.some((classDoc) => classDoc._id.toString() === selectedClassId.toString())) {
      setSelectedClassId(null);
      if (classesViewMode === "editing") {
        setClassesViewMode("landing");
      }
    }
  }, [classesViewMode, selectedClassId, teacherClasses]);

  useEffect(() => {
    if (!selectedStudentId && teacherStudents.length > 0) {
      setSelectedStudentId(teacherStudents[0]._id);
    }
    if (
      selectedStudentId &&
      !teacherStudents.some((student) => student._id.toString() === selectedStudentId.toString())
    ) {
      setSelectedStudentId(teacherStudents[0]?._id ?? null);
    }
  }, [selectedStudentId, teacherStudents]);

  useEffect(() => {
    setAttendanceLookupOpen(false);
    setAttendanceLookupDate("");
    setShowStudentPassword(false);
    setNewStudentPassword("");
    setConfirmStudentPassword("");
    setPasswordChangeError("");
    setPasswordChangeSuccess("");
  }, [selectedStudentId]);

  useEffect(() => {
    if (classDetails?.class) {
      setClassForm({
        name: classDetails.class.name,
        subject: classDetails.class.subject ?? "",
        room: classDetails.class.room,
        grade: classDetails.class.grade ?? "",
        rotationBlock: classDetails.class.rotationBlock ?? "",
      });
    }
  }, [classDetails?.class]);

  useEffect(() => {
    if (todayRotation?.bellScheduleType) {
      setSelectedBellType(todayRotation.bellScheduleType);
    }
  }, [todayRotation?.bellScheduleType]);

  useEffect(() => {
    if (teacherRoster?.settings) {
      setSettingsForm({
        tardyThreshold: String(teacherRoster.settings.tardyThreshold),
        reminderMinutesAfterStart: String(teacherRoster.settings.reminderMinutesAfterStart),
        attendanceReminderEnabled: teacherRoster.settings.attendanceReminderEnabled,
        followUpReminderMinutesAfterFirst: String(teacherRoster.settings.followUpReminderMinutesAfterFirst),
        manualReminderTimes: teacherRoster.settings.manualReminderTimes,
      });
    }
  }, [teacherRoster?.settings]);

  useEffect(() => {
    if (!notifications) return;

    for (const notification of notifications) {
      const id = notification._id.toString();
      if (notification.read || shownBrowserNotificationIdsRef.current.has(id)) continue;
      if (notification.type !== "general") continue;

      shownBrowserNotificationIdsRef.current.add(id);
      const title = notification.message === "Take Attendance Now!" ? "Take Attendance Now!" : "Attendance Reminder";
      const body =
        notification.message === "Take Attendance Now!"
          ? "This is a test attendance reminder."
          : notification.message;

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      }

      setNotificationToast({ title, body });
    }
  }, [notifications]);

  useEffect(() => {
    if (!notificationToast) return;
    const timeoutId = window.setTimeout(() => setNotificationToast(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [notificationToast]);

  useEffect(() => {
    if (!authenticatedTeacherId) return;

    const syncNotifications = () => {
      void ensureTeacherAttendanceNotifications({
        teacherId: authenticatedTeacherId,
        date: todayStr(),
        blockLabel: selectedBlockLabel || undefined,
      });
    };

    syncNotifications();
    const intervalId = window.setInterval(syncNotifications, 30000);
    return () => window.clearInterval(intervalId);
  }, [authenticatedTeacherId, ensureTeacherAttendanceNotifications, selectedBlockLabel]);

  useEffect(() => {
    if (!teacherRoster) return;
    if (!selectedBlockLabel && teacherRoster.selectedBlockLabel) {
      setSelectedBlockLabel(teacherRoster.selectedBlockLabel);
    }
    if (selectedBlockLabel && !teacherRoster.blockOptions.includes(selectedBlockLabel)) {
      setSelectedBlockLabel(teacherRoster.selectedBlockLabel ?? "");
    }
  }, [selectedBlockLabel, teacherRoster]);

  useEffect(() => {
    if (rosterMatches.length === 0) return;
    setRosterSelections((current) => {
      const next = { ...current };
      rosterMatches.forEach((match, index) => {
        const key = String(index);
        if (next[key] === undefined) {
          next[key] = match.suggestedStudentId?.toString() ?? "";
        }
      });
      return next;
    });
  }, [rosterMatches]);

  useEffect(() => {
    if (!classDetails?.roster) return;
    setRosterNameDrafts((current) => {
      const next = { ...current };
      for (const entry of classDetails.roster) {
        const entryId = entry._id.toString();
        if (editingRosterEntryIds[entryId]) continue;
        next[entryId] = entry.displayName;
      }
      return next;
    });
  }, [classDetails?.roster, editingRosterEntryIds]);

  const allStudentOptions = useMemo(
    () =>
      allStudents
        .filter((student) => student.role === "student")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allStudents],
  );

  const manualLinkedStudentLabelById = useMemo(
    () =>
      Object.fromEntries(
        allStudentOptions.map((student) => [student._id.toString(), studentPickerLabel(student)]),
      ) as Record<string, string>,
    [allStudentOptions],
  );

  const manualLinkedStudentOptions = useMemo(() => {
    const term = manualLinkedStudentQuery.trim().toLowerCase();
    if (!term) return [];
    return allStudentOptions
      .filter((student) => {
        const haystack = `${student.name} ${student.studentId} ${student.email ?? ""} ${student.grade ?? ""}`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 8);
  }, [allStudentOptions, manualLinkedStudentQuery]);

  const teacherStudentIds = useMemo(
    () => new Set(teacherStudents.map((student) => student._id.toString())),
    [teacherStudents],
  );

  const movementLogs = useMemo(
    () => liveLocations.filter((log) => teacherStudentIds.has(log.studentId.toString())),
    [liveLocations, teacherStudentIds],
  );

  const movementStudents = useMemo(
    () =>
      allStudents
        .filter((student) => teacherStudentIds.has(student._id.toString()))
        .map((student) => ({ _id: student._id, name: student.name, role: student.role })),
    [allStudents, teacherStudentIds],
  );

  const linkedScheduleStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    return teacherStudents.filter((student) => {
      if (!term) return true;
      return (
        student.name.toLowerCase().includes(term) ||
        student.studentId.toLowerCase().includes(term) ||
        (student.email?.toLowerCase().includes(term) ?? false) ||
        (student.grade?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [studentSearch, teacherStudents]);

  const filteredRoster = useMemo(() => {
    const rows = teacherRoster?.students ?? [];
    const term = rosterSearch.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !term ||
        row.name.toLowerCase().includes(term) ||
        row.studentNumber.toLowerCase().includes(term) ||
        (row.email?.toLowerCase().includes(term) ?? false) ||
        (row.grade?.toLowerCase().includes(term) ?? false) ||
        (row.latestRoom?.toLowerCase().includes(term) ?? false);
      if (!matchesSearch) return false;
      if (rosterFilter === "present") return row.status === "present";
      if (rosterFilter === "absent") return row.status === "absent";
      if (rosterFilter === "excused") return row.status === "excused";
      if (rosterFilter === "activity") return row.status === "activity";
      if (rosterFilter === "tardy") return row.isLateToday;
      return true;
    });
  }, [rosterFilter, rosterSearch, teacherRoster?.students]);

  const selectedStudent = useMemo(
    () => teacherStudents.find((student) => student._id.toString() === selectedStudentId?.toString()) ?? null,
    [selectedStudentId, teacherStudents],
  );
  const selectedStudentBlockOptions = useMemo(() => {
    if (!selectedStudent) return [...CLASS_BLOCK_OPTIONS];
    const linkedBlocks = selectedStudent.linkedClasses
      .map((entry) => entry.block?.trim().toUpperCase())
      .filter((block): block is string => Boolean(block));
    return linkedBlocks.length ? [...new Set(linkedBlocks)] : [...CLASS_BLOCK_OPTIONS];
  }, [selectedStudent]);
  const attendanceLookupMatch = useMemo(
    () =>
      attendanceLookupDate && studentInsights
        ? studentInsights.attendanceByDay.find((day) => day.date === attendanceLookupDate) ?? null
        : null,
    [attendanceLookupDate, studentInsights],
  );
  const selectedTeacherClass = useMemo(
    () => teacherClasses.find((classDoc) => classDoc._id.toString() === selectedClassId?.toString()) ?? null,
    [selectedClassId, teacherClasses],
  );

  const rotationBlockByDay = useMemo(
    () =>
      DAY_OPTIONS.reduce(
        (accumulator, dayLabel) => {
          accumulator[dayLabel] = ROTATION_DAY_SLOTS[dayLabel].map((slot) => ({
            timeRange: slot.timeRange,
            blockLabel: slot.label,
          }));
          return accumulator;
        },
        {} as Record<DayOption, Array<{ timeRange: string; blockLabel: string }>>,
      ),
    [],
  );

  const roomEntries = useMemo(
    () =>
      teacherClasses
        .map((classDoc) => ({
          room: classDoc.room,
          className: classDoc.name,
          subject: classDoc.subject,
          grade: classDoc.grade ?? null,
        }))
        .sort((a, b) => a.room.localeCompare(b.room)),
    [teacherClasses],
  );

  const locationByRoom = useMemo(
    () => new Map(allLocations.map((location) => [location.roomNumber, location])),
    [allLocations],
  );

  const headerDayLabel = todayRotation?.dayLabel;

  async function handleTeacherSubmit() {
    setAuthError("");
    setResetPasswordResult(null);
    if (!teacherEmail || !authPassword || (authMode === "register" && !authName.trim())) {
      setAuthError("Please complete the required fields.");
      return;
    }

    if (authMode === "login") {
      setLoginSubmitted(true);
      return;
    }

    try {
      setIsRegistering(true);
      const teacher = await registerTeacher({
        name: authName.trim(),
        email: teacherEmail,
        password: authPassword,
      });
      setStoredTeacherId(teacher._id);
      setTeacherId(teacher._id);
      setAuthPassword("");
      setResetPasswordResult(null);
      setPendingTutorialWelcome(true);
    } catch (error) {
      setAuthError(friendlyConvexErrorMessage(error, "Could not create teacher account."));
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleTeacherPasswordResetRequest() {
    setAuthError("");
    setResetPasswordResult(null);
    if (!teacherEmail) {
      setAuthError("Enter your school email.");
      return;
    }

    try {
      setIsResettingTeacherPassword(true);
      const result = await requestTeacherPasswordReset({ email: teacherEmail });
      if (!result.success || !result.temporaryPassword) {
        setAuthError("We couldn't find a matching teacher account.");
        return;
      }
      setAuthPassword("");
      setResetPasswordResult({ password: result.temporaryPassword, copied: false });
    } catch (error) {
      setAuthError(friendlyConvexErrorMessage(error, "Could not reset that teacher account."));
    } finally {
      setIsResettingTeacherPassword(false);
    }
  }

  async function handleCopyResetTeacherPassword() {
    if (!resetPasswordResult) return;
    try {
      await navigator.clipboard.writeText(resetPasswordResult.password);
      setResetPasswordResult({ ...resetPasswordResult, copied: true });
    } catch {
      setAuthError("Could not copy the temporary password. Copy it manually instead.");
    }
  }

  async function handleRequiredTeacherPasswordChange() {
    setTeacherPasswordUpdateError("");
    if (!teacherId) {
      setTeacherPasswordUpdateError("Teacher account is unavailable. Log in again.");
      return;
    }
    if (!currentTeacherPassword || !replacementTeacherPassword || !confirmReplacementTeacherPassword) {
      setTeacherPasswordUpdateError("Please complete all password fields.");
      return;
    }
    if (replacementTeacherPassword !== confirmReplacementTeacherPassword) {
      setTeacherPasswordUpdateError("New passwords do not match.");
      return;
    }

    try {
      setIsUpdatingTeacherPassword(true);
      await changeTeacherPassword({
        teacherId,
        currentPassword: currentTeacherPassword,
        newPassword: replacementTeacherPassword,
      });
      setAuthPassword("");
      setCurrentTeacherPassword("");
      setReplacementTeacherPassword("");
      setConfirmReplacementTeacherPassword("");
      setTeacherPasswordUpdateError("");
    } catch (error) {
      setTeacherPasswordUpdateError(friendlyConvexErrorMessage(error, "Could not update teacher password."));
    } finally {
      setIsUpdatingTeacherPassword(false);
    }
  }

  function handleLogout() {
    clearStoredTeacherId();
    setTeacherId(null);
    setAuthPassword("");
    setAuthError("");
    setResetPasswordResult(null);
    setShowForgotPassword(false);
    setCurrentTeacherPassword("");
    setReplacementTeacherPassword("");
    setConfirmReplacementTeacherPassword("");
    setTeacherPasswordUpdateError("");
  }

  function openWeekForm() {
    setWeekForm({
      monday: weekMapping?.monday ?? "",
      tuesday: weekMapping?.tuesday ?? "",
      wednesday: weekMapping?.wednesday ?? "",
      thursday: weekMapping?.thursday ?? "",
      friday: weekMapping?.friday ?? "",
    });
    setEditingWeek(true);
  }

  async function saveRotation() {
    await setRotation({
      date: todayStr(),
      dayLabel: rotationLabel || undefined,
      bellScheduleType: selectedBellType,
    });
    setEditingRotation(false);
    setRotationLabel("");
  }

  async function saveWeekSetup() {
    await setWeekMap({
      weekStart: weekStart(),
      monday: weekForm.monday || undefined,
      tuesday: weekForm.tuesday || undefined,
      wednesday: weekForm.wednesday || undefined,
      thursday: weekForm.thursday || undefined,
      friday: weekForm.friday || undefined,
    });
    const todayLabel = weekForm[todayWeekdayKey()];
    if (todayLabel) {
      await setRotation({ date: todayStr(), dayLabel: todayLabel, bellScheduleType: selectedBellType });
    }
    setEditingWeek(false);
  }

  async function scanForBeacon() {
    if (!editingRoom) return;
    if (!("bluetooth" in navigator)) {
      setBeaconScanState("error");
      setBeaconScanMessage("Web Bluetooth is not available in this browser.");
      return;
    }

    try {
      setBeaconScanState("scanning");
      setBeaconScanMessage(`Searching for a beacon for Room ${editingRoom}...`);

      const filters: BluetoothLEScanFilter[] = [];
      const trimmedRoomName = roomName.trim();
      const existingDeviceName = roomDeviceName.trim();

      if (existingDeviceName) {
        filters.push({ name: existingDeviceName });
      }
      if (trimmedRoomName) {
        filters.push({ name: trimmedRoomName });
      }
      filters.push({ namePrefix: `Room-${editingRoom}` });
      filters.push({ namePrefix: `Room ${editingRoom}` });
      filters.push({ namePrefix: "Room-" });

      const optionalServicesList = new Set<string>([
        "000000c2-0000-1000-8000-00805f9b34fb",
        "00000b12-0000-1000-8000-00805f9b34fb",
        "00000b15-0000-1000-8000-00805f9b34fb",
        "00000b16-0000-1000-8000-00805f9b34fb",
      ]);

      if (editingRoom) {
        const cleanRoom = editingRoom.trim().replace(/[^a-zA-Z0-9]/g, "");
        const firstBlock = cleanRoom.padStart(8, "0").toLowerCase();
        optionalServicesList.add(`${firstBlock}-0000-1000-8000-00805f9b34fb`);
      }

      allLocations.forEach((loc) => {
        if (loc.uuid) {
          optionalServicesList.add(loc.uuid.toLowerCase());
        }
      });

      const device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: Array.from(optionalServicesList),
      });

      const server = await device.gatt?.connect();
      const services = await server?.getPrimaryServices();
      const beaconService = services?.find((service) => !service.uuid.startsWith("000018")) ?? services?.[0];

      if (!beaconService) {
        throw new Error("Connected device did not expose a beacon service UUID.");
      }

      setRoomDeviceName(device.name ?? `Room-${editingRoom}`);
      setRoomUuid(beaconService.uuid.toLowerCase());
      setBeaconScanState("connected");
      setBeaconScanMessage(`Connected to ${device.name ?? "selected beacon"}. Save to link it to Room ${editingRoom}.`);

      if (device.gatt?.connected) {
        device.gatt.disconnect();
      }
    } catch (error) {
      console.error("BLE scan failed:", error);
      const message = error instanceof Error ? error.message : "Bluetooth scan failed or was cancelled.";
      if (message.toLowerCase().includes("cancelled") || message.toLowerCase().includes("user")) {
        setBeaconScanState("idle");
        setBeaconScanMessage("");
        return;
      }
      setBeaconScanState("error");
      setBeaconScanMessage(message);
    }
  }

  function openRoomForm(room: string) {
    const location = locationByRoom.get(room);
    setEditingRoom(room);
    setRoomName(location?.name ?? `Room ${room}`);
    setRoomUuid(location?.uuid ?? "");
    setRoomDeviceName(location?.deviceName ?? "");
    setBeaconScanState(location ? "connected" : "idle");
    setBeaconScanMessage(
      location?.deviceName
        ? `Saved beacon: ${location.deviceName}${location.uuid ? ` (${location.uuid.toLowerCase()})` : ""}`
        : "",
    );
  }

  async function saveRoomBeacon() {
    if (!editingRoom || !roomUuid) return;
    await upsertLocation({
      name: roomName || `Room ${editingRoom}`,
      roomNumber: editingRoom,
      uuid: roomUuid.toLowerCase(),
      deviceName: roomDeviceName.trim() || undefined,
    });
    setEditingRoom(null);
    setRoomName("");
    setRoomUuid("");
    setRoomDeviceName("");
    setBeaconScanState("idle");
    setBeaconScanMessage("");
  }

  function clearRosterBuilderState() {
    if (rosterPreviewImage?.startsWith("blob:")) {
      URL.revokeObjectURL(rosterPreviewImage);
    }
    setRosterFile(null);
    setRosterPreviewImage(null);
    setRosterTextInput("");
    setParsedRosterNames([]);
    setRosterSelections({});
    setRosterParseError("");
    setIsRosterDragActive(false);
  }

  function clearClassWorkspaceDrafts() {
    clearRosterBuilderState();
    setManualEntryName("");
    setManualLinkedStudentId("");
    setLinkSelections({});
    setRosterLinkQueries({});
    setDeleteConfirmation("");
    setDeleteError("");
  }

  function exitClassesWorkspace() {
    clearClassWorkspaceDrafts();
    setClassesViewMode("landing");
    setClassWorkspaceSection("details");
    setClassStatsRange("week");
    setClassStatsDate(todayStr());
    setClassStatsCalendarView(false);
    setClassStatsBulkFilter(null);
    setSelectedClassId(null);
    setNewClassForm(emptyClassForm());
    setRecentlyCreatedClassName("");
  }

  function startCreateClassFlow() {
    exitClassesWorkspace();
    setCreateClassError("");
    setClassesViewMode("creating");
  }

  function openClassWorkspace(classId: Id<"teacherClasses">) {
    clearClassWorkspaceDrafts();
    setSelectedClassId(classId);
    setClassesViewMode("editing");
    setClassWorkspaceSection("details");
    setClassStatsRange("week");
    setClassStatsDate(todayStr());
    setClassStatsCalendarView(false);
    setClassStatsBulkFilter(null);
  }

  function beginClassWorkspaceResize(event: React.MouseEvent<HTMLButtonElement>) {
    classWorkspaceResizeRef.current = {
      startX: event.clientX,
      startWidth: classWorkspaceWidth,
    };
    setIsResizingClassWorkspace(true);
  }

  function selectClassStatsDate(date: string) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    setClassStatsDate(date);
    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
    });
  }

  async function handleCreateClass() {
    if (!authenticatedTeacherId) {
      setCreateClassError("Please log in again before creating a class.");
      return;
    }
    if (
      !newClassForm.name.trim() ||
      !newClassForm.subject.trim() ||
      !newClassForm.room.trim() ||
      !newClassForm.rotationBlock.trim()
    ) {
      setCreateClassError("Please fill in class name, subject, room, and block.");
      return;
    }

    setCreateClassError("");
    setIsCreatingClass(true);
    try {
      const block = newClassForm.rotationBlock.trim().toUpperCase();
      const classId = await createTeacherClass({
        teacherId: authenticatedTeacherId,
        name: newClassForm.name.trim(),
        subject: newClassForm.subject.trim(),
        block,
        room: newClassForm.room.trim(),
        grade: newClassForm.grade.trim() || undefined,
        rotationBlock: newClassForm.rotationBlock.trim() || undefined,
      });
      setSelectedClassId(classId);
      clearClassWorkspaceDrafts();
      setClassesViewMode("creating");
    } catch (error) {
      setCreateClassError(error instanceof Error ? error.message : "Could not create the class.");
    } finally {
      setIsCreatingClass(false);
    }
  }

  async function handleUpdateClass() {
    if (!selectedClassId) return;
    await updateTeacherClass({
      classId: selectedClassId,
      name: classForm.name.trim(),
      subject: classForm.subject.trim(),
      room: classForm.room.trim(),
      grade: classForm.grade.trim() || undefined,
      block: classForm.rotationBlock.trim() || undefined,
      rotationBlock: classForm.rotationBlock || undefined,
    });
    setClassStatsDate(todayStr());
    setClassWorkspaceSection("stats");
    setClassStatsBulkFilter(null);
  }

  async function handleDeleteClass() {
    if (!authenticatedTeacherId || !selectedClassId || !classDetails?.class) return;
    if (!window.confirm(`Delete ${classDetails.class.name}?`)) return;
    await removeTeacherClass({ teacherId: authenticatedTeacherId, classId: selectedClassId });
    exitClassesWorkspace();
  }

  function finishCreateClassSetup() {
    setRecentlyCreatedClassName(classDetails?.class.name ?? (newClassForm.name.trim() || "Class"));
    setClassesViewMode("createSuccess");
  }

  function resetDashboardForTutorial() {
    navigate("/teacher");
    setTab("attendance");
    exitClassesWorkspace();
  }

  function handleStartTutorialFromSettings() {
    resetDashboardForTutorial();
    tutorial.startTourFromSettings();
  }

  function handleTutorialWelcomeStart() {
    resetDashboardForTutorial();
    tutorial.startTour();
  }

  async function handleTutorialNext() {
    if (tutorial.currentStep?.id === "done") {
      if (authenticatedTeacherId) {
        await markTutorialComplete({ teacherId: authenticatedTeacherId });
      }
      tutorial.exitTour();
      return;
    }
    tutorial.nextStep();
  }

  function handleTutorialExit() {
    if (window.confirm("Exit the tour? You can restart it anytime from Settings → Platform Tutorial.")) {
      tutorial.exitTour();
    }
  }

  function handleTutorialSkipRoster() {
    finishCreateClassSetup();
  }

  function applyRosterFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setRosterParseError("Please use an image file for roster upload.");
      return;
    }
    if (rosterPreviewImage?.startsWith("blob:")) {
      URL.revokeObjectURL(rosterPreviewImage);
    }
    setRosterFile(file);
    setParsedRosterNames([]);
    setRosterSelections({});
    setRosterParseError("");
    setRosterPreviewImage(URL.createObjectURL(file));
  }

  function handleRosterDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsRosterDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) applyRosterFile(file);
  }

  function handleRosterPaste(event: ReactClipboardEvent<HTMLDivElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
    const file = imageItem?.getAsFile();
    if (file) {
      event.preventDefault();
      applyRosterFile(file);
      return;
    }

    const pastedText = event.clipboardData.getData("text/plain").trim();
    if (!pastedText) return;
    event.preventDefault();
    if (rosterPreviewImage?.startsWith("blob:")) {
      URL.revokeObjectURL(rosterPreviewImage);
    }
    setRosterFile(null);
    setRosterPreviewImage(null);
    setRosterSelections({});
    setRosterParseError("");
    setRosterTextInput(pastedText);
    setParsedRosterNames(parseRosterText(pastedText));
  }

  async function handleParseRoster() {
    if (!rosterFile) return;
    setIsParsingRoster(true);
    setRosterParseError("");
    try {
      const imageBase64 = await fileToBase64(rosterFile);
      const names = await parseRosterImage({ imageBase64, mimeType: rosterFile.type });
      setParsedRosterNames(names);
    } catch (error) {
      setRosterParseError(error instanceof Error ? error.message : "Could not parse roster image.");
    } finally {
      setIsParsingRoster(false);
    }
  }

  function handleParseRosterText() {
    const names = parseRosterText(rosterTextInput);
    if (names.length === 0) {
      setRosterParseError("Paste at least one student name to build a roster from text.");
      return;
    }
    if (rosterPreviewImage?.startsWith("blob:")) {
      URL.revokeObjectURL(rosterPreviewImage);
    }
    setRosterFile(null);
    setRosterPreviewImage(null);
    setRosterSelections({});
    setRosterParseError("");
    setParsedRosterNames(names);
  }

  function handleParsedRosterNameChange(index: number, value: string) {
    setParsedRosterNames((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function startEditRosterEntryName(entryId: string, displayName: string) {
    setEditingRosterEntryIds((current) => ({ ...current, [entryId]: true }));
    setRosterNameDrafts((current) => ({ ...current, [entryId]: displayName }));
  }

  function cancelEditRosterEntryName(entryId: string, displayName: string) {
    setEditingRosterEntryIds((current) => {
      const next = { ...current };
      delete next[entryId];
      return next;
    });
    setRosterNameDrafts((current) => ({ ...current, [entryId]: displayName }));
  }

  async function handleUpdateStudentPassword() {
    if (!authenticatedTeacherId || !selectedStudentId || !selectedStudent) return;

    const trimmed = newStudentPassword.trim();
    const confirmed = confirmStudentPassword.trim();
    setPasswordChangeError("");
    setPasswordChangeSuccess("");

    if (!trimmed) {
      setPasswordChangeError("Enter a new password.");
      return;
    }
    if (trimmed.length > MAX_STUDENT_PASSWORD_LENGTH) {
      setPasswordChangeError(`Password must be ${MAX_STUDENT_PASSWORD_LENGTH} characters or fewer.`);
      return;
    }
    if (trimmed !== confirmed) {
      setPasswordChangeError("New password and confirmation do not match.");
      return;
    }
    if (trimmed === selectedStudent.studentId) {
      setPasswordChangeError("That is already this student's password.");
      return;
    }

    setIsUpdatingStudentPassword(true);
    try {
      await updateStudentPasswordByTeacher({
        teacherId: authenticatedTeacherId,
        studentId: selectedStudentId,
        newPassword: trimmed,
      });
      setNewStudentPassword("");
      setConfirmStudentPassword("");
      setShowStudentPassword(false);
      setPasswordChangeSuccess(
        `${selectedStudent.name} was notified in the student portal. Check your notifications for confirmation.`,
      );
    } catch (error) {
      setPasswordChangeError(error instanceof Error ? error.message : "Could not update password.");
    } finally {
      setIsUpdatingStudentPassword(false);
    }
  }

  async function handleSaveRosterEntryDisplayName(
    rosterEntryId: Id<"classRosterEntries">,
    displayName: string,
  ) {
    if (!authenticatedTeacherId) return;
    const entryId = rosterEntryId.toString();
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setSavingRosterEntryId(entryId);
    try {
      await updateRosterEntryDisplayName({
        teacherId: authenticatedTeacherId,
        rosterEntryId,
        displayName: trimmed,
      });
      setRosterNameDrafts((current) => ({ ...current, [entryId]: trimmed }));
      setEditingRosterEntryIds((current) => {
        const next = { ...current };
        delete next[entryId];
        return next;
      });
    } finally {
      setSavingRosterEntryId((current) => (current === entryId ? null : current));
    }
  }

  async function handleSaveUploadedRoster() {
    if (!authenticatedTeacherId || !selectedClassId || rosterMatches.length === 0) return;
    await saveUploadedRoster({
      teacherId: authenticatedTeacherId,
      classId: selectedClassId,
      entries: rosterMatches.map((match, index) => ({
        displayName: (parsedRosterNames[index] ?? match.displayName).trim(),
        linkedStudentId: (rosterSelections[String(index)] || null) as Id<"students"> | null,
      })),
    });
    setRosterFile(null);
    setRosterPreviewImage(null);
    setParsedRosterNames([]);
    setRosterSelections({});
  }

  async function handleAddManualRosterEntry() {
    if (!authenticatedTeacherId || !selectedClassId || (!manualEntryName.trim() && !manualLinkedStudentId)) return;
    await addManualRosterEntry({
      teacherId: authenticatedTeacherId,
      classId: selectedClassId,
      displayName: manualEntryName.trim(),
      linkedStudentId: manualLinkedStudentId ? (manualLinkedStudentId as Id<"students">) : undefined,
    });
    setManualEntryName("");
    setManualLinkedStudentId("");
    setManualLinkedStudentQuery("");
  }

  async function handleLinkRosterEntry(rosterEntryId: Id<"classRosterEntries">) {
    if (!authenticatedTeacherId) return;
    const linkedStudentId = linkSelections[rosterEntryId.toString()];
    if (!linkedStudentId) return;
    await linkRosterEntry({
      teacherId: authenticatedTeacherId,
      rosterEntryId,
      linkedStudentId: linkedStudentId as Id<"students">,
    });
    setLinkSelections((current) => ({ ...current, [rosterEntryId.toString()]: "" }));
    setRosterLinkQueries((current) => ({ ...current, [rosterEntryId.toString()]: "" }));
  }

  async function applyManualStatus(studentId: Id<"students">, status: ManualStatus) {
    await setStudentStatus({ studentId, status, date: todayStr() });
  }

  async function applyQuickActivity(studentId: Id<"students">) {
    if (!quickActivityLabel.trim()) return;
    await setStudentStatus({
      studentId,
      date: todayStr(),
      status: "activity",
      activityLabel: quickActivityLabel.trim(),
    });
    setQuickActivityStudentId(null);
    setQuickActivityLabel("");
  }

  function clearActivityForm() {
    setEditingScheduledActivityId(null);
    setActivityDate(todayStr());
    setActivityType("");
    setActivityLabel("");
    setActivityBlock("");
    setActivityNotes("");
  }

  function startEditScheduledActivity(activity: {
    _id: Id<"scheduledActivities">;
    date: string;
    activityLabel: string;
    block?: string;
    notes?: string;
  }) {
    setEditingScheduledActivityId(activity._id);
    setActivityDate(activity.date);
    if (SCHEDULE_ACTIVITY_OPTIONS.includes(activity.activityLabel as (typeof SCHEDULE_ACTIVITY_OPTIONS)[number])) {
      setActivityType(activity.activityLabel);
      setActivityLabel(activity.activityLabel);
    } else {
      setActivityType("Other");
      setActivityLabel(activity.activityLabel);
    }
    setActivityBlock(activity.block ?? "");
    setActivityNotes(activity.notes ?? "");
  }

  async function handleSaveScheduledActivity() {
    if (!selectedStudentId || !activityDate || !activityLabel.trim()) return;
    
    const allStudentIds = [...new Set([selectedStudentId, ...taggedStudentIds])];

    if (editingScheduledActivityId) {
      await updateScheduledActivity({
        id: editingScheduledActivityId,
        date: activityDate,
        activityLabel: activityLabel.trim(),
        block: activityBlock || undefined,
        notes: activityNotes.trim() || undefined,
      });
    } else if (allStudentIds.length > 1) {
      await createBatchScheduledActivity({
        studentIds: allStudentIds,
        date: activityDate,
        activityLabel: activityLabel.trim(),
        block: activityBlock || undefined,
        notes: activityNotes.trim() || undefined,
      });
    } else {
      await createScheduledActivity({
        studentId: selectedStudentId,
        date: activityDate,
        activityLabel: activityLabel.trim(),
        block: activityBlock || undefined,
        notes: activityNotes.trim() || undefined,
      });
    }
    clearActivityForm();
    setTaggedStudentIds([]);
  }

  async function handleBatchAbsent() {
    if (!authenticatedTeacherId || !teacherRoster?.activeClass) return;
    await batchMarkClassUnresolvedAbsent({
      teacherId: authenticatedTeacherId,
      classId: teacherRoster.activeClass._id,
      date: todayStr(),
    });
  }

  async function handleSendToOffice() {
    if (!authenticatedTeacherId || !teacherRoster?.activeClass) return;
    setIsSendingToOffice(true);
    setSendToOfficeMessage({ text: "Sending attendance to main office...", type: "info" });
    try {
      await sendToMainOffice({
        teacherId: authenticatedTeacherId,
        blockLabel: selectedBlockLabel || undefined,
        date: todayStr(),
      });
      setSendToOfficeMessage({ text: "Attendance successfully sent to the main office!", type: "success" });
      setTimeout(() => setSendToOfficeMessage({ text: "", type: "info" }), 5000);
    } catch (error) {
      setSendToOfficeMessage({
        text: error instanceof Error ? error.message : "Failed to send attendance.",
        type: "error",
      });
    } finally {
      setIsSendingToOffice(false);
    }
  }

  async function handleDeleteStudent() {
    if (!selectedStudentId || !selectedStudent) return;
    if (deleteConfirmation.trim().toLowerCase() !== "delete") {
      setDeleteError(`Type delete to confirm removing ${selectedStudent.name}.`);
      return;
    }
    setDeleteError("");
    await removeStudent({ id: selectedStudentId });
    setDeleteConfirmation("");
    setSelectedStudentId(null);
  }

  async function saveSettings() {
    await updateSettings({
      tardyThreshold: Number(settingsForm.tardyThreshold) || 3,
      reminderMinutesAfterStart: Number(settingsForm.reminderMinutesAfterStart) || 1,
      attendanceReminderEnabled: settingsForm.attendanceReminderEnabled,
      followUpReminderMinutesAfterFirst: Number(settingsForm.followUpReminderMinutesAfterFirst) || 1,
      manualReminderTimes: settingsForm.manualReminderTimes,
    });
    setAttendanceSettingsMessage({ text: "Attendance reminder settings saved.", type: "success" });
  }

  function addManualReminderTime() {
    if (!manualReminderTimeInput) return;
    setSettingsForm((current) => ({
      ...current,
      manualReminderTimes: [...new Set([...current.manualReminderTimes, manualReminderTimeInput])].sort(),
    }));
    setManualReminderTimeInput("");
  }

  function removeManualReminderTime(time: string) {
    setSettingsForm((current) => ({
      ...current,
      manualReminderTimes: current.manualReminderTimes.filter((entry) => entry !== time),
    }));
  }

  async function requestBrowserNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") {
      throw new Error("Browser notifications are blocked. Enable them in your browser settings to test reminders.");
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Browser notification permission was not granted.");
    }
    return true;
  }

  async function handleTestAttendanceNotification() {
    if (!authenticatedTeacherId) return;
    try {
      const canUseBrowserNotification = await requestBrowserNotificationPermission();
      await createTestNotification({
        teacherId: authenticatedTeacherId,
        message: "Take Attendance Now!",
      });
      if (canUseBrowserNotification && typeof window !== "undefined" && "Notification" in window) {
        new Notification("Take Attendance Now!", {
          body: "This is a test attendance reminder.",
        });
        setAttendanceSettingsMessage({
          text: "Test notification sent. Browser reminders will appear while this browser stays open.",
          type: "success",
        });
      } else {
        setNotificationToast({
          title: "Take Attendance Now!",
          body: "This browser does not support native notification popups, so an in-app reminder is shown instead.",
        });
        setAttendanceSettingsMessage({
          text: "This browser does not support native notification popups, so the reminder was shown inside the app instead.",
          type: "info",
        });
      }
    } catch (error) {
      setAttendanceSettingsMessage({
        text: error instanceof Error ? error.message : "Could not send the test notification.",
        type: "error",
      });
    }
  }

  function renderBackButton() {
    return (
      <button
        type="button"
        onClick={exitClassesWorkspace}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
      >
        <span aria-hidden="true">&lt;</span>
        <span>Back</span>
      </button>
    );
  }

  function renderCreateClassFormCard() {
    const createdClassSummary = classDetails?.class ?? selectedTeacherClass;

    if (createdClassSummary && selectedClassId) {
      return (
        <div className="card space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Create Class</h2>
              <p className="mt-1 text-sm text-slate-500">
                Class details are saved. Keep going below to upload the roster or add students manually.
              </p>
            </div>
            <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Step 1 complete
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-lg font-semibold text-slate-900">{createdClassSummary.name}</div>
            <div className="mt-1 text-sm text-slate-500">
              {createdClassSummary.subject} · Room {createdClassSummary.room}
              {createdClassSummary.grade ? ` · Grade ${createdClassSummary.grade}` : ""}
              {createdClassSummary.rotationBlock ? ` · Block ${createdClassSummary.rotationBlock}` : ""}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="card space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Create Class</h2>
          <p className="mt-1 text-sm text-slate-500">
            Start with the class details, then build the roster in the next steps.
          </p>
        </div>
        <input
          type="text"
          value={newClassForm.name}
          data-tutorial="class-form-name"
          onChange={(event) => {
            setCreateClassError("");
            setNewClassForm((current) => ({ ...current, name: event.target.value }));
          }}
          placeholder="Class name"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          type="text"
          value={newClassForm.subject}
          data-tutorial="class-form-subject"
          onChange={(event) => {
            setCreateClassError("");
            setNewClassForm((current) => ({ ...current, subject: event.target.value }));
          }}
          placeholder="Subject"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={newClassForm.room}
            data-tutorial="class-form-room"
            onChange={(event) => {
              setCreateClassError("");
              setNewClassForm((current) => ({ ...current, room: event.target.value }));
            }}
            placeholder="Room"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text"
            value={newClassForm.grade}
            onChange={(event) => {
              setCreateClassError("");
              setNewClassForm((current) => ({ ...current, grade: event.target.value }));
            }}
            placeholder="Grade"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={newClassForm.rotationBlock}
            data-tutorial="class-form-block"
            onChange={(event) => {
              setCreateClassError("");
              setNewClassForm((current) => ({ ...current, rotationBlock: event.target.value }));
            }}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 md:col-span-2"
          >
            <option value="">Choose rotation block</option>
            {ROTATION_BLOCK_OPTIONS.map((block) => (
              <option key={block} value={block}>
                Block {block}
              </option>
            ))}
          </select>
        </div>
        {createClassError && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{createClassError}</div>
        )}
        <button
          onClick={handleCreateClass}
          disabled={isCreatingClass}
          data-tutorial="class-form-submit"
          className="btn-primary w-full disabled:opacity-60"
        >
          {isCreatingClass ? "Creating Class..." : "Create Class"}
        </button>
      </div>
    );
  }

  function renderClassSummaryCard() {
    if (!classDetails?.class) return null;
    const isDetailsWorkspace = classWorkspaceSection !== "stats";

    return (
      <div className="card space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{classDetails.class.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {classDetails.class.subject} · Room {classDetails.class.room}
              {classDetails.class.grade ? ` · Grade ${classDetails.class.grade}` : ""}
              {classDetails.class.rotationBlock ? ` · Block ${classDetails.class.rotationBlock}` : ""}
            </p>
          </div>
          <button
            onClick={handleDeleteClass}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            Delete Class
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {CLASS_PRIMARY_NAV_SECTIONS.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setClassWorkspaceSection(section.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  (section.key === "details" && isDetailsWorkspace) || classWorkspaceSection === section.key
                    ? "bg-brand-700 text-white"
                    : "border border-slate-300 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>

          {isDetailsWorkspace && (
            <div className="flex flex-wrap gap-2">
              {CLASS_DETAILS_NAV_SECTIONS.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setClassWorkspaceSection(section.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    classWorkspaceSection === section.key
                      ? "bg-brand-700 text-white"
                      : "border border-slate-300 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderClassDetailsSection() {
    if (!classDetails?.class) return null;

    return (
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">Class Details</h3>
          <InfoTooltip label="Update the class name, subject, room, grade, or rotation block for this class." />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={classForm.name}
            onChange={(event) => setClassForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Class name"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text"
            value={classForm.subject}
            onChange={(event) => setClassForm((current) => ({ ...current, subject: event.target.value }))}
            placeholder="Subject"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text"
            value={classForm.room}
            onChange={(event) => setClassForm((current) => ({ ...current, room: event.target.value }))}
            placeholder="Room"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text"
            value={classForm.grade}
            onChange={(event) => setClassForm((current) => ({ ...current, grade: event.target.value }))}
            placeholder="Grade"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={classForm.rotationBlock}
            onChange={(event) => setClassForm((current) => ({ ...current, rotationBlock: event.target.value }))}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 md:col-span-2"
          >
            <option value="">Choose rotation block</option>
            {ROTATION_BLOCK_OPTIONS.map((block) => (
              <option key={block} value={block}>
                Block {block}
              </option>
            ))}
          </select>
          <button onClick={handleUpdateClass} className="btn-primary md:col-span-2">
            Save Class Details
          </button>
        </div>
      </div>
    );
  }

  function renderClassDetailsWorkspaceSection() {
    return (
      <div className="space-y-6">
        <div className="class-workspace-enter">{renderClassDetailsSection()}</div>
        <div className="class-workspace-enter class-workspace-enter-delay-1">{renderClassRosterSection()}</div>
      </div>
    );
  }

  function renderRosterUploadSection() {
    return (
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Roster Upload</h3>
            <p className="text-sm text-slate-500">
              Upload a roster image, paste a Google Classroom students screenshot, or paste roster text here, then confirm the matches.
            </p>
          </div>
          <button
            onClick={() => rosterFileRef.current?.click()}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700"
          >
            Choose Image
          </button>
          <input
            ref={rosterFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) applyRosterFile(file);
            }}
          />
        </div>

        <div
          tabIndex={0}
          onPaste={handleRosterPaste}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsRosterDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isRosterDragActive) setIsRosterDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setIsRosterDragActive(false);
          }}
          onDrop={handleRosterDrop}
          onClick={() => rosterFileRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed px-5 py-6 text-sm outline-none transition-colors ${ isRosterDragActive ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-300 bg-slate-50 text-slate-500 hover:border-brand-300 hover:bg-brand-50/50" }`}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold text-slate-800">Drop a roster image here or click to choose a file</div>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              {rosterFile ? rosterFile.name : "PNG, JPG, or screenshot"}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-col gap-3">
            <div>
              <h4 className="font-semibold text-slate-900">Paste roster text</h4>
              <p className="mt-1 text-sm text-slate-500">
                Paste student names from Google Classroom, a spreadsheet, or a copied list. Use one name per line or comma-separated names.
              </p>
            </div>
            <textarea
              value={rosterTextInput}
              onChange={(event) => setRosterTextInput(event.target.value)}
              rows={5}
              placeholder={"Student Name 1\nStudent Name 2\nStudent Name 3"}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button onClick={handleParseRosterText} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700">
              Build Roster From Text
            </button>
          </div>
        </div>

        {rosterPreviewImage && (
          <img src={rosterPreviewImage} alt="Roster preview" className="max-h-72 rounded-2xl border border-slate-200 object-contain" />
        )}

        {rosterFile && parsedRosterNames.length === 0 && (
          <button onClick={handleParseRoster} disabled={isParsingRoster} className="btn-primary w-full disabled:opacity-50">
            {isParsingRoster ? "Reading roster..." : "Parse Roster with Groq"}
          </button>
        )}

        {rosterParseError && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{rosterParseError}</div>
        )}

        {rosterMatches.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Review and edit parsed names before saving. Student linking updates as you edit each name.
            </p>
            {rosterMatches.map((match, index) => (
              <div key={`${index}-${match.displayName}`} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Student name
                    </label>
                    <input
                      type="text"
                      value={parsedRosterNames[index] ?? match.displayName}
                      onChange={(event) => handleParsedRosterNameChange(index, event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      {match.matchType === "exact"
                        ? "Exact match"
                        : match.matchType === "likely"
                          ? "Likely match"
                          : match.matchType === "ambiguous"
                            ? "Ambiguous match"
                            : "Unmatched"}
                    </div>
                  </div>
                  <select
                    value={rosterSelections[String(index)] ?? ""}
                    onChange={(event) =>
                      setRosterSelections((current) => ({
                        ...current,
                        [String(index)]: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 lg:w-80"
                  >
                    <option value="">Save as placeholder</option>
                    {match.candidates.map((candidate) => (
                      <option key={candidate.studentId.toString()} value={candidate.studentId.toString()}>
                        {candidate.name.split(" ")[0]} (Grade {candidate.grade ?? "—"}) · {candidate.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            <button onClick={handleSaveUploadedRoster} className="btn-primary w-full">
              Save Parsed Roster
            </button>
          </div>
        )}
      </div>
    );
  }

  const teacherFieldInputClass =
    "rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400";

  function renderManualRosterSection() {
    return (
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Manual Roster Add</h3>
        <div className="grid gap-3 lg:grid-cols-[1fr,280px,auto]">
          <input
            type="text"
            value={manualEntryName}
            onChange={(event) => setManualEntryName(event.target.value)}
            placeholder="Student display name"
            className={teacherFieldInputClass}
          />
          <div className="space-y-2">
            <input
              type="text"
              value={manualLinkedStudentQuery}
              onChange={(event) => {
                const nextValue = event.target.value;
                setManualLinkedStudentQuery(nextValue);
                const exactMatch = allStudentOptions.find(
                  (student) => manualLinkedStudentLabelById[student._id.toString()] === nextValue,
                );
                setManualLinkedStudentId(exactMatch?._id.toString() ?? "");
              }}
              placeholder="Search student name"
              className={`w-full ${teacherFieldInputClass}`}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400 dark:text-slate-400">
                {manualLinkedStudentId
                  ? `Linked to ${manualLinkedStudentLabelById[manualLinkedStudentId]}`
                  : "Type a student's name to search, or leave blank for no linked account."}
              </p>
              {manualLinkedStudentId && (
                <button
                  type="button"
                  onClick={() => {
                    setManualLinkedStudentId("");
                    setManualLinkedStudentQuery("");
                  }}
                  className="shrink-0 text-xs font-semibold text-slate-500 underline hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                >
                  Clear
                </button>
              )}
            </div>
            {!manualLinkedStudentId && manualLinkedStudentQuery.trim() && (
              <div className="student-search-menu rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-600 dark:bg-slate-950">
                {manualLinkedStudentOptions.length > 0 ? (
                  manualLinkedStudentOptions.map((student) => {
                    const label = manualLinkedStudentLabelById[student._id.toString()];
                    return (
                      <button
                        key={student._id.toString()}
                        type="button"
                        onClick={() => {
                          setManualLinkedStudentId(student._id.toString());
                          setManualLinkedStudentQuery(label);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{student.name.split(" ")[0]}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-400">{student.name}</span>
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Grade {student.grade ?? "—"}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-2 py-2 text-xs text-slate-400 dark:text-slate-400">No students match that search.</div>
                )}
              </div>
            )}
          </div>
          <button onClick={handleAddManualRosterEntry} className="btn-primary px-4">
            Add
          </button>
        </div>
      </div>
    );
  }

  function renderClassRosterSection() {
    return (
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Class Roster</h3>
        {classDetails === undefined ? (
          <p className="text-sm text-slate-400">Loading roster details...</p>
        ) : classDetails?.roster.length ? (
          <div className="space-y-3">
            {classDetails.roster.map((entry) => {
              const entryId = entry._id.toString();
              const isEditingName = Boolean(editingRosterEntryIds[entryId]);
              const nameDraft = rosterNameDrafts[entryId] ?? entry.displayName;
              const trimmedDraft = nameDraft.trim();
              const nameDraftDirty = trimmedDraft !== entry.displayName;
              const isSavingName = savingRosterEntryId === entryId;

              return (
              <div key={entryId} className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-600">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">
                      Roster name
                    </label>
                    {isEditingName ? (
                      <div className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="text"
                          value={nameDraft}
                          autoFocus
                          onChange={(event) =>
                            setRosterNameDrafts((current) => ({
                              ...current,
                              [entryId]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && nameDraftDirty && trimmedDraft) {
                              void handleSaveRosterEntryDisplayName(entry._id, nameDraft);
                            }
                            if (event.key === "Escape") {
                              cancelEditRosterEntryName(entryId, entry.displayName);
                            }
                          }}
                          className={`w-full flex-1 px-3 py-2 ${teacherFieldInputClass}`}
                        />
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveRosterEntryDisplayName(entry._id, nameDraft)}
                            disabled={!nameDraftDirty || !trimmedDraft || isSavingName}
                            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSavingName ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelEditRosterEntryName(entryId, entry.displayName)}
                            disabled={isSavingName}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex max-w-xl flex-wrap items-center gap-3">
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{entry.displayName}</p>
                        <button
                          type="button"
                          onClick={() => startEditRosterEntryName(entryId, entry.displayName)}
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
                        >
                          Edit name
                        </button>
                      </div>
                    )}
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {entry.linkedStudent
                        ? `Linked account: ${studentPickerLabel(entry.linkedStudent)}`
                        : "Placeholder entry"}
                      {entry.source ? ` · ${entry.source}` : ""}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 xl:items-end">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ entry.status === "linked" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600" }`}
                    >
                      {entry.status === "linked" ? "Linked" : "Placeholder"}
                    </span>

                    {entry.status === "placeholder" && (
                      <div className="flex flex-wrap gap-2 items-start">
                        <div className="relative space-y-1">
                          <input
                            type="text"
                            value={rosterLinkQueries[entry._id.toString()] ?? ""}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setRosterLinkQueries((current) => ({
                                ...current,
                                [entry._id.toString()]: nextValue,
                              }));
                              setLinkSelections((current) => ({
                                ...current,
                                [entry._id.toString()]: "",
                              }));
                            }}
                            placeholder="Search student name..."
                            className={`w-64 px-3 py-2 ${teacherFieldInputClass}`}
                          />
                          {!linkSelections[entry._id.toString()] && (rosterLinkQueries[entry._id.toString()] ?? "").trim() && (
                            <div className="student-search-menu absolute left-0 right-0 z-20 mt-1 max-h-48 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-950">
                              {(() => {
                                const term = (rosterLinkQueries[entry._id.toString()] ?? "").trim().toLowerCase();
                                const filtered = allStudentOptions.filter((student) => {
                                  const haystack = `${student.name} ${student.studentId} ${student.email ?? ""} ${student.grade ?? ""}`.toLowerCase();
                                  return haystack.includes(term);
                                }).slice(0, 8);
                                
                                return filtered.length > 0 ? (
                                  filtered.map((student) => (
                                    <button
                                      key={student._id.toString()}
                                      type="button"
                                      onClick={() => {
                                        setLinkSelections((current) => ({
                                          ...current,
                                          [entry._id.toString()]: student._id.toString(),
                                        }));
                                        setRosterLinkQueries((current) => ({
                                          ...current,
                                          [entry._id.toString()]: student.name,
                                        }));
                                      }}
                                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{student.name.split(" ")[0]}</span>
                                        <span className="text-xs text-slate-400 dark:text-slate-400">{student.name}</span>
                                      </div>
                                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Grade {student.grade ?? "—"}</span>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-2 py-2 text-xs text-slate-400 dark:text-slate-400">No students match that search.</div>
                                );
                              })()}
                            </div>
                          )}
                          {linkSelections[entry._id.toString()] && (
                            <div className="flex items-center justify-between gap-2 mt-1 px-1">
                              <span className="text-xs text-brand-600 font-medium">
                                Ready to link: {allStudentOptions.find(s => s._id.toString() === linkSelections[entry._id.toString()])?.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setLinkSelections((current) => ({
                                    ...current,
                                    [entry._id.toString()]: "",
                                  }));
                                  setRosterLinkQueries((current) => ({
                                    ...current,
                                    [entry._id.toString()]: "",
                                  }));
                                }}
                                className="text-xs font-semibold text-slate-500 underline hover:text-slate-700"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleLinkRosterEntry(entry._id)}
                          disabled={!linkSelections[entry._id.toString()]}
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
                        >
                          Link
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() =>
                        authenticatedTeacherId &&
                        removeRosterEntry({ teacherId: authenticatedTeacherId, rosterEntryId: entry._id })
                      }
                      className="text-sm text-red-600 underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400">This class does not have a roster yet.</p>
        )}
      </div>
    );
  }

  function renderClassStatsSection() {
    if (!classDetails?.class) return null;
    if (classStats === undefined) {
      return (
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Class Stats</h3>
          <p className="text-sm text-slate-400">Loading class attendance trends...</p>
        </div>
      );
    }
    if (!classStats) {
      return (
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Class Stats</h3>
          <p className="text-sm text-slate-400">This class stats view is not available right now.</p>
        </div>
      );
    }

    const calendarEntries = new Map(classStats.calendarMonth.dates.map((entry) => [entry.date, entry]));
    const calendarDays = monthGridDays(classStats.calendarMonth.monthStart);
    const activeMonthKey = classStats.calendarMonth.monthStart.slice(0, 7);
    const focusStudents = classStats.focusDateSummary?.students ?? [];
    const bulkEntries = classStats.dates.flatMap((entry) =>
      entry.students
        .filter((student) => {
          if (!classStatsBulkFilter) return false;
          if (classStatsBulkFilter === "tardy") return student.isLate;
          if (classStatsBulkFilter === "activityExcused") {
            return student.status === "activity" || student.status === "excused";
          }
          return student.status === classStatsBulkFilter;
        })
        .map((student) => ({
          date: entry.date,
          dayLabel: entry.dayLabel,
          student,
        })),
    );
    const bulkFilterLabel =
      classStatsBulkFilter === "present"
        ? "Present"
        : classStatsBulkFilter === "absent"
          ? "Absent"
          : classStatsBulkFilter === "activityExcused"
            ? "Activity / Excused"
            : classStatsBulkFilter === "unresolved"
              ? "Unresolved"
              : classStatsBulkFilter === "tardy"
                ? "Tardy"
                : "";

    return (
      <div className="space-y-6">
        <div className="card space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Class Stats</h3>
              <p className="mt-1 text-sm text-slate-500">
                Review attendance in bulk for {classDetails.class.name} only, then drill into one class date at a time.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setClassStatsCalendarView((current) => !current)}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <path d="M8 2v4M16 2v4M3 10h18" />
              </svg>
              <span>{classStatsCalendarView ? "List View" : "Calendar View"}</span>
            </button>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                ["week", "Week"],
                ["month", "Month"],
                ["3months", "3 Months"],
              ] as Array<[ClassStatsRange, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setClassStatsRange(value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    classStatsRange === value ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Search Class Date
              </label>
              <input
                type="date"
                value={classStatsDate}
                onChange={(event) => setClassStatsDate(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <button type="button" onClick={() => setClassStatsBulkFilter("present")} className="text-left">
              <SummaryCard value={classStats.summary.present ?? 0} label="Present" tone="text-emerald-600" />
            </button>
            <button type="button" onClick={() => setClassStatsBulkFilter("absent")} className="text-left">
              <SummaryCard value={classStats.summary.absent ?? 0} label="Absent" tone="text-red-600" />
            </button>
            <button type="button" onClick={() => setClassStatsBulkFilter("activityExcused")} className="text-left">
              <SummaryCard value={(classStats.summary.activity ?? 0) + (classStats.summary.excused ?? 0)} label="Activity / Excused" tone="text-sky-600" />
            </button>
            <button type="button" onClick={() => setClassStatsBulkFilter("unresolved")} className="text-left">
              <SummaryCard value={classStats.summary.unresolved ?? 0} label="Unresolved" tone="text-amber-600" />
            </button>
            <button type="button" onClick={() => setClassStatsBulkFilter("tardy")} className="text-left">
              <SummaryCard value={classStats.summary.tardy ?? 0} label="Tardy" tone="text-violet-600" />
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            {classStats.summary.classDates} class dates in this view · {classStats.linkedStudentCount} linked students · {fmtDateLabel(classStats.rangeStart)} through {fmtDateLabel(classStats.rangeEnd)}
          </div>
        </div>

        {classStatsBulkFilter && (
          <div className="card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{bulkFilterLabel} Students</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {bulkEntries.length} {bulkEntries.length === 1 ? "result" : "results"} for {classDetails.class.name} in the current {classStatsRange} view.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClassStatsBulkFilter(null)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                aria-label="Close bulk class stats list"
              >
                ×
              </button>
            </div>

            {bulkEntries.length > 0 ? (
              <div className="space-y-3">
                {bulkEntries.map((entry) => (
                  <div key={`${entry.date}-${entry.student.studentId.toString()}-${entry.student.status}-${entry.student.isLate ? "late" : "ontime"}`} className="rounded-2xl border border-slate-200 px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{entry.student.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {fmtDateLabel(entry.date)} · {entry.dayLabel}
                          {entry.student.grade ? ` · Grade ${entry.student.grade}` : ""}
                        </div>
                        {entry.student.activityLabel && (
                          <div className="mt-1 text-xs text-slate-400">{entry.student.activityLabel}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-start gap-2 lg:items-end">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classStatsStatusBadge(entry.student.status, classStatsBulkFilter === "tardy")}`}>
                          {classStatsStatusLabel(entry.student.status, classStatsBulkFilter === "tardy")}
                        </span>
                        <div className="text-xs text-slate-500">
                          {entry.student.latestCheckInTime
                            ? `${fmt(entry.student.latestCheckInTime)}${entry.student.isLate ? " · Late" : ""}`
                            : "No check-in"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-400">
                No students matched {bulkFilterLabel.toLowerCase()} in this class during the selected range.
              </div>
            )}
          </div>
        )}

        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 xl:flex-row xl:flex-nowrap xl:items-start xl:justify-center">
          <div className={`card w-full min-w-0 xl:max-w-none xl:flex-1 space-y-4 ${classStatsCalendarView ? "class-stats-resizable-card" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {classStatsCalendarView ? fmtMonthLabel(classStats.calendarMonth.monthStart) : "Attendance by Class Date"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {classStatsCalendarView
                    ? "Tap a class day in the calendar to inspect that date."
                    : "Each row shows totals for this class only."}
                </p>
              </div>
            </div>

            {classStatsCalendarView ? (
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {calendarDays.map((date) => {
                    const entry = calendarEntries.get(date) ?? null;
                    const isActiveMonth = date.slice(0, 7) === activeMonthKey;
                    const isSelected = date === classStats.focusDate;
                    return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => selectClassStatsDate(date)}
                        className={`class-stats-date-selected min-h-28 rounded-2xl border px-2 py-2 text-left transition-colors ${
                          isSelected
                            ? "border-brand-300 bg-brand-50"
                            : isActiveMonth
                              ? "border-slate-200 bg-white hover:border-brand-200"
                              : "border-slate-200 bg-slate-50 text-slate-400"
                        }`}
                      >
                        <div className="text-xs font-semibold">{new Date(`${date}T00:00:00`).getDate()}</div>
                        {entry ? (
                          <div className="mt-2 space-y-1 text-[11px]">
                            <div className="text-red-600">{entry.summary.absent} absent</div>
                            <div className="text-sky-600">{entry.summary.activity + entry.summary.excused} activity / excused</div>
                            <div className="text-amber-600">{entry.summary.unresolved} unresolved</div>
                            <div className="text-violet-600">{entry.summary.tardy} tardy</div>
                          </div>
                        ) : (
                          <div className="mt-3 text-[11px] text-slate-400">
                            {isActiveMonth ? "No class" : ""}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : classStats.dates.length > 0 ? (
              <div className="space-y-3">
                {classStats.dates.map((entry) => (
                  <button
                    key={entry.date}
                    type="button"
                    onClick={() => selectClassStatsDate(entry.date)}
                    className={`class-stats-date-selected w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      classStats.focusDate === entry.date ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-200"
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{fmtDateLabel(entry.date)}</div>
                        <div className="mt-1 text-sm text-slate-500">{entry.dayLabel}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{entry.summary.present} present</span>
                        <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">{entry.summary.absent} absent</span>
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">{entry.summary.activity + entry.summary.excused} activity / excused</span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{entry.summary.unresolved} unresolved</span>
                        <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">{entry.summary.tardy} tardy</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No class dates were found in this range yet.</p>
            )}
          </div>

          <div className="card w-full min-w-0 xl:w-[420px] xl:shrink-0 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Specific Date</h3>
              <p className="mt-1 text-sm text-slate-500">
                Review every linked student for one class date.
              </p>
            </div>

            {classStats.focusDateSummary ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="font-semibold text-slate-900">{fmtDateLabel(classStats.focusDateSummary.date)}</div>
                  <div className="mt-1 text-sm text-slate-500">{classStats.focusDateSummary.dayLabel}</div>
                </div>
                <div className="space-y-3">
                  {focusStudents.map((student) => (
                    <div key={student.studentId.toString()} className="rounded-2xl border border-slate-200 px-4 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">{student.name}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {studentPublicSubtitle(student)}
                          </div>
                          {student.activityLabel && (
                            <div className="mt-1 text-xs text-slate-400">{student.activityLabel}</div>
                          )}
                        </div>
                        <div className="flex flex-col items-start gap-2 lg:items-end">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classStatsStatusBadge(student.status, student.isLate)}`}>
                            {classStatsStatusLabel(student.status, student.isLate)}
                          </span>
                          <div className="text-xs text-slate-500">
                            {student.latestCheckInTime ? `${fmt(student.latestCheckInTime)}${student.isLate ? " · Late" : ""}` : "No check-in"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-400">
                This class does not meet on the selected date, or there is no class attendance history yet.
              </div>
            )}
          </div>
        </div>

      </div>
    );
  }

  function renderDayBlockPlannerSection() {
    return (
      <div className="card space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Day Block Planner</h3>
          <p className="mt-1 text-sm text-slate-500">
            Each day follows the fixed rotation pattern. Once each class has a home block, the planner fills in automatically.
          </p>
        </div>

        <div className="space-y-6">
          {DAY_OPTIONS.map((dayLabel) => (
            <div key={dayLabel} className="rounded-2xl border border-slate-200 px-4 py-4">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-semibold text-slate-900">{dayLabel}</h4>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Auto-filled from class blocks
                </span>
              </div>

              <div className="space-y-3">
                {(dayAssignments[dayLabel] ?? rotationBlockByDay[dayLabel] ?? []).map((slot) => (
                  <div
                    key={`${dayLabel}-${slot.timeRange}-${slot.blockLabel}`}
                    className="grid gap-3 rounded-2xl bg-slate-50 px-4 py-4 md:grid-cols-[120px,120px,1fr] md:items-center"
                  >
                    <div className="text-sm font-medium text-slate-500">{slot.timeRange}</div>
                    <div className="text-sm font-semibold text-slate-700">{slot.blockLabel}</div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      {"className" in slot && slot.className ? (
                        <div>
                          <div className="font-semibold text-slate-900">{slot.className}</div>
                          <div className="mt-1 text-slate-500">
                            {slot.subject ? `${slot.subject} · ` : ""}Room {slot.room}
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-400">
                          {slot.blockLabel.includes("Lunch")
                            ? "Fixed lunch / EP block"
                            : "No class assigned to this block yet"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderEditWorkspaceSection() {
    if (!selectedClassId || !classDetails?.class) {
      return (
        <div className="card rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-400">
          Choose a class from the Classes landing page to open its workspace.
        </div>
      );
    }

    if (classWorkspaceSection === "details") return renderClassDetailsWorkspaceSection();
    if (classWorkspaceSection === "stats") return <div className="class-workspace-enter">{renderClassStatsSection()}</div>;
    if (classWorkspaceSection === "rosterUpload") return <div className="class-workspace-enter">{renderRosterUploadSection()}</div>;
    if (classWorkspaceSection === "manualAdd") return <div className="class-workspace-enter">{renderManualRosterSection()}</div>;
    if (classWorkspaceSection === "roster") return <div className="class-workspace-enter">{renderClassRosterSection()}</div>;
    return <div className="class-workspace-enter">{renderDayBlockPlannerSection()}</div>;
  }

  function renderSettingsPanel() {
    return (
      <div className={isSettingsPage ? "space-y-6" : "mt-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Settings</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage school-wide rotation helpers and schedule formats here.
            </p>
          </div>
          <button
            onClick={() => navigate("/teacher")}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="card space-y-3 xl:col-span-2">
          <div>
            <h3 className="font-semibold text-slate-800">Platform Tutorial</h3>
            <p className="mt-1 text-sm text-slate-500">
              Replay the guided walkthrough to learn how to use the dashboard and create a class.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartTutorialFromSettings}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            Start Tutorial
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800">Attendance Settings</h3>
              <InfoTooltip label="Use this section to control when teachers get attendance reminders after class starts and when a follow-up reminder should be sent." />
            </div>
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Attendance Notifications</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Remind teachers to take attendance after class starts, then send one follow-up reminder if attendance is still incomplete.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.attendanceReminderEnabled}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      attendanceReminderEnabled: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    First Reminder Minutes After Start
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settingsForm.reminderMinutesAfterStart}
                    onChange={(event) =>
                      setSettingsForm((current) => ({ ...current, reminderMinutesAfterStart: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Follow-Up Minutes Later
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settingsForm.followUpReminderMinutesAfterFirst}
                    onChange={(event) =>
                      setSettingsForm((current) => ({
                        ...current,
                        followUpReminderMinutesAfterFirst: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-800">Manual Reminder Times</div>
                <div className="mt-1 text-xs text-slate-500">
                  Add custom times when you want a “Take Attendance Now!” reminder.
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="time"
                    value={manualReminderTimeInput}
                    onChange={(event) => setManualReminderTimeInput(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={addManualReminderTime}
                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                  >
                    Add Time
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {settingsForm.manualReminderTimes.length > 0 ? (
                    settingsForm.manualReminderTimes.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => removeManualReminderTime(time)}
                        className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
                      >
                        {time} ×
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">No manual reminder times added yet.</div>
                  )}
                </div>
              </div>

              {attendanceSettingsMessage.text && (
                <div
                  className={`rounded-xl px-4 py-3 text-sm font-medium ${
                    attendanceSettingsMessage.type === "error"
                      ? "bg-red-50 text-red-700"
                      : attendanceSettingsMessage.type === "success"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {attendanceSettingsMessage.text}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={saveSettings}
                className="btn-primary w-full"
              >
                Save Settings
              </button>
              <button
                onClick={handleTestAttendanceNotification}
                className="w-full rounded-2xl border border-slate-300 bg-white px-6 py-4 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                Test Notification
              </button>
            </div>
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Today's Day</h3>
              <button
                onClick={() => {
                  setEditingRotation(!editingRotation);
                  setRotationLabel(todayRotation?.dayLabel ?? "");
                }}
                className="text-xs text-brand-600 underline"
              >
                {editingRotation ? "Cancel" : "Change"}
              </button>
            </div>

            {!editingRotation && todayRotation && (
              <div className="rounded-xl bg-brand-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-600">Today</p>
                <p className="mt-0.5 text-2xl font-bold text-brand-800">{todayRotation.dayLabel}</p>
              </div>
            )}

            {(editingRotation || !todayRotation) && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">What day is today?</p>
                <div className="grid grid-cols-2 gap-2">
                  {DAY_OPTIONS.map((day) => (
                    <button
                      key={day}
                      onClick={() => setRotationLabel(day)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${ rotationLabel === day ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 text-slate-600 hover:border-brand-400" }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <button
                  onClick={saveRotation}
                  disabled={!rotationLabel}
                  className="btn-primary w-full px-4 py-2 text-sm disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            )}

            {recentRotation.length > 0 && (
              <div className="space-y-1 border-t border-slate-100 pt-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Recent</p>
                {recentRotation.slice(0, 5).map((entry) => (
                  <div key={entry._id.toString()} className="flex justify-between text-sm">
                    <span className="text-slate-400">{entry.date}</span>
                    <span className="font-medium text-slate-700">
                      {entry.dayLabel} {entry.bellScheduleType && entry.bellScheduleType !== "Standard" ? `(${entry.bellScheduleType})` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-800">Bell Schedule</h3>
            <p className="text-xs text-slate-500">Change the format for special events.</p>
            <div className="space-y-2">
              {bellSchedules.map((schedule) => (
                <button
                  key={schedule.type}
                  onClick={() => {
                    setSelectedBellType(schedule.type);
                    setRotation({
                      date: todayStr(),
                      bellScheduleType: schedule.type,
                      dayLabel: todayRotation?.dayLabel,
                    });
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-all ${ selectedBellType === schedule.type ? "bg-brand-50 text-brand-800 ring-2 ring-brand-500/20 border-brand-200" : "border-slate-200 text-slate-600 hover:border-brand-300" }`}
                >
                  {schedule.type}
                  {selectedBellType === schedule.type && <div className="h-2 w-2 rounded-full bg-brand-600" />}
                </button>
              ))}
            </div>
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Week Setup</h3>
              <button onClick={() => (editingWeek ? setEditingWeek(false) : openWeekForm())} className="text-xs text-brand-600 underline">
                {editingWeek ? "Cancel" : "Edit"}
              </button>
            </div>

            {!editingWeek && weekMapping ? (
              <div className="space-y-1">
                {WEEKDAYS.map((day) => {
                  const label = weekMapping[day];
                  return label ? (
                    <div key={day} className="flex justify-between text-sm">
                      <span className="capitalize text-slate-500">{day}</span>
                      <span className="font-medium text-slate-700">{label}</span>
                    </div>
                  ) : null;
                })}
              </div>
            ) : !editingWeek ? (
              <p className="text-xs text-slate-400">No week mapping set. Click Edit to assign Day 1–4 to each weekday.</p>
            ) : (
              <div className="space-y-2">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-24 text-sm font-medium capitalize text-slate-600">{day}</span>
                    <select
                      value={weekForm[day]}
                      onChange={(event) =>
                        setWeekForm((current) => ({ ...current, [day]: event.target.value }))
                      }
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Not set</option>
                      {DAY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <button onClick={saveWeekSetup} className="btn-primary w-full px-4 py-2 text-sm">
                  Save Week Setup
                </button>
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-800">Main Office Emails</h3>
            <p className="text-xs text-slate-500">Attendance reports will be sent to these addresses.</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={newOfficeEmail}
                onChange={(e) => setNewOfficeEmail(e.target.value)}
                placeholder="office@school.org"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={() => {
                  if (newOfficeEmail.trim()) {
                    addOfficeEmail({ email: newOfficeEmail.trim() });
                    setNewOfficeEmail("");
                  }
                }}
                className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-800"
              >
                Add
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {officeEmails.map((email) => (
                <div key={email._id.toString()} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium ${email.active ? "text-slate-900" : "text-slate-400 line-through"}`}>
                      {email.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleOfficeEmail({ id: email._id, active: !email.active })}
                      className={`text-xs font-semibold ${email.active ? "text-amber-600" : "text-emerald-600"} hover:underline`}
                    >
                      {email.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => removeOfficeEmail({ id: email._id })}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {officeEmails.length === 0 && (
                <p className="text-center text-xs text-slate-400 italic">No office emails configured.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (teacherProfile?.mustChangePassword && teacherId) {
    return (
      <ForcePasswordChangePanel
        teacherName={teacherProfile.name}
        teacherEmail={teacherProfile.email}
        currentPassword={currentTeacherPassword}
        setCurrentPassword={(value) => {
          setCurrentTeacherPassword(value);
          setTeacherPasswordUpdateError("");
        }}
        newPassword={replacementTeacherPassword}
        setNewPassword={(value) => {
          setReplacementTeacherPassword(value);
          setTeacherPasswordUpdateError("");
        }}
        confirmPassword={confirmReplacementTeacherPassword}
        setConfirmPassword={(value) => {
          setConfirmReplacementTeacherPassword(value);
          setTeacherPasswordUpdateError("");
        }}
        error={teacherPasswordUpdateError}
        onSubmit={handleRequiredTeacherPasswordChange}
        onLogout={handleLogout}
        loading={isUpdatingTeacherPassword}
      />
    );
  }

  if (!authenticatedTeacherId || teacherProfile === undefined) {
    return (
      <AuthPanel
        mode={authMode}
        setMode={(mode) => {
          setAuthMode(mode);
          setAuthError("");
          setResetPasswordResult(null);
          setLoginSubmitted(false);
        }}
        name={authName}
        setName={setAuthName}
        emailPrefix={authEmailPrefix}
        setEmailPrefix={(value) => {
          setAuthEmailPrefix(value);
          setAuthError("");
          setResetPasswordResult(null);
          setLoginSubmitted(false);
        }}
        password={authPassword}
        setPassword={(value) => {
          setAuthPassword(value);
          setAuthError("");
          setResetPasswordResult(null);
          setLoginSubmitted(false);
        }}
        error={authError}
        resetPasswordResult={resetPasswordResult}
        onSubmit={handleTeacherSubmit}
        onForgotPasswordSubmit={handleTeacherPasswordResetRequest}
        onCopyResetPassword={handleCopyResetTeacherPassword}
        showForgotPassword={showForgotPassword}
        setShowForgotPassword={(value) => {
          setShowForgotPassword(value);
          setAuthError("");
          setResetPasswordResult(null);
        }}
        loading={loginSubmitted || isRegistering}
        resetLoading={isResettingTeacherPassword}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {notificationToast && (
        <div className="fixed right-5 top-24 z-50 w-full max-w-sm rounded-2xl border border-brand-200 bg-white px-5 py-4 shadow-xl">
          <div className="font-semibold text-slate-900">{notificationToast.title}</div>
          <div className="mt-1 text-sm text-slate-600">{notificationToast.body}</div>
        </div>
      )}
      <header className="bg-brand-900 px-6 py-6 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Teacher Dashboard</h1>
            <p className="mt-1 text-lg text-brand-100">{todayLong()}</p>
            <p className="mt-2 text-sm text-brand-200">
              Signed in as {teacherProfile?.name} · {teacherProfile?.email}
            </p>
          </div>

          {headerSearchQuery && (
            <div className="fixed inset-0 z-40 cursor-default" onClick={() => setHeaderSearchQuery("")} />
          )}

          <div className="relative flex-1 max-w-md mx-6 self-center z-50">
            <div className="relative">
              <input
                type="text"
                value={headerSearchQuery}
                onChange={(e) => setHeaderSearchQuery(e.target.value)}
                placeholder="Search students, classes, rooms..."
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 pl-10 text-sm text-white placeholder-white/40 focus:outline-none focus:bg-white/20 focus:border-white/40 focus:ring-2 focus:ring-white/20"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-white/40">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {headerSearchQuery && (
                <button
                  type="button"
                  onClick={() => setHeaderSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/40 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {headerSearchQuery && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xl text-slate-800 dark:text-slate-100">
                {(() => {
                  const term = headerSearchQuery.trim().toLowerCase();
                  const matchingStudents = term
                    ? allStudents
                        .filter((s) => s.role === "student" && (s.name.toLowerCase().includes(term) || s.studentId.includes(term) || (s.email?.toLowerCase().includes(term) ?? false)))
                        .slice(0, 3)
                    : [];
                  const matchingClasses = term
                    ? teacherClasses
                        .filter((c) => c.name.toLowerCase().includes(term) || (c.subject?.toLowerCase().includes(term) ?? false) || c.room.toLowerCase().includes(term))
                        .slice(0, 3)
                    : [];

                  const classSubPageKeywords: Record<ClassWorkspaceSection, string[]> = {
                    stats: ["graph", "trends", "report", "percentage", "rate", "analysis", "analytics", "charts", "average", "summary", "stats", "insights"],
                    details: ["edit class", "delete class", "rename", "subject", "room", "block", "rotation", "details", "info"],
                    rosterUpload: ["import", "upload", "groq", "parse", "parse roster", "csv", "text", "file", "drag", "image", "roster"],
                    manualAdd: ["add student", "link student", "create placeholder", "insert", "new student", "manual add"],
                    roster: ["student list", "edit names", "link account", "placeholders", "roster", "manage list"],
                    planner: ["schedule", "block", "rotation", "time slot", "period", "calendar", "bell", "day planner"],
                  };

                  const matchingClassSubPages: Array<{
                    classId: string;
                    className: string;
                    label: string;
                    section: ClassWorkspaceSection;
                  }> = [];

                  if (term) {
                    for (const c of teacherClasses) {
                      for (const section of CLASS_WORKSPACE_SECTIONS) {
                        const keywords = classSubPageKeywords[section.key] ?? [];
                        
                        const optionText1 = `${c.name} ${section.label}`.toLowerCase();
                        const optionText2 = `${section.label} ${c.name}`.toLowerCase();
                        const optionText3 = section.label.toLowerCase();
                        
                        const keywordMatch = keywords.some(
                          (kw) => kw.includes(term) || term.includes(kw)
                        );
                        
                        const classNameMatch = c.name.toLowerCase().includes(term);
                        
                        if (
                          optionText1.includes(term) ||
                          optionText2.includes(term) ||
                          (term.length >= 3 && optionText3.includes(term)) ||
                          keywordMatch ||
                          (classNameMatch && term.length >= 3)
                        ) {
                          if (!matchingClassSubPages.some(item => item.classId === c._id.toString() && item.section === section.key)) {
                            matchingClassSubPages.push({
                              classId: c._id.toString(),
                              className: c.name,
                              label: section.label,
                              section: section.key,
                            });
                          }
                        }
                      }
                    }
                  }

                  const matchingRooms = term
                    ? allLocations
                        .filter((l) => l.roomNumber.toLowerCase().includes(term) || l.name.toLowerCase().includes(term))
                        .slice(0, 3)
                    : [];

                  const navItems = [
                    { label: "Attendance", tab: "attendance", keywords: ["check-in", "present", "absent", "tardy", "late", "status", "roster", "mark", "here", "check", "today"] },
                    { label: "Classes", tab: "classes", keywords: ["course", "period", "subject", "room", "roster", "add class"] },
                    { label: "Students", tab: "schedules", keywords: ["student details", "profile", "insights", "history", "attendance history", "lookup", "grades", "name", "id", "search student"] },
                    { label: "Rooms", tab: "rooms", keywords: ["beacon", "bluetooth", "location", "scanner", "ble", "room number"] },
                    { label: "Movement", tab: "movement", keywords: ["live", "log", "location log", "tracking", "hallway", "walk", "realtime", "where"] },
                    { label: "Settings", route: "/teacher/settings", keywords: ["tardy threshold", "threshold", "reminder", "notification", "enable reminder", "times", "preferences", "config"] },
                  ];

                  const matchingNav = term
                    ? navItems.filter((item) => {
                        const nameMatch = item.label.toLowerCase().includes(term);
                        const keywordMatch = item.keywords.some((kw) => kw.includes(term) || term.includes(kw));
                        return nameMatch || keywordMatch;
                      }).slice(0, 3)
                    : [];

                  if (matchingStudents.length === 0 && matchingClasses.length === 0 && matchingClassSubPages.length === 0 && matchingRooms.length === 0 && matchingNav.length === 0) {
                    return <div className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">No results found.</div>;
                  }

                  const handleSearchSelect = (item: {
                    type: "student" | "class" | "room" | "nav" | "classSub";
                    id?: string;
                    name?: string;
                    tab?: string;
                    route?: string;
                    section?: ClassWorkspaceSection;
                  }) => {
                    setHeaderSearchQuery("");
                    
                    if (isSettingsPage && item.route !== "/teacher/settings") {
                      navigate("/teacher");
                    }

                    if (item.type === "student" && item.id) {
                      setTab("schedules");
                      setSelectedStudentId(item.id as Id<"students">);
                    } else if (item.type === "class" && item.id) {
                      setTab("classes");
                      openClassWorkspace(item.id as Id<"teacherClasses">);
                    } else if (item.type === "classSub" && item.id && item.section) {
                      setTab("classes");
                      openClassWorkspace(item.id as Id<"teacherClasses">);
                      setClassWorkspaceSection(item.section);
                    } else if (item.type === "room" && item.name) {
                      setTab("rooms");
                      openRoomForm(item.name);
                    } else if (item.type === "nav") {
                      if (item.route) {
                        navigate(item.route);
                      } else if (item.tab) {
                        setTab(item.tab as Tab);
                      }
                    }
                  };

                  return (
                    <div className="space-y-3">
                      {matchingNav.length > 0 && (
                        <div>
                          <div className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                            Navigation
                          </div>
                          <div className="space-y-0.5">
                            {matchingNav.map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => handleSearchSelect({ type: "nav", tab: item.tab, route: item.route })}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <span className="font-medium">{item.label}</span>
                                <span className="text-xs text-slate-400">Go to tab</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {matchingClasses.length > 0 && (
                        <div>
                          <div className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                            Classes
                          </div>
                          <div className="space-y-0.5">
                            {matchingClasses.map((c) => (
                              <button
                                key={c._id.toString()}
                                type="button"
                                onClick={() => handleSearchSelect({ type: "class", id: c._id.toString() })}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{c.name}</span>
                                  <span className="text-xs text-slate-400">{c.subject ?? "No subject"} · Room {c.room}</span>
                                </div>
                                <span className="text-xs text-slate-400">Open class</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {matchingClassSubPages.length > 0 && (
                        <div>
                          <div className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                            Class Sections
                          </div>
                          <div className="space-y-0.5">
                            {matchingClassSubPages.slice(0, 4).map((item) => (
                              <button
                                key={`${item.classId}-${item.section}`}
                                type="button"
                                onClick={() => handleSearchSelect({ type: "classSub", id: item.classId, section: item.section })}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{item.label}</span>
                                  <span className="text-xs text-slate-400">{item.className}</span>
                                </div>
                                <span className="text-xs text-slate-400">Go to section</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {matchingStudents.length > 0 && (
                        <div>
                          <div className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                            Students
                          </div>
                          <div className="space-y-0.5">
                            {matchingStudents.map((s) => (
                              <button
                                key={s._id.toString()}
                                type="button"
                                onClick={() => handleSearchSelect({ type: "student", id: s._id.toString() })}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{s.name}</span>
                                  <span className="text-xs text-slate-400">{studentPublicSubtitle(s)}</span>
                                </div>
                                <span className="text-xs text-slate-400">View profile</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {matchingRooms.length > 0 && (
                        <div>
                          <div className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                            Rooms
                          </div>
                          <div className="space-y-0.5">
                            {matchingRooms.map((r) => (
                              <button
                                key={r._id.toString()}
                                type="button"
                                onClick={() => handleSearchSelect({ type: "room", name: r.roomNumber })}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">Room {r.roomNumber}</span>
                                  <span className="text-xs text-slate-400">{r.name}</span>
                                </div>
                                <span className="text-xs text-slate-400">Configure beacon</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => navigate("/teacher/settings")}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-brand-50 transition-colors hover:bg-white/20"
              >
                {headerDayLabel ?? "Set Day"}
              </button>
              <DarkModeToggle variant="inline" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/")}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                Home
              </button>
              <button
                onClick={() => navigate("/teacher/settings")}
                data-tutorial="header-settings"
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${ isSettingsPage ? "border-white/40 bg-white text-brand-800" : "border-white/20 bg-white/10 text-white hover:bg-white/20" }`}
              >
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        {isSettingsPage ? (
          renderSettingsPanel()
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5" data-tutorial="summary-cards">
              <SummaryCard value={teacherRoster?.summary.present ?? 0} label="Present" tone="text-emerald-600" />
              <SummaryCard value={teacherRoster?.summary.absent ?? 0} label="Absent" tone="text-red-600" />
              <SummaryCard value={teacherRoster?.summary.activityExcused ?? 0} label="Activity / Excused" tone="text-sky-600" />
              <SummaryCard value={teacherRoster?.summary.unresolved ?? 0} label="Unresolved" tone="text-amber-600" />
              <SummaryCard value={teacherRoster?.summary.tardy ?? 0} label="Tardy Today" tone="text-violet-600" />
            </div>

            {notifications && notifications.filter(n => !n.read).length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Notifications</h3>
                  <button 
                    onClick={() => authenticatedTeacherId && markAllNotificationsRead({ teacherId: authenticatedTeacherId })}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Mark all as read
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {notifications.filter(n => !n.read).map((notification) => (
                    <div key={notification._id.toString()} className="relative flex flex-col justify-between rounded-2xl border border-brand-100 bg-brand-50/50 p-4 shadow-sm transition-all hover:bg-brand-50">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                            {notification.type === "activity_recommendation" ? "Recommendation" : "Info"}
                          </span>
                          <button 
                            onClick={() => markNotificationRead({ id: notification._id })}
                            className="text-slate-400 hover:text-slate-600"
                            title="Dismiss"
                          >
                            ×
                          </button>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">{notification.message}</p>
                      </div>
                      <div className="mt-3 text-[10px] text-slate-400">
                        {fmtDateLabel(notification.date)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="teacher-tab-nav mt-6 inline-flex rounded-2xl bg-slate-200 p-1" data-tutorial="tab-nav">
              {([
                ["attendance", "Attendance"],
                ["classes", "Classes"],
                ["schedules", "Students"],
                ["rooms", "Rooms"],
                ["movement", "Movement"],
              ] as Array<[Tab, string]>).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={`teacher-tab-button rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${ tab === value ? "teacher-tab-active bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700" }`}
                >
                  {label}
                </button>
              ))}
            </div>

        {tab === "attendance" && (
          <div className="mt-6" data-tutorial="attendance-panel">
            <div className="space-y-6">
              {teacherRoster?.shouldShowReminder && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                  {teacherRoster.summary.unresolved} students are still unresolved for{" "}
                  {teacherRoster.activeClass?.name ?? "this block"}. You can finish the roster row-by-row or mark the remaining unresolved students absent.
                </div>
              )}

              <div className="card space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {teacherRoster?.activeClass?.name ?? "No class assigned"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {teacherRoster?.dayLabel ?? "Set rotation day in Settings"} · {teacherRoster?.selectedBlockLabel ?? "Choose a block"}
                      {teacherRoster?.activeClass ? ` · Room ${teacherRoster.activeClass.room}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={selectedBlockLabel}
                      onChange={(event) => setSelectedBlockLabel(event.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {teacherRoster?.blockOptions.length ? (
                        teacherRoster.blockOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))
                      ) : (
                        <option value="">No blocks yet</option>
                      )}
                    </select>
                    <button
                      onClick={handleBatchAbsent}
                      disabled={!teacherRoster?.activeClass || (teacherRoster.summary.unresolved ?? 0) === 0}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-400 hover:text-brand-700 disabled:opacity-40"
                    >
                      Mark Remaining Unresolved as Absent
                    </button>
                    <button
                      onClick={handleSendToOffice}
                      disabled={!teacherRoster?.activeClass || isSendingToOffice}
                      className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-800 disabled:opacity-40"
                    >
                      {isSendingToOffice ? "Sending..." : "Send to Main Office"}
                    </button>
                  </div>
                </div>

                {sendToOfficeMessage.text && (
                  <div className={`rounded-xl px-4 py-3 text-sm font-medium ${ sendToOfficeMessage.type === "error" ? "bg-red-50 text-red-700" : sendToOfficeMessage.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700" }`}>
                    {sendToOfficeMessage.text}
                  </div>
                )}

                {teacherRoster?.activeClass ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),auto]">
                      <input
                        type="text"
                        value={rosterSearch}
                        onChange={(event) => setRosterSearch(event.target.value)}
                        placeholder="Search roster by name, email, grade, or room"
                        className="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <div className="flex flex-wrap gap-2">
                        {(["all", "present", "absent", "excused", "activity", "tardy"] as RosterFilter[]).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setRosterFilter(filter)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${ rosterFilter === filter ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200" }`}
                          >
                            {filter === "all"
                              ? "All"
                              : filter === "present"
                                ? "Present"
                              : filter === "absent"
                                  ? "Absent"
                                  : filter === "excused"
                                    ? "Excused"
                                    : filter === "activity"
                                      ? "Activity"
                                      : "Tardy"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <div className="hidden grid-cols-[1.3fr,0.8fr,0.9fr,0.6fr,1.2fr] gap-4 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 md:grid">
                        <div>Student</div>
                        <div>Status</div>
                        <div>Latest Check-in</div>
                        <div>Tardy</div>
                        <div>Actions</div>
                      </div>
                      <div className="divide-y divide-slate-100 bg-white">
                        {filteredRoster.length === 0 ? (
                          <div className="px-6 py-10 text-center text-sm text-slate-400">
                            No students match this roster view.
                          </div>
                        ) : (
                          filteredRoster.map((row) => (
                            <div key={row.studentId.toString()} className="grid gap-4 px-4 py-4 md:grid-cols-[1.3fr,0.8fr,0.9fr,0.6fr,1.2fr]">
                              <div>
                                <div className="font-semibold text-slate-900">{row.name}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                  {studentPublicSubtitle({ name: row.name, grade: row.grade, email: row.email })}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {row.email ?? "No email"}
                                  {row.latestRoom ? ` · Room ${row.latestRoom}` : ""}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(row.status)}`}>
                                  {statusLabel(row.status)}
                                </span>
                                {row.activityLabel && (
                                  <div className="text-xs text-slate-500">{row.activityLabel}</div>
                                )}
                              </div>

                              <div className="text-sm text-slate-600">
                                {row.latestCheckInTime ? fmt(row.latestCheckInTime) : "No check-in yet"}
                              </div>

                              <div className="space-y-1 text-sm text-slate-600">
                                <div>{row.isLateToday ? "Late today" : "On time"}</div>
                                <div className={row.thresholdReached ? "font-semibold text-red-600" : "text-slate-400"}>
                                  {row.tardyCount} tardies
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => applyManualStatus(row.studentId, "present")}
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
                                  >
                                    Present
                                  </button>
                                  <button
                                    onClick={() => applyManualStatus(row.studentId, "absent")}
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-red-300 hover:text-red-700"
                                  >
                                    Absent
                                  </button>
                                  <button
                                    onClick={() => applyManualStatus(row.studentId, "excused")}
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700"
                                  >
                                    Excused
                                  </button>
                                  <button
                                    onClick={() => {
                                      setQuickActivityStudentId(row.studentId);
                                      setQuickActivityLabel(row.activityLabel ?? "");
                                    }}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                      row.recommendedAction === "activity"
                                        ? "border-sky-300 bg-sky-50 text-sky-700 ring-1 ring-sky-200 hover:border-sky-400"
                                        : "border-slate-300 text-slate-700 hover:border-sky-300 hover:text-sky-700"
                                    }`}
                                  >
                                    {row.recommendedAction === "activity" ? "Activity Recommended" : "Activity"}
                                  </button>
                                </div>
                                {row.recommendedAction === "activity" && (
                                  <div className="text-xs font-medium text-sky-700">
                                    Scheduled activity{row.scheduledActivityBlock ? ` for Block ${row.scheduledActivityBlock}` : ""}.
                                  </div>
                                )}
                                {quickActivityStudentId?.toString() === row.studentId.toString() && (
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={quickActivityLabel}
                                      onChange={(event) => setQuickActivityLabel(event.target.value)}
                                      placeholder="Band, sports, counseling..."
                                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                    <button onClick={() => applyQuickActivity(row.studentId)} className="btn-primary px-3 py-2 text-xs">
                                      Save
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {teacherRoster.placeholders.length > 0 && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <h3 className="font-semibold text-slate-800">Placeholder roster entries</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          These names are saved in the class, but they are not linked to student accounts yet.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {teacherRoster.placeholders.map((entry) => (
                            <span key={entry._id.toString()} className="rounded-full bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
                              {entry.displayName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
                    Set the rotation day in Settings, assign a block to a class in the Classes tab, and this roster will light up.
                  </div>
                )}
              </div>

              <div className="grid gap-6">
                <div className="card">
                  <h3 className="text-lg font-semibold text-slate-900">Recent Check-ins</h3>
                  {teacherRoster?.recentCheckIns.length ? (
                    <div className="mt-4 space-y-3">
                      {teacherRoster.recentCheckIns.map((entry) => (
                        <div key={`${entry.studentId.toString()}-${entry.timestamp}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                          <div>
                            <div className="font-medium text-slate-700">{entry.studentName}</div>
                            <div className="text-xs text-slate-400">{entry.locationName}</div>
                          </div>
                          <div className="text-sm text-slate-500">{fmt(entry.timestamp)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">No check-ins yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "classes" && (
          <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-start">
            <div className="space-y-6 xl:w-[280px] xl:shrink-0">
              <div className="card space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Your Classes</h2>
                  <span className="text-sm text-slate-400">{teacherClasses.length}</span>
                </div>
                <div className="space-y-2">
                  {teacherClasses.map((classDoc) => (
                    <button
                      key={classDoc._id.toString()}
                      onClick={() => openClassWorkspace(classDoc._id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${ selectedClassId?.toString() === classDoc._id.toString() && classesViewMode === "editing" ? "class-card-selected border-brand-300 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-200" }`}
                    >
                      <div className="font-semibold text-slate-900">{classDoc.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {classDoc.subject} · Room {classDoc.room}
                        {classDoc.rotationBlock ? ` · Block ${classDoc.rotationBlock}` : ""}
                      </div>
                    </button>
                  ))}
                  {teacherClasses.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
                      Create your first class to start building rosters.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className={`relative min-w-0 flex-1 space-y-6 ${isResizingClassWorkspace ? "select-none" : ""}`}
              style={{ width: `min(100%, ${classWorkspaceWidth}px)` }}
            >
              <button
                type="button"
                onMouseDown={beginClassWorkspaceResize}
                className={`class-workspace-resize-handle hidden xl:block ${isResizingClassWorkspace ? "is-active" : ""}`}
                aria-label="Resize class workspace"
              />
              {classesViewMode === "landing" && (
                <>
                  <div className="flex justify-end">
                    <button onClick={startCreateClassFlow} className="btn-primary px-6" data-tutorial="create-class-btn">
                      Create Class
                    </button>
                  </div>
                  <div className="card space-y-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Classes</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Pick a class from the left to open its workspace, or start a guided setup for a new one.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-400">
                      Select a class to edit its details, manage the roster, or review its day block planner.
                    </div>
                  </div>
                </>
              )}

              {classesViewMode === "creating" && (
                <>
                  {renderBackButton()}
                  {renderCreateClassFormCard()}
                  {selectedClassId ? (
                    <div data-tutorial="roster-section" className="space-y-4">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
                        Nice — your class exists now. Finish the roster steps below, then wrap up setup.
                      </div>
                      {renderRosterUploadSection()}
                      {renderManualRosterSection()}
                      {renderClassRosterSection()}
                      <button onClick={finishCreateClassSetup} className="btn-primary w-full">
                        Finish Class Setup
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-400">
                      Create the class details first, then the roster steps will appear here.
                    </div>
                  )}
                </>
              )}

              {classesViewMode === "createSuccess" && (
                <>
                  {renderBackButton()}
                  <div className="card space-y-4 text-center" data-tutorial="create-success">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">
                      OK
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Class Successfully Added! 🎉</h2>
                      <p className="mt-2 text-sm text-slate-500">
                        {recentlyCreatedClassName
                          ? `${recentlyCreatedClassName} is ready to use.`
                          : "Your class is ready to use."}
                      </p>
                    </div>
                    <button onClick={exitClassesWorkspace} className="btn-primary mx-auto px-6">
                      Back to Classes
                    </button>
                  </div>
                </>
              )}

              {classesViewMode === "editing" && (
                <>
                  {renderBackButton()}
                  {renderClassSummaryCard()}
                  {renderEditWorkspaceSection()}
                </>
              )}
            </div>
          </div>
        )}

        {tab === "schedules" && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="card space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Student Search</h2>
                <p className="text-sm text-slate-500">
                  Search students linked to your class rosters and inspect their daily attendance history.
                </p>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search by name, email, or grade"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="space-y-3">
                  {linkedScheduleStudents.map((student) => (
                    <button
                      key={student._id.toString()}
                      onClick={() => {
                        setSelectedStudentId(student._id);
                        setDeleteConfirmation("");
                        setDeleteError("");
                      }}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${ selectedStudentId?.toString() === student._id.toString() ? "student-card-selected border-brand-300 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-200" }`}
                    >
                      <div className="font-semibold text-slate-900">{student.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{studentPublicSubtitle(student)}</div>
                    </button>
                  ))}
                  {linkedScheduleStudents.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
                      No linked students yet. Build a class roster first.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {selectedStudent && studentInsights ? (
                <>
                  <div className="card">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedStudent.grade ? `Grade ${selectedStudent.grade}` : "No grade on file"}
                          {selectedStudent.email ? ` · ${selectedStudent.email}` : ""}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedStudent.linkedClasses.map((entry) => (
                            <span key={entry.classId.toString()} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              {entry.className}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="min-w-56 rounded-2xl bg-slate-50 px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Current Day Status
                        </div>
                        <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusBadge(studentInsights.currentDayStatus)}`}>
                          {statusLabel(studentInsights.currentDayStatus)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Login Password</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Students sign in with their school email and this password. Changing it notifies the student in
                        their portal.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-600 dark:bg-slate-950/60">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current password</div>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="font-mono text-base font-semibold text-slate-900 dark:text-slate-100">
                          {showStudentPassword ? selectedStudent.studentId : "•••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowStudentPassword((current) => !current)}
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
                        >
                          {showStudentPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                          New password
                        </label>
                        <input
                          type="text"
                          value={newStudentPassword}
                          onChange={(event) => setNewStudentPassword(event.target.value)}
                          maxLength={MAX_STUDENT_PASSWORD_LENGTH}
                          placeholder="Up to 7 characters"
                          className={teacherFieldInputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Confirm new password
                        </label>
                        <input
                          type="text"
                          value={confirmStudentPassword}
                          onChange={(event) => setConfirmStudentPassword(event.target.value)}
                          maxLength={MAX_STUDENT_PASSWORD_LENGTH}
                          placeholder="Re-enter password"
                          className={teacherFieldInputClass}
                        />
                      </div>
                    </div>

                    {passwordChangeError && (
                      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                        {passwordChangeError}
                      </div>
                    )}
                    {passwordChangeSuccess && (
                      <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        {passwordChangeSuccess}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleUpdateStudentPassword()}
                      disabled={isUpdatingStudentPassword || !newStudentPassword.trim() || !confirmStudentPassword.trim()}
                      className="btn-primary w-full max-w-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUpdatingStudentPassword ? "Saving password..." : "Save new password"}
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <SummaryCard value={studentInsights.stats.tardyCount} label="Tardies" tone="text-violet-600" />
                    <SummaryCard value={studentInsights.stats.absenceCount} label="Absences" tone="text-red-600" />
                    <SummaryCard value={studentInsights.stats.activityCount} label="Activity Days" tone="text-sky-600" />
                    <SummaryCard value={studentInsights.stats.attendedDays} label="Attended Days" tone="text-emerald-600" />
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="card space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">Schedule Activity</h3>
                        {editingScheduledActivityId && (
                          <button onClick={clearActivityForm} className="text-sm text-brand-600 underline">
                            Cancel edit
                          </button>
                        )}
                      </div>
                      <input
                        type="date"
                        value={activityDate}
                        onChange={(event) => setActivityDate(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <select
                        value={activityType}
                        onChange={(event) => {
                          const nextType = event.target.value;
                          setActivityType(nextType);
                          setActivityLabel(nextType === "Other" ? "" : nextType);
                        }}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Choose activity</option>
                        {SCHEDULE_ACTIVITY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                      <select
                        value={activityBlock}
                        onChange={(event) => setActivityBlock(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">All day or no specific block</option>
                        {selectedStudentBlockOptions.map((option) => (
                          <option key={option} value={option}>
                            {option} Block
                          </option>
                        ))}
                      </select>
                      
                      {!editingScheduledActivityId && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tag other students in this event</label>
                          <div className="flex flex-wrap gap-2">
                            {taggedStudentIds.map(id => {
                              const s = allStudents.find(student => student._id === id);
                              return s ? (
                                <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-1 text-xs font-medium text-brand-700">
                                  {s.name}
                                  <button onClick={() => setTaggedStudentIds(prev => prev.filter(p => p !== id))} className="text-brand-400 hover:text-brand-600">×</button>
                                </span>
                              ) : null;
                            })}
                          </div>
                          <select
                            value=""
                            onChange={(e) => {
                              const val = e.target.value as Id<"students">;
                              if (val && !taggedStudentIds.includes(val) && val !== selectedStudentId) {
                                setTaggedStudentIds([...taggedStudentIds, val]);
                              }
                            }}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          >
                            <option value="">Select students to tag...</option>
                            {allStudentOptions
                              .filter(s => s._id !== selectedStudentId && !taggedStudentIds.includes(s._id))
                              .map(s => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                              ))
                            }
                          </select>
                        </div>
                      )}

                      {activityType === "Other" && (
                        <input
                          type="text"
                          value={activityLabel}
                          onChange={(event) => setActivityLabel(event.target.value)}
                          placeholder="Add another activity"
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      )}
                      <textarea
                        value={activityNotes}
                        onChange={(event) => setActivityNotes(event.target.value)}
                        rows={3}
                        placeholder="Optional notes"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <button onClick={handleSaveScheduledActivity} className="btn-primary w-full">
                        {editingScheduledActivityId ? "Update Activity" : "Schedule Activity"}
                      </button>
                    </div>

                    <div className="card space-y-4">
                      <h3 className="text-lg font-semibold text-slate-900">Upcoming Activities</h3>
                      {studentInsights.upcomingActivities.length > 0 ? (
                        <div className="space-y-3">
                          {studentInsights.upcomingActivities.map((activity) => (
                            <div key={activity._id.toString()} className="rounded-2xl border border-slate-200 px-4 py-4">
                              <div className="font-semibold text-slate-900">{activity.activityLabel}</div>
                              <div className="mt-1 text-sm text-slate-500">
                                {fmtDateLabel(activity.date)}
                                {activity.block ? ` · Block ${activity.block}` : ""}
                              </div>
                              {activity.notes && <div className="mt-2 text-sm text-slate-500">{activity.notes}</div>}
                              <div className="mt-3 flex gap-3">
                                <button onClick={() => startEditScheduledActivity(activity)} className="text-sm text-brand-600 underline">
                                  Edit
                                </button>
                                <button onClick={() => removeScheduledActivity({ id: activity._id })} className="text-sm text-red-600 underline">
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">No scheduled activities yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr),minmax(320px,0.75fr)]">
                    <div className="space-y-6">
                      <div className="card space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <h3 className="text-lg font-semibold text-slate-900">Attendance by Day</h3>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                const nextOpen = !attendanceLookupOpen;
                                setAttendanceLookupOpen(nextOpen);
                                if (nextOpen && !attendanceLookupDate) {
                                  const defaultDate = todayStr();
                                  setAttendanceLookupDate(defaultDate);
                                }
                              }}
                              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                            >
                              Find Specific Date
                            </button>
                            {attendanceLookupOpen && (
                              <div className="mt-3 w-full min-w-[280px] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg md:absolute md:right-0 md:top-full md:z-20">
                                <div className="text-sm font-semibold text-slate-900">Search This Student's Day</div>
                                <p className="mt-1 text-xs text-slate-500">Pick a date from the calendar to check this student's attendance for that day.</p>
                                <div className="mt-4 space-y-3">
                                  <input
                                    type="date"
                                    value={attendanceLookupDate}
                                    onChange={(event) => {
                                      const nextDate = event.target.value;
                                      setAttendanceLookupDate(nextDate);
                                    }}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                  />
                                </div>
                                <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
                                  {attendanceLookupMatch ? (
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-semibold text-slate-900">{fmtDateLabel(attendanceLookupMatch.date)}</div>
                                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(attendanceLookupMatch.status)}`}>
                                          {statusLabel(attendanceLookupMatch.status)}
                                        </span>
                                      </div>
                                      {attendanceLookupMatch.activityLabel && (
                                        <div className="text-sm text-slate-500">{attendanceLookupMatch.activityLabel}</div>
                                      )}
                                    </div>
                                  ) : attendanceLookupDate ? (
                                    <p className="text-sm text-slate-500">No attendance record was found for that date.</p>
                                  ) : (
                                    <p className="text-sm text-slate-500">Choose a date to see whether this student was present or absent.</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-3">
                          {studentInsights.attendanceByDay.map((day) => (
                            <div key={day.date} className="rounded-2xl border border-slate-200 px-4 py-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="font-semibold text-slate-900">{fmtDateLabel(day.date)}</div>
                                  {day.activityLabel && (
                                    <div className="mt-1 text-sm text-slate-500">{day.activityLabel}</div>
                                  )}
                                </div>
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(day.status)}`}>
                                  {statusLabel(day.status)}
                                </span>
                              </div>
                              {day.entries.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {day.entries.map((entry) => (
                                    <div key={`${day.date}-${entry.timestamp}`} className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                                      <div>
                                        {entry.subject ?? "Class"} · {entry.locationName}
                                      </div>
                                      <div>
                                        {fmt(entry.timestamp)} {entry.isLate ? "· Late" : ""}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    <div className="space-y-6">
                      <div className="card space-y-4">
                        <h3 className="text-lg font-semibold text-slate-900">Delete Student</h3>
                        <p className="text-sm text-slate-500">
                          Remove this student and their stored attendance records by typing <span className="font-semibold">delete</span>.
                        </p>
                        <input
                          type="text"
                          value={deleteConfirmation}
                          onChange={(event) => {
                            setDeleteConfirmation(event.target.value);
                            setDeleteError("");
                          }}
                          placeholder={`Confirm you want to delete ${selectedStudent.name}`}
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        {deleteError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{deleteError}</div>}
                        <button onClick={handleDeleteStudent} className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700">
                          Delete Student
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card px-6 py-16 text-center text-sm text-slate-400">
                  Select a student to see their daily status, history, and scheduled activities.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "rooms" && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
            <div className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Class Rooms</h2>
                  <p className="text-sm text-slate-500">Configure the BLE beacon that each of your teaching rooms should use.</p>
                </div>
                <button
                  onClick={() => {
                    setTab("classes");
                    startCreateClassFlow();
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  Add Class
                </button>
              </div>
              <div className="space-y-2">
                {roomEntries.map((entry) => (
	                  <button
	                    key={`${entry.room}-${entry.className}`}
	                    onClick={() => openRoomForm(entry.room)}
	                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                        editingRoom === entry.room
                          ? "room-card-selected border-brand-300 bg-brand-50"
                          : "border-slate-200 bg-white hover:border-brand-200"
                      }`}
	                  >
                    <div className="font-semibold text-slate-900">Room {entry.room}</div>
                    <div className="mt-1 text-sm text-slate-500">{entry.className} · {entry.subject}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Room Beacon Setup</h2>
	              {editingRoom ? (
	                <>
	                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
	                    Search for the room beacon over Bluetooth, then save the connection. The beacon UUID is filled in automatically after a successful scan.
	                  </div>
	                  <div className="grid gap-4 md:grid-cols-2">
	                    <div>
	                      <label className="mb-1 block text-sm font-medium text-slate-700">Display Name</label>
                      <input
                        type="text"
                        value={roomName}
                        onChange={(event) => setRoomName(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
	                    <div>
	                      <label className="mb-1 block text-sm font-medium text-slate-700">Detected Device</label>
	                      <input
	                        type="text"
	                        value={roomDeviceName}
	                        readOnly
	                        placeholder="Use Search for Beacon to detect a device"
	                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
	                      />
	                    </div>
	                  </div>
	                  <div>
	                    <label className="mb-1 block text-sm font-medium text-slate-700">Beacon UUID</label>
	                    <input
	                      type="text"
	                      value={roomUuid}
	                      readOnly
	                      placeholder="Connect to a beacon to fill this in automatically"
	                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
	                    />
	                  </div>
	                  {beaconScanMessage && (
	                    <div
	                      className={`rounded-xl px-4 py-3 text-sm ${ beaconScanState === "error" ? "bg-red-50 text-red-700" : beaconScanState === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600" }`}
	                    >
	                      {beaconScanMessage}
	                    </div>
	                  )}
	                  <div className="flex flex-wrap gap-3">
	                    <button
	                      onClick={scanForBeacon}
	                      disabled={beaconScanState === "scanning"}
	                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
	                    >
	                      {beaconScanState === "scanning" ? "Searching..." : "Search for Beacon"}
	                    </button>
	                    <button onClick={saveRoomBeacon} disabled={!roomUuid} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
	                      Save Room Beacon
	                    </button>
                    {locationByRoom.get(editingRoom) && (
                      <button
                        onClick={() => removeLocation({ id: locationByRoom.get(editingRoom)!._id })}
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Remove Beacon
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center text-sm text-slate-400">
                  Pick one of your class rooms to connect or edit its beacon.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "movement" && (
          <div className="mt-6 space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900">Teacher Student Movement</h2>
              <p className="mt-1 text-sm text-slate-500">
                This view follows only the students linked to your class rosters.
              </p>
            </div>
            <AttendanceMap logs={movementLogs} students={movementStudents} />
          </div>
        )}
          </>
        )}
      </main>

      {tutorial.phase === "welcome" && teacherProfile && (
        <TutorialWelcomeModal
          teacherName={teacherProfile.name}
          onStart={handleTutorialWelcomeStart}
          onSkip={tutorial.skipWelcome}
        />
      )}

      {tutorial.isActive && tutorial.currentStep && (
        <TutorialOverlay
          step={tutorial.currentStep}
          stepIndex={tutorial.stepIndex}
          stepCount={tutorial.stepCount}
          onNext={handleTutorialNext}
          onExit={handleTutorialExit}
          onSkipRoster={tutorial.currentStep.showSkipRoster ? handleTutorialSkipRoster : undefined}
        />
      )}
    </div>
  );
}
