'use client';

import { useEffect } from 'react';
import type { LeadshipTypes } from './Types/Types';

type Props = {
    lead: LeadshipTypes;
    timeSlotLabel: string;
    onClose: () => void;
};

export function Pre10LeadViewModal({ lead, timeSlotLabel, onClose }: Props) {
    const projectLabel = `HUB-${lead.pid || lead.id}`;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pre10-view-modal-title"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
                    <div>
                        <h2 id="pre10-view-modal-title" className="text-lg font-semibold text-gray-900">
                            {projectLabel}
                        </h2>
                        <p className="mt-0.5 text-sm text-gray-600">{lead.projectName || '—'}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="px-6 py-5">
                    {/* Placeholder — content will be defined when requirements are provided */}
                    <p className="text-sm text-gray-500">
                        Lead details for Pre 10% will appear here. Share what fields to show and we will add them.
                    </p>
                    <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex gap-3">
                            <dt className="w-28 shrink-0 font-medium text-gray-500">Time slot</dt>
                            <dd className="text-gray-900">{timeSlotLabel}</dd>
                        </div>
                        {lead.contactNo ? (
                            <div className="flex gap-3">
                                <dt className="w-28 shrink-0 font-medium text-gray-500">Contact</dt>
                                <dd className="text-gray-900">{lead.contactNo}</dd>
                            </div>
                        ) : null}
                        {lead.clientEmail ? (
                            <div className="flex gap-3">
                                <dt className="w-28 shrink-0 font-medium text-gray-500">Email</dt>
                                <dd className="text-gray-900 break-all">{lead.clientEmail}</dd>
                            </div>
                        ) : null}
                    </dl>
                </div>

                <div className="flex justify-end border-t border-gray-100 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
