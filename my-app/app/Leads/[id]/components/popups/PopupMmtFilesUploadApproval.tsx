'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBase } from '@/app/lib/apiBase';

const API = getApiBase();

type UploadRow = { id: number; originalName: string; uploadedAt: string; status?: string };

type Props = {
    leadId: number | null;
    sessionId: string | null;
    userRole?: string;
    /** d2_masking for D2 SITE MASKING; omit or d1 for D1 measurement files */
    uploadType?: 'd2_masking' | 'd1';
    taskLabel: string;
    onApproved?: () => void;
    onClose: () => void;
};

function canApproveMmtWorkflow(role: string | undefined): boolean {
    const r = (role || '').toLowerCase();
    return r === 'admin' || r === 'mmt_manager';
}

export default function PopupMmtFilesUploadApproval({
    leadId,
    sessionId,
    userRole,
    uploadType,
    taskLabel,
    onApproved,
    onClose,
}: Props) {
    const [uploads, setUploads] = useState<UploadRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [approvingId, setApprovingId] = useState<number | null>(null);

    const canApprove = canApproveMmtWorkflow(userRole);
    const isAdmin = (userRole || '').toLowerCase() === 'admin';

    const authHeaders = useMemo(() => {
        const h: Record<string, string> = {};
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
            if (!res.ok) throw new Error(data?.message || 'Failed to load uploads');
            const list = Array.isArray(data) ? data : [];
            const filtered = list.filter((u: UploadRow & { uploadType?: string }) => {
                const t = (u as { uploadType?: string }).uploadType;
                if (uploadType === 'd2_masking') return t === 'd2_masking';
                return !t || t === 'd1' || t === '';
            });
            setUploads(
                filtered.map((u: UploadRow) => ({
                    ...u,
                    status: u.status || 'approved',
                })),
            );
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load uploads');
        } finally {
            setLoading(false);
        }
    }, [leadId, authHeaders, uploadType]);

    useEffect(() => {
        void loadUploads();
    }, [loadUploads]);

    const pending = uploads.filter((u) => u.status === 'pending');
    const approved = uploads.filter((u) => u.status === 'approved');

    const onApprove = async (uploadId: number) => {
        if (!leadId || !canApprove) return;
        setApprovingId(uploadId);
        setError(null);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/uploads/${uploadId}/approve`, {
                method: 'POST',
                headers: authHeaders,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || 'Approve failed');
            await loadUploads();
            onApproved?.();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Approve failed');
        } finally {
            setApprovingId(null);
        }
    };

    return (
        <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-gray-600">
                {uploadType === 'd2_masking' ? (
                    <>
                        Review D2 masking uploads for <strong>{taskLabel}</strong>. SPM or the assigned project manager can upload multiple PDF files from the Files card or D2 uploads page.
                    </>
                ) : (
                    <>
                        Review MMT uploads for <strong>{taskLabel}</strong>. Pending files must be approved before designers can use them.
                    </>
                )}
                {isAdmin && (
                    <span className="block mt-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                        You are approving as Admin (same as MMT Manager).
                    </span>
                )}
            </p>

            {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            {loading ? (
                <p className="text-sm text-gray-500">Loading uploads…</p>
            ) : uploads.length === 0 ? (
                <p className="text-sm text-gray-600">
                    No uploads yet.{' '}
                    {uploadType === 'd2_masking'
                        ? 'SPM or the assigned project manager can upload PDFs from this lead’s Files card or the D2 uploads page.'
                        : 'MMT can upload from this lead’s Files card or the D1 uploads page.'}
                </p>
            ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {uploads.map((u) => (
                        <li
                            key={u.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                            <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">{u.originalName}</p>
                                <p className="text-xs text-gray-500">{new Date(u.uploadedAt).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span
                                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                        u.status === 'approved'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-amber-100 text-amber-800'
                                    }`}
                                >
                                    {u.status === 'approved' ? 'Approved' : 'Pending'}
                                </span>
                                {canApprove && u.status === 'pending' && (
                                    <button
                                        type="button"
                                        onClick={() => void onApprove(u.id)}
                                        disabled={approvingId === u.id}
                                        className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-60"
                                    >
                                        {approvingId === u.id ? 'Approving…' : 'Approve'}
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {pending.length === 0 && approved.length > 0 && (
                <p className="text-sm text-green-800">All uploads are approved. This task can stay marked complete.</p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
                <button
                    type="button"
                    onClick={() => void loadUploads()}
                    disabled={loading}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    Refresh
                </button>
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                    Close
                </button>
            </div>
        </div>
    );
}

export { canApproveMmtWorkflow };
