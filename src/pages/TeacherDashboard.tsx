import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import AttendanceMap from "../components/AttendanceMap";
import { clearStoredTeacherId, getStoredTeacherId, setStoredTeacherId } from "../hooks/useTeacher";

type Tab = "attendance" | "classes" | "schedules" | "rooms" | "movement";
type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
type RosterFilter = "all" | "unresolved" | "absent" | "resolved" | "tardy";
type ManualStatus = "present" | "absent" | "excused";
type AuthMode = "login" | "register";

const DAY_OPTIONS = ["Day 1", "Day 2", "Day 3", "Day 4"];
const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];

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

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function revokeObjectUrls(urls: string[]) {
  urls.forEach((url) => URL.revokeObjectURL(url));
}

function getRosterPreviewKey(file: File | undefined, index: number) {
  if (!file) return `roster-preview-${index}`;
  return `${file.name}-${file.lastModified}-${file.size}`;
}

function isSafeRosterPreviewUrl(url: string) {
  return url.startsWith("blob:");
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
    <div className="card text-center">
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
  onSubmit,
  loading,
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
  onSubmit: () => void;
  loading: boolean;
}) {
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

          <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
            {(["login", "register"] as AuthMode[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === value ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {value === "login" ? "Log In" : "Create Account"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {mode === "register" && (
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
            )}

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

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

            <button onClick={onSubmit} disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? "Working..." : mode === "login" ? "Log In" : "Create Teacher Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const rosterFileRef = useRef<HTMLInputElement>(null);
  const rosterPreviewImagesRef = useRef<string[]>([]);
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
  const [loginSubmitted, setLoginSubmitted] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState<Id<"teacherClasses"> | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<Id<"students"> | null>(null);
  const [selectedBlockLabel, setSelectedBlockLabel] = useState("");
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("all");
  const [rosterSearch, setRosterSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [activityDate, setActivityDate] = useState(todayStr());
  const [activityLabel, setActivityLabel] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [editingScheduledActivityId, setEditingScheduledActivityId] = useState<Id<"scheduledActivities"> | null>(null);
  const [quickActivityStudentId, setQuickActivityStudentId] = useState<Id<"students"> | null>(null);
  const [quickActivityLabel, setQuickActivityLabel] = useState("");
  const [settingsForm, setSettingsForm] = useState({ tardyThreshold: "3", reminderMinutesAfterStart: "15" });
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
  const [classForm, setClassForm] = useState({ name: "", subject: "", room: "", grade: "" });
  const [newClassForm, setNewClassForm] = useState({ name: "", subject: "", room: "", grade: "" });
  const [manualEntryName, setManualEntryName] = useState("");
  const [manualLinkedStudentId, setManualLinkedStudentId] = useState("");
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({});
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, Record<string, string>>>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [rosterPreviewImages, setRosterPreviewImages] = useState<string[]>([]);
  const [rosterFiles, setRosterFiles] = useState<File[]>([]);
  const [parsedRosterNames, setParsedRosterNames] = useState<string[]>([]);
  const [rosterSelections, setRosterSelections] = useState<Record<string, string>>({});
  const [rosterParseError, setRosterParseError] = useState("");
  const [isParsingRoster, setIsParsingRoster] = useState(false);

  const teacherEmail = authEmailPrefix.trim() ? `${authEmailPrefix.trim().toLowerCase()}@bhpsnj.org` : "";

  const loginResult = useQuery(
    api.teachers.login,
    loginSubmitted && teacherEmail && authPassword
      ? { email: teacherEmail, password: authPassword }
      : "skip",
  );
  const teacherProfile = useQuery(api.teachers.getById, teacherId ? { teacherId } : "skip");
  const allStudents = useQuery(api.students.list) ?? [];
  const teacherClasses = useQuery(api.teacherClasses.listForTeacher, teacherId ? { teacherId } : "skip") ?? [];
  const teacherStudents = useQuery(
    api.teacherClasses.getTeacherStudentDirectory,
    teacherId ? { teacherId } : "skip",
  ) ?? [];
  const classDetails = useQuery(
    api.teacherClasses.getClassDetails,
    teacherId && selectedClassId ? { teacherId, classId: selectedClassId } : "skip",
  );
  const dayAssignments = useQuery(api.teacherClasses.getDayAssignments, teacherId ? { teacherId } : "skip") ?? {};
  const teacherRoster = useQuery(
    api.attendance.getTeacherRoster,
    teacherId ? { teacherId, date: todayStr(), blockLabel: selectedBlockLabel || undefined } : "skip",
  );
  const studentInsights = useQuery(
    api.students.getInsights,
    selectedStudentId ? { studentId: selectedStudentId } : "skip",
  );
  const studentSchedule = useQuery(
    api.schedules.getForStudent,
    selectedStudentId ? { studentId: selectedStudentId } : "skip",
  ) ?? [];
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
  const createTeacherClass = useMutation(api.teacherClasses.create);
  const updateTeacherClass = useMutation(api.teacherClasses.update);
  const removeTeacherClass = useMutation(api.teacherClasses.remove);
  const saveUploadedRoster = useMutation(api.teacherClasses.saveUploadedRoster);
  const addManualRosterEntry = useMutation(api.teacherClasses.addManualRosterEntry);
  const linkRosterEntry = useMutation(api.teacherClasses.linkRosterEntry);
  const removeRosterEntry = useMutation(api.teacherClasses.removeRosterEntry);
  const saveDayAssignments = useMutation(api.teacherClasses.saveDayAssignments);
  const setStudentStatus = useMutation(api.attendance.setStudentStatus);
  const batchMarkClassUnresolvedAbsent = useMutation(api.attendance.batchMarkClassUnresolvedAbsent);
  const updateSettings = useMutation(api.attendance.updateSettings);
  const createScheduledActivity = useMutation(api.scheduledActivities.create);
  const updateScheduledActivity = useMutation(api.scheduledActivities.update);
  const removeScheduledActivity = useMutation(api.scheduledActivities.remove);
  const removeStudent = useMutation(api.students.remove);
  const parseRosterImage = useAction(api.groq.parseRosterImage);
  const initBellSchedules = useMutation(api.bellSchedules.initialize);
  const setRotation = useMutation(api.scheduleRotation.set);
  const setWeekMap = useMutation(api.weekDayMapping.setWeek);
  const upsertLocation = useMutation(api.locations.upsert);
  const removeLocation = useMutation(api.locations.remove);

  useEffect(() => {
    initBellSchedules();
  }, [initBellSchedules]);

  useEffect(() => {
    rosterPreviewImagesRef.current = rosterPreviewImages;
  }, [rosterPreviewImages]);

  useEffect(() => {
    const unsafePreviewUrls = rosterPreviewImages.filter((preview) => !isSafeRosterPreviewUrl(preview));
    if (unsafePreviewUrls.length > 0) {
      console.warn("Rejected unexpected roster preview URLs.", unsafePreviewUrls);
    }
  }, [rosterPreviewImages]);

  useEffect(() => {
    return () => {
      revokeObjectUrls(rosterPreviewImagesRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loginSubmitted || loginResult === undefined) return;
    if (loginResult) {
      setStoredTeacherId(loginResult._id);
      setTeacherId(loginResult._id);
      setAuthError("");
      setAuthPassword("");
    } else {
      setAuthError("We couldn't find a matching teacher account.");
    }
    setLoginSubmitted(false);
  }, [loginResult, loginSubmitted]);

  useEffect(() => {
    if (teacherId && teacherProfile === null) {
      clearStoredTeacherId();
      setTeacherId(null);
    }
  }, [teacherId, teacherProfile]);

  useEffect(() => {
    if (!selectedClassId && teacherClasses.length > 0) {
      setSelectedClassId(teacherClasses[0]._id);
    }
    if (selectedClassId && !teacherClasses.some((classDoc) => classDoc._id.toString() === selectedClassId.toString())) {
      setSelectedClassId(teacherClasses[0]?._id ?? null);
    }
  }, [selectedClassId, teacherClasses]);

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
    if (classDetails?.class) {
      setClassForm({
        name: classDetails.class.name,
        subject: classDetails.class.subject,
        room: classDetails.class.room,
        grade: classDetails.class.grade ?? "",
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
      });
    }
  }, [teacherRoster?.settings]);

  useEffect(() => {
    if (!teacherRoster) return;
    if (!selectedBlockLabel && teacherRoster.selectedBlockLabel) {
      setSelectedBlockLabel(teacherRoster.selectedBlockLabel);
    }
    if (selectedBlockLabel && !teacherRoster.blockOptions.includes(selectedBlockLabel)) {
      setSelectedBlockLabel(teacherRoster.selectedBlockLabel ?? "");
    }
  }, [selectedBlockLabel, teacherRoster]);

  const blockLabels = useMemo(
    () =>
      [...new Set(bellSchedules.flatMap((schedule) => schedule.blocks.map((block) => block.label)))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [bellSchedules],
  );

  useEffect(() => {
    if (blockLabels.length === 0) return;
    const nextDrafts: Record<string, Record<string, string>> = {};
    for (const day of DAY_OPTIONS) {
      nextDrafts[day] = {};
      for (const block of blockLabels) {
        const existing = (dayAssignments[day] ?? []).find((assignment) => assignment.blockLabel === block);
        nextDrafts[day][block] = existing?.classId ?? "";
      }
    }
    setAssignmentDrafts(nextDrafts);
  }, [blockLabels, dayAssignments]);

  useEffect(() => {
    if (rosterMatches.length === 0) return;
    const next: Record<string, string> = {};
    for (const match of rosterMatches) {
      next[match.displayName] = match.suggestedStudentId?.toString() ?? "";
    }
    setRosterSelections(next);
  }, [rosterMatches]);

  const allStudentOptions = useMemo(
    () =>
      allStudents
        .filter((student) => student.role === "student")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allStudents],
  );

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
      if (rosterFilter === "unresolved") return row.status === "unresolved";
      if (rosterFilter === "absent") return row.status === "absent";
      if (rosterFilter === "resolved") {
        return row.status === "present" || row.status === "activity" || row.status === "excused";
      }
      if (rosterFilter === "tardy") return row.isLateToday || row.thresholdReached;
      return true;
    });
  }, [rosterFilter, rosterSearch, teacherRoster?.students]);

  const selectedStudent = useMemo(
    () => teacherStudents.find((student) => student._id.toString() === selectedStudentId?.toString()) ?? null,
    [selectedStudentId, teacherStudents],
  );

  const schedDays = useMemo(
    () => [...new Set(studentSchedule.map((entry) => entry.dayOfWeek))].sort(),
    [studentSchedule],
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

  const headerDayLabel = editingRotation ? rotationLabel || todayRotation?.dayLabel : todayRotation?.dayLabel;

  async function handleTeacherSubmit() {
    setAuthError("");
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
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not create teacher account.");
    } finally {
      setIsRegistering(false);
    }
  }

  function handleLogout() {
    clearStoredTeacherId();
    setTeacherId(null);
    setAuthPassword("");
    setAuthError("");
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
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "Room-" }],
        optionalServices: [
          "000000c2-0000-1000-8000-00805f9b34fb",
          "00000b12-0000-1000-8000-00805f9b34fb",
        ].map((service) => service.toLowerCase()),
      });

      setRoomDeviceName(device.name ?? "Room-Beacon");
      const server = await device.gatt?.connect();
      const services = await server?.getPrimaryServices();
      if (services && services.length > 0) {
        const customService = services.find((service) => !service.uuid.startsWith("000018")) || services[0];
        setRoomUuid(customService.uuid);
      }
    } catch (error) {
      console.error("BLE scan failed:", error);
      alert("Bluetooth scan failed or was cancelled.");
    }
  }

  function openRoomForm(room: string) {
    const location = locationByRoom.get(room);
    setEditingRoom(room);
    setRoomName(location?.name ?? `Room ${room}`);
    setRoomUuid(location?.uuid ?? "");
    setRoomDeviceName(location?.deviceName ?? "");
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
  }

  async function handleCreateClass() {
    if (!teacherId || !newClassForm.name.trim() || !newClassForm.subject.trim() || !newClassForm.room.trim()) {
      return;
    }
    const classId = await createTeacherClass({
      teacherId,
      name: newClassForm.name.trim(),
      subject: newClassForm.subject.trim(),
      room: newClassForm.room.trim(),
      grade: newClassForm.grade.trim() || undefined,
    });
    setNewClassForm({ name: "", subject: "", room: "", grade: "" });
    setSelectedClassId(classId);
  }

  async function handleUpdateClass() {
    if (!selectedClassId) return;
    await updateTeacherClass({
      classId: selectedClassId,
      name: classForm.name.trim(),
      subject: classForm.subject.trim(),
      room: classForm.room.trim(),
      grade: classForm.grade.trim() || undefined,
    });
  }

  async function handleDeleteClass() {
    if (!teacherId || !selectedClassId || !classDetails?.class) return;
    if (!window.confirm(`Delete ${classDetails.class.name}?`)) return;
    await removeTeacherClass({ teacherId, classId: selectedClassId });
    setSelectedClassId(null);
  }

  function applyRosterFiles(files: File[]) {
    revokeObjectUrls(rosterPreviewImagesRef.current);
    const previewImages = files.map((file) => URL.createObjectURL(file));
    setRosterFiles(files);
    setParsedRosterNames([]);
    setRosterSelections({});
    setRosterParseError("");
    setRosterPreviewImages(previewImages);
  }

  async function handleParseRoster() {
    if (rosterFiles.length === 0) return;
    setIsParsingRoster(true);
    setRosterParseError("");
    try {
      const allNames: string[] = [];
      for (const [index, file] of rosterFiles.entries()) {
        try {
          const imageBase64 = await fileToBase64(file);
          const names = await parseRosterImage({ imageBase64, mimeType: file.type });
          allNames.push(...names);
        } catch (error) {
          const details = error instanceof Error && error.message ? `: ${error.message}` : "";
          throw new Error(
            `Could not parse roster image ${index + 1} of ${rosterFiles.length} after processing ${index} image${index === 1 ? "" : "s"}${details}`,
          );
        }
      }
      // Deduplicate names across all images (case-insensitive, preserves first occurrence)
      const seenNames = new Set<string>();
      const uniqueNames: string[] = [];
      for (const name of allNames) {
        const lowerName = name.toLowerCase();
        if (!seenNames.has(lowerName)) {
          seenNames.add(lowerName);
          uniqueNames.push(name);
        }
      }
      setParsedRosterNames(uniqueNames);
    } catch (error) {
      setRosterParseError(error instanceof Error ? error.message : "Could not parse roster images.");
    } finally {
      setIsParsingRoster(false);
    }
  }

  async function handleSaveUploadedRoster() {
    if (!teacherId || !selectedClassId || rosterMatches.length === 0) return;
    await saveUploadedRoster({
      teacherId,
      classId: selectedClassId,
      entries: rosterMatches.map((match) => ({
        displayName: match.displayName,
        linkedStudentId: (rosterSelections[match.displayName] || null) as Id<"students"> | null,
      })),
    });
    revokeObjectUrls(rosterPreviewImagesRef.current);
    rosterPreviewImagesRef.current = [];
    setRosterFiles([]);
    setRosterPreviewImages([]);
    setParsedRosterNames([]);
    setRosterSelections({});
  }

  async function handleAddManualRosterEntry() {
    if (!teacherId || !selectedClassId || (!manualEntryName.trim() && !manualLinkedStudentId)) return;
    await addManualRosterEntry({
      teacherId,
      classId: selectedClassId,
      displayName: manualEntryName.trim(),
      linkedStudentId: manualLinkedStudentId ? (manualLinkedStudentId as Id<"students">) : undefined,
    });
    setManualEntryName("");
    setManualLinkedStudentId("");
  }

  async function handleLinkRosterEntry(rosterEntryId: Id<"classRosterEntries">) {
    if (!teacherId) return;
    const linkedStudentId = linkSelections[rosterEntryId.toString()];
    if (!linkedStudentId) return;
    await linkRosterEntry({
      teacherId,
      rosterEntryId,
      linkedStudentId: linkedStudentId as Id<"students">,
    });
    setLinkSelections((current) => ({ ...current, [rosterEntryId.toString()]: "" }));
  }

  async function handleSaveAssignments(dayLabel: string) {
    if (!teacherId) return;
    await saveDayAssignments({
      teacherId,
      dayLabel,
      assignments: blockLabels.map((blockLabel) => ({
        blockLabel,
        classId: assignmentDrafts[dayLabel]?.[blockLabel]
          ? (assignmentDrafts[dayLabel][blockLabel] as Id<"teacherClasses">)
          : null,
      })),
    });
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
    setActivityLabel("");
    setActivityNotes("");
  }

  function startEditScheduledActivity(activity: {
    _id: Id<"scheduledActivities">;
    date: string;
    activityLabel: string;
    notes?: string;
  }) {
    setEditingScheduledActivityId(activity._id);
    setActivityDate(activity.date);
    setActivityLabel(activity.activityLabel);
    setActivityNotes(activity.notes ?? "");
  }

  async function handleSaveScheduledActivity() {
    if (!selectedStudentId || !activityDate || !activityLabel.trim()) return;
    if (editingScheduledActivityId) {
      await updateScheduledActivity({
        id: editingScheduledActivityId,
        date: activityDate,
        activityLabel: activityLabel.trim(),
        notes: activityNotes.trim() || undefined,
      });
    } else {
      await createScheduledActivity({
        studentId: selectedStudentId,
        date: activityDate,
        activityLabel: activityLabel.trim(),
        notes: activityNotes.trim() || undefined,
      });
    }
    clearActivityForm();
  }

  async function handleBatchAbsent() {
    if (!teacherId || !teacherRoster?.activeClass) return;
    await batchMarkClassUnresolvedAbsent({
      teacherId,
      classId: teacherRoster.activeClass._id,
      date: todayStr(),
    });
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
      reminderMinutesAfterStart: Number(settingsForm.reminderMinutesAfterStart) || 15,
    });
  }

  function renderScheduleControls() {
    return (
      <div className="space-y-4">
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
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      rotationLabel === day
                        ? "border-brand-700 bg-brand-700 text-white"
                        : "border-slate-300 text-slate-600 hover:border-brand-400"
                    }`}
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
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-all ${
                  selectedBellType === schedule.type
                    ? "bg-brand-50 text-brand-800 ring-2 ring-brand-500/20 border-brand-200"
                    : "border-slate-200 text-slate-600 hover:border-brand-300"
                }`}
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800">Attendance Settings</h3>
              <InfoTooltip label="Use this section to control when tardy alerts appear and how long the system waits before reminding teachers about unresolved students." />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Tardy Threshold
              </label>
              <input
                type="number"
                min="1"
                value={settingsForm.tardyThreshold}
                onChange={(event) =>
                  setSettingsForm((current) => ({ ...current, tardyThreshold: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Reminder Minutes After Start
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
          </div>
          <button onClick={saveSettings} className="btn-primary w-full">
            Save Settings
          </button>
        </div>
      </div>
    );
  }

  if (!teacherId || teacherProfile === undefined) {
    return (
      <AuthPanel
        mode={authMode}
        setMode={(mode) => {
          setAuthMode(mode);
          setAuthError("");
          setLoginSubmitted(false);
        }}
        name={authName}
        setName={setAuthName}
        emailPrefix={authEmailPrefix}
        setEmailPrefix={(value) => {
          setAuthEmailPrefix(value);
          setAuthError("");
          setLoginSubmitted(false);
        }}
        password={authPassword}
        setPassword={(value) => {
          setAuthPassword(value);
          setAuthError("");
          setLoginSubmitted(false);
        }}
        error={authError}
        onSubmit={handleTeacherSubmit}
        loading={loginSubmitted || isRegistering}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-brand-900 px-6 py-6 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Teacher Dashboard</h1>
            <p className="mt-1 text-lg text-brand-100">{todayLong()}</p>
            <p className="mt-2 text-sm text-brand-200">
              Signed in as {teacherProfile?.name} · {teacherProfile?.email}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <button
              onClick={() => {
                setEditingRotation(true);
                setRotationLabel(todayRotation?.dayLabel ?? "");
              }}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-brand-50 transition-colors hover:bg-white/20"
            >
              {headerDayLabel ? `Set today’s day · ${headerDayLabel}` : "Set today’s day"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/")}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                Home
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <SummaryCard value={teacherRoster?.summary.present ?? 0} label="Present" tone="text-emerald-600" />
          <SummaryCard value={teacherRoster?.summary.absent ?? 0} label="Absent" tone="text-red-600" />
          <SummaryCard value={teacherRoster?.summary.activityExcused ?? 0} label="Activity / Excused" tone="text-sky-600" />
          <SummaryCard value={teacherRoster?.summary.unresolved ?? 0} label="Unresolved" tone="text-amber-600" />
          <SummaryCard value={teacherRoster?.summary.tardy ?? 0} label="Tardy Today" tone="text-violet-600" />
        </div>

        <div className="mt-6 inline-flex rounded-2xl bg-slate-200 p-1">
          {([
            ["attendance", "Attendance"],
            ["classes", "Classes"],
            ["schedules", "Schedules"],
            ["rooms", "Rooms"],
            ["movement", "Movement"],
          ] as Array<[Tab, string]>).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                tab === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "attendance" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr),360px]">
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
                      {teacherRoster?.dayLabel ?? "Set today’s day"} · {teacherRoster?.selectedBlockLabel ?? "Choose a block"}
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
                  </div>
                </div>

                {teacherRoster?.activeClass ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),auto]">
                      <input
                        type="text"
                        value={rosterSearch}
                        onChange={(event) => setRosterSearch(event.target.value)}
                        placeholder="Search roster by name, ID, email, grade, or room"
                        className="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <div className="flex flex-wrap gap-2">
                        {(["all", "unresolved", "absent", "resolved", "tardy"] as RosterFilter[]).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setRosterFilter(filter)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                              rosterFilter === filter
                                ? "bg-brand-700 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {filter === "all"
                              ? "All"
                              : filter === "unresolved"
                                ? "Unresolved"
                                : filter === "absent"
                                  ? "Absent"
                                  : filter === "resolved"
                                    ? "Resolved"
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
                                  ID: {row.studentNumber}
                                  {row.grade ? ` · Grade ${row.grade}` : ""}
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
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-700"
                                  >
                                    Activity
                                  </button>
                                </div>
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
                    Pick today’s day, assign a block to a class in the Classes tab, and this roster will light up.
                  </div>
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="card">
                  <h3 className="text-lg font-semibold text-slate-900">Live Rooms</h3>
                  {teacherRoster?.liveRooms.length ? (
                    <div className="mt-4 space-y-3">
                      {teacherRoster.liveRooms.map((entry) => (
                        <div key={entry.locationName} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                          <span className="font-medium text-slate-700">{entry.locationName}</span>
                          <span className="text-sm text-slate-500">{entry.count} students</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">No check-ins yet today.</p>
                  )}
                </div>

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

            <div>{renderScheduleControls()}</div>
          </div>
        )}

        {tab === "classes" && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
            <div className="space-y-6">
              <div className="card space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Your Classes</h2>
                  <span className="text-sm text-slate-400">{teacherClasses.length}</span>
                </div>
                <div className="space-y-2">
                  {teacherClasses.map((classDoc) => (
                    <button
                      key={classDoc._id.toString()}
                      onClick={() => setSelectedClassId(classDoc._id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                        selectedClassId?.toString() === classDoc._id.toString()
                          ? "border-brand-300 bg-brand-50"
                          : "border-slate-200 bg-white hover:border-brand-200"
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{classDoc.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {classDoc.subject} · Room {classDoc.room}
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

              <div className="card space-y-3">
                <h3 className="text-lg font-semibold text-slate-900">Create Class</h3>
                <input
                  type="text"
                  value={newClassForm.name}
                  onChange={(event) => setNewClassForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Class name"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="text"
                  value={newClassForm.subject}
                  onChange={(event) => setNewClassForm((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Subject"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={newClassForm.room}
                    onChange={(event) => setNewClassForm((current) => ({ ...current, room: event.target.value }))}
                    placeholder="Room"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    type="text"
                    value={newClassForm.grade}
                    onChange={(event) => setNewClassForm((current) => ({ ...current, grade: event.target.value }))}
                    placeholder="Grade"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <button onClick={handleCreateClass} className="btn-primary w-full">
                  Add Class
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="card space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {classDetails?.class.name ?? "Select a class"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {classDetails?.class.subject ?? "Class setup"} {classDetails?.class ? `· Room ${classDetails.class.room}` : ""}
                    </p>
                  </div>
                  {classDetails?.class && (
                    <button
                      onClick={handleDeleteClass}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      Delete Class
                    </button>
                  )}
                </div>

                {classDetails?.class ? (
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
                    <button onClick={handleUpdateClass} className="btn-primary md:col-span-2">
                      Save Class Details
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-400">
                    Choose a class from the left to manage its roster and teaching blocks.
                  </div>
                )}
              </div>

              {selectedClassId && (
                <>
                  <div className="card space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Roster Upload</h3>
                        <p className="text-sm text-slate-500">Upload roster images, let Groq read the names, then confirm the matches.</p>
                      </div>
                      <button onClick={() => rosterFileRef.current?.click()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">
                        Choose Images
                      </button>
                      <input
                        ref={rosterFileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          if (files.length > 0) applyRosterFiles(files);
                        }}
                      />
                    </div>

                    {rosterPreviewImages.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                        {rosterPreviewImages.map((preview, index) => (
                          <div
                            key={getRosterPreviewKey(rosterFiles[index], index)}
                            className="relative group"
                            role="group"
                            aria-label={`Roster image ${index + 1} of ${rosterPreviewImages.length}`}
                          >
                            {isSafeRosterPreviewUrl(preview) ? (
                              <img
                                src={preview}
                                alt={`Roster image ${index + 1} of ${rosterPreviewImages.length} preview`}
                                className="max-h-48 w-full rounded-xl border border-slate-200 object-contain"
                              />
                            ) : (
                              <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500">
                                Preview unavailable
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {rosterFiles.length > 0 && parsedRosterNames.length === 0 && (
                      <button onClick={handleParseRoster} disabled={isParsingRoster} className="btn-primary w-full disabled:opacity-50">
                        {isParsingRoster ? `Reading rosters (${rosterFiles.length} images)...` : `Parse Rosters with Groq (${rosterFiles.length} images)`}
                      </button>
                    )}

                    {rosterParseError && (
                      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{rosterParseError}</div>
                    )}

                    {rosterMatches.length > 0 && (
                      <div className="space-y-3">
                        {rosterMatches.map((match) => (
                          <div key={match.displayName} className="rounded-2xl border border-slate-200 px-4 py-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <div className="font-semibold text-slate-900">{match.displayName}</div>
                                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
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
                                value={rosterSelections[match.displayName] ?? ""}
                                onChange={(event) =>
                                  setRosterSelections((current) => ({
                                    ...current,
                                    [match.displayName]: event.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 lg:w-80"
                              >
                                <option value="">Save as placeholder</option>
                                {match.candidates.map((candidate) => (
                                  <option key={candidate.studentId.toString()} value={candidate.studentId.toString()}>
                                    {candidate.name} · {candidate.studentNumber}
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

                  <div className="card space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Manual Roster Add</h3>
                    <div className="grid gap-3 lg:grid-cols-[1fr,280px,auto]">
                      <input
                        type="text"
                        value={manualEntryName}
                        onChange={(event) => setManualEntryName(event.target.value)}
                        placeholder="Student display name"
                        className="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <select
                        value={manualLinkedStudentId}
                        onChange={(event) => setManualLinkedStudentId(event.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">No linked account yet</option>
                        {allStudentOptions.map((student) => (
                          <option key={student._id.toString()} value={student._id.toString()}>
                            {student.name} · {student.studentId}
                          </option>
                        ))}
                      </select>
                      <button onClick={handleAddManualRosterEntry} className="btn-primary px-4">
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="card space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Class Roster</h3>
                    {classDetails?.roster.length ? (
                      <div className="space-y-3">
                        {classDetails.roster.map((entry) => (
                          <div key={entry._id.toString()} className="rounded-2xl border border-slate-200 px-4 py-4">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                              <div>
                                <div className="font-semibold text-slate-900">{entry.displayName}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                  {entry.linkedStudent
                                    ? `${entry.linkedStudent.name} · ${entry.linkedStudent.studentId}`
                                    : "Placeholder entry"}
                                  {entry.source ? ` · ${entry.source}` : ""}
                                </div>
                              </div>

                              <div className="flex flex-col gap-2 xl:items-end">
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                    entry.status === "linked"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {entry.status === "linked" ? "Linked" : "Placeholder"}
                                </span>

                                {entry.status === "placeholder" && (
                                  <div className="flex flex-wrap gap-2">
                                    <select
                                      value={linkSelections[entry._id.toString()] ?? ""}
                                      onChange={(event) =>
                                        setLinkSelections((current) => ({
                                          ...current,
                                          [entry._id.toString()]: event.target.value,
                                        }))
                                      }
                                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    >
                                      <option value="">Link to student...</option>
                                      {allStudentOptions.map((student) => (
                                        <option key={student._id.toString()} value={student._id.toString()}>
                                          {student.name} · {student.studentId}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => handleLinkRosterEntry(entry._id)}
                                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700"
                                    >
                                      Link
                                    </button>
                                  </div>
                                )}

                                <button
                                  onClick={() => teacherId && removeRosterEntry({ teacherId, rosterEntryId: entry._id })}
                                  className="text-sm text-red-600 underline"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">This class does not have a roster yet.</p>
                    )}
                  </div>

                  <div className="card space-y-5">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Day Block Planner</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Choose which class you teach during each block on Day 1 through Day 4.
                      </p>
                    </div>

                    <div className="space-y-6">
                      {DAY_OPTIONS.map((dayLabel) => (
                        <div key={dayLabel} className="rounded-2xl border border-slate-200 px-4 py-4">
                          <div className="mb-4 flex items-center justify-between">
                            <h4 className="font-semibold text-slate-900">{dayLabel}</h4>
                            <button onClick={() => handleSaveAssignments(dayLabel)} className="btn-primary px-4 py-2 text-sm">
                              Save {dayLabel}
                            </button>
                          </div>

                          <div className="space-y-3">
                            {blockLabels.map((blockLabel) => (
                              <div key={blockLabel} className="grid gap-3 md:grid-cols-[180px,1fr] md:items-center">
                                <div className="text-sm font-medium text-slate-600">{blockLabel}</div>
                                <select
                                  value={assignmentDrafts[dayLabel]?.[blockLabel] ?? ""}
                                  onChange={(event) =>
                                    setAssignmentDrafts((current) => ({
                                      ...current,
                                      [dayLabel]: {
                                        ...(current[dayLabel] ?? {}),
                                        [blockLabel]: event.target.value,
                                      },
                                    }))
                                  }
                                  className="rounded-xl border border-slate-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                >
                                  <option value="">No class assigned</option>
                                  {teacherClasses.map((classDoc) => (
                                    <option key={classDoc._id.toString()} value={classDoc._id.toString()}>
                                      {classDoc.name} · Room {classDoc.room}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                  placeholder="Search by name, ID, email, or grade"
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
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                        selectedStudentId?.toString() === student._id.toString()
                          ? "border-brand-300 bg-brand-50"
                          : "border-slate-200 bg-white hover:border-brand-200"
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{student.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        ID: {student.studentId}
                        {student.grade ? ` · Grade ${student.grade}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{student.email ?? "No email on file"}</div>
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
                          ID: {selectedStudent.studentId}
                          {selectedStudent.grade ? ` · Grade ${selectedStudent.grade}` : ""}
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

                  <div className="grid gap-4 md:grid-cols-4">
                    <SummaryCard value={studentInsights.stats.tardyCount} label="Tardies" tone="text-violet-600" />
                    <SummaryCard value={studentInsights.stats.absenceCount} label="Absences" tone="text-red-600" />
                    <SummaryCard value={studentInsights.stats.activityCount} label="Activity Days" tone="text-sky-600" />
                    <SummaryCard value={studentInsights.stats.attendedDays} label="Attended Days" tone="text-emerald-600" />
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr),minmax(320px,0.75fr)]">
                    <div className="space-y-6">
                      <div className="card space-y-4">
                        <h3 className="text-lg font-semibold text-slate-900">Attendance by Day</h3>
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

                      <div className="card space-y-4">
                        <h3 className="text-lg font-semibold text-slate-900">Student Schedule Snapshot</h3>
                        {schedDays.length > 0 ? (
                          <div className="space-y-4">
                            {schedDays.map((dayOfWeek) => (
                              <div key={dayOfWeek} className="rounded-2xl border border-slate-200 px-4 py-4">
                                <div className="font-semibold text-slate-900">{dayOfWeek}</div>
                                <div className="mt-3 space-y-2">
                                  {studentSchedule
                                    .filter((entry) => entry.dayOfWeek === dayOfWeek)
                                    .map((entry) => (
                                      <div key={entry._id.toString()} className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                                        {entry.blockLabel ?? "Block"} · {entry.subject} · Room {entry.room}
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">No parsed student schedule is stored for this student yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
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
                        <input
                          type="text"
                          value={activityLabel}
                          onChange={(event) => setActivityLabel(event.target.value)}
                          placeholder="Band, sports, counseling..."
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
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
                                <div className="mt-1 text-sm text-slate-500">{fmtDateLabel(activity.date)}</div>
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
              <h2 className="text-lg font-semibold text-slate-900">Class Rooms</h2>
              <p className="text-sm text-slate-500">Configure the BLE beacon that each of your teaching rooms should use.</p>
              <div className="space-y-2">
                {roomEntries.map((entry) => (
                  <button
                    key={`${entry.room}-${entry.className}`}
                    onClick={() => openRoomForm(entry.room)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      editingRoom === entry.room
                        ? "border-brand-300 bg-brand-50"
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
                        onChange={(event) => setRoomDeviceName(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">UUID</label>
                    <input
                      type="text"
                      value={roomUuid}
                      onChange={(event) => setRoomUuid(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={scanForBeacon} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">
                      Scan for Beacon
                    </button>
                    <button onClick={saveRoomBeacon} className="btn-primary px-4 py-2 text-sm">
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
      </main>
    </div>
  );
}
