"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/auth/AuthContext";
import { canUseEasebuzzOnline } from "@/app/lib/easebuzzAccess";
import MilestonePaymentSummary, { type QuotePaymentSummary } from "../MilestonePaymentSummary";
import { loadQuotePaymentSummary } from "../loadQuotePaymentSummary";
import { clearCachedQuotePaymentSummary } from "../quotePaymentSummaryCache";
import DesignPaymentMethodPanel from "./DesignPaymentMethodPanel";

type Props = {
  leadId: number;
  apiBase: string;
  sessionId: string | null;
  onSuccess: () => void;
  onOnlineSuccess?: () => void;
  onClose?: () => void;
};

/**
 * Design 10% collection: Online Easebuzz (email only) or Offline proof → Finance.
 */
export default function Popup10pPaymentCollection({
  leadId,
  apiBase,
  sessionId,
  onSuccess,
  onOnlineSuccess,
}: Props) {
  const { user } = useAuth();
  const allowOnline = canUseEasebuzzOnline(user?.role);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<QuotePaymentSummary | null>(null);
  const [paymentSummaryLoading, setPaymentSummaryLoading] = useState(true);
  const [paymentSummaryError, setPaymentSummaryError] = useState<string | null>(null);
  const [showOffline, setShowOffline] = useState(!allowOnline);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!allowOnline) setShowOffline(true);
  }, [allowOnline]);

  useEffect(() => {
    if (!Number.isFinite(leadId) || leadId < 1) {
      setPaymentSummary(null);
      setPaymentSummaryError("Invalid lead");
      setPaymentSummaryLoading(false);
      return;
    }
    const controller = new AbortController();
    // Always refetch when opening — partial payments must show remaining, not cached full target.
    clearCachedQuotePaymentSummary(leadId);
    setPaymentSummaryLoading(true);
    setPaymentSummaryError(null);
    (async () => {
      const result = await loadQuotePaymentSummary({
        leadId,
        apiBase,
        signal: controller.signal,
        retries: 3,
      });
      if (controller.signal.aborted) return;
      setPaymentSummary(result.summary);
      setPaymentSummaryError(result.message);
      setPaymentSummaryLoading(false);
    })();
    return () => controller.abort();
  }, [apiBase, leadId]);

  const accept = "image/*,.pdf,application/pdf";
  const openFileDialog = () => {
    inputRef.current?.setAttribute("accept", accept);
    inputRef.current?.click();
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    if (chosen.length) setFiles((prev) => [...prev, ...chosen]);
    e.target.value = "";
  };
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const collectionComplete =
    !!paymentSummary &&
    !paymentSummaryLoading &&
    (paymentSummary.amountToCollect10 <= 0 ||
      (paymentSummary.design10PercentPaid || 0) >= 100 ||
      ((paymentSummary.design10Target || 0) > 0 &&
        (paymentSummary.design10Collected || 0) + 0.009 >= (paymentSummary.design10Target || 0)));

  const onSubmit = async () => {
    if (!files.length || !sessionId) {
      setError("Please add at least one screenshot (image or PDF).");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const res = await fetch(`${apiBase}/api/leads/${leadId}/10p-payment-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionId}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Upload failed");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="px-6 pb-6">
        <MilestonePaymentSummary
          variant="10"
          summary={paymentSummary}
          loading={paymentSummaryLoading}
          error={paymentSummaryError}
        />

        {collectionComplete ? (
          <div className="mt-1 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-4">
            <p className="text-sm font-bold text-emerald-900">10% payment done</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800">
              Design 10% collection is complete
              {(paymentSummary?.design10Collected || 0) > 0
                ? ` (₹${Math.round(paymentSummary!.design10Collected || 0).toLocaleString("en-IN")} collected)`
                : ""}
              . Online and offline payment options are closed for this milestone.
            </p>
          </div>
        ) : (
          <>
        {allowOnline && (
          <DesignPaymentMethodPanel
            leadId={leadId}
            apiBase={apiBase}
            sessionId={sessionId}
            bucket="DESIGN_10"
            defaultAmount={paymentSummary?.amountToCollect10}
            onOfflineChosen={() => setShowOffline(true)}
            onOnlineSuccess={onOnlineSuccess || onSuccess}
          />
        )}

        {showOffline && (
          <div className="animate-fadeInUp">
            <p className="mb-3 text-sm leading-relaxed text-[#32261C]/75">
              {allowOnline
                ? "Upload payment screenshots for Finance review. Online Easebuzz auto-approves and emails the receipt."
                : "Upload payment screenshots for Finance review. Finance will approve after checking the proof."}
            </p>

            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              accept={accept}
              onChange={onFileChange}
            />
            <div
              className="group flex min-h-[180px] w-full max-w-[540px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DDCDC1] bg-gradient-to-b from-[#DDCDC1]/20 to-white p-8 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#00B0ED] hover:from-[#00B0ED]/10 hover:shadow-[0_8px_24px_rgba(0,176,237,0.12)]"
              onClick={openFileDialog}
              onDrop={onDrop}
              onDragOver={onDragOver}
            >
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#32261C] text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:bg-[#00B0ED]">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A1.5 1.5 0 0 0 4.5 20.25h15a1.5 1.5 0 0 0 1.5-1.5V16.5M7.5 9.75 12 5.25m0 0 4.5 4.5M12 5.25V16.5" />
                </svg>
              </span>
              <p className="text-base font-semibold text-[#32261C]">
                Click or drag payment screenshots
              </p>
              <p className="mt-1 text-sm text-gray-500">Images or PDF</p>
            </div>

            {files.length > 0 && (
              <div className="mt-3 max-w-[540px] space-y-2">
                <p className="text-sm font-semibold text-[#32261C]">
                  Selected files ({files.length})
                </p>
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-[#DDCDC1] bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:bg-[#DDCDC1]/20"
                  >
                    <span className="flex-1 truncate text-[#32261C]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-[#EF0101] transition-colors hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-[#EF0101]">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onSubmit}
                disabled={uploading || files.length === 0}
                className="rounded-xl bg-[#EF0101] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d10000] hover:shadow-lg disabled:pointer-events-none disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Submit to finance"}
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
