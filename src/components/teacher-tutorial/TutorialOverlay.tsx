import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { TutorialStep } from "./tutorialSteps";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TutorialOverlayProps = {
  step: TutorialStep;
  stepIndex: number;
  stepCount: number;
  onNext: () => void;
  onExit: () => void;
  onSkipRoster?: () => void;
};

function measureTarget(selector: string | undefined): Rect | null {
  if (!selector) return null;
  const element = document.querySelector(`[data-tutorial="${selector}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export default function TutorialOverlay({
  step,
  stepIndex,
  stepCount,
  onNext,
  onExit,
  onSkipRoster,
}: TutorialOverlayProps) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  const refresh = useCallback(() => {
    const rect = measureTarget(step.target);
    setTargetRect(rect);
    if (!rect) {
      setTooltipStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "24rem",
        width: "calc(100% - 2rem)",
      });
      return;
    }

    const element = document.querySelector(`[data-tutorial="${step.target}"]`);
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" });

    const padding = 8;
    const spotlight = {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };

    const tooltipWidth = Math.min(384, window.innerWidth - 32);
    let top = spotlight.top + spotlight.height + 16;
    let left = spotlight.left;

    if (top + 220 > window.innerHeight) {
      top = Math.max(16, spotlight.top - 220);
    }
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16;
    }
    if (left < 16) left = 16;

    setTooltipStyle({
      top,
      left,
      width: tooltipWidth,
      maxWidth: tooltipWidth,
    });
  }, [step.target]);

  useLayoutEffect(() => {
    refresh();
  }, [refresh, step.id]);

  useEffect(() => {
    const handleResize = () => refresh();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [refresh]);

  const padding = 8;
  const spotlight =
    targetRect &&
    ({
      top: targetRect.top - padding,
      left: targetRect.left - padding,
      width: targetRect.width + padding * 2,
      height: targetRect.height + padding * 2,
    } as Rect);

  const showNext = step.advanceOn === "next" || step.id === "done";
  const isClickStep = step.advanceOn === "clickTarget";

  const dimClass = "fixed bg-slate-900/65";

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none" aria-live="polite">
      {spotlight ? (
        <>
          <div
            className={`${dimClass} pointer-events-auto`}
            style={{ top: 0, left: 0, right: 0, height: spotlight.top }}
          />
          <div
            className={`${dimClass} pointer-events-auto`}
            style={{ top: spotlight.top, left: 0, width: spotlight.left, height: spotlight.height }}
          />
          <div
            className={`${dimClass} pointer-events-auto`}
            style={{
              top: spotlight.top,
              left: spotlight.left + spotlight.width,
              right: 0,
              height: spotlight.height,
            }}
          />
          <div
            className={`${dimClass} pointer-events-auto`}
            style={{ top: spotlight.top + spotlight.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="pointer-events-none fixed rounded-xl ring-2 ring-brand-400 ring-offset-2 ring-offset-transparent"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
            }}
          />
        </>
      ) : (
        <div className={`${dimClass} pointer-events-auto inset-0`} />
      )}

      <div
        className="pointer-events-auto fixed z-[101] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        style={tooltipStyle}
      >
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
          Step {stepIndex + 1} of {stepCount}
        </div>
        <h3 className="mt-2 text-lg font-bold text-slate-900">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-line">{step.body}</p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {showNext && (
            <button type="button" onClick={onNext} className="btn-primary px-5 py-2.5 text-sm">
              {step.id === "done" ? "Finish" : "Next"}
            </button>
          )}
          {isClickStep && (
            <span className="text-sm font-medium text-brand-700">Click the highlighted button</span>
          )}
          {step.showSkipRoster && onSkipRoster && (
            <button
              type="button"
              onClick={onSkipRoster}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              Skip roster
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            Exit tour
          </button>
        </div>
      </div>
    </div>
  );
}
