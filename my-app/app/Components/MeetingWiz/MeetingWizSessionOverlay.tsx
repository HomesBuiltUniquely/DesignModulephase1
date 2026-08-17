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
    <div className="meeting-wiz fixed inset-0 z-[250] overflow-y-auto bg-[var(--brand-surface)] text-[var(--foreground)]">
      <div className="sticky top-0 z-[260] flex justify-end border-b border-[var(--border-color)] bg-[var(--card-bg)]/95 px-4 py-2 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--brand-dark)] transition hover:bg-[var(--hover-bg)]"
        >
          Exit meeting
        </button>
      </div>
      <MeetingWizFlow onClose={onClose} lead={lead} onLeadUpdated={onLeadUpdated} />
    </div>
  );
}
