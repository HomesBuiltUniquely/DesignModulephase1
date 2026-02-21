'use client';

import type { RefObject } from 'react';
import MileStonesArray from '@/app/Components/Types/MileStoneArray';

type TaskStatus = { icon: 'completed' | 'current' | 'delayed' | 'pending'; subtitle: string; tags: readonly string[] };

type Props = {
    cardClass: string;
    isMaximized: boolean;
    currentMilestoneIndex: number;
    onToggleMaximize: () => void;
    onScrollLeft: () => void;
    onScrollRight: () => void;
    scrollRef: RefObject<HTMLDivElement | null>;
    onOpenTask: (milestoneIndex: number, taskName: string) => void;
    getTaskStatus: (taskIndex: number, total: number) => TaskStatus;
};

/**
 * Project Tracker card: milestone list, task rows, maximize/footer when expanded.
 */
export default function MilestonesCard({
    cardClass,
    isMaximized,
    currentMilestoneIndex,
    onToggleMaximize,
    onScrollLeft,
    onScrollRight,
    scrollRef,
    onOpenTask,
    getTaskStatus,
}: Props) {
    const milestones = isMaximized ? MileStonesArray.MilestonesName : MileStonesArray.MilestonesName.filter((_, i) => i === currentMilestoneIndex);

    return (
        <div className={`${cardClass} ${isMaximized ? 'flex flex-col' : ''}`}>
            {isMaximized ? (
                <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-green-950">Project Tracker</h2>
                        <p className="text-sm text-gray-500 mt-0.5">Swipe milestones →</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center border border-gray-300 rounded-lg pl-3 pr-3 py-2 bg-white min-w-[200px]">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                            <input type="text" placeholder="Search tasks..." className="ml-2 border-0 outline-none flex-1 min-w-0 text-sm" />
                        </div>
                        <button type="button" className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50" aria-label="Filter">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-gray-600"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 0 1-3 0M3.75 6h7.5M3.75 6A1.5 1.5 0 0 1 3 4.5m0 0A1.5 1.5 0 0 1 4.5 3h15A1.5 1.5 0 0 1 21 4.5m0 0v15a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-15" /></svg>
                        </button>
                        <button type="button" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                            <span className="text-lg leading-none">+</span> New Milestone
                        </button>
                        <button onClick={onToggleMaximize} className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50 shadow-sm" aria-label="Close fullscreen">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-green-950">Project Tracker</h2>
                    <button onClick={onToggleMaximize} className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50 shadow-sm" aria-label="Fullscreen">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v-4.5m0 4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                    </button>
                </div>
            )}

            {isMaximized && (
                <>
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden xl:flex">
                        <button type="button" onClick={onScrollLeft} className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                        </button>
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden xl:flex">
                        <button type="button" onClick={onScrollRight} className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                        </button>
                    </div>
                </>
            )}

            <div className={`flex-1 min-h-0 flex flex-col ${isMaximized ? 'overflow-hidden pt-17' : ''}`}>
                <div className={isMaximized ? 'flex justify-center w-full overflow-hidden flex-1 min-h-0' : ''}>
                    <div
                        ref={scrollRef}
                        className={`flex gap-10 overflow-y-hidden pb-2 min-h-0 ${isMaximized ? 'overflow-x-auto scroll-smooth snap-x snap-mandatory max-w-[95vw] mx-auto' : 'overflow-x-hidden justify-center'}`}
                        style={{ scrollbarWidth: 'thin' }}
                    >
                        {milestones.map((milestone, idx) => {
                            const milestoneIndex = isMaximized ? idx : currentMilestoneIndex;
                            const isCurrent = milestoneIndex === currentMilestoneIndex;
                            const isNextOrLater = milestoneIndex > currentMilestoneIndex;
                            const taskList = milestone.taskList;
                            const progressPercent = taskList.length ? Math.min(100, Math.round(((milestoneIndex === 0 ? 1 : milestoneIndex === 1 ? 2 : 0) / taskList.length) * 100)) : 0;
                            const dateRanges = ['Dec 01 - Dec 15', 'Dec 16 - Dec 30', 'Jan 01 - Jan 15', 'Jan 16 - Jan 30', 'Feb 01 - Feb 15', 'Feb 16 - Feb 28', 'Mar 01 - Mar 15'];
                            const dateRange = dateRanges[milestoneIndex] ?? 'TBD';
                            return (
                                <div key={milestone.id} className={`flex-shrink-0 w-[380px] xl:w-[550px] ${isMaximized ? 'snap-start' : ''}`}>
                                    <div className="mb-4 flex justify-between">
                                        <span className={`text-xs font-bold uppercase tracking-wide ${isCurrent ? 'text-green-900' : isNextOrLater ? 'text-gray-400' : 'text-gray-500'}`}>Milestone {String(milestoneIndex + 1).padStart(2, '0')}</span>
                                        <span className={`text-xs ml-2 ${isNextOrLater ? 'text-green-400' : 'text-green-600'}`}>{dateRange}</span>
                                    </div>
                                    <div className={`rounded-2xl shadow-sm border p-4 min-h-[52vh] flex flex-col transition-all ${isCurrent ? 'bg-white border-green-900 ring-2 ring-green-200' : isNextOrLater ? 'bg-gray-100 border-gray-200 opacity-75' : 'bg-white border-gray-200'}`}>
                                        <h3 className={`text-lg font-bold mb-3 ${isNextOrLater ? 'text-gray-500' : 'text-gray-900'}`}>{milestone.name}</h3>
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
                                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                                        </div>
                                        <div className="space-y-2 flex-1">
                                            {taskList.map((task: string, taskIndex: number) => {
                                                const status = isNextOrLater
                                                    ? { icon: 'pending' as const, subtitle: 'Not started', tags: ['PENDING'] as const }
                                                    : getTaskStatus(taskIndex, taskList.length);
                                                return (
                                                    <div
                                                        key={taskIndex}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => onOpenTask(milestoneIndex, task)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenTask(milestoneIndex, task); } }}
                                                        className={`w-full text-left p-3 transition-colors flex items-start gap-3 cursor-pointer ${isNextOrLater ? 'hover:bg-gray-200/50 opacity-90' : 'hover:bg-gray-50'} ${status.icon === 'current' ? 'border-l-4 border-blue-500 pl-2' : ''}`}
                                                    >
                                                        <span className="flex-shrink-0 mt-0.5">
                                                            {status.icon === 'completed' && (
                                                                <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="white" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg></span>
                                                            )}
                                                            {status.icon === 'current' && (
                                                                <span className="w-6 h-6 rounded-full border-2 border-blue-500 flex items-center justify-center mt-1"><span className="w-2 h-2 rounded-full bg-blue-600" /></span>
                                                            )}
                                                            {status.icon === 'delayed' && (
                                                                <span className="w-6 h-6 flex items-center justify-center text-amber-500"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.401 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" /></svg></span>
                                                            )}
                                                            {status.icon === 'pending' && (
                                                                <span className="w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center" />
                                                            )}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium truncate ${isNextOrLater ? 'text-gray-500' : 'text-gray-900'}`}>{task}</p>
                                                            <p className="text-xs text-gray-500 mt-0.5">{status.subtitle}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                            {status.tags.map((tag) => (
                                                                <span
                                                                    key={tag}
                                                                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-md ${
                                                                        tag === 'ON-TIME' ? 'bg-green-200 text-green-900 font-bold' :
                                                                        tag === 'CURRENT' || tag === 'ACTION' ? 'bg-blue-200 text-blue-700' :
                                                                        tag === 'DELAYED' ? 'bg-amber-200 text-amber-700' :
                                                                        'bg-gray-100 border border-gray-300 text-gray-500'
                                                                    }`}
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                            <span role="button" tabIndex={0} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }} className="p-1 rounded hover:bg-gray-200 text-gray-400 cursor-pointer inline-flex" aria-label="More">
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" /></svg>
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {isMaximized && (
                <div className="flex-shrink-0 flex flex-wrap items-center gap-6 py-3 px-2 border-t border-gray-200 mt-2 text-sm">
                    <span className="text-gray-600">GLOBAL PROGRESS: <strong className="text-gray-900">24% Complete</strong></span>
                    <span className="text-gray-600">TEAM VELOCITY: <strong className="text-green-600">+12% vs Baseline</strong></span>
                    <span className="text-gray-600 flex items-center gap-2">
                        ACTIVE MEMBERS
                        <span className="flex -space-x-1">
                            {[1, 2, 3].map((i) => (
                                <span key={i} className="w-7 h-7 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">{i === 3 ? '5' : ''}</span>
                            ))}
                        </span>
                    </span>
                    <span className="text-gray-500 ml-auto flex items-center gap-1">
                        Last synchronized: 2 mins ago
                        <button type="button" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                            Sync Now
                        </button>
                    </span>
                </div>
            )}
        </div>
    );
}
