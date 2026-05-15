import { useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CALENDAR_ROTATION } from "../../convex/calendarData";

type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

const DAY_OPTIONS = ["Day 1", "Day 2", "Day 3", "Day 4"];
const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const DEFAULT_TARDY_THRESHOLD = 3;
const DEFAULT_REMINDER_MINUTES = 15;
const DEFAULT_BELL_SCHEDULE_TYPE = "Standard";

function formatDateStr(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekStart() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return formatDateStr(date);
}

function todayWeekdayKey(): Weekday {
  const dayIndex = new Date().getDay();
  if (dayIndex < 1 || dayIndex > 5) {
    return "monday";
  }
  return WEEKDAYS[dayIndex - 1];
}

function fmtDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function InfoTooltip({ label }: { label: string }) {
  const tooltipId = useId();
  return (
    <div className="relative group">
      <button
        type="button"
        aria-label="More information"
        aria-describedby={tooltipId}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-semibold text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-700"
      >
        i
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute right-0 top-7 z-20 w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-5 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </div>
    </div>
  );
}

export default function TeacherSettings() {
  const navigate = useNavigate();
  const [settingsForm, setSettingsForm] = useState({
    tardyThreshold: String(DEFAULT_TARDY_THRESHOLD),
    reminderMinutesAfterStart: String(DEFAULT_REMINDER_MINUTES),
  });
  const [editingWeek, setEditingWeek] = useState(false);
  const [weekForm, setWeekForm] = useState<Record<Weekday, string>>({
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
  });
  const weekStartLabel = useMemo(() => weekStart(), []);
  const todayDate = useMemo(() => formatDateStr(), []);
  const settings = useQuery(api.attendance.getSettings);
  const weekMapping = useQuery(api.weekDayMapping.getWeek, { weekStart: weekStartLabel });
  const todayRotation = useQuery(api.scheduleRotation.getByDate, { date: todayDate });

  const updateSettings = useMutation(api.attendance.updateSettings);
  const setWeekMap = useMutation(api.weekDayMapping.setWeek);
  const setRotation = useMutation(api.scheduleRotation.set);

  useEffect(() => {
    if (!settings) return;
    setSettingsForm({
      tardyThreshold: String(settings.tardyThreshold),
      reminderMinutesAfterStart: String(settings.reminderMinutesAfterStart),
    });
  }, [settings]);

  const suggestedRotation = useMemo(() => {
    const startDate = new Date(`${weekStartLabel}T00:00:00`);
    return WEEKDAYS.map((_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const dateString = formatDateStr(date);
      return {
        date: dateString,
        label: CALENDAR_ROTATION[dateString],
      };
    });
  }, [weekStartLabel]);

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

  function handleToggleWeekEdit() {
    if (editingWeek) {
      setEditingWeek(false);
      return;
    }
    openWeekForm();
  }

  async function saveWeekSetup() {
    await setWeekMap({
      weekStart: weekStartLabel,
      monday: weekForm.monday || undefined,
      tuesday: weekForm.tuesday || undefined,
      wednesday: weekForm.wednesday || undefined,
      thursday: weekForm.thursday || undefined,
      friday: weekForm.friday || undefined,
    });
    const todayLabel = weekForm[todayWeekdayKey()];
    if (todayLabel) {
      await setRotation({
        date: todayDate,
        dayLabel: todayLabel,
        bellScheduleType: todayRotation?.bellScheduleType ?? DEFAULT_BELL_SCHEDULE_TYPE,
      });
    }
    setEditingWeek(false);
  }

  async function saveSettings() {
    const parsedTardyThreshold = Number(settingsForm.tardyThreshold);
    const parsedReminderMinutes = Number(settingsForm.reminderMinutesAfterStart);
    await updateSettings({
      tardyThreshold:
        Number.isFinite(parsedTardyThreshold) && parsedTardyThreshold > 0
          ? parsedTardyThreshold
          : settings?.tardyThreshold ?? DEFAULT_TARDY_THRESHOLD,
      reminderMinutesAfterStart:
        Number.isFinite(parsedReminderMinutes) && parsedReminderMinutes > 0
          ? parsedReminderMinutes
          : settings?.reminderMinutesAfterStart ?? DEFAULT_REMINDER_MINUTES,
    });
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-brand-900 px-6 py-6 text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-brand-100">Week setup and attendance preferences</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/teacher")}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate("/")}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Home
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Week Setup</h3>
            <button onClick={handleToggleWeekEdit} className="text-xs text-brand-600 underline">
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

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Suggested Rotation Dates</p>
              <span className="text-xs text-slate-400">Week of {fmtDateLabel(weekStartLabel)}</span>
            </div>
            <div className="space-y-1">
              {suggestedRotation.map((entry) => (
                <div key={entry.date} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{fmtDateLabel(entry.date)}</span>
                  <span className="font-medium text-slate-700">{entry.label ?? "Not listed"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800">Attendance Settings</h3>
            <InfoTooltip label="Use this section to control when tardy alerts appear and how long the system waits before reminding teachers about unresolved students." />
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
      </main>
    </div>
  );
}
