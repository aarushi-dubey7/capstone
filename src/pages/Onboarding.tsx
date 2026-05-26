import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { setStoredStudentId } from "../hooks/useStudent";

const MAX_STUDENT_ID_LENGTH = 7;

export default function Onboarding() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [grade, setGrade] = useState("8");
  const [error, setError] = useState("");

  // Convex
  const registerStudent = useMutation(api.students.register);

  async function handleSubmit() {
    const trimmedStudentId = studentId.trim();

    if (!name.trim() || !studentId.trim() || !emailPrefix.trim()) return;
    if (trimmedStudentId.length > MAX_STUDENT_ID_LENGTH) {
      setError(`Password must be ${MAX_STUDENT_ID_LENGTH} characters or fewer.`);
      return;
    }

    const email = `${emailPrefix.trim().toLowerCase()}@bhpsnj.org`;
    await registerStudent({ name: name.trim(), studentId: trimmedStudentId, email, role: "student", grade });
    setStoredStudentId(trimmedStudentId);
    setError("");
    setDone(true);
  }

  const stepLabels = ["Your Info", "Done"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const active = done ? n === 2 : n === 1;
            const completed = done ? true : false;
            return (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${(completed && n === 1) || (active && n === 2) ? "bg-brand-700 text-white" : active ? "bg-brand-700 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                  {completed && n === 1 ? "✓" : n}
                </div>
                <span className={`text-sm ${active ? "text-slate-900 dark:text-slate-100 font-medium" : "text-slate-400 dark:text-slate-500"}`}>{label}</span>
                {i < stepLabels.length - 1 && <div className="w-8 h-px bg-slate-300 dark:bg-slate-700 mx-1" />}
              </div>
            );
          })}
        </div>

        <div className="card">
          {/* Registration Form */}
          {!done && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Create your account</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alice Johnson"
                  className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value.slice(0, MAX_STUDENT_ID_LENGTH));
                    setError("");
                  }}
                  maxLength={MAX_STUDENT_ID_LENGTH}
                  placeholder="123456"
                  className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Up to {MAX_STUDENT_ID_LENGTH} characters.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">School Email</label>
                <div className="flex">
                  <input
                    type="text"
                    value={emailPrefix}
                    onChange={(e) => setEmailPrefix(e.target.value.replace(/[@\s]/g, ""))}
                    placeholder="ajohnson"
                    className="flex-1 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-l-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 border-r-0"
                  />
                  <span className="inline-flex items-center px-4 py-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-r-xl text-sm text-slate-500 dark:text-slate-400 font-medium">
                    @bhpsnj.org
                  </span>
                </div>
                {emailPrefix && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{emailPrefix.toLowerCase()}@bhpsnj.org</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Grade</label>
                <div className="flex gap-2">
                  {["6", "7", "8"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrade(g)}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                        grade === g
                          ? "bg-brand-700 text-white border-brand-700 shadow-md"
                          : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400"
                      }`}
                    >
                      {g}th Grade
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || !studentId.trim() || !emailPrefix.trim()}
                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create Account
              </button>
            </div>
          )}

          {/* Done */}
          {done && (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">You're all set, {name.split(" ")[0]}!</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
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
