'use client';

import type { PopupContext } from '../types';

type Props = {
    context: PopupContext;
    onClose: () => void;
    children: React.ReactNode;
};

/**
 * Modal wrapper for task popups. Handles backdrop, size (normal vs DQC 1 approval), and optional header.
 */
export default function TaskModal({ context, onClose, children }: Props) {
    const isDqc1Approval = context.taskName === 'DQC 1 approval' || context.taskName === 'Design sign off';
    const modalTitle =
        context.milestoneIndex === 1 && context.taskName === 'meeting completed'
            ? 'Meeting Scheduled'
            : context.milestoneIndex === 1
                ? 'First Cut Design Discussion'
                : context.milestoneName;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className={`bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ${isDqc1Approval ? 'xl:max-w-[95vw] xl:w-full xl:max-h-[90vh]' : 'xl:max-h-[85vh] xl:w-[40vw]'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {!isDqc1Approval && (
                    <div className="flex justify-between items-center pt-6 px-6 pb-2 flex-shrink-0">
                        <h3 className="text-lg font-bold text-gray-900">{modalTitle}</h3>
                        <button onClick={onClose} className="text-gray-700 bg-gray-100 hover:text-gray-700 text-2xl leading-none border border-gray-300 rounded-md p-2 font-bold text-sm">
                            Close
                        </button>
                    </div>
                )}
                <div className={`flex-1 overflow-y-auto min-h-0 ${isDqc1Approval ? 'flex flex-col' : ''}`}>
                    {children}
                </div>
            </div>
        </div>
    );
}
