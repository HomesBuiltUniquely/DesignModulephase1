'use client';

import Image from 'next/image';
import type { QuoteDiscountBreakdownRow } from './quoteDiscountBreakdown';
import { QuoteBrandLogo } from './QuoteBrandLogo';
import { QuoteDiscountDetails } from './QuoteDiscountDetails';
import { QuoteTermsAndConditions } from './hubQuoteTermsPanel';
import { inr, QUOTE } from './quoteStyles';
import type { QuoteRoom } from './quoteTypes';

type LineItem = { roomKey: string; name: string; amount: number | null; discountedAmount: number | null };

type QuoteView = {
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
  lineItems: LineItem[];
  rooms: QuoteRoom[];
};

type VersionRow = { quoteId: number; createdAt: string };

type Props = {
  quote: QuoteView;
  metaDraft: Record<string, string>;
  setMetaDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  customerFirstName: string;
  isInternalMode: boolean;
  customerShareLink: string;
  internalShareLink: string;
  linkCopiedState: 'customer' | 'internal' | null;
  setLinkCopiedState: (v: 'customer' | 'internal' | null) => void;
  summaryTab: 'overall' | 'roomwise' | 'terms';
  setSummaryTab: (v: 'overall' | 'roomwise' | 'terms') => void;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  productTab: Record<string, string>;
  setProductTab: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  quoteVersions: VersionRow[];
  quoteVersionsLoading: boolean;
  quoteVersionsError: string | null;
  versionFetchId: string;
  internalVersionSuffix: string;
};

function LinkIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke={QUOTE.gold} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function FieldIcon({ type }: { type: string }) {
  const cls = 'h-4 w-4';
  const color = QUOTE.gold;
  if (type === 'user') return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
  if (type === 'pin') return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  if (type === 'doc') return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
  if (type === 'home') return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
  if (type === 'cal') return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
  return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 .953.39 1 1v3M7 7v10a2 2 0 002 2h6a2 2 0 002-2V7" /></svg>;
}

const PROJECT_FIELDS = [
  { label: 'Customer Name', key: 'customerName', icon: 'user' },
  { label: 'Ref ID', key: 'refId', icon: 'doc' },
  { label: 'City', key: 'city', icon: 'pin' },
  { label: 'Quote Number', key: 'quoteNum', icon: 'doc' },
  { label: 'BHK Type', key: 'bhkType', icon: 'home' },
  { label: 'Project Type', key: 'projectType', icon: 'doc' },
  { label: 'Project ID', key: 'projectId', icon: 'doc' },
  { label: 'Date', key: 'date', icon: 'cal' },
] as const;

const TABS = [
  { id: 'overall' as const, label: 'Overall Summary' },
  { id: 'roomwise' as const, label: 'Room wise Summary' },
  { id: 'terms' as const, label: 'Terms and Condition' },
];

function formatVersionDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function QuoteExperienceView(props: Props) {
  const {
    quote,
    metaDraft,
    setMetaDraft,
    customerFirstName,
    isInternalMode,
    customerShareLink,
    internalShareLink,
    linkCopiedState,
    setLinkCopiedState,
    summaryTab,
    setSummaryTab,
    expanded,
    setExpanded,
    productTab,
    setProductTab,
    quoteVersions,
    quoteVersionsLoading,
    quoteVersionsError,
    versionFetchId,
    internalVersionSuffix,
  } = props;

  return (
    <div className="min-h-screen" style={{ backgroundColor: QUOTE.beige }}>
      <header className="px-4 py-4 sm:px-6" style={{ backgroundColor: QUOTE.brown }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <QuoteBrandLogo />
            <span className="h-8 w-px bg-white/30" />
            <span className="quote-heading text-2xl font-bold uppercase tracking-[0.2em] text-white">
              Quotation
            </span>
          </div>
          {isInternalMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!customerShareLink) return;
                  await navigator.clipboard.writeText(customerShareLink);
                  setLinkCopiedState('customer');
                  setTimeout(() => setLinkCopiedState(null), 1600);
                }}
                className="flex items-center gap-2 rounded-md border border-white/40 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                <LinkIcon />
                {linkCopiedState === 'customer' ? 'Copied!' : 'Customer Link'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!internalShareLink) return;
                  await navigator.clipboard.writeText(internalShareLink);
                  setLinkCopiedState('internal');
                  setTimeout(() => setLinkCopiedState(null), 1600);
                }}
                className="flex items-center gap-2 rounded-md border border-white/40 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                <LinkIcon />
                {linkCopiedState === 'internal' ? 'Copied!' : 'Internal Link'}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* Hero */}
        <section className="overflow-hidden rounded-2xl border border-[#ece6df] bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-8 lg:p-10">
              <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: QUOTE.red }}>
                Quotation ID : {quote.quotationId}
              </p>
              <h1 className="quote-heading mt-3 text-3xl font-bold leading-tight text-[#2a1d14] sm:text-4xl">
                Hey {customerFirstName}, your quotation is ready!
              </h1>
              <div className="mt-4 h-1 w-16 rounded-full" style={{ backgroundColor: QUOTE.gold }} />
              <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: QUOTE.muted }}>
                We&apos;ve crafted a personalized estimate for your dream home
              </p>
            </div>
            <div className="relative min-h-[220px] lg:min-h-[280px]">
              <Image src="/quote.jpg" alt="" fill className="object-cover opacity-30" priority />
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="w-full max-w-xs rounded-2xl border border-[#ece6df] bg-white/95 p-6 shadow-lg backdrop-blur-sm">
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: QUOTE.muted }}>
                    Estimated Total
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums" style={{ color: QUOTE.red }}>
                    {inr(quote.totalPayableAmount)}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: QUOTE.muted }}>
                    Inclusive of all taxes
                  </p>
                  <div className="mt-4 h-0.5 w-10 rounded-full" style={{ backgroundColor: QUOTE.gold }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Project details */}
        <section className="rounded-2xl border border-[#ece6df] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: '#fde8ea', color: QUOTE.red }}
            >
              <FieldIcon type="home" />
            </span>
            <h2 className="quote-heading text-lg font-bold uppercase tracking-wide" style={{ color: QUOTE.red }}>
              Project Details
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROJECT_FIELDS.map(({ label, key, icon }) => (
              <div key={key}>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-medium" style={{ color: QUOTE.muted }}>
                  <FieldIcon type={icon} />
                  {label}
                </label>
                <input
                  value={metaDraft[key] ?? ''}
                  onChange={(e) => setMetaDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                  readOnly={!isInternalMode}
                  className="w-full rounded-lg border border-[#e0d8d0] bg-[#faf8f5] px-3 py-2.5 text-sm font-semibold text-[#2a1d14] outline-none focus:border-[#c9a84c]"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Breakdown */}
        <section className="rounded-2xl border border-[#ece6df] bg-white p-6 shadow-sm">
          <h2 className="quote-heading text-lg font-bold text-[#2a1d14]">Breakdown</h2>
          <div className="mt-4 overflow-hidden rounded-xl border-2" style={{ borderColor: QUOTE.red }}>
            <div className="grid grid-cols-1 divide-y divide-[#ece6df] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSummaryTab(tab.id)}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors"
                  style={
                    summaryTab === tab.id
                      ? { backgroundColor: QUOTE.red, color: '#fff' }
                      : { backgroundColor: '#fff', color: QUOTE.muted }
                  }
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {summaryTab === 'terms' ? (
            <QuoteTermsAndConditions />
          ) : summaryTab === 'overall' ? (
            <div className="mt-6 space-y-4">
              {quote.lineItems.length ? (
                quote.lineItems.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="flex items-center justify-between rounded-xl border border-[#ece6df] bg-[#faf8f5] px-5 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: QUOTE.red }}
                      >
                        <FieldIcon type="home" />
                      </span>
                      <span className="font-semibold text-[#2a1d14]">{item.name}</span>
                    </div>
                    <span className="text-lg font-bold tabular-nums text-[#2a1d14]">
                      {inr(item.discountedAmount ?? item.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Quote details are being prepared. Please verify totals below.
                </div>
              )}

              <div className="space-y-3 border-t border-[#ece6df] pt-4">
                <div className="flex justify-between text-sm">
                  <span style={{ color: QUOTE.muted }}>Design and management fees</span>
                  <span className="font-semibold tabular-nums text-[#2a1d14]">
                    {inr(quote.designAndManagementFees ?? 0)}
                  </span>
                </div>
                <QuoteDiscountDetails rows={quote.discountBreakdown} totalDiscount={quote.discount} />
              </div>

              <div
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl px-6 py-5 text-white"
                style={{ backgroundColor: QUOTE.brown }}
              >
                <div>
                  <p className="quote-heading text-lg font-bold">Total Payable Amount</p>
                  <p className="text-xs text-white/70">Inclusive of all tax and discount</p>
                </div>
                <p className="text-3xl font-bold tabular-nums">{inr(quote.totalPayableAmount)}</p>
              </div>

              <p className="flex items-center gap-2 text-xs" style={{ color: QUOTE.muted }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                This estimate is valid for 30 days from the date of issue
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {quote.rooms.length ? (
                quote.rooms.map((room) => {
                  const roomTotal = room.totalPrice;
                  const saving =
                    room.totalPriceOld != null && roomTotal != null ? room.totalPriceOld - roomTotal : null;
                  const isOpen = expanded[room.key];
                  const categories = Array.from(
                    new Set(room.units.map((u) => u.cabinetClass || u.label || 'Others').filter(Boolean)),
                  );
                  const activeCat = productTab[room.key] ?? categories[0] ?? 'All';
                  const filteredUnits =
                    activeCat === 'All'
                      ? room.units
                      : room.units.filter((u) => (u.cabinetClass || u.label) === activeCat);

                  return (
                    <div key={room.key} className="overflow-hidden rounded-2xl border border-[#ece6df] bg-white">
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ece6df] p-5">
                        <div className="flex items-start gap-3">
                          <span
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                            style={{ backgroundColor: QUOTE.red }}
                          >
                            <FieldIcon type="home" />
                          </span>
                          <div>
                            <p className="quote-heading text-lg font-bold text-[#2a1d14]">{room.roomName}</p>
                            <p className="text-sm" style={{ color: QUOTE.muted }}>
                              {room.optionName}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide" style={{ color: QUOTE.muted }}>
                            Room total
                          </p>
                          <p className="text-2xl font-bold tabular-nums" style={{ color: QUOTE.red }}>
                            {inr(roomTotal)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-px border-b border-[#ece6df] bg-[#ece6df] sm:grid-cols-4">
                        {[
                          ['Units', room.unitsPrice],
                          ['Loft', room.loftsPrice],
                          ['Services', room.servicesPrice],
                          ['Appliances', room.appliancesPrice],
                          ['Skirting', room.skirtingsPrice],
                          ['Worktops', room.worktopsPrice],
                          ['Additional HW', room.additionalHWPrice],
                          ['Savings', saving],
                        ].map(([label, value]) => (
                          <div key={`${room.key}-${label}`} className="bg-[#faf8f5] px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: QUOTE.muted }}>
                              {label}
                            </p>
                            <p
                              className={`mt-1 text-sm font-bold tabular-nums ${label === 'Savings' ? 'text-emerald-700' : 'text-[#2a1d14]'}`}
                            >
                              {inr(value)}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="p-5">
                        <button
                          type="button"
                          onClick={() => setExpanded((prev) => ({ ...prev, [room.key]: !prev[room.key] }))}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-colors"
                          style={{ borderColor: QUOTE.red, color: QUOTE.red }}
                        >
                          {isOpen ? 'Hide full breakdown' : 'View full breakdown'}
                          <svg
                            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {isOpen ? (
                        <div className="space-y-6 border-t border-[#ece6df] px-5 pb-6 pt-2">
                          {room.matlInfo ? (
                            <div className="rounded-xl border border-[#ece6df]">
                              <div className="flex items-center justify-between border-b border-[#ece6df] px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <SectionIconSmall />
                                  <span className="font-semibold text-[#2a1d14]">Material specification</span>
                                </div>
                              </div>
                              <pre className="whitespace-pre-wrap p-4 text-xs leading-relaxed text-[#5c5650]">
                                {room.matlInfo}
                              </pre>
                            </div>
                          ) : null}

                          {room.units.length > 0 ? (
                            <div className="rounded-xl border border-[#ece6df]">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ece6df] px-4 py-3">
                                <span className="font-semibold text-[#2a1d14]">
                                  Products ({room.units.length} items)
                                </span>
                              </div>
                              {categories.length > 1 ? (
                                <div className="flex flex-wrap gap-2 border-b border-[#ece6df] p-3">
                                  {categories.map((cat) => (
                                    <button
                                      key={cat}
                                      type="button"
                                      onClick={() => setProductTab((prev) => ({ ...prev, [room.key]: cat }))}
                                      className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                                      style={
                                        activeCat === cat
                                          ? { backgroundColor: QUOTE.red, color: '#fff' }
                                          : { border: `1px solid ${QUOTE.border}`, color: QUOTE.muted }
                                      }
                                    >
                                      {cat} ({room.units.filter((u) => (u.cabinetClass || u.label) === cat).length})
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                                {filteredUnits.map((u, idx) => (
                                  <div
                                    key={`${u.label}-${idx}`}
                                    className="overflow-hidden rounded-xl border border-[#ece6df] bg-white"
                                  >
                                    <div className="flex h-28 items-center justify-center bg-[#ece6df]">
                                      <svg className="h-10 w-10 text-[#c4bdb5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                    <div className="p-3">
                                      <p className="text-xs font-bold text-[#2a1d14]">{u.label || u.cabinetClass}</p>
                                      <p className="mt-1 line-clamp-2 text-[11px] text-[#6b6560]">{u.description}</p>
                                      <p className="mt-2 text-[11px] text-[#9a928c]">Size : {u.dimensions}</p>
                                      <p className="mt-2 text-sm font-bold tabular-nums" style={{ color: QUOTE.red }}>
                                        {inr(u.price)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {room.servicesList.length > 0 ? (
                            <div className="rounded-xl border border-[#ece6df]">
                              <div className="border-b border-[#ece6df] px-4 py-3 font-semibold text-[#2a1d14]">
                                Services ({room.servicesList.length} items)
                              </div>
                              <div className="divide-y divide-[#ece6df]">
                                {room.servicesList.map((s, idx) => (
                                  <div key={`${s.category}-${idx}`} className="flex gap-4 p-4">
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#ece6df]">
                                      <svg className="h-8 w-8 text-[#c4bdb5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-[#2a1d14]">{s.category}</p>
                                      <p className="mt-1 text-xs leading-relaxed text-[#6b6560]">{s.description}</p>
                                      <p className="mt-1 text-xs text-[#9a928c]">
                                        Qty : {s.qty ?? '01'} {s.uom}
                                      </p>
                                    </div>
                                    <p className="shrink-0 text-sm font-bold tabular-nums" style={{ color: QUOTE.red }}>
                                      {inr(s.price)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {room.lofts.length > 0 ? (
                            <div className="rounded-xl border border-[#ece6df] p-4">
                              <p className="mb-3 text-sm font-semibold text-[#2a1d14]">Lofts</p>
                              <div className="space-y-2">
                                {room.lofts.map((l, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-[#5c5650]">{l.description}</span>
                                    <span className="font-semibold">{inr(l.price)}</span>
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
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Room-wise summary is not available in this response.
                </div>
              )}
            </div>
          )}
        </section>

        {/* Revision history */}
        {quoteVersionsLoading ? (
          <section className="rounded-2xl border border-[#ece6df] bg-white p-6 shadow-sm">
            <p className="text-sm" style={{ color: QUOTE.muted }}>
              Loading revision history…
            </p>
          </section>
        ) : null}
        {quoteVersionsError ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {quoteVersionsError}
          </section>
        ) : null}
        {!quoteVersionsLoading && !quoteVersionsError && quoteVersions.length > 1 ? (
          <section className="rounded-2xl border border-[#ece6df] bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-5 w-5" style={{ color: QUOTE.red }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="quote-heading text-lg font-bold text-[#2a1d14]">Revision History</h2>
            </div>
            <p className="mb-4 text-xs" style={{ color: QUOTE.muted }}>
              Each revision is saved for your reference. Click a version to open it.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {quoteVersions.map((v, idx) => {
                const isCurrent = String(v.quoteId) === String(versionFetchId);
                const href = `/quote/${encodeURIComponent(String(v.quoteId))}${internalVersionSuffix}`;
                return (
                  <a
                    key={`qv-${v.quoteId}-${idx}`}
                    href={href}
                    className={`block rounded-xl border p-5 transition-shadow hover:shadow-md ${
                      isCurrent
                        ? 'border-[#f5c6cb] bg-[#fff5f5]'
                        : 'border-[#ece6df] bg-white'
                    }`}
                    style={isCurrent ? { borderLeftWidth: 4, borderLeftColor: QUOTE.red } : undefined}
                  >
                    <p className="font-bold text-[#2a1d14]">
                      Version {idx + 1}
                      {isCurrent ? (
                        <span className="ml-2 text-sm font-normal" style={{ color: QUOTE.red }}>
                          (Current)
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: QUOTE.muted }}>
                      Created on {formatVersionDate(v.createdAt)}
                    </p>
                    <p className="mt-1 text-xs tabular-nums" style={{ color: QUOTE.muted }}>
                      ID {v.quoteId}
                    </p>
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function SectionIconSmall() {
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-md"
      style={{ backgroundColor: '#fde8ea', color: QUOTE.red }}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    </span>
  );
}
