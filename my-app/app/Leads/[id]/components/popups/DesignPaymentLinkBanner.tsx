'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/app/auth/AuthContext';
import { canUseEasebuzzOnline } from '@/app/lib/easebuzzAccess';
import LinkExpiryProgress from './LinkExpiryProgress';

export type DesignPaymentAttempt = {
  id?: string;
  status?: string;
  amount?: number;
  paymentLinkUrl?: string;
  linkUrl?: string;
  emailStatus?: string;
  expiresAt?: string;
  createdAt?: string;
  paymentFailureCount?: number;
  lastPaymentFailureReason?: string;
  bucket?: string;
};

type Props = {
  leadId: number;
  apiBase: string;
  sessionId: string | null;
  onPaid?: () => void;
  onSwitchOffline?: (bucket: 'DESIGN_10' | 'DESIGN_40') => void;
};

function formatInr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function IconResend({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5A1.5 1.5 0 0 1 21.75 8.25v9a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 7.5 8.4 6.3a1.5 1.5 0 0 0 1.8 0L21.6 7.5" />
    </svg>
  );
}

function IconEdit({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125 16.875 4.5" />
    </svg>
  );
}

/** Text chip — Switch offline / Cancel. */
function TextChip({
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
    >
      {children}
    </button>
  );
}

/** Icon-only — Copy / Resend / Edit. */
function IconChip({
  children,
  onClick,
  disabled,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#DDCDC1] bg-white text-[#32261C] transition-colors duration-150 hover:border-[#32261C]/40 hover:bg-[#F7F4F1] disabled:pointer-events-none disabled:opacity-45"
    >
      {children}
    </button>
  );
}

/**
 * Sticky banner when a Design Easebuzz link is unpaid.
 * Classic white chrome — text for Copy / Resend email; icons for the rest.
 */
export default function DesignPaymentLinkBanner({
  leadId,
  apiBase,
  sessionId,
  onPaid,
  onSwitchOffline,
}: Props) {
  const { user } = useAuth();
  const allowOnline = canUseEasebuzzOnline(user?.role);
  const [attempt, setAttempt] = useState<DesignPaymentAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paidNotified = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const headers = useCallback((): HeadersInit => {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (sessionId) h.Authorization = `Bearer ${sessionId}`;
    return h;
  }, [sessionId]);

  const load = useCallback(async () => {
    if (!sessionId || !allowOnline) return;
    try {
      const res = await fetch(`${apiBase}/api/design-payment/cases/${leadId}/payment-links/active`, {
        headers: headers(),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      const a = (data?.attempt || null) as DesignPaymentAttempt | null;
      setAttempt(a);
      const recentlyPaid = Boolean(data?.recentlyPaid);
      const attemptPaid = a && String(a.status).toUpperCase() === 'PAID';
      if ((recentlyPaid || attemptPaid) && !paidNotified.current) {
        paidNotified.current = true;
        onPaidRef.current?.();
      }
    } catch {
      /* ignore */
    }
  }, [allowOnline, apiBase, headers, leadId, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => void load(), 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(t);
    };
  }, [load]);

  const run = async (action: string, body?: Record<string, unknown>) => {
    if (!attempt?.id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/design-payment/payment-links/${attempt.id}/${action}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `${action} failed`);
      if (action === 'cancel') {
        setAttempt(null);
      } else if (action === 'switch-offline') {
        const bucket = String(attempt.bucket || 'DESIGN_10').includes('40') ? 'DESIGN_40' : 'DESIGN_10';
        setAttempt(null);
        onSwitchOffline?.(bucket);
      } else {
        setAttempt((data?.attempt as DesignPaymentAttempt) || attempt);
      }
      await load();
      if (data?.emailSent === false && typeof data?.message === 'string') {
        setError(data.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (!allowOnline || !attempt?.id || String(attempt.status).toUpperCase() === 'PAID') return null;

  const linkUrl = attempt.paymentLinkUrl || attempt.linkUrl || '';
  const bucketLabel = String(attempt.bucket || '').includes('40') ? 'Design 40%' : 'Design 10%';
  const statusLabel = String(attempt.status || 'PENDING').toUpperCase();

  return (
    <div className="mx-4 mt-2.5 xl:mx-6">
      <div className="pay-link-banner flex overflow-hidden rounded-xl border border-[#00B0ED]/20 bg-white transition-colors duration-300 hover:border-[#00B0ED]/35">
        <div className="w-[3px] flex-shrink-0 bg-[#00B0ED]/55" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Row 1: label · amount · status · email */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#32261C]">
                Pending link · {bucketLabel}
              </p>
              {attempt.amount != null ? (
                <span className="text-[15px] font-bold tabular-nums text-black">
                  {formatInr(Number(attempt.amount))}
                </span>
              ) : null}
              <span className="rounded border border-[#DDCDC1] bg-[#F1F2F6] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#32261C]">
                {statusLabel}
              </span>
              {attempt.emailStatus ? (
                <span className="text-xs font-medium text-[#32261C]">
                  Email {attempt.emailStatus}
                </span>
              ) : null}
            </div>

            <LinkExpiryProgress
              expiresAt={attempt.expiresAt}
              createdAt={attempt.createdAt}
              className="!mt-0 max-w-md"
            />

            {(attempt.paymentFailureCount ?? 0) > 0 && (
              <p className="text-xs text-[#EF0101]">
                Pay failures: {attempt.paymentFailureCount}
                {attempt.lastPaymentFailureReason ? ` — ${attempt.lastPaymentFailureReason}` : ''}
              </p>
            )}
            {error ? <p className="text-xs text-[#EF0101]">{error}</p> : null}
          </div>

          <div className="flex flex-wrap content-center items-center gap-2 sm:justify-end">
            <IconChip
              label={copied ? 'Copied' : 'Copy link'}
              disabled={busy || !linkUrl}
              onClick={async () => {
                if (!linkUrl) return;
                await navigator.clipboard.writeText(linkUrl);
                setCopied(true);
                void run('copy');
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? (
                <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                <IconCopy className="h-3.5 w-3.5" />
              )}
            </IconChip>
            <IconChip label="Resend email" disabled={busy} onClick={() => void run('resend')}>
              <IconResend className="h-3.5 w-3.5" />
            </IconChip>
            <IconChip
              label="Edit amount"
              disabled={busy}
              onClick={() => {
                const next = window.prompt('New amount (₹)', String(attempt.amount ?? ''));
                if (!next) return;
                void run('edit', { amount: Number(next) });
              }}
            >
              <IconEdit className="h-3.5 w-3.5" />
            </IconChip>

            <TextChip disabled={busy} onClick={() => void run('switch-offline')}>
              Switch offline
            </TextChip>
            <TextChip tone="danger" disabled={busy} onClick={() => void run('cancel')}>
              Cancel
            </TextChip>
          </div>
        </div>
      </div>
    </div>
  );
}
