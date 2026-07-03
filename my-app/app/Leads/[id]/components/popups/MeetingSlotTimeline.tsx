"use client";

import { useEffect, useMemo, useState } from "react";
import {
  appointmentToBookedBlock,
  formatHubTimeRange,
  HUB_MEETING_DURATION_MIN,
  HUB_MEETING_TIMELINE_END_MIN,
  HUB_MEETING_TIMELINE_START_MIN,
  isHubMeetingStartAvailable,
  listHubMeetingStartOptions,
  minutesToHubTimeLabel,
  type BookedTimelineBlock,
} from "@/lib/hub-meeting-schedule";

const PX_PER_MIN = 0.95;
const TIME_COL_WIDTH = 92;

type Props = {
  apiBase: string;
  designerName: string;
  meetingDate: string;
  selectedStartMin: number | null;
  onSelectStartMin: (startMin: number | null) => void;
  disabled?: boolean;
};

export default function MeetingSlotTimeline({
  apiBase,
  designerName,
  meetingDate,
  selectedStartMin,
  onSelectStartMin,
  disabled = false,
}: Props) {
  const [bookedBlocks, setBookedBlocks] = useState<BookedTimelineBlock[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!meetingDate.trim() || !designerName.trim()) {
      setBookedBlocks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(
      `${apiBase}/api/appointment/designer/${encodeURIComponent(designerName.trim())}`,
      { credentials: "include" },
    )
      .then((r) => r.json())
      .then((rows: unknown) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setBookedBlocks(
          list
            .map((row, i) => appointmentToBookedBlock(row, meetingDate.trim(), i))
            .filter((b): b is BookedTimelineBlock => Boolean(b)),
        );
      })
      .catch(() => {
        if (!cancelled) setBookedBlocks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, designerName, meetingDate]);

  const startOptions = useMemo(() => listHubMeetingStartOptions(), []);
  const selectedEndMin =
    selectedStartMin !== null ? selectedStartMin + HUB_MEETING_DURATION_MIN : null;
  const timelineHeight = (HUB_MEETING_TIMELINE_END_MIN - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN;

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = HUB_MEETING_TIMELINE_START_MIN; m <= HUB_MEETING_TIMELINE_END_MIN; m += 30) {
      marks.push(m);
    }
    return marks;
  }, []);

  if (!meetingDate.trim() || !designerName.trim()) {
    return <p className="py-6 text-center text-sm text-gray-500">Pick a date to see available slots.</p>;
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-gray-500">Loading availability…</p>;
  }

  return (
    <div className="w-full">
      <p className="mb-3 text-center text-xs text-gray-500">
        Click a start time to book {HUB_MEETING_DURATION_MIN} minutes (11:00 AM – 7:00 PM)
      </p>

      <div className="flex w-full gap-3">
        {/* Time labels */}
        <div
          className="relative shrink-0"
          style={{ height: timelineHeight, width: TIME_COL_WIDTH }}
        >
          {startOptions.map((m) => {
            const available = isHubMeetingStartAvailable(m, bookedBlocks);
            const isSelected = selectedStartMin === m;
            return (
              <button
                key={m}
                type="button"
                disabled={disabled || !available}
                onClick={() => available && onSelectStartMin(m)}
                className={`absolute right-0 -translate-y-1/2 whitespace-nowrap rounded px-1.5 py-1 text-[12px] font-semibold leading-none transition ${
                  isSelected
                    ? "bg-emerald-600 text-white"
                    : available
                      ? "text-emerald-700 hover:bg-emerald-50"
                      : "cursor-not-allowed text-gray-300"
                }`}
                style={{ top: (m - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN }}
              >
                {minutesToHubTimeLabel(m)}
              </button>
            );
          })}
        </div>

        {/* Timeline grid */}
        <div
          className="relative min-w-[280px] flex-1 rounded-xl border border-gray-200 bg-gray-50"
          style={{ height: timelineHeight }}
        >
          {hourMarks.map((m) => (
            <div
              key={`line-${m}`}
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-gray-200"
              style={{ top: (m - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN }}
            />
          ))}

          {bookedBlocks.map((block) => {
            const top = (block.startMin - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN;
            const height = (block.endMin - block.startMin) * PX_PER_MIN;
            return (
              <div
                key={block.id}
                className="absolute left-0 box-border flex items-center gap-2 border border-gray-300 bg-gray-100 px-3 py-2"
                style={{ top, height: Math.max(height, 48), width: "100%" }}
              >
                <span className="shrink-0 text-gray-400" aria-hidden>
                  🔒
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-700">{block.label}</p>
                  {block.sublabel ? (
                    <p className="truncate text-[10px] text-gray-500">({block.sublabel})</p>
                  ) : null}
                </div>
              </div>
            );
          })}

          {selectedStartMin !== null && selectedEndMin !== null ? (
            <div
              className="absolute left-0 box-border overflow-hidden border-2 border-emerald-500 bg-emerald-50 px-3 py-2 shadow-[inset_4px_0_0_#16a34a]"
              style={{
                top: (selectedStartMin - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN,
                height: Math.max((selectedEndMin - selectedStartMin) * PX_PER_MIN, 52),
                width: "100%",
              }}
            >
              <div className="flex h-full w-full flex-col justify-center gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
                    SELECTED
                  </span>
                  <span className="text-emerald-600" aria-hidden>
                    ✓
                  </span>
                </div>
                <p className="text-xs font-semibold text-emerald-800">
                  {formatHubTimeRange(selectedStartMin, selectedEndMin)} ({HUB_MEETING_DURATION_MIN} mins)
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
