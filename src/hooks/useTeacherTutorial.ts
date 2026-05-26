import { useCallback, useState } from "react";
import { TUTORIAL_STEPS, TUTORIAL_STEP_COUNT, type TutorialStepId } from "../components/teacher-tutorial/tutorialSteps";

export type TutorialPhase = "idle" | "welcome" | "active";

const WELCOME_DISMISSED_KEY = "tutorial_welcome_dismissed";

export function isTutorialWelcomeDismissed(): boolean {
  try {
    return sessionStorage.getItem(WELCOME_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissTutorialWelcomeSession(): void {
  try {
    sessionStorage.setItem(WELCOME_DISMISSED_KEY, "1");
  } catch {
    // ignore
  }
}

export function useTeacherTutorial() {
  const [phase, setPhase] = useState<TutorialPhase>("idle");
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = phase === "active" ? TUTORIAL_STEPS[stepIndex] : null;

  const showWelcome = useCallback(() => {
    setPhase("welcome");
  }, []);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setPhase("active");
  }, []);

  const startTourFromSettings = useCallback(() => {
    setStepIndex(0);
    setPhase("active");
  }, []);

  const skipWelcome = useCallback(() => {
    dismissTutorialWelcomeSession();
    setPhase("idle");
    setStepIndex(0);
  }, []);

  const exitTour = useCallback(() => {
    setPhase("idle");
    setStepIndex(0);
  }, []);

  const goToStep = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(index, TUTORIAL_STEP_COUNT - 1)));
  }, []);

  const nextStep = useCallback(() => {
    setStepIndex((current) => {
      if (current >= TUTORIAL_STEP_COUNT - 1) return current;
      return current + 1;
    });
  }, []);

  const goToStepById = useCallback((id: TutorialStepId) => {
    const index = TUTORIAL_STEPS.findIndex((step) => step.id === id);
    if (index >= 0) goToStep(index);
  }, [goToStep]);

  return {
    phase,
    stepIndex,
    currentStep,
    stepCount: TUTORIAL_STEP_COUNT,
    isActive: phase === "active",
    showWelcome,
    startTour,
    startTourFromSettings,
    skipWelcome,
    exitTour,
    nextStep,
    goToStep,
    goToStepById,
  };
}
