'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

type FinanceLead = {
  id: number;
  projectName: string;
  status: string;
  canApprove: boolean;
};

/**
 * Finance 10% payment queue: limited access – Lead ID, Lead name, Status, Upload (screenshots), Approve.
 * Finance uploads payment screenshots then approves; lead moves to next stage.
 */
export default function Finance10pPage() {
  const { user, sessionId } = useAuth();
  const [leads, setLeads] = useState<FinanceLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLeadId, setUploadingLeadId] = useState<number | null>(null);
  const [approvingLeadId, setApprovingLeadId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [targetLeadId, setTargetLeadId] = useState<number | null>(null);

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;
    return headers;
  }, [sessionId]);

  const role = (user?.role || '').toLowerCase();

  const loadLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/leads/finance-10p-queue`, { headers: { ...authHeaders } });
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

  const onUploadClick = (leadId: number) => {
    setTargetLeadId(leadId);
    fileRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file || !targetLeadId) return;
    setUploadingLeadId(targetLeadId);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${getApiBase()}/api/leads/${targetLeadId}/payment-screenshots`, {
        method: 'POST',
        headers: { ...authHeaders },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Upload failed');
      loadLeads();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingLeadId(null);
      setTargetLeadId(null);
    }
  };

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
      loadLeads();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setApprovingLeadId(null);
    }
  };

  const isFinance = role === 'finance' || role === 'admin';
  if (role && !isFinance) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6">
          <h1 className="text-xl font-bold text-gray-900">10% Payment</h1>
          <p className="text-sm text-gray-600 mt-2">You don’t have access to this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">10% Payment</h1>
            <p className="text-sm text-gray-600 mt-1">
              Upload payment screenshots for each lead, then approve. Approved leads move to the next stage. You only see Lead ID, name, and status here.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
          <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
            <div className="col-span-2">Lead ID</div>
            <div className="col-span-4">Lead name</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">Upload</div>
            <div className="col-span-2 text-right">Approve</div>
          </div>
          {leads.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-600">
              {loading ? 'Loading…' : 'No leads at 10% payment stage. Leads appear here after DQC 1 approval.'}
            </div>
          ) : (
            leads.map((l) => {
              const busyUpload = uploadingLeadId === l.id;
              const busyApprove = approvingLeadId === l.id;
              return (
                <div key={l.id} className="grid grid-cols-12 px-4 py-3 border-t border-gray-200 items-center gap-2">
                  <div className="col-span-2 text-sm font-semibold text-gray-900">{l.id}</div>
                  <div className="col-span-4 text-sm text-gray-800 truncate" title={l.projectName}>{l.projectName}</div>
                  <div className="col-span-2 text-sm">
                    <span className={l.status === 'Pending approval' ? 'text-amber-700 font-medium' : 'text-gray-600'}>
                      {l.status}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <button
                      type="button"
                      onClick={() => onUploadClick(l.id)}
                      disabled={!sessionId || busyUpload}
                      className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                    >
                      {busyUpload ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                  <div className="col-span-2 text-right">
                    <button
                      type="button"
                      onClick={() => onApprove(l.id)}
                      disabled={!l.canApprove || busyApprove || !sessionId}
                      className="px-3 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {busyApprove ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          className="hidden"
          onChange={onFileSelected}
        />
      </div>
    </div>
  );
}
