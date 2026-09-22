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
  if (isCompleted) return null;

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
  const isOverdue = now.getTime() > dueAt.getTime();

  return {
    dueAt,
    isOverdue,
    overdueMessage: OVERDUE_MESSAGE,
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
