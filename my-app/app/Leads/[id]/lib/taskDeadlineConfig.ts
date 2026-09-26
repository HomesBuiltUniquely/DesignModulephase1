/**
 * Task deadline rules from Milestone_Complete_Time Google Sheet.
 * Durations vary by property configuration (1BHK–5BHK).
 * Source: intakeConfiguration on lead (View → CONFIGURATION field).
 */

import type { PropertyConfigKey } from "./normalizePropertyConfig";
import { formatDurationLabel } from "./parseDuration";

export type TimelineAnchorType =
  | "lead_entered_1020"
  | "d1_mmt_request_sent"
  | "milestone_start"
  | "previous_task_completed"
  | "task_completed";

export type TaskDeadlineRule = {
  milestoneIndex: number;
  taskName: string;
  anchor: TimelineAnchorType;
  /** When anchor is task_completed — which task completion starts the clock */
  anchorTask?: { milestoneIndex: number; taskName: string };
  /** Hours per property configuration from Excel */
  hoursByConfig: Record<PropertyConfigKey, number>;
  /** Optional display override (product-spec rules not in Excel) */
  timelineLabel?: string;
};

function uniformHours(hours: number): Record<PropertyConfigKey, number> {
  return { "1BHK": hours, "2BHK": hours, "3BHK": hours, "4BHK": hours, "5BHK": hours };
}

/** Excel row → app task. Hours parsed from sheet columns D–H (1BHK–5BHK). */
export const TASK_DEADLINE_RULES: TaskDeadlineRule[] = [
  // D1 SITE MEASUREMENT
  {
    milestoneIndex: 0,
    taskName: "Group Description",
    anchor: "milestone_start",
    hoursByConfig: { "1BHK": 12, "2BHK": 12, "3BHK": 12, "4BHK": 12, "5BHK": 12 },
  },
  {
    milestoneIndex: 0,
    taskName: "Mail loop chain 2 initiate",
    anchor: "previous_task_completed",
    hoursByConfig: { "1BHK": 12, "2BHK": 12, "3BHK": 12, "4BHK": 12, "5BHK": 12 },
  },
  {
    milestoneIndex: 0,
    taskName: "D1 for MMT request",
    anchor: "previous_task_completed",
    hoursByConfig: { "1BHK": 48, "2BHK": 48, "3BHK": 48, "4BHK": 48, "5BHK": 48 },
  },
  {
    milestoneIndex: 0,
    taskName: "D1 files upload",
    anchor: "d1_mmt_request_sent",
    hoursByConfig: { "1BHK": 24, "2BHK": 24, "3BHK": 48, "4BHK": 72, "5BHK": 96 },
  },

  // DQC1
  {
    milestoneIndex: 1,
    taskName: "First cut design + quotation discussion meeting request",
    anchor: "milestone_start",
    hoursByConfig: { "1BHK": 24, "2BHK": 48, "3BHK": 48, "4BHK": 48, "5BHK": 72 },
  },
  {
    milestoneIndex: 1,
    taskName: "meeting completed",
    anchor: "task_completed",
    anchorTask: { milestoneIndex: 0, taskName: "D1 files upload" },
    hoursByConfig: uniformHours(48),
    timelineLabel: "48 hrs from D1 documents uploaded",
  },
  {
    milestoneIndex: 1,
    taskName: "DQC 1 submission - dwg + quotation",
    anchor: "previous_task_completed",
    hoursByConfig: { "1BHK": 48, "2BHK": 72, "3BHK": 96, "4BHK": 120, "5BHK": 120 },
  },
  {
    milestoneIndex: 1,
    taskName: "DQC 1 approval",
    anchor: "task_completed",
    anchorTask: { milestoneIndex: 1, taskName: "meeting completed" },
    hoursByConfig: uniformHours(24),
    timelineLabel: "24 hrs from last meeting",
  },

  // 10% PAYMENT
  {
    milestoneIndex: 2,
    taskName: "10% payment collection",
    anchor: "milestone_start",
    hoursByConfig: { "1BHK": 48, "2BHK": 48, "3BHK": 48, "4BHK": 48, "5BHK": 72 },
  },
  {
    milestoneIndex: 2,
    taskName: "10% payment approval",
    anchor: "previous_task_completed",
    hoursByConfig: { "1BHK": 24, "2BHK": 24, "3BHK": 24, "4BHK": 24, "5BHK": 24 },
  },

  // D2 SITE MASKING
  {
    milestoneIndex: 3,
    taskName: "D2 - masking request raise",
    anchor: "milestone_start",
    hoursByConfig: { "1BHK": 24, "2BHK": 48, "3BHK": 48, "4BHK": 72, "5BHK": 72 },
  },
  {
    milestoneIndex: 3,
    taskName: "D2 - files upload",
    anchor: "previous_task_completed",
    hoursByConfig: { "1BHK": 12, "2BHK": 12, "3BHK": 12, "4BHK": 12, "5BHK": 12 },
  },

  // DQC2
  {
    milestoneIndex: 4,
    taskName: "Material selection meeting + quotation discussion",
    anchor: "milestone_start",
    hoursByConfig: { "1BHK": 12, "2BHK": 12, "3BHK": 12, "4BHK": 12, "5BHK": 12 },
  },
  {
    milestoneIndex: 4,
    taskName: "Material selection meeting completed",
    anchor: "task_completed",
    anchorTask: { milestoneIndex: 3, taskName: "D2 - files upload" },
    hoursByConfig: uniformHours(24),
    timelineLabel: "24 hrs from D2 documents uploaded",
  },
  {
    milestoneIndex: 4,
    taskName: "DQC 2 submission",
    anchor: "previous_task_completed",
    hoursByConfig: { "1BHK": 24, "2BHK": 48, "3BHK": 48, "4BHK": 48, "5BHK": 72 },
  },
  {
    milestoneIndex: 4,
    taskName: "DQC 2 approval ",
    anchor: "previous_task_completed",
    hoursByConfig: { "1BHK": 24, "2BHK": 48, "3BHK": 48, "4BHK": 48, "5BHK": 72 },
  },
  {
    milestoneIndex: 4,
    taskName: "Project manager approval",
    anchor: "task_completed",
    anchorTask: { milestoneIndex: 4, taskName: "DQC 2 approval " },
    hoursByConfig: uniformHours(24),
    timelineLabel: "24 hrs from DQC 2 approval",
  },

  // 40% PAYMENT
  {
    milestoneIndex: 5,
    taskName: "Design sign off",
    anchor: "milestone_start",
    hoursByConfig: { "1BHK": 24, "2BHK": 24, "3BHK": 48, "4BHK": 48, "5BHK": 72 },
  },
  {
    milestoneIndex: 5,
    taskName: "meeting completed",
    anchor: "previous_task_completed",
    hoursByConfig: { "1BHK": 8, "2BHK": 8, "3BHK": 8, "4BHK": 8, "5BHK": 8 },
  },
  {
    milestoneIndex: 5,
    taskName: "40% collection",
    anchor: "task_completed",
    anchorTask: { milestoneIndex: 5, taskName: "meeting completed" },
    hoursByConfig: uniformHours(24),
    timelineLabel: "24 hrs from design sign-off meeting completed",
  },
  {
    milestoneIndex: 5,
    taskName: "40% payment approval",
    anchor: "previous_task_completed",
    hoursByConfig: { "1BHK": 8, "2BHK": 8, "3BHK": 8, "4BHK": 8, "5BHK": 8 },
  },

  // PUSH TO PRODUCTION
  {
    milestoneIndex: 6,
    taskName: "Cx approval for production",
    anchor: "milestone_start",
    hoursByConfig: { "1BHK": 8, "2BHK": 8, "3BHK": 8, "4BHK": 8, "5BHK": 8 },
  },
  {
    milestoneIndex: 6,
    taskName: "POC mail",
    anchor: "previous_task_completed",
    hoursByConfig: { "1BHK": 24, "2BHK": 24, "3BHK": 24, "4BHK": 24, "5BHK": 24 },
  },
];

/** KT TRANSFER — from product spec (24 hrs from lead entry to 10–20%). */
export const KT_TRANSFER_RULE: TaskDeadlineRule = {
  milestoneIndex: 7,
  taskName: "Upload KT files",
  anchor: "lead_entered_1020",
  hoursByConfig: uniformHours(24),
  timelineLabel: "24 hrs from lead entry to 10–20%",
};

const ALL_RULES = [...TASK_DEADLINE_RULES, KT_TRANSFER_RULE];

const ruleKey = (milestoneIndex: number, taskName: string) =>
  `${milestoneIndex}::${taskName}`;

const RULES_BY_KEY = new Map(
  ALL_RULES.map((rule) => [ruleKey(rule.milestoneIndex, rule.taskName), rule]),
);

export function getTaskDeadlineRule(
  milestoneIndex: number,
  taskName: string,
): TaskDeadlineRule | undefined {
  return RULES_BY_KEY.get(ruleKey(milestoneIndex, taskName));
}

export function getTaskDeadlineHours(
  rule: TaskDeadlineRule,
  config: PropertyConfigKey,
): number {
  return rule.hoursByConfig[config] ?? rule.hoursByConfig["2BHK"];
}

function describeAnchorContext(rule: TaskDeadlineRule): string {
  if (rule.timelineLabel) return rule.timelineLabel;

  const anchorTaskName = rule.anchorTask?.taskName
    ?.replace(/\s+/g, " ")
    .trim();

  switch (rule.anchor) {
    case "lead_entered_1020":
      return "from lead entry to 10–20%";
    case "d1_mmt_request_sent":
      return "from D1 MMT request sent";
    case "milestone_start":
      return "once this milestone becomes active";
    case "previous_task_completed":
      return "after the previous step is completed";
    case "task_completed":
      return anchorTaskName ? `after ${anchorTaskName}` : "after linked step";
    default:
      return "";
  }
}

/** Human-readable timeline shown on every task row for designers. */
export function getTaskTimelineLabel(
  milestoneIndex: number,
  taskName: string,
  config: PropertyConfigKey,
): string | undefined {
  const rule = getTaskDeadlineRule(milestoneIndex, taskName);
  if (!rule) return undefined;

  if (rule.timelineLabel) {
    return `Complete within ${rule.timelineLabel}`;
  }

  const hours = getTaskDeadlineHours(rule, config);
  const duration = formatDurationLabel(hours);
  const context = describeAnchorContext(rule);
  return context ? `Complete within ${duration} ${context}` : `Complete within ${duration}`;
}

/** Milestone workflow order — used to resolve milestone_start anchor. */
export const MILESTONE_WORKFLOW_ORDER = [7, 0, 1, 2, 3, 4, 5, 6] as const;
