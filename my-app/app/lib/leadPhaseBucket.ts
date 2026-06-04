import type { LeadshipTypes } from '@/app/Components/Types/Types';

// Phase bucket from project_stage (fallback when milestone not available)
export function getStageBucket(stage: string): string {
  if (!stage) return 'Pre 10%';
  const s = stage.trim();
  if (/^cancelled$/i.test(s)) return 'Cancelled';
  if (s === 'Inactive') return 'Pre 10%';
  if (s === 'Active') return '10-20%';
  if (s === '10-20%') return '10-20%';
  if (s === '20-60%' || s === '20' || s === '20-60') return '20-60%';
  if (['SUBMITTED', 'PAYMENT_PENDING', 'D1_ACTIVATED', 'CONDITIONAL_D1', 'Pre 10%'].includes(s)) return 'Pre 10%';
  if (s.startsWith('10') && s.includes('20')) return '10-20%';
  if (s.startsWith('20') || s.includes('60')) return '20-60%';
  return 'Pre 10%';
}

export function getPhaseFromMilestone(
  milestoneIndex: number | undefined,
  milestoneProgress: number | null | undefined,
): string | null {
  if (milestoneIndex === undefined || milestoneIndex < 0) return null;
  if (milestoneIndex === 0) return 'Pre 10%';
  if (milestoneIndex === 6) return '20-60%';
  if (milestoneIndex === 5 && (milestoneProgress ?? 0) >= 100) return '20-60%';
  if (milestoneIndex >= 1 && milestoneIndex <= 5) return '10-20%';
  return null;
}

/** Single source for phase bucket: prefer milestone-derived phase, else stage */
export function getPhaseBucket(p: LeadshipTypes): string {
  const fromStage = getStageBucket(p.projectStage);
  if (fromStage === 'Cancelled') return 'Cancelled';

  const fromMilestone = getPhaseFromMilestone(p.currentMilestoneIndex, p.currentMilestoneProgress);

  if (fromStage === '20-60%') {
    return '20-60%';
  }

  if (fromMilestone === 'Pre 10%' && fromStage !== 'Pre 10%') {
    return fromStage;
  }

  if (fromMilestone !== null) return fromMilestone;
  return fromStage;
}
