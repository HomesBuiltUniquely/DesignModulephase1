export type QuoteDiscountBreakdownRow = {
  key: string;
  label: string;
  /** Price before discount. */
  price: number | null;
  /** Price after discount is applied. */
  discountedPrice: number | null;
  discountPct: number | null;
  discountAmount: number | null;
  factor: number | null;
  /** Always show in UI even when price/discount are zero (granular categories). */
  alwaysShow?: boolean;
};

type GranularCategory = {
  key: string;
  label: string;
  hubPctKey: string;
  quotePriceKeys: string[];
  quoteDiscountKeys: string[];
  quoteFactorKeys: string[];
  roomPrice: (o: Record<string, unknown>) => number;
};

const GRANULAR_CATEGORIES: GranularCategory[] = [
  {
    key: 'woodwork',
    label: 'Woodwork',
    hubPctKey: 'woodwork',
    quotePriceKeys: ['woodWorkPrice'],
    quoteDiscountKeys: ['woodWorkDiscount'],
    quoteFactorKeys: ['woodWorkFactor'],
    // Prolance room `woodWorkPrice` already includes loft woodwork — do not add `loftsPrice` again.
    roomPrice: (o) =>
      asNum(o.woodWorkPrice) ??
      (asNum(o.unitsPrice) ?? 0) + (asNum(o.loftsPrice) ?? 0),
  },
  {
    key: 'accessories',
    label: 'Accessories',
    hubPctKey: 'accessories',
    quotePriceKeys: ['accessoriesPrice'],
    quoteDiscountKeys: ['accessoriesDiscount'],
    quoteFactorKeys: ['accessoriesFactor'],
    roomPrice: (o) => asNum(o.accessoriesPrice) ?? 0,
  },
  {
    key: 'constructionHw',
    label: 'Construction Hardware',
    hubPctKey: 'constructionHw',
    quotePriceKeys: ['consHardwarePrice', 'hardwarePrice', 'additionalHardwarePrice'],
    quoteDiscountKeys: ['consHardwareDiscount', 'hardwareDiscount', 'additionalHardwareDiscount'],
    quoteFactorKeys: ['hardwareFactor'],
    roomPrice: (o) =>
      (asNum(o.consHardwarePrice) ??
        asNum(o.hardwarePrice) ??
        asNum(o.additionalHWPrice) ??
        asNum(o.additionalHardwarePrice) ??
        0),
  },
  {
    key: 'services',
    label: 'Services',
    hubPctKey: 'services',
    quotePriceKeys: ['servicesPrice'],
    quoteDiscountKeys: ['servicesDiscount'],
    quoteFactorKeys: ['servicesFactor'],
    roomPrice: (o) => asNum(o.servicesPrice) ?? 0,
  },
];

type ExtraCategory = {
  key: string;
  label: string;
  quotePriceKeys: string[];
  quoteDiscountKeys: string[];
  quoteFactorKeys: string[];
  optionPriceKeys: string[];
};

const EXTRA_CATEGORIES: ExtraCategory[] = [
  {
    key: 'appliances',
    label: 'Appliances',
    quotePriceKeys: ['appliancesPrice'],
    quoteDiscountKeys: ['appliancesDiscount'],
    quoteFactorKeys: ['appliancesFactor'],
    optionPriceKeys: ['appliancesPrice'],
  },
  {
    key: 'worktops',
    label: 'Worktops',
    quotePriceKeys: ['worktopsPrice', 'worktopPrice'],
    quoteDiscountKeys: ['worktopDiscount', 'worktopsDiscount'],
    quoteFactorKeys: ['worktopFactor'],
    optionPriceKeys: ['worktopsPrice', 'worktopPrice'],
  },
  {
    key: 'decor',
    label: 'Decor',
    quotePriceKeys: ['decorPrice'],
    quoteDiscountKeys: ['decorDiscount'],
    quoteFactorKeys: [],
    optionPriceKeys: ['decorPrice'],
  },
];

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function pickFrom(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const n = asNum(obj[k]);
    if (n != null) return n;
  }
  return null;
}

function readHubCategoryPct(quoteObj: Record<string, unknown>, key: string): number | null {
  const raw = quoteObj.hubCategoryDiscountPct;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return asNum((raw as Record<string, unknown>)[key]);
  }
  return null;
}

function sumRoomPrices(rooms: unknown[], compute: (o: Record<string, unknown>) => number): number | null {
  if (!rooms.length) return null;
  let sum = 0;
  let found = false;
  for (const item of rooms) {
    if (!item || typeof item !== 'object') continue;
    const v = compute(item as Record<string, unknown>);
    sum += v;
    found = true;
  }
  return found ? sum : null;
}

function sumOptionPrices(optionDetails: unknown[], keys: string[]): number | null {
  let sum = 0;
  let found = false;
  for (const item of optionDetails) {
    if (!item || typeof item !== 'object') continue;
    const n = pickFrom(item as Record<string, unknown>, keys);
    if (n != null) {
      sum += n;
      found = true;
    }
  }
  return found ? sum : null;
}

function resolvePrice(
  quoteObj: Record<string, unknown>,
  rooms: unknown[],
  quotePriceKeys: string[],
  roomCompute?: (o: Record<string, unknown>) => number,
  optionPriceKeys?: string[],
): number | null {
  const quotePrice = pickFrom(quoteObj, quotePriceKeys);
  if (quotePrice != null && quotePrice > 0) return quotePrice;

  if (roomCompute) {
    const fromRooms = sumRoomPrices(rooms, roomCompute);
    if (fromRooms != null && fromRooms > 0) return fromRooms;
  }

  if (optionPriceKeys?.length) {
    const fromOptions = sumOptionPrices(rooms, optionPriceKeys);
    if (fromOptions != null && fromOptions > 0) return fromOptions;
  }

  return quotePrice ?? (roomCompute ? sumRoomPrices(rooms, roomCompute) : null);
}

function buildRow(
  cat: {
    key: string;
    label: string;
    quotePriceKeys: string[];
    quoteDiscountKeys: string[];
    quoteFactorKeys: string[];
    hubPctKey?: string;
    roomPrice?: (o: Record<string, unknown>) => number;
    optionPriceKeys?: string[];
  },
  quoteObj: Record<string, unknown>,
  rooms: unknown[],
  alwaysShow = false,
): QuoteDiscountBreakdownRow | null {
  const price = resolvePrice(
    quoteObj,
    rooms,
    cat.quotePriceKeys,
    cat.roomPrice,
    cat.optionPriceKeys,
  );

  const hubPct = cat.hubPctKey ? readHubCategoryPct(quoteObj, cat.hubPctKey) : null;
  const prolancePct = pickFrom(quoteObj, cat.quoteDiscountKeys);
  const factor = pickFrom(quoteObj, cat.quoteFactorKeys);
  const discountPct = hubPct ?? prolancePct ?? null;

  const effectivePct =
    discountPct != null ? discountPct : factor != null && factor > 0 ? factor : null;

  const discountAmount =
    price != null && effectivePct != null && effectivePct > 0
      ? Math.round((price * effectivePct) / 100)
      : null;

  const hasPrice = price != null && price > 0;
  const hasDiscount = effectivePct != null && effectivePct > 0;
  const hasFactor = factor != null && factor > 0 && factor !== effectivePct;

  if (!alwaysShow && !hasPrice && !hasDiscount && !hasFactor) return null;

  const basePrice = price ?? 0;
  const discountedPrice =
    discountAmount != null && discountAmount > 0 ? basePrice - discountAmount : basePrice;

  return {
    key: cat.key,
    label: cat.label,
    price: basePrice,
    discountedPrice,
    discountPct: effectivePct ?? 0,
    discountAmount: discountAmount != null && discountAmount > 0 ? discountAmount : null,
    factor: hasFactor ? factor : null,
    alwaysShow,
  };
}

export function buildQuoteDiscountBreakdown(
  quoteObj: Record<string, unknown>,
  optionDetails: unknown[],
  roomSummaries: unknown[] = [],
): QuoteDiscountBreakdownRow[] {
  const rooms = optionDetails.length > 0 ? optionDetails : roomSummaries;
  const rows: QuoteDiscountBreakdownRow[] = [];

  for (const cat of GRANULAR_CATEGORIES) {
    const row = buildRow(cat, quoteObj, rooms, true);
    if (row) rows.push(row);
  }

  for (const cat of EXTRA_CATEGORIES) {
    const row = buildRow(cat, quoteObj, rooms, false);
    if (row) rows.push(row);
  }

  const flatDiscount = asNum(quoteObj.flatDiscount) ?? asNum(quoteObj.hubFlatDiscountAmount);
  const flatPct = asNum(quoteObj.hubFlatDiscountPct);
  if (flatDiscount != null && flatDiscount > 0) {
    rows.push({
      key: 'flatDiscount',
      label: 'Flat Discount',
      price: null,
      discountedPrice: null,
      discountPct: flatPct ?? null,
      discountAmount: flatDiscount,
      factor: null,
    });
  }

  const additionalDiscount = asNum(quoteObj.hubAdditionalDiscountAmount);
  if (additionalDiscount != null && additionalDiscount > 0) {
    rows.push({
      key: 'additionalDiscount',
      label: 'Additional Discount',
      price: null,
      discountedPrice: null,
      discountPct: null,
      discountAmount: additionalDiscount,
      factor: null,
    });
  }

  return rows;
}

export function sumDiscountBreakdownAmounts(rows: QuoteDiscountBreakdownRow[]): number {
  return rows.reduce((sum, row) => sum + (row.discountAmount ?? 0), 0);
}

export function resolveTotalDiscount(
  quoteObj: Record<string, unknown>,
  breakdownRows: QuoteDiscountBreakdownRow[],
  interiorAmount: number | null,
  payableAmount: number | null,
): number | null {
  const hubCategoryAmount = asNum(quoteObj.hubCategoryDiscountAmount);
  const hubAdditionalAmount = Math.max(0, asNum(quoteObj.hubAdditionalDiscountAmount) ?? 0);
  if (hubCategoryAmount != null || hubAdditionalAmount > 0) {
    return Math.max(0, (hubCategoryAmount ?? 0) + hubAdditionalAmount);
  }

  const fromBreakdown = sumDiscountBreakdownAmounts(breakdownRows);
  if (fromBreakdown > 0) return fromBreakdown;

  const explicit = asNum(quoteObj.discount) ?? asNum(quoteObj.discountAmount);
  if (explicit != null && explicit > 0) return explicit;

  const totalPrice = asNum(quoteObj.totalPrice);
  const finalTotal =
    asNum(quoteObj.finalTotalPrice) ?? asNum(quoteObj.finalPrice) ?? payableAmount;
  if (totalPrice != null && finalTotal != null && totalPrice > finalTotal) {
    return totalPrice - finalTotal;
  }

  if (interiorAmount != null && payableAmount != null && interiorAmount > payableAmount) {
    return interiorAmount - payableAmount;
  }

  return explicit;
}
