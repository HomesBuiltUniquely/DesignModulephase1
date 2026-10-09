'use client';

import { useEffect, useMemo, useState } from 'react';
import { getApiBase } from '@/app/lib/apiBase';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/auth/AuthContext';
import { extractQuoteIdFromBody } from '@/app/lib/prolanceApiGetQuote';
import { QuoteExperienceView } from '@/app/quote/QuoteExperienceView';
import type { QuoteCategoryDiscountSavePayload } from '@/app/quote/QuoteDiscountDetails';
import {
  buildQuoteDiscountBreakdown,
  resolveTotalDiscount,
  type QuoteDiscountBreakdownRow,
} from '@/app/quote/quoteDiscountBreakdown';
import type { QuoteRoom } from '@/app/quote/quoteTypes';
import { extractLineItemPrice, extractUnitDisplayPrice, mergeQuoteLineItemArrays } from '@/app/quote/quoteLineItems';
import { applyDiscountMetaToLocalPayload } from '@/app/quote/applyQuoteDiscountLocally';

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

function pickCreatedOn(payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  const walk = (obj: unknown): string => {
    if (!obj || typeof obj !== 'object') return '';
    const o = obj as Record<string, unknown>;
    for (const k of ['createdOn', 'createdAt', 'quoteDate']) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    for (const v of Object.values(o)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          const found = walk(item);
          if (found) return found;
        }
      } else if (v && typeof v === 'object') {
        const found = walk(v);
        if (found) return found;
      }
    }
    return '';
  };
  return walk(payload);
}

function formatQuoteDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

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
        : Array.isArray(quoteObj.quoteOptionsData)
          ? (quoteObj.quoteOptionsData as unknown[])
          : Array.isArray(root.quoteOptionsData)
            ? (root.quoteOptionsData as unknown[])
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
      const unitsRaw = mergeQuoteLineItemArrays(
        Array.isArray(r.units) ? (r.units as unknown[]) : [],
        Array.isArray(d.units) ? (d.units as unknown[]) : [],
      );
      const loftsRaw = mergeQuoteLineItemArrays(
        Array.isArray(r.lofts) ? (r.lofts as unknown[]) : [],
        Array.isArray(d.lofts) ? (d.lofts as unknown[]) : [],
      );
      const servicesRaw = mergeQuoteLineItemArrays(
        Array.isArray(r.services) ? (r.services as unknown[]) : [],
        Array.isArray(d.services) ? (d.services as unknown[]) : [],
      );
      return {
        key,
        roomName: asStr(r.roomName),
        optionName: asStr(r.optionName ?? r.roomType),
        totalPrice: asNum(r.totalPrice),
        totalPriceOld: asNum(r.totalPriceOld ?? r.unitsPrice ?? r.woodWorkPrice),
        unitsPrice: asNum(r.unitsPrice ?? r.woodWorkPrice),
        loftsPrice: asNum(r.loftsPrice) ?? asNum(d.loftsPrice),
        servicesPrice: (() => {
          const a = asNum(r.servicesPrice);
          const b = asNum(d.servicesPrice);
          if (a != null && a > 0 && b != null && b > 0) return Math.max(a, b);
          return (a != null && a > 0 ? a : b) ?? a ?? b;
        })(),
        appliancesPrice: asNum(r.appliancesPrice) ?? asNum(d.appliancesPrice),
        skirtingsPrice: asNum(r.skirtingsPrice) ?? asNum(d.skirtingsPrice),
        worktopsPrice: (() => {
          const a = asNum(r.worktopsPrice) ?? asNum(r.worktopPrice);
          const b = asNum(d.worktopsPrice) ?? asNum(d.worktopPrice);
          if (a != null && a > 0 && b != null && b > 0) return Math.max(a, b);
          return (a != null && a > 0 ? a : b) ?? a ?? b;
        })(),
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
            price: extractUnitDisplayPrice(x),
          };
        }),
        lofts: loftsRaw.map((l) => {
          const x = asObj(l);
          return {
            description: asStr(x.description),
            dimensions: asStr(x.dimensions),
            price: extractUnitDisplayPrice(x),
          };
        }),
        servicesList: servicesRaw.map((s) => {
          const x = asObj(s);
          return {
            category: asStr(x.category),
            description: asStr(x.description),
            qty: asNum(x.qty),
            uom: asStr(x.uom),
            price: extractUnitDisplayPrice(x),
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
  const hubCategoryAmount = asNum(pick('hubCategoryDiscountAmount'));
  const hubAdditionalAmount = Math.max(0, asNum(pick('hubAdditionalDiscountAmount')) ?? 0);
  const hubTotalDiscount =
    hubCategoryAmount != null || hubAdditionalAmount > 0
      ? Math.max(0, (hubCategoryAmount ?? 0) + hubAdditionalAmount)
      : null;
  const disc = (hubTotalDiscount != null ? hubTotalDiscount : discount) || 0;

  let interiorProjectAmount: number | null;
  let totalPayableAmount: number | null;

  if (rooms.length > 0 && sumRoomTotals > 0) {
    interiorProjectAmount = sumRoomTotals;
    const tolerance = Math.max(500, sumRoomTotals * 0.02);
    const apiPayable = pickedPayable;
    const apiPlausible =
      hubTotalDiscount == null &&
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
    totalPayableAmount =
      hubTotalDiscount != null && interiorProjectAmount != null
        ? Math.max(0, interiorProjectAmount + (pickedFeesExplicit ?? 0) - hubTotalDiscount)
        : pickedPayable ?? pickedTotalPrice ?? interiorProjectAmount;
  } else {
    interiorProjectAmount =
      pickedInterior ?? pickedTotalPrice ?? (sumRoomTotals > 0 ? sumRoomTotals : null);
    totalPayableAmount =
      hubTotalDiscount != null && interiorProjectAmount != null
        ? Math.max(0, interiorProjectAmount + (pickedFeesExplicit ?? 0) - hubTotalDiscount)
        : pickedPayable ?? pickedTotalPrice ?? (sumRoomTotals > 0 ? sumRoomTotals : null);
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

type QuoteVersionRow = { quoteId: number; createdAt: string; createdBy?: string };

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
  const { sessionId, user } = useAuth();
  const isInternalMode = searchParams.get('internal') === '1';
  const leadIdParam = searchParams.get('leadId');
  const leadIdNum = leadIdParam && /^\d+$/.test(leadIdParam) ? Number(leadIdParam) : null;

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
  const [metaDraft, setMetaDraft] = useState<Record<string, string>>({});
  const [productTab, setProductTab] = useState<Record<string, string>>({});
  const [quoteVersions, setQuoteVersions] = useState<QuoteVersionRow[]>([]);
  const [quoteVersionsLoading, setQuoteVersionsLoading] = useState(false);
  const [quoteVersionsError, setQuoteVersionsError] = useState<string | null>(null);
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountSaveError, setDiscountSaveError] = useState<string | null>(null);

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
        const res = await fetch(
          `${API}/api/prolance-test/quotes/share/${encodeURIComponent(q)}?live=1`,
          { cache: 'no-store' },
        );
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
            const createdBy =
              o.createdBy != null
                ? String(o.createdBy)
                : o.createdByName != null
                  ? String(o.createdByName)
                  : o.userName != null
                    ? String(o.userName)
                    : o.designerName != null
                      ? String(o.designerName)
                      : undefined;
            return { quoteId: qid, createdAt: ca || new Date().toISOString(), createdBy };
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
    const cu = searchParams.get('crmUser') || searchParams.get('userName');
    if (cu) q.set('crmUser', cu);
    const cr = searchParams.get('crmRole') || searchParams.get('userRole');
    if (cr) q.set('crmRole', cr);
    return `?${q.toString()}`;
  }, [isInternalMode, searchParams]);
  useEffect(() => {
    if (!payload) return;
    const dash = (v: string) => (v === '-' ? '' : v);
    const createdRaw = pickCreatedOn(payload);
    setMetaDraft({
      customerName: dash(quote.customerName),
      refId: dash(quote.refId),
      city: dash(quote.city),
      bhkType: dash(quote.bhkType),
      projectType: dash(quote.projectType),
      projectId: dash(quote.projectId),
      quoteNum: dash(quote.quoteNum),
      date: formatQuoteDate(createdRaw),
    });
  }, [payload, fallbackNormId, quote]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f3ef] text-[#5c5650]">
        Loading quote...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f3ef] p-6 text-[#c1272d]">
        {error}
      </div>
    );
  }

  const customerFirstName =
    (metaDraft.customerName ?? '').trim().split(/\s+/)[0] ||
    (quote.customerName !== '-' ? quote.customerName.split(/\s+/)[0] : '') ||
    'Customer';

  const crmUserParam = (searchParams.get('crmUser') || searchParams.get('userName') || '').trim();
  const crmRoleParam = (searchParams.get('crmRole') || searchParams.get('userRole') || '').trim();

  const crmUserStorage =
    typeof window !== 'undefined'
      ? (
          window.localStorage.getItem('crm_user_name') ||
          window.localStorage.getItem('crm_login_username') ||
          ''
        ).trim()
      : '';
  const crmRoleStorage =
    typeof window !== 'undefined' ? (window.localStorage.getItem('crm_role') || '').trim() : '';

  const effectiveCrmUser = crmUserParam || crmUserStorage;
  const effectiveCrmRole = crmRoleParam || crmRoleStorage;

  const formatRoleLabel = (roleStr: string) => {
    if (!roleStr) return '';
    return roleStr
      .toLowerCase()
      .replace(/^(role_|crm_)/i, '')
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const resolvedRoleLabel = effectiveCrmRole
    ? formatRoleLabel(effectiveCrmRole)
    : user?.role
      ? formatRoleLabel(user.role)
      : '';

  const currentUserName = user?.name
    ? (formatRoleLabel(user.role) ? `${user.name} (${formatRoleLabel(user.role)})` : user.name)
    : effectiveCrmUser
      ? (resolvedRoleLabel ? `${effectiveCrmUser} (${resolvedRoleLabel})` : effectiveCrmUser)
      : isInternalMode
        ? 'CRM User'
        : 'Designer';

  const quoteRole = String(user?.role ?? '').trim().toLowerCase();
  const quoteDesignManager = quoteRole === 'design_manager';
  const discountEditable =
    isInternalMode &&
    leadIdNum != null &&
    leadIdNum > 0 &&
    Boolean(versionFetchId) &&
    Boolean(sessionId) &&
    (quoteRole === 'designer' ||
      quoteDesignManager ||
      quoteRole === 'territorial_design_manager' ||
      quoteRole === 'admin');
  const unrestrictedDiscounts =
    quoteDesignManager ||
    quoteRole === 'territorial_design_manager' ||
    quoteRole === 'admin';

  const handleSaveDiscount = async (savePayload: QuoteCategoryDiscountSavePayload) => {
    if (leadIdNum == null || !versionFetchId) return;
    setDiscountSaving(true);
    setDiscountSaveError(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sessionId) {
        headers['Authorization'] = `Bearer ${sessionId}`;
      }
      const res = await fetch(
        `${API}/api/leads/${leadIdNum}/quotes/${encodeURIComponent(versionFetchId)}/discount`,
        {
          method: 'PATCH',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            categoryPct: savePayload.categoryPct,
            amount: savePayload.amount,
            additionalDiscount: savePayload.additionalDiscount,
            payload: payload ?? undefined,
            createdBy: currentUserName,
          }),
        },
      );
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
            : res.status === 404
              ? 'Discount API not found on server. Deploy the latest backend, then retry.'
              : `Failed to save discount (HTTP ${res.status})`;
        throw new Error(msg);
      }
      const discountMeta =
        body && typeof body === 'object' && (body as Record<string, unknown>).discount
          ? ((body as Record<string, unknown>).discount as Record<string, unknown>)
          : {
              hubCategoryDiscountPct: savePayload.categoryPct,
              hubCategoryDiscountAmount: savePayload.amount,
              hubAdditionalDiscountAmount: savePayload.additionalDiscount,
              hubFlatDiscountPct: 0,
              hubFlatDiscountAmount: 0,
            };
      const serverPayload =
        body && typeof body === 'object' && (body as Record<string, unknown>).payload
          ? ((body as Record<string, unknown>).payload as Record<string, unknown>)
          : null;
      if (serverPayload) {
        setPayload(serverPayload);
      } else if (payload) {
        setPayload(applyDiscountMetaToLocalPayload(payload, discountMeta));
      }

      // Task 5: Every time save discount is clicked, a new revision appears with creator details

      const parseVersionsArray = (rawList: unknown): QuoteVersionRow[] => {
        if (!Array.isArray(rawList)) return [];
        return rawList
          .map((row: unknown) => {
            const o = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
            const qid = asNum(o.quoteId) ?? (versionFetchId ? Number(versionFetchId) : null);
            const ca = o.createdAt != null ? String(o.createdAt) : '';
            if (qid == null || qid < 1) return null;
            const createdBy =
              o.createdBy != null
                ? String(o.createdBy)
                : o.createdByName != null
                  ? String(o.createdByName)
                  : o.userName != null
                    ? String(o.userName)
                    : o.designerName != null
                      ? String(o.designerName)
                      : undefined;
            return { quoteId: qid, createdAt: ca || new Date().toISOString(), createdBy };
          })
          .filter(Boolean) as QuoteVersionRow[];
      };

      // 1. If backend returned updated versions in response:
      const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
      let appliedVersions: QuoteVersionRow[] | null = null;
      if (bodyObj && Array.isArray(bodyObj.versions) && bodyObj.versions.length > 0) {
        const parsed = parseVersionsArray(bodyObj.versions);
        if (parsed.length > 0) {
          if (!parsed[parsed.length - 1].createdBy) {
            parsed[parsed.length - 1].createdBy = currentUserName;
          }
          appliedVersions = parsed;
          setQuoteVersions(parsed);
        }
      }

      // 2. Fetch fresh quote revisions from public endpoint
      if (versionFetchId) {
        (async () => {
          try {
            setQuoteVersionsLoading(true);
            const vRes = await fetch(
              `${API}/api/prolance-test/public/quote-revisions/${encodeURIComponent(versionFetchId)}?t=${Date.now()}`,
              { cache: 'no-store' },
            );
            const vTxt = await vRes.text();
            let vBody: { versions?: unknown; message?: unknown } = {};
            try { vBody = vTxt ? JSON.parse(vTxt) : {}; } catch { vBody = {}; }
            if (vRes.ok && Array.isArray(vBody.versions)) {
              const fetched = parseVersionsArray(vBody.versions);
              if (fetched.length > 0) {
                const prevCount = quoteVersions.length;
                if (fetched.length <= prevCount) {
                  fetched.push({
                    quoteId: Number(versionFetchId),
                    createdAt: new Date().toISOString(),
                    createdBy: currentUserName,
                  });
                } else if (!fetched[fetched.length - 1].createdBy) {
                  fetched[fetched.length - 1].createdBy = currentUserName;
                }
                setQuoteVersions(fetched);
                return;
              }
            }
          } catch {
            // Silently ignore re-fetch errors — existing versions remain visible
          } finally {
            setQuoteVersionsLoading(false);
          }

          if (!appliedVersions) {
            setQuoteVersions((prev) => [
              ...prev,
              {
                quoteId: Number(versionFetchId),
                createdAt: new Date().toISOString(),
                createdBy: currentUserName,
              },
            ]);
          }
        })();
      }
    } catch (e) {
      setDiscountSaveError(e instanceof Error ? e.message : 'Failed to save discount');
    } finally {
      setDiscountSaving(false);
    }
  };

  return (
    <QuoteExperienceView
      quote={quote}
      metaDraft={metaDraft}
      setMetaDraft={setMetaDraft}
      customerFirstName={customerFirstName}
      isInternalMode={isInternalMode}
      customerShareLink={customerShareLink}
      internalShareLink={internalShareLink}
      linkCopiedState={linkCopiedState}
      setLinkCopiedState={setLinkCopiedState}
      summaryTab={summaryTab}
      setSummaryTab={setSummaryTab}
      expanded={expanded}
      setExpanded={setExpanded}
      productTab={productTab}
      setProductTab={setProductTab}
      quoteVersions={quoteVersions}
      quoteVersionsLoading={quoteVersionsLoading}
      quoteVersionsError={quoteVersionsError}
      versionFetchId={versionFetchId}
      internalVersionSuffix={internalVersionSuffix}
      discountEditable={discountEditable}
      unrestrictedDiscounts={unrestrictedDiscounts}
      discountSaving={discountSaving}
      discountSaveError={discountSaveError}
      additionalDiscount={(() => {
        if (!payload || typeof payload !== 'object') return null;
        const root = payload as Record<string, unknown>;
        const data = root.data ?? root.Data;
        const d0 =
          data && typeof data === 'object' && !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : Array.isArray(data) && data[0] && typeof data[0] === 'object'
              ? (data[0] as Record<string, unknown>)
              : null;
        const n =
          asNum(root.hubAdditionalDiscountAmount) ??
          (d0 ? asNum(d0.hubAdditionalDiscountAmount) : null);
        return n;
      })()}
      onSaveDiscount={discountEditable ? handleSaveDiscount : undefined}
    />
  );
}
