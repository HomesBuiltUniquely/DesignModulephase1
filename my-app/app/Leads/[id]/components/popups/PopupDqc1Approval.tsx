'use client';

import dynamic from 'next/dynamic';
import type { RefObject } from 'react';
import type { QCRemark, Dqc1Verdict } from '../../types';

const Dqc1PdfViewer = dynamic<{ fileUrl: string; pageNumber: number; onLoadSuccess: (args: { numPages: number }) => void }>(
    () => import('../../../Dqc1PdfViewer'),
    { ssr: false }
);

type Props = {
    onClose: () => void;
    dqc1Verdict: Dqc1Verdict | null;
    setDqc1Verdict: (v: Dqc1Verdict | null) => void;
    dqc1Remarks: QCRemark[];
    removeDqc1Remark: (id: number) => void;
    addDqc1Remark: () => void;
    focusRemarkInPdf: (r: QCRemark) => void;
    newRemarkText: string;
    setNewRemarkText: (v: string) => void;
    newRemarkPriority: 'high' | 'medium' | 'low';
    setNewRemarkPriority: (v: 'high' | 'medium' | 'low') => void;
    dqc1PdfFile: File | null;
    dqc1PdfUrl: string | null;
    dqc1PdfInputRef: RefObject<HTMLInputElement | null>;
    onDqc1PdfSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
    dqc1PdfMaximized: boolean;
    setDqc1PdfMaximized: (v: boolean) => void;
    dqc1PdfNumPages: number;
    dqc1PdfPageNumber: number;
    setDqc1PdfPageNumber: (v: number | ((p: number) => number)) => void;
    dqc1AnnotateMode: boolean;
    setDqc1AnnotateMode: (v: boolean | ((v: boolean) => boolean)) => void;
    dqc1CommentPopup: { xPct: number; yPct: number; page: number; docX?: number; docY?: number } | null;
    setDqc1CommentPopup: (v: { xPct: number; yPct: number; page: number; docX?: number; docY?: number } | null) => void;
    dqc1PdfViewportRef: RefObject<HTMLDivElement | null>;
    dqc1PdfScrollRef: RefObject<HTMLDivElement | null>;
    dqc1SelectedPin: number | null;
    setDqc1SelectedPin: (v: number | null) => void;
    dqc1HighlightedPin: number | null;
    setDqc1PdfNumPages: (v: number) => void;
    submitDqc1Review: () => void;
};

/**
 * DQC 1 approval – Design QC Review: PDF viewer with pins + QC panel + add-comment popup.
 */
export default function PopupDqc1Approval({
    onClose,
    dqc1Verdict,
    setDqc1Verdict,
    dqc1Remarks,
    removeDqc1Remark,
    addDqc1Remark,
    focusRemarkInPdf,
    newRemarkText,
    setNewRemarkText,
    newRemarkPriority,
    setNewRemarkPriority,
    dqc1PdfFile,
    dqc1PdfUrl,
    dqc1PdfInputRef,
    onDqc1PdfSelected,
    dqc1PdfMaximized,
    setDqc1PdfMaximized,
    dqc1PdfNumPages,
    dqc1PdfPageNumber,
    setDqc1PdfPageNumber,
    dqc1AnnotateMode,
    setDqc1AnnotateMode,
    dqc1CommentPopup,
    setDqc1CommentPopup,
    dqc1PdfViewportRef,
    dqc1PdfScrollRef,
    dqc1SelectedPin,
    setDqc1SelectedPin,
    dqc1HighlightedPin,
    setDqc1PdfNumPages,
    submitDqc1Review,
}: Props) {
    return (
        <div className="flex flex-1 flex-col min-h-0 relative">
            <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-lg font-bold text-gray-900">Design QC Review</h3>
                <button onClick={onClose} className="text-gray-700 bg-gray-100 hover:bg-gray-200 text-xl leading-none border border-gray-300 rounded-md px-2 py-1 font-bold text-sm">
                    Close
                </button>
            </div>
            <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className={`flex flex-col border-r border-gray-200 min-w-0 bg-gray-50 transition-all ${dqc1PdfMaximized ? 'flex-[1_1_100%] w-full' : 'flex-1'}`}>
                    <div className="px-4 py-2 text-xs text-gray-500">ERP Module &gt; Engineering &gt; Quality Control</div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
                        <input ref={dqc1PdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={onDqc1PdfSelected} />
                        <span className="text-sm font-medium text-gray-700 truncate max-w-[240px]" title={dqc1PdfFile?.name ?? 'No file selected'}>
                            {dqc1PdfFile?.name ?? 'Select a PDF'}
                        </span>
                        <button type="button" onClick={() => dqc1PdfInputRef.current?.click()} className="px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm">
                            Choose PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => { setDqc1AnnotateMode((v) => !v); setDqc1CommentPopup(null); }}
                            className={`px-3 py-1.5 rounded-md border text-sm ${dqc1AnnotateMode ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700'}`}
                            title="Toggle comment mode"
                        >
                            {dqc1AnnotateMode ? 'Comment mode: ON' : 'Comment mode'}
                        </button>
                        <span className="flex items-center gap-1 ml-auto">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <button type="button" onClick={() => setDqc1PdfPageNumber((p) => Math.max(1, p - 1))} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50" disabled={dqc1PdfPageNumber <= 1} aria-label="Previous page">&lt;</button>
                                Page {dqc1PdfPageNumber} of {dqc1PdfNumPages || 1}
                                <button type="button" onClick={() => setDqc1PdfPageNumber((p) => Math.min(dqc1PdfNumPages || 1, p + 1))} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50" disabled={dqc1PdfPageNumber >= (dqc1PdfNumPages || 1)} aria-label="Next page">&gt;</button>
                            </span>
                        </span>
                        <button type="button" onClick={() => setDqc1PdfMaximized((v) => !v)} className="p-1 rounded hover:bg-gray-100" aria-label={dqc1PdfMaximized ? 'Exit fullscreen' : 'Fullscreen'}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                {dqc1PdfMaximized ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.75H4.5A.75.75 0 003.75 4.5v5.25M14.25 3.75H19.5a.75.75 0 01.75.75v5.25M3.75 14.25V19.5a.75.75 0 00.75.75h5.25M20.25 14.25V19.5a.75.75 0 01-.75.75h-5.25" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v-4.5m0 4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                )}
                            </svg>
                        </button>
                    </div>
                    <div ref={dqc1PdfScrollRef} className="flex-1 overflow-auto p-4 relative flex items-center justify-center min-h-[320px]">
                        <div ref={dqc1PdfViewportRef} className="bg-white border border-gray-200 rounded-lg shadow-inner w-full max-w-4xl relative overflow-hidden">
                            {dqc1PdfUrl ? (
                                <Dqc1PdfViewer fileUrl={dqc1PdfUrl} pageNumber={dqc1PdfPageNumber} onLoadSuccess={(args) => setDqc1PdfNumPages(args.numPages)} />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                                    <div className="text-gray-500 font-medium">No PDF selected</div>
                                    <div className="text-xs">Click “Choose PDF” to load a design file</div>
                                </div>
                            )}
                            <div className="absolute inset-0 pointer-events-none">
                                {dqc1PdfUrl && dqc1AnnotateMode && (
                                    <div
                                        className="absolute inset-0 z-10 cursor-crosshair pointer-events-auto"
                                        onClick={(e) => {
                                            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                            const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                                            const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                                            setDqc1CommentPopup({ xPct, yPct, page: dqc1PdfPageNumber });
                                            setDqc1SelectedPin(null);
                                        }}
                                    />
                                )}
                                {dqc1Remarks.filter((r) => r.page === dqc1PdfPageNumber).map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        className={`absolute z-20 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold border-2 border-white shadow transition pointer-events-auto ${dqc1SelectedPin === r.pinNumber ? 'ring-4 ring-blue-200' : ''} ${dqc1HighlightedPin === r.pinNumber ? 'animate-pulse ring-4 ring-blue-400 ring-offset-2' : ''}`}
                                        style={{ left: `${r.xPct}%`, top: `${r.yPct}%`, transform: 'translate(-50%, -50%)' }}
                                        onClick={(e) => { e.stopPropagation(); setDqc1SelectedPin(r.pinNumber); }}
                                        title={`Pin ${r.pinNumber}`}
                                    >
                                        {r.pinNumber}
                                    </button>
                                ))}
                                {dqc1CommentPopup && dqc1CommentPopup.page === dqc1PdfPageNumber && (
                                    <div
                                        className="absolute z-20 w-8 h-8 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center text-blue-600 font-bold shadow pointer-events-auto"
                                        style={{ left: `${dqc1CommentPopup.xPct}%`, top: `${dqc1CommentPopup.yPct}%`, transform: 'translate(-50%, -50%)' }}
                                        title="New pin (add comment in popup)"
                                    >
                                        +
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className={`${dqc1PdfMaximized ? 'hidden xl:flex xl:w-0' : 'w-[420px]'} flex-shrink-0 flex flex-col overflow-hidden bg-white`}>
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-full bg-gray-600 text-white flex items-center justify-center text-sm font-bold">AT</div>
                                <div>
                                    <p className="font-semibold text-gray-900">Alex Thompson</p>
                                    <p className="text-xs text-gray-500">Lead QA Engineer</p>
                                </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">PENDING REVIEW</span>
                        </div>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto min-h-0">
                        <h4 className="text-base font-bold text-gray-900">Luxury Kitchen Renovation - Unit A</h4>
                        <p className="text-xs text-gray-500 mt-0.5">Project Ref: LKR-2024-089</p>
                        <div className="flex gap-4 mt-3 text-xs">
                            <span><span className="text-gray-500">REVISION:</span> v3.02 (Latest)</span>
                            <span><span className="text-gray-500">DESIGNER:</span> Sarah Jenkins</span>
                        </div>
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-gray-900">QC Remarks</span>
                                <button type="button" onClick={() => { setDqc1AnnotateMode(true); setDqc1CommentPopup(null); }} className="text-xs text-blue-600 font-medium hover:underline">
                                    + Add Remark
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Turn on Comment mode, go to the page (using &lt; &gt;), and click on the PDF where you want to add a remark.</p>
                            <div className="space-y-2 mt-3">
                                {dqc1Remarks.map((r) => (
                                    <div
                                        key={r.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => focusRemarkInPdf(r)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusRemarkInPdf(r); } }}
                                        className={`rounded-lg border p-3 text-sm border-l-4 cursor-pointer ${r.priority === 'high' ? 'border-l-red-500 bg-red-50/50' : r.priority === 'medium' ? 'border-l-amber-500 bg-amber-50/50' : 'border-l-gray-400 bg-gray-50'} ${dqc1SelectedPin === r.pinNumber ? 'ring-2 ring-blue-200 border-blue-200' : ''}`}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <span className={`text-xs font-semibold ${r.priority === 'high' ? 'text-red-700' : r.priority === 'medium' ? 'text-amber-700' : 'text-gray-600'}`}>
                                                {r.priority === 'high' ? 'High Priority' : r.priority === 'medium' ? 'Medium Priority' : 'Low Priority'}
                                            </span>
                                            <span className="text-xs text-gray-500">#{r.pinNumber} Pin {r.pinNumber}</span>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); removeDqc1Remark(r.id); }} className="text-gray-400 hover:text-red-600 p-0.5" aria-label="Remove">
                                                ×
                                            </button>
                                        </div>
                                        <p className="text-gray-700 mt-1">{r.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-6">
                            <p className="font-semibold text-gray-900 mb-3">Final QC Decision</p>
                            <div className="space-y-2">
                                <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer ${dqc1Verdict === 'approved' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <input type="radio" name="dqc1Verdict" checked={dqc1Verdict === 'approved'} onChange={() => setDqc1Verdict('approved')} className="mt-1" />
                                    <div>
                                        <span className="flex items-center gap-2 font-medium text-green-800"><span className="w-5 h-5 rounded-full border-2 border-green-600 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3 text-green-600"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg></span> Approved</span>
                                        <p className="text-xs text-gray-600 mt-0.5">Design meets all quality standards.</p>
                                    </div>
                                </label>
                                <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer ${dqc1Verdict === 'approved_with_changes' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <input type="radio" name="dqc1Verdict" checked={dqc1Verdict === 'approved_with_changes'} onChange={() => setDqc1Verdict('approved_with_changes')} className="mt-1" />
                                    <div>
                                        <span className="flex items-center gap-2 font-medium text-blue-800"><span className="w-5 h-5 rounded-full border-2 border-blue-600 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3 text-blue-600"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg></span> Approved with Changes</span>
                                        <p className="text-xs text-gray-600 mt-0.5">Minor revisions required before final.</p>
                                    </div>
                                </label>
                                <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer ${dqc1Verdict === 'rejected' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <input type="radio" name="dqc1Verdict" checked={dqc1Verdict === 'rejected'} onChange={() => setDqc1Verdict('rejected')} className="mt-1" />
                                    <div>
                                        <span className="flex items-center gap-2 font-medium text-red-800"><span className="w-5 h-5 rounded-full border-2 border-red-600 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3 text-red-600"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></span> Rejected</span>
                                        <p className="text-xs text-gray-600 mt-0.5">Major flaws detected. Redesign needed.</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-200 flex-shrink-0">
                        <button type="button" onClick={submitDqc1Review} disabled={dqc1Verdict === null} className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            Submit Review Verdict
                        </button>
                        {dqc1Verdict === 'approved' && <p className="text-xs text-gray-500 mt-2">Project will move to the next milestone.</p>}
                        {(dqc1Verdict === 'approved_with_changes' || dqc1Verdict === 'rejected') && <p className="text-xs text-gray-500 mt-2">Designers will address comments and re-upload; you can review again later.</p>}
                    </div>
                </div>
            </div>
            {dqc1CommentPopup && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setDqc1CommentPopup(null)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5" onClick={(e) => e.stopPropagation()}>
                        <h4 className="text-lg font-bold text-gray-900 mb-3">Add QC remark</h4>
                        <p className="text-xs text-gray-500 mb-3">Comment will be pinned at the selected location on the PDF.</p>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                        <select value={newRemarkPriority} onChange={(e) => setNewRemarkPriority(e.target.value as 'high' | 'medium' | 'low')} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-3">
                            <option value="high">High Priority</option>
                            <option value="medium">Medium Priority</option>
                            <option value="low">Low Priority</option>
                        </select>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                        <textarea value={newRemarkText} onChange={(e) => setNewRemarkText(e.target.value)} placeholder="Enter your QC remark..." className="w-full text-sm border border-gray-300 rounded-lg p-3 min-h-[100px] resize-y mb-4" />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => { setDqc1CommentPopup(null); setNewRemarkText(''); }} className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button type="button" onClick={() => addDqc1Remark()} disabled={!newRemarkText.trim()} className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
