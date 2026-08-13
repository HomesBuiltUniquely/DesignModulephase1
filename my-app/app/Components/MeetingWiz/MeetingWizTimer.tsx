"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export function formatMeetingDuration(elapsedMs: number): string {
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type MeetingWizTimerValue = {
  startedAtMs: number;
  elapsedMs: number;
  durationSeconds: number;
  formatted: string;
};

const MeetingWizTimerContext = createContext<MeetingWizTimerValue | null>(null);

/** Starts when the meeting wizard opens; ticks every second. */
export function MeetingWizTimerProvider({ children }: { children: ReactNode }) {
  const [startedAtMs] = useState(() => Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const value = useMemo(() => {
    const elapsedMs = Math.max(0, nowMs - startedAtMs);
    return {
      startedAtMs,
      elapsedMs,
      durationSeconds: Math.floor(elapsedMs / 1000),
      formatted: formatMeetingDuration(elapsedMs),
    };
  }, [startedAtMs, nowMs]);

  return (
    <MeetingWizTimerContext.Provider value={value}>{children}</MeetingWizTimerContext.Provider>
  );
}

export function useMeetingWizTimer(): MeetingWizTimerValue {
  const ctx = useContext(MeetingWizTimerContext);
  if (!ctx) {
    return {
      startedAtMs: Date.now(),
      elapsedMs: 0,
      durationSeconds: 0,
      formatted: "00:00:00",
    };
  }
  return ctx;
}

/** Shared duration pill used across Meeting Wizard steps. */
export function MeetingWizDurationBadge({ className = "" }: { className?: string }) {
  const { formatted } = useMeetingWizTimer();
  return (
    <div
      className={`flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 ${className}`}
    >
      <div className="h-2 w-2 animate-pulse rounded-full bg-[#EF0101]" />
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Duration:</span>
      <span className="font-mono text-sm font-bold tabular-nums text-gray-900">{formatted}</span>
    </div>
  );
}
