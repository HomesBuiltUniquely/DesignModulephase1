/** Rebuild Hub discount meta from quote revision rows when the live payload has none. */

export type HubDiscountVersionHint = {
  changeSummary?: string;
  discountSnapshot?: unknown;
  updatedValues?: unknown;
};

function asNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return 0;
}

function asObj(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string' && v.trim() && v.trim() !== '[object Object]') {
    try {
      const parsed = JSON.parse(v) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function metaHasDiscount(meta: Record<string, unknown>): boolean {
  if (asNum(meta.hubCategoryDiscountAmount) > 0) return true;
  if (asNum(meta.hubAdditionalDiscountAmount) > 0) return true;
  const pct = meta.hubCategoryDiscountPct;
  if (pct && typeof pct === 'object' && !Array.isArray(pct)) {
    return Object.values(pct as Record<string, unknown>).some((v) => asNum(v) > 0);
  }
  return false;
}

function metaFromDiscountRow(ds: Record<string, unknown>): Record<string, unknown> {
  const nested = ds.hubCategoryDiscountPct;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return {
      hubCategoryDiscountPct: nested,
      hubCategoryDiscountAmount: Math.round(
        asNum(ds.hubCategoryDiscountAmount) || asNum(ds.amount),
      ),
      hubAdditionalDiscountAmount: Math.round(
        asNum(ds.hubAdditionalDiscountAmount) || asNum(ds.additionalDiscount),
      ),
      hubFlatDiscountPct: 0,
      hubFlatDiscountAmount: 0,
    };
  }
  return {
    hubCategoryDiscountPct: {
      woodwork: asNum(ds.woodwork),
      accessories: asNum(ds.accessories),
      constructionHw: asNum(ds.constructionHw),
      services: asNum(ds.services),
    },
    hubCategoryDiscountAmount: Math.round(asNum(ds.amount)),
    hubAdditionalDiscountAmount: Math.round(asNum(ds.additionalDiscount)),
    hubFlatDiscountPct: 0,
    hubFlatDiscountAmount: 0,
  };
}

function metaFromChangeSummary(summary: string): Record<string, unknown> | null {
  const text = summary.trim();
  if (!text || /^no changes$/i.test(text)) return null;
  const pickPct = (label: string): number => {
    const re = new RegExp(`${label}:\\s*[\\d.]+%\\s*->\\s*([\\d.]+)%`, 'i');
    const m = text.match(re);
    return m ? Number(m[1]) : 0;
  };
  const pickAmount = (label: string): number => {
    const re = new RegExp(`${label}:[^;]*->\\s*₹\\s*([\\d,]+)`, 'i');
    const m = text.match(re);
    if (!m) return 0;
    const n = Number(String(m[1]).replace(/,/g, ''));
    return Number.isFinite(n) ? Math.round(n) : 0;
  };
  const meta: Record<string, unknown> = {
    hubCategoryDiscountPct: {
      woodwork: pickPct('Woodwork'),
      accessories: pickPct('Accessories'),
      constructionHw: pickPct('Construction Hardware'),
      services: pickPct('Services'),
    },
    hubCategoryDiscountAmount: pickAmount('Category discount amount'),
    hubAdditionalDiscountAmount: pickAmount('Additional discount'),
    hubFlatDiscountPct: 0,
    hubFlatDiscountAmount: 0,
  };
  return metaHasDiscount(meta) ? meta : null;
}

export function payloadHasHubDiscountFields(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  const hosts: Record<string, unknown>[] = [payload];
  const data = payload.data ?? payload.Data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
      hosts.push(data[0] as Record<string, unknown>);
    } else if (!Array.isArray(data)) {
      hosts.push(data as Record<string, unknown>);
    }
  }
  for (const host of hosts) {
    if (asNum(host.hubCategoryDiscountAmount) > 0) return true;
    if (asNum(host.hubAdditionalDiscountAmount) > 0) return true;
    const pct = host.hubCategoryDiscountPct;
    if (pct && typeof pct === 'object' && !Array.isArray(pct)) {
      if (Object.values(pct as Record<string, unknown>).some((v) => asNum(v) > 0)) return true;
    }
  }
  return false;
}

export function discountMetaFromVersionHints(versions: HubDiscountVersionHint[]): Record<string, unknown> | null {
  for (let i = versions.length - 1; i >= 0; i -= 1) {
    const row = versions[i];
    const ds = asObj(row.discountSnapshot) || asObj(row.updatedValues);
    if (ds) {
      const meta = metaFromDiscountRow(ds);
      if (metaHasDiscount(meta)) return meta;
    }
    if (row.changeSummary) {
      const fromSummary = metaFromChangeSummary(row.changeSummary);
      if (fromSummary) return fromSummary;
    }
  }
  return null;
}
