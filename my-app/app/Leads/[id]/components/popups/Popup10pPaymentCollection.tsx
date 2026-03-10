"use client";

import { useRef, useState } from "react";

type Props = {
  leadId: number;
  apiBase: string;
  sessionId: string | null;
  onSuccess: () => void;
  onClose?: () => void;
};

/**
 * 10% payment collection: upload payment screenshots for finance team to review and approve.
 */
export default function Popup10pPaymentCollection({
  leadId,
  apiBase,
  sessionId,
  onSuccess,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        <p className="text-sm text-gray-600 mb-4">
          Upload payment screenshots (images or PDF). These will be sent to the finance team for cross-check and approval. After approval, the lead will move to the next stage.
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
          className="w-full max-w-[540px] border-2 border-dashed border-gray-300 rounded-xl bg-white p-8 flex flex-col items-center justify-center min-h-[180px] cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
          onClick={openFileDialog}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <div className="w-14 h-14 rounded-full border-2 border-blue-200 bg-blue-50 flex items-center justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-7 h-7 text-blue-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-800 mb-1">
            Click or drag payment screenshots to upload
          </p>
          <p className="text-sm text-gray-500">Images or PDF</p>
        </div>

        {files.length > 0 && (
          <div className="mt-3 space-y-2 max-w-[540px]">
            <p className="text-sm font-medium text-gray-700">
              Selected files ({files.length})
            </p>
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between text-sm bg-gray-100 rounded-lg px-3 py-2"
              >
                <span className="text-gray-700 truncate flex-1">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-red-600 hover:underline ml-2 flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onSubmit}
            disabled={uploading || files.length === 0}
            className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading…" : "Submit to finance"}
          </button>
        </div>
      </div>
    </div>
  );
}
