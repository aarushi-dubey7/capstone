import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { setStoredStudentId } from "../hooks/useStudent";

export default function Onboarding() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [grade, setGrade] = useState("8");

  // Convex
  const registerStudent = useMutation(api.students.register);

  async function handleSubmit() {
    if (!name.trim() || !studentId.trim() || !emailPrefix.trim()) return;
    const email = `${emailPrefix.trim().toLowerCase()}@bhpsnj.org`;
    await registerStudent({ name: name.trim(), studentId: studentId.trim(), email, role: "student", grade });
    setStoredStudentId(studentId.trim());
    setDone(true);
  }

  const stepLabels = ["Your Info", "Done"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-slate-50">
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
                  ${(completed && n === 1) || (active && n === 2) ? "bg-brand-700 text-white" : active ? "bg-brand-700 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {completed && n === 1 ? "✓" : n}
                </div>
                <span className={`text-sm ${active ? "text-slate-900 font-medium" : "text-slate-400"}`}>{label}</span>
                {i < stepLabels.length - 1 && <div className="w-8 h-px bg-slate-300 mx-1" />}
              </div>
            );
          })}
        </div>

        <div className="card">
          {/* Registration Form */}
          {!done && (
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">School Email</label>
                <div className="flex">
                  <input
                    type="text"
                    value={emailPrefix}
                    onChange={(e) => setEmailPrefix(e.target.value.replace(/[@\s]/g, ""))}
                    placeholder="ajohnson"
                    className="flex-1 border border-slate-300 rounded-l-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 border-r-0"
                  />
                  <span className="inline-flex items-center px-4 py-3 bg-slate-100 border border-slate-300 rounded-r-xl text-sm text-slate-500 font-medium">
                    @bhpsnj.org
                  </span>
                </div>
                {emailPrefix && (
                  <p className="text-xs text-slate-400 mt-1">{emailPrefix.toLowerCase()}@bhpsnj.org</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
                <div className="flex gap-2">
                  {["6", "7", "8"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrade(g)}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                        grade === g
                          ? "bg-brand-700 text-white border-brand-700 shadow-md"
                          : "border-slate-300 text-slate-600 hover:border-brand-400"
                      }`}
                    >
                      {g}th Grade
                    </button>
                  ))}
                </div>
              </div>
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
