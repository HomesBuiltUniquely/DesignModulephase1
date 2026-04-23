'use client';

import { useEffect, useState } from 'react';

type PmRow = { id: number; name: string; email: string };

type Props = {
    leadId: number;
    apiBase: string;
    sessionId: string | null;
    currentPmId?: number | null;
    currentPmName?: string | null;
    onClose: () => void;
    onAssigned: () => void;
};

export default function PopupAssignProjectManager({
    leadId,
    apiBase,
    sessionId,
    currentPmId,
    currentPmName,
    onClose,
    onAssigned,
}: Props) {
    const [list, setList] = useState<PmRow[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionId) {
            setLoading(false);
            setError('You must be signed in.');
            return;
        }
        let cancelled = false;
        fetch(`${apiBase}/api/auth/project-managers`, {
            headers: { Authorization: `Bearer ${sessionId}` },
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.message || 'Failed to load project managers');
                return data as PmRow[];
            })
            .then((rows) => {
                if (!cancelled) setList(Array.isArray(rows) ? rows : []);
            })
            .catch((e) => {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [apiBase, sessionId]);

    useEffect(() => {
        if (currentPmId) setSelectedId(String(currentPmId));
    }, [currentPmId]);

    const onSave = async () => {
        const pmId = Number(selectedId);
        if (!sessionId || !Number.isFinite(pmId) || pmId < 1) {
            setError('Select a project manager.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`${apiBase}/api/leads/${leadId}/assign-project-manager`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${sessionId}`,
                },
                body: JSON.stringify({ projectManagerId: pmId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || 'Save failed');
            onAssigned();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="px-6 pb-6">
            <p className="text-sm text-gray-600 mb-4">
                After DQC 2 approval, a Senior Project Manager, Territorial Design Manager, Deputy General Manager, or Admin
                assigns the project manager who will review files and approve before the workflow continues to 40% payment.
            </p>
            {currentPmName && (
                <p className="text-sm text-gray-700 mb-2">
                    Currently assigned: <span className="font-medium">{currentPmName}</span>
                </p>
            )}
            {loading && <p className="text-sm text-gray-500">Loading project managers…</p>}
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            {!loading && list.length === 0 && !error && (
                <p className="text-sm text-amber-700">No project managers found. Create one from the admin hub first.</p>
            )}
            {list.length > 0 && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project manager
                    <select
                        className="mt-1 block w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                    >
                        <option value="">— Select —</option>
                        {list.map((pm) => (
                            <option key={pm.id} value={String(pm.id)}>
                                {pm.name} ({pm.email})
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving || !sessionId || !selectedId}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save assignment'}
                </button>
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50">
                    Cancel
                </button>
            </div>
        </div>
    );
}
