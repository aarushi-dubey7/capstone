import { useState, useEffect } from "react";
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

  const [state, setState] = useState<CheckState>("idle");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  // Redirect if not registered
  useEffect(() => {
    if (!storedId) navigate("/onboarding");
  }, [storedId, navigate]);

  // Auto-close after successful check-in
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { window.close(); navigate("/"); return; }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, navigate]);

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

      // Build a filter for each registered location UUID
      const filters: BluetoothLEScanFilter[] = locations.map((loc) => ({
        services: [loc.uuid.toLowerCase()],
      }));

      const device = await navigator.bluetooth.requestDevice(
        filters.length > 0
          ? ({ filters } as RequestDeviceOptions)
          : { acceptAllDevices: true }
      );

      setMessage("Room detected! Logging attendance…");

      // Match device name back to a location record
      const matched = locations.find(
        (loc) =>
          device.name?.toLowerCase().includes(loc.roomNumber.toLowerCase()) ||
          device.name === loc.name
      );

      const locationUuid = matched?.uuid ?? "unknown";
      const locationName = matched?.name ?? device.name ?? "Unknown Room";

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
      setCountdown(4);
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
          <div className="w-full py-8 rounded-3xl bg-white/20 backdrop-blur flex flex-col items-center gap-3">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-white text-lg font-semibold">{message}</p>
            {countdown !== null && (
              <p className="text-white/60 text-sm">Closing in {countdown}…</p>
            )}
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
    </div>
  );
}
