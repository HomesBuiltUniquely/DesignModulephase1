'use client';

import { useRef, useState } from 'react';
import { getApiBase } from '@/app/lib/apiBase';

type Props = {
  onClose: () => void;
  leadId?: number | null;
  sessionId?: string | null;
  /** Operation manager uploads D1 measurement files directly; the task completes on upload. */
  canUpload?: boolean;
  onUploaded?: () => void;
};

/**
 * Designer view for "D1 files upload" — no Mark as done.
 * Task completes automatically when MMT manager/admin approves (or uploads) D1 files.
 * Operation managers upload the ZIP here; that upload is approved immediately.
 */
export default function PopupD1FilesWaiting({
  onClose,
  leadId,
  sessionId,
  canUpload = false,
  onUploaded,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file || !leadId) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('zip', file);
      fd.append('uploadType', 'd1');
      const headers: Record<string, string> = {};
      if (sessionId) headers.Authorization = `Bearer ${sessionId}`;
      const res = await fetch(`${getApiBase()}/api/leads/${leadId}/uploads`, {
        method: 'POST',
        headers,
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'File not uploaded. Please try again.');
      setDone('D1 site measurement file uploaded. This task is complete.');
      onUploaded?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'File not uploaded. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-6 pb-6">
      {canUpload ? (
        <>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            Upload the D1 site measurement file for this project. ZIP or DWG is accepted, and the
            upload is approved immediately — you do not mark this task done yourself.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            The same upload is available from <strong>D1 Uploads</strong> in the sidebar.
          </p>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {error}
            </p>
          )}
          {done && (
            <p className="text-sm text-[#32261C] bg-[#DDCDC1]/20 border border-[#DDCDC1] rounded-lg px-3 py-2 mb-3">
              {done}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!leadId || uploading}
              className="px-4 py-2 bg-[#EF0101] text-white text-sm font-medium rounded-lg hover:bg-[#EF0101]/90 disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : 'Upload ZIP'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,application/zip,.dwg"
              className="hidden"
              onChange={onFile}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            This task completes automatically — you do not need to mark it done.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Once the <strong>MMT executive</strong> uploads the measurement files and the{' '}
            <strong>MMT manager</strong> (or admin) approves them, the files appear under{' '}
            <strong>Files Uploaded</strong> on this lead, and this task moves to the next milestone.
          </p>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-5">
            If an MMT manager, admin, or operation manager uploads D1 files directly, approval is not
            required — the task completes and files show in Files Uploaded right away.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </>
      )}
    </div>
  );
}
