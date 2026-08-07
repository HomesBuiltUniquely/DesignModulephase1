/** Design-module quote discount caps by work category. */

export const WOODWORK_MAX_DISCOUNT_PCT = 35;
export const OTHER_CATEGORY_MAX_DISCOUNT_PCT = 5;

export type DiscountCategoryKey =
  | 'woodwork'
  | 'accessories'
  | 'constructionHw'
  | 'services'
  | string;

export function maxDiscountPctForCategory(key: DiscountCategoryKey): number {
  return key === 'woodwork' ? WOODWORK_MAX_DISCOUNT_PCT : OTHER_CATEGORY_MAX_DISCOUNT_PCT;
}

export function clampDiscountPctForCategory(
  key: DiscountCategoryKey,
  value: unknown,
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  const max = maxDiscountPctForCategory(key);
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
    constructionHw: clampDiscountPctForCategory('constructionHw', src.constructionHw),
    services: clampDiscountPctForCategory('services', src.services),
  };
}
