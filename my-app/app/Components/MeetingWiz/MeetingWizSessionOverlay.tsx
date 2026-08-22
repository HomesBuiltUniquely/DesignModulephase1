"use client";

import MeetingWizFlow from "./MeetingWizFlow";
import type { LeadshipTypes } from "@/app/Components/Types/Types";

type Props = {
  open: boolean;
  onClose: () => void;
  lead?: LeadshipTypes | null;
  onLeadUpdated?: (lead: LeadshipTypes) => void;
};

/** Full-screen Meeting Wizard (steps 1–5) over the design module. */
export function MeetingWizSessionOverlay({ open, onClose, lead, onLeadUpdated }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250] overflow-y-auto bg-[#f0f4f8]">
      <div className="sticky top-0 z-[260] flex justify-end border-b border-gray-200 bg-white/95 px-4 py-2 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Exit meeting
        </button>
      </div>
      <MeetingWizFlow onClose={onClose} lead={lead} onLeadUpdated={onLeadUpdated} />
    </div>
  );
}
