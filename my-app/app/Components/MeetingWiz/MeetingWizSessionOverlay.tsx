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
      <MeetingWizFlow onClose={onClose} lead={lead} onLeadUpdated={onLeadUpdated} />
    </div>
  );
}
