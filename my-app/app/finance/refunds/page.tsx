'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

type QueueTab = 'pending' | 'approved';

type FinanceRefundRow = {
  refundId: string;
  designLeadId: number;
  bookingTokenRecordId: string;
  customerName?: string | null;
  leadIdentifier?: string | null;
  refundAmount: number;
  amountTowardTenRefund?: number;
  extraAmountRefund?: number;
  cancellationReason?: string | null;
  cancellationApprovedAt?: string | null;
  cancellationApprovedBy?: string | null;
  financeApprovedAt?: string | null;
  financeApprovedBy?: string | null;
  refundScope?: string | null;
  status?: string;
  createdAt?: string | null;
};

function formatInr(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function safeInternalPath(value: string | null): string | null {
  if (!value) return null;
  const decoded = decodeURIComponent(value).trim();
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
  return decoded;
}

function FinanceRefundsPageInner() {
  const { user, sessionId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const backTo = safeInternalPath(searchParams.get('from')) || '/finance';

  const [refunds, setRefunds] = useState<FinanceRefundRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueTab, setQueueTab] = useState<QueueTab>('pending');
  const [customerFilter, setCustomerFilter] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (sessionId) headers.Authorization = `Bearer ${sessionId}`;
    return headers;
  }, [sessionId]);

  const role = (user?.role || '').toLowerCase();
  const isFinance = role === 'finance' || role === 'admin';

  const loadRefunds = useCallback(async () => {
    if (!sessionId) {
      setRefunds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const name = customerFilter.trim();
      if (name) params.set('customer', name);
      params.set('status', queueTab === 'approved' ? 'APPROVED' : 'PENDING');
      const res = await fetch(`${getApiBase()}/api/sales-closure/finance-refunds?${params.toString()}`, {
        headers: { ...authHeaders },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string })?.message || 'Failed to load refunds');
      setRefunds(Array.isArray(data) ? (data as FinanceRefundRow[]) : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load refunds');
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, authHeaders, customerFilter, queueTab]);

  useEffect(() => {
    void loadRefunds();
  }, [loadRefunds]);

  const onApprove = async (refundId: string) => {
    setApprovingId(refundId);
    setError(null);
    try {
      const res = await fetch(
        `${getApiBase()}/api/sales-closure/finance-refunds/${encodeURIComponent(refundId)}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string })?.message || 'Approve failed');
      setQueueTab('approved');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setApprovingId(null);
    }
  };

  const goBack = () => {
    router.push(backTo);
  };

  if (role && !isFinance) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900">Refunds</h1>
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50"
            >
              Back
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">You don&apos;t have access to this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-gray-900">Refunds</h1>
              <button
                type="button"
                onClick={goBack}
                className="shrink-0 px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50"
              >
                Back
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              CRM Booking &amp; Token cancellation refunds. Approve pending items; approved history is kept
              separately.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setQueueTab('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                queueTab === 'pending' ? 'bg-rose-700 text-white' : 'border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Pending approval
            </button>
            <button
              type="button"
              onClick={() => setQueueTab('approved')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                queueTab === 'approved' ? 'bg-teal-700 text-white' : 'border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Approved history
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="/finance"
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50"
            >
              10% Payment
            </a>
            <a
              href="/finance/sales-closure"
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50"
            >
              Sales Closure
            </a>
            <a
              href="/finance/40"
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50"
            >
              40% Payment
            </a>
            <button
              type="button"
              onClick={() => void loadRefunds()}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl border border-rose-200 bg-rose-50/60 flex flex-wrap gap-3 items-end">
          <div className="min-w-[220px] flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Customer name</label>
            <input
              type="text"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="Search…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadRefunds()}
            className="px-4 py-2 rounded-lg bg-rose-700 text-white text-sm font-semibold hover:bg-rose-800"
          >
            Apply
          </button>
        </div>

        {error && <div className="text-sm text-red-600 mt-4">{error}</div>}

        <div className="mt-5 border border-gray-200 rounded-2xl overflow-x-auto">
          <div
            className={`min-w-[1100px] grid grid-cols-12 px-4 py-3 text-xs font-semibold ${
              queueTab === 'pending' ? 'bg-rose-50 text-rose-900' : 'bg-teal-50 text-teal-900'
            }`}
          >
            <div className="col-span-2">Refund ID</div>
            <div className="col-span-2">Customer</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2">Split (10% / extra)</div>
            <div className="col-span-2">{queueTab === 'pending' ? 'CRM approved' : 'Finance approved'}</div>
            <div className="col-span-2 text-right">{queueTab === 'pending' ? 'Actions' : 'Lead'}</div>
          </div>
          {refunds.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-600">
              {loading
                ? 'Loading…'
                : queueTab === 'pending'
                  ? 'No refunds pending Finance approval.'
                  : 'No approved refund history yet.'}
            </div>
          ) : (
            refunds.map((r) => (
              <div
                key={r.refundId}
                className="min-w-[1100px] grid grid-cols-12 px-4 py-3 border-t border-gray-200 items-center gap-1 text-sm"
              >
                <div className="col-span-2 font-mono text-xs break-all" title={r.refundId}>
                  {r.refundId}
                  <div className="mt-0.5 text-[10px] font-semibold uppercase text-rose-700">
                    {r.refundScope || 'deal'} · {r.status || (queueTab === 'pending' ? 'PENDING' : 'APPROVED')}
                  </div>
                </div>
                <div className="col-span-2 truncate" title={r.customerName || ''}>
                  {r.customerName || '—'}
                  {r.leadIdentifier ? (
                    <div className="text-[10px] text-gray-500">{r.leadIdentifier}</div>
                  ) : null}
                </div>
                <div className="col-span-2 font-semibold text-rose-800">{formatInr(r.refundAmount)}</div>
                <div className="col-span-2 text-xs text-gray-600">
                  <div>10%: {formatInr(r.amountTowardTenRefund)}</div>
                  <div>Extra: {formatInr(r.extraAmountRefund)}</div>
                </div>
                <div className="col-span-2 text-xs text-gray-600">
                  {queueTab === 'pending' ? (
                    <>
                      <div>{formatDate(r.cancellationApprovedAt || r.createdAt)}</div>
                      <div className="truncate" title={r.cancellationApprovedBy || ''}>
                        {r.cancellationApprovedBy || '—'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>{formatDate(r.financeApprovedAt || r.cancellationApprovedAt || r.createdAt)}</div>
                      <div className="truncate" title={r.financeApprovedBy || ''}>
                        {r.financeApprovedBy || r.cancellationApprovedBy || '—'}
                      </div>
                    </>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <a
                    href={`/Leads/${r.designLeadId}`}
                    className="text-indigo-700 hover:underline text-xs font-semibold"
                  >
                    Lead #{r.designLeadId}
                  </a>
                  {queueTab === 'pending' && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => void onApprove(r.refundId)}
                        disabled={approvingId === r.refundId}
                        className="px-2 py-1 rounded bg-green-700 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {approvingId === r.refundId ? '…' : 'Approve'}
                      </button>
                    </div>
                  )}
                  {r.cancellationReason ? (
                    <div className="mt-1 text-[10px] text-gray-500 truncate" title={r.cancellationReason}>
                      {r.cancellationReason}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function FinanceRefundsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
          <p className="text-white text-sm">Loading refunds…</p>
        </div>
      }
    >
      <FinanceRefundsPageInner />
    </Suspense>
  );
}
