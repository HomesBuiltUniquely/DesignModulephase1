'use client';

import { useEffect, useState, useRef } from 'react';

import { getApiBase } from '@/app/lib/apiBase';
import { hostedQuoteHref } from '@/app/lib/prolanceLinks';

const API = getApiBase();

function dqcSubmitErrorMessage(status: number, message?: string, variant?: 'dqc1' | 'dqc2'): string {
  if (status === 401) {
    return 'Your session expired or you are not logged in. Log out, sign in again (as admin or designer), then retry.';
  }
  if (status === 403 && message?.includes('Not allowed to submit DQC')) {
    return 'Only designers, design managers, TDM, or admin can submit DQC files.';
  }
  const legacyPresign =
    message === 'At least one drawing and one quotation are required' ||
    message === 'At least one drawing and one quotation file are required';
  if (legacyPresign && variant === 'dqc2') {
    return 'The API still requires a quotation file on DQC 2 presign. Deploy the latest backend together with this UI (paired release), then retry.';
  }
  if (legacyPresign) {
    return 'The API still requires quotation files at presign. Deploy the latest backend together with this UI, then retry.';
  }
  return message || 'Upload failed';
}
const DRAWING_ACCEPT = '.skp,.dwg,.pdf,.zip,application/zip';

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

type DqcQuoteSource = 'customer_shared' | 'locked_dqc1' | 'locked_dqc2' | 'none' | null;

/**
 * DQC Submission popup: Final Design PDFs + customer-shared quotation link.
 * Live popup never uses Pre-10 CRM share; submit freezes the link per DQC round.
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
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);
  const [drawingDrag, setDrawingDrag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quotationLink, setQuotationLink] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [quoteVersionNumber, setQuoteVersionNumber] = useState<number | null>(null);
  const [quoteSource, setQuoteSource] = useState<DqcQuoteSource>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!leadId || !sessionId) {
      setQuotationLink(null);
      setQuoteId(null);
      setQuoteVersionNumber(null);
      setQuoteSource(null);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);
    const round = submissionVariant === 'dqc2' ? 'dqc2' : 'dqc1';
    fetch(`${API}/api/leads/${leadId}/dqc-quote-link?round=${round}&mode=live`, {
      headers: { Authorization: `Bearer ${sessionId}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { message?: string }).message || 'Failed to load quotation');
        return data as {
          quoteId?: number | null;
          customerQuoteUrl?: string | null;
          versionNumber?: number | null;
          source?: DqcQuoteSource;
          message?: string;
        };
      })
      .then((data) => {
        if (cancelled) return;
        const url = hostedQuoteHref(data.customerQuoteUrl || null) || null;
        const qid = data.quoteId != null ? Number(data.quoteId) : null;
        const version =
          data.versionNumber != null && Number.isFinite(Number(data.versionNumber)) && Number(data.versionNumber) > 0
            ? Number(data.versionNumber)
            : null;
        const source =
          data.source === 'customer_shared' ||
          data.source === 'locked_dqc1' ||
          data.source === 'locked_dqc2' ||
          data.source === 'none'
            ? data.source
            : null;
        setQuoteSource(source);
        setQuoteVersionNumber(version);
        if (url && qid && Number.isFinite(qid) && qid > 0 && source === 'customer_shared') {
          setQuotationLink(url);
          setQuoteId(qid);
          setQuoteError(null);
        } else {
          setQuotationLink(null);
          setQuoteId(null);
          setQuoteError(
            data.message ||
              'Share a quotation to the customer first — open the quote revision history and use Share this to customer.',
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuotationLink(null);
          setQuoteId(null);
          setQuoteVersionNumber(null);
          setQuoteSource(null);
          setQuoteError('Could not load the customer-shared quotation link.');
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, sessionId, submissionVariant]);

  const handleDrawingDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrawingDrag(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) setDrawingFiles((prev) => [...prev, ...files]);
  };

  const handleSubmit = async () => {
    if (!leadId || !sessionId || drawingFiles.length === 0) return;
    if (!quoteId || !quotationLink || quoteSource !== 'customer_shared') return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const endpoint = submissionVariant === 'dqc2' ? 'dqc2-submission' : 'dqc-submission';
      const authHeaders = { Authorization: `Bearer ${sessionId}` } as Record<string, string>;

      /** 1) Try S3 direct upload (small API calls — bypasses Nginx body limit in production). */
      const presignBody = {
        drawings: drawingFiles.map((f) => ({
          name: f.name,
          mime: f.type || 'application/octet-stream',
        })),
        quotations: [] as { name: string; mime: string }[],
      };

      const presignRes = await fetch(`${API}/api/leads/${leadId}/${endpoint}/presign`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(presignBody),
      });

      if (presignRes.ok) {
        const presign = (await presignRes.json()) as {
          drawings: Array<{ uploadUrl: string; key: string; contentType: string }>;
          quotations: Array<{ uploadUrl: string; key: string; contentType: string }>;
        };
        if (presign.drawings.length !== drawingFiles.length) {
          setSubmitError('Upload preparation mismatch. Please try again.');
          return;
        }
        const drawingResults = await Promise.all(
          presign.drawings.map((u, idx) =>
            fetch(u.uploadUrl, {
              method: 'PUT',
              body: drawingFiles[idx],
              headers: { 'Content-Type': u.contentType },
            }),
          ),
        );
        if (drawingResults.some((r) => !r.ok)) {
          setSubmitError('Upload to storage failed. Check S3 bucket CORS or try again.');
          return;
        }
        const completePayload = {
          drawingKeys: presign.drawings.map((u) => u.key),
          quotationKeys: [] as string[],
          drawingNames: drawingFiles.map((f) => f.name),
          quotationNames: [] as string[],
          quoteId,
          quotationLink,
        };
        const done = await fetch(`${API}/api/leads/${leadId}/${endpoint}/complete`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(completePayload),
        });
        const doneData = await done.json().catch(() => ({}));
        if (!done.ok) {
          setSubmitError(
            dqcSubmitErrorMessage(
              done.status,
              (doneData as { message?: string }).message ||
                (submissionVariant === 'dqc2' ? 'Failed to finalize DQC 2 submission' : 'Failed to finalize DQC submission'),
              submissionVariant,
            ),
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
          dqcSubmitErrorMessage(
            presignRes.status,
            (errBody as { message?: string }).message ||
              (submissionVariant === 'dqc2' ? 'Failed to upload DQC 2 files' : 'Failed to upload DQC files'),
            submissionVariant,
          ),
        );
        return;
      }

      const form = new FormData();
      drawingFiles.forEach((f) => form.append('drawing', f));
      if (quoteId != null) form.append('quoteId', String(quoteId));
      if (quotationLink) form.append('quotationLink', quotationLink);
      const res = await fetch(`${API}/api/leads/${leadId}/${endpoint}`, {
        method: 'POST',
        headers: authHeaders,
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(
          dqcSubmitErrorMessage(
            res.status,
            data.message || (submissionVariant === 'dqc2' ? 'Failed to upload DQC 2 files' : 'Failed to upload DQC files'),
            submissionVariant,
          ),
        );
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

  const hasCustomerQuote = quoteId != null && Boolean(quotationLink) && quoteSource === 'customer_shared';
  const canSubmit = drawingFiles.length > 0 && hasCustomerQuote;

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
        Submit finalized design files with the customer-shared quotation. DQC will review the drawings against that quote and resolve (approve or request changes).
      </p>

      <div className="px-6 space-y-6 pb-4">
        {/* Final Sketchup Drawing */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-sm uppercase text-gray-800">Final Design PDFs</span>
            <span className="text-xs text-gray-500">(.skp, .dwg, .pdf, .zip)</span>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrawingDrag(true); }}
            onDragLeave={() => setDrawingDrag(false)}
            onDrop={handleDrawingDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${drawingDrag ? 'border-[#00B0ED] bg-[#00B0ED]/10/50' : 'border-gray-300 bg-gray-50/50 hover:border-gray-400'}`}
          >
            <div className="flex flex-col items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-[#00B0ED]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <p className="font-semibold text-gray-700">Drag and drop drawing files here</p>
              <p className="text-sm text-gray-500">Upload final drawing files for DQC verification</p>
              {drawingFiles.length > 0 && (
                <p className="text-sm text-[#32261C] font-medium text-left w-full">
                  {drawingFiles.map((f) => f.name).join(', ')}
                </p>
              )}
              <input
                ref={drawingInputRef}
                type="file"
                multiple
                accept={DRAWING_ACCEPT}
                className="hidden"
                onChange={(e) => setDrawingFiles(Array.from(e.target.files || []))}
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
            <span className="text-xs text-gray-500">Customer-shared quote</span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
            {quoteLoading ? (
              <p className="text-sm text-gray-500">Loading quotation link…</p>
            ) : hasCustomerQuote ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#32261C]">Customer-shared quotation</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[
                      quoteVersionNumber != null ? `Version ${quoteVersionNumber}` : null,
                      quoteId != null ? `Quote #${quoteId}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <a
                  href={hostedQuoteHref(quotationLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#00B0ED] px-4 py-2 text-sm font-medium text-white hover:bg-[#00B0ED]/90"
                >
                  Open quotation
                </a>
              </div>
            ) : (
              <p className="text-sm text-amber-800">
                {quoteError ||
                  'Share a quotation to the customer first — open the quote revision history and use Share this to customer.'}
              </p>
            )}
          </div>
        </div>

        {submitError && (
          <p className="text-sm text-red-600 px-2">{submitError}</p>
        )}
        {/* DQC Review Process info */}
        <div className="flex gap-3 p-4 rounded-lg bg-[#00B0ED]/10 border border-[#00B0ED]/20">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#00B0ED] shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <div>
            <p className="font-semibold text-[#00B0ED] text-sm">Files and quotation go to DQC</p>
            <p className="text-sm text-[#00B0ED] mt-0.5">
              Drawing files are uploaded and the customer-shared quotation is locked for this DQC round. Later quote updates will not change a previous round&apos;s link.
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
          className="px-4 py-2.5 rounded-lg bg-[#00B0ED] text-white font-medium text-sm hover:bg-[#00B0ED]/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting…' : 'Submit the DQC'}
        </button>
      </div>
    </>
  );
}
