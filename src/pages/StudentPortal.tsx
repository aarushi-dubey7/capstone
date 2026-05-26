import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getStoredStudentId, clearStoredStudentId } from "../hooks/useStudent";

type CheckState = "idle" | "scanning" | "success" | "error";

export default function StudentPortal() {
  const navigate = useNavigate();
  const storedId = getStoredStudentId();

  const student = useQuery(
    api.students.getByStudentId,
    storedId ? { studentId: storedId } : "skip"
  );
  const locations = useQuery(api.locations.list);
  const markPresent = useMutation(api.attendance.markPresent);
  const studentNotifications = useQuery(
    api.studentNotifications.listForStudent,
    student?._id ? { studentId: student._id } : "skip",
  );
  const markStudentNotificationRead = useMutation(api.studentNotifications.markAsRead);

  const [state, setState] = useState<CheckState>("idle");
  const [message, setMessage] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  const unreadNotifications =
    studentNotifications?.filter((notification) => !notification.read) ?? [];

  // Close popover on outside click
  useEffect(() => {
    if (!showInfo) return;
    function handleClick(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showInfo]);

  // Redirect if not registered
  useEffect(() => {
    if (!storedId) navigate("/onboarding");
  }, [storedId, navigate]);

  async function handleCheckIn() {
    if (!student || !locations) return;

    if (!("bluetooth" in navigator)) {
      setState("error");
      setMessage("Web Bluetooth is not available. Make sure you're using Chrome and it's enabled.");
      return;
    }

    try {
      setState("scanning");
      setMessage("Scanning for room beacon…");

      // Known beacon device names from the database
      const knownNames = locations
        .map((loc) => loc.deviceName)
        .filter((n): n is string => !!n);

      let device: BluetoothDevice | null = null;

      // 1. Try previously-granted devices first — no picker, no user gesture needed
      if ("getDevices" in navigator.bluetooth) {
        const granted = await (navigator.bluetooth as unknown as { getDevices(): Promise<BluetoothDevice[]> }).getDevices();
        device = granted.find((d) =>
          knownNames.some((name) => d.name === name)
        ) ?? null;
        if (device) setMessage("Beacon found! Logging attendance…");
      }

      // 2. First-time: show picker filtered to known beacon names so user grants once
      if (!device) {
        const nameFilters: BluetoothLEScanFilter[] = knownNames.map((name) => ({ name }));
        const uuidFilters: BluetoothLEScanFilter[] = locations.map((loc) => ({
          services: [loc.uuid.toLowerCase()],
        }));
        const filters = nameFilters.length > 0 ? nameFilters : uuidFilters;
        device = await navigator.bluetooth.requestDevice(
          filters.length > 0
            ? ({ filters } as RequestDeviceOptions)
            : { acceptAllDevices: true }
        );
        setMessage("Room detected! Logging attendance…");
      }

      // Match device back to a location record
      const matched = locations.find(
        (loc) =>
          (loc.deviceName && device!.name === loc.deviceName) ||
          device!.name?.toLowerCase().includes(loc.roomNumber.toLowerCase()) ||
          device!.name === loc.name
      );

      const locationUuid = matched?.uuid ?? "unknown";
      const locationName = matched?.name ?? device!.name ?? "Unknown Room";

      const result = await markPresent({
        studentId: student._id as Id<"students">,
        locationUuid,
        locationName,
      });

      setState("success");
      setMessage(
        result.isLate
          ? `Checked in to ${locationName} — marked late`
          : `Checked in to ${locationName}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("cancelled") || msg.includes("chosen")) {
        setState("idle");
        setMessage("");
      } else {
        setState("error");
        setMessage(msg);
      }
    }
  }

  if (student === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-brand-200 border-t-brand-700 animate-spin" />
      </div>
    );
  }

  if (student === null) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card text-center max-w-sm w-full">
          <p className="text-slate-600 mb-4">Student account not found.</p>
          <button
            onClick={() => { clearStoredStudentId(); navigate("/onboarding"); }}
            className="btn-primary w-full"
          >
            Register
          </button>
        </div>
      </div>
    );
  }

  const bgColor =
    state === "success" ? "from-emerald-600 to-emerald-500"
    : state === "error"   ? "from-red-600 to-red-500"
    : "from-brand-900 to-brand-700";

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br ${bgColor} transition-all duration-500`}>
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <p className="text-brand-200 text-sm font-medium uppercase tracking-widest">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-3xl font-bold text-white mt-1">Hi, {student.name.split(" ")[0]}</h1>
        </div>

        {unreadNotifications.length > 0 && (
          <div className="space-y-2 text-left">
            {unreadNotifications.map((notification) => (
              <div
                key={notification._id.toString()}
                className="rounded-2xl border border-amber-200/40 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-lg dark:border-amber-400/30 dark:bg-amber-950/80 dark:text-amber-100"
              >
                <p className="font-semibold">
                  {notification.type === "password_changed" ? "Password updated" : "Notice"}
                </p>
                <p className="mt-1 leading-relaxed">{notification.message}</p>
                <button
                  type="button"
                  onClick={() => void markStudentNotificationRead({ id: notification._id })}
                  className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-800 underline hover:text-amber-950 dark:text-amber-200 dark:hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}

        {state === "idle" && (
          <button
            onClick={handleCheckIn}
            className="w-full py-8 rounded-3xl bg-white text-brand-800 text-2xl font-bold shadow-2xl hover:shadow-white/20 active:scale-95 transition-all"
          >
            Tap to Check In
          </button>
        )}

        {state === "scanning" && (
          <div className="w-full py-8 rounded-3xl bg-white/10 backdrop-blur flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
            <p className="text-white font-medium">{message}</p>
          </div>
        )}

        {state === "success" && (
          <div className="w-full space-y-3 rounded-3xl bg-white/20 px-4 py-8 backdrop-blur">
            <div className="flex flex-col items-center gap-3">
              <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-lg font-semibold text-white">{message}</p>
              <p className="text-sm text-white/70">You can leave this tab open or check in again later.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setState("idle");
                setMessage("");
              }}
              className="w-full rounded-2xl bg-white py-4 text-lg font-bold text-brand-800 shadow-lg transition-all hover:shadow-white/20 active:scale-95"
            >
              Check in again
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="w-full py-6 px-4 rounded-3xl bg-white/20 backdrop-blur space-y-3">
            <p className="text-white font-medium">{message}</p>
            <button
              onClick={() => { setState("idle"); setMessage(""); }}
              className="text-white/80 underline text-sm"
            >
              Try again
            </button>
          </div>
        )}

        <button
          onClick={() => navigate("/")}
          className="text-white/50 text-sm hover:text-white/80 transition-colors"
        >
          Back to home
        </button>
      </div>

      {/* ── Floating Account Info FAB ── */}
      <div ref={infoRef} className="fixed bottom-6 right-6 z-50">
        {showInfo && (
          <div className="absolute bottom-16 right-0 w-72 bg-white/10 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl p-5 shadow-2xl animate-fade-in">
            <h3 className="text-white dark:text-slate-100 font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Account
            </h3>
            <div className="space-y-2.5">
              <div>
                <p className="text-white/50 dark:text-slate-400 text-xs font-medium">Name</p>
                <p className="text-white dark:text-slate-100 text-sm font-semibold">{student.name}</p>
              </div>
              <div>
                <p className="text-white/50 dark:text-slate-400 text-xs font-medium">Email</p>
                <p className="text-white dark:text-slate-100 text-sm font-semibold">{student.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-white/50 dark:text-slate-400 text-xs font-medium">Password</p>
                <p className="text-white dark:text-slate-100 text-sm font-semibold font-mono">{student.studentId}</p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowInfo((v) => !v)}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
            showInfo
              ? "bg-white text-brand-800 rotate-45"
              : "bg-white/15 backdrop-blur text-white hover:bg-white/25"
          }`}
          aria-label="View account info"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
