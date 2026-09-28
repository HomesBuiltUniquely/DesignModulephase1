import { getTaskTimelineLabel } from "../lib/taskDeadlineConfig";
import { normalizePropertyConfig } from "../lib/normalizePropertyConfig";

export function getTaskTimeline(
  _milestoneName: string,
  taskName: string,
  milestoneIndex?: number,
  propertyConfiguration?: string | null,
): string | undefined {
  if (milestoneIndex == null) return undefined;
  const config = normalizePropertyConfig(propertyConfiguration);
  return getTaskTimelineLabel(milestoneIndex, taskName, config);
}
