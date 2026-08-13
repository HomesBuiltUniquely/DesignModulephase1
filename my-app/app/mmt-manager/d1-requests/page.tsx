'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';
import CustomSelect from '@/app/Components/ui/CustomSelect';

const API = getApiBase();

type PendingRow = {
  assignmentId: number;
  leadId: number;
  pid?: string;
  projectName?: string;
  measurementDate?: string | null;
  measurementTime?: string | null;
  designerName?: string | null;
  mmtManagerName?: string | null;
  mmtManagerId?: number | null;
  createdAt?: string;
};

type Executive = { id: number; name: string; email: string; phone?: string };

export default function D1PendingRequestsPage() {
  const { user, sessionId } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const canAssign = role === 'mmt_manager' || role === 'admin';
  const isAdmin = role === 'admin';

  const [rows, setRows] = useState<PendingRow[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId || !canAssign) return;
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, execRes] = await Promise.all([
        fetch(`${API}/api/leads/d1-pending-requests`, {
          headers: { Authorization: `Bearer ${sessionId}` },
        }),
        fetch(`${API}/api/auth/mmt-executives`, {
          headers: { Authorization: `Bearer ${sessionId}` },
        }),
      ]);
      const pendingData = await pendingRes.json().catch(() => []);
      const execData = await execRes.json().catch(() => []);
      if (!pendingRes.ok) throw new Error(pendingData?.message || 'Failed to load');
      if (!execRes.ok) throw new Error(execData?.message || 'Failed to load executives');
      setRows(Array.isArray(pendingData) ? pendingData : []);
      setExecutives(Array.isArray(execData) ? execData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
      setExecutives([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, canAssign]);

  useEffect(() => {
    load();
  }, [load]);

  const onAssign = async (row: PendingRow) => {
    const execId = Number(selected[row.leadId]);
    if (!sessionId || !execId) {
      setToast('Select an MMT executive first.');
      setTimeout(() => setToast(null), 2500);
      return;
    }
    setAssigningId(row.leadId);
    try {
      const res = await fetch(`${API}/api/leads/${row.leadId}/assign-d1-executive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({ measurementExecutiveId: execId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Assign failed');
      if (data.mailSent) {
        setToast(`Assigned ${data.executiveName || 'executive'}. Client visit mail sent.`);
      } else {
        setToast(data.message || 'Executive assigned but client mail failed.');
      }
      setTimeout(() => setToast(null), 3000);
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Assign failed');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setAssigningId(null);
    }
  };

  if (role && !canAssign) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6">
          <h1 className="text-xl font-bold text-gray-900">D1 Requests</h1>
          <p className="text-sm text-gray-600 mt-2">Only MMT managers and admins can assign executives.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">D1 Measurement Requests</h1>
            <p className="text-sm text-gray-600 mt-1">
              Assign an MMT executive. Client visit mail is sent on the design-journey mail loop after assignment.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {!loading && rows.length === 0 && !error && (
          <p className="text-sm text-gray-500">No pending D1 requests.</p>
        )}

        <div className="space-y-3 mt-4">
          {rows.map((row) => (
            <div
              key={row.assignmentId}
              className="border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  {row.projectName || 'Project'}{' '}
                  <span className="text-gray-500 font-normal text-sm">
                    ({row.pid || `HUB-${row.leadId}`})
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Designer: {row.designerName || '—'}
                  {row.measurementDate ? ` · Date: ${row.measurementDate}` : ''}
                  {row.measurementTime ? ` · Time: ${row.measurementTime}` : ''}
                </p>
                {isAdmin && (
                  <a
                    href={`/Leads/${row.leadId}`}
                    className="text-xs text-[#00B0ED] hover:underline mt-1 inline-block"
                  >
                    Open lead
                  </a>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <CustomSelect
                  className="min-w-[12rem]"
                  value={selected[row.leadId] || ''}
                  onChange={(val) =>
                    setSelected((prev) => ({ ...prev, [row.leadId]: val }))
                  }
                  options={executives.map((ex) => ({ value: String(ex.id), label: ex.name }))}
                  placeholder="Select executive"
                />
                <button
                  type="button"
                  disabled={assigningId === row.leadId || !selected[row.leadId]}
                  onClick={() => onAssign(row)}
                  className="px-4 py-2 rounded-lg bg-[#EF0101] text-white text-sm font-semibold hover:bg-[#EF0101] disabled:opacity-50"
                >
                  {assigningId === row.leadId ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white text-base font-medium px-8 py-4 rounded-lg shadow-2xl z-[9999] text-center max-w-md">
          {toast}
        </div>
      )}
    </div>
  );
}
