import { useNavigate } from "react-router-dom";
import { getStoredStudentId } from "../hooks/useStudent";

export default function Home() {
  const navigate = useNavigate();

  function goToStudent() {
    const id = getStoredStudentId();
    navigate(id ? "/student" : "/onboarding");
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
            <div className="text-sm text-slate-500 mt-0.5">Tap to mark your attendance</div>
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
