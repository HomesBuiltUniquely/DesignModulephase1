import type { LeadshipTypes } from '@/app/Components/Types/Types';

export const IN_EXECUTION_BUCKET = 'In Execution';

/** True when the lead is on the PUSH TO PRODUCTION milestone. */
export function isPushToProductionLead(p: LeadshipTypes): boolean {
  if (p.currentMilestoneIndex === 6) return true;
  const name = (p.currentMilestoneName || '').trim().toUpperCase();
  return name === 'PUSH TO PRODUCTION' || name.includes('PUSH TO PRODUCTION');
}

/** IN EXECUTION only when on Push to Production and milestone progress is 100%. */
export function isInExecutionLead(p: LeadshipTypes): boolean {
  const stage = (p.projectStage || '').trim();
  const onPushToProduction =
    isPushToProductionLead(p) ||
    /^in\s*execution$/i.test(stage) ||
    /^push\s*to\s*production$/i.test(stage);
  if (!onPushToProduction) return false;
  return (p.currentMilestoneProgress ?? 0) >= 100;
}

// Phase bucket from project_stage (fallback when milestone not available)
export function getStageBucket(stage: string): string {
  if (!stage) return 'Pre 10%';
  const s = stage.trim();
  if (/^cancelled$/i.test(s)) return 'Cancelled';
  if (s === 'Inactive') return 'Pre 10%';
  if (s === 'Active') return '10-20%';
  if (s === '10-20%') return '10-20%';
  if (s === '20-60%' || s === '20' || s === '20-60') return '20-60%';
  // Stage labels for P2P / execution are not enough alone — progress gate is applied in getPhaseBucket.
  if (/^in\s*execution$/i.test(s) || /^push\s*to\s*production$/i.test(s)) {
    return IN_EXECUTION_BUCKET;
  }
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
  if (milestoneIndex === 0 || milestoneIndex === 7) return 'Pre 10%';
  // Push to Production: In Execution only at 100%; otherwise stay in 20-60%.
  if (milestoneIndex === 6) {
    return (milestoneProgress ?? 0) >= 100 ? IN_EXECUTION_BUCKET : '20-60%';
  }
  if (milestoneIndex === 5 && (milestoneProgress ?? 0) >= 100) return '20-60%';
  if (milestoneIndex >= 1 && milestoneIndex <= 5) return '10-20%';
  return null;
}

/** Single source for phase bucket: prefer milestone-derived phase, else stage */
export function getPhaseBucket(p: LeadshipTypes): string {
  const fromStage = getStageBucket(p.projectStage);
  if (fromStage === 'Cancelled') return 'Cancelled';

  // Push to Production → In Execution only when progress is 100%.
  // Incomplete P2P stays in 20-60% so it still appears under All Projects (10-60%).
  if (isPushToProductionLead(p) || fromStage === IN_EXECUTION_BUCKET) {
    return isInExecutionLead(p) ? IN_EXECUTION_BUCKET : '20-60%';
  }

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
