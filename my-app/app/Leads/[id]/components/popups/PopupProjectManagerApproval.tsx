'use client';

import { useRef, useState } from 'react';
import { getApiBase } from '@/app/lib/apiBase';

const API = getApiBase();

type Props = {
    leadId: number;
    sessionId: string | null;
    projectName: string;
    projectManagerName?: string | null;
    userRole?: string;
    /** When true, show Admin acting on behalf of PM workflow. */
    isAdminApprover?: boolean;
    isSpmApprover?: boolean;
    onApprove: () => void;
    onReject: () => void;
    onClose: () => void;
};

export default function PopupProjectManagerApproval({
    leadId,
    sessionId,
    projectName,
    projectManagerName,
    isAdminApprover,
    isSpmApprover,
    onApprove,
    onReject,
    onClose,
}: Props) {
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [rejectMode, setRejectMode] = useState(false);
    const [pointerFile, setPointerFile] = useState<File | null>(null);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const approverLabel = isAdminApprover
        ? 'Admin'
        : isSpmApprover
          ? 'Senior Project Manager'
          : projectManagerName || 'Project Manager';

    const handleReject = async () => {
        if (!sessionId || !pointerFile) {
            setError('Upload a pointer-to-change file before rejecting.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append('file', pointerFile);
            if (notes.trim()) fd.append('notes', notes.trim());
            const res = await fetch(`${API}/api/leads/${leadId}/reject-pm-approval`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${sessionId}` },
                body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Reject failed');
            onReject();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Reject failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-gray-600">
                Project: <span className="font-medium text-gray-900">{projectName}</span>
            </p>
            <p className="text-sm text-gray-600">
                Review DQC 2 files and lead uploads. Approve to proceed to the 40% payment stage, or reject to send
                the project back to <strong>DQC 2 submission</strong> with a pointer-to-change file for the designer.
            </p>
            {(isAdminApprover || isSpmApprover || projectManagerName) && (
                <p className="text-xs text-gray-500">
                    Acting as: <span className="font-medium">{approverLabel}</span>
                    {isAdminApprover && projectManagerName ? ` (assigned PM: ${projectManagerName})` : ''}
                </p>
            )}

            {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            {!rejectMode ? (
                <div className="flex flex-wrap gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onApprove}
                        disabled={submitting}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60"
                    >
                        Approve and continue
                    </button>
                    <button
                        type="button"
                        onClick={() => setRejectMode(true)}
                        disabled={submitting}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-60"
                    >
                        Reject and send back
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
                    >
                        Close
                    </button>
                </div>
            ) : (
                <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-4">
                    <div>
                        <p className="text-sm font-semibold text-red-900">Reject DQC 2 submission</p>
                        <p className="text-xs text-red-800 mt-1">
                            Upload a pointer-to-change file (markup, PDF, DWG, or ZIP) so the designer knows what to fix.
                            The workflow will return to <strong>DQC 2 submission</strong>.
                        </p>
                    </div>

                    <label className="block text-sm font-medium text-gray-700">
                        Optional notes
                        <textarea
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            rows={2}
                            placeholder="Brief summary of required changes…"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </label>

                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Pointer to change (required)</p>
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="w-full max-w-md border-2 border-dashed border-red-300 rounded-xl bg-white p-6 text-sm text-gray-600 hover:border-red-400 hover:bg-red-50/30 transition-colors"
                        >
                            {pointerFile ? (
                                <span className="font-medium text-gray-900">{pointerFile.name}</span>
                            ) : (
                                'Click to upload pointer-to-change file'
                            )}
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.zip,.dwg,image/*,application/pdf,application/zip"
                            className="hidden"
                            onChange={(e) => {
                                setPointerFile(e.target.files?.[0] ?? null);
                                setError(null);
                            }}
                        />
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={handleReject}
                            disabled={submitting || !pointerFile}
                            className="px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 disabled:opacity-50"
                        >
                            {submitting ? 'Submitting…' : 'Confirm reject'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setRejectMode(false);
                                setPointerFile(null);
                                setNotes('');
                                setError(null);
                            }}
                            disabled={submitting}
                            className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
                        >
                            Back
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
