'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/app/auth/AuthContext';
import { canUseEasebuzzOnline } from '@/app/lib/easebuzzAccess';

type ActiveAttempt = {
  id?: string;
  status?: string;
  amount?: number;
  paymentLinkUrl?: string;
  linkUrl?: string;
  emailStatus?: string;
  whatsappStatus?: string;
  expiresAt?: string;
  paymentFailureCount?: number;
  lastPaymentFailureReason?: string;
};

type Props = {
  leadId: number;
  apiBase: string;
  sessionId: string | null;
  bucket: 'DESIGN_10' | 'DESIGN_40';
  defaultAmount?: number | null;
  onOfflineChosen: () => void;
  onOnlineSuccess?: () => void;
};

function formatInr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5A1.5 1.5 0 0 1 21.75 8.25v9a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 7.5 8.4 6.3a1.5 1.5 0 0 0 1.8 0L21.6 7.5" />
    </svg>
  );
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A1.5 1.5 0 0 0 4.5 20.25h15a1.5 1.5 0 0 0 1.5-1.5V16.5M7.5 9.75 12 5.25m0 0 4.5 4.5M12 5.25V16.5" />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
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
  tone?: 'neutral' | 'amber' | 'danger' | 'primary';
}) {
  const tones = {
    neutral:
      'border-[#DDCDC1] bg-white text-[#32261C] hover:border-[#32261C]/40 hover:bg-[#DDCDC1]/25 hover:shadow-sm',
    primary:
      'border-[#00B0ED]/40 bg-[#00B0ED]/10 text-[#0077a3] hover:bg-[#00B0ED] hover:text-white hover:border-[#00B0ED] hover:shadow-md',
    amber:
      'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-300 hover:shadow-sm',
    danger:
      'border-red-200 bg-red-50 text-[#EF0101] hover:bg-[#EF0101] hover:text-white hover:border-[#EF0101] hover:shadow-sm',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-45 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

/**
 * Online Easebuzz (email-only) vs Offline proof — Design Module.
 * CRM forwards DES* webhooks to Design; this UI refreshes on focus / 60s.
 */
export default function DesignPaymentMethodPanel({
  leadId,
  apiBase,
  sessionId,
  bucket,
  defaultAmount,
  onOfflineChosen,
  onOnlineSuccess,
}: Props) {
  const { user } = useAuth();
  const allowOnline = canUseEasebuzzOnline(user?.role);
  const [method, setMethod] = useState<'choose' | 'online' | 'offline'>('choose');
  const [amount, setAmount] = useState<string>(
    defaultAmount != null && defaultAmount > 0 ? String(Math.round(defaultAmount)) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<ActiveAttempt | null>(null);
  const [copied, setCopied] = useState(false);
  const [paidNotice, setPaidNotice] = useState(false);
  const paidNotified = useRef(false);
  const onOnlineSuccessRef = useRef(onOnlineSuccess);
  onOnlineSuccessRef.current = onOnlineSuccess;

  const authHeaders = useCallback((): HeadersInit => {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (sessionId) h.Authorization = `Bearer ${sessionId}`;
    return h;
  }, [sessionId]);

  const loadActive = useCallback(async () => {
    if (!sessionId || !allowOnline) return;
    try {
      const res = await fetch(
        `${apiBase}/api/design-payment/cases/${leadId}/payment-links/active`,
        { headers: authHeaders(), cache: 'no-store' },
      );
      const data = await res.json().catch(() => ({}));
      const a = (data?.attempt || null) as ActiveAttempt | null;
      setAttempt(a);
      const recentlyPaid = Boolean(data?.recentlyPaid);
      const attemptPaid = a && String(a.status).toUpperCase() === 'PAID';
      if ((recentlyPaid || attemptPaid) && !paidNotified.current) {
        paidNotified.current = true;
        setPaidNotice(true);
        onOnlineSuccessRef.current?.();
      }
    } catch {
      /* ignore poll errors */
    }
  }, [allowOnline, apiBase, authHeaders, leadId, sessionId]);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  useEffect(() => {
    if (!attempt?.id || String(attempt.status).toUpperCase() === 'PAID') return;
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadActive();
    };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => void loadActive(), 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(t);
    };
  }, [attempt?.id, attempt?.status, loadActive]);

  useEffect(() => {
    if (defaultAmount != null && defaultAmount > 0) {
      setAmount(String(Math.round(defaultAmount)));
    }
  }, [defaultAmount]);

  const createLink = async () => {
    if (!sessionId) {
      setError('Not signed in');
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/design-payment/cases/${leadId}/payment-links`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ bucket, amount: amt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setAttempt((data?.attempt as ActiveAttempt) || null);
        setError('A payment link is already active. Use the actions on the yellow bar.');
        return;
      }
      if (res.status === 503) {
        setError(data?.message || 'Easebuzz unavailable. Please use Offline proof.');
        return;
      }
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to create link');
      setAttempt((data?.attempt as ActiveAttempt) || null);
      setMethod('online');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create payment link');
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: string, body?: Record<string, unknown>) => {
    if (!attempt?.id || !sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/api/design-payment/payment-links/${attempt.id}/${action}`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(body || {}),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `${action} failed`);
      if (action === 'switch-offline' || action === 'cancel') {
        setAttempt(null);
        if (action === 'switch-offline') {
          setMethod('offline');
          onOfflineChosen();
        }
      } else {
        setAttempt((data?.attempt as ActiveAttempt) || attempt);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const linkUrl = attempt?.paymentLinkUrl || attempt?.linkUrl || '';
  const amountNum = Number(amount);
  const amountPreview = Number.isFinite(amountNum) && amountNum > 0 ? formatInr(amountNum) : '';

  if (!allowOnline) return null;

  if (paidNotice) {
    return (
      <div className="animate-fadeInUp mb-5 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg text-white shadow-md">
            ✓
          </span>
          <div>
            <p className="text-sm font-bold text-emerald-900">Payment received and auto-approved</p>
            <p className="mt-0.5 text-xs leading-relaxed text-emerald-800">
              Receipt emailed. Collection and approval are marked complete — check activity history.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (method === 'choose' && !attempt) {
    return (
      <div className="animate-fadeInUp mb-5">
        <p className="mb-3 text-sm leading-relaxed text-[#32261C]/75">
          Choose how to collect. Online sends an Easebuzz link by <span className="font-semibold text-[#32261C]">email only</span>
          {' '}(no WhatsApp). Offline uploads proof for Finance review.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMethod('online')}
            className="group card-hover relative overflow-hidden rounded-2xl border border-[#00B0ED]/25 bg-gradient-to-br from-[#00B0ED]/8 via-white to-white p-4 text-left shadow-sm transition-all duration-300 hover:border-[#00B0ED] hover:shadow-[0_10px_28px_rgba(0,176,237,0.18)]"
          >
            <span className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[#00B0ED]/10 transition-transform duration-300 group-hover:scale-125" />
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#00B0ED] text-white shadow-md shadow-[#00B0ED]/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]">
              <IconMail className="h-5 w-5" />
            </span>
            <p className="text-sm font-bold text-[#32261C]">Online · Easebuzz</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Email payment link. Auto-approves when the customer pays.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#00B0ED] transition-all group-hover:gap-2">
              Continue <span aria-hidden>→</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod('offline');
              onOfflineChosen();
            }}
            className="group card-hover relative overflow-hidden rounded-2xl border border-[#DDCDC1] bg-gradient-to-br from-[#DDCDC1]/35 via-white to-white p-4 text-left shadow-sm transition-all duration-300 hover:border-[#32261C]/35 hover:shadow-[0_10px_28px_rgba(50,38,28,0.12)]"
          >
            <span className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[#DDCDC1]/40 transition-transform duration-300 group-hover:scale-125" />
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#32261C] text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]">
              <IconUpload className="h-5 w-5" />
            </span>
            <p className="text-sm font-bold text-[#32261C]">Offline · Proof</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Upload screenshots or PDF. Finance reviews and approves.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#32261C] transition-all group-hover:gap-2">
              Continue <span aria-hidden>→</span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 space-y-3">
      {(method === 'online' || attempt) && (
        <div className="animate-fadeInUp overflow-hidden rounded-2xl border border-[#00B0ED]/25 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-[#00B0ED]/15 bg-gradient-to-r from-[#00B0ED]/10 to-transparent px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00B0ED] text-white shadow-sm">
                <IconMail className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#0077a3]">
                  Online payment
                </p>
                <p className="text-[11px] text-gray-500">Email only · no WhatsApp</p>
              </div>
            </div>
            {!attempt && (
              <button
                type="button"
                className="rounded-full px-3 py-1 text-xs font-semibold text-[#32261C]/70 transition-all hover:bg-[#DDCDC1]/50 hover:text-[#32261C]"
                onClick={() => {
                  setMethod('choose');
                  setError(null);
                }}
              >
                ← Back
              </button>
            )}
          </div>

          {!attempt && (
            <div className="px-4 py-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#32261C]">
                Amount
              </label>
              <div className="flex flex-wrap items-stretch gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#32261C]/45">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-xl border border-[#DDCDC1] bg-[#F1F2F6]/50 py-2.5 pl-8 pr-3 text-sm font-semibold text-[#32261C] outline-none transition-all duration-200 focus:border-[#00B0ED] focus:bg-white focus:ring-4 focus:ring-[#00B0ED]/15"
                    value={amount}
                    placeholder="0"
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createLink()}
                  title="Send email link"
                  aria-label="Send email link"
                  className="inline-flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-xl bg-[#00B0ED] text-white shadow-md shadow-[#00B0ED]/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0099d1] hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
                >
                  {busy ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <IconSend className="h-5 w-5" />
                  )}
                </button>
              </div>
              {amountPreview ? (
                <p className="mt-2 text-xs text-[#32261C]/55">
                  Customer will be asked to pay <span className="font-semibold text-[#32261C]">{amountPreview}</span>
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-400">Enter the amount to collect, then send the link.</p>
              )}
            </div>
          )}

          {attempt && (
            <div className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900">
                  <span className="animate-payDotPulse h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {attempt.status || 'PENDING'}
                </span>
                {attempt.amount != null && (
                  <span className="rounded-full bg-[#32261C] px-2.5 py-1 text-[11px] font-bold text-white">
                    {formatInr(Number(attempt.amount))}
                  </span>
                )}
                {attempt.emailStatus && (
                  <span className="rounded-full bg-[#00B0ED]/10 px-2.5 py-1 text-[11px] font-semibold text-[#0077a3]">
                    Email {attempt.emailStatus}
                  </span>
                )}
              </div>
              {linkUrl && (
                <p className="truncate rounded-lg border border-[#DDCDC1] bg-[#F1F2F6]/80 px-3 py-2 font-mono text-[11px] text-gray-600">
                  {linkUrl}
                </p>
              )}
              {(attempt.paymentFailureCount ?? 0) > 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Customer pay failures: {attempt.paymentFailureCount}
                  {attempt.lastPaymentFailureReason ? ` — ${attempt.lastPaymentFailureReason}` : ''}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <ActionChip
                  tone="primary"
                  disabled={busy || !linkUrl}
                  onClick={async () => {
                    if (!linkUrl) return;
                    await navigator.clipboard.writeText(linkUrl);
                    setCopied(true);
                    void runAction('copy');
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  <IconCopy className="h-3.5 w-3.5" />
                  {copied ? 'Copied' : 'Copy link'}
                </ActionChip>
                <ActionChip disabled={busy} onClick={() => void runAction('resend')}>
                  Resend email
                </ActionChip>
                <ActionChip
                  disabled={busy}
                  onClick={() => {
                    const next = window.prompt('New amount (₹)', String(attempt.amount ?? amount));
                    if (!next) return;
                    void runAction('edit', { amount: Number(next) });
                  }}
                >
                  Edit amount
                </ActionChip>
                <ActionChip tone="amber" disabled={busy} onClick={() => void runAction('switch-offline')}>
                  Switch offline
                </ActionChip>
                <ActionChip tone="danger" disabled={busy} onClick={() => void runAction('cancel')}>
                  Cancel link
                </ActionChip>
              </div>
              <p className="text-[11px] text-gray-400">
                Paid or failed updates come from the CRM webhook. This screen refreshes on focus or every 60s.
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="animate-fadeInUp rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#EF0101]">
          {error}
        </p>
      )}
    </div>
  );
}
