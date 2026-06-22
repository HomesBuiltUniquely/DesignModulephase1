'use client';

import { useState, useEffect } from 'react';

import { getApiBase } from '@/app/lib/apiBase';
const API = getApiBase();

type PmRow = { id: number; name: string; email: string };

type D2RequestInfo = {
    raised: boolean;
    maskingDate?: string | null;
    maskingTime?: string | null;
    assignedProjectManagerId?: number | null;
};

type Props = {
    leadId: number | null;
    sessionId: string | null;
    userRole?: string;
    currentPmId?: number | null;
    currentPmName?: string | null;
    /** Admin: mark masking request step complete without re-submitting */
    onAdminApprove?: () => void;
    onSubmit?: () => void;
    onPmAssigned?: () => void;
};

function canAssignProjectManager(role: string | undefined): boolean {
    const r = (role || '').toLowerCase();
    return (
        r === 'admin' ||
        r === 'territorial_design_manager' ||
        r === 'deputy_general_manager' ||
        r === 'senior_project_manager'
    );
}

function canApproveAsAdmin(role: string | undefined): boolean {
    return (role || '').toLowerCase() === 'admin';
}

/**
 * D2 - masking request raise: designer submits date/time → SPM is notified.
 * SPM (or Admin/TDM/DGM) assigns the project manager from this same task.
 */
export default function PopupD2MaskingRequest({
    leadId,
    sessionId,
    userRole,
    currentPmId,
    currentPmName,
    onAdminApprove,
    onSubmit,
    onPmAssigned,
}: Props) {
    const role = (userRole || '').toLowerCase();
    const canAssignPm = canAssignProjectManager(userRole);
    const isSpm = role === 'senior_project_manager';
    const canAdminApprove = canApproveAsAdmin(userRole);

    const [existing, setExisting] = useState<D2RequestInfo | null>(null);
    const [loaded, setLoaded] = useState(false);

    const [maskingDate, setMaskingDate] = useState<string>('');
    const [maskingTime, setMaskingTime] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [pmList, setPmList] = useState<PmRow[]>([]);
    const [selectedPmId, setSelectedPmId] = useState<string>('');
    const [pmSaving, setPmSaving] = useState(false);
    const [pmError, setPmError] = useState<string | null>(null);
    const [pmSuccess, setPmSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!leadId || !sessionId) {
            setLoaded(true);
            return;
        }
        fetch(`${API}/api/leads/${leadId}/d2-masking-request`, {
            headers: { Authorization: `Bearer ${sessionId}` },
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message || 'Failed to load request');
                return data as D2RequestInfo;
            })
            .then((data) => {
                setExisting(data);
                if (data.maskingDate) setMaskingDate(String(data.maskingDate).slice(0, 10));
                if (data.maskingTime) setMaskingTime(data.maskingTime);
            })
            .catch(() => setExisting({ raised: false }))
            .finally(() => setLoaded(true));
    }, [leadId, sessionId]);

    useEffect(() => {
        if (!canAssignPm || !sessionId) return;
        fetch(`${API}/api/auth/project-managers`, {
            headers: { Authorization: `Bearer ${sessionId}` },
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message || 'Failed to load project managers');
                return data as PmRow[];
            })
            .then((rows) => setPmList(Array.isArray(rows) ? rows : []))
            .catch(() => setPmList([]));
    }, [canAssignPm, sessionId]);

    useEffect(() => {
        const pmId = currentPmId ?? existing?.assignedProjectManagerId;
        if (pmId) setSelectedPmId(String(pmId));
    }, [currentPmId, existing?.assignedProjectManagerId]);

    const requestRaised = !!existing?.raised;
    const showDesignerForm = !isSpm && !requestRaised;
    const showSpmAssignment = canAssignPm && requestRaised;

    async function handleSubmit() {
        if (!leadId || !sessionId) return;
        setSubmitError(null);
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/d2-masking-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionId}` },
                body: JSON.stringify({
                    maskingDate: maskingDate || null,
                    maskingTime: maskingTime || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSubmitError(data.message || 'Failed to submit D2 masking request');
                return;
            }
            onSubmit?.();
        } catch {
            setSubmitError('Could not reach server. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleAssignPm() {
        if (!leadId || !sessionId || !selectedPmId) return;
        setPmError(null);
        setPmSuccess(null);
        setPmSaving(true);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/assign-project-manager`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${sessionId}`,
                },
                body: JSON.stringify({ projectManagerId: Number(selectedPmId) }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setPmError(data.message || 'Failed to assign project manager');
                return;
            }
            const assignedPm = pmList.find((pm) => String(pm.id) === selectedPmId);
            const pmLabel = assignedPm?.name || currentPmName || 'Project manager';
            const message = `PM assigned: ${pmLabel}`;
            setPmSuccess(message);
            window.alert(message);
            onPmAssigned?.();
        } catch {
            setPmError('Could not reach server. Please try again.');
        } finally {
            setPmSaving(false);
        }
    }

    return (
        <>
            {!loaded && <p className="px-6 py-4 text-sm text-gray-500">Loading…</p>}

            {loaded && isSpm && !requestRaised && (
                <p className="px-6 py-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 mx-6 mt-4 rounded-lg">
                    Waiting for the designer to raise the D2 masking request. Once submitted, you can assign a project manager here.
                </p>
            )}

            {loaded && requestRaised && (
                <div className="px-6 py-3 mt-2">
                    <p className="text-sm text-gray-700">
                        Scheduled masking:{' '}
                        <strong>
                            {existing?.maskingDate || '—'}
                            {existing?.maskingTime ? ` at ${existing.maskingTime}` : ''}
                        </strong>
                    </p>
                </div>
            )}

            {loaded && showDesignerForm && (
                <>
                    <div className="flex items-center justify-between gap-2 px-6 py-2">
                        <div>
                            <div className="font-bold text-sm">Masking Date</div>
                            <input
                                type="date"
                                className="w-[250px] border border-gray-300 rounded-md p-2 mt-2"
                                value={maskingDate}
                                onChange={(e) => setMaskingDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <div className="font-bold text-sm">Masking Time</div>
                            <input
                                type="time"
                                className="w-[250px] border border-gray-300 rounded-md p-2 mt-2"
                                value={maskingTime}
                                onChange={(e) => setMaskingTime(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="text-[12px] text-gray-400 px-6">Select a future date only</div>
                    <div className="bg-gray-100 rounded-md w-[540px] max-w-[calc(100%-2rem)] h-[70px] p-2 ml-6 mt-6 flex items-center justify-between">
                        <div className="pl-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-gray-400 font-bold">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                            </svg>
                        </div>
                        <div className="text-[12px] text-gray-500 italic p-2 pl-4">
                            The Senior Project Manager will be notified to assign a project manager. The customer will receive SMS and email once submitted.
                        </div>
                    </div>
                    {submitError && <p className="text-sm text-red-600 px-6 mt-2">{submitError}</p>}
                    <div className="bg-gray-100 w-full h-[80px] rounded-b-2xl mt-4">
                        <div className="h-[1px] bg-gray-200 w-full mt-10" />
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="mt-5 ml-98 bg-blue-500 rounded-md w-[150px] py-1.5 h-[36px] text-white text-sm font-bold text-center items-end disabled:opacity-60"
                        >
                            {submitting ? 'Submitting…' : 'Submit Request'}
                        </button>
                    </div>
                </>
            )}

            {loaded && showSpmAssignment && (
                <div className="px-6 pb-6 space-y-4">
                    <div className="flex items-center gap-2 py-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-gray-400 fill-gray-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                        </svg>
                        <div className="font-bold text-[12px] text-gray-500 tracking-wide">ASSIGN PROJECT MANAGER</div>
                    </div>
                    <p className="text-sm text-gray-600">
                        {isSpm
                            ? 'Assign the project manager who will upload D2 files and approve at DQC2.'
                            : 'Assign or update the project manager for this D2 masking request.'}
                    </p>
                    {currentPmName && (
                        <p className="text-sm text-gray-700">
                            Currently assigned: <span className="font-medium">{currentPmName}</span>
                        </p>
                    )}
                    {pmList.length === 0 ? (
                        <p className="text-sm text-amber-700">No project managers found. Create one from the admin hub first.</p>
                    ) : (
                        <label className="block text-sm font-medium text-gray-700">
                            Project manager
                            <select
                                className="mt-1 block w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                value={selectedPmId}
                                onChange={(e) => {
                                    setSelectedPmId(e.target.value);
                                    setPmSuccess(null);
                                }}
                            >
                                <option value="">— Select —</option>
                                {pmList.map((pm) => (
                                    <option key={pm.id} value={String(pm.id)}>
                                        {pm.name} ({pm.email})
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    {pmError && <p className="text-sm text-red-600">{pmError}</p>}
                    {pmSuccess && (
                        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                            {pmSuccess}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={handleAssignPm}
                        disabled={pmSaving || !selectedPmId}
                        className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {pmSaving ? 'Saving…' : currentPmId ? 'Update assignment' : 'Assign project manager'}
                    </button>
                </div>
            )}

            {loaded && canAdminApprove && onAdminApprove && (
                <div className="mx-6 mt-4 mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <p className="text-xs text-amber-900 mb-2">
                        Admin: approve this step if the D2 masking request was already raised.
                    </p>
                    <button
                        type="button"
                        onClick={onAdminApprove}
                        className="px-4 py-2 bg-amber-700 text-white text-sm font-semibold rounded-lg hover:bg-amber-800"
                    >
                        Approve masking request
                    </button>
                </div>
            )}
        </>
    );
}
