'use client';

/**
 * PaymentLinkCard — classic pending-link bar (Manrope + brand palette).
 *
 * Manrope is already loaded in `app/layout.tsx`:
 *   import { Manrope } from "next/font/google";
 *   const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], ... });
 *   <body className={`${manrope.variable} antialiased`}>
 *
 * Usage example (bottom of file).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type PaymentLinkStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';

export type PaymentLinkCardProps = {
  title: string;
  amount: number;
  currency?: string;
  status: PaymentLinkStatus;
  linkUrl: string;
  expiresAt: string | Date;
  createdAt?: string | Date;
  channelLabel?: string;
  resendCooldownSeconds?: number;
  onResend?: () => void | Promise<void>;
  onEdit?: () => void;
  onSwitchOffline?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  onCopied?: () => void;
  onExpired?: () => void;
  className?: string;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function parseDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatMoney(amount: number, currency: string): string {
  if (currency === 'INR') {
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  }
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('en-IN')}`;
  }
}

function formatExpiryClock(d: Date): string {
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatRemaining(msLeft: number): string {
  if (msLeft <= 0) return 'Expired';
  const totalSecs = Math.max(0, Math.ceil(msLeft / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m left`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s left`;
  return `${s}s left`;
}

function statusTone(status: PaymentLinkStatus): string {
  switch (status) {
    case 'PAID':
      return 'bg-[#DDCDC1]/50 text-[#32261C]';
    case 'EXPIRED':
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-[#F1F2F6] text-[#32261C]';
  }
}

function ActionChip({
  children,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
}) {
  const tones = {
    neutral:
      'border-[#DDCDC1] bg-white text-[#32261C] hover:border-[#32261C]/40 hover:bg-[#F7F4F1]',
    danger:
      'border-[#DDCDC1] bg-white text-[#EF0101] hover:border-[#EF0101]/45 hover:bg-[#FFF5F5]',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 ${tones[tone]}`}
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {children}
    </button>
  );
}

export default function PaymentLinkCard({
  title,
  amount,
  currency = 'INR',
  status,
  linkUrl,
  expiresAt,
  createdAt,
  channelLabel,
  resendCooldownSeconds = 30,
  onResend,
  onEdit,
  onSwitchOffline,
  onCancel,
  onCopied,
  onExpired,
  className = '',
}: PaymentLinkCardProps) {
  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [resendUntil, setResendUntil] = useState(0);
  const expiredFired = useRef(false);

  // Countdown starts only after mount — avoids hydration mismatch.
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const end = useMemo(() => parseDate(expiresAt), [expiresAt]);
  const start = useMemo(() => {
    const raw = parseDate(createdAt);
    if (raw) return raw;
    if (!end) return null;
    return new Date(end.getTime() - DEFAULT_TTL_MS);
  }, [createdAt, end]);

  const msLeft = end && now != null ? end.getTime() - now : null;
  const expired = msLeft != null && msLeft <= 0;
  const isPending = status === 'PENDING' && !expired;

  const remainingRatio = useMemo(() => {
    if (!end || !start || msLeft == null) return 0;
    if (msLeft <= 0) return 0;
    const totalMs = Math.max(60_000, end.getTime() - start.getTime());
    return Math.min(1, Math.max(0, msLeft / totalMs));
  }, [end, start, msLeft]);

  const pct = Math.round(remainingRatio * 100);
  const urgent = isPending && msLeft != null && msLeft <= 60 * 60 * 1000;

  useEffect(() => {
    if (!expired || expiredFired.current) return;
    expiredFired.current = true;
    onExpired?.();
  }, [expired, onExpired]);

  const resendCooldownLeft =
    now != null && resendUntil > now ? Math.ceil((resendUntil - now) / 1000) : 0;

  const runAsync = useCallback(async (fn?: () => void | Promise<void>) => {
    if (!fn) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleCopy = async () => {
    if (!linkUrl) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Could not copy link');
    }
  };

  const handleResend = async () => {
    if (resendCooldownLeft > 0 || !onResend) return;
    setBusy(true);
    setError(null);
    try {
      await onResend();
      setResendUntil(Date.now() + resendCooldownSeconds * 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resend failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCancel?.();
      setConfirmCancel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  };

  const displayStatus: PaymentLinkStatus =
    status === 'PENDING' && expired ? 'EXPIRED' : status;

  return (
    <div
      className={`flex overflow-hidden rounded-lg border border-[#DDCDC1] bg-white transition-colors duration-150 hover:border-[#32261C]/25 ${className}`}
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div className="w-[3px] flex-shrink-0 bg-[#32261C]" aria-hidden />

      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#32261C]/55">
            {title}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-lg font-semibold tabular-nums tracking-tight text-[#32261C]">
              {formatMoney(amount, currency)}
            </span>
            <span
              className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(displayStatus)}`}
            >
              {displayStatus}
            </span>
          </div>

          {channelLabel ? (
            <p className="mt-1 text-[12px] font-normal text-[#32261C]/50">{channelLabel}</p>
          ) : null}

          {/* Countdown + progress — PENDING only */}
          {status === 'PENDING' && end && (
            <div className="mt-3 max-w-sm">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <p
                  className={`text-[12px] tabular-nums ${
                    expired
                      ? 'font-medium text-[#EF0101]'
                      : urgent
                        ? 'font-medium text-[#32261C]'
                        : 'text-[#32261C]/65'
                  }`}
                >
                  {now == null ? (
                    <span className="text-[#32261C]/35">—</span>
                  ) : expired ? (
                    <>Expired · {formatExpiryClock(end)}</>
                  ) : (
                    <>
                      {formatRemaining(msLeft ?? 0)}
                      <span className="text-[#32261C]/40"> · {formatExpiryClock(end)}</span>
                    </>
                  )}
                </p>
                {!expired && now != null && (
                  <span className="text-[11px] tabular-nums text-[#32261C]/35">{pct}%</span>
                )}
              </div>
              <div
                className="h-[3px] overflow-hidden rounded-sm bg-[#DDCDC1]/70"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Link time remaining"
              >
                <div
                  className={`h-full rounded-sm transition-[width] duration-500 ease-out ${
                    expired ? 'bg-[#EF0101]' : urgent ? 'bg-[#32261C]' : 'bg-[#00B0ED]'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions — PENDING only */}
        {isPending && (
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <div className="flex flex-wrap content-start gap-2 sm:justify-end">
              <ActionChip disabled={busy || !linkUrl} onClick={() => void handleCopy()}>
                {copied ? 'Copied' : 'Copy link'}
              </ActionChip>

              {onResend && (
                <ActionChip
                  disabled={busy || resendCooldownLeft > 0}
                  onClick={() => void handleResend()}
                >
                  {resendCooldownLeft > 0 ? `Resend (${resendCooldownLeft}s)` : 'Resend email'}
                </ActionChip>
              )}

              {onEdit && (
                <ActionChip disabled={busy} onClick={onEdit}>
                  Edit amount or expiry
                </ActionChip>
              )}

              {onSwitchOffline && (
                <ActionChip disabled={busy} onClick={() => void runAsync(onSwitchOffline)}>
                  Switch to offline payment
                </ActionChip>
              )}

              {onCancel && !confirmCancel && (
                <ActionChip tone="danger" disabled={busy} onClick={() => setConfirmCancel(true)}>
                  Cancel link
                </ActionChip>
              )}
            </div>

            {confirmCancel && onCancel && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#DDCDC1] bg-[#FBF8F4] px-3 py-2">
                <p className="text-[12px] text-[#32261C]/70">Cancel this payment link?</p>
                <ActionChip tone="danger" disabled={busy} onClick={() => void handleCancelConfirm()}>
                  Yes, cancel link
                </ActionChip>
                <ActionChip disabled={busy} onClick={() => setConfirmCancel(false)}>
                  Keep link
                </ActionChip>
              </div>
            )}

            {error ? <p className="text-xs text-[#EF0101] sm:text-right">{error}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

/*
 * ── Usage ──────────────────────────────────────────────
 *
 * import PaymentLinkCard from '@/app/Components/PaymentLinkCard';
 *
 * <PaymentLinkCard
 *   title="Design 10% payment link"
 *   amount={4000}
 *   status="PENDING"
 *   linkUrl="https://pay.example.com/abc"
 *   expiresAt="2026-09-29T14:00:00+05:30"
 *   createdAt="2026-09-28T14:00:00+05:30"
 *   channelLabel="Sent by email"
 *   onResend={async () => { await api.resend(); }}
 *   onEdit={() => openEditModal()}
 *   onSwitchOffline={async () => { await api.switchOffline(); }}
 *   onCancel={async () => { await api.cancel(); }}
 *   onCopied={() => showToast('Link copied')}
 *   onExpired={() => refetchDeal()}
 * />
 */
