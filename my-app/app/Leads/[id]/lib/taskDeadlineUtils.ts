import MileStonesArray from "@/app/Components/Types/MileStoneArray";
import { normalizePropertyConfig, type PropertyConfigKey } from "./normalizePropertyConfig";
import { formatDurationLabel } from "./parseDuration";
import {
  getTaskDeadlineHours,
  getTaskDeadlineRule,
  MILESTONE_WORKFLOW_ORDER,
  type TaskDeadlineRule,
  type TimelineAnchorType,
} from "./taskDeadlineConfig";

export type TimelineAnchors = {
  entered1020At?: string | null;
  d1MmtRequestSentAt?: string | null;
};

export type TaskCompletionMap = Record<string, { completedAt: string }>;

export type TaskDeadlineEvaluation = {
  dueAt: Date;
  isOverdue: boolean;
  overdueMessage: string;
  timelineLabel: string;
};

const OVERDUE_MESSAGE =
  "Complete this task — you didn't complete this task within the given timeline.";

const APPROVER_OVERDUE_MESSAGE =
  "This approval is overdue — action required within the SLA.";

/** Tasks completed by another role; clock starts when prerequisite task is done. */
export type ExternalActionTask = {
  milestoneIndex: number;
  taskName: string;
  prerequisiteTaskName: string;
  waitingSubtitle: string;
  overdueSubtitle: string;
};

export const EXTERNAL_ACTION_TASKS: ExternalActionTask[] = [
  {
    milestoneIndex: 0,
    taskName: "D1 files upload",
    prerequisiteTaskName: "D1 for MMT request",
    waitingSubtitle: "Awaiting MMT file upload",
    overdueSubtitle: "Overdue — MMT upload pending",
  },
  {
    milestoneIndex: 1,
    taskName: "DQC 1 approval",
    prerequisiteTaskName: "DQC 1 submission - dwg + quotation",
    waitingSubtitle: "Awaiting DQC 1 approval",
    overdueSubtitle: "Overdue — DQC 1 approval pending",
  },
  {
    milestoneIndex: 2,
    taskName: "10% payment approval",
    prerequisiteTaskName: "10% payment collection",
    waitingSubtitle: "Awaiting finance approval (10%)",
    overdueSubtitle: "Overdue — 10% finance approval pending",
  },
  {
    milestoneIndex: 4,
    taskName: "DQC 2 approval ",
    prerequisiteTaskName: "DQC 2 submission",
    waitingSubtitle: "Awaiting DQC 2 approval",
    overdueSubtitle: "Overdue — DQC 2 approval pending",
  },
  {
    milestoneIndex: 4,
    taskName: "Project manager approval",
    prerequisiteTaskName: "DQC 2 approval ",
    waitingSubtitle: "Awaiting project manager approval",
    overdueSubtitle: "Overdue — PM approval pending",
  },
  {
    milestoneIndex: 5,
    taskName: "40% payment approval",
    prerequisiteTaskName: "40% collection",
    waitingSubtitle: "Awaiting finance approval (40%)",
    overdueSubtitle: "Overdue — 40% finance approval pending",
  },
];

function normalizeTaskName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function getExternalActionTask(
  milestoneIndex: number,
  taskName: string,
): ExternalActionTask | undefined {
  const normalized = normalizeTaskName(taskName);
  return EXTERNAL_ACTION_TASKS.find(
    (row) =>
      row.milestoneIndex === milestoneIndex &&
      normalizeTaskName(row.taskName) === normalized,
  );
}

export function isExternalActionWaiting(
  milestoneIndex: number,
  taskName: string,
  completions: TaskCompletionMap,
  isCompleted: boolean,
): boolean {
  if (isCompleted) return false;
  const def = getExternalActionTask(milestoneIndex, taskName);
  if (!def) return false;
  const prereqKey = taskKey(milestoneIndex, def.prerequisiteTaskName);
  return Boolean(completions[prereqKey]?.completedAt);
}

export function evaluateExternalActionDeadline(
  milestoneIndex: number,
  taskIndex: number,
  taskList: string[],
  propertyConfigRaw: string | null | undefined,
  anchors: TimelineAnchors,
  completions: TaskCompletionMap,
  now: Date = new Date(),
): TaskDeadlineEvaluation | null {
  const taskName = taskList[taskIndex];
  if (!isExternalActionWaiting(milestoneIndex, taskName, completions, false)) {
    return null;
  }
  const evaluation = evaluateTaskDeadline(
    milestoneIndex,
    taskIndex,
    taskList,
    propertyConfigRaw,
    anchors,
    completions,
    false,
    now,
  );
  if (!evaluation) return null;
  return {
    ...evaluation,
    overdueMessage: APPROVER_OVERDUE_MESSAGE,
  };
}

function taskKey(milestoneIndex: number, taskName: string): string {
  return `${milestoneIndex}-${taskName}`;
}

function getPreviousMilestoneIndex(milestoneIndex: number): number | null {
  const idx = MILESTONE_WORKFLOW_ORDER.indexOf(milestoneIndex as (typeof MILESTONE_WORKFLOW_ORDER)[number]);
  if (idx <= 0) return null;
  return MILESTONE_WORKFLOW_ORDER[idx - 1];
}

function getMilestoneDefinition(milestoneIndex: number) {
  return MileStonesArray.MilestonesName.find((m) => m.id === milestoneIndex);
}

function getMilestoneStartAnchorIso(
  milestoneIndex: number,
  anchors: TimelineAnchors,
  completions: TaskCompletionMap,
): string | null {
  if (milestoneIndex === 7) {
    return anchors.entered1020At ?? null;
  }

  const prevMilestoneIndex = getPreviousMilestoneIndex(milestoneIndex);
  if (prevMilestoneIndex == null) {
    return anchors.entered1020At ?? null;
  }

  const prevMilestone = getMilestoneDefinition(prevMilestoneIndex);
  if (!prevMilestone || prevMilestone.taskList.length === 0) {
    return anchors.entered1020At ?? null;
  }

  const lastTaskName = prevMilestone.taskList[prevMilestone.taskList.length - 1];
  const prevKey = taskKey(prevMilestoneIndex, lastTaskName);
  return completions[prevKey]?.completedAt ?? null;
}

function resolveAnchorIso(
  rule: TaskDeadlineRule,
  taskIndex: number,
  taskList: string[],
  anchors: TimelineAnchors,
  completions: TaskCompletionMap,
): string | null {
  const { anchor, milestoneIndex, anchorTask } = rule;

  if (anchor === "lead_entered_1020") {
    return anchors.entered1020At ?? null;
  }
  if (anchor === "d1_mmt_request_sent") {
    return anchors.d1MmtRequestSentAt ?? null;
  }
  if (anchor === "milestone_start") {
    return getMilestoneStartAnchorIso(milestoneIndex, anchors, completions);
  }
  if (anchor === "task_completed" && anchorTask) {
    const refKey = taskKey(anchorTask.milestoneIndex, anchorTask.taskName);
    return completions[refKey]?.completedAt ?? null;
  }
  if (anchor === "previous_task_completed") {
    if (taskIndex <= 0) {
      return getMilestoneStartAnchorIso(milestoneIndex, anchors, completions);
    }
    const prevTaskName = taskList[taskIndex - 1];
    const prevKey = taskKey(milestoneIndex, prevTaskName);
    return completions[prevKey]?.completedAt ?? null;
  }
  return null;
}

export function evaluateTaskDeadline(
  milestoneIndex: number,
  taskIndex: number,
  taskList: string[],
  propertyConfigRaw: string | null | undefined,
  anchors: TimelineAnchors,
  completions: TaskCompletionMap,
  isCompleted: boolean,
  now: Date = new Date(),
): TaskDeadlineEvaluation | null {
  const taskName = taskList[taskIndex];
  const rule = getTaskDeadlineRule(milestoneIndex, taskName);
  if (!rule) return null;

  const config = normalizePropertyConfig(propertyConfigRaw);
  const hours = getTaskDeadlineHours(rule, config);
  const anchorIso = resolveAnchorIso(rule, taskIndex, taskList, anchors, completions);
  if (!anchorIso) return null;

  const anchorMs = Date.parse(anchorIso);
  if (!Number.isFinite(anchorMs)) return null;

  const dueAt = new Date(anchorMs + hours * 60 * 60 * 1000);

  // Cumulative SLA hours up to this task from milestone start
  const milestoneStartIso = getMilestoneStartAnchorIso(milestoneIndex, anchors, completions);
  const milestoneStartMs = milestoneStartIso ? Date.parse(milestoneStartIso) : NaN;
  const milestoneTotalHours = getMilestoneTotalHours(milestoneIndex, propertyConfigRaw);
  const milestoneDueAtMs =
    Number.isFinite(milestoneStartMs) && milestoneTotalHours > 0
      ? milestoneStartMs + milestoneTotalHours * 60 * 60 * 1000
      : NaN;

  let cumulativeHours = 0;
  for (let i = 0; i <= taskIndex; i++) {
    const r = getTaskDeadlineRule(milestoneIndex, taskList[i]);
    if (r) cumulativeHours += getTaskDeadlineHours(r, config);
  }
  const cumulativeDueAtMs =
    Number.isFinite(milestoneStartMs) && cumulativeHours > 0
      ? milestoneStartMs + cumulativeHours * 60 * 60 * 1000
      : NaN;

  let isOverdue = false;
  let overdueMessage = OVERDUE_MESSAGE;

  if (isCompleted) {
    const key = taskKey(milestoneIndex, taskName);
    const completedAtIso = completions[key]?.completedAt;
    const completedMs = completedAtIso ? Date.parse(completedAtIso) : NaN;
    if (Number.isFinite(completedMs)) {
      const taskOverdue = completedMs > dueAt.getTime();
      const milestoneOverdue =
        (Number.isFinite(cumulativeDueAtMs) && completedMs > cumulativeDueAtMs) ||
        (Number.isFinite(milestoneDueAtMs) && completedMs > milestoneDueAtMs);
      isOverdue = taskOverdue || milestoneOverdue;
    } else {
      isOverdue = false;
    }
    overdueMessage = "Completed overdue — this task or milestone was not completed within the given timeline.";
  } else {
    const taskOverdue = now.getTime() > dueAt.getTime();
    const milestoneOverdue =
      (Number.isFinite(cumulativeDueAtMs) && now.getTime() > cumulativeDueAtMs) ||
      (Number.isFinite(milestoneDueAtMs) && now.getTime() > milestoneDueAtMs);
    isOverdue = taskOverdue || milestoneOverdue;
  }

  return {
    dueAt,
    isOverdue,
    overdueMessage,
    timelineLabel: rule.timelineLabel ?? formatDurationLabel(hours),
  };
}

export function getNormalizedPropertyConfig(
  raw: string | null | undefined,
): PropertyConfigKey {
  return normalizePropertyConfig(raw);
}

export function formatTaskDueBy(dueAt: Date): string {
  return dueAt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatShortDate(d: Date): string {
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  return `${month} ${day}`;
}

export function buildTaskCompletionMap(
  items: Array<{ milestoneIndex: number; taskName: string; completedAt?: string }>,
): TaskCompletionMap {
  const map: TaskCompletionMap = {};
  for (const item of items) {
    const key = taskKey(item.milestoneIndex, item.taskName);
    map[key] = { completedAt: item.completedAt ?? new Date().toISOString() };
  }
  return map;
}

export function getMilestoneTotalHours(
  milestoneIndex: number,
  propertyConfigRaw: string | null | undefined,
): number {
  const milestone = getMilestoneDefinition(milestoneIndex);
  if (!milestone) return 0;
  const config = normalizePropertyConfig(propertyConfigRaw);
  return milestone.taskList.reduce((sum, taskName) => {
    const rule = getTaskDeadlineRule(milestoneIndex, taskName);
    return sum + (rule ? getTaskDeadlineHours(rule, config) : 0);
  }, 0);
}

/** Milestone header date range: start when milestone opens → end after total task SLA hours. */
export function getMilestoneDateRangeLabel(
  milestoneIndex: number,
  propertyConfigRaw: string | null | undefined,
  anchors: TimelineAnchors,
  completions: TaskCompletionMap,
): string {
  const startIso = getMilestoneStartAnchorIso(milestoneIndex, anchors, completions);
  if (!startIso) return "TBD";

  const startMs = Date.parse(startIso);
  if (!Number.isFinite(startMs)) return "TBD";

  const totalHours = getMilestoneTotalHours(milestoneIndex, propertyConfigRaw);
  if (totalHours <= 0) return "TBD";

  const endMs = startMs + totalHours * 60 * 60 * 1000;
  return `${formatShortDate(new Date(startMs))} - ${formatShortDate(new Date(endMs))}`;
}

export function isExternalApprovalOverdue(
  milestoneIndex: number,
  taskName: string,
  taskList: string[],
  propertyConfigRaw: string | null | undefined,
  anchors: TimelineAnchors,
  completions: TaskCompletionMap,
  now: Date = new Date(),
): boolean {
  const taskIndex = taskList.findIndex((t) => normalizeTaskName(t) === normalizeTaskName(taskName));
  if (taskIndex < 0) return false;
  const evaluation = evaluateExternalActionDeadline(
    milestoneIndex,
    taskIndex,
    taskList,
    propertyConfigRaw,
    anchors,
    completions,
    now,
  );
  return Boolean(evaluation?.isOverdue);
}

/** True when any incomplete task is past its configured deadline. */
export function isLeadDelayed(
  propertyConfigRaw: string | null | undefined,
  anchors: TimelineAnchors,
  completions: TaskCompletionMap,
  now: Date = new Date(),
): boolean {
  for (const milestone of MileStonesArray.MilestonesName) {
    const taskList = milestone.taskList;
    for (let taskIndex = 0; taskIndex < taskList.length; taskIndex += 1) {
      const key = taskKey(milestone.id, taskList[taskIndex]);
      const isCompleted = Boolean(completions[key]);
      if (isCompleted) continue;
      if (isExternalActionWaiting(milestone.id, taskList[taskIndex], completions, isCompleted)) {
        const extEval = evaluateExternalActionDeadline(
          milestone.id,
          taskIndex,
          taskList,
          propertyConfigRaw,
          anchors,
          completions,
          now,
        );
        if (extEval?.isOverdue) return true;
      }
      const evaluation = evaluateTaskDeadline(
        milestone.id,
        taskIndex,
        taskList,
        propertyConfigRaw,
        anchors,
        completions,
        isCompleted,
        now,
      );
      if (evaluation?.isOverdue) return true;
    }
  }
  return false;
}
