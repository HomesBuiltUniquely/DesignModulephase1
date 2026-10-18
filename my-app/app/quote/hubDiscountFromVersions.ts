/** Rebuild Hub discount meta from quote revision rows when the live payload has none. */

export type HubDiscountVersionHint = {
  quoteId?: number;
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

type AccumPct = {
  woodwork: number;
  accessories: number;
  constructionHw: number;
  services: number;
};

function pickPctIfPresent(text: string, label: string): number | undefined {
  const m = text.match(new RegExp(`${label}:\\s*[\\d.]+%\\s*->\\s*([\\d.]+)%`, 'i'));
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function pickAmountIfPresent(text: string, label: string): number | undefined {
  const m = text.match(new RegExp(`${label}:[^;]*->\\s*₹\\s*([\\d,]+)`, 'i'));
  if (!m) return undefined;
  const n = Number(String(m[1]).replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

function mergeDefinedPct(target: AccumPct, src: Record<string, unknown> | null | undefined): void {
  if (!src) return;
  for (const key of ['woodwork', 'accessories', 'constructionHw', 'services'] as const) {
    if (src[key] == null || src[key] === '') continue;
    const n = asNum(src[key]);
    target[key] = n;
  }
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

/** Fold every revision into one Hub discount (later rows win, missing fields keep earlier values). */
export function discountMetaFromVersionHints(
  versions: HubDiscountVersionHint[],
  quoteId?: string | number | null,
): Record<string, unknown> | null {
  const wanted = quoteId != null && String(quoteId).trim() ? Number(quoteId) : null;
  const rows =
    wanted != null && Number.isFinite(wanted) && wanted > 0
      ? versions.filter((row) => row.quoteId == null || Number(row.quoteId) === wanted)
      : versions;
  const walk = rows.length > 0 ? rows : versions;

  const pct: AccumPct = { woodwork: 0, accessories: 0, constructionHw: 0, services: 0 };
  let amount = 0;
  let additional = 0;
  let any = false;

  for (const row of walk) {
    const ds = asObj(row.discountSnapshot) || asObj(row.updatedValues);
    if (ds) {
      const nested = asObj(ds.hubCategoryDiscountPct);
      mergeDefinedPct(pct, nested ?? ds);
      if (ds.hubCategoryDiscountAmount != null || ds.amount != null) {
        amount = Math.round(asNum(ds.hubCategoryDiscountAmount) || asNum(ds.amount));
      }
      if (ds.hubAdditionalDiscountAmount != null || ds.additionalDiscount != null) {
        additional = Math.round(asNum(ds.hubAdditionalDiscountAmount) || asNum(ds.additionalDiscount));
      }
      any = true;
    }
    const summary = String(row.changeSummary ?? '').trim();
    if (!summary || /^no changes$/i.test(summary)) continue;
    const woodwork = pickPctIfPresent(summary, 'Woodwork');
    const accessories = pickPctIfPresent(summary, 'Accessories');
    const constructionHw = pickPctIfPresent(summary, 'Construction Hardware');
    const services = pickPctIfPresent(summary, 'Services');
    const nextAmount = pickAmountIfPresent(summary, 'Category discount amount');
    const nextAdditional = pickAmountIfPresent(summary, 'Additional discount');
    if (woodwork != null) pct.woodwork = woodwork;
    if (accessories != null) pct.accessories = accessories;
    if (constructionHw != null) pct.constructionHw = constructionHw;
    if (services != null) pct.services = services;
    if (nextAmount != null) amount = nextAmount;
    if (nextAdditional != null) additional = nextAdditional;
    any = true;
  }

  if (!any) return null;
  const meta: Record<string, unknown> = {
    hubCategoryDiscountPct: pct,
    hubCategoryDiscountAmount: amount,
    hubAdditionalDiscountAmount: additional,
    hubFlatDiscountPct: 0,
    hubFlatDiscountAmount: 0,
  };
  return metaHasDiscount(meta) ? meta : null;
}
