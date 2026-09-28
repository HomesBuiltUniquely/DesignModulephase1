'use client';

import { useEffect, useState } from 'react';
import { getApiBase } from '../lib/apiBase';

const API = getApiBase();

type PaymentStatusResponse = {
  ok: boolean;
  quoteId: string;
  leadId: number | null;
  quoteTotal: number;
  cumulativePaid: number;
  activeMilestone: 'CRM_10' | 'DESIGN_10' | 'DESIGN_40' | 'COMPLETED';
  milestoneLabel: string;
  amountDue: number;
  canPayNow: boolean;
};

type Props = {
  quoteId: string;
  totalPayableAmount?: number | null;
  customerName?: string;
  className?: string;
};

export function QuotePayNowButton({
  quoteId,
  totalPayableAmount,
  customerName,
  className = '',
}: Props) {
  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanQuoteId = String(quoteId || '').trim();

  useEffect(() => {
    if (!cleanQuoteId || cleanQuoteId === 'draft') return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${API}/api/public/quotes/${encodeURIComponent(cleanQuoteId)}/payment-status`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = (await res.json()) as PaymentStatusResponse;
        if (!cancelled && data.ok) {
          setStatus(data);
        }
      } catch {
        /* fallback to local calculations */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cleanQuoteId]);

  const fallbackAmount =
    totalPayableAmount != null && totalPayableAmount > 0
      ? Math.round(totalPayableAmount * 0.1)
      : null;

  const resolvedAmount =
    status?.amountDue != null && status.amountDue > 0
      ? status.amountDue
      : fallbackAmount;

  const isFullyPaid = status?.activeMilestone === 'COMPLETED';

  const handlePayNow = async () => {
    if (initiating || isFullyPaid) return;
    setInitiating(true);
    setError(null);

    try {
      const res = await fetch(
        `${API}/api/public/quotes/${encodeURIComponent(cleanQuoteId)}/initiate-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: customerName || undefined,
            quoteTotal: totalPayableAmount || undefined,
            amount: resolvedAmount || undefined,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok || !data.ok || !data.paymentUrl) {
        throw new Error(data.message || 'Failed to generate payment link. Please try again.');
      }

      window.location.href = data.paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initiate payment.');
      setInitiating(false);
    }
  };

  if (isFullyPaid) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-5 py-2 text-xs font-semibold text-emerald-800 shadow-sm ${className}`}
      >
        <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span>All Milestones Paid</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <button
        type="button"
        onClick={handlePayNow}
        disabled={initiating}
        aria-label="Pay Now"
        className="group relative inline-flex items-center justify-center gap-2.5 rounded-2xl px-10 py-3.5 text-base font-bold tracking-wide text-white transition-all duration-200 hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-90 sm:px-30 sm:py-3.5 sm:text-lg"
        style={{
          background: 'linear-gradient(180deg, #c3242a 0%, #aa1b20 100%)',
          boxShadow:
            '0 10px 24px -3px rgba(185, 28, 34, 0.42), 0 3px 8px -1px rgba(0, 0, 0, 0.12)',
        }}
      >
        {initiating ? (
          <>
            <svg
              className="h-5 w-5 animate-spin text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span className="text-sm font-semibold tracking-wide sm:text-base">
              Generating Secure Payment Link...
            </span>
          </>
        ) : (
          <>
            <span className="text-base sm:text-lg select-none" role="img" aria-label="Secure lock">
              🔒
            </span>
            <span>Pay Now</span>
            <span className="text-base font-bold transition-transform duration-200 ease-out group-hover:translate-x-1 sm:text-lg">
              →
            </span>
          </>
        )}
      </button>

      {error ? (
        <div className="mt-3 inline-flex items-center justify-center rounded-xl border border-red-200 bg-[#fff5f5] px-4 py-2 text-center text-xs text-[#b91c1c] sm:px-5 sm:py-2">
          {error}
        </div>
      ) : null}
    </div>
  );
}
