'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBase } from '@/app/lib/apiBase';

const API = getApiBase();

type UploadRow = {
  id: number;
  originalName: string;
  uploadedAt: string;
  status?: string;
  uploadType?: string;
};

type ApprovalInfo = {
  approved: boolean;
  mode: 'AUTO_APPROVED' | 'MANUAL_APPROVED' | 'UNKNOWN' | null;
  approvedBy: string | null;
  amount: number | null;
  channel: 'ONLINE' | 'OFFLINE' | null;
};

type Props = {
  leadId: number | null;
  sessionId: string | null;
  userRole?: string;
  kind: '10p' | '40p';
  taskLabel: string;
  /** True when milestone approval task is already completed (hide Approve). */
  alreadyCompleted?: boolean;
  onApproved?: () => void;
  onClose: () => void;
};

function formatInr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function canApproveFinancePayments(role: string | undefined): boolean {
  const r = (role || '').toLowerCase();
  return r === 'finance' || r === 'admin';
}

export default function PopupFinancePaymentApproval({
  leadId,
  sessionId,
  userRole,
  kind,
  taskLabel,
  alreadyCompleted = false,
  onApproved,
  onClose,
}: Props) {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approval, setApproval] = useState<ApprovalInfo>({
    approved: alreadyCompleted,
    mode: null,
    approvedBy: null,
    amount: null,
    channel: null,
  });

  const canApprove = canApproveFinancePayments(userRole);
  const uploadType = kind === '10p' ? 'payment_10p' : 'payment_40p';
  const approvePath = kind === '10p' ? 'approve-10p-payment' : 'approve-40p-payment';
  const bucket = kind === '10p' ? 'DESIGN_10' : 'DESIGN_40';
  const approvalTaskName = kind === '10p' ? '10% payment approval' : '40% payment approval';
  const milestoneIndex = kind === '10p' ? 2 : 5;

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionId) h.Authorization = `Bearer ${sessionId}`;
    return h;
  }, [sessionId]);

  const loadStatus = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    try {
      const [uploadsRes, completionsRes, summaryRes, historyRes] = await Promise.all([
        fetch(`${API}/api/leads/${leadId}/uploads`, { headers: authHeaders }),
        fetch(`${API}/api/leads/${leadId}/completions`, { headers: authHeaders }),
        fetch(`${API}/api/design-payment/cases/${leadId}/summary`, { headers: authHeaders }),
        fetch(`${API}/api/design-payment/cases/${leadId}/payment-history`, { headers: authHeaders }),
      ]);

      const uploadsData = await uploadsRes.json().catch(() => null);
      if (uploadsRes.ok) {
        const list = Array.isArray(uploadsData) ? uploadsData : [];
        setUploads(list.filter((u: UploadRow) => u.uploadType === uploadType));
      }

      let taskDone = alreadyCompleted;
      const completionsData = await completionsRes.json().catch(() => null);
      if (completionsRes.ok && Array.isArray(completionsData)) {
        taskDone = completionsData.some(
          (c: { milestoneIndex?: number; taskName?: string }) =>
            Number(c.milestoneIndex) === milestoneIndex &&
            String(c.taskName || '').trim() === approvalTaskName,
        );
      }

      let amount: number | null = null;
      let mode: ApprovalInfo['mode'] = null;
      const summaryData = await summaryRes.json().catch(() => null);
      if (summaryRes.ok && summaryData?.buckets) {
        const b = (summaryData.buckets as Array<Record<string, unknown>>).find(
          (x) => String(x.code) === bucket,
        );
        if (b) {
          const collected = Number(b.collectedAmount);
          const target = Number(b.targetAmount);
          amount = Number.isFinite(collected) && collected > 0 ? collected : Number.isFinite(target) ? target : null;
          const fm = String(b.financeMode || '').toUpperCase();
          if (fm.includes('AUTO')) mode = 'AUTO_APPROVED';
          else if (fm.includes('MANUAL')) mode = 'MANUAL_APPROVED';
          if (String(b.status) === 'PAID') taskDone = true;
        }
      }

      let channel: ApprovalInfo['channel'] = null;
      let approvedBy: string | null = null;
      const historyData = await historyRes.json().catch(() => null);
      const histRows = Array.isArray(historyData?.rows) ? historyData.rows : [];
      const bucketRows = histRows.filter(
        (r: Record<string, unknown>) => String(r.bucket || '').toUpperCase().includes(bucket.replace('DESIGN_', '')),
      );
      // Prefer exact bucket match
      const exact = histRows.filter((r: Record<string, unknown>) => String(r.bucket || '') === bucket);
      const useRows = exact.length > 0 ? exact : bucketRows;
      if (useRows.length > 0) {
        const latest = useRows[0] as Record<string, unknown>;
        const amt = Number(latest.amount);
        if (Number.isFinite(amt) && amt > 0) amount = amt;
        const fm = String(latest.financeHandlingMode || '').toUpperCase();
        if (fm.includes('AUTO')) {
          mode = 'AUTO_APPROVED';
          channel = 'ONLINE';
          approvedBy = 'SYSTEM · Easebuzz';
        } else if (fm.includes('MANUAL') || fm.includes('CREDIT')) {
          mode = mode || 'MANUAL_APPROVED';
          channel = String(latest.paymentChannel || '').toUpperCase() === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
        }
        if (String(latest.paymentChannel || '').toUpperCase() === 'ONLINE') channel = 'ONLINE';
        if (String(latest.source || '').toUpperCase() === 'EASEBUZZ') {
          channel = 'ONLINE';
          mode = mode || 'AUTO_APPROVED';
        }
      }

      if (taskDone && !mode) {
        mode = channel === 'ONLINE' ? 'AUTO_APPROVED' : 'MANUAL_APPROVED';
      }
      if (taskDone && !approvedBy) {
        approvedBy = mode === 'AUTO_APPROVED' ? 'SYSTEM · Easebuzz' : 'Finance';
      }

      setApproval({
        approved: taskDone || alreadyCompleted,
        mode,
        approvedBy,
        amount,
        channel,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load payment status');
    } finally {
      setLoading(false);
    }
  }, [
    leadId,
    authHeaders,
    uploadType,
    alreadyCompleted,
    approvalTaskName,
    milestoneIndex,
    bucket,
  ]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const onApprove = async () => {
    if (!leadId || !canApprove || approval.approved) return;
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/leads/${leadId}/${approvePath}`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Approve failed');
      setApproval((prev) => ({
        ...prev,
        approved: true,
        mode: 'MANUAL_APPROVED',
        approvedBy: 'Finance',
        channel: prev.channel || 'OFFLINE',
      }));
      onApproved?.();
      await loadStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setApproving(false);
    }
  };

  const isApproved = approval.approved || alreadyCompleted;
  const isOnlineAuto =
    approval.mode === 'AUTO_APPROVED' ||
    (isApproved && approval.channel === 'ONLINE');

  if (!canApprove && !isApproved) {
    return (
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <p className="text-sm text-gray-600">
          {taskLabel} is done by the finance team from their queue. Once they approve, this milestone will
          advance automatically.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold"
        >
          Close
        </button>
      </div>
    );
  }

  const pending = uploads.filter((u) => u.status === 'pending');
  const approvedUploads = uploads.filter((u) => u.status === 'approved');

  return (
    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
      <h3 className="text-lg font-bold text-gray-900">{taskLabel}</h3>
      <p className="mt-1 text-sm text-gray-600">
        {isApproved
          ? 'This payment milestone is complete. You can move to the next milestone.'
          : 'Review payment screenshots for this lead, then approve to complete the milestone.'}
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {/* Approved status banner */}
      {isApproved ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-3 w-3 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-emerald-900">
                {isOnlineAuto ? 'Online payment auto-approved' : 'Approved by Finance'}
              </p>
              <p className="mt-0.5 text-sm text-emerald-800">
                Amount:{' '}
                <span className="font-semibold tabular-nums">{formatInr(approval.amount)}</span>
                {approval.approvedBy ? (
                  <>
                    {' '}
                    · {isOnlineAuto ? 'Easebuzz' : approval.approvedBy}
                  </>
                ) : null}
              </p>
              {isOnlineAuto ? (
                <p className="mt-1 text-xs text-emerald-700">
                  Paid online via Easebuzz — no manual approve needed.
                </p>
              ) : (
                <p className="mt-1 text-xs text-emerald-700">
                  Offline / manual verification completed. Milestone unlocked.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!isApproved ? (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {loading ? (
            <p className="text-sm text-gray-500">Loading screenshots…</p>
          ) : uploads.length === 0 ? (
            <p className="text-sm text-amber-800">
              No payment screenshots uploaded yet. You can still approve temporarily if payment was
              verified offline.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {uploads.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-gray-800" title={u.originalName}>
                    {u.originalName}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {u.status === 'approved' ? 'Approved' : 'Pending'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {!isApproved && !loading && pending.length === 0 && approvedUploads.length > 0 ? (
        <p className="mt-2 text-xs text-[#32261C]">Payment screenshots already marked approved.</p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          {isApproved ? 'Close' : 'Cancel'}
        </button>
        {/* Hide Approve once payment is approved / milestone advanced */}
        {!isApproved && canApprove ? (
          <button
            type="button"
            onClick={() => void onApprove()}
            disabled={approving || !leadId}
            className="rounded-lg bg-[#EF0101] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EF0101]/90 disabled:opacity-60"
          >
            {approving ? 'Approving…' : 'Approve payment'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
