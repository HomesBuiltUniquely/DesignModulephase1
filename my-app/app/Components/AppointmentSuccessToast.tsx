"use client";

import { useEffect } from "react";

export type AppointmentSuccessPayload = {
  kind: "partial" | "full_day";
  dateLabel: string;
  timeLabel?: string;
};

type Props = {
  payload: AppointmentSuccessPayload;
  onDismiss: () => void;
};

export function AppointmentSuccessToast({ payload, onDismiss }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const title =
    payload.kind === "full_day"
      ? "Full-day leave submitted!"
      : "Personal appointment booked!";

  const subtitle =
    payload.kind === "full_day"
      ? `Your request for ${payload.dateLabel} has been sent to your manager for approval.`
      : payload.timeLabel
        ? `${payload.dateLabel} · ${payload.timeLabel} is now blocked on your calendar.`
        : `Your time block for ${payload.dateLabel} is confirmed.`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-6 pointer-events-none sm:pt-10"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-xl border border-emerald-200 bg-white p-4 shadow-2xl ring-1 ring-emerald-100">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none" aria-hidden>
            🎉
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function formatAppointmentDateLabel(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
