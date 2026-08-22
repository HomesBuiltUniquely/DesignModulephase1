/** Human-readable labels for auth roles (TDM = Territory Design Manager). */
const ROLE_LABELS: Record<string, string> = {
  territorial_design_manager: 'Territory Design Manager',
  deputy_general_manager: 'Deputy General Manager',
  design_manager: 'Design Manager',
  senior_project_manager: 'Senior Project Manager',
  project_manager: 'Project Manager',
  escalation_manager: 'Escalation Manager',
  mmt_manager: 'MMT Manager',
  mmt_executive: 'MMT Executive',
  dqc_manager: 'DQC Manager',
  admin: 'Admin',
  designer: 'Designer',
  dqe: 'DQE',
  finance: 'Finance',
};

export function formatUserRoleLabel(role: string | null | undefined): string {
  const key = String(role ?? '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  return key.replace(/_/g, ' ');
}
