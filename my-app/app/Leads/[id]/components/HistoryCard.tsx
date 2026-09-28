'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HistoryEvent, HistoryEventType } from '../types';
import DqcDesignerFeedbackCard from './DqcDesignerFeedbackCard';

type Props = {
  cardClass: string;
  onToggleMaximize: () => void;
  isMaximized: boolean;
  historyEvents: HistoryEvent[];
  onViewTaskDetails: (event: HistoryEvent) => void;
  currentMilestoneIndex: number;
  totalMilestones: number;
  showDqcFeedback?: boolean;
  leadId?: number | null;
  sessionId?: string | null;
};

/** Top-level history filters (maximized only). */
type MainFilter = 'all' | 'payment' | 'dqc';
type PaymentSubFilter = 'all' | 'link' | 'received' | 'failed' | 'offline' | 'cancelled';

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffMins < 60) return `${Math.max(0, diffMins)} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday, ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function sanitizeHistoryDescription(raw: string): string {
  let text = String(raw || '');
  text = text.replace(/\s*WhatsApp skipped\.?/gi, '');
  text = text.replace(/\s*\(no WhatsApp\)\.?/gi, '');
  text = text.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').trim();
  return text;
}

function paymentKindOf(ev: HistoryEvent): string {
  const details = ev.details as { paymentKind?: string; kind?: string } | undefined;
  const fromDetails = String(details?.paymentKind || '').toUpperCase();
  if (fromDetails.startsWith('DESIGN_PAYMENT')) return fromDetails;
  const desc = String(ev.description || '').toLowerCase();
  if (desc.includes('payment link') && desc.includes('cancel')) return 'DESIGN_PAYMENT_LINK_CANCELLED';
  if (desc.includes('payment link') && (desc.includes('resent') || desc.includes('resend'))) {
    return 'DESIGN_PAYMENT_LINK_RESENT';
  }
  if (desc.includes('payment link') && desc.includes('copied')) return 'DESIGN_PAYMENT_LINK_COPIED';
  if (desc.includes('payment link') && (desc.includes('edit') || desc.includes('updated'))) {
    return 'DESIGN_PAYMENT_LINK_EDITED';
  }
  if (desc.includes('payment link') || desc.includes('online payment')) return 'DESIGN_PAYMENT_LINK_SENT';
  if (desc.includes('switch') && desc.includes('offline')) return 'DESIGN_PAYMENT_SWITCH_OFFLINE';
  if (desc.includes('payment') && (desc.includes('paid') || desc.includes('received') || desc.includes('approved'))) {
    return 'DESIGN_PAYMENT_PAID';
  }
  if (desc.includes('partial') && desc.includes('payment')) return 'DESIGN_PAYMENT_PARTIAL';
  if (desc.includes('payment') && desc.includes('fail')) return 'DESIGN_PAYMENT_FAILED';
  if (desc.includes('10p') || desc.includes('40p') || desc.includes('10%') || desc.includes('40%')) {
    if (desc.includes('upload') || desc.includes('offline') || desc.includes('screenshot')) {
      return 'DESIGN_PAYMENT_OFFLINE';
    }
  }
  return '';
}

function isPaymentEvent(ev: HistoryEvent): boolean {
  return Boolean(paymentKindOf(ev));
}

function isDqcEvent(ev: HistoryEvent): boolean {
  if (isPaymentEvent(ev)) return false;
  const desc = String(ev.description || '').toLowerCase();
  const details = ev.details as { taskName?: string; milestoneName?: string; kind?: string } | undefined;
  const task = String(details?.taskName || '').toLowerCase();
  const mile = String(details?.milestoneName || '').toLowerCase();
  const blob = `${desc} ${task} ${mile}`;
  return (
    blob.includes('dqc') ||
    blob.includes('design qc') ||
    blob.includes('dqe') ||
    /\bdqc\s*[12]\b/.test(blob)
  );
}

function paymentCategory(ev: HistoryEvent): Exclude<PaymentSubFilter, 'all'> | null {
  const kind = paymentKindOf(ev);
  if (!kind) return null;
  if (kind.includes('PAID') || kind.includes('RECEIVED') || kind.includes('APPROV') || kind.includes('PARTIAL')) {
    return 'received';
  }
  if (kind.includes('FAIL')) return 'failed';
  if (kind.includes('CANCEL')) return 'cancelled';
  if (kind.includes('OFFLINE') || kind.includes('SWITCH')) return 'offline';
  if (kind.includes('LINK') || kind.includes('EMAIL') || kind.includes('COPIED') || kind.includes('EDIT')) {
    return 'link';
  }
  return 'link';
}

function eventTypeBadge(type: HistoryEventType, paymentCat: string | null): { label: string; className: string } {
  if (paymentCat === 'received') return { label: 'RECEIVED', className: 'bg-[#DDCDC1]/50 text-[#32261C]' };
  if (paymentCat === 'failed') return { label: 'FAILED', className: 'bg-red-50 text-[#EF0101]' };
  if (paymentCat === 'cancelled') return { label: 'CANCELLED', className: 'bg-gray-100 text-gray-700' };
  if (paymentCat === 'offline') return { label: 'OFFLINE', className: 'bg-[#DDCDC1]/40 text-[#32261C]' };
  if (paymentCat === 'link') return { label: 'LINK', className: 'bg-[#F1F2F6] text-[#32261C]' };
  if (!type) return { label: 'EVENT', className: 'bg-gray-100 text-gray-700' };
  switch (type) {
    case 'completed':
      return { label: 'COMPLETED', className: 'bg-[#DDCDC1]/40 text-[#32261C]' };
    case 'delayed':
      return { label: 'DELAYED', className: 'bg-red-50 text-[#EF0101]' };
    case 'note':
      return { label: 'NOTE', className: 'bg-[#F1F2F6] text-[#32261C]' };
    case 'owner_change':
      return { label: 'OWNER', className: 'bg-gray-100 text-gray-800' };
    case 'file_upload':
      return { label: 'FILE', className: 'bg-[#DDCDC1]/40 text-[#32261C]' };
    default:
      return { label: String(type).toUpperCase(), className: 'bg-gray-100 text-gray-700' };
  }
}

function EventIcon({ type, paymentCat }: { type: HistoryEventType; paymentCat: string | null }) {
  const base = 'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm';
  if (paymentCat === 'received') return <div className={`${base} bg-[#DDCDC1]/50 text-[#32261C]`}>₹</div>;
  if (paymentCat === 'failed') return <div className={`${base} bg-red-50 text-[#EF0101]`}>!</div>;
  if (paymentCat === 'link') return <div className={`${base} bg-[#F1F2F6] text-[#32261C]`}>↗</div>;
  if (paymentCat === 'offline') return <div className={`${base} bg-[#DDCDC1]/40 text-[#32261C]`}>⬆</div>;
  if (paymentCat === 'cancelled') return <div className={`${base} bg-gray-100 text-gray-600`}>×</div>;
  switch (type) {
    case 'completed':
      return <div className={`${base} bg-[#DDCDC1]/40 text-[#32261C]`}>✓</div>;
    case 'delayed':
      return <div className={`${base} bg-red-50 text-[#EF0101]`}>⚠</div>;
    case 'note':
      return <div className={`${base} bg-[#F1F2F6] text-[#32261C]`}>·</div>;
    case 'owner_change':
      return <div className={`${base} bg-gray-100 text-gray-700`}>👥</div>;
    case 'file_upload':
      return <div className={`${base} bg-[#DDCDC1]/40 text-[#32261C]`}>📄</div>;
    default:
      return <div className={`${base} bg-gray-100 text-gray-600`}>•</div>;
  }
}

const PAYMENT_SUBS: { id: PaymentSubFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'link', label: 'Link' },
  { id: 'received', label: 'Received' },
  { id: 'failed', label: 'Failed' },
  { id: 'offline', label: 'Offline' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function HistoryCard({
  cardClass,
  onToggleMaximize,
  isMaximized,
  historyEvents,
  onViewTaskDetails,
  currentMilestoneIndex,
  totalMilestones,
  showDqcFeedback = false,
  leadId = null,
  sessionId = null,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [mainFilter, setMainFilter] = useState<MainFilter>('all');
  const [paymentSub, setPaymentSub] = useState<PaymentSubFilter>('all');
  useEffect(() => setMounted(true), []);

  const progressPct =
    totalMilestones > 0 ? Math.round((currentMilestoneIndex / (totalMilestones - 1)) * 100) : 0;
  const relativeTime = (iso: string) => (mounted ? formatRelativeTime(iso) : '—');

  const paymentEvents = useMemo(() => historyEvents.filter(isPaymentEvent), [historyEvents]);
  const dqcEvents = useMemo(() => historyEvents.filter(isDqcEvent), [historyEvents]);

  const paymentCounts = useMemo(() => {
    const counts: Record<PaymentSubFilter, number> = {
      all: paymentEvents.length,
      link: 0,
      received: 0,
      failed: 0,
      offline: 0,
      cancelled: 0,
    };
    for (const ev of paymentEvents) {
      const cat = paymentCategory(ev);
      if (cat) counts[cat] += 1;
    }
    return counts;
  }, [paymentEvents]);

  const listEvents = useMemo(() => {
    if (!isMaximized || mainFilter === 'all') return historyEvents;
    if (mainFilter === 'dqc') return dqcEvents;
    if (paymentSub === 'all') return paymentEvents;
    return paymentEvents.filter((ev) => paymentCategory(ev) === paymentSub);
  }, [historyEvents, paymentEvents, dqcEvents, isMaximized, mainFilter, paymentSub]);

  useEffect(() => {
    if (!isMaximized) {
      setMainFilter('all');
      setPaymentSub('all');
    }
  }, [isMaximized]);

  const renderEventCard = (ev: HistoryEvent, index: number, compact: boolean) => {
    const payCat = paymentCategory(ev);
    const badge = eventTypeBadge(ev.type, payCat);
    const description = sanitizeHistoryDescription(ev.description);
    const noteText =
      ev.type === 'note' && ev.details && (ev.details as { kind?: string }).kind === 'note'
        ? sanitizeHistoryDescription(String((ev.details as { noteText?: string }).noteText || ''))
        : '';
    const showQuote = Boolean(noteText && noteText !== description);
    const showViewDetails =
      !compact &&
      (ev.type === 'completed' || ev.type === 'file_upload' || ev.type === 'note') &&
      ev.details &&
      !payCat;

    if (compact) {
      return (
        <div
          key={`${ev.id}-${index}`}
          className="flex items-start gap-2 rounded-lg border border-[#DDCDC1] bg-white p-2 transition-colors duration-150 hover:border-[#32261C]/35 hover:bg-[#FBF8F4]"
        >
          <EventIcon type={ev.type} paymentCat={payCat} />
          <div className="min-w-0 flex-1">
            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}>
              {badge.label}
            </span>
            <p className="mt-1 line-clamp-2 text-xs text-[#32261C]/85">{description}</p>
            <p className="mt-0.5 text-[10px] text-gray-400">
              {relativeTime(ev.timestamp)} · {ev.user?.name ?? 'System'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        key={`${ev.id}-${index}`}
        className="history-card-in flex gap-3 rounded-xl border border-[#DDCDC1] bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#32261C]/30 hover:shadow-[0_8px_20px_rgba(50,38,28,0.06)]"
        style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      >
        <EventIcon type={ev.type} paymentCat={payCat} />
        <div className="min-w-0 flex-1">
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.label} · {relativeTime(ev.timestamp)}
          </span>
          <p className="mt-2 text-sm text-[#32261C]/90">{description}</p>
          {showQuote && (
            <div className="mt-2 rounded-lg border border-[#DDCDC1] bg-[#F7F4F1] p-2 text-sm text-gray-700">
              {noteText}
            </div>
          )}
          {ev.type === 'file_upload' && ev.details && (ev.details as { kind?: string }).kind === 'file_upload' && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <span>📄</span>
              <span>{(ev.details as { fileName: string }).fileName}</span>
            </div>
          )}
          {showViewDetails && (
            <button
              type="button"
              onClick={() => onViewTaskDetails(ev)}
              className="mt-2 text-sm font-medium text-[#00B0ED] transition-colors hover:text-[#0077a3] hover:underline"
            >
              View Task Details →
            </button>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end">
          {ev.user?.avatar ? (
            <img src={ev.user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" title={ev.user.name} />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DDCDC1]/50 text-xs text-[#32261C]"
              title={ev.user?.name}
            >
              {(ev.user?.name || 'S').slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="mt-1 max-w-[80px] truncate text-xs text-gray-500">{ev.user?.name ?? 'System'}</span>
        </div>
      </div>
    );
  };

  const chipBase =
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-200 hover:-translate-y-0.5';
  const chipActive = 'border-[#32261C] bg-[#32261C] text-white shadow-sm';
  const chipIdle = 'border-[#DDCDC1] bg-white text-[#32261C]/75 hover:border-[#32261C]/35 hover:bg-[#F7F4F1]';

  return (
    <div className={cardClass}>
      {!isMaximized ? (
        <>
          <div className="flex items-center justify-between px-4">
            <h2 className="text-lg font-bold text-gray-900">History</h2>
            <button
              onClick={onToggleMaximize}
              className="rounded-full border border-gray-200 bg-white p-2 shadow-sm transition-colors hover:bg-gray-50"
              aria-label="Maximize"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-5 w-5 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
          </div>

          <div className="m-4 text-left xl:mt-4">
            <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
              {showDqcFeedback && leadId && sessionId && (
                <div className="mb-3 border-b border-gray-200 pb-3">
                  <DqcDesignerFeedbackCard leadId={leadId} sessionId={sessionId} embedded />
                </div>
              )}
              {historyEvents.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No action done yet.</p>
              ) : (
                historyEvents.slice(0, 8).map((ev, index) => renderEventCard(ev, index, true))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-full min-h-0 flex-col overflow-hidden text-left">
          {/* Slim header: title + filters + close in one compact block */}
          <div className="mb-2 flex flex-shrink-0 items-center justify-between gap-3 border-b border-[#DDCDC1]/70 pb-2">
            <div className="min-w-0 flex flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-[#32261C]">History</h1>
                <span className="rounded-full bg-[#F1F2F6] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#32261C]/65">
                  {listEvents.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMainFilter('all');
                    setPaymentSub('all');
                  }}
                  className={`${chipBase} ${mainFilter === 'all' ? chipActive : chipIdle}`}
                >
                  All
                  <span className={`tabular-nums ${mainFilter === 'all' ? 'text-white/70' : 'text-[#32261C]/35'}`}>
                    {historyEvents.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMainFilter('payment');
                    setPaymentSub('all');
                  }}
                  className={`${chipBase} ${mainFilter === 'payment' ? chipActive : chipIdle}`}
                  title="Show payment history"
                >
                  <span
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] ${
                      mainFilter === 'payment' ? 'bg-white/20' : 'bg-[#DDCDC1]/50'
                    }`}
                  >
                    ₹
                  </span>
                  Payment
                  <span className={`tabular-nums ${mainFilter === 'payment' ? 'text-white/70' : 'text-[#32261C]/35'}`}>
                    {paymentCounts.all}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMainFilter('dqc');
                    setPaymentSub('all');
                  }}
                  className={`${chipBase} ${mainFilter === 'dqc' ? chipActive : chipIdle}`}
                  title="Show DQC history"
                >
                  DQC
                  <span className={`tabular-nums ${mainFilter === 'dqc' ? 'text-white/70' : 'text-[#32261C]/35'}`}>
                    {dqcEvents.length}
                  </span>
                </button>
              </div>
            </div>

            <button
              onClick={onToggleMaximize}
              className="flex-shrink-0 rounded-full border border-gray-200 bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-50"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-4 w-4 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Payment sub-rounds — only when Payment filter is active */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              mainFilter === 'payment' ? 'mb-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="flex flex-wrap gap-1 rounded-lg border border-[#DDCDC1] bg-white p-1.5">
                {PAYMENT_SUBS.map(({ id, label }) => {
                  const count = paymentCounts[id];
                  const active = paymentSub === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPaymentSub(id)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all duration-200 hover:-translate-y-0.5 ${
                        active
                          ? 'border-[#32261C] bg-[#32261C] text-white shadow-sm'
                          : 'border-[#DDCDC1] bg-white text-[#32261C]/70 hover:border-[#32261C]/30'
                      }`}
                    >
                      {label}
                      <span className={`ml-1 tabular-nums ${active ? 'text-white/65' : 'text-[#32261C]/35'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-2" key={`${mainFilter}-${paymentSub}`}>
            {showDqcFeedback && leadId && sessionId && mainFilter === 'all' && (
              <div className="mb-3 border-b border-gray-200 pb-3">
                <DqcDesignerFeedbackCard leadId={leadId} sessionId={sessionId} embedded />
              </div>
            )}
            {listEvents.length === 0 ? (
              <p className="animate-fadeInUp py-8 text-center text-sm text-gray-500">
                {mainFilter === 'payment'
                  ? 'No payment activity in this category.'
                  : mainFilter === 'dqc'
                    ? 'No DQC activity yet.'
                    : 'No activity yet.'}
              </p>
            ) : (
              listEvents.map((ev, index) => renderEventCard(ev, index, false))
            )}
          </div>

          {/* Slim progress footer */}
          <div className="mt-2 flex flex-shrink-0 items-center gap-3 rounded-lg bg-[#EF0101]/90 px-3 py-2 text-white">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/80">
                  Milestone status
                </p>
                <p className="text-sm font-bold tabular-nums">{progressPct}% overall</p>
              </div>
              <div className="mt-1 h-1 max-w-xs overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              className="flex-shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-[#32261C] transition-colors hover:bg-[#DDCDC1]/30"
            >
              Generate Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
