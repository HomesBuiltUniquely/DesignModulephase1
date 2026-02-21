'use client';

import type { HistoryEvent, HistoryEventType } from '../types';

type Props = {
    cardClass: string;
    onToggleMaximize: () => void;
    isMaximized: boolean;
    historyEvents: HistoryEvent[];
    onViewTaskDetails: (event: HistoryEvent) => void;
    currentMilestoneIndex: number;
    totalMilestones: number;
};

function formatRelativeTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday, ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function eventTypeBadge(type: HistoryEventType): { label: string; className: string } {
    switch (type) {
        case 'completed': return { label: 'COMPLETED', className: 'bg-green-100 text-green-800' };
        case 'delayed': return { label: 'DELAYED', className: 'bg-red-100 text-red-800' };
        case 'note': return { label: 'NOTE ADDED', className: 'bg-blue-100 text-blue-800' };
        case 'owner_change': return { label: 'OWNER CHANGED', className: 'bg-gray-200 text-gray-800' };
        case 'file_upload': return { label: 'FILE UPLOADED', className: 'bg-purple-100 text-purple-800' };
        default: return { label: (type as string).toUpperCase(), className: 'bg-gray-100 text-gray-700' };
    }
}

function EventIcon({ type }: { type: HistoryEventType }) {
    const base = 'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0';
    switch (type) {
        case 'completed':
            return <div className={`${base} bg-green-100 text-green-700`}>✓</div>;
        case 'delayed':
            return <div className={`${base} bg-red-100 text-red-700`}>⚠</div>;
        case 'note':
            return <div className={`${base} bg-blue-100 text-blue-700`}>💬</div>;
        case 'owner_change':
            return <div className={`${base} bg-gray-200 text-gray-700`}>👥</div>;
        case 'file_upload':
            return <div className={`${base} bg-purple-100 text-purple-700`}>📄</div>;
        default:
            return <div className={`${base} bg-gray-100 text-gray-600`}>•</div>;
    }
}

export default function HistoryCard({
    cardClass,
    onToggleMaximize,
    isMaximized,
    historyEvents,
    onViewTaskDetails,
    currentMilestoneIndex,
    totalMilestones,
}: Props) {
    const progressPct = totalMilestones > 0 ? Math.round((currentMilestoneIndex / (totalMilestones - 1)) * 100) : 0;
    const pendingTasks = 12; // placeholder
    const overdueItems = 3;   // placeholder

    return (
        <div className={cardClass}>
            <div className="flex justify-between xl:justify-arround px-4">
                <h2 className="text-lg font-bold text-gray-900">History</h2>
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

            {!isMaximized ? (
                <div className="xl:mt-4 text-left m-4  ">
                    <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
                        {historyEvents.slice(0, 5).map((ev) => {
                            const badge = eventTypeBadge(ev.type);
                            return (
                                <div key={ev.id} className="flex gap-2 items-start p-2 rounded-2xl bg-white/80 border border-gray-100">
                                    <EventIcon type={ev.type} />
                                    <div className="flex-1 min-w-0">
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}>
                                            {badge.label}
                                        </span>
                                        <p className="text-gray-700 text-xs mt-1 line-clamp-2">{ev.description}</p>
                                        <p className="text-gray-400 text-[10px] mt-0.5">{formatRelativeTime(ev.timestamp)} · {ev.user.name}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="xl:mt-4 text-left overflow-y-auto flex flex-col h-[calc(100%-3rem)]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Progress History</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Detailed activity log and audit trail for project milestones.</p>
                        </div>
                        <button type="button" className="self-start sm:self-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                            <span>Filter History</span>
                            <span aria-hidden>▾</span>
                        </button>
                    </div>

                    <div className="flex-1 space-y-4 pr-2">
                        {historyEvents.map((ev) => {
                            const badge = eventTypeBadge(ev.type);
                            const showViewDetails = (ev.type === 'completed' || ev.type === 'file_upload' || ev.type === 'note') && ev.details;
                            return (
                                <div key={ev.id} className="flex gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                                    <EventIcon type={ev.type} />
                                    <div className="flex-1 min-w-0">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                                            {badge.label} {formatRelativeTime(ev.timestamp)}
                                        </span>
                                        <p className="mt-2 text-gray-700 text-sm">{ev.description}</p>
                                        {ev.type === 'note' && ev.details && ev.details.kind === 'note' && (
                                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-gray-700 italic">
                                                &ldquo;{(ev.details as { noteText: string }).noteText}&rdquo;
                                            </div>
                                        )}
                                        {ev.type === 'file_upload' && ev.details && ev.details.kind === 'file_upload' && (
                                            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                                                <span>📄</span>
                                                <span>{(ev.details as { fileName: string; size?: string; status?: string }).fileName}</span>
                                                {(ev.details as { size?: string }).size && <span>{(ev.details as { size: string }).size}</span>}
                                                {(ev.details as { status?: string }).status && <span className="text-green-600">{(ev.details as { status: string }).status}</span>}
                                            </div>
                                        )}
                                        {showViewDetails && (
                                            <button
                                                type="button"
                                                onClick={() => onViewTaskDetails(ev)}
                                                className="mt-2 text-blue-600 hover:underline text-sm font-medium"
                                            >
                                                View Task Details →
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0 flex flex-col items-end">
                                        {ev.user.avatar ? (
                                            <img src={ev.user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" title={ev.user.name} />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs" title={ev.user.name}>
                                                ⇄
                                            </div>
                                        )}
                                        <span className="text-xs text-gray-500 mt-1 max-w-[80px] truncate">{ev.user.name}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 p-4 bg-green-800 text-white rounded-xl flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
                        <div>
                            <p className="font-semibold">Current Milestone Status</p>
                            <p className="text-2xl font-bold mt-1">{progressPct}% OVERALL PROGRESS</p>
                            <p className="text-sm opacity-90 mt-1">You have {pendingTasks} pending tasks and {overdueItems} overdue items.</p>
                        </div>
                        <button type="button" className="px-4 py-2 bg-white text-green-800 font-medium rounded-lg hover:bg-green-50">
                            Generate Report
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
