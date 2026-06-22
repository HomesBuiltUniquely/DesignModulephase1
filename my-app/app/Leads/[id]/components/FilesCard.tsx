'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { getApiBase } from '@/app/lib/apiBase';
import { d2UploadRoleLabel } from '@/app/lib/d2UploadLabels';
import type { D2UploadAsRole } from '@/app/lib/d2UploadLabels';
import D2UploadConfirmModal from './popups/D2UploadConfirmModal';
const API = getApiBase();

type Props = {
    cardClass: string;
    onToggleMaximize: () => void;
    isMaximized: boolean;
    leadId: number | null;
    sessionId: string | null;
    canUpload?: boolean;
    /** When mmt_manager or admin, show Approve button for pending uploads. */
    userRole?: string;
    userName?: string;
    /** When true (MMT), show Delete button so they can remove and re-upload. */
    canDelete?: boolean;
    /** Upload type tag sent to backend: 'd2_masking' for D2 SITE MASKING milestone, empty/undefined for D1. */
    uploadType?: string;
    /** Called after successful D2 upload (e.g. refresh task state). */
    onD2UploadComplete?: () => void;
};

type ZipEntry = { path: string; size: number };

type UploadRow = {
    id: number;
    originalName: string;
    uploadedAt: string;
    status?: string;
    uploadType?: string;
    uploaderName?: string | null;
    uploaderRole?: string | null;
};

/**
 * Files Uploaded card. Designers see only approved uploads. MMT Executive/Manager see all; Manager or Admin can approve.
 */
export default function FilesCard({ cardClass, onToggleMaximize, isMaximized, leadId, sessionId, canUpload, userRole, userName, canDelete, uploadType, onD2UploadComplete }: Props) {
    const [uploads, setUploads] = useState<UploadRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [approvingId, setApprovingId] = useState<number | null>(null);
    const [contentsCache, setContentsCache] = useState<Record<number, { loading: boolean; files?: ZipEntry[]; error?: string }>>({});
    const [filePreview, setFilePreview] = useState<{
        name: string;
        blobUrl: string | null;
        contentType: string;
        loading: boolean;
        error?: string;
    } | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const roleLower = (userRole || "").toLowerCase();
    const canApproveUploads = roleLower === "mmt_manager" || roleLower === "admin";

    const authHeaders = useMemo(() => {
        const headers: Record<string, string> = {};
        if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;
        return headers;
    }, [sessionId]);

    const loadUploads = async () => {
        if (!leadId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/uploads`, { headers: { ...authHeaders } });
            const text = await res.text();
            const data = (() => { try { return text ? JSON.parse(text) : null; } catch { return null; } })();
            if (!res.ok) throw new Error(data?.message || 'Failed to load uploads');
            setUploads(Array.isArray(data) ? data.map((u: UploadRow) => ({ ...u, status: u.status || "approved" })) : []);
        } catch (e: any) {
            setError(e?.message || 'Failed to load uploads');
        } finally {
            setLoading(false);
        }
    };

    const loadContents = async (uploadId: number) => {
        if (!leadId) return;
        setContentsCache((prev) => ({ ...prev, [uploadId]: { ...prev[uploadId], loading: true, error: undefined } }));
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/uploads/${uploadId}/contents`, { headers: { ...authHeaders } });
            const text = await res.text();
            const data = (() => { try { return text ? JSON.parse(text) : null; } catch { return null; } })();
            if (!res.ok) throw new Error(data?.message || 'Failed to load contents');
            const files = Array.isArray(data?.files) ? data.files : [];
            setContentsCache((prev) => ({ ...prev, [uploadId]: { loading: false, files } }));
        } catch (e: any) {
            setContentsCache((prev) => ({ ...prev, [uploadId]: { loading: false, error: e?.message || 'Failed to load contents' } }));
        }
    };

    const toggleContents = (uploadId: number) => {
        if (expandedId === uploadId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(uploadId);
        if (!contentsCache[uploadId]?.files && !contentsCache[uploadId]?.loading) loadContents(uploadId);
    };

    useEffect(() => { loadUploads(); }, [leadId]);

    const onPickZip = () => fileRef.current?.click();

    const isD2Upload = uploadType === 'd2_masking';

    const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (!selected.length || !leadId) return;
        if (isD2Upload) {
            const pdfs = selected.filter(
                (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
            );
            if (pdfs.length === 0) {
                setError('Select at least one PDF file.');
                return;
            }
            setError(null);
            setUploadSuccess(null);
            setPendingFiles(pdfs);
            return;
        }
        void uploadFiles(selected, null);
    };

    const uploadFiles = async (files: File[], uploadedAsRole: D2UploadAsRole | null) => {
        if (!leadId || files.length === 0) return;
        setUploading(true);
        setError(null);
        setUploadSuccess(null);
        try {
            const fd = new FormData();
            if (isD2Upload) {
                files.forEach((file) => fd.append('files', file));
                if (uploadedAsRole) fd.append('uploadedAsRole', uploadedAsRole);
            } else {
                fd.append('zip', files[0]);
            }
            if (uploadType) fd.append('uploadType', uploadType);
            const res = await fetch(`${API}/api/leads/${leadId}/uploads`, { method: 'POST', headers: { ...authHeaders }, body: fd });
            const text = await res.text();
            const data = (() => { try { return text ? JSON.parse(text) : null; } catch { return null; } })();
            if (!res.ok) throw new Error(data?.message || 'Upload failed');
            const message =
                (data?.message as string) ||
                (isD2Upload ? `${files.length} PDF(s) uploaded successfully.` : 'File uploaded successfully.');
            setUploadSuccess(message);
            if (isD2Upload) {
                window.alert(message);
                onD2UploadComplete?.();
            }
            await loadUploads();
        } catch (e: any) {
            setError(e?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const fileUrl = (uploadId: number, filePath: string) =>
        `${API}/api/leads/${leadId}/uploads/${uploadId}/file?path=${encodeURIComponent(filePath)}`;

    const openFileInApp = async (uploadId: number, filePath: string) => {
        if (!leadId) return;
        if (filePreview?.blobUrl) URL.revokeObjectURL(filePreview.blobUrl);
        const name = filePath.split("/").pop() || filePath;
        setFilePreview({ name, blobUrl: null, contentType: "", loading: true });
        try {
            const res = await fetch(fileUrl(uploadId, filePath), { headers: { ...authHeaders } });
            if (!res.ok) throw new Error("Failed to load file");
            const contentType = res.headers.get("Content-Type") || "";
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setFilePreview({ name, blobUrl: url, contentType, loading: false });
        } catch (e: any) {
            setFilePreview((prev) => prev ? { ...prev, loading: false, error: e?.message || "Failed to load" } : null);
        }
    };

    const closeFilePreview = () => {
        if (filePreview?.blobUrl) URL.revokeObjectURL(filePreview.blobUrl);
        setFilePreview(null);
    };

    const onApprove = async (uploadId: number) => {
        if (!leadId || !sessionId) return;
        setApprovingId(uploadId);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/uploads/${uploadId}/approve`, {
                method: "POST",
                headers: { ...authHeaders },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Approve failed");
            await loadUploads();
        } catch (e: any) {
            setError(e?.message || "Approve failed");
        } finally {
            setApprovingId(null);
        }
    };

    const onDelete = async (uploadId: number, name: string) => {
        if (!leadId) return;
        if (!confirm(`Delete "${name}"? You can upload the correct version after.`)) return;
        setDeletingId(uploadId);
        setError(null);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/uploads/${uploadId}`, {
                method: "DELETE",
                headers: { ...authHeaders },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Delete failed");
            if (expandedId === uploadId) setExpandedId(null);
            await loadUploads();
        } catch (e: any) {
            setError(e?.message || "Delete failed");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className={`${cardClass} flex flex-col min-h-0 min-w-0 overflow-hidden`}>
            <div className="flex flex-shrink-0 justify-between xl:justify-around px-4">
                <h2 className="text-lg font-bold text-gray-900">Files Uploaded</h2>
                <button
                    onClick={onToggleMaximize}
                    className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50 shadow-sm"
                    aria-label={isMaximized ? 'Minimize' : 'Maximize'}
                >
                    {isMaximized ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v-4.5m0 4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                    )}
                </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col px-4 pt-4 pb-2">
                {canUpload && (
                    <div className="flex flex-shrink-0 items-center justify-between gap-3 mb-4">
                        <div className="text-sm text-gray-700">
                            {isD2Upload ? (
                                <>Upload one or more <span className="font-semibold">PDF</span> files.</>
                            ) : (
                                <>Upload <span className="font-semibold">ZIP</span> or <span className="font-semibold">.dwg</span> (AutoCAD).</>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onPickZip}
                            disabled={!leadId || uploading}
                            className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-60"
                        >
                            {uploading ? 'Uploading…' : isD2Upload ? 'Upload PDFs' : 'Upload ZIP'}
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept={isD2Upload ? '.pdf,application/pdf' : '.zip,application/zip,.dwg'}
                            multiple={isD2Upload}
                            className="hidden"
                            onChange={onFilesSelected}
                        />
                    </div>
                )}

                {error && <div className="flex-shrink-0 text-sm text-red-600 mb-3">{error}</div>}
                {uploadSuccess && (
                    <div className="flex-shrink-0 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
                        {uploadSuccess}
                    </div>
                )}

                <div className="flex flex-shrink-0 items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-900">Uploaded files</div>
                    <button type="button" onClick={loadUploads} disabled={!leadId || loading} className="text-sm text-green-800 hover:underline disabled:opacity-60">
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>

                {uploads.length === 0 ? (
                    <div className="flex-shrink-0 text-sm text-gray-600">{loading ? 'Loading…' : 'No uploads yet.'}</div>
                ) : (
                    <div className="flex-1 min-h-0 min-w-0 overflow-auto overflow-x-auto space-y-2 pb-4 pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                        {uploads.map((u) => {
                            const isPdf = u.originalName.toLowerCase().endsWith('.pdf');
                            const isZip = u.originalName.toLowerCase().endsWith('.zip');
                            return (
                            <div key={u.id} className="bg-white/70 border border-gray-200 rounded-xl px-3 py-2 min-w-0">
                                <div className="flex items-center justify-between gap-3 min-w-0">
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-sm font-medium text-gray-900 truncate block min-w-0" title={u.originalName}>{u.originalName}</span>
                                            {u.status && (
                                                <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${u.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                                    {u.status === 'approved' ? 'Approved' : 'Pending'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-600">{new Date(u.uploadedAt).toLocaleString()}</div>
                                        {isD2Upload && u.uploaderName && (
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                Uploaded by {u.uploaderName}
                                                {u.uploaderRole ? ` (${d2UploadRoleLabel(u.uploaderRole)})` : ''}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                        {canApproveUploads && u.status === 'pending' && (
                                            <button
                                                type="button"
                                                onClick={() => onApprove(u.id)}
                                                disabled={approvingId === u.id}
                                                className="text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
                                            >
                                                {approvingId === u.id ? 'Approving…' : 'Approve'}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => toggleContents(u.id)}
                                            className="text-sm text-green-800 font-semibold hover:underline"
                                        >
                                            {expandedId === u.id ? 'Hide' : isPdf ? 'Preview' : 'View contents'}
                                        </button>
                                        <a
                                            className="text-sm text-green-800 font-semibold hover:underline"
                                            href={`${API}/api/leads/${leadId}/uploads/${u.id}/download`}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {isZip ? 'Download ZIP' : 'Download'}
                                        </a>
                                        {canDelete && (
                                            <button
                                                type="button"
                                                onClick={() => onDelete(u.id, u.originalName)}
                                                disabled={deletingId === u.id}
                                                className="text-sm text-red-600 font-semibold hover:underline disabled:opacity-60"
                                            >
                                                {deletingId === u.id ? 'Deleting…' : 'Delete'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {expandedId === u.id && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                        {contentsCache[u.id]?.loading && <div className="text-sm text-gray-500">Loading contents…</div>}
                                        {contentsCache[u.id]?.error && <div className="text-sm text-red-600">{contentsCache[u.id].error}</div>}
                                        {contentsCache[u.id]?.files && (
                                            <div className="space-y-1 max-h-48 overflow-auto">
                                                {contentsCache[u.id].files!.length === 0 ? (
                                                    <div className="text-sm text-gray-500">No files in ZIP.</div>
                                                ) : (
                                                    contentsCache[u.id].files!.map((f) => (
                                                        <div key={f.path} className="flex items-center justify-between gap-2 text-sm">
                                                            <span className="text-gray-700 truncate min-w-0">{f.path}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => openFileInApp(u.id, f.path)}
                                                                className="text-green-800 font-medium hover:underline shrink-0"
                                                            >
                                                                Open
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* In-app file preview modal */}
            {filePreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={closeFilePreview}>
                    <div
                        className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                            <span className="text-sm font-semibold text-gray-900 truncate">{filePreview.name}</span>
                            <button
                                type="button"
                                onClick={closeFilePreview}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                                aria-label="Close"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-auto p-4 bg-gray-50">
                            {filePreview.loading && (
                                <div className="flex items-center justify-center py-12 text-gray-500">Loading…</div>
                            )}
                            {filePreview.error && (
                                <div className="text-red-600 py-4">{filePreview.error}</div>
                            )}
                            {!filePreview.loading && !filePreview.error && filePreview.blobUrl && (
                                <>
                                    {filePreview.contentType.startsWith("image/") && (
                                        <img src={filePreview.blobUrl} alt={filePreview.name} className="max-w-full h-auto mx-auto" />
                                    )}
                                    {(filePreview.contentType === "application/pdf" || filePreview.contentType === "application/x-pdf") && (
                                        <iframe src={filePreview.blobUrl} title={filePreview.name} className="w-full h-[75vh] rounded-lg border border-gray-200" />
                                    )}
                                    {(filePreview.contentType.startsWith("text/") || filePreview.contentType === "application/json" || filePreview.contentType === "application/xml") && (
                                        <iframe src={filePreview.blobUrl} title={filePreview.name} className="w-full h-[75vh] rounded-lg border border-gray-200 bg-white" />
                                    )}
                                    {!filePreview.contentType.startsWith("image/") &&
                                        filePreview.contentType !== "application/pdf" &&
                                        filePreview.contentType !== "application/x-pdf" &&
                                        !filePreview.contentType.startsWith("text/") &&
                                        filePreview.contentType !== "application/json" &&
                                        filePreview.contentType !== "application/xml" && (
                                            <div className="py-6 text-center">
                                                {filePreview.name.toLowerCase().endsWith(".dwg") ? (
                                                    <p className="text-gray-600 mb-3">AutoCAD (.dwg) files cannot be previewed in the browser. Use Download to open in AutoCAD.</p>
                                                ) : (
                                                    <p className="text-gray-600 mb-3">Preview not available for this file type.</p>
                                                )}
                                                <a
                                                    href={filePreview.blobUrl}
                                                    download={filePreview.name}
                                                    className="text-green-700 font-semibold hover:underline"
                                                >
                                                    Download file
                                                </a>
                                            </div>
                                        )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <D2UploadConfirmModal
                open={pendingFiles.length > 0}
                files={pendingFiles}
                userName={userName}
                userRole={userRole}
                uploading={uploading}
                onCancel={() => setPendingFiles([])}
                onConfirm={async (uploadedAsRole) => {
                    const files = pendingFiles;
                    setPendingFiles([]);
                    await uploadFiles(files, uploadedAsRole);
                }}
            />
        </div>
    );
}
