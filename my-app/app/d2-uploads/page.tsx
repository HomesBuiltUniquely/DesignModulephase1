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

/**
 * D2 uploads: same as MMT uploads – list leads that have a D2 masking request (queue?type=d2),
 * upload ZIP for each. Assigned MMT executives see only their D2 leads; MMT manager sees all D2 leads.
 */
export default function D2UploadsPage() {
    const { user, sessionId } = useAuth();
    const [leads, setLeads] = useState<LeadRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadingLeadId, setUploadingLeadId] = useState<number | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [targetLeadId, setTargetLeadId] = useState<number | null>(null);

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
            const res = await fetch(`${getApiBase()}/api/leads/queue?type=d2`, { headers: { ...authHeaders } });
            const text = await res.text();
            const data = (() => {
                try { return JSON.parse(text); } catch { return null; }
            })();
            if (!res.ok) throw new Error(data?.message || 'Failed to load leads');
            setLeads(Array.isArray(data) ? data : []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load leads');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeads();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

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
            fd.append('uploadType', 'd2_masking');
            const res = await fetch(`${getApiBase()}/api/leads/${targetLeadId}/uploads`, {
                method: 'POST',
                headers: { ...authHeaders },
                body: fd,
            });
            const text = await res.text();
            const data = (() => {
                try { return JSON.parse(text); } catch { return null; }
            })();
            if (!res.ok) throw new Error(data?.message || 'Upload failed');
            loadLeads();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Upload failed');
        } finally {
            setUploadingLeadId(null);
            setTargetLeadId(null);
        }
    };

    const isMmt = ['mmt', 'mmt_manager', 'mmt_executive'].includes(role || '');
    if (role && !isMmt) {
        return (
            <div className="min-h-screen bg-slate-900 p-6">
                <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6">
                    <h1 className="text-xl font-bold text-gray-900">D2 Uploads</h1>
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
                        <h1 className="text-xl font-bold text-gray-900">D2 Uploads</h1>
                        <p className="text-sm text-gray-600 mt-1">Upload a ZIP folder for each lead with a D2 masking request. It will appear in the lead “Files Uploaded” card and History.</p>
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

                <div className="mt-5 border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
                        <div className="col-span-2">Lead ID</div>
                        <div className="col-span-8">Lead name</div>
                        <div className="col-span-2 text-right">Upload</div>
                    </div>
                    {leads.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-gray-600">{loading ? 'Loading…' : 'No D2 masking leads found. Raise a D2 masking request from a lead to see it here.'}</div>
                    ) : (
                        leads.map((l) => {
                            const name = l.projectName || l.project_name || 'Unnamed';
                            const busy = uploadingLeadId === l.id;
                            return (
                                <div key={l.id} className="grid grid-cols-12 px-4 py-3 border-t border-gray-200 items-center">
                                    <div className="col-span-2 text-sm font-semibold text-gray-900">{l.id}</div>
                                    <div className="col-span-8 text-sm text-gray-800">{name}</div>
                                    <div className="col-span-2 text-right">
                                        <button
                                            type="button"
                                            onClick={() => onUploadClick(l.id)}
                                            disabled={!sessionId || busy}
                                            className="px-3 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-60"
                                        >
                                            {busy ? 'Uploading…' : 'Upload ZIP'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <input
                    ref={fileRef}
                    type="file"
                    accept=".zip,application/zip,.dwg"
                    className="hidden"
                    onChange={onZipSelected}
                />
            </div>
        </div>
    );
}
