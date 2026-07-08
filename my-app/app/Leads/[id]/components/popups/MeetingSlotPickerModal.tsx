"use client";

import { useEffect, useState } from "react";
import MeetingSlotTimeline from "./MeetingSlotTimeline";
import {
  formatHubTimeRange,
  HUB_MEETING_DURATION_MIN,
} from "@/lib/hub-meeting-schedule";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (startMin: number) => void;
  apiBase: string;
  designerName: string;
  meetingDate: string;
  initialStartMin: number | null;
  durationMin?: number;
  sessionId?: string | null;
};

function formatDateLabel(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MeetingSlotPickerModal({
  open,
  onClose,
  onConfirm,
  apiBase,
  designerName,
  meetingDate,
  initialStartMin,
  durationMin = HUB_MEETING_DURATION_MIN,
  sessionId = null,
}: Props) {
  const [draftStartMin, setDraftStartMin] = useState<number | null>(initialStartMin);

  useEffect(() => {
    if (open) {
      setDraftStartMin(initialStartMin);
    }
  }, [open, initialStartMin]);

  if (!open) return null;

  const canConfirm = draftStartMin !== null;
  const selectedRange =
    draftStartMin !== null
      ? formatHubTimeRange(draftStartMin, draftStartMin + durationMin)
      : null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meeting-slot-picker-title"
      onClick={onClose}
    >
      <div
        className="my-auto flex w-full max-w-[640px] flex-col rounded-xl bg-white shadow-xl"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-gray-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="meeting-slot-picker-title" className="text-base font-bold text-gray-900">
                Select time slot
              </h3>
              <p className="mt-0.5 text-sm text-gray-500">{formatDateLabel(meetingDate)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xl leading-none text-gray-400 hover:text-gray-700"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-emerald-400 bg-emerald-50" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-gray-200" />
              Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border-2 border-emerald-500 bg-emerald-50" />
              Selected
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <MeetingSlotTimeline
            apiBase={apiBase}
            designerName={designerName}
            meetingDate={meetingDate}
            selectedStartMin={draftStartMin}
            onSelectStartMin={setDraftStartMin}
            durationMin={durationMin}
            sessionId={sessionId}
          />
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              {canConfirm && selectedRange ? (
                <>
                  Selected: <strong className="text-gray-900">{selectedRange}</strong>
                </>
              ) : (
                "Pick a start time on the left"
              )}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={() => {
                  if (draftStartMin !== null) {
                    onConfirm(draftStartMin);
                    onClose();
                  }
                }}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm slot
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
