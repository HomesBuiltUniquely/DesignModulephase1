'use client';

import * as React from 'react';
import type { RefObject } from 'react';
import { getApiBase } from '@/app/lib/apiBase';

const API = getApiBase();

type ShareMomResult = { ok: boolean; message?: string };

type Props = {
    leadId?: number | null;
    sessionId?: string | null;
    momMinutes: string;
    setMomMinutes: (v: string) => void;
    momReferenceFiles: File[];
    momFileInputRef: RefObject<HTMLInputElement | null>;
    openMomFileUpload: () => void;
    onMomFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMomDrop: (e: React.DragEvent) => void;
    removeMomFile: (index: number) => void;
    onClose: () => void;
    onShareMom?: (extra?: {
        attendees: string;
        meetingDate: string;
        completionPercent?: number;
        minutesWithQuote?: string;
        latestQuoteUrl?: string | null;
        latestQuoteId?: number | null;
    }) => Promise<ShareMomResult | void> | ShareMomResult | void;
    /** Progress % saved from the meeting popup — shown read-only so MOM and meeting are in sync */
    initialCompletionPercent?: number;
    /** When true, show 40% payment screenshot upload section (for the "40% collection" task). */
    show40pUpload?: boolean;
    payment40pFiles?: File[];
    payment40pInputRef?: RefObject<HTMLInputElement | null>;
    openPayment40pUpload?: (accept: string) => void;
    onPayment40pFilesSelected?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onPayment40pDrop?: (e: React.DragEvent) => void;
    onPayment40pDragOver?: (e: React.DragEvent) => void;
    removePayment40pFile?: (index: number) => void;
    defaultAttendees?: string;
    defaultMeetingDate?: string;
};

/**
 * Meeting completed – Minutes of Meeting (MOM) popup.
 */
export default function PopupMeetingCompleted({
    leadId,
    sessionId,
    momMinutes,
    setMomMinutes,
    momReferenceFiles,
    momFileInputRef,
    openMomFileUpload,
    onMomFilesSelected,
    onMomDrop,
    removeMomFile,
    onClose,
    onShareMom,
    initialCompletionPercent,
    show40pUpload,
    payment40pFiles = [],
    payment40pInputRef,
    openPayment40pUpload,
    onPayment40pFilesSelected,
    onPayment40pDrop,
    onPayment40pDragOver,
    removePayment40pFile,
    defaultAttendees,
    defaultMeetingDate,
}: Props) {
    const [attendees, setAttendees] = React.useState('');
    const [meetingDate, setMeetingDate] = React.useState('');
    const [fileError, setFileError] = React.useState<string | null>(null);
    const [shareError, setShareError] = React.useState<string | null>(null);
    const [isSharing, setIsSharing] = React.useState(false);
    const [toast, setToast] = React.useState<string | null>(null);
    const [latestQuoteUrl, setLatestQuoteUrl] = React.useState<string | null>(null);
    const [latestQuoteId, setLatestQuoteId] = React.useState<number | null>(null);
    const [quoteLoading, setQuoteLoading] = React.useState(false);
    const [quoteError, setQuoteError] = React.useState<string | null>(null);

    const hasMomFile = momReferenceFiles.length > 0;
    const hasMomText = momMinutes.trim().length > 0;
    const canShare = hasMomFile && hasMomText && !isSharing && !toast;

    React.useEffect(() => {
        if (hasMomFile) setFileError(null);
    }, [hasMomFile]);

    React.useEffect(() => {
        if (!leadId || !sessionId) {
            setLatestQuoteUrl(null);
            setLatestQuoteId(null);
            return;
        }
        let cancelled = false;
        setQuoteLoading(true);
        setQuoteError(null);
        fetch(`${API}/api/leads/${leadId}/latest-quote-link`, {
            headers: { Authorization: `Bearer ${sessionId}` },
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message || 'Failed to load quotation');
                return data as {
                    quoteId?: number | null;
                    customerQuoteUrl?: string | null;
                };
            })
            .then((data) => {
                if (cancelled) return;
                const url = data.customerQuoteUrl || null;
                const qid = data.quoteId != null ? Number(data.quoteId) : null;
                setLatestQuoteUrl(url);
                setLatestQuoteId(qid && qid > 0 ? qid : null);
                if (!url) setQuoteError('No quotation found for this lead yet. Generate a quote first.');
            })
            .catch(() => {
                if (!cancelled) {
                    setLatestQuoteUrl(null);
                    setLatestQuoteId(null);
                    setQuoteError('Could not load the latest quotation link.');
                }
            })
            .finally(() => {
                if (!cancelled) setQuoteLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [leadId, sessionId]);

    const minutesWithQuoteAttached = React.useMemo(() => {
        const trimmed = (momMinutes || '').trim();
        if (!latestQuoteUrl) return trimmed;
        if (trimmed.includes(latestQuoteUrl)) return trimmed;
        const block = `Latest quotation link:\n${latestQuoteUrl}`;
        return trimmed ? `${trimmed}\n\n${block}` : block;
    }, [momMinutes, latestQuoteUrl]);

    const handleShareMom = async () => {
        if (isSharing || toast) return;
        if (!hasMomText) {
            setFileError('Please enter Minutes of Meeting (MOM) text.');
            setShareError(null);
            return;
        }
        if (!hasMomFile) {
            setFileError('Please upload at least one reference file before submitting the MOM.');
            setShareError(null);
            return;
        }
        if (!onShareMom) return;
        setFileError(null);
        setShareError(null);
        if (latestQuoteUrl && momMinutes !== minutesWithQuoteAttached) {
            setMomMinutes(minutesWithQuoteAttached);
        }
        setIsSharing(true);
        try {
            const result = await onShareMom({
                attendees,
                meetingDate,
                completionPercent: initialCompletionPercent ?? 100,
                minutesWithQuote: minutesWithQuoteAttached,
                latestQuoteUrl,
                latestQuoteId,
            });
            if (result && result.ok === false) {
                setShareError(result.message || 'Failed to share MOM. Please try again.');
                return;
            }
            setToast('MOM shared successfully.');
            setTimeout(() => {
                setToast(null);
                onClose();
            }, 3000);
        } catch (err) {
            setShareError(err instanceof Error ? err.message : 'Failed to share MOM. Please try again.');
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className="px-6 pb-6 max-w-[640px] mt-6">
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-[#00B0ED]">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <h2 className="text-xl font-bold text-gray-900">Minutes of Meeting (MOM)</h2>
                    </div>
                    <p className="text-sm text-gray-500">Submit official meeting summary to unlock next project stage.</p>
                </div>
                <span className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-orange-400 text-orange-600 text-xs font-bold rounded whitespace-nowrap">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                    STAGE EXIT LOCK
                </span>
            </div>

            <div className="mb-6 rounded-xl border border-[#DDCDC1] bg-[#DDCDC1]/20 px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#32261C]">Latest Quotation</p>
                    {quoteLoading && <span className="text-xs text-[#32261C]">Fetching…</span>}
                </div>
                {latestQuoteUrl ? (
                    <div className="space-y-1">
                        <p className="text-sm text-[#32261C]">
                            Quote #{latestQuoteId ?? '—'} will be attached automatically in this MOM.
                        </p>
                        <a
                            href={latestQuoteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[#32261C] underline break-all hover:text-[#32261C]"
                        >
                            {latestQuoteUrl}
                        </a>
                    </div>
                ) : (
                    <p className="text-sm text-amber-800">
                        {quoteError || 'No quotation available yet. Generate a quote so the link can be attached.'}
                    </p>
                )}
            </div>

            <div className="mb-6 px-1">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Design Completion (From Scheduled Meeting)</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        (initialCompletionPercent ?? 100) === 100
                            ? 'bg-[#DDCDC1]/40 text-[#32261C]'
                            : 'bg-[#00B0ED]/15 text-[#00B0ED]'
                    }`}>
                        {initialCompletionPercent ?? 100}%
                    </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                            (initialCompletionPercent ?? 100) === 100 ? 'bg-[#EF0101]/80' : 'bg-[#00B0ED]'
                        }`}
                        style={{ width: `${initialCompletionPercent ?? 100}%` }}
                    />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                    {(initialCompletionPercent ?? 100) === 100
                        ? '✅ Design marked 100% complete at meeting. MOM is in sync.'
                        : `Design was ${initialCompletionPercent}% complete at the time of meeting.`}
                </p>
            </div>

            <div className="mb-6">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-sm font-bold text-gray-800">Minutes of the Meeting (MOM)</label>
                    <span className="text-xs text-gray-400">Required Field</span>
                </div>
                <textarea
                    value={momMinutes}
                    onChange={(e) => setMomMinutes(e.target.value)}
                    placeholder={'• Customer liked kitchen layout; requested granite countertop switch.\n• Agreed on 15th Nov for next site visit.\n• Budget ceiling confirmed at $45,000.'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-gray-700 text-sm min-h-[140px] resize-y"
                    rows={6}
                />
                <div className="flex items-start gap-2 mt-2 p-3 bg-gray-100 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-[#00B0ED] flex-shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
                    <p className="text-xs text-gray-600">Please ensure all final decisions and client approvals are documented clearly for audit purposes. The latest quotation link is attached automatically on submit.</p>
                </div>
            </div>
            <div className="mb-6">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-gray-800">Reference Images / Markups / Screenshots</h3>
                    <span className="text-xs text-red-600 font-medium">Required</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                    Attach at least one file (visual proof). You can upload multiple files. MOM cannot be submitted without a file.
                </p>
                <input ref={momFileInputRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" multiple onChange={onMomFilesSelected} />
                <div
                    onClick={openMomFileUpload}
                    onDrop={(e) => { e.preventDefault(); onMomDrop(e); setFileError(null); }}
                    onDragOver={(e) => e.preventDefault()}
                    className={`border-2 border-dashed rounded-xl bg-gray-50 p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#00B0ED]/50 hover:bg-gray-100 transition-colors ${
                        fileError ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-300'
                    }`}
                >
                    <div className="w-12 h-12 rounded-full bg-[#00B0ED]/15 flex items-center justify-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-[#00B0ED]"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                    </div>
                    <p className="text-sm font-medium text-gray-700">Drag & drop or click to add files</p>
                    <p className="text-xs text-gray-500 mt-0.5">JPG, PNG, PDF · multiple files · up to 10MB each</p>
                </div>
                {momReferenceFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-gray-600">{momReferenceFiles.length} file{momReferenceFiles.length === 1 ? '' : 's'} attached</p>
                        {momReferenceFiles.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="flex items-center justify-between text-sm bg-gray-100 rounded-lg px-3 py-2">
                                <span className="text-gray-700 truncate flex-1" title={file.name}>{file.name}</span>
                                <span className="text-xs text-gray-400 mx-2 flex-shrink-0">
                                    {file.size < 1024 * 1024
                                        ? `${(file.size / 1024).toFixed(1)} KB`
                                        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeMomFile(index)}
                                    className="text-red-600 hover:underline ml-2 flex-shrink-0"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {fileError && <p className="text-sm text-red-600 mt-2">{fileError}</p>}
            </div>
            <div className="flex items-start gap-2 mb-6 p-3 bg-[#00B0ED]/10 border border-[#00B0ED]/20 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-[#00B0ED] flex-shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                <p className="text-xs text-gray-700"><strong>LEGAL DISCLAIMER:</strong> THIS MOM WILL BE TREATED AS OFFICIAL DESIGN DISCUSSION RECORD AND WILL BE USED AS THE PRIMARY REFERENCE FOR DISPUTE RESOLUTION OR STAGE SIGN-OFFS.</p>
            </div>

            {show40pUpload && openPayment40pUpload && onPayment40pFilesSelected && removePayment40pFile && (
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">40% payment screenshots (for finance)</h3>
                    <p className="text-xs text-gray-500 mb-3">Upload payment screenshots. These will be sent to the finance team to review and approve; the milestone will advance automatically after approval.</p>
                    <input ref={payment40pInputRef} type="file" className="hidden" multiple accept="image/*,.pdf,application/pdf" onChange={onPayment40pFilesSelected} />
                    <div
                        onClick={() => openPayment40pUpload('image/*,.pdf,application/pdf')}
                        onDrop={(e) => { e.preventDefault(); onPayment40pDrop?.(e); }}
                        onDragOver={(e) => { e.preventDefault(); onPayment40pDragOver?.(e); }}
                        className="flex-1 min-w-[200px] border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#DDCDC1] hover:bg-gray-100 transition-colors"
                    >
                        <div className="w-12 h-12 rounded-full bg-[#DDCDC1]/40 flex items-center justify-center mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-[#32261C]"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                        </div>
                        <p className="text-sm font-medium text-gray-700">Drag & drop or click to add payment screenshots</p>
                        <p className="text-xs text-gray-500 mt-0.5">Images or PDF</p>
                    </div>
                    {payment40pFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {payment40pFiles.map((file, index) => (
                                <div key={`${file.name}-${index}`} className="flex items-center justify-between text-sm bg-gray-100 rounded-lg px-3 py-2">
                                    <span className="text-gray-700 truncate flex-1">{file.name}</span>
                                    <button type="button" onClick={() => removePayment40pFile(index)} className="text-red-600 hover:underline ml-2 flex-shrink-0">Remove</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {shareError && <p className="mb-3 text-sm font-medium text-red-600">{shareError}</p>}

            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isSharing || !!toast}
                    className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleShareMom}
                    disabled={!canShare}
                    className="px-5 py-2 bg-[#00B0ED] text-white font-medium rounded-lg hover:bg-[#00B0ED]/90 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!hasMomFile ? 'Upload at least one file to submit MOM' : !hasMomText ? 'Enter MOM text to submit' : undefined}
                >
                    {isSharing ? 'Sharing…' : show40pUpload ? 'Share MOM & send to finance' : 'Share the MOM'}
                    {!isSharing && (
                        <span className="pl-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 fill-white">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>
                        </span>
                    )}
                </button>
            </div>

            {toast && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white text-base font-medium px-8 py-4 rounded-lg shadow-2xl z-[9999] text-center max-w-md">
                    {toast}
                </div>
            )}
        </div>
    );
}
