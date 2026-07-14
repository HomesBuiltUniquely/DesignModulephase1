'use client';

import { useEffect } from 'react';
import type { LeadshipTypes } from './Types/Types';
import { formatHubPid } from '@/app/lib/formatHubPid';

type Props = {
    lead: LeadshipTypes;
    timeSlotLabel: string;
    onClose: () => void;
};

function displayValue(value: string | null | undefined): string {
    const v = value?.trim();
    return v || '—';
}

export function Pre10LeadViewModal({ lead, timeSlotLabel, onClose }: Props) {
    const projectLabel = formatHubPid(lead.pid, lead.id);
    const customerName =
        lead.intakeCustomerName?.trim() ||
        lead.projectName?.trim() ||
        null;

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
                    <dl className="space-y-4 text-sm">
                        <div>
                            <dt className="font-medium text-gray-500">Customer name</dt>
                            <dd className="mt-1 text-gray-900">{displayValue(customerName)}</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-gray-500">Configuration</dt>
                            <dd className="mt-1 text-gray-900">{displayValue(lead.intakeConfiguration)}</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-gray-500">Notes</dt>
                            <dd className="mt-1 whitespace-pre-wrap text-gray-900">{displayValue(lead.intakeNotes)}</dd>
                        </div>
                        {timeSlotLabel !== '—' ? (
                            <div>
                                <dt className="font-medium text-gray-500">Time slot</dt>
                                <dd className="mt-1 text-gray-900">{timeSlotLabel}</dd>
                            </div>
                        ) : null}
                        {lead.designerName?.trim() ? (
                            <div>
                                <dt className="font-medium text-gray-500">Designer</dt>
                                <dd className="mt-1 text-gray-900">{lead.designerName}</dd>
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
