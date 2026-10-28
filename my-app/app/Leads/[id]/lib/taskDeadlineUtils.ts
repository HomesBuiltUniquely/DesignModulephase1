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

export type HoldPeriod = {
  startedAt: string;
  endedAt?: string | null;
};

export type TimelineAnchors = {
  entered1020At?: string | null;
  d1MmtRequestSentAt?: string | null;
  /** Windows when the project clock and XP penalties were paused. An open window has no endedAt. */
  holdPeriods?: HoldPeriod[] | null;
  /** Planned resume instant while a hold is open. Deadlines shift to this date plus the time still left. */
  holdResumeAt?: string | null;
};

function holdOverlapMs(periods: HoldPeriod[] | null | undefined, fromMs: number, toMs: number): number {
  if (!periods?.length || !(toMs > fromMs)) return 0;
  let total = 0;
  for (const period of periods) {
    const start = Date.parse(period.startedAt);
    if (!Number.isFinite(start)) continue;
    const rawEnd = period.endedAt ? Date.parse(period.endedAt) : toMs;
    const end = Number.isFinite(rawEnd) ? rawEnd : toMs;
    const overlapStart = Math.max(start, fromMs);
    const overlapEnd = Math.min(end, toMs);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total;
}

function activeElapsedMs(periods: HoldPeriod[] | null | undefined, fromMs: number, toMs: number): number {
  if (!(toMs > fromMs)) return 0;
  return Math.max(0, toMs - fromMs - holdOverlapMs(periods, fromMs, toMs));
}

function hasOpenHold(periods: HoldPeriod[] | null | undefined): boolean {
  return Boolean(periods?.some((period) => !period.endedAt));
}

/** Calendar time when `slaMs` of working time has passed, skipping hold windows. */
function projectDueMs(anchorMs: number, slaMs: number, anchors: TimelineAnchors, now: Date): number {
  const periods = anchors.holdPeriods ?? [];
  const nowMs = now.getTime();
  const elapsed = activeElapsedMs(periods, anchorMs, nowMs);
  if (elapsed >= slaMs) {
    let lo = anchorMs;
    let hi = Math.max(anchorMs, nowMs);
    for (let i = 0; i < 40 && hi - lo > 1000; i += 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (activeElapsedMs(periods, anchorMs, mid) >= slaMs) hi = mid;
      else lo = mid;
    }
    return hi;
  }
  const remaining = slaMs - elapsed;
  const resumeMs = anchors.holdResumeAt ? Date.parse(anchors.holdResumeAt) : NaN;
  const base = hasOpenHold(periods) && Number.isFinite(resumeMs) && resumeMs > nowMs ? resumeMs : nowMs;
  return base + remaining;
}

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

  const periods = anchors.holdPeriods ?? [];
  const slaMs = hours * 60 * 60 * 1000;
  const dueAt = new Date(projectDueMs(anchorMs, slaMs, anchors, now));

  // Cumulative SLA hours up to this task from milestone start
  const milestoneStartIso = getMilestoneStartAnchorIso(milestoneIndex, anchors, completions);
  const milestoneStartMs = milestoneStartIso ? Date.parse(milestoneStartIso) : NaN;
  const milestoneTotalHours = getMilestoneTotalHours(milestoneIndex, propertyConfigRaw);

  let cumulativeHours = 0;
  for (let i = 0; i <= taskIndex; i++) {
    const r = getTaskDeadlineRule(milestoneIndex, taskList[i]);
    if (r) cumulativeHours += getTaskDeadlineHours(r, config);
  }

  let isOverdue = false;
  let overdueMessage = OVERDUE_MESSAGE;

  const elapsedPast = (fromMs: number, toMs: number, allowedHours: number) =>
    Number.isFinite(fromMs) && allowedHours > 0 && activeElapsedMs(periods, fromMs, toMs) > allowedHours * 60 * 60 * 1000;

  if (isCompleted) {
    const key = taskKey(milestoneIndex, taskName);
    const completedAtIso = completions[key]?.completedAt;
    const completedMs = completedAtIso ? Date.parse(completedAtIso) : NaN;
    if (Number.isFinite(completedMs)) {
      const taskOverdue = activeElapsedMs(periods, anchorMs, completedMs) > slaMs;
      const milestoneOverdue =
        elapsedPast(milestoneStartMs, completedMs, cumulativeHours) ||
        elapsedPast(milestoneStartMs, completedMs, milestoneTotalHours);
      isOverdue = taskOverdue || milestoneOverdue;
    } else {
      isOverdue = false;
    }
    overdueMessage = "Completed overdue — this task or milestone was not completed within the given timeline.";
  } else {
    const nowMs = now.getTime();
    const taskOverdue = activeElapsedMs(periods, anchorMs, nowMs) > slaMs;
    const milestoneOverdue =
      elapsedPast(milestoneStartMs, nowMs, cumulativeHours) ||
      elapsedPast(milestoneStartMs, nowMs, milestoneTotalHours);
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

  const endMs = projectDueMs(startMs, totalHours * 60 * 60 * 1000, anchors, new Date());
  return `${formatShortDate(new Date(startMs))} - ${formatShortDate(new Date(endMs))}`;
}

/** Task row badge tags — OVERDUE = open SLA breach; LATE = finished after SLA. */
export type TaskSlaBadgeTag = "PENDING" | "CURRENT" | "ACTION" | "OVERDUE" | "ON-TIME" | "LATE";

export type CompletedTaskSlaDisplay = {
  tags: readonly TaskSlaBadgeTag[];
  subtitle: string;
  /** Never true for completed rows (no red “act now” UI). */
  isOverdue: false;
};

/** Completed task: ON-TIME vs LATE from evaluateTaskDeadline(..., isCompleted: true). */
export function resolveCompletedTaskSlaDisplay(
  deadline: TaskDeadlineEvaluation | null,
): CompletedTaskSlaDisplay {
  if (deadline?.isOverdue) {
    return {
      tags: ["LATE"],
      subtitle: "Completed late",
      isOverdue: false,
    };
  }
  return {
    tags: ["ON-TIME"],
    subtitle: "Completed",
    isOverdue: false,
  };
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
