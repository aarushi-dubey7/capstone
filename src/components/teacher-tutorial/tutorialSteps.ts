export type TutorialAdvanceOn = "next" | "clickTarget" | "auto" | "state";

export type TutorialStepId =
  | "summary-cards"
  | "tab-nav"
  | "attendance-panel"
  | "classes-intro"
  | "create-class-btn"
  | "class-form-name"
  | "class-form-subject"
  | "class-form-room"
  | "class-form-block"
  | "class-form-submit"
  | "roster-section"
  | "create-success"
  | "header-settings"
  | "done";

export type TutorialStep = {
  id: TutorialStepId;
  title: string;
  body: string;
  target?: string;
  advanceOn: TutorialAdvanceOn;
  /** For `state` advance: key checked by the dashboard hook */
  stateKey?: "classCreated" | "classSetupFinished";
  showSkipRoster?: boolean;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "summary-cards",
    title: "Your dashboard at a glance",
    body: "These cards show present, absent, excused, unresolved, and tardy counts for the active block.",
    target: "summary-cards",
    advanceOn: "next",
  },
  {
    id: "tab-nav",
    title: "Main sections",
    body: "Use Attendance, Classes, Students, Rooms, and Movement to manage your day.",
    target: "tab-nav",
    advanceOn: "next",
  },
  {
    id: "attendance-panel",
    title: "Take attendance",
    body: "Pick the block, then mark each student present, absent, or excused. You can send unresolved students to the main office.",
    target: "attendance-panel",
    advanceOn: "next",
  },
  {
    id: "classes-intro",
    title: "Create a class",
    body: "Next we'll open the Classes tab so you can add your first class.",
    advanceOn: "auto",
  },
  {
    id: "create-class-btn",
    title: "Start class setup",
    body: "Click Create Class to open the guided setup workspace.",
    target: "create-class-btn",
    advanceOn: "clickTarget",
  },
  {
    id: "class-form-name",
    title: "Class name",
    body: "Enter a name students will recognize, like “Period 3 Social Studies”.",
    target: "class-form-name",
    advanceOn: "next",
  },
  {
    id: "class-form-subject",
    title: "Subject",
    body: "Add the subject for this class, such as Social Studies or Science.",
    target: "class-form-subject",
    advanceOn: "next",
  },
  {
    id: "class-form-room",
    title: "Room",
    body: "Enter the room number where this class meets.",
    target: "class-form-room",
    advanceOn: "next",
  },
  {
    id: "class-form-block",
    title: "Rotation block",
    body: "Choose the block letter that matches your schedule rotation.",
    target: "class-form-block",
    advanceOn: "next",
  },
  {
    id: "class-form-submit",
    title: "Save your class",
    body: "Click Create Class when the details look right. We'll save a real class to your account.",
    target: "class-form-submit",
    advanceOn: "state",
    stateKey: "classCreated",
  },
  {
    id: "roster-section",
    title: "Add students (optional)",
    body: "Upload a roster image, add students manually, or skip for now and finish later.",
    target: "roster-section",
    advanceOn: "state",
    stateKey: "classSetupFinished",
    showSkipRoster: true,
  },
  {
    id: "create-success",
    title: "Class ready",
    body: "Your class is saved. You can edit details, roster, and the day block planner anytime from the Classes tab.",
    target: "create-success",
    advanceOn: "next",
  },
  {
    id: "header-settings",
    title: "Settings & replay",
    body: "Open Settings anytime for rotation, bell schedules, and reminders. You can restart this tutorial from Settings → Platform Tutorial.",
    target: "header-settings",
    advanceOn: "next",
  },
  {
    id: "done",
    title: "You're all set",
    body: "You're ready to use the platform. Take attendance during your next block!",
    advanceOn: "next",
  },
];

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;
