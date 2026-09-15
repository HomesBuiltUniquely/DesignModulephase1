'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/app/auth/AuthContext';
import { canUseEasebuzzOnline } from '@/app/lib/easebuzzAccess';

export type DesignPaymentAttempt = {
  id?: string;
  status?: string;
  amount?: number;
  paymentLinkUrl?: string;
  linkUrl?: string;
  emailStatus?: string;
  expiresAt?: string;
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

function Chip({
  children,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'amber' | 'danger' | 'primary';
}) {
  const tones = {
    neutral:
      'border-[#DDCDC1] bg-white text-[#32261C] hover:border-[#32261C]/35 hover:bg-white hover:shadow-sm',
    primary:
      'border-[#00B0ED]/30 bg-white text-[#0077a3] hover:bg-[#00B0ED] hover:text-white hover:border-[#00B0ED]',
    amber:
      'border-amber-300 bg-white text-amber-900 hover:bg-amber-100',
    danger:
      'border-red-200 bg-white text-[#EF0101] hover:bg-[#EF0101] hover:text-white hover:border-[#EF0101]',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-45 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

/**
 * Sticky banner when a Design Easebuzz link is unpaid.
 * Status updates from CRM webhook → Design; light refresh on focus / every 60s (not 15s).
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (!allowOnline || !attempt?.id || String(attempt.status).toUpperCase() === 'PAID') return null;

  const linkUrl = attempt.paymentLinkUrl || attempt.linkUrl || '';
  const bucketLabel = String(attempt.bucket || '').includes('40') ? 'Design 40%' : 'Design 10%';

  return (
    <div className="animate-fadeInUp mx-4 mt-3 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-white shadow-sm xl:mx-6">
      <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-[#EBD457] to-[#00B0ED]" />
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
            Pending payment link · {bucketLabel}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#32261C]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase">
              <span className="animate-payDotPulse h-1.5 w-1.5 rounded-full bg-amber-500" />
              {attempt.status}
            </span>
            {attempt.amount != null ? (
              <span className="font-bold">{formatInr(Number(attempt.amount))}</span>
            ) : null}
            {attempt.emailStatus ? (
              <span className="text-xs text-[#0077a3]">Email {attempt.emailStatus}</span>
            ) : null}
          </p>
          {linkUrl ? (
            <p className="mt-1.5 truncate font-mono text-[11px] text-gray-500">{linkUrl}</p>
          ) : null}
          {(attempt.paymentFailureCount ?? 0) > 0 && (
            <p className="mt-1 text-xs text-[#EF0101]">
              Pay failures: {attempt.paymentFailureCount}
              {attempt.lastPaymentFailureReason ? ` — ${attempt.lastPaymentFailureReason}` : ''}
            </p>
          )}
          {error ? <p className="mt-1 text-xs text-[#EF0101]">{error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            tone="primary"
            disabled={busy || !linkUrl}
            onClick={async () => {
              if (!linkUrl) return;
              await navigator.clipboard.writeText(linkUrl);
              setCopied(true);
              void run('copy');
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Chip>
          <Chip disabled={busy} onClick={() => void run('resend')}>
            Resend
          </Chip>
          <Chip
            disabled={busy}
            onClick={() => {
              const next = window.prompt('New amount (₹)', String(attempt.amount ?? ''));
              if (!next) return;
              void run('edit', { amount: Number(next) });
            }}
          >
            Edit
          </Chip>
          <Chip tone="amber" disabled={busy} onClick={() => void run('switch-offline')}>
            Switch offline
          </Chip>
          <Chip tone="danger" disabled={busy} onClick={() => void run('cancel')}>
            Cancel
          </Chip>
        </div>
      </div>
    </div>
  );
}
