import { useEffect, useState } from "react";

export default function DarkModeToggle({ variant = "floating" }: { variant?: "floating" | "inline" }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={() => setIsDark(!isDark)}
        className="inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
        aria-label="Toggle dark mode"
      >
        <span className="text-brand-50">{isDark ? "Dark" : "Light"}</span>
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isDark ? "bg-brand-500/80" : "bg-white/25"
          }`}
        >
          <span
            className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white text-[10px] text-slate-700 shadow-sm transition-transform ${
              isDark ? "translate-x-5" : "translate-x-1"
            }`}
          >
            {isDark ? "M" : "S"}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xl shadow-slate-200/50 transition-all duration-300 hover:scale-110 active:scale-95 dark:bg-slate-800 dark:shadow-none dark:ring-1 dark:ring-white/10"
      aria-label="Toggle dark mode"
    >
      <div className="relative h-6 w-6">
        {/* Sun Icon */}
        <svg
          className={`absolute inset-0 h-6 w-6 text-amber-500 transition-all duration-500 ${
            isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.58 5.66l1.42-1.42" />
        </svg>

        {/* Moon Icon */}
        <svg
          className={`absolute inset-0 h-6 w-6 text-brand-400 transition-all duration-500 ${
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      </div>
    </button>
  );
}
