/** Branch options for user creation/registration dropdown */
export const BRANCH_OPTIONS = ['HBR', 'SJR', 'JPN'] as const;
export type Branch = (typeof BRANCH_OPTIONS)[number];

export type BranchLocation = {
  code: Branch;
  label: string;
  address: string;
  mapsUrl: string;
};

/** Experience Center physical locations (maps + invite address text). */
export const BRANCH_LOCATIONS: Record<Branch, BranchLocation> = {
  HBR: {
    code: 'HBR',
    label: 'HBR Layout',
    address:
      '1st Floor, 6th Cross Rd, 1st Stage, HBR Layout 4th Block, HBR Layout, Bengaluru, Karnataka 560044',
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=HUB+Interior+HBR+Layout+Bengaluru+560044',
  },
  SJR: {
    code: 'SJR',
    label: 'Sarjapur',
    address:
      'First Floor, No 7,8, JNR Complex, Sarjapur - Marathahalli Rd, Sulikunte, Bengaluru, Karnataka 562125',
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=HUB+Interior+Sarjapur+JNR+Complex+Sulikunte+Bengaluru+562125',
  },
  JPN: {
    code: 'JPN',
    label: 'JP Nagar',
    address:
      'Safa Heights, 2, Dr Puneeth Rajkumar Rd, JP Nagar 4th Phase, Dollar Layout, Bengaluru, Karnataka 560078',
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=HUB+Interior+JP+Nagar+Safa+Heights+Bengaluru+560078',
  },
};

/** Map free-text EC / branch values (HBR, SJR, JPN, aliases) to a known branch. */
export function resolveBranchCode(value: string | null | undefined): Branch | null {
  const raw = (value || '').trim().toLowerCase();
  if (!raw || raw === 'experience center' || raw === 'experience centre') return null;
  if (raw === 'hbr' || raw.includes('hbr')) return 'HBR';
  if (raw === 'sjr' || raw.includes('sarjapur') || raw.includes('sjr')) return 'SJR';
  if (raw === 'jpn' || raw.includes('jp nagar') || raw.includes('j.p') || raw.includes('jpn')) {
    return 'JPN';
  }
  return null;
}

export function getBranchLocation(value: string | null | undefined): BranchLocation | null {
  const code = resolveBranchCode(value);
  return code ? BRANCH_LOCATIONS[code] : null;
}

/** Display label for invites/UI, e.g. "HBR" or fallback text. */
export function formatBranchDisplayName(value: string | null | undefined): string {
  const loc = getBranchLocation(value);
  if (loc) return loc.code;
  const trimmed = (value || '').trim();
  return trimmed || 'Experience Center';
}

/** Google Calendar / email location string with address when known. */
export function formatBranchLocationText(value: string | null | undefined): string {
  const loc = getBranchLocation(value);
  if (loc) return `HUB Interior ${loc.label} Experience Center, ${loc.address}`;
  const name = formatBranchDisplayName(value);
  return `HUB Interior ${name} Experience Center`;
}

/** Sales Closure Constants */
export const PROJECT_STATUS = "SUBMITTED" as const;
