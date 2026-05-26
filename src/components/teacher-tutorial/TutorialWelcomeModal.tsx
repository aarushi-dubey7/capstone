type TutorialWelcomeModalProps = {
  teacherName: string;
  onStart: () => void;
  onSkip: () => void;
};

export default function TutorialWelcomeModal({
  teacherName,
  onStart,
  onSkip,
}: TutorialWelcomeModalProps) {
  const firstName = teacherName.trim().split(/\s+/)[0] || "there";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 px-4">
      <div
        className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-welcome-title"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl">
          🎉
        </div>
        <h2 id="tutorial-welcome-title" className="mt-5 text-center text-2xl font-bold text-slate-900">
          Welcome, {firstName}!
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
          Take a quick interactive tour to learn how to use the dashboard and create your first class.
          It only takes a few minutes.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onStart} className="btn-primary flex-1 py-3">
            Start tour
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 rounded-2xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
