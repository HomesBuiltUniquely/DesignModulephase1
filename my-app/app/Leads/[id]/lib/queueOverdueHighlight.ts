import MileStonesArray from "@/app/Components/Types/MileStoneArray";
import {
  buildTaskCompletionMap,
  isExternalApprovalOverdue,
  type TimelineAnchors,
} from "./taskDeadlineUtils";

export type QueueTimelineFields = {
  intakeConfiguration?: string | null;
  timelineAnchors?: TimelineAnchors | null;
  taskCompletions?: Array<{ milestoneIndex: number; taskName: string; completedAt?: string }>;
};

function isQueueExternalApprovalOverdue(
  row: QueueTimelineFields,
  milestoneIndex: number,
  taskName: string,
): boolean {
  const milestone = MileStonesArray.MilestonesName.find((m) => m.id === milestoneIndex);
  if (!milestone) return false;
  const completions = buildTaskCompletionMap(row.taskCompletions ?? []);
  return isExternalApprovalOverdue(
    milestoneIndex,
    taskName,
    milestone.taskList,
    row.intakeConfiguration,
    row.timelineAnchors ?? ({} as TimelineAnchors),
    completions,
  );
}

/** MMT must upload D1 ZIP after designer sends D1 for MMT request. */
export function isMmtD1UploadOverdue(row: QueueTimelineFields): boolean {
  return isQueueExternalApprovalOverdue(row, 0, "D1 files upload");
}

/** Finance 10% approval SLA (after collection). */
export function isFinance10ApprovalOverdue(row: QueueTimelineFields): boolean {
  return isQueueExternalApprovalOverdue(row, 2, "10% payment approval");
}

/** Finance 40% approval SLA (after collection). */
export function isFinance40ApprovalOverdue(row: QueueTimelineFields): boolean {
  return isQueueExternalApprovalOverdue(row, 5, "40% payment approval");
}
