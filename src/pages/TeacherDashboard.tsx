import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import AttendanceMap from "../components/AttendanceMap";

type Tab = "attendance" | "schedules" | "rooms" | "movement";

type ClassEntry = {
  _id?: string;
  code: string;
  isEP: boolean;
  subjects: Set<string>;
  teachers: Set<string>;
  grade?: string;
  period?: string;
  isManual?: boolean; // true = from classes table, false = from schedules
};

const DAY_OPTIONS = ["Day 1", "Day 2", "Day 3", "Day 4"];
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
type Weekday = typeof WEEKDAYS[number];

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function todayLong() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// Monday of the current week as ISO string
function weekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().split("T")[0];
}

// Current weekday key ("monday", "tuesday", ...)
function todayWeekdayKey(): Weekday {
  const keys: Weekday[] = ["sunday" as Weekday, "monday", "tuesday", "wednesday", "thursday", "friday", "saturday" as Weekday];
  return (keys[new Date().getDay()] ?? "monday") as Weekday;
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("attendance");

  // Data
  const liveLocations  = useQuery(api.attendance.getLiveLocations) ?? [];
  const todayLogs      = useQuery(api.attendance.getTodayLogs) ?? [];
  const allStudents    = useQuery(api.students.list) ?? [];
  const allLocations   = useQuery(api.locations.list) ?? [];
  const allSchedules   = useQuery(api.schedules.listAll) ?? [];
  const allClasses     = useQuery(api.classes.list) ?? [];
  const todayRotation  = useQuery(api.scheduleRotation.getByDate, { date: todayStr() });
  const recentRotation = useQuery(api.scheduleRotation.listRecent) ?? [];
  const weekMapping    = useQuery(api.weekDayMapping.getWeek, { weekStart: weekStart() });

  const setRotation  = useMutation(api.scheduleRotation.set);
  const setWeekMap   = useMutation(api.weekDayMapping.setWeek);
  const upsertLocation = useMutation(api.locations.upsert);
  const removeLocation = useMutation(api.locations.remove);
  const addClass       = useMutation(api.classes.add);
  const removeClass    = useMutation(api.classes.remove);
  const updateClass    = useMutation(api.classes.update);
  const bellSchedules = useQuery(api.bellSchedules.list) ?? [];
  const initBellSchedules = useMutation(api.bellSchedules.initialize);

  useEffect(() => {
    initBellSchedules();
  }, [initBellSchedules]);

  // Student selection
  const [selectedStudentId, setSelectedStudentId] = useState<Id<"students"> | null>(null);
  const studentLogs = useQuery(api.attendance.getStudentLogs,
    selectedStudentId ? { studentId: selectedStudentId } : "skip") ?? [];
  const studentSchedule = useQuery(api.schedules.getForStudent,
    selectedStudentId ? { studentId: selectedStudentId } : "skip") ?? [];

  // Day rotation form
  const [editingRotation, setEditingRotation] = useState(false);
  const [rotationLabel, setRotationLabel] = useState("");

  // Week setup form  (Mon–Fri → Day X)
  const [editingWeek, setEditingWeek] = useState(false);
  const [weekForm, setWeekForm] = useState<Record<Weekday, string>>({
    monday: "", tuesday: "", wednesday: "", thursday: "", friday: "",
  });

  // Room beacon form
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [roomName, setRoomName]       = useState("");
  const [roomUuid, setRoomUuid]       = useState("");
  const [roomDeviceName, setRoomDeviceName] = useState("");

  // Add class form
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassRoom, setNewClassRoom] = useState("");
  const [newClassSubject, setNewClassSubject] = useState("");
  const [newClassTeacher, setNewClassTeacher] = useState("");
  const [newClassGrade, setNewClassGrade] = useState("8");
  const [newClassPeriod, setNewClassPeriod] = useState("");

  // Edit class card state
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editTeacher, setEditTeacher] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editPeriod, setEditPeriod] = useState("");

  // ── Derived data ──
  const studentMap = useMemo(() => new Map(allStudents.map((s) => [s._id.toString(), s])), [allStudents]);

  const byRoom = useMemo(() => {
    const m = new Map<string, typeof liveLocations>();
    for (const log of liveLocations) {
      if (!m.has(log.locationName)) m.set(log.locationName, []);
      m.get(log.locationName)!.push(log);
    }
    return m;
  }, [liveLocations]);

  const checkedInIds  = useMemo(() => new Set(liveLocations.map((l) => l.studentId.toString())), [liveLocations]);
  const notCheckedIn  = useMemo(() => allStudents.filter((s) => s.role === "student" && !checkedInIds.has(s._id.toString())), [allStudents, checkedInIds]);
  const selectedStudent = selectedStudentId ? studentMap.get(selectedStudentId.toString()) : null;
  const schedDays       = useMemo(() => [...new Set(studentSchedule.map((e) => e.dayOfWeek))].sort(), [studentSchedule]);
  const roomEntries = useMemo(() => {
    const entries = new Map<string, ClassEntry>();

    // 1. Populate from student schedules
    for (const s of allSchedules) {
      const isEP = s.subject.includes("EP") || s.room === "EP";
      const key = isEP ? `${s.room}-EP` : s.room;
      // Look up the student's grade
      const student = studentMap.get(s.studentId.toString());
      const studentGrade = student?.grade ?? "8";
      
      if (!entries.has(key)) {
        entries.set(key, { 
          code: s.room, 
          isEP, 
          subjects: new Set(), 
          teachers: new Set(),
          grade: studentGrade,
          isManual: false,
        });
      }
      const entry = entries.get(key)!;
      entry.subjects.add(s.subject);
      if (s.teacherName) entry.teachers.add(s.teacherName);
    }

    // 2. Merge in teacher-added classes
    for (const c of allClasses) {
      const key = `manual-${c._id}`;
      if (!entries.has(c.room)) {
        entries.set(key, {
          _id: c._id as string,
          code: c.room,
          isEP: false,
          subjects: new Set([c.subject]),
          teachers: new Set([c.teacherName]),
          grade: c.grade,
          period: c.period,
          isManual: true,
        });
      } else {
        // Room already exists from schedules — merge info
        const existing = entries.get(c.room)!;
        existing.subjects.add(c.subject);
        existing.teachers.add(c.teacherName);
        if (c.grade) existing.grade = c.grade;
        if (c.period) existing.period = c.period;
      }
    }

    return [...entries.values()].sort((a, b) => a.code.localeCompare(b.code) || (a.isEP ? 1 : -1));
  }, [allSchedules, allClasses]);

  const locationByRoom  = useMemo(() => new Map(allLocations.map((l) => [l.roomNumber, l])), [allLocations]);

  // ── Handlers ──
  async function scanForBeacon() {
    try {
      // Request device with Room- prefix
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "Room-" }],
        optionalServices: [
          // Standard and custom services we might want to check
          "000000c2-0000-1000-8000-00805f9b34fb",
          "00000b12-0000-1000-8000-00805f9b34fb"
        ].map(s => s.toLowerCase())
      });
      
      setRoomDeviceName(device.name ?? "Room-Beacon");
      
      // Attempt to get the Service UUID by connecting
      const server = await device.gatt?.connect();
      const services = await server?.getPrimaryServices();
      if (services && services.length > 0) {
        // Find the first non-standard service (likely our room UUID)
        const customService = services.find(s => !s.uuid.startsWith("000018")) || services[0];
        setRoomUuid(customService.uuid);
      }
    } catch (err) {
      console.error("BLE Scan failed:", err);
      alert("Bluetooth scan failed or was cancelled.");
    }
  }

  function openRoomForm(code: string) {
    const loc = locationByRoom.get(code);
    setEditingRoom(code);
    setRoomName(loc?.name ?? `Room ${code}`);
    setRoomUuid(loc?.uuid ?? "");
    setRoomDeviceName(loc?.deviceName ?? "");
  }

  async function saveRoomBeacon() {
    if (!editingRoom || !roomUuid) return;
    await upsertLocation({ name: roomName || `Room ${editingRoom}`, roomNumber: editingRoom, uuid: roomUuid.toLowerCase(), deviceName: roomDeviceName.trim() || undefined });
    setEditingRoom(null); setRoomName(""); setRoomUuid(""); setRoomDeviceName("");
  }

  async function saveNewClass() {
    if (!newClassRoom || !newClassSubject || !newClassTeacher) return;
    await addClass({
      room: newClassRoom,
      subject: newClassSubject,
      teacherName: newClassTeacher,
      grade: newClassGrade || undefined,
      period: newClassPeriod || undefined,
    });
    setShowAddClass(false);
    setNewClassRoom(""); setNewClassSubject(""); setNewClassTeacher("");
    setNewClassGrade("8"); setNewClassPeriod("");
  }

  function openEditClass(entry: ClassEntry) {
    setEditingClassId(entry._id ?? null);
    setEditSubject([...entry.subjects].join(", "));
    setEditTeacher([...entry.teachers].join(", "));
    setEditGrade(entry.grade ?? "8");
    setEditPeriod(entry.period ?? "");
  }

  async function saveEditClass() {
    if (!editingClassId) return;
    await updateClass({
      id: editingClassId as Id<"classes">,
      subject: editSubject,
      teacherName: editTeacher,
      grade: editGrade || undefined,
      period: editPeriod || undefined,
    });
    setEditingClassId(null);
  }

  async function saveRotation() {
    await setRotation({ date: todayStr(), dayLabel: rotationLabel || undefined, bellScheduleType: selectedBellType });
    setEditingRotation(false); setRotationLabel("");
  }

  const [selectedBellType, setSelectedBellType] = useState<string>("Standard");
  useEffect(() => {
    if (todayRotation?.bellScheduleType) {
      setSelectedBellType(todayRotation.bellScheduleType);
    }
  }, [todayRotation]);

  function openWeekForm() {
    setWeekForm({
      monday:    weekMapping?.monday    ?? "",
      tuesday:   weekMapping?.tuesday   ?? "",
      wednesday: weekMapping?.wednesday ?? "",
      thursday:  weekMapping?.thursday  ?? "",
      friday:    weekMapping?.friday    ?? "",
    });
    setEditingWeek(true);
  }

  async function saveWeekSetup() {
    const args = { weekStart: weekStart(), ...Object.fromEntries(WEEKDAYS.map((d) => [d, weekForm[d] || undefined])) };
    await setWeekMap(args as Parameters<typeof setWeekMap>[0]);
    // Auto-set today's rotation from the mapping
    const todayKey = todayWeekdayKey();
    const todayLabel = weekForm[todayKey];
    if (todayLabel) await setRotation({ date: todayStr(), dayLabel: todayLabel });
    setEditingWeek(false);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "attendance", label: "Attendance" },
    { id: "schedules",  label: "Schedules" },
    { id: "rooms",      label: "Rooms" },
    { id: "movement",   label: "Movement" },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-brand-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Teacher Dashboard</h1>
          <p className="text-brand-300 text-sm mt-0.5">{todayLong()}</p>
        </div>
        <div className="flex items-center gap-3">
          {todayRotation ? (
            <button onClick={() => { setEditingRotation(true); setRotationLabel(todayRotation.dayLabel); setTab("schedules"); }}
              className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
              Today: <span className="font-semibold">{todayRotation.dayLabel}</span>
            </button>
          ) : (
            <button onClick={() => { setEditingRotation(true); setTab("schedules"); }}
              className="text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-3 py-1.5 rounded-lg transition-colors">
              Set today's day
            </button>
          )}
          <button onClick={() => navigate("/")} className="text-brand-300 hover:text-white text-sm transition-colors">Home</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Checked In",          value: liveLocations.length, color: "text-emerald-600" },
            { label: "Not Checked In",       value: notCheckedIn.length,  color: "text-amber-600"  },
            { label: "Total Check-ins Today",value: todayLogs.length,     color: "text-brand-700"  },
          ].map(({ label, value, color }) => (
            <div key={label} className="card text-center">
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
              <div className="text-slate-500 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-200 p-1 rounded-xl w-fit">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ATTENDANCE ── */}
        {tab === "attendance" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {byRoom.size === 0 ? (
                <div className="card text-center py-10 text-slate-400">No check-ins yet today</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...byRoom.entries()].map(([room, logs]) => (
                    <div key={room} className="card space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
                        <span className="font-semibold text-slate-800">{room}</span>
                        <span className="ml-auto text-sm text-slate-400">{logs.length}</span>
                      </div>
                      <div className="space-y-1">
                        {logs.map((log) => {
                          const s = studentMap.get(log.studentId.toString());
                          return (
                            <button key={log._id.toString()} onClick={() => setSelectedStudentId(log.studentId as Id<"students">)}
                              className="w-full flex items-center justify-between text-sm px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left">
                              <span className="text-slate-700">{s?.name ?? "Unknown"}</span>
                              <span className={`text-xs ${log.isLate ? "text-amber-600" : "text-emerald-600"}`}>
                                {log.isLate ? "Late" : "On time"} · {fmt(log.timestamp)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {notCheckedIn.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Not checked in ({notCheckedIn.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {notCheckedIn.map((s) => (
                      <button key={s._id.toString()} onClick={() => setSelectedStudentId(s._id as Id<"students">)}
                        className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-3 py-1 hover:bg-amber-100 transition-colors">
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {selectedStudent ? (
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{selectedStudent.name}</h3>
                      <p className="text-xs text-slate-400">ID: {selectedStudent.studentId}</p>
                    </div>
                    <button onClick={() => setSelectedStudentId(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Today's Timeline</p>
                    {studentLogs.length === 0 ? <p className="text-slate-400 text-sm">No check-ins today</p> : (
                      <div className="relative pl-4 border-l-2 border-slate-200 space-y-3">
                        {studentLogs.map((log) => (
                          <div key={log._id.toString()} className="relative">
                            <div className="absolute -left-[1.15rem] w-3 h-3 rounded-full border-2 border-white bg-brand-600" />
                            <div className="text-sm">
                              <div className="font-medium text-slate-800">{log.locationName}</div>
                              <div className="text-slate-400 text-xs flex items-center gap-1.5">
                                {fmt(log.timestamp)}
                                {log.isLate && <span className="text-amber-600 font-medium">· Late</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setTab("schedules")} className="text-xs text-brand-600 underline">View full schedule →</button>
                </div>
              ) : (
                <div className="card">
                  <h3 className="font-semibold text-slate-800 mb-3">Recent Check-ins</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {todayLogs.slice(0, 20).map((log) => {
                      const s = studentMap.get(log.studentId.toString());
                      return (
                        <button key={log._id.toString()} onClick={() => setSelectedStudentId(log.studentId as Id<"students">)}
                          className="w-full flex items-start justify-between text-sm hover:bg-slate-50 px-2 py-1.5 rounded-lg transition-colors text-left">
                          <div>
                            <div className="font-medium text-slate-700">{s?.name ?? "Unknown"}</div>
                            <div className="text-slate-400 text-xs">{log.locationName}</div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <div className="text-slate-500 text-xs">{fmt(log.timestamp)}</div>
                            {log.isLate && <div className="text-amber-600 text-xs">Late</div>}
                          </div>
                        </button>
                      );
                    })}
                    {todayLogs.length === 0 && <p className="text-slate-400 text-sm text-center py-4">No check-ins yet</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SCHEDULES ── */}
        {tab === "schedules" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card space-y-3">
                <h2 className="font-semibold text-slate-900">Student Schedule</h2>
                <select value={selectedStudentId ?? ""}
                  onChange={(e) => setSelectedStudentId(e.target.value as Id<"students"> || null)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select a student…</option>
                  {allStudents.filter((s) => s.role === "student").map((s) => (
                    <option key={s._id.toString()} value={s._id.toString()}>{s.name}</option>
                  ))}
                </select>
              </div>

              {selectedStudent && (
                <div className="card space-y-4">
                  <h3 className="font-semibold text-slate-900">{selectedStudent.name}'s Schedule</h3>
                  {schedDays.length === 0 ? <p className="text-slate-400 text-sm">No schedule on file</p> : schedDays.map((day) => {
                    const periods = studentSchedule.filter((e) => e.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
                    const isToday = todayRotation?.dayLabel === day;
                    return (
                      <div key={day}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-sm font-semibold px-2 py-0.5 rounded-md ${isToday ? "bg-brand-100 text-brand-700" : "text-slate-600"}`}>
                            {day}{isToday && " · Today"}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                          {periods.map((p, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                              <div>
                                <span className="font-medium text-slate-800">{p.subject}</span>
                                {p.teacherName && <span className="text-slate-400 text-xs ml-1.5">by {p.teacherName}</span>}
                                <span className="font-mono text-xs bg-slate-100 rounded px-1 ml-2">Rm {p.room}</span>
                              </div>
                              <span className="text-slate-400 text-xs">{p.startTime} – {p.endTime}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: rotation + week setup */}
            <div className="space-y-4">
              {/* Day rotation */}
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Today's Day</h3>
                  <button onClick={() => { setEditingRotation(!editingRotation); setRotationLabel(todayRotation?.dayLabel ?? ""); }}
                    className="text-xs text-brand-600 underline">
                    {editingRotation ? "Cancel" : "Change"}
                  </button>
                </div>

                {!editingRotation && todayRotation && (
                  <div className="bg-brand-50 rounded-xl px-4 py-3">
                    <p className="text-xs text-brand-600 font-medium uppercase tracking-wide">Today</p>
                    <p className="text-2xl font-bold text-brand-800 mt-0.5">{todayRotation.dayLabel}</p>
                  </div>
                )}

                {(editingRotation || !todayRotation) && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">What day is today?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {DAY_OPTIONS.map((d) => (
                        <button key={d} onClick={() => setRotationLabel(d)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${rotationLabel === d ? "bg-brand-700 text-white border-brand-700" : "border-slate-300 text-slate-600 hover:border-brand-400"}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                    <button onClick={saveRotation} disabled={!rotationLabel}
                      className="btn-primary text-sm py-2 px-4 w-full disabled:opacity-40">
                      Save
                    </button>
                  </div>
                )}

                {recentRotation.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Recent</p>
                    {recentRotation.slice(0, 5).map((r) => (
                      <div key={r._id.toString()} className="flex justify-between text-sm">
                        <span className="text-slate-400">{r.date}</span>
                        <span className="font-medium text-slate-700">{r.dayLabel} {r.bellScheduleType !== "Standard" && `(${r.bellScheduleType})`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bell Schedule Type */}
              <div className="card space-y-3">
                <h3 className="font-semibold text-slate-800">Bell Schedule</h3>
                <p className="text-xs text-slate-500">Change the format for special events</p>
                <div className="space-y-2">
                  {bellSchedules.map((s) => (
                    <button key={s.type} 
                      onClick={() => {
                        setSelectedBellType(s.type);
                        setRotation({ date: todayStr(), bellScheduleType: s.type });
                      }}
                      className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium border text-left transition-all flex items-center justify-between ${selectedBellType === s.type ? "bg-brand-50 border-brand-200 text-brand-800 ring-2 ring-brand-500/20" : "border-slate-200 text-slate-600 hover:border-brand-300"}`}>
                      {s.type}
                      {selectedBellType === s.type && <div className="w-2 h-2 rounded-full bg-brand-600" />}
                    </button>
                  ))}
                </div>
                {selectedBellType !== "Standard" && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Preview</p>
                    <div className="space-y-1">
                      {bellSchedules.find(s => s.type === selectedBellType)?.blocks.slice(0, 3).map(b => (
                        <div key={b.label} className="flex justify-between text-[11px] text-amber-700">
                          <span>{b.label}</span>
                          <span>{b.start}</span>
                        </div>
                      ))}
                      <p className="text-[10px] text-amber-600 italic">... and more</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Week setup */}
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Week Setup</h3>
                  <button onClick={() => editingWeek ? setEditingWeek(false) : openWeekForm()}
                    className="text-xs text-brand-600 underline">
                    {editingWeek ? "Cancel" : "Edit"}
                  </button>
                </div>

                {!editingWeek && weekMapping ? (
                  <div className="space-y-1">
                    {WEEKDAYS.map((d) => {
                      const label = weekMapping[d];
                      return label ? (
                        <div key={d} className="flex justify-between text-sm">
                          <span className="capitalize text-slate-500">{d}</span>
                          <span className="font-medium text-slate-700">{label}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                ) : !editingWeek ? (
                  <p className="text-xs text-slate-400">No week mapping set. Click Edit to assign Day 1–4 to each weekday.</p>
                ) : null}

                {editingWeek && (
                  <div className="space-y-2">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className="flex items-center gap-2">
                        <span className="capitalize text-sm text-slate-600 w-24">{d}</span>
                        <select value={weekForm[d]}
                          onChange={(e) => setWeekForm((f) => ({ ...f, [d]: e.target.value }))}
                          className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                          <option value="">—</option>
                          {DAY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                    ))}
                    <button onClick={saveWeekSetup} className="btn-primary text-sm py-2 px-4 w-full">
                      Save Week Setup
                    </button>
                    <p className="text-xs text-slate-400">Today's day will be set automatically based on today's weekday.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ROOMS ── */}
        {tab === "rooms" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                All 8th grade classes and rooms. Assign a BLE beacon to each so check-in works automatically.
              </p>
              <button
                onClick={() => setShowAddClass(!showAddClass)}
                className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Class
              </button>
            </div>

            {/* Add Class Form */}
            {showAddClass && (
              <div className="card space-y-4 border-2 border-brand-200 bg-brand-50/30">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add a New Class
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Room *</label>
                    <input value={newClassRoom} onChange={(e) => setNewClassRoom(e.target.value)} placeholder="e.g. B16"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Subject *</label>
                    <input value={newClassSubject} onChange={(e) => setNewClassSubject(e.target.value)} placeholder="e.g. Social Studies"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Teacher *</label>
                    <input value={newClassTeacher} onChange={(e) => setNewClassTeacher(e.target.value)} placeholder="e.g. Mr. Buonaspina"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Grade</label>
                    <select value={newClassGrade} onChange={(e) => setNewClassGrade(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mt-1">
                      <option value="6">6th Grade</option>
                      <option value="7">7th Grade</option>
                      <option value="8">8th Grade</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Period / Block</label>
                    <input value={newClassPeriod} onChange={(e) => setNewClassPeriod(e.target.value)} placeholder="e.g. Block 3"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mt-1" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveNewClass}
                    disabled={!newClassRoom || !newClassSubject || !newClassTeacher}
                    className="btn-primary text-sm py-2 px-6 disabled:opacity-40">
                    Save Class
                  </button>
                  <button onClick={() => setShowAddClass(false)}
                    className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {roomEntries.length === 0 ? (
              <div className="card text-center py-10 text-slate-400">No classes or student schedules on file yet</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {roomEntries.map((entry) => {
                  const { code, isEP, subjects, teachers, grade, period, isManual, _id } = entry;
                  const key = isManual ? `manual-${_id}` : isEP ? `${code}-EP` : code;
                  const loc = locationByRoom.get(code);
                  const isEditing = editingRoom === code;
                  
                  return (
                    <div key={key} className={`card space-y-4 ${isManual ? 'ring-1 ring-brand-200' : ''}`}>
                      {/* Header with badges and actions */}
                      <div className="flex items-center justify-between">
                        {isManual ? (
                          <span className="text-[10px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold">
                            Manually Added
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">
                            From Schedule
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          {isManual && editingClassId !== _id && (
                            <button onClick={() => openEditClass(entry)}
                              className="text-[10px] text-brand-600 hover:text-brand-800 transition-colors flex items-center gap-0.5">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                          )}
                          {isManual && (
                            <button onClick={() => _id && removeClass({ id: _id as Id<"classes"> })}
                              className="text-[10px] text-red-400 hover:text-red-600 transition-colors">
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline edit mode for manual classes */}
                      {isManual && editingClassId === _id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Subject</label>
                            <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Teacher</label>
                            <input value={editTeacher} onChange={(e) => setEditTeacher(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Grade</label>
                              <select value={editGrade} onChange={(e) => setEditGrade(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-brand-500">
                                <option value="6">6th</option>
                                <option value="7">7th</option>
                                <option value="8">8th</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Period</label>
                              <input value={editPeriod} onChange={(e) => setEditPeriod(e.target.value)} placeholder="Block 3"
                                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={saveEditClass} className="btn-primary text-xs py-1.5 px-4">Save</button>
                            <button onClick={() => setEditingClassId(null)}
                              className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* 1. Subject */}
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Subject</p>
                            <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                              {[...subjects].join(", ")}
                            </p>
                          </div>

                      {/* 2. Room & Beacon Status */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Room</p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600 font-medium">Room {code}{isEP ? " (EP)" : ""}</span>
                            {loc
                              ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Beacon set</span>
                              : <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">No beacon</span>}
                          </div>
                        </div>
                        <button onClick={() => isEditing ? setEditingRoom(null) : openRoomForm(code)}
                          className="text-xs text-brand-600 underline shrink-0">
                          {isEditing ? "Cancel" : loc ? "Edit" : "Assign"}
                        </button>
                      </div>

                      {/* 3. Teacher */}
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Teacher</p>
                        <p className="text-xs text-slate-600 line-clamp-1">
                          {[...teachers].join(", ") || "No teacher listed"}
                        </p>
                      </div>

                      {/* 4. Grade & Period (if available) */}
                      {(grade || period) && (
                        <div className="flex gap-4">
                          {grade && (
                            <div>
                              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Grade</p>
                              <p className="text-xs text-slate-600">{grade}th</p>
                            </div>
                          )}
                          {period && (
                            <div>
                              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Period</p>
                              <p className="text-xs text-slate-600">{period}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {loc && !isEditing && (
                        <div className="text-xs pt-3 border-t border-slate-100 space-y-1">
                          <p className="text-slate-400 font-medium">BEACON INFO</p>
                          {loc.deviceName && <p className="text-brand-700 font-medium">{loc.deviceName}</p>}
                          <p className="font-mono text-slate-400">{loc.uuid}</p>
                          <button onClick={() => removeLocation({ id: loc._id as Id<"locations"> })}
                            className="text-red-400 hover:text-red-600 transition-colors mt-2">
                            Remove beacon
                          </button>
                        </div>
                      )}

                      {isEditing && (
                        <div className="space-y-3 pt-3 border-t border-slate-100">
                          <button 
                            onClick={scanForBeacon}
                            className="w-full py-2 bg-brand-50 border border-brand-200 text-brand-700 rounded-xl text-xs font-bold hover:bg-brand-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                            </svg>
                            Scan for Beacon
                          </button>
                          
                          <div className="space-y-2">
                            <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder={`Room ${code}`}
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500" />
                            <input value={roomDeviceName} onChange={(e) => setRoomDeviceName(e.target.value)} placeholder="BLE device name"
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500" />
                            <input value={roomUuid} onChange={(e) => setRoomUuid(e.target.value)} placeholder="Service UUID"
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </div>
                          
                          <button onClick={saveRoomBeacon} disabled={!roomUuid}
                            className="btn-primary text-xs py-2 px-4 w-full disabled:opacity-40">
                            Save Configuration
                          </button>
                        </div>
                      )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MOVEMENT ── */}
        {tab === "movement" && (
          <AttendanceMap logs={todayLogs} students={allStudents} />
        )}
      </div>
    </div>
  );
}
