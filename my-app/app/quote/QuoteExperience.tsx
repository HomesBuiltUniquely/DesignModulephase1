'use client';

import { useEffect, useMemo, useState } from 'react';
import { getApiBase } from '@/app/lib/apiBase';
import { useSearchParams } from 'next/navigation';
import { extractQuoteIdFromBody } from '@/app/lib/prolanceApiGetQuote';
import { QuoteTermsAndConditions } from '@/app/quote/hubQuoteTermsPanel';
import {
  buildQuoteDiscountBreakdown,
  resolveTotalDiscount,
  type QuoteDiscountBreakdownRow,
} from '@/app/quote/quoteDiscountBreakdown';
import { QuoteDiscountDetails } from '@/app/quote/QuoteDiscountDetails';

const API = getApiBase();

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asStr(v: unknown): string {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '-';
}

function money(v: unknown): string {
  const n = asNum(v);
  if (n == null) return '-';
  return `Rs ${n.toLocaleString('en-IN')}`;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function deepFindByKeys(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return null;
  const root = obj as Record<string, unknown>;
  for (const key of keys) {
    if (root[key] != null) return root[key];
  }
  for (const value of Object.values(root)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = deepFindByKeys(item, keys);
        if (found != null) return found;
      }
    } else if (value && typeof value === 'object') {
      const found = deepFindByKeys(value, keys);
      if (found != null) return found;
    }
  }
  return null;
}

type QuoteRoom = {
  key: string;
  roomName: string;
  optionName: string;
  totalPrice: number | null;
  totalPriceOld: number | null;
  unitsPrice: number | null;
  loftsPrice: number | null;
  servicesPrice: number | null;
  appliancesPrice: number | null;
  skirtingsPrice: number | null;
  worktopsPrice: number | null;
  additionalHWPrice: number | null;
  roomRev: string;
  matlInfo: string;
  units: Array<{ label: string; cabinetClass: string; description: string; dimensions: string; price: number | null }>;
  lofts: Array<{ description: string; dimensions: string; price: number | null }>;
  servicesList: Array<{ category: string; description: string; qty: number | null; uom: string; price: number | null }>;
};

type NormalizedQuote = {
  quotationId: string;
  quoteNum: string;
  customerName: string;
  refId: string;
  city: string;
  bhkType: string;
  projectType: string;
  projectId: string;
  totalPayableAmount: number | null;
  interiorProjectAmount: number | null;
  designAndManagementFees: number | null;
  discount: number | null;
  discountBreakdown: QuoteDiscountBreakdownRow[];
  lineItems: Array<{ roomKey: string; name: string; amount: number | null; discountedAmount: number | null }>;
  rooms: QuoteRoom[];
};

function normalizeQuote(payload: unknown, fallbackQuoteId: string): NormalizedQuote {
  let p: unknown = payload;
  if (typeof p === 'string') {
    try {
      p = p.trim() ? JSON.parse(p) : {};
    } catch {
      p = {};
    }
  }
  if (Array.isArray(p) && p[0] && typeof p[0] === 'object') {
    p = p[0];
  }
  const rootTop = asObj(p);
  const layerRaw = rootTop.data ?? rootTop.Data;
  let root = rootTop;
  if (layerRaw != null && typeof layerRaw === 'object') {
    if (Array.isArray(layerRaw) && layerRaw[0] && typeof layerRaw[0] === 'object') {
      root = asObj(layerRaw[0]);
    } else if (!Array.isArray(layerRaw)) {
      root = asObj(layerRaw);
    }
  }
  const data = asObj(root.data ?? root.Data);
  const quoteObj = Object.keys(data).length ? data : root;

  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (quoteObj[k] != null) return quoteObj[k];
      if (root[k] != null) return root[k];
      if (rootTop[k] != null) return rootTop[k];
    }
    return deepFindByKeys(p, keys);
  };

  const summaryRaw = pick('quoteOptionsData', 'optionDetails', 'roomWiseSummary');
  const summaryRows = Array.isArray(summaryRaw) ? summaryRaw : [];
  const optionDetailsRaw = Array.isArray(quoteObj.optionDetails)
    ? (quoteObj.optionDetails as unknown[])
    : Array.isArray(root.optionDetails)
      ? (root.optionDetails as unknown[])
      : Array.isArray(rootTop.optionDetails)
        ? (rootTop.optionDetails as unknown[])
        : [];

  const detailsMap = new Map<string, Record<string, unknown>>();
  optionDetailsRaw.forEach((r, idx) => {
    const o = asObj(r);
    const key = String(o.optionID ?? o.optionId ?? o.roomID ?? o.roomId ?? idx);
    detailsMap.set(key, o);
  });

  const rooms: QuoteRoom[] = summaryRows
    .map((row, idx) => {
      const r = asObj(row);
      const key = String(r.optionID ?? r.optionId ?? r.roomID ?? r.roomId ?? idx);
      const d = detailsMap.get(key) || {};
      const unitsRaw = Array.isArray(d.units) ? d.units : [];
      const loftsRaw = Array.isArray(d.lofts) ? d.lofts : [];
      const servicesRaw = Array.isArray(d.services) ? d.services : [];
      return {
        key,
        roomName: asStr(r.roomName),
        optionName: asStr(r.optionName ?? r.roomType),
        totalPrice: asNum(r.totalPrice),
        totalPriceOld: asNum(r.totalPriceOld ?? r.unitsPrice ?? r.woodWorkPrice),
        unitsPrice: asNum(r.unitsPrice ?? r.woodWorkPrice),
        loftsPrice: asNum(r.loftsPrice),
        servicesPrice: asNum(r.servicesPrice),
        appliancesPrice: asNum(r.appliancesPrice),
        skirtingsPrice: asNum(r.skirtingsPrice),
        worktopsPrice: asNum(r.worktopsPrice),
        additionalHWPrice: asNum(r.additionalHWPrice),
        roomRev: asStr(d.roomRev),
        matlInfo: asStr(d.matlInfo) === '-' ? '' : asStr(d.matlInfo),
        units: unitsRaw.map((u) => {
          const x = asObj(u);
          return {
            label: asStr(x.label),
            cabinetClass: asStr(x.cabinetClass),
            description: asStr(x.description),
            dimensions: asStr(x.dimensions),
            price: asNum(x.price),
          };
        }),
        lofts: loftsRaw.map((l) => {
          const x = asObj(l);
          return {
            description: asStr(x.description),
            dimensions: asStr(x.dimensions),
            price: asNum(x.price),
          };
        }),
        servicesList: servicesRaw.map((s) => {
          const x = asObj(s);
          return {
            category: asStr(x.category),
            description: asStr(x.description),
            qty: asNum(x.qty),
            uom: asStr(x.uom),
            price: asNum(x.price),
          };
        }),
      };
    })
    .filter((r) => r.roomName !== '-');

  const lineItems = rooms.map((r) => ({
    roomKey: r.key,
    name: r.optionName !== '-' ? r.optionName : r.roomName,
    amount: r.totalPriceOld,
    discountedAmount: r.totalPrice,
  }));

  const sumRoomTotals = rooms.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);
  const pickedPayable = asNum(pick('totalPayableAmount', 'finalTotalPrice', 'finalPrice'));
  const pickedInterior = asNum(pick('interiorProjectAmount', 'projectAmount', 'subTotal'));
  const pickedTotalPrice = asNum(pick('totalPrice'));
  const pickedFeesExplicit = asNum(pick('designAndManagementFees'));
  const discount = asNum(pick('discount', 'discountAmount'));
  const disc = discount || 0;

  let interiorProjectAmount: number | null;
  let totalPayableAmount: number | null;

  if (rooms.length > 0 && sumRoomTotals > 0) {
    interiorProjectAmount = sumRoomTotals;
    const tolerance = Math.max(500, sumRoomTotals * 0.02);
    const apiPayable = pickedPayable;
    const apiPlausible =
      apiPayable != null &&
      apiPayable >= sumRoomTotals - disc - tolerance &&
      (Math.abs(apiPayable - sumRoomTotals) <= tolerance || apiPayable >= sumRoomTotals - disc);
    if (apiPlausible) {
      totalPayableAmount = apiPayable;
    } else {
      const fees = pickedFeesExplicit ?? 0;
      totalPayableAmount = sumRoomTotals + fees - disc;
    }
  } else if (rooms.length > 0) {
    interiorProjectAmount = pickedInterior ?? pickedTotalPrice ?? null;
    totalPayableAmount = pickedPayable ?? pickedTotalPrice ?? interiorProjectAmount;
  } else {
    interiorProjectAmount =
      pickedInterior ?? pickedTotalPrice ?? (sumRoomTotals > 0 ? sumRoomTotals : null);
    totalPayableAmount =
      pickedPayable ?? pickedTotalPrice ?? (sumRoomTotals > 0 ? sumRoomTotals : null);
  }

  const designAndManagementFees =
    totalPayableAmount != null && interiorProjectAmount != null
      ? totalPayableAmount - interiorProjectAmount + disc
      : pickedFeesExplicit;

  const breakdownSource = { ...rootTop, ...root, ...quoteObj };
  const discountBreakdown = buildQuoteDiscountBreakdown(breakdownSource, optionDetailsRaw, summaryRows);
  const resolvedDiscount =
    resolveTotalDiscount(breakdownSource, discountBreakdown, interiorProjectAmount, totalPayableAmount) ??
    discount;

  return {
    quotationId:
      asStr(pick('quotationId', 'quotationID', 'quoteID', 'quoteId')) !== '-'
        ? asStr(pick('quotationId', 'quotationID', 'quoteID', 'quoteId'))
        : fallbackQuoteId,
    quoteNum: asStr(pick('quoteNum', 'quoteNo', 'quotationNum', 'quoteID', 'quoteId')),
    customerName: asStr(pick('customer', 'customerName', 'name')),
    refId: asStr(pick('refId', 'referenceId', 'leadRefId')),
    city: asStr(pick('city', 'projectCity')),
    bhkType: asStr(pick('bhkType', 'BHKType', 'bhk')),
    projectType: asStr(pick('projectType', 'pType', 'type')),
    projectId: asStr(pick('projectID', 'projectId')),
    totalPayableAmount,
    interiorProjectAmount,
    designAndManagementFees,
    discount: resolvedDiscount,
    discountBreakdown,
    lineItems,
    rooms,
  };
}

type QuoteVersionRow = { quoteId: number; createdAt: string };

export type QuoteExperienceProps = {
  quoteId: string;
  /**
   * `undefined` — load via GET /quotes/share/:quoteId.
   * object — render this JSON (session handoff / preview tab).
   * `null` — missing data (show error).
   */
  preloadedPayload?: Record<string, unknown> | null;
};

export function QuoteExperience({ quoteId: quoteIdProp, preloadedPayload }: QuoteExperienceProps) {
  const searchParams = useSearchParams();
  const isInternalMode = searchParams.get('internal') === '1';

  const inlinePayload =
    preloadedPayload != null && typeof preloadedPayload === 'object' ? preloadedPayload : null;

  const [loading, setLoading] = useState(() => preloadedPayload === undefined);
  const [error, setError] = useState<string | null>(() =>
    preloadedPayload === null ? 'Quotation data is missing.' : null,
  );
  const [payload, setPayload] = useState<Record<string, unknown> | null>(() => inlinePayload);
  const [summaryTab, setSummaryTab] = useState<'overall' | 'roomwise' | 'terms'>('overall');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [linkCopiedState, setLinkCopiedState] = useState<'customer' | 'internal' | null>(null);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [metaDraft, setMetaDraft] = useState<Record<string, string>>({});
  const [quoteVersions, setQuoteVersions] = useState<QuoteVersionRow[]>([]);
  const [quoteVersionsLoading, setQuoteVersionsLoading] = useState(false);
  const [quoteVersionsError, setQuoteVersionsError] = useState<string | null>(null);
  const [versionCopyId, setVersionCopyId] = useState<number | null>(null);

  useEffect(() => {
    if (preloadedPayload !== undefined) return;
    let cancelled = false;
    (async () => {
      const q = quoteIdProp.trim();
      if (!q) {
        if (!cancelled) {
          setError('Quote ID is missing.');
          setLoading(false);
        }
        return;
      }
      try {
        if (!cancelled) {
          setLoading(true);
          setError(null);
        }
        const res = await fetch(`${API}/api/prolance-test/quotes/share/${encodeURIComponent(q)}`);
        const txt = await res.text();
        let body: unknown = null;
        try {
          body = txt ? JSON.parse(txt) : null;
        } catch {
          body = txt;
        }
        if (!res.ok) {
          const msg =
            body && typeof body === 'object' && (body as Record<string, unknown>).message
              ? String((body as Record<string, unknown>).message)
              : `Failed to load quote (HTTP ${res.status})`;
          throw new Error(msg);
        }
        if (!cancelled) setPayload((body && typeof body === 'object' ? (body as Record<string, unknown>) : null));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load quote');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteIdProp, preloadedPayload]);

  const fallbackNormId = useMemo(() => {
    const t = quoteIdProp.trim();
    if (t) return t;
    if (payload && typeof payload === 'object') {
      const e = extractQuoteIdFromBody(payload);
      if (e != null && e > 0) return String(Math.trunc(e));
    }
    return 'draft';
  }, [quoteIdProp, payload]);

  const quote = useMemo(() => normalizeQuote(payload, fallbackNormId), [payload, fallbackNormId]);

  /** Match 10–60% `/quote/:id` behavior: seed revisions from route id, else same numeric id the UI shows (normalizeQuote can find ids extractQuoteIdFromBody misses on coerced Pre‑10 payloads). */
  const versionFetchId = useMemo(() => {
    const t = quoteIdProp.trim();
    if (/^\d+$/.test(t) && Number(t) > 0) return t;
    if (payload && typeof payload === 'object') {
      const e = extractQuoteIdFromBody(payload);
      if (e != null && e > 0) return String(Math.trunc(e));
    }
    const shown = String(quote.quotationId ?? '').trim();
    if (/^\d+$/.test(shown) && Number(shown) > 0) return shown;
    return '';
  }, [quoteIdProp, payload, quote.quotationId]);

  useEffect(() => {
    if (!versionFetchId) {
      setQuoteVersions([]);
      setQuoteVersionsError(null);
      setQuoteVersionsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setQuoteVersionsLoading(true);
      setQuoteVersionsError(null);
      try {
        const res = await fetch(
          `${API}/api/prolance-test/public/quote-revisions/${encodeURIComponent(versionFetchId)}`,
        );
        const txt = await res.text();
        let body: { versions?: unknown; message?: unknown } = {};
        try {
          body = txt ? JSON.parse(txt) : {};
        } catch {
          body = {};
        }
        if (!res.ok) {
          throw new Error(
            body && typeof body === 'object' && body.message != null
              ? String(body.message)
              : `Failed to load quote versions (${res.status})`,
          );
        }
        const rawVers = Array.isArray(body.versions) ? body.versions : [];
        const versions: QuoteVersionRow[] = rawVers
          .map((row: unknown) => {
            const o = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
            const qid = asNum(o.quoteId);
            const ca = o.createdAt != null ? String(o.createdAt) : '';
            if (qid == null || qid < 1) return null;
            return { quoteId: qid, createdAt: ca || new Date().toISOString() };
          })
          .filter(Boolean) as QuoteVersionRow[];
        if (!cancelled) setQuoteVersions(versions);
      } catch (e) {
        if (!cancelled) {
          setQuoteVersionsError(e instanceof Error ? e.message : 'Failed to load quote versions');
          setQuoteVersions([]);
        }
      } finally {
        if (!cancelled) setQuoteVersionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [versionFetchId]);

  const customerLinkSlug =
    versionFetchId || (quote.quotationId !== '-' ? quote.quotationId : '');
  const customerShareLink =
    typeof window !== 'undefined' && customerLinkSlug && customerLinkSlug !== 'draft'
      ? `${window.location.origin}/quote/${encodeURIComponent(customerLinkSlug)}`
      : '';
  const internalShareLink = useMemo(() => {
    if (typeof window === 'undefined' || !customerLinkSlug || customerLinkSlug === 'draft') return '';
    const q = new URLSearchParams();
    q.set('internal', '1');
    const lid = searchParams.get('leadId');
    if (lid) q.set('leadId', lid);
    return `${window.location.origin}/quote/${encodeURIComponent(customerLinkSlug)}?${q.toString()}`;
  }, [customerLinkSlug, searchParams]);

  const internalVersionSuffix = useMemo(() => {
    if (!isInternalMode) return '';
    const q = new URLSearchParams();
    q.set('internal', '1');
    const lid = searchParams.get('leadId');
    if (lid) q.set('leadId', lid);
    return `?${q.toString()}`;
  }, [isInternalMode, searchParams]);
  useEffect(() => {
    if (!payload) return;
    const dash = (v: string) => (v === '-' ? '' : v);
    setMetaDraft({
      customerName: dash(quote.customerName),
      refId: dash(quote.refId),
      city: dash(quote.city),
      bhkType: dash(quote.bhkType),
      projectType: dash(quote.projectType),
      projectId: dash(quote.projectId),
      quoteNum: dash(quote.quoteNum),
    });
  }, [payload, fallbackNormId, quote]);

  if (loading) {
    return <div className="min-h-screen bg-[#f5f5f8] p-6 text-gray-700">Loading quote...</div>;
  }
  if (error) {
    return <div className="min-h-screen bg-[#f5f5f8] p-6 text-rose-700">{error}</div>;
  }

  const isDark = themeMode === 'dark';
  const pageBg = isDark ? 'bg-[#161a22]' : 'bg-[#f3f3f5]';
  const panelBg = isDark ? 'bg-[#1e2430] border border-slate-700' : 'bg-white';
  const cardBg = isDark ? 'bg-[#232b39]' : 'bg-white';
  const headingText = isDark ? 'text-slate-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-slate-300' : 'text-gray-500';

  return (
    <div className={`min-h-screen ${pageBg} py-6`}>
      <div
        className={`mx-auto w-full px-3 sm:px-4 max-w-5xl`}
      >
        <div className={`rounded-xl shadow-sm ${panelBg}`}>
          <div className="rounded-t-xl bg-[#282a2f] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xl font-bold text-white">HUBINTERIOR</p>
                <p className="text-[11px] text-gray-300">Quotation View</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!customerShareLink) return;
                    await navigator.clipboard.writeText(customerShareLink);
                    setLinkCopiedState('customer');
                    setTimeout(() => setLinkCopiedState(null), 1600);
                  }}
                  className="rounded-md border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
                >
                  {linkCopiedState === 'customer' ? 'Customer Link Copied' : 'Copy Customer Link'}
                </button>
                {isInternalMode ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!internalShareLink) return;
                      await navigator.clipboard.writeText(internalShareLink);
                      setLinkCopiedState('internal');
                      setTimeout(() => setLinkCopiedState(null), 1600);
                    }}
                    className="rounded-md border border-cyan-400/60 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25"
                  >
                    {linkCopiedState === 'internal' ? 'Internal Link Copied' : 'Copy Internal Link'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))}
                  className="rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                >
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
          <div className={`rounded-2xl p-6 shadow-sm ${cardBg}`}>
            <p className={`text-xs font-semibold tracking-wide ${mutedText}`}>QUOTATION ID : {quote.quotationId}</p>
            <h3 className={`mt-2 text-4xl font-bold ${headingText}`}>
              Hey{' '}
              {(metaDraft.customerName ?? '').trim() ||
                (quote.customerName !== '-' ? quote.customerName : '') ||
                'Customer'}
              , your quotation is ready!
            </h3>
          </div>

          <div className={`rounded-2xl p-4 shadow-sm ${cardBg}`}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {(
                [
                  ['Customer Name', 'customerName'],
                  ['Ref ID', 'refId'],
                  ['City', 'city'],
                  ['BHK Type', 'bhkType'],
                  ['Project Type', 'projectType'],
                  ['Project ID', 'projectId'],
                  ['Quote Number', 'quoteNum'],
                ] as const
              ).map(([label, key]) => (
                <div key={String(label)} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                  <input
                    value={metaDraft[key] ?? ''}
                    onChange={(e) =>
                      setMetaDraft((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    placeholder={`Enter ${String(label).toLowerCase()}`}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-base font-semibold text-gray-900"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-2xl p-4 shadow-sm ${cardBg}`}>
            <p className={`text-3xl font-bold ${headingText}`}>Summary Detail</p>
            <div className="mt-4 grid grid-cols-1 gap-1 rounded-xl border border-gray-200 p-1 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setSummaryTab('overall')}
                className={`rounded-lg py-2 text-sm font-semibold ${summaryTab === 'overall' ? 'bg-rose-500 text-white' : 'text-gray-700'}`}
              >
                Overall Summary
              </button>
              <button
                type="button"
                onClick={() => setSummaryTab('roomwise')}
                className={`rounded-lg py-2 text-sm font-semibold ${summaryTab === 'roomwise' ? 'bg-rose-500 text-white' : 'text-gray-700'}`}
              >
                Room Wise Summary
              </button>
              <button
                type="button"
                onClick={() => setSummaryTab('terms')}
                className={`rounded-lg py-2 text-sm font-semibold ${summaryTab === 'terms' ? 'bg-rose-500 text-white' : 'text-gray-700'}`}
              >
                Terms and Condition
              </button>
            </div>

            {summaryTab === 'terms' ? (
              <QuoteTermsAndConditions isDark={isDark} />
            ) : summaryTab === 'overall' ? (
              <>
                <div className="mt-5 rounded-xl bg-[#efeff2] py-10 text-center">
                  <p className="text-lg font-semibold text-gray-700">
                    Total <span className="text-2xl text-gray-900">{money(quote.totalPayableAmount)}</span>
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-12 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <div className="col-span-8">Name</div>
                  <div className="col-span-4 text-right">Amount</div>
                </div>
                {quote.lineItems.length ? (
                  quote.lineItems.map((item, idx) => (
                    <div key={`${item.name}-${idx}`} className="grid grid-cols-12 items-center border-t border-gray-100 py-4 text-sm">
                      <div className="col-span-8 flex items-center gap-3">
                        <span className="inline-block h-5 w-1 rounded-full bg-violet-400" />
                        <p className="font-semibold text-gray-800">{item.name}</p>
                      </div>
                      <div className="col-span-4 text-right">
                        <p className="font-semibold text-gray-900">
                          {money(item.discountedAmount ?? item.amount)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Quote details are being prepared. Please verify totals below.
                  </div>
                )}

                <div className="mt-5 space-y-3 rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xl font-semibold text-gray-900">Interior Project Amount</p>
                      <p className="text-xs text-gray-500">*Design &amp; Management Fees are not included</p>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">{money(quote.interiorProjectAmount)}</p>
                  </div>
                  <QuoteDiscountDetails
                    rows={quote.discountBreakdown}
                    totalDiscount={quote.discount}
                  />
                  <div className="flex justify-between border-t border-gray-200 pt-3">
                    <div>
                      <p className="text-xl font-bold text-gray-900">Total Payable Amount</p>
                      <p className="text-xs text-gray-500">Inclusive of all taxes &amp; discount</p>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">{money(quote.totalPayableAmount)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-5 space-y-4">
                {quote.rooms.length ? (
                  quote.rooms.map((room) => {
                    const roomTotal = room.totalPrice;
                    const saving =
                      room.totalPriceOld != null && roomTotal != null ? room.totalPriceOld - roomTotal : null;
                    return (
                      <div key={room.key} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-lg font-semibold text-gray-900">{room.roomName}</p>
                            <p className="text-sm text-gray-600">{room.optionName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Room Total</p>
                            <p className="text-xl font-bold text-gray-900">{money(roomTotal)}</p>
                            {room.totalPriceOld != null ? (
                              <p className="text-xs text-rose-400 line-through">{money(room.totalPriceOld)}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                          {[
                            ['Units', room.unitsPrice],
                            ['Lofts', room.loftsPrice],
                            ['Services', room.servicesPrice],
                            ['Appliances', room.appliancesPrice],
                            ['Skirtings', room.skirtingsPrice],
                            ['Worktops', room.worktopsPrice],
                            ['Additional HW', room.additionalHWPrice],
                            ['Savings', saving],
                          ].map(([label, value]) => (
                            <div key={`${room.key}-${label}`} className="rounded-lg bg-gray-50 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                              <p className={`mt-1 text-sm font-semibold ${label === 'Savings' ? 'text-emerald-700' : 'text-gray-900'}`}>
                                {money(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => setExpanded((prev) => ({ ...prev, [room.key]: !prev[room.key] }))}
                            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                          >
                            {expanded[room.key] ? 'Read less' : 'Read more'}
                          </button>
                        </div>
                        {expanded[room.key] ? (
                          <div className="mt-3 space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                            {room.roomRev !== '-' ? (
                              <p className="text-xs text-gray-600">
                                <span className="font-semibold text-gray-800">Room Revision:</span> {room.roomRev}
                              </p>
                            ) : null}
                            {room.matlInfo ? (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Material Info</p>
                                <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-700">{room.matlInfo}</pre>
                              </div>
                            ) : null}
                            {room.units.length ? (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Base Cabinets / Units</p>
                                <div className="mt-2 space-y-2">
                                  {room.units.map((u, idx) => (
                                    <div key={`${u.label}-${idx}`} className="rounded border border-gray-200 bg-white p-2 text-xs">
                                      <p className="font-semibold text-gray-900">
                                        {u.label} - {u.cabinetClass}
                                      </p>
                                      <p className="text-gray-700">{u.description}</p>
                                      <p className="text-gray-600">Size: {u.dimensions}</p>
                                      <p className="font-semibold text-gray-900">Price: {money(u.price)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {room.lofts.length ? (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Lofts</p>
                                <div className="mt-2 space-y-2">
                                  {room.lofts.map((l, idx) => (
                                    <div key={`${l.description}-${idx}`} className="rounded border border-gray-200 bg-white p-2 text-xs">
                                      <p className="font-semibold text-gray-900">{l.description}</p>
                                      <p className="text-gray-600">Size: {l.dimensions}</p>
                                      <p className="font-semibold text-gray-900">Price: {money(l.price)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {room.servicesList.length ? (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Services</p>
                                <div className="mt-2 space-y-2">
                                  {room.servicesList.map((s, idx) => (
                                    <div key={`${s.category}-${idx}`} className="rounded border border-gray-200 bg-white p-2 text-xs">
                                      <p className="font-semibold text-gray-900">{s.category}</p>
                                      <p className="text-gray-700">{s.description}</p>
                                      <p className="text-gray-600">
                                        Qty: {s.qty ?? '-'} {s.uom}
                                      </p>
                                      <p className="font-semibold text-gray-900">Price: {money(s.price)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                    Room-wise summary is not available in this response.
                  </div>
                )}
              </div>
            )}
          </div>

          {quoteVersionsLoading ? (
            <div className={`rounded-2xl p-4 shadow-sm ${cardBg}`}>
              <p className={`text-sm ${mutedText}`}>Loading quotation versions…</p>
            </div>
          ) : null}
          {quoteVersionsError ? (
            <div className={`rounded-2xl border border-amber-200/60 bg-amber-50/90 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40`}>
              <p className="text-sm text-amber-900 dark:text-amber-100">{quoteVersionsError}</p>
            </div>
          ) : null}
          {!quoteVersionsLoading && !quoteVersionsError && quoteVersions.length > 1 ? (
            <div
              className={`overflow-hidden rounded-xl border shadow-xl ${
                isDark ? 'border-slate-600 bg-[#1a1f28]' : 'border-gray-200 bg-white'
              }`}
            >
              <div
                className={`border-b px-4 py-3 ${isDark ? 'border-slate-600' : 'border-gray-100'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={isDark ? 'text-slate-300' : 'text-gray-600'} aria-hidden>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <span className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                    Quotation versions
                  </span>
                </div>
                <p className={`mt-1 text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  Each link is a saved quotation for this project. Open an earlier version anytime.
                </p>
              </div>
              <ul className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap">
                {quoteVersions.map((v, idx) => {
                  const isCurrent = String(v.quoteId) === String(versionFetchId);
                  const href = `/quote/${encodeURIComponent(String(v.quoteId))}${internalVersionSuffix}`;
                  let dateLabel = '';
                  try {
                    dateLabel = v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '';
                  } catch {
                    dateLabel = '';
                  }
                  const customerUrl =
                    typeof window !== 'undefined'
                      ? `${window.location.origin}/quote/${encodeURIComponent(String(v.quoteId))}`
                      : href;
                  return (
                    <li
                      key={`qv-main-${v.quoteId}-${idx}`}
                      className={`flex min-w-[12rem] flex-1 flex-col rounded-lg border px-3 py-3 ${
                        isCurrent
                          ? isDark
                            ? 'border-teal-500/40 bg-teal-950/30'
                            : 'border-teal-200 bg-teal-50/60'
                          : isDark
                            ? 'border-slate-600 bg-slate-900/40'
                            : 'border-gray-100 bg-gray-50/90'
                      }`}
                    >
                      <a
                        href={href}
                        className={`text-base font-semibold underline-offset-2 hover:underline ${
                          isDark ? 'text-slate-100 hover:text-teal-300' : 'text-gray-900 hover:text-teal-800'
                        }`}
                      >
                        V{idx + 1} quotation
                        {isCurrent ? (
                          <span
                            className={`ml-1 text-sm font-normal ${
                              isDark ? 'text-teal-400' : 'text-teal-700'
                            }`}
                          >
                            (this page)
                          </span>
                        ) : null}
                      </a>
                      <p className={`mt-1 text-xs tabular-nums ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        ID {v.quoteId}
                        {dateLabel ? ` · ${dateLabel}` : ''}
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(customerUrl);
                          setVersionCopyId(v.quoteId);
                          setTimeout(() => setVersionCopyId((x) => (x === v.quoteId ? null : x)), 1600);
                        }}
                        className="mt-3 w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
                      >
                        {versionCopyId === v.quoteId ? 'Link copied' : 'Copy link'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

        </div>
        </div>
      </div>
    </div>
  );
}

