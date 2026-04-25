import { useState, useMemo, useEffect } from "react";

interface Log {
  _id: { toString(): string };
  studentId: { toString(): string };
  locationName: string;
  timestamp: number;
  isLate: boolean;
}
interface Student {
  _id: { toString(): string };
  name: string;
  role: string;
}

const ROOM_W = 200;
const ROOM_H = 110;
const GAP = 20;
const MAX_COLS = 4;
const DOT = 26; // slot size per student circle
const DOT_SIZE = 22; // rendered circle diameter
const LOBBY_H = 70;

const PALETTE = [
  "#4f46e5","#059669","#d97706","#dc2626",
  "#7c3aed","#0891b2","#65a30d","#ea580c",
  "#be185d","#0e7490","#a16207","#9333ea",
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AttendanceMap({ logs, students }: { logs: Log[]; students: Student[] }) {
  const sortedLogs = useMemo(() => [...logs].sort((a, b) => a.timestamp - b.timestamp), [logs]);
  const eventTimes = useMemo(() => [...new Set(sortedLogs.map((l) => l.timestamp))].sort((a, b) => a - b), [sortedLogs]);

  const minTime = eventTimes[0] ? eventTimes[0] - 1000 : Date.now() - 3_600_000;
  const maxTime = Date.now();

  const [currentTime, setCurrentTime] = useState(maxTime);
  const [playing, setPlaying] = useState(false);

  // Event-driven play: hop to the next event timestamp, 1 second apart
  useEffect(() => {
    if (!playing) return;
    const next = eventTimes.find((t) => t > currentTime);
    if (!next) { setPlaying(false); return; }
    const id = setTimeout(() => setCurrentTime(next), 900);
    return () => clearTimeout(id);
  }, [playing, currentTime, eventTimes]);

  const studentList = useMemo(() => students.filter((s) => s.role === "student"), [students]);
  const colorOf = useMemo(
    () => new Map(studentList.map((s, i) => [s._id.toString(), PALETTE[i % PALETTE.length]])),
    [studentList]
  );

  // Unique rooms from all logs
  const rooms = useMemo(() => [...new Set(logs.map((l) => l.locationName))].sort(), [logs]);

  const numCols = Math.min(rooms.length, MAX_COLS) || 1;
  const numRoomRows = Math.ceil(rooms.length / numCols);
  const containerW = numCols * (ROOM_W + GAP) + GAP;
  const lobbyY = GAP + numRoomRows * (ROOM_H + GAP) + GAP;
  const containerH = lobbyY + LOBBY_H + GAP;
  const lobbyW = containerW - 2 * GAP;
  const dotsPerLobbyRow = Math.floor((lobbyW - 8) / DOT);

  const roomPos = useMemo(
    () => new Map(rooms.map((r, i) => [
      r,
      { x: GAP + (i % numCols) * (ROOM_W + GAP), y: GAP + Math.floor(i / numCols) * (ROOM_H + GAP) },
    ])),
    [rooms, numCols]
  );
  const dotsPerRoomRow = Math.floor((ROOM_W - 12) / DOT);

  // Which room is each student in at currentTime?
  const { roomStudents } = useMemo(() => {
    const studentRoom = new Map<string, string>();
    for (const log of sortedLogs) {
      if (log.timestamp <= currentTime) studentRoom.set(log.studentId.toString(), log.locationName);
    }
    const roomStudents = new Map<string, string[]>();
    for (const s of studentList) {
      const sid = s._id.toString();
      const room = studentRoom.get(sid) ?? "__lobby__";
      if (!roomStudents.has(room)) roomStudents.set(room, []);
      roomStudents.get(room)!.push(sid);
    }
    return { roomStudents };
  }, [currentTime, sortedLogs, studentList]);

  // Compute each student's absolute pixel position
  const dotPos = useMemo(() => {
    const out = new Map<string, { x: number; y: number }>();
    for (const [room, sids] of roomStudents.entries()) {
      const isLobby = room === "__lobby__";
      const perRow = isLobby ? dotsPerLobbyRow : dotsPerRoomRow;
      const baseX = isLobby ? GAP + 4 : roomPos.get(room)!.x + 6;
      const baseY = isLobby ? lobbyY + 22 : roomPos.get(room)!.y + 30;
      sids.forEach((sid, i) => {
        out.set(sid, {
          x: baseX + (i % perRow) * DOT,
          y: baseY + Math.floor(i / perRow) * DOT,
        });
      });
    }
    return out;
  }, [roomStudents, roomPos, dotsPerRoomRow, dotsPerLobbyRow, lobbyY]);

  if (logs.length === 0) {
    return (
      <div className="card text-center py-16 text-slate-400">
        No check-ins today yet — the map will appear once students start arriving.
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Student Movement</h2>
        <span className="text-sm text-slate-400">{fmtTime(currentTime)}</span>
      </div>

      {/* Map canvas */}
      <div className="overflow-auto">
        <div className="relative bg-slate-50 rounded-2xl border border-slate-200"
          style={{ width: containerW, height: containerH, minWidth: 320 }}>

          {/* Room boxes */}
          {rooms.map((room) => {
            const pos = roomPos.get(room)!;
            const count = roomStudents.get(room)?.length ?? 0;
            return (
              <div key={room} style={{ position: "absolute", left: pos.x, top: pos.y, width: ROOM_W, height: ROOM_H }}
                className="bg-white border-2 border-slate-200 rounded-xl shadow-sm">
                <div className="px-3 pt-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                    {room.replace(/^Room /i, "Rm ")}
                  </span>
                  {count > 0 && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-medium px-1.5 rounded-full">{count}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Lobby */}
          <div style={{ position: "absolute", left: GAP, top: lobbyY, width: lobbyW, height: LOBBY_H }}
            className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <div className="px-3 pt-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Not yet arrived</span>
            </div>
          </div>

          {/* Student dots */}
          {studentList.map((s) => {
            const sid = s._id.toString();
            const pos = dotPos.get(sid) ?? { x: -60, y: -60 };
            const color = colorOf.get(sid) ?? "#94a3b8";
            return (
              <div
                key={sid}
                title={s.name}
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  borderRadius: "50%",
                  backgroundColor: color,
                  transition: "left 0.6s cubic-bezier(.4,0,.2,1), top 0.6s cubic-bezier(.4,0,.2,1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  fontWeight: 700,
                  color: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  zIndex: 10,
                  cursor: "default",
                  userSelect: "none",
                }}
              >
                {initials(s.name)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline controls */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setCurrentTime(minTime); setPlaying(false); }}
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            ↩ Reset
          </button>
          <button
            onClick={() => {
              if (currentTime >= maxTime) setCurrentTime(minTime);
              setPlaying(!playing);
            }}
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
              playing ? "bg-brand-700 text-white" : "bg-brand-100 text-brand-700 hover:bg-brand-200"
            }`}
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <div className="flex items-center gap-1 ml-auto">
            {studentList.map((s) => (
              <div
                key={s._id.toString()}
                title={s.name}
                style={{ backgroundColor: colorOf.get(s._id.toString()) }}
                className="w-4 h-4 rounded-full"
              />
            ))}
          </div>
        </div>

        {/* Slider */}
        <input
          type="range"
          min={minTime}
          max={maxTime}
          value={currentTime}
          onChange={(e) => { setPlaying(false); setCurrentTime(+e.target.value); }}
          className="w-full accent-brand-700"
        />

        {/* Event tick marks */}
        <div className="relative h-5">
          {eventTimes.map((t, i) => {
            const pct = ((t - minTime) / (maxTime - minTime)) * 100;
            const log = sortedLogs.find((l) => l.timestamp === t);
            const s = students.find((x) => x._id.toString() === log?.studentId.toString());
            return (
              <div
                key={i}
                title={`${s?.name ?? "?"} → ${log?.locationName} at ${fmtTime(t)}`}
                style={{ left: `${pct}%`, backgroundColor: colorOf.get(log?.studentId.toString() ?? "") ?? "#94a3b8" }}
                className="absolute top-0 w-1.5 h-1.5 rounded-full -translate-x-0.5 cursor-pointer"
                onClick={() => setCurrentTime(t)}
              />
            );
          })}
          {/* Playhead */}
          <div
            style={{ left: `${((currentTime - minTime) / (maxTime - minTime)) * 100}%` }}
            className="absolute top-0 w-0.5 h-5 bg-brand-700 -translate-x-px pointer-events-none"
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>{fmtTime(minTime)}</span>
          <span>{fmtTime(maxTime)}</span>
        </div>
      </div>
    </div>
  );
}
