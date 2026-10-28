'use client';

import { useEffect, useMemo, useState } from 'react';
import { getApiBase } from '@/app/lib/apiBase';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/auth/AuthContext';
import { extractQuoteIdFromBody } from '@/app/lib/prolanceApiGetQuote';
import { QuoteExperienceView } from '@/app/quote/QuoteExperienceView';
import type { QuoteCategoryDiscountSavePayload } from '@/app/quote/QuoteDiscountDetails';
import type { DiscountCapProfile } from '@/app/quote/quoteDiscountLimits';
import {
  buildQuoteDiscountBreakdown,
  resolveHubPayableDiscount,
  resolveTotalDiscount,
  type QuoteDiscountBreakdownRow,
} from '@/app/quote/quoteDiscountBreakdown';
import type { QuoteRoom } from '@/app/quote/quoteTypes';
import { extractLineItemPrice, extractUnitDisplayPrice, mergeQuoteLineItemArrays } from '@/app/quote/quoteLineItems';
import { applyDiscountMetaToLocalPayload } from '@/app/quote/applyQuoteDiscountLocally';
import {
  discountMetaFromVersionHints,
  payloadHasExplicitHubDiscountMeta,
  payloadHasHubDiscountFields,
} from '@/app/quote/hubDiscountFromVersions';

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

/** Prolance space name (`roomName`), not `roomType`/`optionName` (those can stay Bedroom on a services space). */
function displayQuoteSpaceName(roomName: string, optionName = '-'): string {
  const room = roomName.trim();
  const option = optionName.trim();
  const raw = room && room !== '-' ? room : option && option !== '-' ? option : '';
  if (!raw) return '-';
  if (/^services?$/i.test(raw)) return 'Services';
  return raw;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function quoteBodyHasRooms(payload: Record<string, unknown> | null | undefined): boolean {
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
    for (const key of ['quoteOptionsData', 'optionDetails', 'roomWiseSummary'] as const) {
      const v = host[key];
      if (Array.isArray(v) && v.length > 0) return true;
    }
  }
  return false;
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
        roomName: displayQuoteSpaceName(asStr(r.roomName), asStr(r.optionName ?? r.roomType)),
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
    name: r.roomName !== '-' ? r.roomName : r.optionName,
    amount: r.totalPriceOld,
    discountedAmount: r.totalPrice,
  }));

  const sumRoomTotals = rooms.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);
  const pickedPayable = asNum(pick('totalPayableAmount', 'finalTotalPrice', 'finalPrice'));
  const pickedInterior = asNum(pick('interiorProjectAmount', 'projectAmount', 'subTotal'));
  const pickedTotalPrice = asNum(pick('totalPrice'));
  const pickedFeesExplicit = asNum(pick('designAndManagementFees'));
  const discount = asNum(pick('discount', 'discountAmount'));
  const breakdownSource = { ...rootTop, ...root, ...quoteObj };
  const discountBreakdown = buildQuoteDiscountBreakdown(breakdownSource, optionDetailsRaw, summaryRows);
  const hubDisc = resolveHubPayableDiscount(breakdownSource, discountBreakdown);
  const disc = hubDisc > 0 ? hubDisc : discount || 0;

  let interiorProjectAmount: number | null;
  let totalPayableAmount: number | null;

  if (rooms.length > 0 && sumRoomTotals > 0) {
    interiorProjectAmount = sumRoomTotals;
    const tolerance = Math.max(500, sumRoomTotals * 0.02);
    const apiPayable = pickedPayable;
    const apiPlausible =
      hubDisc <= 0 &&
      apiPayable != null &&
      apiPayable >= sumRoomTotals - disc - tolerance &&
      (Math.abs(apiPayable - sumRoomTotals) <= tolerance || apiPayable >= sumRoomTotals - disc);
    if (hubDisc > 0) {
      const fees = pickedFeesExplicit ?? 0;
      const grossFromRooms = sumRoomTotals + fees;
      if (apiPayable != null && apiPayable > 0) {
        const looksNet =
          grossFromRooms > 0 &&
          Math.abs(apiPayable - (grossFromRooms - hubDisc)) <= Math.max(500, hubDisc * 0.08);
        const looksGross =
          grossFromRooms > 0 &&
          Math.abs(apiPayable - grossFromRooms) <= Math.max(500, grossFromRooms * 0.02);
        totalPayableAmount =
          looksNet && !looksGross ? apiPayable : Math.max(0, apiPayable - hubDisc);
      } else {
        totalPayableAmount = Math.max(0, grossFromRooms - hubDisc);
      }
    } else if (apiPlausible) {
      totalPayableAmount = apiPayable;
    } else {
      const fees = pickedFeesExplicit ?? 0;
      totalPayableAmount = sumRoomTotals + fees - disc;
    }
  } else if (rooms.length > 0) {
    interiorProjectAmount = pickedInterior ?? pickedTotalPrice ?? null;
    totalPayableAmount =
      hubDisc > 0 && interiorProjectAmount != null
        ? Math.max(0, interiorProjectAmount + (pickedFeesExplicit ?? 0) - hubDisc)
        : pickedPayable ?? pickedTotalPrice ?? interiorProjectAmount;
  } else {
    interiorProjectAmount =
      pickedInterior ?? pickedTotalPrice ?? (sumRoomTotals > 0 ? sumRoomTotals : null);
    totalPayableAmount =
      hubDisc > 0 && interiorProjectAmount != null
        ? Math.max(0, interiorProjectAmount + (pickedFeesExplicit ?? 0) - hubDisc)
        : pickedPayable ?? pickedTotalPrice ?? (sumRoomTotals > 0 ? sumRoomTotals : null);
  }

  const designAndManagementFees =
    totalPayableAmount != null && interiorProjectAmount != null
      ? totalPayableAmount - interiorProjectAmount + disc
      : pickedFeesExplicit;

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

type QuoteVersionRow = {
  id?: number;
  quoteId: number;
  createdAt: string;
  createdBy?: string;
  createdByRole?: string;
  sourceModule?: string;
  changeSummary?: string;
  versionNumber?: number;
  internalNote?: string;
  discountSnapshot?: unknown;
  updatedValues?: unknown;
};

function parseQuoteVersionRow(row: unknown, fallbackQuoteId?: string | null): QuoteVersionRow | null {
  const o = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  const qid = asNum(o.quoteId) ?? (fallbackQuoteId && /^\d+$/.test(fallbackQuoteId) ? Number(fallbackQuoteId) : null);
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
  const createdByRole =
    o.createdByRole != null ? String(o.createdByRole) : o.role != null ? String(o.role) : undefined;
  const sourceModule =
    o.sourceModule != null ? String(o.sourceModule) : o.module != null ? String(o.module) : undefined;
  const versionId = asNum(o.id);
  const noteRaw = o.internalNote != null ? String(o.internalNote) : o.internal_note != null ? String(o.internal_note) : '';
  return {
    id: versionId != null && versionId > 0 ? versionId : undefined,
    quoteId: qid,
    createdAt: ca || new Date().toISOString(),
    createdBy,
    createdByRole,
    sourceModule,
    changeSummary: o.changeSummary != null ? String(o.changeSummary) : undefined,
    versionNumber: asNum(o.versionNumber) ?? undefined,
    internalNote: noteRaw.trim() ? noteRaw : undefined,
    discountSnapshot: o.discountSnapshot ?? o.discount_snapshot,
    updatedValues: o.updatedValues ?? o.updated_values,
  };
}

function versionsForCrmAudience(
  versions: QuoteVersionRow[],
  crmSharedVersionNumber: number | null | undefined,
  visibleVersionNumbers?: number[] | null,
): QuoteVersionRow[] {
  if (versions.length <= 1) return versions;
  const allowed = new Set(
    (visibleVersionNumbers ?? []).filter((n) => Number.isFinite(n) && n > 0).map((n) => Number(n)),
  );
  if (crmSharedVersionNumber != null && crmSharedVersionNumber > 0) {
    allowed.add(Number(crmSharedVersionNumber));
  }
  if (allowed.size > 0) {
    const matched = versions.filter((v) => allowed.has(Number(v.versionNumber)));
    if (matched.length > 0) return matched;
  }
  const crmCreated = versions.filter((v) => String(v.sourceModule || '').toLowerCase() === 'crm');
  if (crmCreated.length > 0) {
    const keep = new Set(crmCreated.map((v) => Number(v.versionNumber)));
    if (crmSharedVersionNumber != null && crmSharedVersionNumber > 0) {
      keep.add(Number(crmSharedVersionNumber));
    }
    const withBase = versions.filter((v) => keep.has(Number(v.versionNumber)));
    return withBase.length > 0 ? withBase : crmCreated;
  }
  return crmSharedVersionNumber != null && crmSharedVersionNumber > 0
    ? versions.filter((v) => Number(v.versionNumber) === Number(crmSharedVersionNumber))
    : [versions[versions.length - 1]];
}

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
  const router = useRouter();
  const pathname = usePathname();
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
  const [resolvedLeadId, setResolvedLeadId] = useState<number | null>(leadIdNum);
  const [sharedVersionNumber, setSharedVersionNumber] = useState<number | null>(null);
  const [crmSharedVersionNumber, setCrmSharedVersionNumber] = useState<number | null>(null);
  const [crmVisibleVersionNumbers, setCrmVisibleVersionNumbers] = useState<number[]>([]);
  const [isPre10Lead, setIsPre10Lead] = useState(false);
  const [shareVersionSaving, setShareVersionSaving] = useState(false);
  const [shareVersionError, setShareVersionError] = useState<string | null>(null);
  const crmAudience =
    searchParams.get('audience') === 'crm' ||
    (isInternalMode &&
      Boolean(searchParams.get('crmRole') || searchParams.get('userRole') || searchParams.get('crmUser')));
  const viewingVersionParam = Number(searchParams.get('version'));
  const viewingVersionNumber =
    Number.isFinite(viewingVersionParam) && viewingVersionParam > 0 ? viewingVersionParam : null;

  const normalizeQuoteRole = (raw: unknown): string =>
    String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/^(role_|crm_)/i, '');

  const quoteRoleEarly = normalizeQuoteRole(user?.role);
  const isCrmSalesQuoteRole =
    quoteRoleEarly === 'sales_admin' ||
    quoteRoleEarly === 'sales_manager' ||
    quoteRoleEarly === 'sales_executive';
  const canEditDiscountByDesignRole =
    quoteRoleEarly === 'designer' ||
    quoteRoleEarly === 'design_manager' ||
    quoteRoleEarly === 'territorial_design_manager' ||
    quoteRoleEarly === 'deputy_general_manager' ||
    quoteRoleEarly === 'admin' ||
    quoteRoleEarly === 'super_admin' ||
    quoteRoleEarly === 'superadmin' ||
    (isInternalMode && isCrmSalesQuoteRole);
  const canEditDiscountByRole = canEditDiscountByDesignRole || (isInternalMode && isCrmSalesQuoteRole);

  useEffect(() => {
    setResolvedLeadId(leadIdNum);
  }, [leadIdNum]);

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
        const cacheBust = `t=${Date.now()}`;
        const audienceQs = crmAudience
          ? `audience=crm&internal=1${viewingVersionNumber != null ? `&version=${viewingVersionNumber}` : ''}`
          : isInternalMode
            ? `internal=1${viewingVersionNumber != null ? `&version=${viewingVersionNumber}` : ''}`
            : 'audience=customer';
        const parseBody = async (response: Response): Promise<unknown> => {
          const txt = await response.text();
          try {
            return txt ? JSON.parse(txt) : null;
          } catch {
            return txt;
          }
        };
        let res = await fetch(
          `${API}/api/public/quote/${encodeURIComponent(q)}?${cacheBust}&${audienceQs}`,
          {
            cache: 'no-store',
          },
        );
        let body = await parseBody(res);
        let nextPayload =
          body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
        if (!res.ok || !quoteBodyHasRooms(nextPayload)) {
          res = await fetch(
            `${API}/api/prolance-test/quotes/share/${encodeURIComponent(q)}?${cacheBust}&${audienceQs}`,
            { cache: 'no-store' },
          );
          body = await parseBody(res);
          nextPayload = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
        }
        if (!res.ok) {
          const msg =
            body && typeof body === 'object' && (body as Record<string, unknown>).message
              ? String((body as Record<string, unknown>).message)
              : `Failed to load quote (HTTP ${res.status})`;
          throw new Error(msg);
        }
        if (nextPayload) {
          try {
            const hubRes = await fetch(
              `${API}/api/prolance-test/public/quotes/${encodeURIComponent(q)}/hub-discount?t=${Date.now()}&${audienceQs}`,
              { cache: 'no-store' },
            );
            if (hubRes.ok) {
              const hubBody = (await hubRes.json().catch(() => ({}))) as {
                discount?: Record<string, unknown>;
              };
              const discount = hubBody.discount;
              if (discount && typeof discount === 'object' && !Array.isArray(discount)) {
                const amt = Number(discount.hubCategoryDiscountAmount);
                const add = Number(discount.hubAdditionalDiscountAmount);
                const pct = discount.hubCategoryDiscountPct;
                const hasPct =
                  pct &&
                  typeof pct === 'object' &&
                  Object.values(pct as Record<string, unknown>).some((v) => Number(v) > 0);
                if ((Number.isFinite(amt) && amt > 0) || (Number.isFinite(add) && add > 0) || hasPct) {
                  nextPayload = applyDiscountMetaToLocalPayload(nextPayload, discount);
                }
              }
            }
          } catch {
            /* share payload still usable without overlay */
          }
          // Only backfill from revisions when the payload never stored hub discount
          // keys. After a clear (keys present at 0), do not resurrect older discounts.
          if (
            !payloadHasHubDiscountFields(nextPayload) &&
            !payloadHasExplicitHubDiscountMeta(nextPayload)
          ) {
            try {
              const revRes = await fetch(
                `${API}/api/prolance-test/public/quote-revisions/${encodeURIComponent(q)}?${cacheBust}&${audienceQs}`,
                { cache: 'no-store' },
              );
              if (revRes.ok) {
                const revBody = (await revRes.json().catch(() => ({}))) as { versions?: unknown };
                const rawVers = Array.isArray(revBody.versions) ? revBody.versions : [];
                const hints = rawVers.map((row: unknown) => {
                  const o = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
                  return {
                    quoteId: asNum(o.quoteId) ?? undefined,
                    changeSummary: o.changeSummary != null ? String(o.changeSummary) : undefined,
                    discountSnapshot: o.discountSnapshot ?? o.discount_snapshot,
                    updatedValues: o.updatedValues ?? o.updated_values,
                  };
                });
                const fromVersions = discountMetaFromVersionHints(hints, q);
                if (fromVersions) {
                  nextPayload = applyDiscountMetaToLocalPayload(nextPayload, fromVersions);
                }
              }
            } catch {
              /* revisions overlay is best-effort */
            }
          }
        }
        if (!cancelled) setPayload(nextPayload);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load quote');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteIdProp, preloadedPayload, isInternalMode, crmAudience, viewingVersionNumber]);

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
    if (!versionFetchId) return;
    let cancelled = false;
    (async () => {
      try {
        const pubRes = await fetch(
          `${API}/api/prolance-test/public/quote-revisions/${encodeURIComponent(versionFetchId)}`,
          { cache: 'no-store' },
        );
        if (pubRes.ok) {
          const pubBody = (await pubRes.json().catch(() => ({}))) as { leadId?: unknown };
          const pubLid = Number(pubBody.leadId);
          if (!cancelled && Number.isFinite(pubLid) && pubLid > 0) {
            setResolvedLeadId(pubLid);
            return;
          }
        }
        if (leadIdNum != null && leadIdNum > 0) {
          if (!cancelled) setResolvedLeadId(leadIdNum);
          return;
        }
        if (sessionId && canEditDiscountByRole) {
          const res = await fetch(
            `${API}/api/leads/prolance-quote-versions/by-quote/${encodeURIComponent(versionFetchId)}`,
            { headers: { Authorization: `Bearer ${sessionId}` } },
          );
          if (res.ok) {
            const body = (await res.json().catch(() => ({}))) as { leadId?: unknown };
            const lid = Number(body.leadId);
            if (!cancelled && Number.isFinite(lid) && lid > 0) setResolvedLeadId(lid);
          }
        }
      } catch {
        /* optional resolve */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadIdNum, sessionId, versionFetchId, canEditDiscountByRole]);

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
        const audienceQs = crmAudience
          ? 'audience=crm'
          : isInternalMode
            ? 'internal=1'
            : 'audience=customer';
        // Designers always load the full revision list (internal=1). CRM audience stays filtered.
        const versionHeaders: HeadersInit = {};
        if (sessionId && (isInternalMode || crmAudience)) {
          versionHeaders.Authorization = `Bearer ${sessionId}`;
        }
        const res = await fetch(
          `${API}/api/prolance-test/public/quote-revisions/${encodeURIComponent(versionFetchId)}?${audienceQs}`,
          { headers: versionHeaders, cache: 'no-store' },
        );
        const txt = await res.text();
        let body: {
          versions?: unknown;
          message?: unknown;
          sharedVersionNumber?: unknown;
          crmSharedVersionNumber?: unknown;
          crmVisibleVersionNumbers?: unknown;
          isPre10?: unknown;
        } = {};
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
        const versions = rawVers
          .map((row) => parseQuoteVersionRow(row))
          .filter(Boolean) as QuoteVersionRow[];
        if (!cancelled) {
          const shared = asNum(body.sharedVersionNumber);
          setSharedVersionNumber(shared != null && shared > 0 ? shared : null);
          const crmShared = asNum(body.crmSharedVersionNumber);
          setCrmSharedVersionNumber(crmShared != null && crmShared > 0 ? crmShared : null);
          const visibleNums = Array.isArray(body.crmVisibleVersionNumbers)
            ? body.crmVisibleVersionNumbers.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
            : [];
          setCrmVisibleVersionNumbers(visibleNums);
          setIsPre10Lead(body.isPre10 === true);
          setQuoteVersions(
            crmAudience ? versionsForCrmAudience(versions, crmShared, visibleNums) : versions,
          );
        }
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
  }, [versionFetchId, isInternalMode, crmAudience, sessionId]);

  useEffect(() => {
    if (!isInternalMode || crmAudience) return;
    if (viewingVersionNumber != null) return;
    if (!payload || quoteVersions.length === 0) return;
    if (payloadHasHubDiscountFields(payload)) return;
    // Cleared discounts keep hub keys at 0 — don't re-apply older version discounts.
    if (payloadHasExplicitHubDiscountMeta(payload)) return;
    const meta = discountMetaFromVersionHints(quoteVersions, quoteIdProp);
    if (!meta) return;
    setPayload(applyDiscountMetaToLocalPayload(payload, meta));
  }, [payload, quoteVersions, quoteIdProp, isInternalMode, crmAudience, viewingVersionNumber]);

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
    if (crmAudience) q.set('audience', 'crm');
    const cu = searchParams.get('crmUser') || searchParams.get('userName');
    if (cu) q.set('crmUser', cu);
    const cr = searchParams.get('crmRole') || searchParams.get('userRole');
    if (cr) q.set('crmRole', cr);
    return `${window.location.origin}/quote/${encodeURIComponent(customerLinkSlug)}?${q.toString()}`;
  }, [customerLinkSlug, searchParams, crmAudience]);

  const internalVersionSuffix = useMemo(() => {
    if (!isInternalMode) return '';
    const q = new URLSearchParams();
    q.set('internal', '1');
    const lid = searchParams.get('leadId');
    if (lid) q.set('leadId', lid);
    if (crmAudience) q.set('audience', 'crm');
    const cu = searchParams.get('crmUser') || searchParams.get('userName');
    if (cu) q.set('crmUser', cu);
    const cr = searchParams.get('crmRole') || searchParams.get('userRole');
    if (cr) q.set('crmRole', cr);
    return `?${q.toString()}`;
  }, [isInternalMode, searchParams, crmAudience]);
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

  const effectiveCrmUser =
    crmUserParam ||
    crmUserStorage ||
    (isInternalMode && user?.name ? String(user.name).trim() : '') ||
    (isInternalMode && user?.email ? String(user.email).trim() : '');
  const effectiveCrmRole =
    crmRoleParam ||
    crmRoleStorage ||
    (isInternalMode && user?.role ? String(user.role).trim() : '');

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

  // Design Module session OR CRM internal link with admin/super_admin.
  const crmRoleNormalized = normalizeQuoteRole(effectiveCrmRole);
  const canEditDiscountByCrmRole =
    crmRoleNormalized === 'super_admin' ||
    crmRoleNormalized === 'superadmin' ||
    crmRoleNormalized === 'admin' ||
    crmRoleNormalized === 'sales_admin' ||
    crmRoleNormalized === 'sales_manager' ||
    crmRoleNormalized === 'sales_executive';
  const quoteRole = quoteRoleEarly || crmRoleNormalized;
  const quoteDesignManager = quoteRole === 'design_manager';
  const viaCrmDiscountEdit =
    isInternalMode && canEditDiscountByCrmRole && Boolean(effectiveCrmUser);
  const discountEditable =
    isInternalMode &&
    (canEditDiscountByDesignRole || viaCrmDiscountEdit) &&
    (Boolean(sessionId) || viaCrmDiscountEdit) &&
    Boolean(versionFetchId) &&
    resolvedLeadId != null &&
    resolvedLeadId > 0;
  // CRM (any editor role): woodwork up to 45% inclusive. Design Module DM / TDM / DGM / admin stay unrestricted.
  const fromCrmQuoteContext = isInternalMode || viaCrmDiscountEdit || isCrmSalesQuoteRole;
  const discountCapProfile: DiscountCapProfile = fromCrmQuoteContext && canEditDiscountByCrmRole
    ? 'crm-elevated'
    : !fromCrmQuoteContext &&
        (quoteDesignManager ||
          quoteRoleEarly === 'territorial_design_manager' ||
          quoteRoleEarly === 'deputy_general_manager' ||
          quoteRoleEarly === 'admin' ||
          quoteRoleEarly === 'super_admin' ||
          quoteRoleEarly === 'superadmin')
      ? 'unrestricted'
      : 'standard';

  const handleSaveDiscount = async (savePayload: QuoteCategoryDiscountSavePayload) => {
    if (!versionFetchId) {
      setDiscountSaveError('Quote ID is missing — cannot save discount.');
      return;
    }
    if (resolvedLeadId == null || resolvedLeadId < 1) {
      setDiscountSaveError(
        'Lead ID is missing. Open the quote from CRM with ?leadId=… or refresh after the page loads.',
      );
      return;
    }
    setDiscountSaving(true);
    setDiscountSaveError(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sessionId) {
        headers['Authorization'] = `Bearer ${sessionId}`;
      }
      if (viaCrmDiscountEdit) {
        headers['X-Crm-Role'] = effectiveCrmRole;
        headers['X-Crm-User'] = effectiveCrmUser;
      }
      const res = await fetch(
        `${API}/api/leads/${resolvedLeadId}/quotes/${encodeURIComponent(versionFetchId)}/discount`,
        {
          method: 'PATCH',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            categoryPct: savePayload.categoryPct,
            amount: savePayload.amount,
            additionalDiscount: savePayload.additionalDiscount,
            totalPayableAmount: quote.totalPayableAmount ?? undefined,
            payload: payload ?? undefined,
            createdBy: currentUserName,
            ...(viaCrmDiscountEdit ? { sourceModule: 'CRM' } : {}),
            ...(viaCrmDiscountEdit
              ? { crmRole: effectiveCrmRole, crmUser: effectiveCrmUser }
              : {}),
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

      // Updated quote revisions from backend response:
      const parseVersionsArray = (rawList: unknown): QuoteVersionRow[] => {
        if (!Array.isArray(rawList)) return [];
        return rawList
          .map((row) => parseQuoteVersionRow(row, versionFetchId))
          .filter(Boolean) as QuoteVersionRow[];
      };

      // 1. If backend returned updated versions in response, use them directly:
      const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
      const savedLeadId = bodyObj?.leadId != null ? Number(bodyObj.leadId) : NaN;
      if (Number.isFinite(savedLeadId) && savedLeadId > 0) {
        setResolvedLeadId(savedLeadId);
      }
      let appliedVersions: QuoteVersionRow[] | null = null;
      if (bodyObj && Array.isArray(bodyObj.versions)) {
        const parsed = parseVersionsArray(bodyObj.versions);
        let crmVer = crmSharedVersionNumber;
        if (crmAudience && parsed.length > 0) {
          const newest = parsed[parsed.length - 1];
          const n = Number(newest.versionNumber);
          if (Number.isFinite(n) && n > 0) {
            crmVer = n;
            setCrmSharedVersionNumber(n);
          }
        }
        const nextVisible = [...crmVisibleVersionNumbers];
        if (crmVer != null && crmVer > 0 && !nextVisible.includes(crmVer)) nextVisible.push(crmVer);
        if (crmSharedVersionNumber != null && crmSharedVersionNumber > 0 && !nextVisible.includes(crmSharedVersionNumber)) {
          nextVisible.push(crmSharedVersionNumber);
        }
        setCrmVisibleVersionNumbers(nextVisible);
        appliedVersions = crmAudience ? versionsForCrmAudience(parsed, crmVer, nextVisible) : parsed;
        setQuoteVersions(appliedVersions);
        if (crmAudience && crmVer != null && crmVer > 0 && typeof window !== 'undefined') {
          const q = new URLSearchParams(searchParams.toString());
          q.set('version', String(crmVer));
          router.replace(`${pathname}?${q.toString()}`, { scroll: false });
        }
      }

      // 2. Otherwise fetch fresh quote revisions from public endpoint
      if (!appliedVersions && versionFetchId) {
        (async () => {
          try {
            setQuoteVersionsLoading(true);
            const audienceQs = crmAudience ? 'audience=crm' : isInternalMode ? 'internal=1' : 'audience=customer';
            const versionHeaders: HeadersInit = {};
            if (sessionId && (isInternalMode || crmAudience)) {
              versionHeaders.Authorization = `Bearer ${sessionId}`;
            }
            const vRes = await fetch(
              `${API}/api/prolance-test/public/quote-revisions/${encodeURIComponent(versionFetchId)}?t=${Date.now()}&${audienceQs}`,
              { cache: 'no-store', headers: versionHeaders },
            );
            const vTxt = await vRes.text();
            let vBody: { versions?: unknown; message?: unknown } = {};
            try { vBody = vTxt ? JSON.parse(vTxt) : {}; } catch { vBody = {}; }
            if (vRes.ok && Array.isArray(vBody.versions)) {
              const fetched = parseVersionsArray(vBody.versions);
              if (fetched.length > 0) {
                setQuoteVersions(
                  crmAudience
                    ? versionsForCrmAudience(fetched, crmSharedVersionNumber, crmVisibleVersionNumbers)
                    : fetched,
                );
              }
            }
          } catch {
            // Silently ignore re-fetch errors — existing versions remain visible
          } finally {
            setQuoteVersionsLoading(false);
          }
        })();
      }
      return {
        alreadyExists: Boolean(bodyObj?.alreadyExists),
        message: bodyObj?.message ? String(bodyObj.message) : undefined,
      };
    } catch (e) {
      setDiscountSaveError(e instanceof Error ? e.message : 'Failed to save discount');
    } finally {
      setDiscountSaving(false);
    }
  };

  const handleShareQuoteVersion = async (
    versionNumber: number,
    selectedQuoteId: number | undefined,
    target: 'customer' | 'crm',
  ) => {
    if (!versionFetchId) {
      setShareVersionError('Quote ID is missing — cannot share this version.');
      return;
    }
    if (resolvedLeadId == null || resolvedLeadId < 1) {
      setShareVersionError(
        'Lead ID is missing. Open the quote from the Design Module with ?leadId=… or refresh after the page loads.',
      );
      return;
    }
    const selectingForCrm = target === 'crm';
    setShareVersionSaving(true);
    setShareVersionError(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sessionId) {
        headers['Authorization'] = `Bearer ${sessionId}`;
      } else if (viaCrmDiscountEdit && !selectingForCrm) {
        headers['X-Crm-Role'] = effectiveCrmRole;
        headers['X-Crm-User'] = effectiveCrmUser;
      }
      const sharePath = selectingForCrm ? 'crm-share' : 'customer-share';
      const shareUrl = `${API}/api/leads/${resolvedLeadId}/quotes/${encodeURIComponent(versionFetchId)}/${sharePath}`;
      const shareBody = JSON.stringify({
        versionNumber,
        selectedQuoteId: selectedQuoteId ?? Number(versionFetchId),
        ...(!selectingForCrm && (isInternalMode || viaCrmDiscountEdit) ? { sourceModule: 'CRM' } : {}),
        ...(!selectingForCrm && viaCrmDiscountEdit
          ? { crmRole: effectiveCrmRole, crmUser: effectiveCrmUser }
          : {}),
      });
      let res = await fetch(shareUrl, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: shareBody,
      });
      if (res.status === 404 || res.status === 405) {
        res = await fetch(shareUrl, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: shareBody,
        });
      }
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
            : `Failed to share version (HTTP ${res.status})`;
        throw new Error(msg);
      }
      const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
      if (selectingForCrm) {
        const shared = asNum(bodyObj?.crmSharedVersionNumber) ?? versionNumber;
        setCrmSharedVersionNumber(shared);
      } else {
        const shared = asNum(bodyObj?.sharedVersionNumber) ?? versionNumber;
        setSharedVersionNumber(shared);
      }
    } catch (e) {
      setShareVersionError(
        e instanceof Error
          ? e.message
          : selectingForCrm
            ? 'Failed to select this version for CRM'
            : 'Failed to share this version with the customer',
      );
    } finally {
      setShareVersionSaving(false);
    }
  };

  const handleSaveVersionNote = async (versionId: number, note: string) => {
    if (!sessionId) throw new Error('Sign in to save an internal note.');
    if (resolvedLeadId == null || resolvedLeadId < 1) {
      throw new Error('This quotation is not linked to a lead yet.');
    }
    const res = await fetch(
      `${API}/api/leads/${resolvedLeadId}/quote-versions/${versionId}/note`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${sessionId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as { message?: unknown; internalNote?: unknown };
    if (!res.ok) {
      throw new Error(body.message != null ? String(body.message) : 'Failed to save the internal note');
    }
    const saved = body.internalNote != null && String(body.internalNote).trim() ? String(body.internalNote) : undefined;
    setQuoteVersions((prev) => prev.map((row) => (row.id === versionId ? { ...row, internalNote: saved } : row)));
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
      discountCapProfile={discountCapProfile}
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
      sharedVersionNumber={sharedVersionNumber}
      crmSharedVersionNumber={crmSharedVersionNumber}
      viewingVersionNumber={viewingVersionNumber}
      shareVersionSaving={shareVersionSaving}
      shareVersionError={shareVersionError}
      hideCustomerLink={crmAudience || isPre10Lead}
      crmLockedView={crmAudience}
      onShareVersionWithCustomer={
        !crmAudience &&
        !isPre10Lead &&
        (Boolean(sessionId) || viaCrmDiscountEdit) &&
        resolvedLeadId != null &&
        resolvedLeadId > 0
          ? (versionNumber, quoteId) => handleShareQuoteVersion(versionNumber, quoteId, 'customer')
          : undefined
      }
      onSelectVersionForCrm={
        isPre10Lead &&
        !crmAudience &&
        Boolean(sessionId) &&
        resolvedLeadId != null &&
        resolvedLeadId > 0
          ? (versionNumber, quoteId) => handleShareQuoteVersion(versionNumber, quoteId, 'crm')
          : undefined
      }
      onSaveVersionNote={
        isInternalMode && sessionId && resolvedLeadId != null && resolvedLeadId > 0
          ? handleSaveVersionNote
          : undefined
      }
    />
  );
}
