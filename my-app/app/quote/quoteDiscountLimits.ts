/** Design-module quote discount caps by work category. */

export const WOODWORK_MAX_DISCOUNT_PCT = 45;
export const CRM_ELEVATED_WOODWORK_MAX_DISCOUNT_PCT = 45;
export const OTHER_CATEGORY_MAX_DISCOUNT_PCT = 5;

export type DiscountCapProfile = 'standard' | 'crm-elevated' | 'unrestricted';

export type DiscountCategoryKey =
  | 'woodwork'
  | 'accessories'
  | 'constructionHw'
  | 'services'
  | string;

function normalizeCapProfile(profile: DiscountCapProfile | boolean): DiscountCapProfile {
  if (profile === true) return 'unrestricted';
  if (profile === false) return 'standard';
  return profile;
}

export function maxDiscountPctForCategory(
  key: DiscountCategoryKey,
  profile: DiscountCapProfile | boolean = 'standard',
): number {
  if (key === 'constructionHw') return 0;
  const p = normalizeCapProfile(profile);
  if (p === 'unrestricted') return 100;
  if (p === 'crm-elevated' && key === 'woodwork') return CRM_ELEVATED_WOODWORK_MAX_DISCOUNT_PCT;
  return key === 'woodwork' ? WOODWORK_MAX_DISCOUNT_PCT : OTHER_CATEGORY_MAX_DISCOUNT_PCT;
}

export function clampDiscountPctForCategory(
  key: DiscountCategoryKey,
  value: unknown,
  profile: DiscountCapProfile | boolean = 'standard',
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  if (key === 'constructionHw') return 0;
  const max = maxDiscountPctForCategory(key, profile);
  return Math.max(0, Math.min(max, Math.round(n * 100) / 100));
}

export type CategoryDiscountPctMap = {
  woodwork: number;
  accessories: number;
  constructionHw: number;
  services: number;
};

export function emptyCategoryDiscountPct(): CategoryDiscountPctMap {
  return { woodwork: 0, accessories: 0, constructionHw: 0, services: 0 };
}

export function clampCategoryDiscountPctMap(
  input: Partial<Record<string, unknown>> | null | undefined,
): CategoryDiscountPctMap {
  const src = input && typeof input === 'object' ? input : {};
  return {
    woodwork: clampDiscountPctForCategory('woodwork', src.woodwork),
    accessories: clampDiscountPctForCategory('accessories', src.accessories),
    constructionHw: 0,
    services: clampDiscountPctForCategory('services', src.services),
  };
}
