import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getStoredTeacherId, clearStoredTeacherId } from "../hooks/useTeacher";

const DAY_OPTIONS = ["Day 1", "Day 2", "Day 3", "Day 4"];

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

export default function TeacherSettings() {
  const navigate = useNavigate();
  const [teacherId] = useState<Id<"teachers"> | null>(() => {
    const stored = getStoredTeacherId();
    return stored ? (stored as Id<"teachers">) : null;
  });

  const [rotationLabel, setRotationLabel] = useState("");
  const [editingRotation, setEditingRotation] = useState(true);
  const [selectedBellType, setSelectedBellType] = useState("Standard");

  const teacherProfile = useQuery(api.teachers.getById, teacherId ? { teacherId } : "skip");
  const validTeacherId = teacherProfile ? teacherId : null;
  const todayRotation = useQuery(api.scheduleRotation.getByDate, { date: todayStr() });
  const recentRotation = useQuery(api.scheduleRotation.listRecent) ?? [];
  const bellSchedules = useQuery(api.bellSchedules.list) ?? [];

  const setRotation = useMutation(api.scheduleRotation.set);

  useEffect(() => {
    if (todayRotation?.bellScheduleType) {
      setSelectedBellType(todayRotation.bellScheduleType);
    }
  }, [todayRotation?.bellScheduleType]);

  useEffect(() => {
    if (teacherId && teacherProfile === null) {
      clearStoredTeacherId();
      navigate("/");
    }
  }, [teacherId, teacherProfile, navigate]);

  async function saveRotation() {
    await setRotation({
      date: todayStr(),
      dayLabel: rotationLabel || undefined,
      bellScheduleType: selectedBellType,
    });
    setEditingRotation(false);
    setRotationLabel("");
  }

  function handleLogout() {
    clearStoredTeacherId();
    navigate("/");
  }

  if (!teacherId || teacherProfile === undefined || !validTeacherId) {
    if (teacherProfile === null) {
      return null;
    }
    return (
      <div className="min-h-screen bg-slate-100 py-10 text-center text-sm text-slate-500">
        Loading teacher settings…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-brand-900 px-6 py-6 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
            <p className="mt-1 text-lg text-brand-100">{todayLong()}</p>
            <p className="mt-2 text-sm text-brand-200">
              Signed in as {teacherProfile?.name} · {teacherProfile?.email}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/teacher")}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                Back to Dashboard
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
        <div className="max-w-2xl">
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

          <div className="card mt-6 space-y-3">
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
                      ? "border-brand-200 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20"
                      : "border-slate-200 text-slate-600 hover:border-brand-300"
                  }`}
                >
                  {schedule.type}
                  {selectedBellType === schedule.type && <div className="h-2 w-2 rounded-full bg-brand-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
