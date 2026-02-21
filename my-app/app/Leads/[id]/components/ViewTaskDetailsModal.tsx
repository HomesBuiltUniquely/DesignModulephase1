'use client';

import type { HistoryEvent, HistoryEventDetails } from '../types';

type Props = {
    event: HistoryEvent;
    onClose: () => void;
};

function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday, ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString() + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function DetailsContent({ details }: { details: HistoryEventDetails }) {
    switch (details.kind) {
        case 'd1_request':
            return (
                <ul className="space-y-2 text-gray-700">
                    <li><span className="font-medium text-gray-500">Date:</span> {details.date}</li>
                    <li><span className="font-medium text-gray-500">Time:</span> {details.time}</li>
                    {details.assignedExecutive && <li><span className="font-medium text-gray-500">Assigned executive:</span> {details.assignedExecutive}</li>}
                    <li className="pt-2 text-green-800 font-medium">Request submitted.</li>
                </ul>
            );
        case 'd2_masking':
            return (
                <ul className="space-y-2 text-gray-700">
                    <li><span className="font-medium text-gray-500">Date:</span> {details.date}</li>
                    <li><span className="font-medium text-gray-500">Time:</span> {details.time}</li>
                    <li><span className="font-medium text-gray-500">Masking executive:</span> {details.maskingExecutive}</li>
                    {details.assignedExecutive && <li><span className="font-medium text-gray-500">Assigned executive:</span> {details.assignedExecutive}</li>}
                    <li className="pt-2 text-green-800 font-medium">Masking request submitted.</li>
                </ul>
            );
        case 'dqc_review':
            return (
                <div className="space-y-4">
                    <p><span className="font-medium text-gray-500">Verdict:</span> <span className="capitalize font-medium">{details.verdict.replace('_', ' ')}</span></p>
                    {details.pdfName && <p><span className="font-medium text-gray-500">PDF:</span> {details.pdfName}</p>}
                    {details.remarks.length > 0 && (
                        <div>
                            <p className="font-medium text-gray-500 mb-2">QC remarks</p>
                            <ul className="list-disc pl-5 space-y-1 text-gray-700">
                                {details.remarks.map((r, i) => (
                                    <li key={i}><span className="capitalize text-gray-600">{r.priority}:</span> {r.text}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <p className="pt-2 text-green-800 font-medium">Review submitted.</p>
                </div>
            );
        case 'mom':
            return (
                <div className="space-y-4">
                    <div>
                        <p className="font-medium text-gray-500 mb-1">Minutes of meeting</p>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 whitespace-pre-wrap">{details.minutes || '—'}</div>
                    </div>
                    {details.referenceFiles.length > 0 && (
                        <div>
                            <p className="font-medium text-gray-500 mb-2">Reference files</p>
                            <ul className="space-y-1 text-gray-700">
                                {details.referenceFiles.map((f, i) => (
                                    <li key={i}>{f.name}{f.size ? ` (${f.size})` : ''}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <p className="pt-2 text-green-800 font-medium">MOM shared.</p>
                </div>
            );
        case 'file_upload':
            return (
                <ul className="space-y-2 text-gray-700">
                    <li><span className="font-medium text-gray-500">File:</span> {details.fileName}</li>
                    {details.size && <li><span className="font-medium text-gray-500">Size:</span> {details.size}</li>}
                    {details.status && <li><span className="font-medium text-gray-500">Status:</span> {details.status}</li>}
                </ul>
            );
        case 'note':
            return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-gray-700 italic">&ldquo;{details.noteText}&rdquo;</div>
            );
        default:
            return null;
    }
}

export default function ViewTaskDetailsModal({ event, onClose }: Props) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl xl:max-w-lg xl:w-full max-h-[85vh] flex flex-col overflow-hidden mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center pt-6 px-6 pb-2 flex-shrink-0 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900">Task Details</h3>
                    <button onClick={onClose} className="text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md p-2 font-medium text-sm">
                        Close
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {event.taskName && <p><span className="font-medium text-gray-500">Task:</span> {event.taskName}</p>}
                    {event.milestoneName && <p><span className="font-medium text-gray-500">Milestone:</span> {event.milestoneName}</p>}
                    <p><span className="font-medium text-gray-500">When:</span> {formatTimestamp(event.timestamp)}</p>
                    <p><span className="font-medium text-gray-500">By:</span> {event.user.name}</p>
                    <p className="text-gray-700">{event.description}</p>
                    {event.details && (
                        <div className="pt-4 border-t border-gray-200">
                            <h4 className="font-semibold text-gray-800 mb-3">Steps followed (form / popup inputs)</h4>
                            <DetailsContent details={event.details} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
