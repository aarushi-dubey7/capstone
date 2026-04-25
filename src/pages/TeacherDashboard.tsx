import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Tab = "attendance" | "schedules" | "rooms";

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function todayLong() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("attendance");

  // Attendance data
  const liveLocations = useQuery(api.attendance.getLiveLocations) ?? [];
  const todayLogs     = useQuery(api.attendance.getTodayLogs) ?? [];
  const allStudents   = useQuery(api.students.list) ?? [];
  const allLocations  = useQuery(api.locations.list) ?? [];
  const allSchedules  = useQuery(api.schedules.listAll) ?? [];

  // Day rotation
  const todayRotation = useQuery(api.scheduleRotation.getByDate, { date: todayStr() });
  const recentRotation = useQuery(api.scheduleRotation.listRecent) ?? [];
  const setRotation = useMutation(api.scheduleRotation.set);

  // Selected student (for both attendance detail and schedule view)
  const [selectedStudentId, setSelectedStudentId] = useState<Id<"students"> | null>(null);
  const studentLogs = useQuery(
    api.attendance.getStudentLogs,
    selectedStudentId ? { studentId: selectedStudentId } : "skip"
  ) ?? [];
  const studentSchedule = useQuery(
    api.schedules.getForStudent,
    selectedStudentId ? { studentId: selectedStudentId } : "skip"
  ) ?? [];

  // Location mutations
  const upsertLocation = useMutation(api.locations.upsert);
  const removeLocation = useMutation(api.locations.remove);

  // Room beacon form
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomUuid, setRoomUuid] = useState("");
  const [roomDeviceName, setRoomDeviceName] = useState("");

  // Day rotation form
  const [editingRotation, setEditingRotation] = useState(false);
  const [rotationLabel, setRotationLabel] = useState("");

  const studentMap = new Map(allStudents.map((s) => [s._id.toString(), s]));

  // Group live locations by room
  const byRoom = new Map<string, typeof liveLocations>();
  for (const log of liveLocations) {
    const room = log.locationName;
    if (!byRoom.has(room)) byRoom.set(room, []);
    byRoom.get(room)!.push(log);
  }

  const checkedInIds = new Set(liveLocations.map((l) => l.studentId.toString()));
  const notCheckedIn = allStudents.filter(
    (s) => s.role === "student" && !checkedInIds.has(s._id.toString())
  );

  const selectedStudent = selectedStudentId ? studentMap.get(selectedStudentId.toString()) : null;

  // Unique day labels in selected student's schedule
  const schedDays = [...new Set(studentSchedule.map((e) => e.dayOfWeek))].sort();

  // All unique room codes across all student schedules
  const allRoomCodes = [...new Set(allSchedules.map((s) => s.room))].sort();
  const locationByRoom = new Map(allLocations.map((l) => [l.roomNumber, l]));

  // Subjects per room (for display)
  const subjectsByRoom = new Map<string, Set<string>>();
  for (const s of allSchedules) {
    if (!subjectsByRoom.has(s.room)) subjectsByRoom.set(s.room, new Set());
    subjectsByRoom.get(s.room)!.add(s.subject);
  }

  function openRoomForm(roomCode: string) {
    const existing = locationByRoom.get(roomCode);
    setEditingRoom(roomCode);
    setRoomName(existing?.name ?? `Room ${roomCode}`);
    setRoomUuid(existing?.uuid ?? "");
    setRoomDeviceName(existing?.deviceName ?? "");
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
    setRoomName(""); setRoomUuid(""); setRoomDeviceName("");
  }

  async function saveRotation() {
    if (!rotationLabel) return;
    await setRotation({ date: todayStr(), dayLabel: rotationLabel });
    setEditingRotation(false);
    setRotationLabel("");
  }

  // Unique day labels across all schedules (for rotation picker)
  const allDayLabels = [...new Set(allSchedules.map((s) => s.dayOfWeek))].sort();

  const TABS: { id: Tab; label: string }[] = [
    { id: "attendance", label: "Attendance" },
    { id: "schedules", label: "Schedules" },
    { id: "rooms", label: "Rooms" },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-brand-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Teacher Dashboard</h1>
          <p className="text-brand-300 text-sm mt-0.5">{todayLong()}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Today's day label */}
          {todayRotation ? (
            <button
              onClick={() => { setEditingRotation(true); setRotationLabel(todayRotation.dayLabel); setTab("schedules"); }}
              className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              Today: <span className="font-semibold">{todayRotation.dayLabel}</span>
            </button>
          ) : (
            <button
              onClick={() => { setEditingRotation(true); setTab("schedules"); }}
              className="text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Set today's day
            </button>
          )}
          <button onClick={() => navigate("/")} className="text-brand-300 hover:text-white text-sm transition-colors">
            Home
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Checked In", value: liveLocations.length, color: "text-emerald-600" },
            { label: "Not Checked In", value: notCheckedIn.length, color: "text-amber-600" },
            { label: "Total Check-ins Today", value: todayLogs.length, color: "text-brand-700" },
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
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ATTENDANCE TAB ── */}
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
                            <button
                              key={log._id.toString()}
                              onClick={() => { setSelectedStudentId(log.studentId as Id<"students">); }}
                              className="w-full flex items-center justify-between text-sm px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
                            >
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
                      <button
                        key={s._id.toString()}
                        onClick={() => setSelectedStudentId(s._id as Id<"students">)}
                        className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-3 py-1 hover:bg-amber-100 transition-colors"
                      >
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
                    {studentLogs.length === 0 ? (
                      <p className="text-slate-400 text-sm">No check-ins today</p>
                    ) : (
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
                  <button
                    onClick={() => { setTab("schedules"); }}
                    className="text-xs text-brand-600 underline"
                  >
                    View full schedule →
                  </button>
                </div>
              ) : (
                <div className="card">
                  <h3 className="font-semibold text-slate-800 mb-3">Recent Check-ins</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {todayLogs.slice(0, 20).map((log) => {
                      const s = studentMap.get(log.studentId.toString());
                      return (
                        <button
                          key={log._id.toString()}
                          onClick={() => setSelectedStudentId(log.studentId as Id<"students">)}
                          className="w-full flex items-start justify-between text-sm hover:bg-slate-50 px-2 py-1.5 rounded-lg transition-colors text-left"
                        >
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
                    {todayLogs.length === 0 && (
                      <p className="text-slate-400 text-sm text-center py-4">No check-ins yet</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SCHEDULES TAB ── */}
        {tab === "schedules" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Student selector */}
              <div className="card space-y-3">
                <h2 className="font-semibold text-slate-900">Student Schedule</h2>
                <select
                  value={selectedStudentId ?? ""}
                  onChange={(e) => setSelectedStudentId(e.target.value as Id<"students"> || null)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select a student…</option>
                  {allStudents.filter((s) => s.role === "student").map((s) => (
                    <option key={s._id.toString()} value={s._id.toString()}>{s.name}</option>
                  ))}
                </select>
              </div>

              {selectedStudent && (
                <div className="card space-y-4">
                  <h3 className="font-semibold text-slate-900">{selectedStudent.name}'s Schedule</h3>
                  {schedDays.length === 0 ? (
                    <p className="text-slate-400 text-sm">No schedule on file</p>
                  ) : (
                    schedDays.map((day) => {
                      const periods = studentSchedule
                        .filter((e) => e.dayOfWeek === day)
                        .sort((a, b) => a.startTime.localeCompare(b.startTime));
                      const isToday = todayRotation?.dayLabel === day;
                      return (
                        <div key={day}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-sm font-semibold px-2 py-0.5 rounded-md ${
                              isToday ? "bg-brand-100 text-brand-700" : "text-slate-600"
                            }`}>{day}{isToday && " · Today"}</span>
                          </div>
                          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                            {periods.map((p, i) => (
                              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                <div>
                                  <span className="font-medium text-slate-800">{p.subject}</span>
                                  <span className="font-mono text-xs bg-slate-100 rounded px-1 ml-2">Rm {p.room}</span>
                                </div>
                                <span className="text-slate-400 text-xs">{p.startTime} – {p.endTime}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Day rotation panel */}
            <div className="space-y-4">
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Day Rotation</h3>
                  <button
                    onClick={() => { setEditingRotation(!editingRotation); setRotationLabel(todayRotation?.dayLabel ?? ""); }}
                    className="text-xs text-brand-600 underline"
                  >
                    {editingRotation ? "Cancel" : "Set today"}
                  </button>
                </div>

                {editingRotation && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">What day is today?</p>
                    <div className="flex flex-wrap gap-2">
                      {allDayLabels.map((d) => (
                        <button
                          key={d}
                          onClick={() => setRotationLabel(d)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                            rotationLabel === d
                              ? "bg-brand-700 text-white border-brand-700"
                              : "border-slate-300 text-slate-600 hover:border-brand-400"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={saveRotation}
                      disabled={!rotationLabel}
                      className="btn-primary text-sm py-2 px-4 disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                )}

                {todayRotation && !editingRotation && (
                  <div className="bg-brand-50 rounded-xl px-4 py-3">
                    <p className="text-xs text-brand-600 font-medium uppercase tracking-wide">Today</p>
                    <p className="text-2xl font-bold text-brand-800 mt-0.5">{todayRotation.dayLabel}</p>
                  </div>
                )}

                {recentRotation.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Recent</p>
                    {recentRotation.map((r) => (
                      <div key={r._id.toString()} className="flex justify-between text-sm">
                        <span className="text-slate-500">{r.date}</span>
                        <span className="font-medium text-slate-700">{r.dayLabel}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ROOMS TAB ── */}
        {tab === "rooms" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              All room codes found in student schedules. Assign a BLE beacon to each room so check-in works automatically.
            </p>

            {allRoomCodes.length === 0 ? (
              <div className="card text-center py-10 text-slate-400">
                No student schedules on file yet
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allRoomCodes.map((code) => {
                  const loc = locationByRoom.get(code);
                  const subjects = [...(subjectsByRoom.get(code) ?? [])].slice(0, 3);
                  const isEditing = editingRoom === code;

                  return (
                    <div key={code} className="card space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">Room {code}</span>
                            {loc ? (
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Beacon set</span>
                            ) : (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">No beacon</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{subjects.join(", ")}{subjects.length < (subjectsByRoom.get(code)?.size ?? 0) ? "…" : ""}</p>
                        </div>
                        <button
                          onClick={() => isEditing ? setEditingRoom(null) : openRoomForm(code)}
                          className="text-xs text-brand-600 underline shrink-0"
                        >
                          {isEditing ? "Cancel" : loc ? "Edit" : "Assign"}
                        </button>
                      </div>

                      {loc && !isEditing && (
                        <div className="text-xs space-y-0.5">
                          {loc.deviceName && <p className="text-brand-700 font-medium">{loc.deviceName}</p>}
                          <p className="font-mono text-slate-400">{loc.uuid.slice(0, 18)}…</p>
                          <button
                            onClick={() => removeLocation({ id: loc._id as Id<"locations"> })}
                            className="text-red-400 hover:text-red-600 transition-colors mt-1"
                          >
                            Remove beacon
                          </button>
                        </div>
                      )}

                      {isEditing && (
                        <div className="space-y-2">
                          <input
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            placeholder={`Room ${code}`}
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <input
                            value={roomDeviceName}
                            onChange={(e) => setRoomDeviceName(e.target.value)}
                            placeholder="BLE device name (e.g. Attendance-Anchor-101)"
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <input
                            value={roomUuid}
                            onChange={(e) => setRoomUuid(e.target.value)}
                            placeholder="Service UUID"
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <button
                            onClick={saveRoomBeacon}
                            disabled={!roomUuid}
                            className="btn-primary text-sm py-1.5 px-4 disabled:opacity-40"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
