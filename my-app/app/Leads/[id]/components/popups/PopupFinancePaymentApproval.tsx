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

type Props = {
    leadId: number | null;
    sessionId: string | null;
    userRole?: string;
    kind: '10p' | '40p';
    taskLabel: string;
    onApproved?: () => void;
    onClose: () => void;
};

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
    onApproved,
    onClose,
}: Props) {
    const [uploads, setUploads] = useState<UploadRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [approving, setApproving] = useState(false);

    const canApprove = canApproveFinancePayments(userRole);
    const uploadType = kind === '10p' ? 'payment_10p' : 'payment_40p';
    const approvePath = kind === '10p' ? 'approve-10p-payment' : 'approve-40p-payment';

    const authHeaders = useMemo(() => {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionId) h.Authorization = `Bearer ${sessionId}`;
        return h;
    }, [sessionId]);

    const loadUploads = useCallback(async () => {
        if (!leadId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/uploads`, { headers: authHeaders });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || 'Failed to load payment screenshots');
            const list = Array.isArray(data) ? data : [];
            setUploads(list.filter((u: UploadRow) => u.uploadType === uploadType));
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load payment screenshots');
        } finally {
            setLoading(false);
        }
    }, [leadId, authHeaders, uploadType]);

    useEffect(() => {
        void loadUploads();
    }, [loadUploads]);

    const onApprove = async () => {
        if (!leadId || !canApprove) return;
        setApproving(true);
        setError(null);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/${approvePath}`, {
                method: 'POST',
                headers: authHeaders,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || 'Approve failed');
            onApproved?.();
            onClose();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Approve failed');
        } finally {
            setApproving(false);
        }
    };

    if (!canApprove) {
        return (
            <div className="rounded-xl bg-white p-6 shadow-lg max-w-md">
                <p className="text-sm text-gray-600">
                    {taskLabel} is done by the finance team from their queue. Once they approve, this milestone will
                    advance automatically.
                </p>
                <button type="button" onClick={onClose} className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold">
                    Close
                </button>
            </div>
        );
    }

    const pending = uploads.filter((u) => u.status === 'pending');
    const approved = uploads.filter((u) => u.status === 'approved');

    return (
        <div className="rounded-xl bg-white p-6 shadow-lg max-w-lg w-full">
            <h3 className="text-lg font-bold text-gray-900">{taskLabel}</h3>
            <p className="mt-1 text-sm text-gray-600">
                Review payment screenshots for this lead, then approve to complete the milestone.
            </p>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                {loading ? (
                    <p className="text-sm text-gray-500">Loading screenshots…</p>
                ) : uploads.length === 0 ? (
                    <p className="text-sm text-amber-800">No payment screenshots uploaded yet. You can still approve temporarily if payment was verified offline.</p>
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
                                            ? 'bg-green-100 text-green-800'
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

            {!loading && pending.length === 0 && approved.length > 0 ? (
                <p className="mt-2 text-xs text-green-700">Payment screenshots already approved.</p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => void onApprove()}
                    disabled={approving || !leadId}
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
                >
                    {approving ? 'Approving…' : 'Approve payment'}
                </button>
            </div>
        </div>
    );
}
