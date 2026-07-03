/** Prolance quote line items use inconsistent price field names across endpoints. */

const LINE_ITEM_PRICE_KEYS = [
  'price',
  'unitPrice',
  'netPrice',
  'finalPrice',
  'discountedPrice',
  'totalPrice',
  'amount',
  'payableAmount',
  'grossPrice',
  'priceAfterDiscount',
  'discountedAmount',
  'netAmount',
  'totalAmount',
  'finalAmount',
  'baseAmount',
] as const;

const LINE_ITEM_LIST_PRICE_KEYS = [
  'priceOld',
  'oldPrice',
  'listPrice',
  'basePrice',
  'unitPriceOld',
  'grossPrice',
  'amountOld',
] as const;

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asStr(v: unknown): string {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

export function extractLineItemPrice(o: Record<string, unknown>): number | null {
  for (const key of LINE_ITEM_PRICE_KEYS) {
    const n = asNum(o[key]);
    if (n != null && n > 0) return n;
  }
  return asNum(o.price);
}

/**
 * Prolance BOQ / Excel shows `woodWorkPrice` when it is higher than discounted `price`.
 * When `price` is already the full line total (>= woodwork), keep `price`.
 */
export function extractUnitDisplayPrice(o: Record<string, unknown>): number | null {
  const linePrice = extractLineItemPrice(o);
  const wood = asNum(o.woodWorkPrice);
  const acc = asNum(o.accessoriesPrice) ?? 0;
  const hw = asNum(o.hardwarePrice) ?? 0;

  let listHint: number | null = null;
  for (const key of LINE_ITEM_LIST_PRICE_KEYS) {
    const n = asNum(o[key]);
    if (n != null && n > 0) listHint = listHint == null ? n : Math.max(listHint, n);
  }

  if (wood != null && wood > 0 && linePrice != null && linePrice > 0 && wood > linePrice) {
    return Math.max(wood, listHint ?? 0) || wood;
  }

  if (linePrice != null && linePrice > 0) return linePrice;
  if (listHint != null && listHint > 0) return listHint;
  if (wood != null && wood > 0) return wood + acc + hw;
  return null;
}

function lineMergeKey(o: Record<string, unknown>, idx: number): string {
  const itemId = asStr(o.itemID ?? o.itemId);
  if (itemId) return `item-${itemId}`;
  const label = asStr(o.label);
  const desc = asStr(o.description);
  const dim = asStr(o.dimensions);
  const category = asStr(o.category);
  if (label || desc || dim) return `${label}|${desc}|${dim}|${category}`;
  return `idx-${idx}`;
}

/** Merge two Prolance arrays (units / lofts / services); keep richest price fields from either source. */
export function mergeQuoteLineItemArrays(a: unknown[], b: unknown[]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  const order: string[] = [];

  const add = (arr: unknown[]) => {
    arr.forEach((item, idx) => {
      const o = asObj(item);
      const key = lineMergeKey(o, idx);
      if (!map.has(key)) order.push(key);
      const prev = map.get(key) || {};
      const merged = { ...prev, ...o };
      const display = extractUnitDisplayPrice(merged);
      if (display != null) merged.price = display;
      map.set(key, merged);
    });
  };

  add(Array.isArray(a) ? a : []);
  add(Array.isArray(b) ? b : []);
  return order.map((k) => map.get(k)!).filter(Boolean);
}
