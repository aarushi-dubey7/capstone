import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getStoredStudentId, setStoredStudentId } from "../hooks/useStudent";

const MAX_STUDENT_ID_LENGTH = 7;

export default function Home() {
  const navigate = useNavigate();
  const storedId = getStoredStudentId();

  // Login form state
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginStudentId, setLoginStudentId] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
    if (loginStudentId.trim().length > MAX_STUDENT_ID_LENGTH) {
      setLoginError(`Password must be ${MAX_STUDENT_ID_LENGTH} characters or fewer.`);
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 home-animated-bg">
      {/* ── Stripe-style rotating gradient ── */}
      <div className="stripe-gradient">
        <div className="stripe-blob stripe-blob--purple" />
        <div className="stripe-blob stripe-blob--pink" />
        <div className="stripe-blob stripe-blob--orange" />
        <div className="stripe-blob stripe-blob--teal" />
        <div className="stripe-blob stripe-blob--blue" />
      </div>

      {/* ── Content ── */}
      <div className="text-center mb-12 relative z-10">
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
        <div className="w-full max-w-sm mb-6 relative z-10">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Welcome Back</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Log in with your school email and password</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">School Email</label>
              <div className="flex">
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value.replace(/[@\s]/g, "")); setLoginError(""); setSubmitted(false); }}
                  placeholder="ajohnson"
                  className="flex-1 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-l-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 border-r-0"
                />
                <span className="inline-flex items-center px-3 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-r-xl text-sm text-slate-500 dark:text-slate-400 font-medium">
                  @bhpsnj.org
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginStudentId}
                  onChange={(e) => {
                    setLoginStudentId(e.target.value.slice(0, MAX_STUDENT_ID_LENGTH));
                    setLoginError("");
                    setSubmitted(false);
                  }}
                  maxLength={MAX_STUDENT_ID_LENGTH}
                  placeholder="123456"
                  className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 113.833 3.833M15.216 14.5a3 3 0 11-4.716-4.716" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Up to {MAX_STUDENT_ID_LENGTH} characters.
              </p>
            </div>

            {loginError && (
              <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/30 rounded-xl px-4 py-2.5">{loginError}</p>
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
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>

            <button
              onClick={() => navigate("/onboarding")}
              className="w-full py-3 rounded-xl text-sm font-semibold border-2 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-700 transition-all"
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

      <div className="grid gap-4 w-full max-w-sm relative z-10">
        <button
          onClick={goToStudent}
          className="flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl hover:shadow-2xl active:scale-95 transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-brand-700 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">Student Check-In</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
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
