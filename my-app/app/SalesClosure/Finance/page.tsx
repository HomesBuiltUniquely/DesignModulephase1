'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

type QueueTab = 'pending' | 'approved';

type FinanceQueueLead = {
  id: number;
  customerName: string;
  totalPaid: number;
  tenPercentTarget: number;
  remaining: number;
  subs: number;
  status: string;
  submittedAt: string | null;
  approvedAt?: string | null;
  canApprove: boolean;
  paymentSource: 'crm_hub' | 'manual';
  crmRef: string | null;
  bookingTokenRecordId: string | null;
};

type PaymentProof = {
  id?: string;
  originalFileName?: string;
  mimeType?: string;
  url?: string;
  contentPath?: string;
};

type PaymentHistoryEntry = {
  id?: string;
  sequence?: number;
  amount?: number;
  cumulativeReceived?: number;
  remainingAfter?: number;
  paymentKind?: string;
  source?: string;
  proofs?: PaymentProof[];
};

type PaymentHistoryResponse = {
  leadId: number;
  bookingTokenRecordId?: string;
  paymentHistoryId?: string;
  crmRef?: string | null;
  amountReceived?: number;
  tenPercentAmount?: number;
  syncedAt?: string;
  paymentHistory?: PaymentHistoryEntry[];
  quoteAmount?: number | null;
  paymentKind?: string | null;
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

export default function SalesClosureFinancePage() {
  const { user, sessionId } = useAuth();
  const [leads, setLeads] = useState<FinanceQueueLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueTab, setQueueTab] = useState<QueueTab>('pending');
  const [customerFilter, setCustomerFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [approvingLeadId, setApprovingLeadId] = useState<number | null>(null);
  const [rejectingLeadId, setRejectingLeadId] = useState<number | null>(null);
  const [historyLeadId, setHistoryLeadId] = useState<number | null>(null);
  const [historyData, setHistoryData] = useState<PaymentHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rejectConfirmLead, setRejectConfirmLead] = useState<FinanceQueueLead | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (sessionId) headers.Authorization = `Bearer ${sessionId}`;
    return headers;
  }, [sessionId]);

  const role = (user?.role || '').toLowerCase();
  const isFinance = role === 'finance' || role === 'admin';

  const loadLeads = useCallback(async () => {
    if (!sessionId) {
      setLeads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('tab', queueTab);
      const name = customerFilter.trim();
      if (name) params.set('customer', name);
      if (dateFromFilter) params.set('submittedFrom', dateFromFilter);
      if (dateToFilter) params.set('submittedTo', dateToFilter);
      const res = await fetch(`${getApiBase()}/api/sales-closure/finance-queue?${params.toString()}`, {
        headers: { ...authHeaders },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to load queue');
      setLeads(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [sessionId, authHeaders, queueTab, customerFilter, dateFromFilter, dateToFilter]);

  const loadHistory = useCallback(
    async (leadId: number) => {
      if (!sessionId) return;
      setHistoryLeadId(leadId);
      setHistoryLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${getApiBase()}/api/sales-closure/finance-queue/${leadId}/payment-history`,
          { headers: { ...authHeaders } },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Failed to load payment history');
        setHistoryData(data as PaymentHistoryResponse);
      } catch (e: unknown) {
        setHistoryData(null);
        setError(e instanceof Error ? e.message : 'Failed to load payment history');
      } finally {
        setHistoryLoading(false);
      }
    },
    [sessionId, authHeaders],
  );

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const onApprove = async (leadId: number) => {
    setApprovingLeadId(leadId);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/leads/${leadId}/approve-10p-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Approve failed');
      setHistoryLeadId(null);
      setHistoryData(null);
      setQueueTab('approved');
      await loadLeads();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setApprovingLeadId(null);
    }
  };

  const onRejectConfirm = async () => {
    if (!rejectConfirmLead) return;
    const leadId = rejectConfirmLead.id;
    setRejectConfirmLead(null);
    setRejectingLeadId(leadId);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/leads/${leadId}/reject-10p-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Reject failed');
      setRejectReason('');
      if (historyLeadId === leadId) void loadHistory(leadId);
      await loadLeads();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setRejectingLeadId(null);
    }
  };

  if (role && !isFinance) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6">
          <h1 className="text-xl font-bold text-gray-900">CRM Booking Finance</h1>
          <p className="text-sm text-gray-600 mt-2">You don&apos;t have access to this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">CRM Booking &amp; Token — Finance queue</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Leads synced from CRM Convert to Booking. Approve moves the project to 10–20% and notifies Hub/CRM.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="/finance/sales-closure"
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50"
            >
              Manual Sales Closure
            </a>
            <button
              type="button"
              onClick={loadLeads}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setQueueTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              queueTab === 'pending' ? 'bg-indigo-700 text-white' : 'border border-gray-300 hover:bg-gray-50'
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

        <div className="mt-4 p-4 rounded-xl border border-gray-200 bg-gray-50 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Customer name</label>
            <input
              type="text"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="Search…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Submitted from</label>
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Submitted to</label>
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && <div className="text-sm text-red-600 mt-4">{error}</div>}

        <div className="mt-5 border border-gray-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600 gap-1">
            <div className="col-span-1">ID</div>
            <div className="col-span-2">Customer</div>
            <div className="col-span-2">Payment / 10%</div>
            <div className="col-span-1">Subs</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Submitted</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {leads.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-600">
              {loading ? 'Loading…' : 'No leads in this queue.'}
            </div>
          ) : (
            leads.map((l) => (
              <div
                key={l.id}
                className="grid grid-cols-12 px-4 py-3 border-t border-gray-200 items-center gap-1 text-sm"
              >
                <div className="col-span-1 font-semibold">
                  <a href={`/Leads/${l.id}`} className="text-indigo-700 hover:underline">
                    {l.id}
                  </a>
                </div>
                <div className="col-span-2 truncate" title={l.customerName}>
                  {l.customerName}
                  {l.paymentSource === 'crm_hub' && (
                    <span className="ml-1 inline-block px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[10px] font-bold">
                      CRM
                    </span>
                  )}
                </div>
                <div className="col-span-2 text-xs">
                  <div>Paid: {formatInr(l.totalPaid)}</div>
                  <div className="text-gray-500">10%: {formatInr(l.tenPercentTarget)}</div>
                </div>
                <div className="col-span-1">{l.subs}</div>
                <div className="col-span-2">
                  <span
                    className={
                      l.status === 'Pending approval'
                        ? 'text-amber-700 font-medium'
                        : l.status === 'Approved'
                          ? 'text-teal-700 font-medium'
                          : 'text-gray-600'
                    }
                  >
                    {l.status}
                  </span>
                </div>
                <div className="col-span-2 text-xs text-gray-600">{formatDate(l.submittedAt)}</div>
                <div className="col-span-2 flex justify-end gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void loadHistory(l.id)}
                    className="px-2 py-1 rounded border border-gray-300 text-xs font-semibold hover:bg-gray-50"
                  >
                    History
                  </button>
                  {queueTab === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onApprove(l.id)}
                        disabled={!l.canApprove || approvingLeadId === l.id}
                        className="px-2 py-1 rounded bg-green-700 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {approvingLeadId === l.id ? '…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectConfirmLead(l)}
                        disabled={rejectingLeadId === l.id}
                        className="px-2 py-1 rounded bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {historyLeadId != null && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setHistoryLeadId(null);
              setHistoryData(null);
            }}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b flex justify-between items-center">
                <h2 className="text-lg font-bold">Payment history — Lead #{historyLeadId}</h2>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryLeadId(null);
                    setHistoryData(null);
                  }}
                  className="text-gray-500 text-2xl leading-none"
                >
                  &times;
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1">
                {historyLoading ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : !historyData ? (
                  <p className="text-sm text-gray-500">No CRM hub payment history for this lead.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-700 grid grid-cols-2 gap-2">
                      <p>
                        Total received: <strong>{formatInr(Number(historyData.amountReceived))}</strong>
                      </p>
                      <p>
                        10% target: <strong>{formatInr(Number(historyData.tenPercentAmount))}</strong>
                      </p>
                      {historyData.crmRef && (
                        <p>
                          CRM ref: <strong>{historyData.crmRef}</strong>
                        </p>
                      )}
                      {historyData.bookingTokenRecordId && (
                        <p className="col-span-2 text-xs text-gray-500 break-all">
                          Booking record: {historyData.bookingTokenRecordId}
                        </p>
                      )}
                    </div>
                    {(historyData.paymentHistory || []).length === 0 ? (
                      <p className="text-sm text-gray-500">No installments recorded.</p>
                    ) : (
                      (historyData.paymentHistory || []).map((entry, idx) => (
                        <div key={entry.id || idx} className="border rounded-lg p-3">
                          <div className="flex justify-between text-sm font-semibold">
                            <span>#{entry.sequence ?? idx + 1}</span>
                            <span>{formatInr(entry.amount)}</span>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            Cumulative: {formatInr(entry.cumulativeReceived)} · Remaining:{' '}
                            {formatInr(entry.remainingAfter)}
                            {entry.paymentKind ? ` · ${entry.paymentKind}` : ''}
                          </div>
                          {(entry.proofs || []).length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {(entry.proofs || []).map((proof, pIdx) => (
                                <li key={proof.id || pIdx} className="text-xs">
                                  {proof.url ? (
                                    <a
                                      href={proof.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-indigo-700 hover:underline"
                                    >
                                      {proof.originalFileName || 'View proof'}
                                    </a>
                                  ) : (
                                    proof.originalFileName || 'Proof'
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {rejectConfirmLead && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
              <h3 className="text-lg font-bold">Reject 10% payment?</h3>
              <p className="text-sm text-gray-600 mt-2">
                Lead #{rejectConfirmLead.id} — {rejectConfirmLead.customerName}
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason (optional)"
                className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px]"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectConfirmLead(null);
                    setRejectReason('');
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void onRejectConfirm()}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
