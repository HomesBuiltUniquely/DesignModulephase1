import { meetingChecklist } from "./ChecklistArrays/meetingChecklist";
import { designFreezeMeetingChecklist } from "./ChecklistArrays/designFreezeMeetingChecklist";
import { colorSelectionMeetingChecklist } from "./ChecklistArrays/colorSelectionMeetingChecklist";
import { designSignOffMeetingChecklist } from "./ChecklistArrays/designSignOffMeetingChecklist";
import type { ChecklistDefinition, ChecklistKey } from "./types";

type ChecklistRoute = {
  milestoneIndex: number;
  taskName: string;
  key: ChecklistKey;
};

const checklistRoutes: ChecklistRoute[] = [
  {
    milestoneIndex: 1,
    taskName: "First cut design + quotation discussion meeting request",
    key: "first_cut",
  },
  {
    milestoneIndex: 1,
    taskName: "Design finalisation meeting request",
    key: "design_freeze",
  },
  {
    milestoneIndex: 4,
    taskName: "Material selection meeting completed",
    key: "color_selection",
  },
  {
    milestoneIndex: 5,
    taskName: "meeting completed & 40% payment request",
    key: "design_signoff",
  },
];

export const checklistDefinitions: Record<ChecklistKey, ChecklistDefinition> = {
  first_cut: {
    title: "FIRST CUT MEETING – 2 HOUR CONTROL CHECKLIST - online",
    sections: meetingChecklist,
    postUrl: "http://localhost:3001/api/checklist",
    lastUrl: "http://localhost:3001/api/checklist/last",
    successMessage: "Checklist submitted successfully",
    showBreakdownDividerAtIndex: 1,
    breakdownDividerTitle: "MEETING STRUCTURE (2 HOURS BREAKDOWN)",
  },
  design_freeze: {
    title: "DESIGN FREEZE MEETING CHECKLIST - online",
    sections: designFreezeMeetingChecklist,
    postUrl: "http://localhost:3001/api/design-freeze-checklist",
    lastUrl: "http://localhost:3001/api/design-freeze-checklist/last",
    successMessage: "Design Freeze Checklist submitted successfully",
  },
  color_selection: {
    title: "COLOR & MATERIAL SELECTION MEETING CHECKLIST - online",
    sections: colorSelectionMeetingChecklist,
    postUrl: "http://localhost:3001/api/color-selection-checklist",
    lastUrl: "http://localhost:3001/api/color-selection-checklist/last",
    successMessage: "Color Selection Checklist submitted successfully",
  },
  design_signoff: {
    title: "DESIGN SIGN-OFF MEETING CHECKLIST - online",
    sections: designSignOffMeetingChecklist,
    postUrl: "http://localhost:3001/api/design-signoff-checklist",
    lastUrl: "http://localhost:3001/api/design-signoff-checklist/last",
    successMessage: "Design Sign-Off Checklist submitted successfully",
    includeSectionNoteInAnswers: true,
  },
};

export const getChecklistKeyForTask = (
  milestoneIndex: number,
  taskName: string,
): ChecklistKey | null =>
  checklistRoutes.find(
    (route) =>
      route.milestoneIndex === milestoneIndex && route.taskName === taskName,
  )?.key ?? null;

export const hasChecklistForTask = (
  milestoneIndex: number,
  taskName: string,
): boolean => getChecklistKeyForTask(milestoneIndex, taskName) !== null;
