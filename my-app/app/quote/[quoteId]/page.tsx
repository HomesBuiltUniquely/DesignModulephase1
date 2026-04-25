'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { getApiBase } from '@/app/lib/apiBase';

const API = getApiBase();

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asStr(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : '-';
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
  lineItems: Array<{ name: string; amount: number | null; discountedAmount: number | null }>;
  rooms: QuoteRoom[];
};

function normalizeQuote(payload: unknown, fallbackQuoteId: string): NormalizedQuote {
  const root = asObj(payload);
  const data = asObj(root.data);
  const quoteObj = Object.keys(data).length ? data : root;

  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (quoteObj[k] != null) return quoteObj[k];
      if (root[k] != null) return root[k];
    }
    return deepFindByKeys(payload, keys);
  };

  const summaryRaw = pick('quoteOptionsData', 'optionDetails', 'roomWiseSummary');
  const summaryRows = Array.isArray(summaryRaw) ? summaryRaw : [];
  const optionDetailsRaw = Array.isArray(quoteObj.optionDetails)
    ? (quoteObj.optionDetails as unknown[])
    : Array.isArray(root.optionDetails)
      ? (root.optionDetails as unknown[])
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
    name: r.optionName !== '-' ? r.optionName : r.roomName,
    amount: r.totalPriceOld,
    discountedAmount: r.totalPrice,
  }));

  const totalPayableAmount =
    asNum(pick('totalPayableAmount', 'finalTotalPrice', 'finalPrice', 'totalPrice')) ??
    (rooms.length ? rooms.reduce((sum, r) => sum + (r.totalPrice || 0), 0) : null);
  const interiorProjectAmount =
    asNum(pick('interiorProjectAmount', 'projectAmount', 'subTotal', 'totalPrice')) ??
    (rooms.length ? rooms.reduce((sum, r) => sum + (r.totalPrice || 0), 0) : null);
  const discount = asNum(pick('discount', 'discountAmount'));
  const designAndManagementFees =
    totalPayableAmount != null && interiorProjectAmount != null
      ? totalPayableAmount - interiorProjectAmount + (discount || 0)
      : asNum(pick('designAndManagementFees'));

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
    discount,
    lineItems,
    rooms,
  };
}

type PageProps = { params: Promise<{ quoteId: string }> };

export default function SharedQuotePage(props: PageProps) {
  const { quoteId: quoteIdRaw } = use(props.params);
  const quoteId = String(quoteIdRaw ?? '').trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [summaryTab, setSummaryTab] = useState<'overall' | 'roomwise'>('overall');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!quoteId) {
        setError('Quote ID is missing.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API}/api/prolance-test/quotes/share/${encodeURIComponent(quoteId)}`);
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
  }, [quoteId]);

  const quote = useMemo(() => normalizeQuote(payload, quoteId), [payload, quoteId]);

  if (loading) {
    return <div className="min-h-screen bg-[#f5f5f8] p-6 text-gray-700">Loading quote...</div>;
  }
  if (error) {
    return <div className="min-h-screen bg-[#f5f5f8] p-6 text-rose-700">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-[#f3f3f5] py-6">
      <div className="mx-auto w-full max-w-5xl rounded-xl bg-white shadow-sm">
        <div className="rounded-t-xl bg-[#282a2f] px-5 py-4">
          <p className="text-xl font-bold text-white">HUBINTERIOR</p>
          <p className="text-[11px] text-gray-300">Quotation View</p>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold tracking-wide text-gray-500">QUOTATION ID : {quote.quotationId}</p>
            <h3 className="mt-2 text-4xl font-bold text-gray-800">
              Hey {quote.customerName !== '-' ? quote.customerName : 'Customer'}, your quotation is ready!
            </h3>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                ['Customer Name', quote.customerName],
                ['Ref ID', quote.refId],
                ['City', quote.city],
                ['BHK Type', quote.bhkType],
                ['Project Type', quote.projectType],
                ['Project ID', quote.projectId],
                ['Quote Number', quote.quoteNum],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-3xl font-bold text-gray-800">Summary Detail</p>
            <div className="mt-4 grid grid-cols-2 rounded-xl border border-gray-200 p-1">
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
            </div>

            {summaryTab === 'overall' ? (
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
                        <p className="font-semibold text-gray-900">{money(item.discountedAmount ?? item.amount)}</p>
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
                  <div className="flex justify-between border-t border-gray-100 pt-3">
                    <span className="text-sm text-gray-600">Design and Management Fees</span>
                    <span className="font-semibold text-gray-900">{money(quote.designAndManagementFees)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-3">
                    <span className="text-sm text-gray-600">Discount</span>
                    <span className="font-semibold text-gray-900">{money(quote.discount)}</span>
                  </div>
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
                    const saving =
                      room.totalPriceOld != null && room.totalPrice != null ? room.totalPriceOld - room.totalPrice : null;
                    return (
                      <div key={room.key} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-lg font-semibold text-gray-900">{room.roomName}</p>
                            <p className="text-sm text-gray-600">{room.optionName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Room Total</p>
                            <p className="text-xl font-bold text-gray-900">{money(room.totalPrice)}</p>
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
        </div>
      </div>
    </div>
  );
}

