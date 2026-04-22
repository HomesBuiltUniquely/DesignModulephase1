'use client';

import { useRef, useState } from 'react';

type Props = {
    leadId: number;
    apiBase: string;
    sessionId: string | null;
    onSuccess: () => void;
    onClose: () => void;
};

/**
 * 40% collection: only payment screenshots for finance (no MOM / meeting form).
 */
export default function Popup40pCollection({ leadId, apiBase, sessionId, onSuccess, onClose }: Props) {
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const accept = 'image/*,.pdf,application/pdf';
    const openFileDialog = () => {
        inputRef.current?.setAttribute('accept', accept);
        inputRef.current?.click();
    };
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const chosen = Array.from(e.target.files ?? []);
        if (chosen.length) setFiles((prev) => [...prev, ...chosen]);
        e.target.value = '';
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
        if (!sessionId) {
            setError('You must be signed in to upload.');
            return;
        }
        if (!files.length) {
            setError('Please add at least one screenshot (image or PDF).');
            return;
        }
        setError(null);
        setUploading(true);
        try {
            const fd = new FormData();
            files.forEach((f) => fd.append('files', f));
            const res = await fetch(`${apiBase}/api/leads/${leadId}/40p-payment-upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${sessionId}` },
                body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data as { message?: string })?.message || 'Upload failed');
            onSuccess();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="px-6 pb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-1">40% payment screenshots (for finance)</h3>
            <p className="text-xs text-gray-500 mb-4">
                Upload payment screenshots. These will be sent to the finance team to review and approve; the milestone
                will advance automatically after approval.
            </p>

            <input ref={inputRef} type="file" className="hidden" multiple accept={accept} onChange={onFileChange} />
            <div
                onClick={openFileDialog}
                onDrop={onDrop}
                onDragOver={onDragOver}
                className="w-full max-w-[540px] border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 p-8 flex flex-col items-center justify-center min-h-[180px] cursor-pointer hover:border-green-300 hover:bg-gray-100 transition-colors"
            >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-6 h-6 text-green-600"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                        />
                    </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">Drag & drop or click to add payment screenshots</p>
                <p className="text-xs text-gray-500 mt-0.5">Images or PDF</p>
            </div>

            {files.length > 0 && (
                <div className="mt-3 space-y-2 max-w-[540px]">
                    {files.map((file, index) => (
                        <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between text-sm bg-gray-100 rounded-lg px-3 py-2"
                        >
                            <span className="text-gray-700 truncate flex-1">{file.name}</span>
                            <button type="button" onClick={() => removeFile(index)} className="text-red-600 hover:underline ml-2 flex-shrink-0">
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={uploading || files.length === 0}
                    className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {uploading ? 'Uploading…' : 'Submit to finance'}
                </button>
            </div>
        </div>
    );
}
