"use client";

import type { PopupContext } from "../types";
import {
  getTaskEmailChannels,
  type EmailChannelKind,
} from "./taskEmailChannels";

type Props = {
  context: PopupContext;
  onClose: () => void;
  children: React.ReactNode;
};

function channelLabel(kind: EmailChannelKind): string {
  switch (kind) {
    case "internal":
      return "Internal mail";
    case "external":
      return "External mail";
    case "client":
      return "Client (customer)";
    default:
      return kind;
  }
}

function channelClass(kind: EmailChannelKind): string {
  switch (kind) {
    case "internal":
      return "bg-sky-100 text-sky-900 border-sky-200";
    case "external":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "client":
      return "bg-violet-100 text-violet-900 border-violet-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function TaskEmailChannelStrip({ context }: { context: PopupContext }) {
  const info = getTaskEmailChannels(
    context.milestoneIndex,
    context.taskName,
  );
  if (!info) return null;
  return (
    <div className="px-6 pt-4 pb-2 border-b border-gray-100 bg-gray-50/80 flex-shrink-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
        Expected email channels (per SOP)
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        {info.channels.map((c) => (
          <span
            key={c}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${channelClass(c)}`}
          >
            {channelLabel(c)}
          </span>
        ))}
      </div>
      {info.hint ? (
        <p className="mt-2 text-xs text-gray-600 leading-snug">{info.hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Modal wrapper for task popups. Handles backdrop, size (normal vs DQC 1 approval), and optional header.
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
  const modalTitle =
    context.milestoneIndex === 1 && context.taskName === "meeting completed"
      ? "Meeting Scheduled"
      : context.milestoneIndex === 1
        ? "First Cut Design Discussion"
        : context.milestoneName;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ${isDqcApproval ? "xl:max-w-[95vw] xl:w-full xl:max-h-[90vh]" : isDqcSubmission ? "xl:max-h-[85vh] xl:w-[42rem]" : "xl:max-h-[85vh] xl:w-[40vw]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <TaskEmailChannelStrip context={context} />
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
