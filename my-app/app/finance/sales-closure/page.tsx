'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';
import FinanceRefundsNavLink from '../../Components/FinanceRefundsNavLink';
import CustomDatePicker from '@/app/Components/ui/CustomDatePicker';

type PaymentSubmission = {
  id: string;
  amount: number;
  cumulativeTotal: number;
  mode: string | null;
  paymentReceived: string | null;
  submittedAt: string;
  remainingFor10Percent: number | null;
  rejected?: boolean;
  hasScreenshot?: boolean;
  screenshot?: string | null;
  uploadId?: number | null;
};

type QueueTab = 'pending' | 'approved';

type FinanceLead = {
  id: number;
  projectName: string;
  projectStage?: string;
  customerName: string;
  status: string;
  canApprove: boolean;
  tenPercentMet: boolean;
  financeApproved?: boolean;
  paymentReceived: string;
  paymentMode: string;
  paymentScreenshot: string | null;
  amountPaid: number | null;
  tenPercentTarget: number | null;
  remainingFor10Percent: number | null;
  paymentPercentOfQuotation: number | null;
  submittedAt: string | null;
  approvedAt?: string | null;
  bookingDate: string | null;
  submissionCount: number;
  paymentSubmissions: PaymentSubmission[];
  paymentSource?: 'crm_hub' | 'manual';
};


type FinanceLeadDetail = FinanceLead & {
  financeApproved?: boolean;
  quotationTotal?: number | null;
  approvedAt?: string | null;
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

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function SubmissionsTable({
  leadId,
  submissions,
  sessionId,
  authHeaders,
  onViewScreenshot,
  onProofError,
  proofError,
}: {
  leadId: number;
  submissions: PaymentSubmission[];
  sessionId: string | null;
  authHeaders: Record<string, string>;
  onViewScreenshot: (src: string) => void;
  onProofError?: (message: string) => void;
  proofError?: string | null;
}) {
  const [loadingProofId, setLoadingProofId] = useState<string | null>(null);

  async function loadProof(submission: PaymentSubmission) {
    if (submission.uploadId && sessionId) {
      setLoadingProofId(submission.id);
      onProofError?.('');
      try {
        const res = await fetch(
          `${getApiBase()}/api/leads/${leadId}/hub-payment-proofs/${submission.uploadId}/content`,
          { headers: { ...authHeaders } },
        );
        if (!res.ok) {
          let message = 'Failed to load payment proof';
          try {
            const data = (await res.json()) as { message?: string };
            if (data?.message) message = data.message;
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          throw new Error('Payment proof unavailable from Hub');
        }
        const blob = await res.blob();
        onViewScreenshot(URL.createObjectURL(blob));
      } finally {
        setLoadingProofId(null);
      }
      return;
    }
    if (submission.screenshot) {
      onViewScreenshot(submission.screenshot);
      return;
    }
    if (submission.hasScreenshot) {
      throw new Error(
        'Payment proof is not linked yet. Re-run Convert to Booking in CRM to refresh proofs.',
      );
    }
  }

  if (submissions.length === 0) {
    return <p className="text-sm text-gray-500">No payment submissions recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {proofError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {proofError}
        </div>
      ) : null}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-12 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600">
        <div className="col-span-1">#</div>
        <div className="col-span-2">Date</div>
        <div className="col-span-2">This payment</div>
        <div className="col-span-2">Total toward 10%</div>
        <div className="col-span-2">Remaining 10%</div>
        <div className="col-span-2">Type / mode</div>
        <div className="col-span-1 text-center">Proof</div>
      </div>
      {submissions.map((s, idx) => (
        <div
          key={s.id}
          className={`grid grid-cols-12 px-3 py-2.5 border-t border-gray-200 text-xs items-center ${
            s.rejected ? 'bg-red-50' : 'bg-white'
          }`}
        >
          <div className="col-span-1 font-medium text-gray-800">{idx + 1}</div>
          <div className="col-span-2 text-gray-700">{formatDate(s.submittedAt)}</div>
          <div className="col-span-2 font-semibold text-gray-900">{formatInr(s.amount)}</div>
          <div className="col-span-2 text-gray-800">{formatInr(s.cumulativeTotal)}</div>
          <div className="col-span-2 text-amber-800 font-medium">
            {formatInr(s.remainingFor10Percent)}
          </div>
          <div className="col-span-2 text-gray-600">
            {s.paymentReceived || '—'}
            {s.mode ? ` · ${s.mode}` : ''}
            {s.rejected ? (
              <span className="block text-red-600 font-medium">Rejected</span>
            ) : null}
          </div>
          <div className="col-span-1 text-center">
            <button
              type="button"
              disabled={(!s.uploadId && !s.screenshot && !s.hasScreenshot) || loadingProofId === s.id}
              onClick={() => {
                void loadProof(s).catch((e: unknown) => {
                  onProofError?.(e instanceof Error ? e.message : 'Failed to load payment proof');
                });
              }}
              className="px-2 py-1 rounded border border-gray-300 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40"
            >
              {loadingProofId === s.id ? '…' : 'View'}
            </button>
          </div>
        </div>
      ))}
    </div>
    </div>
  );
}

export default function FinanceSalesClosurePage() {
  const { user, sessionId } = useAuth();
  const [leads, setLeads] = useState<FinanceLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingLeadId, setApprovingLeadId] = useState<number | null>(null);
  const [rejectingLeadId, setRejectingLeadId] = useState<number | null>(null);
  const [viewScreenshot, setViewScreenshot] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [refreshingProofs, setRefreshingProofs] = useState(false);

  const closeScreenshot = () => {
    setViewScreenshot((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  };

  useEffect(() => {
    return () => {
      if (viewScreenshot?.startsWith('blob:')) URL.revokeObjectURL(viewScreenshot);
    };
  }, [viewScreenshot]);
  const [rejectConfirmLead, setRejectConfirmLead] = useState<FinanceLead | null>(null);
  const [historyLead, setHistoryLead] = useState<FinanceLeadDetail | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [customerNameFilter, setCustomerNameFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [leadIdLookup, setLeadIdLookup] = useState('');
  const [queueTab, setQueueTab] = useState<QueueTab>('pending');

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;
    return headers;
  }, [sessionId]);

  const role = (user?.role || '').toLowerCase();

  const loadLeads = useCallback(async () => {
    if (!sessionId) {
      setLeads([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', queueTab);
      const name = customerNameFilter.trim();
      if (name) params.set('customerName', name);
      if (monthFilter) params.set('month', monthFilter);
      if (dateFromFilter) params.set('dateFrom', dateFromFilter);
      if (dateToFilter) params.set('dateTo', dateToFilter);
      const qs = params.toString();
      const res = await fetch(
        `${getApiBase()}/api/leads/finance-sales-closure-queue${qs ? `?${qs}` : ''}`,
        { headers: { ...authHeaders } },
      );
      const text = await res.text();
      const data = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })();
      if (!res.ok) throw new Error(data?.message || 'Failed to load queue');
      setLeads(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [
    sessionId,
    authHeaders,
    customerNameFilter,
    monthFilter,
    dateFromFilter,
    dateToFilter,
    queueTab,
  ]);

  const fetchLeadHistory = useCallback(
    async (leadId: number) => {
      if (!sessionId) return;
      setHistoryLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${getApiBase()}/api/leads/finance-sales-closure/${encodeURIComponent(String(leadId))}`,
          { headers: { ...authHeaders } },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Lead not found');
        setHistoryLead(data as FinanceLeadDetail);
        setProofError(null);
      } catch (e: unknown) {
        setHistoryLead(null);
        setError(e instanceof Error ? e.message : 'Failed to load lead history');
      } finally {
        setHistoryLoading(false);
      }
    },
    [sessionId, authHeaders],
  );

  const refreshHubProofs = async () => {
    if (!historyLead || !sessionId) return;
    setRefreshingProofs(true);
    setProofError(null);
    try {
      const res = await fetch(
        `${getApiBase()}/api/leads/${historyLead.id}/refresh-hub-payment-proofs`,
        { method: 'POST', headers: { ...authHeaders } },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to refresh proofs');
      await fetchLeadHistory(historyLead.id);
    } catch (e: unknown) {
      setProofError(e instanceof Error ? e.message : 'Failed to refresh proofs');
    } finally {
      setRefreshingProofs(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const onApprove = async (leadId: number, paymentSource?: 'crm_hub' | 'manual') => {
    setApprovingLeadId(leadId);
    setError(null);
    try {
      const path =
        paymentSource === 'crm_hub'
          ? `${getApiBase()}/api/leads/${leadId}/approve-10p-payment`
          : `${getApiBase()}/api/leads/${leadId}/approve-sales-closure`;
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Approve failed');
      setHistoryLead(null);
      setQueueTab('approved');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setApprovingLeadId(null);
    }
  };

  const onRejectClick = (lead: FinanceLead) => {
    setRejectConfirmLead(lead);
  };

  const onRejectConfirm = async () => {
    if (!rejectConfirmLead) return;
    const leadId = rejectConfirmLead.id;
    const paymentSource = rejectConfirmLead.paymentSource;
    setRejectConfirmLead(null);
    setRejectingLeadId(leadId);
    setError(null);
    try {
      const path =
        paymentSource === 'crm_hub'
          ? `${getApiBase()}/api/leads/${leadId}/reject-10p-payment`
          : `${getApiBase()}/api/leads/${leadId}/reject-sales-closure`;
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Reject failed');
      if (historyLead?.id === leadId) void fetchLeadHistory(leadId);
      loadLeads();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setRejectingLeadId(null);
    }
  };

  const onLookupLead = () => {
    const id = Number(leadIdLookup.trim());
    if (!Number.isFinite(id) || id < 1) {
      setError('Enter a valid Lead ID.');
      return;
    }
    void fetchLeadHistory(id);
  };

  const openHistory = (lead: FinanceLead) => {
    if (lead.paymentSubmissions?.length) {
      setHistoryLead({
        ...lead,
        paymentSubmissions: lead.paymentSubmissions,
        financeApproved: false,
      });
      void fetchLeadHistory(lead.id);
    } else {
      void fetchLeadHistory(lead.id);
    }
  };

  const clearFilters = () => {
    setCustomerNameFilter('');
    setMonthFilter('');
    setDateFromFilter('');
    setDateToFilter('');
  };

  const isFinance = role === 'finance' || role === 'admin';
  if (role && !isFinance) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6">
          <h1 className="text-xl font-bold text-gray-900">Sales Closure Payment</h1>
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
            <h1 className="text-xl font-bold text-gray-900">Sales Closure — Finance queue</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Pending queue for approval; approved tab shows projects you have signed off (10–20%
              phase). Each payment installment is listed in history.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="/finance"
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50"
            >
              10% Payment
            </a>
            <FinanceRefundsNavLink fromPath="/finance/sales-closure" />
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

        <div className="mt-5 p-4 rounded-xl border border-[#DDCDC1] bg-[#DDCDC1]/20">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Fetch lead — finance history</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Lead ID"
              value={leadIdLookup}
              onChange={(e) => setLeadIdLookup(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32"
            />
            <button
              type="button"
              onClick={onLookupLead}
              disabled={historyLoading}
              className="px-4 py-2 rounded-lg bg-[#EF0101] text-white text-sm font-semibold hover:bg-[#EF0101]/80 disabled:opacity-60"
            >
              {historyLoading ? 'Loading…' : 'Load history'}
            </button>
            {historyLead && (
              <button
                type="button"
                onClick={() => setHistoryLead(null)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-white"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {historyLead && (
          <div className="mt-4 p-4 rounded-xl border-2 border-[#EF0101]/50 bg-white space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Finance history — Lead #{historyLead.id}
                </h2>
                <p className="text-sm text-gray-600">
                  {historyLead.customerName} · {historyLead.submissionCount} payment submission
                  {historyLead.submissionCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="text-right text-sm">
                <p>
                  Total paid: <span className="font-semibold">{formatInr(historyLead.amountPaid)}</span>
                </p>
                <p>10% target: {formatInr(historyLead.tenPercentTarget)}</p>
                {!historyLead.financeApproved && (
                  <p>
                    Remaining:{' '}
                    <span className="font-semibold text-amber-800">
                      {formatInr(historyLead.remainingFor10Percent)}
                    </span>
                  </p>
                )}
                <p className="text-gray-500">{historyLead.status}</p>
              </div>
            </div>
            {historyLead.financeApproved && (
              <div className="rounded-lg bg-[#DDCDC1]/20 border border-[#DDCDC1] px-4 py-3 text-sm text-[#32261C]">
                <span className="font-semibold">Finance approved</span>
                {historyLead.approvedAt ? ` on ${formatDate(historyLead.approvedAt)}` : ''}. This
                project has moved to the <span className="font-semibold">10–20%</span> design phase.
              </div>
            )}
            {historyLead.paymentSource === 'crm_hub' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void refreshHubProofs()}
                  disabled={refreshingProofs || !sessionId}
                  className="px-3 py-1.5 rounded-lg border border-[#EF0101]/50 text-[#32261C] text-xs font-semibold hover:bg-[#DDCDC1]/20 disabled:opacity-60"
                >
                  {refreshingProofs ? 'Refreshing proofs…' : 'Refresh proofs from CRM sync'}
                </button>
              </div>
            )}
            <SubmissionsTable
              leadId={historyLead.id}
              submissions={historyLead.paymentSubmissions || []}
              sessionId={sessionId}
              authHeaders={authHeaders}
              onViewScreenshot={setViewScreenshot}
              onProofError={setProofError}
              proofError={proofError}
            />
            {!historyLead.financeApproved && historyLead.tenPercentMet && (
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => onApprove(historyLead.id, historyLead.paymentSource)}
                  disabled={approvingLeadId === historyLead.id}
                  className="px-4 py-2 rounded-lg bg-[#00B0ED] text-white text-sm font-semibold hover:bg-[#00B0ED]/90 disabled:opacity-60"
                >
                  {approvingLeadId === historyLead.id ? 'Approving…' : 'Approve (move to 10–20%)'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 p-4 rounded-xl border border-gray-200 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Customer name</label>
            <input
              type="text"
              value={customerNameFilter}
              onChange={(e) => setCustomerNameFilter(e.target.value)}
              placeholder="Search name…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {queueTab === 'approved' ? 'Month approved' : 'Month submitted'}
            </label>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {queueTab === 'approved' ? 'Approved from' : 'Submitted from'}
            </label>
            <CustomDatePicker
              value={dateFromFilter}
              onChange={(date) => setDateFromFilter(date)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {queueTab === 'approved' ? 'Approved to' : 'Submitted to'}
            </label>
            <CustomDatePicker
              value={dateToFilter}
              onChange={(date) => setDateToFilter(date)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadLeads}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={() => setMonthFilter(currentMonthValue())}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-white"
            >
              This month
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-white"
            >
              Clear
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-red-600 mt-4">{error}</div>}

        <div className="mt-5 flex gap-2 border-b border-gray-200 flex-wrap">
          <button
            type="button"
            onClick={() => setQueueTab('pending')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${
              queueTab === 'pending'
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Pending approval
          </button>
          <button
            type="button"
            onClick={() => setQueueTab('approved')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${
              queueTab === 'approved'
                ? 'border-[#EF0101] text-[#32261C]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Approved history
          </button>
        </div>

        <div className="mt-0 border border-t-0 border-gray-200 rounded-b-2xl overflow-x-auto">
          {queueTab === 'pending' ? (
            <>
              <div className="min-w-[1020px] grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
                <div className="col-span-1">ID</div>
                <div className="col-span-2">Customer</div>
                <div className="col-span-2">Payment / 10%</div>
                <div className="col-span-1">Subs</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Submitted</div>
                <div className="col-span-1 text-center">History</div>
                <div className="col-span-1 text-center">Approve</div>
                <div className="col-span-1 text-center">Reject</div>
              </div>
              {leads.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-600">
                  {loading ? 'Loading…' : 'No pending sales closure payments match your filters.'}
                </div>
              ) : (
                leads.map((l) => {
                  const busyApprove = approvingLeadId === l.id;
                  const busyReject = rejectingLeadId === l.id;
                  const count = l.submissionCount || l.paymentSubmissions?.length || 0;
                  return (
                    <div
                      key={l.id}
                      className="min-w-[1020px] grid grid-cols-12 px-4 py-3 border-t border-gray-200 items-start gap-1"
                    >
                      <div className="col-span-1 text-sm font-semibold text-gray-900">{l.id}</div>
                      <div className="col-span-2 text-sm text-gray-800">
                        <div className="font-medium truncate" title={String(l.customerName)}>
                          {l.customerName}
                          {l.paymentSource === 'crm_hub' && (
                            <span className="ml-1 inline-block px-1.5 py-0.5 rounded bg-[#DDCDC1]/40 text-[#32261C] text-[10px] font-bold">
                              CRM
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2 text-xs text-gray-700 space-y-0.5">
                        <div>
                          Total paid:{' '}
                          <span className="font-semibold">{formatInr(l.amountPaid)}</span>
                        </div>
                        <div>10% target: {formatInr(l.tenPercentTarget)}</div>
                        {!l.tenPercentMet && (
                          <div className="text-amber-700">
                            Remaining: {formatInr(l.remainingFor10Percent)}
                          </div>
                        )}
                      </div>
                      <div className="col-span-1">
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full bg-[#DDCDC1]/40 text-[#32261C] text-xs font-bold">
                          {count || 1}
                        </span>
                      </div>
                      <div className="col-span-2 text-xs">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 font-medium ${
                            l.tenPercentMet
                              ? 'bg-[#DDCDC1]/40 text-[#32261C]'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {l.status}
                        </span>
                      </div>
                      <div className="col-span-1 text-xs text-gray-600">
                        {formatDate(l.submittedAt)}
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => openHistory(l)}
                          className="px-2 py-1.5 rounded-lg border border-[#EF0101] text-[#32261C] text-xs font-semibold hover:bg-[#DDCDC1]/20"
                        >
                          {count > 1 ? `${count} entries` : 'History'}
                        </button>
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => onApprove(l.id, l.paymentSource)}
                          disabled={!l.canApprove || busyApprove || !sessionId}
                          className="px-2 py-1.5 rounded-lg bg-[#00B0ED] text-white text-xs font-semibold hover:bg-[#00B0ED]/90 disabled:opacity-60"
                        >
                          {busyApprove ? '…' : 'Approve'}
                        </button>
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => onRejectClick(l)}
                          disabled={busyReject || !sessionId}
                          className="px-2 py-1.5 rounded-lg bg-[#EF0101] text-white text-xs font-semibold hover:bg-[#EF0101]/90 disabled:opacity-60"
                        >
                          {busyReject ? '…' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          ) : (
            <>
              <div className="min-w-[900px] grid grid-cols-12 bg-[#DDCDC1]/20 px-4 py-3 text-xs font-semibold text-[#32261C]">
                <div className="col-span-1">ID</div>
                <div className="col-span-3">Customer</div>
                <div className="col-span-2">10% paid</div>
                <div className="col-span-1">Subs</div>
                <div className="col-span-2">Approved on</div>
                <div className="col-span-2">Stage</div>
                <div className="col-span-1 text-center">History</div>
              </div>
              {leads.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-600">
                  {loading
                    ? 'Loading…'
                    : 'No approved projects yet. Approve from the pending tab to see them here.'}
                </div>
              ) : (
                leads.map((l) => {
                  const count = l.submissionCount || l.paymentSubmissions?.length || 0;
                  return (
                    <div
                      key={l.id}
                      className="min-w-[900px] grid grid-cols-12 px-4 py-3 border-t border-gray-200 items-center gap-1 bg-white hover:bg-gray-50"
                    >
                      <div className="col-span-1 text-sm font-semibold text-gray-900">{l.id}</div>
                      <div className="col-span-3 text-sm font-medium text-gray-800 truncate">
                        {l.customerName}
                      </div>
                      <div className="col-span-2 text-sm font-semibold text-[#32261C]">
                        {formatInr(l.amountPaid)}
                      </div>
                      <div className="col-span-1">
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full bg-[#DDCDC1]/40 text-[#32261C] text-xs font-bold">
                          {count || 1}
                        </span>
                      </div>
                      <div className="col-span-2 text-xs text-gray-600">
                        {formatDate(l.approvedAt)}
                      </div>
                      <div className="col-span-2 text-xs text-gray-600">{l.projectStage}</div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => openHistory(l)}
                          className="px-2 py-1.5 rounded-lg border border-[#EF0101] text-[#32261C] text-xs font-semibold hover:bg-[#DDCDC1]/20"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {viewScreenshot && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeScreenshot}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Payment Screenshot</h2>
                <button
                  type="button"
                  onClick={closeScreenshot}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                >
                  &times;
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1 flex justify-center bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={viewScreenshot}
                  alt="Payment Screenshot"
                  className="max-w-full max-h-[70vh] object-contain rounded border border-gray-300"
                />
              </div>
            </div>
          </div>
        )}

        {rejectConfirmLead && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h2 className="text-lg font-bold text-gray-900">Reject latest submission?</h2>
              <p className="text-sm text-gray-600 mt-2 mb-6">
                Lead #{rejectConfirmLead.id} — {rejectConfirmLead.customerName}. Sales will be
                notified to re-submit.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejectConfirmLead(null)}
                  className="px-4 py-2 rounded-lg border text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onRejectConfirm}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold"
                >
                  Reject & Notify
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
