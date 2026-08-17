'use client';

import { useState, useRef } from 'react';
import { getApiBase } from '@/app/lib/apiBase';
const API = getApiBase();

type Props = {
  leadId?: number | null;
  sessionId?: string | null;
  onMarkComplete: () => void;
  onClose: () => void;
};

/**
 * KT TRANSFER – Milestone 7 (visual 0), Task "Upload KT files"
 *
 * Knowledge Transfer (KT) is completed by the outgoing designer before handing
 * a project over to a new designer. This popup confirms that KT is done so the
 * incoming designer can continue the project without gaps.
 */
export default function PopupKtTransfer({ leadId, sessionId, onMarkComplete, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  
  const fileRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleMark = async () => {
    if (!leadId || submitting || done) return;
    setSubmitting(true);
    try {
      onMarkComplete();
      setDone(true);
      showToast('Task marked as done successfully');
      setTimeout(() => onClose(), 3000); // give them time to see the toast before closing
    } finally {
      setSubmitting(false);
    }
  };

  const onPickFiles = () => fileRef.current?.click();

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!selected.length || !leadId || !sessionId) return;
    
    setUploading(true);
    try {
      const fd = new FormData();
      // Use multiple files. The backend allows 'files' array up to 50 for D2, we can reuse it for KT.
      selected.forEach((file) => fd.append('files', file));
      fd.append('uploadType', 'kt_transfer');

      const res = await fetch(`${API}/api/leads/${leadId}/uploads`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionId}` },
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Upload failed');
      
      showToast('File uploaded successfully');
    } catch (e: any) {
      alert(e?.message || 'File not uploaded. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-6 pb-6 space-y-5 relative">
      {toast && (
        <div className="fixed inset-0 flex items-center justify-center z-[99999] pointer-events-none">
          <div className="bg-gray-900/95 text-white text-base font-semibold px-8 py-4 rounded-2xl shadow-2xl border border-gray-700 text-center max-w-sm backdrop-blur-sm pointer-events-auto transition-all duration-300 transform scale-100 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6 text-[#32261C]/70 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span>{toast}</span>
          </div>
        </div>
      )}

      {/* Purpose banner */}
      <div className="rounded-xl bg-[#DDCDC1]/20 border border-[#DDCDC1] px-4 py-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#DDCDC1]/40 text-[#32261C]">
            {/* Handshake-style icon */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
            </svg>
          </span>
          <h3 className="text-base font-semibold text-[#32261C]">Knowledge Transfer (KT)</h3>
        </div>
        <p className="text-sm text-[#32261C] leading-relaxed">
          This milestone is for other designers. If this project is assigned to another designer, they can see the KT of the project.
        </p>
      </div>

      <div className="flex flex-col items-start gap-2 pt-2">
        <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={onFilesSelected}
        />
        <button
          type="button"
          onClick={onPickFiles}
          disabled={uploading || done || !leadId}
          className="px-4 py-2 rounded-lg bg-[#00B0ED] text-white text-sm font-medium hover:bg-[#00B0ED]/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {uploading ? 'Uploading...' : 'Upload KT Files'}
        </button>
        <div className="text-xs text-gray-500">Files will be saved directly to the Uploaded Files section without needing approval.</div>
      </div>

      {/* Success flash */}
      {done && (
        <div className="rounded-lg bg-[#DDCDC1]/20 border border-[#DDCDC1] px-4 py-3 text-sm text-[#32261C] font-medium text-center">
          ✅ KT marked as done. Great handover!
        </div>
      )}

      {/* Actions */}
      <div className="flex pt-2">
        <button
          type="button"
          onClick={handleMark}
          disabled={submitting || done || !leadId}
          className="px-4 py-2 bg-[#EF0101] text-white text-sm font-medium rounded-lg hover:bg-[#EF0101] disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {done ? 'Done ✓' : submitting ? 'Marking…' : 'Mark KT as Done'}
        </button>
      </div>
    </div>
  );
}
