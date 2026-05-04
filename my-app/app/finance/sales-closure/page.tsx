'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

type FinanceLead = {
  id: number;
  projectName: string;
  status: string;
  canApprove: boolean;
  paymentReceived: string;
  paymentMode: string;
  paymentScreenshot: string | null;
};

export default function FinanceSalesClosurePage() {
  const { user, sessionId } = useAuth();
  const [leads, setLeads] = useState<FinanceLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingLeadId, setApprovingLeadId] = useState<number | null>(null);
  const [rejectingLeadId, setRejectingLeadId] = useState<number | null>(null);
  const [viewScreenshot, setViewScreenshot] = useState<string | null>(null);
  // Reject confirmation modal state
  const [rejectConfirmLead, setRejectConfirmLead] = useState<FinanceLead | null>(null);

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;
    return headers;
  }, [sessionId]);

  const role = (user?.role || '').toLowerCase();

  const loadLeads = async () => {
    if (!sessionId) {
      setLeads([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/leads/finance-sales-closure-queue`, { headers: { ...authHeaders } });
      const text = await res.text();
      const data = (() => {
        try { return JSON.parse(text); } catch { return null; }
      })();
      if (!res.ok) throw new Error(data?.message || 'Failed to load queue');
      setLeads(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const onApprove = async (leadId: number) => {
    setApprovingLeadId(leadId);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/leads/${leadId}/approve-sales-closure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Approve failed');
      loadLeads();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setApprovingLeadId(null);
    }
  };

  // Called when Finance clicks "Reject" → opens confirmation popup
  const onRejectClick = (lead: FinanceLead) => {
    setRejectConfirmLead(lead);
  };

  // Called when Finance confirms rejection in the popup
  const onRejectConfirm = async () => {
    if (!rejectConfirmLead) return;
    const leadId = rejectConfirmLead.id;
    setRejectConfirmLead(null);
    setRejectingLeadId(leadId);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/leads/${leadId}/reject-sales-closure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Reject failed');
      loadLeads();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setRejectingLeadId(null);
    }
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
      <div className="max-w-5xl mx-auto bg-white rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sales Closure Payment</h1>
            <p className="text-sm text-gray-600 mt-1">
              Sales team has submitted closure forms. View their payment screenshots here, then approve or reject. Rejections send a notification email to the sales person.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/finance" className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50">10% Payment</a>
            <a href="/finance/40" className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50">40% Payment</a>
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

        {error && <div className="text-sm text-red-600 mt-4">{error}</div>}

        <div className="mt-5 border border-gray-200 rounded-2xl overflow-hidden">
          {/* Table header — 12 cols: ID(2) | Name(3) | Payment Info(2) | View(2) | Approve(2) | Reject(1) */}
          <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
            <div className="col-span-1">Lead ID</div>
            <div className="col-span-3">Project name</div>
            <div className="col-span-2">Payment Info</div>
            <div className="col-span-2 text-center">View</div>
            <div className="col-span-2 text-center">Approve</div>
            <div className="col-span-2 text-center">Reject</div>
          </div>
          {leads.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-600">
              {loading ? 'Loading…' : 'No sales closure payments pending approval.'}
            </div>
          ) : (
            leads.map((l) => {
              const busyApprove = approvingLeadId === l.id;
              const busyReject = rejectingLeadId === l.id;
              return (
                <div key={l.id} className="grid grid-cols-12 px-4 py-3 border-t border-gray-200 items-center gap-1">
                  <div className="col-span-1 text-sm font-semibold text-gray-900">{l.id}</div>
                  <div className="col-span-3 text-sm text-gray-800 truncate pr-2" title={l.projectName}>{l.projectName}</div>
                  <div className="col-span-2 text-xs text-gray-600">
                    <div>{l.paymentReceived}</div>
                    <div className="text-gray-400">{l.paymentMode}</div>
                  </div>
                  <div className="col-span-2 text-center">
                    <button
                      type="button"
                      onClick={() => setViewScreenshot(l.paymentScreenshot)}
                      disabled={!l.paymentScreenshot}
                      className="px-2 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      View
                    </button>
                  </div>
                  <div className="col-span-2 text-center">
                    <button
                      type="button"
                      onClick={() => onApprove(l.id)}
                      disabled={!l.canApprove || busyApprove || !sessionId}
                      className="px-2 py-1.5 rounded-lg bg-green-700 text-white text-xs font-semibold hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {busyApprove ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                  <div className="col-span-2 text-center">
                    <button
                      type="button"
                      onClick={() => onRejectClick(l)}
                      disabled={busyReject || !sessionId}
                      className="px-2 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {busyReject ? 'Rejecting…' : 'Reject'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Screenshot Viewer Modal */}
        {viewScreenshot && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewScreenshot(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Payment Screenshot</h2>
                <button type="button" onClick={() => setViewScreenshot(null)} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
              </div>
              <div className="p-4 overflow-auto flex-1 flex justify-center bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewScreenshot} alt="Payment Screenshot" className="max-w-full max-h-[70vh] object-contain rounded border border-gray-300" />
              </div>
            </div>
          </div>
        )}

        {/* Reject Confirmation Modal */}
        {rejectConfirmLead && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 font-bold text-lg">✕</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Reject Payment?</h2>
                  <p className="text-sm text-gray-500">Lead #{rejectConfirmLead.id} — {rejectConfirmLead.projectName}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to reject this sales closure payment screenshot? A notification email will be sent to the sales person asking them to re-submit with the correct details.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejectConfirmLead(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onRejectConfirm}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                >
                  Yes, Reject & Notify
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
