/** Designer career ladder codes stored on users.sub_role. */
export type DesignerSubRoleCode = 'INTERN' | 'JID' | 'ID' | 'SID' | 'PD';

export const DESIGNER_SUB_ROLE_OPTIONS: Array<{ value: DesignerSubRoleCode; label: string }> = [
  { value: 'INTERN', label: 'Intern' },
  { value: 'JID', label: 'Jr Designer' },
  { value: 'ID', label: 'Interior Designer' },
  { value: 'SID', label: 'Senior Interior Designer' },
  { value: 'PD', label: 'Principal Interior Designer' },
];

export function formatDesignerSubRoleLabel(raw?: string | null): string {
  const key = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!key) return 'Unset';
  const match = DESIGNER_SUB_ROLE_OPTIONS.find((o) => o.value === key);
  if (match) return match.label;
  return String(raw).trim();
}
