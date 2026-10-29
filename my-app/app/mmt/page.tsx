'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

type LeadRow = {
    id: number;
    projectName?: string;
    project_name?: string;
    pid?: string;
};

export default function MmtUploadsPage() {
    const { user, sessionId } = useAuth();
    const [leads, setLeads] = useState<LeadRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadingLeadId, setUploadingLeadId] = useState<number | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [targetLeadId, setTargetLeadId] = useState<number | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const authHeaders = useMemo(() => {
        const headers: Record<string, string> = {};
        if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;
        return headers;
    }, [sessionId]);

    const role = (user?.role || '').toLowerCase();

    const loadLeads = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/leads/queue`, { headers: { ...authHeaders } });
            const text = await res.text();
            const data = (() => {
                try { return JSON.parse(text); } catch { return null; }
            })();
            if (!res.ok) throw new Error(data?.message || 'Failed to load leads');
            const list = Array.isArray(data) ? data : [];
            setLeads([...list].sort((a, b) => Number(b.id) - Number(a.id)));
        } catch (e: any) {
            setError(e?.message || 'Failed to load leads');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeads();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    const filteredLeads = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return leads;
        return leads.filter((l) => {
            const name = (l.projectName || l.project_name || '').toLowerCase();
            const pid = (l.pid || '').toLowerCase();
            const id = String(l.id);
            return name.includes(q) || pid.includes(q) || id.includes(q);
        });
    }, [leads, searchQuery]);

    const onUploadClick = (leadId: number) => {
        setTargetLeadId(leadId);
        fileRef.current?.click();
    };

    const onZipSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        e.target.value = '';
        if (!file || !targetLeadId) return;
        setUploadingLeadId(targetLeadId);
        setError(null);
        try {
            const fd = new FormData();
            fd.append('zip', file);
            fd.append('uploadType', 'd1');
            const res = await fetch(`${getApiBase()}/api/leads/${targetLeadId}/uploads`, {
                method: 'POST',
                headers: { ...authHeaders },
                body: fd,
            });
            const text = await res.text();
            const data = (() => {
                try { return JSON.parse(text); } catch { return null; }
            })();
            if (!res.ok) throw new Error(data?.message || 'File not uploaded. Please try again.');
            setToast('File uploaded successfully!');
            setTimeout(() => setToast(null), 3000);
        } catch (e: any) {
            const msg = e?.message || 'File not uploaded. Please try again.';
            setError(msg);
            setToast(msg);
            setTimeout(() => setToast(null), 3000);
        } finally {
            setUploadingLeadId(null);
            setTargetLeadId(null);
        }
    };

    const isMmt = ['mmt', 'mmt_manager', 'mmt_executive', 'operation_manager'].includes(role || '');
    if (role && !isMmt) {
        return (
            <div className="min-h-screen bg-slate-900 p-6">
                <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6">
                    <h1 className="text-xl font-bold text-gray-900">MMT Uploads</h1>
                    <p className="text-sm text-gray-600 mt-2">You don’t have access to this page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 p-6">
            <div className="max-w-5xl mx-auto bg-white rounded-2xl p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            {role === 'operation_manager' ? 'D1 Site Measurement Uploads' : 'MMT Uploads'}
                        </h1>
                        <p className="text-sm text-gray-600 mt-1">Upload a ZIP folder for each lead. It will appear in the lead “Files Uploaded” card and History.</p>
                    </div>
                    <button
                        type="button"
                        onClick={loadLeads}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                    >
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>

                {error && <div className="text-sm text-red-600 mt-4">{error}</div>}

                <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                    <div className="relative w-full sm:w-72">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.8}
                                stroke="currentColor"
                                className="w-4 h-4 text-gray-400"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z"
                                />
                            </svg>
                        </span>
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, ID, PID..."
                            aria-label="Search D1 leads"
                            className="pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-[#00B0ED]/30 focus:border-[#00B0ED]"
                        />
                    </div>
                </div>

                <div className="mt-3 border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
                        <div className="col-span-2">Lead ID</div>
                        <div className="col-span-8">Lead name</div>
                        <div className="col-span-2 text-right">Upload</div>
                    </div>
                    {filteredLeads.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-gray-600">
                            {loading
                                ? 'Loading…'
                                : searchQuery.trim()
                                  ? 'No leads match your search.'
                                  : 'No leads found.'}
                        </div>
                    ) : (
                        filteredLeads.map((l) => {
                            const name = l.projectName || l.project_name || 'Unnamed';
                            const busy = uploadingLeadId === l.id;
                            return (
                                <div key={l.id} className="grid grid-cols-12 px-4 py-3 border-t border-gray-200 items-center">
                                    <div className="col-span-2 text-sm font-semibold text-gray-900">{l.id}</div>
                                    <div className="col-span-8 text-sm text-gray-800">
                                        {name}
                                        {l.pid ? (
                                            <span className="ml-2 text-xs text-gray-400">{l.pid}</span>
                                        ) : null}
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <button
                                            type="button"
                                            onClick={() => onUploadClick(l.id)}
                                            disabled={!sessionId || busy}
                                            className="px-3 py-2 rounded-lg bg-[#EF0101] text-white text-sm font-semibold hover:bg-[#EF0101]/90 disabled:opacity-60"
                                        >
                                            {busy ? 'Uploading…' : 'Upload ZIP'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                {searchQuery.trim() && filteredLeads.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                        Showing {filteredLeads.length} of {leads.length} leads
                    </p>
                )}

                <input
                    ref={fileRef}
                    type="file"
                    accept=".zip,application/zip,.dwg"
                    className="hidden"
                    onChange={onZipSelected}
                />
            </div>

            {toast && (
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white text-base font-medium px-8 py-4 rounded-lg shadow-2xl z-[9999] text-center max-w-md">
                    {toast}
                </div>
            )}
        </div>
    );
}

