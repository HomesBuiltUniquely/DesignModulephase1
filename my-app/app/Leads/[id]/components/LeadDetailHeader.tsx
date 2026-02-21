'use client';

import type { LeadshipTypes } from '@/app/Components/Types/Types';
import type { ImageType } from '../types';
import MileStonesArray from '@/app/Components/Types/MileStoneArray';

type Props = {
    project: LeadshipTypes;
    image: ImageType[];
    onAddImage: () => void;
    /** Current milestone index (0-based). Used to show which stage this lead is in. */
    currentMilestoneIndex: number;
};

const TOTAL_STAGES = MileStonesArray.MilestonesName.length;

/**
 * Lead/Project detail page header: PID, name, stage progress bar, tabs, team avatars, HOLD/RESUME.
 * Rendered only when no card is maximized.
 */
export default function LeadDetailHeader({ project, image, onAddImage, currentMilestoneIndex }: Props) {
    return (
        <div className="w-full px-4 xl:px-6 pt-4 pb-4">
            {/* Top row: project info (left) | Prolance + avatars + HOLD/RESUME (right) – aligned in one row */}
            <div className="flex flex-wrap items-center justify-between gap-4 xl:gap-6">
                <div className="flex flex-wrap items-baseline gap-6 xl:gap-8">
                    <p className="font-bold text-purple-100">
                        <span className="text-gray-400">PID:</span> {project.id}
                    </p>
                    <p className="font-bold text-purple-100">
                        <span className="text-gray-400">Status:</span> {project.projectStage}
                    </p>
                    <p className="font-bold text-purple-100">
                        <span className="text-gray-400">Project Name:</span> {project.projectName}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 xl:gap-6">
                    <div className="border border-gray-400 rounded-md px-4 py-2 font-bold text-purple-100 hover:text-green-900 hover:bg-purple-50 transition-colors cursor-pointer">
                        Prolance
                    </div>
                    <div className="flex items-center -space-x-3">
                        {image.map((imgdata) => (
                            <img
                                key={imgdata.id}
                                src={imgdata.img}
                                alt="profile"
                                className="w-10 h-10 xl:w-12 xl:h-12 rounded-full border-2 border-slate-800 object-cover hover:z-10 relative"
                            />
                        ))}
                        <button
                            type="button"
                            onClick={onAddImage}
                            className="w-10 h-10 xl:w-12 xl:h-12 rounded-full border-2 border-gray-400 flex items-center justify-center bg-slate-800 text-purple-100 hover:bg-purple-900/50 text-xl font-bold ml-4 z-10"
                        >
                            +
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" className="px-4 py-2 border border-gray-400 rounded-md font-bold text-purple-100 hover:text-green-900 hover:bg-purple-50 transition-colors cursor-pointer">
                            HOLD
                        </button>
                        <button type="button" className="px-4 py-2 border border-gray-400 rounded-md font-bold text-purple-100 hover:text-green-900 hover:bg-purple-50 transition-colors cursor-pointer">
                            RESUME
                        </button>
                    </div>
                </div>
            </div>

            {/* Centered stepper progress bar – app colors: green-800/purple for active, gray for inactive */}
            <div className="w-full flex justify-center mt-5 xl:mt-6">
                <div className="w-full max-w-4xl rounded-xl bg-purple-50 shadow border border-purple-200/80 px-4 py-3 xl:px-6 xl:py-4">
                    <div className="flex items-start justify-between gap-1 xl:gap-2">
                        {MileStonesArray.MilestonesName.map((milestone, index) => {
                            const isCompleted = index < currentMilestoneIndex;
                            const isCurrent = index === currentMilestoneIndex;
                            const isLast = index === TOTAL_STAGES - 1;
                            return (
                                <div key={milestone.id} className="flex flex-1 flex-col items-center min-w-0">
                                    <div className="flex items-center w-full">
                                        {index > 0 && (
                                            <div
                                                className={`flex-1 h-0.5 xl:h-1 min-w-[6px] transition-colors rounded ${
                                                    index <= currentMilestoneIndex ? 'bg-green-800' : 'bg-gray-300'
                                                }`}
                                                style={{ opacity: index <= currentMilestoneIndex ? 1 : 0.5 }}
                                            />
                                        )}
                                        <div
                                            className={`flex-shrink-0 w-7 h-7 xl:w-8 xl:h-8 rounded-full flex items-center justify-center text-xs xl:text-sm font-bold transition-all ${
                                                isCompleted
                                                    ? 'bg-green-800 text-white'
                                                    : isCurrent
                                                        ? 'bg-white text-green-800 border-2 border-green-800'
                                                        : 'bg-white text-gray-400 border border-gray-300'
                                            }`}
                                        >
                                            {index + 1}
                                        </div>
                                        {!isLast && (
                                            <div
                                                className={`flex-1 h-0.5 xl:h-1 min-w-[6px] transition-colors rounded ${
                                                    isCompleted ? 'bg-green-800' : 'bg-gray-300'
                                                }`}
                                                style={{ opacity: isCompleted ? 1 : 0.5 }}
                                            />
                                        )}
                                    </div>
                                    <p
                                        className={`mt-1 text-center text-[10px] xl:text-xs font-medium max-w-[80px] leading-tight ${
                                            isCurrent ? 'text-green-800' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                                        }`}
                                        title={milestone.name}
                                    >
                                        {milestone.name}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tabs: below progress bar, centered */}
            <div className="w-full flex justify-center  mt-3 xl:mt-4">
                <div className="flex gap-6 xl:gap-8">
                    {['Overview', 'BOQ', 'Payment', 'Escalation'].map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            className="min-w-[80px] py-2 font-bold text-purple-100 hover:text-green-900 hover:border-b-2 hover:border-green-800 hover:bg-purple-50 rounded transition-colors cursor-pointer text-sm xl:text-base"
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
