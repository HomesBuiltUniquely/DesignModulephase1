'use client';

import { useEffect, useState } from 'react';
import type { LeadshipTypes } from '@/app/Components/Types/Types';
import { getApiBase } from '@/app/lib/apiBase';

const API = getApiBase();

type Props = {
    leadId: number | null;
    project: LeadshipTypes | null;
    sessionId: string | null;
    /** Designers may view but not edit */
    readOnly: boolean;
    onUpdate: (patch: Pick<LeadshipTypes, 'clientEmail' | 'alternateClientEmail'>) => void;
};

function shortEmail(value: string | undefined | null, emptyLabel: string): string {
    const t = (value ?? '').trim();
    return t || emptyLabel;
}

/**
 * Compact client email row; edits open in a small modal (non-designers only).
 */
export default function ClientEmailsSection({ leadId, project, sessionId, readOnly, onUpdate }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [primary, setPrimary] = useState('');
    const [alternate, setAlternate] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [savedHint, setSavedHint] = useState(false);

    const syncDraftFromProject = () => {
        if (!project) return;
        setPrimary((project.clientEmail ?? '').trim());
        setAlternate((project.alternateClientEmail ?? '').trim());
    };

    useEffect(() => {
        if (modalOpen) return;
        syncDraftFromProject();
    }, [modalOpen, project?.id, project?.clientEmail, project?.alternateClientEmail]);

    if (!leadId || !project) return null;

    const openModal = () => {
        setMessage(null);
        syncDraftFromProject();
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setMessage(null);
        syncDraftFromProject();
    };

    const save = async () => {
        if (!sessionId || readOnly) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/client-emails`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${sessionId}`,
                },
                body: JSON.stringify({
                    clientEmail: primary.trim() || null,
                    alternateClientEmail: alternate.trim() || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || 'Save failed');
            onUpdate({
                clientEmail: data.clientEmail ?? null,
                alternateClientEmail: data.alternateClientEmail ?? null,
            });
            setPrimary((data.clientEmail ?? '').trim());
            setAlternate((data.alternateClientEmail ?? '').trim());
            setModalOpen(false);
            setSavedHint(true);
            setTimeout(() => setSavedHint(false), 2200);
        } catch (e) {
            setMessage((e as Error).message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const canEdit = !readOnly && !!sessionId;
    const primaryShown = shortEmail(project.clientEmail, '—');
    const altShown = shortEmail(project.alternateClientEmail, '');

    return (
        <>
            <div className="mx-4 xl:mx-6 mb-2 flex flex-col gap-1 rounded-lg border border-slate-600/80 bg-slate-800/40 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs sm:text-sm">
                        <span className="text-slate-500 font-medium shrink-0">Client email</span>
                        <span className="text-slate-100 truncate max-w-[min(100vw-12rem,14rem)] sm:max-w-[18rem]" title={(project.clientEmail ?? '').trim() || undefined}>
                            {primaryShown}
                        </span>
                        {altShown ? (
                            <>
                                <span className="text-slate-600 hidden sm:inline">·</span>
                                <span className="text-slate-400 truncate max-w-[min(100vw-14rem,12rem)] sm:max-w-[14rem]" title={altShown}>
                                    Alt: {altShown}
                                </span>
                            </>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {savedHint && (
                            <span className="text-xs font-medium text-emerald-400" aria-live="polite">
                                Saved
                            </span>
                        )}
                        {canEdit && (
                            <button
                                type="button"
                                onClick={openModal}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-500 bg-slate-700/80 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-600 hover:border-slate-400 transition-colors"
                            >
                                Edit
                            </button>
                        )}
                    </div>
                </div>
                {readOnly && (
                    <p className="text-[11px] text-slate-500">View only — managers and staff can edit.</p>
                )}
            </div>

            {modalOpen && (
                <div
                    className="fixed inset-0 z-[96] flex items-center justify-center p-4 bg-black/55"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="client-email-modal-title"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeModal();
                    }}
                >
                    <div
                        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                            <h2 id="client-email-modal-title" className="text-base font-semibold text-slate-900">
                                Edit client emails
                            </h2>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                aria-label="Close"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="px-4 py-4 space-y-4">
                            <p className="text-xs text-slate-500">
                                Primary is used for customer mail; alternate is used if primary is missing.
                            </p>
                            <label className="block text-left">
                                <span className="text-xs font-medium text-slate-600">Primary (actual)</span>
                                <input
                                    type="email"
                                    value={primary}
                                    onChange={(e) => setPrimary(e.target.value)}
                                    placeholder="client@example.com"
                                    autoComplete="email"
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                />
                            </label>
                            <label className="block text-left">
                                <span className="text-xs font-medium text-slate-600">Alternate</span>
                                <input
                                    type="email"
                                    value={alternate}
                                    onChange={(e) => setAlternate(e.target.value)}
                                    placeholder="Optional"
                                    autoComplete="email"
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                />
                            </label>
                            {message && <p className="text-sm font-medium text-red-600">{message}</p>}
                        </div>
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={saving}
                                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={save}
                                disabled={saving}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Apply'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
