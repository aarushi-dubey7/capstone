import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function today() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function TeacherDashboard() {
  const navigate = useNavigate();

  const liveLocations = useQuery(api.attendance.getLiveLocations) ?? [];
  const todayLogs     = useQuery(api.attendance.getTodayLogs) ?? [];
  const allStudents   = useQuery(api.students.list) ?? [];
  const allLocations  = useQuery(api.locations.list) ?? [];

  const [selectedStudentId, setSelectedStudentId] = useState<Id<"students"> | null>(null);
  const studentLogs = useQuery(
    api.attendance.getStudentLogs,
    selectedStudentId ? { studentId: selectedStudentId } : "skip"
  ) ?? [];

  // Add-room form
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomUuid, setRoomUuid] = useState("");
  const upsertLocation = useMutation(api.locations.upsert);
  const removeLocation = useMutation(api.locations.remove);

  async function handleAddRoom() {
    if (!roomName || !roomNumber || !roomUuid) return;
    await upsertLocation({ name: roomName, roomNumber, uuid: roomUuid.toLowerCase() });
    setRoomName(""); setRoomNumber(""); setRoomUuid("");
    setShowAddRoom(false);
  }

  // Build a map: studentId → student record
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

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-brand-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Teacher Dashboard</h1>
          <p className="text-brand-300 text-sm mt-0.5">{today()}</p>
        </div>
        <button onClick={() => navigate("/")} className="text-brand-300 hover:text-white text-sm transition-colors">
          Home
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Summary stats */}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: live room grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Live Locations</h2>
              <button
                onClick={() => setShowAddRoom(!showAddRoom)}
                className="text-sm text-brand-700 hover:text-brand-900 font-medium"
              >
                {showAddRoom ? "Cancel" : "+ Add Room"}
              </button>
            </div>

            {showAddRoom && (
              <div className="card space-y-3">
                <h3 className="font-medium text-slate-800">Register a Room Beacon</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={roomName} onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Room C2"
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="C2"
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <input
                  value={roomUuid} onChange={(e) => setRoomUuid(e.target.value)}
                  placeholder="000000c2-0000-1000-8000-00805f9b34fb"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={handleAddRoom}
                  disabled={!roomName || !roomNumber || !roomUuid}
                  className="btn-primary text-sm py-2 px-4 disabled:opacity-40"
                >
                  Save Room
                </button>
              </div>
            )}

            {/* Rooms with students */}
            {byRoom.size === 0 ? (
              <div className="card text-center py-10 text-slate-400">
                No check-ins yet today
              </div>
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
                            onClick={() => setSelectedStudentId(log.studentId as Id<"students">)}
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

            {/* Not checked in */}
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

          {/* Right: student detail / recent feed */}
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

            {/* Registered rooms */}
            <div className="card">
              <h3 className="font-semibold text-slate-800 mb-3">Registered Rooms</h3>
              {allLocations.length === 0 ? (
                <p className="text-slate-400 text-sm">No rooms added yet</p>
              ) : (
                <div className="space-y-1.5">
                  {allLocations.map((loc) => (
                    <div key={loc._id.toString()} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-slate-700">{loc.name}</span>
                        <span className="font-mono text-xs text-slate-400 ml-2">{loc.uuid.slice(0, 8)}…</span>
                      </div>
                      <button
                        onClick={() => removeLocation({ id: loc._id as Id<"locations"> })}
                        className="text-slate-300 hover:text-red-500 transition-colors text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
