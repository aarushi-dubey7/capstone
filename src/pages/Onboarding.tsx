import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { setStoredStudentId } from "../hooks/useStudent";

type Step = 1 | 2 | 3;

interface ScheduleEntry {
  day_of_week: string;
  start_time: string;
  end_time: string;
  subject: string;
  room: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");

  // Step 2 state
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [parsedSchedule, setParsedSchedule] = useState<ScheduleEntry[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  // Day rotation
  const [todayDayLabel, setTodayDayLabel] = useState<string>("");

  // Convex
  const [convexId, setConvexId] = useState<Id<"students"> | null>(null);
  const registerStudent = useMutation(api.students.register);
  const saveSchedule = useMutation(api.schedules.save);
  const setRotation = useMutation(api.scheduleRotation.set);
  const parseImage = useAction(api.groq.parseScheduleImage);

  async function handleStep1() {
    if (!name.trim() || !studentId.trim()) return;
    const id = await registerStudent({ name: name.trim(), studentId: studentId.trim(), role: "student" });
    setConvexId(id as Id<"students">);
    setStoredStudentId(studentId.trim());
    setStep(2);
  }

  function applyFile(file: File) {
    setScheduleFile(file);
    setParsedSchedule(null);
    setParseError("");
    setPreview(URL.createObjectURL(file));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  }

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (step !== 2) return;
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
    if (!item) return;
    const file = item.getAsFile();
    if (file) applyFile(file);
  }, [step]);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  async function handleParseSchedule() {
    if (!scheduleFile) return;
    setParsing(true);
    setParseError("");
    try {
      const base64 = await fileToBase64(scheduleFile);
      const result = await parseImage({ imageBase64: base64, mimeType: scheduleFile.type });
      setParsedSchedule(result);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse schedule");
    } finally {
      setParsing(false);
    }
  }

  async function handleStep2() {
    if (!parsedSchedule || !convexId) return;
    await saveSchedule({
      studentId: convexId,
      entries: parsedSchedule.map((e) => ({
        dayOfWeek: e.day_of_week,
        startTime: e.start_time,
        endTime: e.end_time,
        subject: e.subject,
        room: e.room,
      })),
    });
    if (todayDayLabel) {
      const todayDate = new Date().toISOString().split("T")[0];
      await setRotation({ date: todayDate, dayLabel: todayDayLabel });
    }
    setStep(3);
  }

  const stepLabels = ["Your Info", "Schedule", "Done"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-slate-50">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {stepLabels.map((label, i) => {
            const n = (i + 1) as Step;
            const active = n === step;
            const done = n < step;
            return (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${done ? "bg-brand-700 text-white" : active ? "bg-brand-700 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {done ? "✓" : n}
                </div>
                <span className={`text-sm ${active ? "text-slate-900 font-medium" : "text-slate-400"}`}>{label}</span>
                {i < stepLabels.length - 1 && <div className="w-8 h-px bg-slate-300 mx-1" />}
              </div>
            );
          })}
        </div>

        <div className="card">
          {/* Step 1: Name + ID */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Create your account</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alice Johnson"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Student ID</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="123456"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                onClick={handleStep1}
                disabled={!name.trim() || !studentId.trim()}
                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Upload schedule */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Upload your schedule</h2>
              <p className="text-slate-500 text-sm">
                Take a screenshot of your PowerSchool schedule and upload it. Groq will read it automatically.
              </p>

              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-brand-400 transition-colors"
              >
                {preview ? (
                  <img src={preview} alt="Schedule preview" className="max-h-48 rounded-lg object-contain" />
                ) : (
                  <>
                    <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-slate-500">Tap to choose image, or paste (⌘V)</span>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {scheduleFile && !parsedSchedule && (
                <button
                  onClick={handleParseSchedule}
                  disabled={parsing}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {parsing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Reading schedule…
                    </span>
                  ) : "Read Schedule with AI"}
                </button>
              )}

              {parseError && (
                <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{parseError}</p>
              )}

              {parsedSchedule && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-800">Confirm your schedule</p>
                    <button onClick={() => setParsedSchedule(null)} className="text-xs text-brand-600 underline">
                      Re-scan
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {parsedSchedule.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <div>
                          <span className="font-medium text-slate-800">{entry.subject}</span>
                          <span className="text-slate-400 ml-2">{entry.day_of_week}</span>
                        </div>
                        <div className="text-right text-slate-500">
                          <div>{entry.start_time} – {entry.end_time}</div>
                          <div className="font-mono text-xs bg-slate-100 rounded px-1">Rm {entry.room}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const dayOptions = [...new Set(parsedSchedule.map((e) => e.day_of_week))].sort();
                    return (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">What day is today?</p>
                        <div className="flex flex-wrap gap-2">
                          {dayOptions.map((d) => (
                            <button
                              key={d}
                              onClick={() => setTodayDayLabel(d === todayDayLabel ? "" : d)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                                todayDayLabel === d
                                  ? "bg-brand-700 text-white border-brand-700"
                                  : "border-slate-300 text-slate-600 hover:border-brand-400"
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                        {!todayDayLabel && (
                          <p className="text-xs text-slate-400">Skip if your schedule uses weekday names</p>
                        )}
                      </div>
                    );
                  })()}
                  <button onClick={handleStep2} className="btn-primary w-full">
                    Save Schedule
                  </button>
                </div>
              )}

              <button
                onClick={() => setStep(1)}
                className="text-sm text-slate-400 hover:text-slate-600 w-full text-center"
              >
                Back
              </button>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">You're all set, {name.split(" ")[0]}!</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Next time you're in class, just tap "Check In" and the app will find your room automatically.
                </p>
              </div>
              <button onClick={() => navigate("/student")} className="btn-primary w-full">
                Go to Check-In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
