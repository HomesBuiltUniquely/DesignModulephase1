'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

type FinanceLead = {
  id: number;
  projectName: string;
  status: string;
  canApprove: boolean;
};

type UploadItem = {
  id: number;
  originalName: string;
  uploadedAt: string;
  status: string;
  uploadType?: string;
};

/**
 * Finance 40% payment queue: same as 10% – Lead ID, Lead name, Status, Upload (screenshots), Approve.
 * Leads appear after "meeting completed & 40% payment request" is done. Finance uploads then approves.
 */
export default function Finance40pPage() {
  const { user, sessionId } = useAuth();
  const [leads, setLeads] = useState<FinanceLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLeadId, setUploadingLeadId] = useState<number | null>(null);
  const [approvingLeadId, setApprovingLeadId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [targetLeadId, setTargetLeadId] = useState<number | null>(null);
  const [viewLeadId, setViewLeadId] = useState<number | null>(null);
  const [viewUploads, setViewUploads] = useState<UploadItem[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;
    return headers;
  }, [sessionId]);

  const role = (user?.role || '').toLowerCase();

  const loadLeads = async () => {
    if (!sessionId) {
      // Not authenticated yet; avoid calling API without token (would return 401).
      setLeads([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/leads/finance-40p-queue`, { headers: { ...authHeaders } });
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
      const res = await fetch(`${getApiBase()}/api/leads/${targetLeadId}/payment-40p-screenshots`, {
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

  const onViewScreenshots = async (leadId: number) => {
    setViewLeadId(leadId);
    setViewUploads([]);
    setViewLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/leads/${leadId}/uploads`, { headers: { ...authHeaders } });
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      const payment = list.filter((u: UploadItem) => u.uploadType === 'payment_40p');
      setViewUploads(payment);
    } catch {
      setViewUploads([]);
    } finally {
      setViewLoading(false);
    }
  };

  const downloadUpload = async (leadId: number, uploadId: number, fileName: string) => {
    try {
      const res = await fetch(`${getApiBase()}/api/leads/${leadId}/uploads/${uploadId}/download`, {
        headers: { ...authHeaders },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'download';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const onApprove = async (leadId: number) => {
    setApprovingLeadId(leadId);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/leads/${leadId}/approve-40p-payment`, {
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
          <h1 className="text-xl font-bold text-gray-900">40% Payment</h1>
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
            <h1 className="text-xl font-bold text-gray-900">40% Payment</h1>
            <p className="text-sm text-gray-600 mt-1">
              Project team uploads screenshots in the lead; you can view them here, then approve. You can also upload (e.g. if received offline). Approved leads move to the next stage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/finance" className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50">10% Payment</a>
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
            <div className="col-span-3">Lead name</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">View</div>
            <div className="col-span-1 text-right">Upload</div>
            <div className="col-span-2 text-right">Approve</div>
          </div>
          {leads.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-600">
              {loading ? 'Loading…' : 'No leads at 40% payment stage. Leads appear here after meeting completed & 40% payment request.'}
            </div>
          ) : (
            leads.map((l) => {
              const busyUpload = uploadingLeadId === l.id;
              const busyApprove = approvingLeadId === l.id;
              return (
                <div key={l.id} className="grid grid-cols-12 px-4 py-3 border-t border-gray-200 items-center gap-2">
                  <div className="col-span-2 text-sm font-semibold text-gray-900">{l.id}</div>
                  <div className="col-span-3 text-sm text-gray-800 truncate" title={l.projectName}>{l.projectName}</div>
                  <div className="col-span-2 text-sm">
                    <span className={l.status === 'Pending approval' ? 'text-amber-700 font-medium' : 'text-gray-600'}>
                      {l.status}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <button
                      type="button"
                      onClick={() => onViewScreenshots(l.id)}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                    >
                      View screenshots
                    </button>
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => onUploadClick(l.id)}
                      disabled={!sessionId || busyUpload}
                      className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                    >
                      {busyUpload ? '…' : 'Upload'}
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

        {viewLeadId != null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewLeadId(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">40% payment screenshots – Lead {viewLeadId}</h2>
                <button type="button" onClick={() => setViewLeadId(null)} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
              </div>
              <div className="p-4 overflow-auto flex-1">
                {viewLoading ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : viewUploads.length === 0 ? (
                  <p className="text-sm text-gray-500">No 40% payment screenshots uploaded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {viewUploads.map((u) => (
                      <li key={u.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">
                        <span className="text-sm text-gray-800 truncate flex-1" title={u.originalName}>{u.originalName}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">{u.status}</span>
                        <button
                          type="button"
                          onClick={() => downloadUpload(viewLeadId, u.id, u.originalName)}
                          className="text-sm text-blue-600 font-semibold hover:underline flex-shrink-0"
                        >
                          Download
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
