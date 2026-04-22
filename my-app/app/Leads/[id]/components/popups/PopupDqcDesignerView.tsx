'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import { getApiBase } from '@/app/lib/apiBase';
const API = getApiBase();

const Dqc1PdfViewer = dynamic<{
  fileUrl: string;
  pageNumber: number;
  onLoadSuccess: (args: { numPages: number }) => void;
}>(() => import('../../../Dqc1PdfViewer'), { ssr: false });

type DqcRemark = {
  priority: string;
  text: string;
  resolved?: boolean;
  page?: number;
  xPct?: number;
  yPct?: number;
  pinNumber?: number;
  uploadId?: number;
  uploadName?: string;
};
type DqcReview = {
  id: number;
  verdict: string;
  remarks: DqcRemark[];
  createdAt: string;
};

type Props = {
  onClose: () => void;
  leadId: number | null;
  sessionId: string | null;
  /** When 'dqc2', load PDF from DQC 2 submission files instead of DQC 1 */
  submissionVariant?: 'dqc1' | 'dqc2';
  projectName: string;
  projectRef: string;
  onEditResubmit: () => void;
};

/**
 * Designer view: same PDF DQC reviewed, with their comments (pins) shown on the PDF.
 * Designers see the PDF + marked comments and can mark each remark as solved, then Edit & Resubmit.
 */
export default function PopupDqcDesignerView({
  onClose,
  leadId,
  sessionId,
  submissionVariant = 'dqc1',
  projectName,
  projectRef,
  onEditResubmit,
}: Props) {
  const [review, setReview] = useState<DqcReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvingIndex, setResolvingIndex] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState(0);
  const [submissionFiles, setSubmissionFiles] = useState<Array<{ id: number; originalName: string }>>([]);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [highlightedRemarkIndex, setHighlightedRemarkIndex] = useState<number | null>(null);
  const pdfBlobUrlRef = useRef<string | null>(null);

  const fetchReview = useCallback(async () => {
    if (!leadId || !sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/leads/${leadId}/dqc-review`, {
        headers: { Authorization: `Bearer ${sessionId}` },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) setReview(data);
      else setReview(null);
    } catch {
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [leadId, sessionId]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  // Load the same PDF that DQC reviewed (DQC 1 or DQC 2 submission file) so designers see it with comments
  const submissionFilesEndpoint = submissionVariant === 'dqc2' ? 'dqc2-submission-files' : 'dqc-submission-files';
  const loadFileBlob = useCallback((fileToLoad: { id: number; originalName: string }) => {
    if (!leadId || !sessionId) return Promise.resolve();
    const url = `${API}/api/leads/${leadId}/uploads/${fileToLoad.id}/file?path=${encodeURIComponent(fileToLoad.originalName)}`;
    return fetch(url, { headers: { Authorization: `Bearer ${sessionId}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!blob) return;
        setPdfLoading(false);
        if (blob.type === 'application/pdf') {
          if (pdfBlobUrlRef.current) URL.revokeObjectURL(pdfBlobUrlRef.current);
          const blobUrl = URL.createObjectURL(blob);
          pdfBlobUrlRef.current = blobUrl;
          setPdfUrl(blobUrl);
          setPdfPageNumber(1);
        } else {
          setPdfUrl(null);
        }
      });
  }, [leadId, sessionId]);

  useEffect(() => {
    if (!leadId || !sessionId || !review) return;
    setPdfLoading(true);
    let cancelled = false;
    fetch(`${API}/api/leads/${leadId}/${submissionFilesEndpoint}`, {
      headers: { Authorization: `Bearer ${sessionId}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { drawing?: { id: number; originalName: string }; quotation?: { id: number; originalName: string }; drawingFiles?: Array<{ id: number; originalName: string }>; quotationFiles?: Array<{ id: number; originalName: string }> } | null) => {
        if (cancelled) return;
        const drawingFiles = Array.isArray(data?.drawingFiles) ? data.drawingFiles : [];
        const quotationFiles = Array.isArray(data?.quotationFiles) ? data.quotationFiles : [];
        const allFiles = [...drawingFiles, ...quotationFiles];
        setSubmissionFiles(allFiles);
        const fileToLoad = allFiles[0] ?? data?.drawing ?? data?.quotation ?? null;
        if (!fileToLoad) {
          setPdfLoading(false);
          return;
        }
        setSelectedFileId(fileToLoad.id);
        return loadFileBlob(fileToLoad);
      })
      .catch(() => {
        if (!cancelled) setPdfLoading(false);
      });
    return () => {
      cancelled = true;
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }
    };
  }, [leadId, sessionId, review?.id, submissionVariant, loadFileBlob]);

  const markSolved = async (index: number) => {
    if (!leadId || !sessionId) return;
    setResolvingIndex(index);
    try {
      const res = await fetch(`${API}/api/leads/${leadId}/dqc-review/remarks/${index}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionId}` },
      });
      if (res.ok) await fetchReview();
    } finally {
      setResolvingIndex(null);
    }
  };

  const isRejected = review?.verdict === 'rejected';
  const hasRemarks = review?.remarks?.length && review.remarks.length > 0;
  const visibleRemarks = (review?.remarks ?? []).filter((r) =>
    selectedFileId == null ? true : r.uploadId == null || r.uploadId === selectedFileId
  );
  const remarksWithPosition = visibleRemarks.filter((r) => r.page != null && r.xPct != null && r.yPct != null) ?? [];
  const remarksWithPositionAndIndex = (review?.remarks ?? [])
    .map((r, index) => ({ remark: r, index }))
    .filter(({ remark }) =>
      (selectedFileId == null || remark.uploadId == null || remark.uploadId === selectedFileId) &&
      remark.page != null &&
      remark.xPct != null &&
      remark.yPct != null
    );

  const goToComment = useCallback((index: number) => {
    const r = review?.remarks?.[index];
    if (!r) return;
    setPdfPageNumber(r.page ?? 1);
    setHighlightedRemarkIndex(index);
  }, [review?.remarks]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-900">DQC Review Feedback</h3>
        <button
          onClick={onClose}
          className="text-gray-700 bg-gray-100 hover:bg-gray-200 text-xl leading-none border border-gray-300 rounded-md px-2 py-1 font-bold text-sm"
        >
          Close
        </button>
      </div>
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left: PDF with DQC comment pins */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 bg-gray-50">
          <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">PDF under review</span>
            {submissionFiles.length > 1 && (
              <select
                value={selectedFileId ?? submissionFiles[0].id}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const file = submissionFiles.find((f) => f.id === id);
                  if (!file) return;
                  setSelectedFileId(id);
                  setPdfLoading(true);
                  loadFileBlob(file);
                }}
                className="px-2 py-1 rounded border border-gray-300 text-sm max-w-[220px]"
              >
                {submissionFiles.map((f) => (
                  <option key={f.id} value={f.id}>{f.originalName}</option>
                ))}
              </select>
            )}
            <span className="text-xs text-gray-500">
              Page {pdfPageNumber} of {pdfNumPages || 1}
            </span>
            {pdfNumPages > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setPdfPageNumber((p) => Math.max(1, p - 1))}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
                  disabled={pdfPageNumber <= 1}
                >
                  &lt;
                </button>
                <button
                  type="button"
                  onClick={() => setPdfPageNumber((p) => Math.min(pdfNumPages, p + 1))}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
                  disabled={pdfPageNumber >= pdfNumPages}
                >
                  &gt;
                </button>
              </>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-start justify-center min-h-[240px] relative">
            {pdfLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-gray-500 text-sm">
                Loading PDF…
              </div>
            )}
            {!pdfUrl && !pdfLoading && (
              <div className="flex flex-col items-center justify-center text-gray-500 text-sm gap-1 py-8">
                <p>No PDF to display.</p>
                <p className="text-xs">The file DQC reviewed will appear here when available.</p>
              </div>
            )}
            {pdfUrl && (
              <div className="relative bg-white border border-gray-200 rounded-lg shadow-inner overflow-hidden">
                <Dqc1PdfViewer
                  fileUrl={pdfUrl}
                  pageNumber={pdfPageNumber}
                  onLoadSuccess={(args) => setPdfNumPages(args.numPages)}
                />
                {/* Pins overlay: show DQC comments on the PDF */}
                <div className="absolute inset-0 pointer-events-none">
                  {remarksWithPositionAndIndex
                    .filter(({ remark }) => (remark.page ?? 1) === pdfPageNumber)
                    .map(({ remark: r, index }) => (
                      <div
                        key={index}
                        className={`absolute z-10 w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-bold border-2 border-white shadow transition-all ${
                          highlightedRemarkIndex === index ? 'bg-blue-800 ring-4 ring-blue-400 scale-110' : 'bg-blue-600'
                        }`}
                        style={{
                          left: `${r.xPct ?? 0}%`,
                          top: `${r.yPct ?? 0}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        title={r.text}
                      >
                        {r.pinNumber ?? index + 1}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Remarks list + Mark as solved */}
        <div className="w-full lg:w-[380px] flex-shrink-0 flex flex-col overflow-y-auto p-6">
          <div className="mb-4">
            <h4 className="text-lg font-bold text-gray-900">{projectName}</h4>
            <p className="text-sm text-gray-500 mt-0.5">Project Ref: {projectRef}</p>
            {review && (
              <div
                className={`mt-3 inline-block px-4 py-2 rounded-lg text-sm font-semibold ${
                  isRejected ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isRejected ? 'REJECTED' : 'APPROVED WITH CHANGES'}
              </div>
            )}
          </div>

          {loading ? (
            <p className="text-gray-500">Loading review…</p>
          ) : !review ? (
            <p className="text-gray-500">No DQC review yet. Submit your design for review first.</p>
          ) : !hasRemarks ? (
            <p className="text-gray-500">No remarks in this review.</p>
          ) : (
            <>
              <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm font-semibold text-red-800">Address DQC comments</p>
                <p className="text-sm text-red-700 mt-1">
                  {isRejected
                    ? 'Address each comment below, mark as solved when done, then upload a new file and resubmit. You can only proceed after DQC approves.'
                    : 'Address the remarks below, mark as solved, then upload a new file and resubmit.'}
                </p>
              </div>

                <h5 className="font-semibold text-gray-900 mb-2">Comments ({visibleRemarks.length})</h5>
              <p className="text-xs text-gray-500 mb-3">Mark each as solved when you have addressed it.</p>
              <div className="space-y-3">
                {review.remarks
                  .map((r, index) => ({ r, index }))
                  .filter(({ r }) => selectedFileId == null || r.uploadId == null || r.uploadId === selectedFileId)
                  .map(({ r, index }) => {
                  const hasPosition = r.page != null && r.xPct != null && r.yPct != null;
                  const isHighlighted = highlightedRemarkIndex === index && (r.page ?? 1) === pdfPageNumber;
                  return (
                  <div
                    key={index}
                    role={hasPosition ? 'button' : undefined}
                    tabIndex={hasPosition ? 0 : undefined}
                    onClick={hasPosition ? () => goToComment(index) : undefined}
                    onKeyDown={hasPosition ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToComment(index); } } : undefined}
                    className={`rounded-lg border p-3 text-sm border-l-4 ${
                      hasPosition ? 'cursor-pointer hover:ring-2 hover:ring-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400' : ''
                    } ${
                      isHighlighted ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''
                    } ${
                      r.resolved
                        ? 'border-l-green-500 bg-green-50/50'
                        : r.priority === 'high'
                          ? 'border-l-red-500 bg-red-50/30'
                          : r.priority === 'medium'
                            ? 'border-l-amber-500 bg-amber-50/30'
                            : 'border-l-gray-400 bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span
                        className={`text-xs font-semibold uppercase ${
                          r.priority === 'high' ? 'text-red-700' : r.priority === 'medium' ? 'text-amber-700' : 'text-gray-600'
                        }`}
                      >
                        {(r.pinNumber != null ? `#${r.pinNumber} ` : '')}
                        {r.priority === 'high' ? 'High' : r.priority === 'medium' ? 'Medium' : 'Low'}
                      </span>
                      {r.resolved ? (
                        <span className="text-xs font-medium text-green-700">✓ Solved</span>
                      ) : (
                        <button
                          type="button"
                          disabled={resolvingIndex === index}
                          onClick={(e) => { e.stopPropagation(); markSolved(index); }}
                          className="text-xs font-semibold text-green-700 hover:text-green-800 hover:underline disabled:opacity-60"
                        >
                          {resolvingIndex === index ? 'Saving…' : 'Mark as solved'}
                        </button>
                      )}
                    </div>
                    <p className="text-gray-700 mt-1">{r.text}</p>
                    {hasPosition && (
                      <p className="text-xs text-blue-600 mt-2">Click to view on PDF (page {r.page ?? 1})</p>
                    )}
                  </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onEditResubmit}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                  </svg>
                  Edit & Resubmit
                </button>
                <p className="text-xs text-gray-500 mt-2">Upload a new drawing and quotation. After resubmission, DQC will review again.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
