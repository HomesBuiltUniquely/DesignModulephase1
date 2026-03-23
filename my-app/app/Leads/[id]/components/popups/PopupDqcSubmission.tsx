'use client';

import { useState, useRef } from 'react';

import { getApiBase } from '@/app/lib/apiBase';
const API = getApiBase();
const DRAWING_ACCEPT = '.skp,.dwg,.pdf,.zip,application/zip';
const QUOTATION_ACCEPT = '.pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type Props = {
  leadId: number | null;
  sessionId: string | null;
  /** DQC 1 (dwg + quotation) or DQC 2 – same process, different endpoint and storage */
  submissionVariant?: 'dqc1' | 'dqc2';
  /**
   * Optional metadata used to fire the internal
   * "DQC 1 review request" email once a DQC1
   * submission has been successfully uploaded.
   */
  dqc1EmailMeta?: {
    customerName: string;
    ecName: string;
    designerName: string;
    projectValue: string | number;
    /** Designer email (for CC). */
    designerEmail?: string;
    /**
     * Optional CC list (designer, DM, TDM etc.)
     */
    cc?: string[];
  };
  onClose: () => void;
  onSaveDraft?: () => void;
  onSubmit: () => void;
  onUploadSuccess?: () => void;
};

/**
 * DQC Submission popup: Final Sketchup Drawing + Final Quotation uploads. Same for DQC 1 and DQC 2.
 */
export default function PopupDqcSubmission({
  leadId,
  sessionId,
  submissionVariant = 'dqc1',
  dqc1EmailMeta,
  onClose,
  onSaveDraft,
  onSubmit,
  onUploadSuccess,
}: Props) {
  const [drawingFile, setDrawingFile] = useState<File | null>(null);
  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [drawingDrag, setDrawingDrag] = useState(false);
  const [quotationDrag, setQuotationDrag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);
  const quotationInputRef = useRef<HTMLInputElement>(null);

  const handleDrawingDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrawingDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setDrawingFile(f);
  };

  const handleQuotationDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setQuotationDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setQuotationFile(f);
  };

  const handleSubmit = async () => {
    if (!drawingFile || !quotationFile || !leadId || !sessionId) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const endpoint = submissionVariant === 'dqc2' ? 'dqc2-submission' : 'dqc-submission';
      const authHeaders = { Authorization: `Bearer ${sessionId}` } as Record<string, string>;

      /** 1) Try S3 direct upload (small API calls — bypasses Nginx body limit in production). */
      const presignRes = await fetch(`${API}/api/leads/${leadId}/${endpoint}/presign`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drawingName: drawingFile.name,
          drawingMime: drawingFile.type || 'application/octet-stream',
          quotationName: quotationFile.name,
          quotationMime: quotationFile.type || 'application/octet-stream',
        }),
      });

      if (presignRes.ok) {
        const presign = (await presignRes.json()) as {
          drawing: { uploadUrl: string; key: string; contentType: string };
          quotation: { uploadUrl: string; key: string; contentType: string };
        };
        const putD = await fetch(presign.drawing.uploadUrl, {
          method: 'PUT',
          body: drawingFile,
          headers: { 'Content-Type': presign.drawing.contentType },
        });
        const putQ = await fetch(presign.quotation.uploadUrl, {
          method: 'PUT',
          body: quotationFile,
          headers: { 'Content-Type': presign.quotation.contentType },
        });
        if (!putD.ok || !putQ.ok) {
          setSubmitError('Upload to storage failed. Check S3 bucket CORS or try again.');
          return;
        }
        const done = await fetch(`${API}/api/leads/${leadId}/${endpoint}/complete`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drawingKey: presign.drawing.key,
            quotationKey: presign.quotation.key,
            drawingName: drawingFile.name,
            quotationName: quotationFile.name,
          }),
        });
        const doneData = await done.json().catch(() => ({}));
        if (!done.ok) {
          setSubmitError(
            (doneData as { message?: string }).message ||
              (submissionVariant === 'dqc2' ? 'Failed to finalize DQC 2 submission' : 'Failed to finalize DQC submission'),
          );
          return;
        }
        onUploadSuccess?.();
        onSubmit();
        return;
      }

      /** 2) No direct upload (local dev without AWS): fall back to multipart through API. */
      if (presignRes.status !== 501) {
        const errBody = await presignRes.json().catch(() => ({}));
        setSubmitError(
          (errBody as { message?: string }).message ||
            (submissionVariant === 'dqc2' ? 'Failed to upload DQC 2 files' : 'Failed to upload DQC files'),
        );
        return;
      }

      const form = new FormData();
      form.append('drawing', drawingFile);
      form.append('quotation', quotationFile);
      const res = await fetch(`${API}/api/leads/${leadId}/${endpoint}`, {
        method: 'POST',
        headers: authHeaders,
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.message || (submissionVariant === 'dqc2' ? 'Failed to upload DQC 2 files' : 'Failed to upload DQC files'));
        return;
      }
      onUploadSuccess?.();
      onSubmit();
    } catch {
      setSubmitError('Could not reach server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = Boolean(drawingFile && quotationFile);

  return (
    <>
      <div className="flex justify-between items-center pt-6 px-6 pb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-gray-900">{submissionVariant === 'dqc2' ? 'DQC 2 Submission' : 'DQC Submission'}</h3>
          <span className="px-2.5 py-0.5 rounded bg-gray-200 text-white text-xs font-medium">{submissionVariant === 'dqc2' ? 'V2' : 'V1'}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-100"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-sm text-gray-600 px-6 pb-4">
        Submit finalized design + quotation for quality verification. Files you upload here are sent to DQC—they will review and resolve (approve or request changes). Ensure all files meet the project standards before uploading.
      </p>

      <div className="px-6 space-y-6 pb-4">
        {/* Final Sketchup Drawing */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-sm uppercase text-gray-800">Final Sketchup Drawing</span>
            <span className="text-xs text-gray-500">(.skp, .dwg, .pdf, .zip)</span>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrawingDrag(true); }}
            onDragLeave={() => setDrawingDrag(false)}
            onDrop={handleDrawingDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${drawingDrag ? 'border-blue-400 bg-blue-50/50' : 'border-gray-300 bg-gray-50/50 hover:border-gray-400'}`}
          >
            <div className="flex flex-col items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-sky-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <p className="font-semibold text-gray-700">Drag and drop drawing files here</p>
              <p className="text-sm text-gray-500">Upload final drawing file for DQC verification</p>
              {drawingFile && <p className="text-sm text-green-700 font-medium">{drawingFile.name}</p>}
              <input
                ref={drawingInputRef}
                type="file"
                accept={DRAWING_ACCEPT}
                className="hidden"
                onChange={(e) => setDrawingFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => drawingInputRef.current?.click()}
                className="mt-2 px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
              >
                Browse Files
              </button>
            </div>
          </div>
        </div>

        {/* Final Quotation */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-sm uppercase text-gray-800">Final Quotation</span>
            <span className="text-xs text-gray-500">(.pdf, .xlsx)</span>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setQuotationDrag(true); }}
            onDragLeave={() => setQuotationDrag(false)}
            onDrop={handleQuotationDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${quotationDrag ? 'border-blue-400 bg-blue-50/50' : 'border-gray-300 bg-gray-50/50 hover:border-gray-400'}`}
          >
            <div className="flex flex-col items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-sky-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <p className="font-semibold text-gray-700">Drag and drop quotation files here</p>
              <p className="text-sm text-gray-500">Upload final quotation aligned with design</p>
              {quotationFile && <p className="text-sm text-green-700 font-medium">{quotationFile.name}</p>}
              <input
                ref={quotationInputRef}
                type="file"
                accept={QUOTATION_ACCEPT}
                className="hidden"
                onChange={(e) => setQuotationFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => quotationInputRef.current?.click()}
                className="mt-2 px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
              >
                Browse Files
              </button>
            </div>
          </div>
        </div>

        {submitError && (
          <p className="text-sm text-red-600 px-2">{submitError}</p>
        )}
        {/* DQC Review Process info */}
        <div className="flex gap-3 p-4 rounded-lg bg-sky-50 border border-sky-100">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-sky-600 shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <div>
            <p className="font-semibold text-sky-800 text-sm">Files go to DQC</p>
            <p className="text-sm text-sky-700 mt-0.5">
              Uploaded files are sent to DQC. They will review and resolve (approve or request changes). You can see their feedback and re-upload if needed. The project will not move to the next phase until DQC approves.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 px-6 py-4 bg-gray-100 rounded-b-2xl border-t border-gray-200">
        <button
          type="button"
          onClick={onSaveDraft ?? onClose}
          className="px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-300"
        >
          Save as Draft
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting…' : 'Submit the DQC'}
        </button>
      </div>
    </>
  );
}
