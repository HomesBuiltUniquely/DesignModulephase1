'use client';

import type { PopupContext } from "../types";

type Props = {
  context: PopupContext;
  onClose: () => void;
  children: React.ReactNode;
};

/** Friendly popup titles for known substages (falls back to the raw task name). */
function formatSubstageTitle(taskName: string): string {
  const t = (taskName || "").trim();
  const overrides: Record<string, string> = {
    "D1 for MMT request": "D1 for MMT Request",
    "Group Description": "Group Description",
    "Mail loop chain 2 initiate": "Mail Loop Chain 2 Initiate",
    "D1 files upload": "D1 Files Upload",
    "First cut design + quotation discussion meeting request": "First Cut Design Discussion",
    "meeting completed": "Meeting Completed",
    "DQC 1 submission - dwg + quotation": "DQC 1 Submission",
    "DQC 1 approval": "DQC 1 Approval",
    "10% payment collection": "10% Payment Collection",
    "10% payment approval": "10% Payment Approval",
    "D2 - masking request raise": "D2 Masking Request",
    "D2 - files upload": "D2 Files Upload",
    "Material selection meeting + quotation discussion": "Material Selection Meeting",
    "Material selection meeting completed": "Material Selection Meeting Completed",
    "DQC 2 submission": "DQC 2 Submission",
    "DQC 2 approval": "DQC 2 Approval",
    "DQC 2 approval ": "DQC 2 Approval",
    "Project manager approval": "Project Manager Approval",
    "Design sign off": "Design Sign Off",
    "40% payment collection": "40% Payment Collection",
    "40% payment approval": "40% Payment Approval",
    "40% collection": "40% Collection",
    "Cx approval for production": "CX Approval for Production",
    "POC mail": "POC Mail",
    "POC mail & Timeline submission": "POC Mail & Timeline Submission",
  };
  if (overrides[t]) return overrides[t];
  if (overrides[taskName]) return overrides[taskName];
  // Title-case fallback for any new substages
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Modal wrapper for task popups. Handles backdrop, size (normal vs DQC 1 approval), and optional header.
 * Title shows the substage (task) name — not the milestone name.
 */
export default function TaskModal({ context, onClose, children }: Props) {
  const isDqcApproval =
    context.taskName === "DQC 1 approval" ||
    context.taskName === "DQC 2 approval" ||
    context.taskName === "DQC 2 approval ";
  const isDqcSubmission =
    context.taskName === "DQC 1 submission - dwg + quotation" ||
    context.taskName === "DQC 2 submission";
  const contentClass = isDqcApproval
    ? "flex-1 overflow-y-auto min-h-0 flex flex-col"
    : isDqcSubmission
      ? "flex-1 overflow-y-auto min-h-0"
      : "overflow-y-auto";
  const isMomPopup =
    context.taskName === "meeting completed" ||
    context.taskName === "Material selection meeting completed" ||
    context.taskName === "Cx approval for production" ||
    context.taskName.toLowerCase().includes("meeting completed");
  const modalTitle = isMomPopup
    ? "Meeting Completed"
    : formatSubstageTitle(context.taskName);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ${isDqcApproval ? "xl:max-w-[95vw] xl:w-full xl:max-h-[90vh]" : isDqcSubmission ? "xl:max-h-[85vh] xl:w-[42rem]" : "xl:max-h-[85vh] xl:w-[40vw]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {!isDqcApproval && !isDqcSubmission && (
          <div className="flex justify-between items-center pt-6 px-6 pb-2 flex-shrink-0">
            <h3 className="text-lg font-bold text-gray-900">{modalTitle}</h3>
            <button
              onClick={onClose}
              className="text-gray-700 bg-gray-100 hover:text-gray-700 text-2xl leading-none border border-gray-300 rounded-md p-2 font-bold text-sm"
            >
              Close
            </button>
          </div>
        )}
        <div
          className={contentClass}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
