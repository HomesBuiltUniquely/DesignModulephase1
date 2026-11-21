import type { LeadshipTypes } from '@/app/Components/Types/Types';

export function toBranchCode(raw?: string | null): string {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return '';
  if (s.includes('HBR')) return 'HBR';
  if (s.includes('JPN') || s.includes('JP NAGAR')) return 'JPN';
  if (s.includes('SJR') || s.includes('SARJAPUR')) return 'SJR';
  return s.slice(0, 3);
}

/**
 * Resolves a project's branch according to the business rule:
 * - A project belongs to a branch according to the branch of its CURRENTLY ASSIGNED DESIGNER.
 * - If unassigned (or no designer branch), use project's own branch field (payload EC) as fallback.
 * - If it has none, returns null (shows only under "All branches").
 */
export function getProjectBranch(
  lead: LeadshipTypes,
  designerBranchMap?: Map<number, string | null> | Record<number, string | null>
): string | null {
  if (lead.assigned_designer_id != null && designerBranchMap) {
    const branchFromMap =
      designerBranchMap instanceof Map
        ? designerBranchMap.get(lead.assigned_designer_id)
        : (designerBranchMap as Record<number, string | null>)[lead.assigned_designer_id];
    if (branchFromMap) {
      return toBranchCode(branchFromMap) || null;
    }
  }

  const desBranch = toBranchCode(lead.designerBranch);
  if (lead.assigned_designer_id && desBranch) {
    return desBranch;
  }
  if (lead.projectBranch) {
    return toBranchCode(lead.projectBranch) || null;
  }
  if (desBranch) return desBranch;
  const ownBranch = toBranchCode(lead.fallbackBranch || lead.experienceCenter || lead.branch);
  return ownBranch || null;
}
