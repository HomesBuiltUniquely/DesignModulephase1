"use client";

import { useEffect, useMemo, useState } from "react";
import { buildAuthHeaders } from "@/app/lib/apiBase";
import {
  appointmentToBookedBlock,
  formatHubTimeRange,
  HUB_MEETING_DURATION_MIN,
  HUB_MEETING_TIMELINE_END_MIN,
  HUB_MEETING_TIMELINE_START_MIN,
  isHubMeetingStartAvailable,
  isFullDayBlockedOnTimeline,
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
  /** Meeting length in minutes (default 90 for client meetings). */
  durationMin?: number;
  sessionId?: string | null;
};

export default function MeetingSlotTimeline({
  apiBase,
  designerName,
  meetingDate,
  selectedStartMin,
  onSelectStartMin,
  disabled = false,
  durationMin = HUB_MEETING_DURATION_MIN,
  sessionId = null,
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
      {
        credentials: "include",
        headers: buildAuthHeaders(sessionId),
      },
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
  }, [apiBase, designerName, meetingDate, sessionId]);

  const startOptions = useMemo(() => listHubMeetingStartOptions(durationMin), [durationMin]);
  const fullDayBlocked = useMemo(() => isFullDayBlockedOnTimeline(bookedBlocks), [bookedBlocks]);
  const selectedEndMin =
    selectedStartMin !== null ? selectedStartMin + durationMin : null;
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
      {fullDayBlocked ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
          Full-day leave is active for this date (11:00 AM – 7:00 PM). No slots available.
        </p>
      ) : (
        <p className="mb-3 text-center text-xs text-gray-500">
          Click a start time to book {durationMin} minutes (11:00 AM – 7:00 PM)
        </p>
      )}

      <div className="flex w-full gap-3">
        {/* Time labels */}
        <div
          className="relative shrink-0"
          style={{ height: timelineHeight, width: TIME_COL_WIDTH }}
        >
          {startOptions.map((m) => {
            const available = isHubMeetingStartAvailable(m, bookedBlocks, durationMin, meetingDate);
            const isSelected = selectedStartMin === m;
            return (
              <button
                key={m}
                type="button"
                disabled={disabled || !available}
                onClick={() => available && onSelectStartMin(m)}
                className={`absolute right-0 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-semibold leading-none transition-all duration-200 ${
                  isSelected
                    ? "bg-[#EF0101] text-white shadow-md scale-105"
                    : available
                      ? "text-[#32261C] hover:bg-[#DDCDC1]/30 hover:scale-105"
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
          className="relative min-w-[280px] flex-1 rounded-xl border border-[#DDCDC1] bg-white shadow-sm"
          style={{ height: timelineHeight }}
        >
          {hourMarks.map((m) => (
            <div
              key={`line-${m}`}
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-[#DDCDC1]"
              style={{ top: (m - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN }}
            />
          ))}

          {bookedBlocks.map((block) => {
            const top = (block.startMin - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN;
            const height = (block.endMin - block.startMin) * PX_PER_MIN;
            return (
              <div
                key={block.id}
                className="absolute left-0 box-border flex items-center gap-2 border border-[#DDCDC1] bg-[#F1F2F6] px-3 py-2"
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

          {startOptions.map((m) => {
            const available = isHubMeetingStartAvailable(m, bookedBlocks, durationMin, meetingDate);
            if (!available) return null;
            return (
              <div
                key={`hover-container-${m}`}
                className="group absolute left-0 z-10 w-full cursor-pointer"
                style={{
                  top: (m - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN,
                  height: 30 * PX_PER_MIN,
                }}
                onClick={() => !disabled && onSelectStartMin(m)}
              >
                <div
                  className="pointer-events-none absolute left-0 w-full rounded-md border-2 border-transparent transition-all duration-200 group-hover:border-[#EF0101]/40 group-hover:bg-[#EF0101]/5 group-hover:shadow-sm"
                  style={{
                    top: 0,
                    height: Math.max(durationMin * PX_PER_MIN, 48),
                  }}
                />
              </div>
            );
          })}

          {selectedStartMin !== null && selectedEndMin !== null ? (
            <div
              className="pointer-events-none absolute left-0 z-20 box-border overflow-hidden rounded-md border-2 border-[#EF0101] bg-[#EF0101]/10 px-3 py-2 shadow-md shadow-[#EF0101]/10 transition-all duration-300 animate-in zoom-in-95 fade-in"
              style={{
                top: (selectedStartMin - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN,
                height: Math.max((selectedEndMin - selectedStartMin) * PX_PER_MIN, 52),
                width: "100%",
              }}
            >
              <div className="flex h-full w-full flex-col justify-center gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-[#EF0101] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white shadow-sm">
                    SELECTED
                  </span>
                  <span className="text-[#32261C]" aria-hidden>
                    ✓
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#32261C]">
                  {formatHubTimeRange(selectedStartMin, selectedEndMin)} ({durationMin} mins)
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
