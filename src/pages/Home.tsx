import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getStoredStudentId, setStoredStudentId } from "../hooks/useStudent";

export default function Home() {
  const navigate = useNavigate();
  const storedId = getStoredStudentId();

  // Login form state
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginStudentId, setLoginStudentId] = useState("");
  const [loginError, setLoginError] = useState("");

  // Build the full email for the login query
  const fullEmail = loginEmail.trim()
    ? `${loginEmail.trim().toLowerCase()}@bhpsnj.org`
    : "";

  // Only run the login query when the user submits
  const [submitted, setSubmitted] = useState(false);
  const loginResult = useQuery(
    api.students.login,
    submitted && fullEmail && loginStudentId.trim()
      ? { email: fullEmail, studentId: loginStudentId.trim() }
      : "skip"
  );

  // Handle login result
  function handleLoginCheck() {
    if (!loginEmail.trim() || !loginStudentId.trim()) {
      setLoginError("Please fill in both fields.");
      return;
    }
    setLoginError("");
    setSubmitted(true);
  }

  // React to query result
  if (submitted && loginResult !== undefined) {
    if (loginResult) {
      // Match found — store and redirect
      setStoredStudentId(loginResult.studentId);
      navigate("/student");
    } else if (loginResult === null) {
      // No match
      setSubmitted(false);
      setLoginError("No account found. Check your email and ID, or register below.");
    }
  }

  function goToStudent() {
    const id = getStoredStudentId();
    if (id) {
      navigate("/student");
    } else {
      setShowLogin(true);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-brand-900 to-brand-700">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 backdrop-blur mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Attendance System</h1>
        <p className="mt-2 text-brand-200 text-lg">Tap once. You're checked in.</p>
      </div>

      {/* Login Modal */}
      {showLogin && !storedId && (
        <div className="w-full max-w-sm mb-6">
          <div className="bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Welcome Back</h2>
              <p className="text-sm text-slate-500 mt-0.5">Log in with your school email and student ID</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">School Email</label>
              <div className="flex">
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value.replace(/[@\s]/g, "")); setLoginError(""); setSubmitted(false); }}
                  placeholder="ajohnson"
                  className="flex-1 border border-slate-300 rounded-l-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 border-r-0"
                />
                <span className="inline-flex items-center px-3 py-3 bg-slate-100 border border-slate-300 rounded-r-xl text-sm text-slate-500 font-medium">
                  @bhpsnj.org
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Student ID</label>
              <input
                type="text"
                value={loginStudentId}
                onChange={(e) => { setLoginStudentId(e.target.value); setLoginError(""); setSubmitted(false); }}
                placeholder="123456"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {loginError && (
              <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-2.5">{loginError}</p>
            )}

            <button
              onClick={handleLoginCheck}
              disabled={!loginEmail.trim() || !loginStudentId.trim() || submitted}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitted ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Checking…
                </span>
              ) : "Log In"}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              onClick={() => navigate("/onboarding")}
              className="w-full py-3 rounded-xl text-sm font-semibold border-2 border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-700 transition-all"
            >
              Create New Account
            </button>

            <button
              onClick={() => setShowLogin(false)}
              className="text-sm text-slate-400 hover:text-slate-600 w-full text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 w-full max-w-sm">
        <button
          onClick={goToStudent}
          className="flex items-center gap-4 bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl active:scale-95 transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-slate-900">Student Check-In</div>
            <div className="text-sm text-slate-500 mt-0.5">
              {storedId ? "Tap to mark your attendance" : "Log in or register"}
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate("/teacher")}
          className="flex items-center gap-4 bg-white/10 backdrop-blur rounded-2xl p-6 shadow-xl hover:bg-white/20 active:scale-95 transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-white">Teacher Dashboard</div>
            <div className="text-sm text-brand-200 mt-0.5">Live class locations</div>
          </div>
        </button>
      </div>
    </div>
  );
}
