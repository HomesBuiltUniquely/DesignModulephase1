import { extractUnitDisplayPrice, mergeQuoteLineItemArrays } from '@/app/quote/quoteLineItems';

export type MeetingWizQuoteLineItem = {
  name: string;
  tags: string;
  amount: number | null;
  discountedAmount: number | null;
};

export type MeetingWizQuoteSummary = {
  quoteId: number | null;
  totalPayable: number | null;
  interiorProjectAmount: number | null;
  lineItems: MeetingWizQuoteLineItem[];
};

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asStr(v: unknown): string {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
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

function tagsFromRoom(
  r: Record<string, unknown>,
  units: Record<string, unknown>[],
  services: Record<string, unknown>[],
): string {
  const tags = new Set<string>();
  const push = (s: string) => {
    const t = s.trim().toUpperCase();
    if (t && t !== '-') tags.add(t);
  };

  const optionName = asStr(r.optionName ?? r.roomType);
  if (optionName) push(optionName);

  for (const u of units.slice(0, 12)) {
    push(asStr(u.cabinetClass) || asStr(u.category) || asStr(u.label));
  }
  for (const s of services.slice(0, 8)) {
    push(asStr(s.category));
  }

  if (asNum(r.loftsPrice)) push('LOFTS');
  if (asNum(r.worktopsPrice)) push('WORKTOPS');
  if (asNum(r.appliancesPrice)) push('APPLIANCES');
  if (asNum(r.servicesPrice)) push('SERVICES');

  const list = [...tags].filter(Boolean).slice(0, 4);
  return list.length ? list.join(', ') : 'WOODWORK';
}

/** Format INR with Indian grouping (e.g. 15,40,000). */
export function formatMeetingWizInr(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(amount))}`;
}

/**
 * Build Meeting Wizard Final Quote cards from a Prolance Get Quote payload.
 * Parsing mirrors `QuoteExperience.normalizeQuote` so totals match the share page.
 */
export function summarizeMeetingWizQuote(
  payload: unknown,
  fallbackQuoteId: number | null = null,
): MeetingWizQuoteSummary {
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
  optionDetailsRaw.forEach((row, idx) => {
    const o = asObj(row);
    const key = String(o.optionID ?? o.optionId ?? o.roomID ?? o.roomId ?? idx);
    detailsMap.set(key, o);
  });

  let lineItems: MeetingWizQuoteLineItem[] = summaryRows
    .map((row, idx) => {
      const r = asObj(row);
      const key = String(r.optionID ?? r.optionId ?? r.roomID ?? r.roomId ?? idx);
      const d = detailsMap.get(key) || {};
      const roomName = asStr(r.roomName);
      if (!roomName || roomName === '-') return null;

      const unitsRaw = mergeQuoteLineItemArrays(
        Array.isArray(r.units) ? (r.units as unknown[]) : [],
        Array.isArray(d.units) ? (d.units as unknown[]) : [],
      );
      const servicesRaw = mergeQuoteLineItemArrays(
        Array.isArray(r.services) ? (r.services as unknown[]) : [],
        Array.isArray(d.services) ? (d.services as unknown[]) : [],
      );

      // Keep display price helpers warm for consistency with share page merges.
      void unitsRaw.map((u) => extractUnitDisplayPrice(u));

      const optionName = asStr(r.optionName ?? r.roomType);
      return {
        name: optionName && optionName !== '-' ? optionName : roomName,
        tags: tagsFromRoom(r, unitsRaw, servicesRaw),
        amount: asNum(r.totalPriceOld ?? r.unitsPrice ?? r.woodWorkPrice),
        discountedAmount: asNum(r.totalPrice),
      } satisfies MeetingWizQuoteLineItem;
    })
    .filter(Boolean) as MeetingWizQuoteLineItem[];

  if (!lineItems.length && optionDetailsRaw.length) {
    lineItems = optionDetailsRaw
      .map((row) => {
        const r = asObj(row);
        const roomName = asStr(r.roomName) || asStr(r.optionName);
        if (!roomName) return null;
        return {
          name: roomName,
          tags: tagsFromRoom(r, [], []),
          amount: asNum(r.totalPriceOld ?? r.unitsPrice ?? r.woodWorkPrice),
          discountedAmount: asNum(r.totalPrice),
        } satisfies MeetingWizQuoteLineItem;
      })
      .filter(Boolean) as MeetingWizQuoteLineItem[];
  }

  if (!lineItems.length) {
    const candidateKeys = [
      'summary',
      'summaryDetails',
      'lineItems',
      'items',
      'roomWiseSummary',
      'overallSummary',
    ];
    for (const key of candidateKeys) {
      const arr = quoteObj[key] ?? root[key];
      if (!Array.isArray(arr)) continue;
      const mapped = arr
        .map((x) => {
          const o = asObj(x);
          const name =
            asStr(o.name) ||
            asStr(o.itemName) ||
            asStr(o.title) ||
            asStr(o.roomName) ||
            asStr(o.moduleName);
          if (!name) return null;
          return {
            name,
            tags: asStr(o.category) || asStr(o.tags) || 'ITEM',
            amount: asNum(o.amount ?? o.baseAmount ?? o.totalAmount ?? o.price),
            discountedAmount: asNum(
              o.discountedAmount ?? o.finalAmount ?? o.payableAmount ?? o.netAmount,
            ),
          } satisfies MeetingWizQuoteLineItem;
        })
        .filter(Boolean) as MeetingWizQuoteLineItem[];
      if (mapped.length) {
        lineItems = mapped;
        break;
      }
    }
  }

  const sumRooms = lineItems.reduce(
    (sum, item) => sum + (item.discountedAmount ?? item.amount ?? 0),
    0,
  );
  const disc = asNum(pick('discount', 'discountAmount')) || 0;
  const pickedPayable = asNum(
    pick('totalPayableAmount', 'finalTotalPrice', 'finalPrice', 'grandTotal', 'totalPayable'),
  );
  const pickedInterior = asNum(pick('interiorProjectAmount', 'projectAmount', 'subTotal'));
  const pickedTotalPrice = asNum(pick('totalPrice'));

  let interiorProjectAmount: number | null;
  let totalPayable: number | null;

  if (lineItems.length > 0 && sumRooms > 0) {
    interiorProjectAmount = sumRooms;
    const tolerance = Math.max(500, sumRooms * 0.02);
    const apiPlausible =
      pickedPayable != null &&
      pickedPayable >= sumRooms - disc - tolerance &&
      (Math.abs(pickedPayable - sumRooms) <= tolerance || pickedPayable >= sumRooms - disc);
    totalPayable = apiPlausible ? pickedPayable : sumRooms - disc;
  } else {
    interiorProjectAmount = pickedInterior ?? pickedTotalPrice ?? null;
    totalPayable = pickedPayable ?? pickedTotalPrice ?? interiorProjectAmount;
  }

  const quoteId =
    asNum(pick('quotationId', 'quotationID', 'quoteID', 'quoteId')) ?? fallbackQuoteId;

  return {
    quoteId: quoteId != null && quoteId >= 1 ? Math.floor(quoteId) : null,
    totalPayable,
    interiorProjectAmount,
    lineItems,
  };
}
