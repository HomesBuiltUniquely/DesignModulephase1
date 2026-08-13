'use client';

import { useState, useEffect, useRef } from 'react';

import { getApiBase } from '@/app/lib/apiBase';
import CustomDatePicker from '@/app/Components/ui/CustomDatePicker';
import CustomTimePicker from '@/app/Components/ui/CustomTimePicker';
import CustomSelect from '@/app/Components/ui/CustomSelect';
const API = getApiBase();

type PmRow = { id: number; name: string; email: string };
type SpmRow = { id: number; name: string; email: string };

type D2RequestInfo = {
    raised: boolean;
    maskingDate?: string | null;
    maskingTime?: string | null;
    assignedProjectManagerId?: number | null;
    requestedSpmId?: number | null;
};

type SubmitInfo = {
    maskingDate?: string | null;
    maskingTime?: string | null;
};

type Props = {
    leadId: number | null;
    sessionId: string | null;
    userRole?: string;
    currentPmId?: number | null;
    currentPmName?: string | null;
    onAdminApprove?: () => void;
    onSubmit?: (info?: SubmitInfo) => void;
    onPmAssigned?: () => void;
    /** Fired when an already-raised request is loaded (repairs UI completion state) */
    onExistingRaised?: (info?: SubmitInfo) => void;
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
 * Reminder modal shown before the designer submits the D2 masking request.
 */
function ReminderModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[440px] max-w-[90vw] overflow-hidden animate-[fadeInScale_0.25s_ease-out]">
                {/* Header band */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="white" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-white font-semibold text-base">Important Reminder</h3>
                        <p className="text-blue-100 text-xs">Before you proceed to the site</p>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-500">
                                    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-amber-900 font-medium leading-relaxed">
                                    Please ensure you carry the following items for your site visit:
                                </p>
                                <ul className="mt-2 space-y-1.5 text-sm text-amber-800">
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                        <span><strong>Site Masking Checklist</strong> — fully completed and reviewed</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                        <span><strong>Marketing Flyers</strong> — current edition for the project</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                        <span><strong>Measurement Tools</strong> — laser measure, tape, and leveler</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 text-center italic">
                        Kindly verify you have all materials before confirming submission.
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Go Back
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="px-5 py-2 text-sm font-semibold text-white bg-[#00B0ED] rounded-lg hover:bg-[#00B0ED]/90 shadow-sm transition-colors"
                    >
                        I Have My Checklist — Submit
                    </button>
                </div>
            </div>
        </div>
    );
}

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
    const [selectedSpmId, setSelectedSpmId] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [showReminder, setShowReminder] = useState(false);

    // File upload state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const [spmList, setSpmList] = useState<SpmRow[]>([]);
    const [pmList, setPmList] = useState<PmRow[]>([]);
    const [selectedPmId, setSelectedPmId] = useState<string>('');
    const [pmSaving, setPmSaving] = useState(false);
    const [pmError, setPmError] = useState<string | null>(null);
    const [pmSuccess, setPmSuccess] = useState<string | null>(null);

    // Load existing D2 request
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
                if (data.requestedSpmId) setSelectedSpmId(String(data.requestedSpmId));
            })
            .catch(() => setExisting({ raised: false }))
            .finally(() => setLoaded(true));
    }, [leadId, sessionId]);

    // Load SPM list for designer form
    useEffect(() => {
        if (!sessionId) return;
        fetch(`${API}/api/auth/senior-project-managers`, {
            headers: { Authorization: `Bearer ${sessionId}` },
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message || 'Failed to load SPMs');
                return data as SpmRow[];
            })
            .then((rows) => setSpmList(Array.isArray(rows) ? rows : []))
            .catch(() => setSpmList([]));
    }, [sessionId]);

    // Load PM list for SPM assignment
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

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files || []);
        setSelectedFiles((prev) => [...prev, ...files]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function removeFile(index: number) {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    }

    function handleSubmitClick() {
        setShowReminder(true);
    }

    async function handleSubmit() {
        if (!leadId || !sessionId) return;
        setShowReminder(false);
        setSubmitError(null);
        setSubmitting(true);
        try {
            const formData = new FormData();
            if (maskingDate) formData.append('maskingDate', maskingDate);
            if (maskingTime) formData.append('maskingTime', maskingTime);
            if (selectedSpmId) formData.append('requestedSpmId', selectedSpmId);
            for (const file of selectedFiles) {
                formData.append('files', file);
            }

            const res = await fetch(`${API}/api/leads/${leadId}/d2-masking-request`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${sessionId}` },
                body: formData,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSubmitError(data.message || 'Failed to submit D2 masking request');
                return;
            }
            // Close parent modal + show success toast immediately after raise
            onSubmit?.({
                maskingDate: maskingDate || data.maskingDate || null,
                maskingTime: maskingTime || data.maskingTime || null,
            });
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
            setPmSuccess(`PM assigned: ${pmLabel}`);
            onPmAssigned?.();
        } catch {
            setPmError('Could not reach server. Please try again.');
        } finally {
            setPmSaving(false);
        }
    }

    function formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return (
        <>
            {showReminder && (
                <ReminderModal
                    onConfirm={handleSubmit}
                    onCancel={() => setShowReminder(false)}
                />
            )}

            {!loaded && <p className="px-6 py-4 text-sm text-gray-500">Loading…</p>}

            {loaded && isSpm && !requestRaised && (
                <p className="px-6 py-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 mx-6 mt-4 rounded-lg">
                    Waiting for the designer to raise the D2 masking request. Once submitted, you can assign a project manager here.
                </p>
            )}

            {loaded && requestRaised && (
                <div className="px-6 py-3 mt-2">
                    <div className="rounded-xl border border-[#DDCDC1] bg-[#DDCDC1]/20 px-4 py-3">
                        <p className="text-sm font-semibold text-[#32261C]">
                            D2 Site Masking scheduled
                        </p>
                        <p className="text-sm text-[#32261C] mt-1">
                            {existing?.maskingDate || '—'}
                            {existing?.maskingTime ? ` at ${existing.maskingTime}` : ''}
                        </p>
                    </div>
                </div>
            )}

            {loaded && showDesignerForm && (
                <>
                    {/* Date & Time */}
                    <div className="flex items-center justify-between gap-2 px-6 py-2">
                        <div>
                            <div className="font-bold text-sm">Masking Date</div>
                            <CustomDatePicker
                                className="w-[250px] mt-2"
                                value={maskingDate}
                                onChange={(date) => setMaskingDate(date)}
                            />
                        </div>
                        <div>
                            <div className="font-bold text-sm">Masking Time</div>
                            <CustomTimePicker
                                className="w-[250px] mt-2"
                                value={maskingTime}
                                onChange={(val) => setMaskingTime(val)}
                            />
                        </div>
                    </div>
                    <div className="text-[12px] text-gray-400 px-6">Select a future date only</div>

                    {/* SPM Dropdown */}
                    <div className="px-6 mt-4">
                        <label className="block text-sm font-bold text-gray-700">
                            Request to Senior Project Manager
                            <div className="mt-1">
                                <CustomSelect
                                    value={selectedSpmId}
                                    onChange={(val) => setSelectedSpmId(val)}
                                    options={spmList.map((spm) => ({ value: String(spm.id), label: `${spm.name} (${spm.email})` }))}
                                    placeholder="— Select SPM —"
                                    className="w-full"
                                />
                            </div>
                        </label>
                        {spmList.length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">No Senior Project Managers found in the system.</p>
                        )}
                    </div>

                    {/* File Upload */}
                    <div className="px-6 mt-4">
                        <div className="font-bold text-sm mb-2">Attach Files (PDFs, Checklists, Flyers)</div>
                        <div
                            className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-[#00B0ED] hover:bg-[#00B0ED]/10/30 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8 mx-auto text-gray-400 mb-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                            </svg>
                            <p className="text-sm text-gray-500">Click to upload or drag & drop</p>
                            <p className="text-xs text-gray-400 mt-1">PDF, up to 200 MB per file</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        {selectedFiles.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {selectedFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-red-500 flex-shrink-0">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                            </svg>
                                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                            <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(idx)}
                                            className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info box */}
                    <div className="bg-gray-100 rounded-md w-[540px] max-w-[calc(100%-2rem)] h-[70px] p-2 ml-6 mt-6 flex items-center justify-between">
                        <div className="pl-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-gray-400 font-bold">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                            </svg>
                        </div>
                        <div className="text-[12px] text-gray-500 italic p-2 pl-4">
                            The selected Senior Project Manager will be notified and can assign a Project Manager. The customer will receive SMS and email once submitted.
                        </div>
                    </div>
                    {submitError && <p className="text-sm text-red-600 px-6 mt-2">{submitError}</p>}
                    <div className="bg-gray-100 w-full h-[80px] rounded-b-2xl mt-4">
                        <div className="h-[1px] bg-gray-200 w-full mt-10" />
                        <button
                            type="button"
                            onClick={handleSubmitClick}
                            disabled={submitting || !selectedSpmId}
                            className="mt-5 ml-98 bg-[#00B0ED] rounded-md w-[150px] py-1.5 h-[36px] text-white text-sm font-bold text-center items-end disabled:opacity-60"
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
                            <div className="mt-1">
                                <CustomSelect
                                    value={selectedPmId}
                                    onChange={(val) => {
                                        setSelectedPmId(val);
                                        setPmSuccess(null);
                                    }}
                                    options={pmList.map((pm) => ({ value: String(pm.id), label: `${pm.name} (${pm.email})` }))}
                                    placeholder="— Select —"
                                    className="w-full max-w-md"
                                />
                            </div>
                        </label>
                    )}
                    {pmError && <p className="text-sm text-red-600">{pmError}</p>}
                    {pmSuccess && (
                        <p className="text-sm text-[#32261C] bg-[#DDCDC1]/20 border border-[#DDCDC1] rounded-lg px-3 py-2">
                            {pmSuccess}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={handleAssignPm}
                        disabled={pmSaving || !selectedPmId}
                        className="px-6 py-2 bg-[#00B0ED] text-white text-sm font-medium rounded-lg hover:bg-[#00B0ED]/90 disabled:opacity-50"
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
