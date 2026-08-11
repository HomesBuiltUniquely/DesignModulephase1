"use client";

import { useMemo, useState } from "react";
import MeetingSlotPickerModal from "@/app/Leads/[id]/components/popups/MeetingSlotPickerModal";
import { buildAuthHeaders } from "@/app/lib/apiBase";
import CustomDatePicker from "@/app/Components/ui/CustomDatePicker";
import CustomSelect from "@/app/Components/ui/CustomSelect";
import {
  buildHubMeetingDateTimeIso,
  formatHubTimeRange,
  minutesToHubTime24,
  PERSONAL_BLOCK_REASON_PRESETS,
  type PersonalBlockReasonPreset,
} from "@/lib/hub-meeting-schedule";
import {
  formatAppointmentDateLabel,
  type AppointmentSuccessPayload,
} from "./AppointmentSuccessToast";

type Props = {
  open: boolean;
  apiBase: string;
  sessionId: string;
  designerName: string;
  onClose: () => void;
  onSuccess: (payload?: AppointmentSuccessPayload) => void;
};

type BookingMode = "partial" | "full_day";

const DURATION_OPTIONS = [30, 60, 90] as const;

const fieldLabelClass = "block text-sm font-semibold text-gray-800 mb-1.5";
const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#EF0101] focus:ring-2 focus:ring-emerald-500/20";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PersonalAppointmentModal({
  open,
  apiBase,
  sessionId,
  designerName,
  onClose,
  onSuccess,
}: Props) {
  const [bookingMode, setBookingMode] = useState<BookingMode>("partial");
  const [meetingDate, setMeetingDate] = useState("");
  const [durationMin, setDurationMin] = useState<number>(90);
  const [selectedStartMin, setSelectedStartMin] = useState<number | null>(null);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [reasonPreset, setReasonPreset] = useState<PersonalBlockReasonPreset>("Site visit");
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotRefreshKey, setSlotRefreshKey] = useState(0);

  const isFullDay = bookingMode === "full_day";
  const isOtherReason = reasonPreset === "Other";

  const resolvedReason = useMemo(() => {
    if (isOtherReason) return customReason.trim();
    return reasonPreset;
  }, [isOtherReason, reasonPreset, customReason]);

  const canSubmitPartial =
    Boolean(meetingDate) &&
    selectedStartMin !== null &&
    resolvedReason.length > 0 &&
    !submitting;

  const canSubmitFullDay = Boolean(meetingDate) && resolvedReason.length > 0 && !submitting;

  const canSubmit = isFullDay ? canSubmitFullDay : canSubmitPartial;

  if (!open) return null;

  const handleModeChange = (mode: BookingMode) => {
    setBookingMode(mode);
    setError(null);
    setSelectedStartMin(null);
    if (mode === "full_day") {
      setReasonPreset("Leave");
      setCustomReason("");
    } else {
      setReasonPreset("Site visit");
    }
  };

  const handleReasonPresetChange = (value: PersonalBlockReasonPreset) => {
    setReasonPreset(value);
    if (value !== "Other") setCustomReason("");
  };

  const resetForm = () => {
    setMeetingDate("");
    setSelectedStartMin(null);
    setCustomReason("");
    setReasonPreset("Site visit");
    setBookingMode("partial");
    setError(null);
  };

  const handleSubmitPartial = async () => {
    if (!canSubmitPartial || selectedStartMin === null) return;
    setSubmitting(true);
    setError(null);

    const endMin = selectedStartMin + durationMin;
    const payload = {
      reason: resolvedReason,
      reasonPreset,
      startTime: buildHubMeetingDateTimeIso(meetingDate, selectedStartMin),
      endTime: buildHubMeetingDateTimeIso(meetingDate, endMin),
      meetingDate,
      meetingTime: minutesToHubTime24(selectedStartMin),
      meetingEndTime: minutesToHubTime24(endMin),
      durationMin,
    };

    const res = await fetch(`${apiBase}/api/appointment/personal`, {
      method: "POST",
      headers: buildAuthHeaders(sessionId, { "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 409 || data?.conflict) {
        setError("This slot was just booked by someone else. Please pick another time.");
        setSelectedStartMin(null);
        setSlotRefreshKey((k) => k + 1);
        return;
      }
      throw new Error(data?.message || "Failed to book appointment");
    }
    const successPayload: AppointmentSuccessPayload = {
      kind: "partial",
      dateLabel: formatAppointmentDateLabel(meetingDate),
      timeLabel: formatHubTimeRange(selectedStartMin, endMin),
    };
    onSuccess(successPayload);
    onClose();
    resetForm();
  };

  const handleSubmitFullDay = async () => {
    if (!canSubmitFullDay) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`${apiBase}/api/appointment/full-day`, {
      method: "POST",
      headers: buildAuthHeaders(sessionId, { "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify({
        blockDate: meetingDate,
        reason: resolvedReason,
        reasonPreset,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || "Failed to submit full-day leave request");
    }
    onSuccess({
      kind: "full_day",
      dateLabel: formatAppointmentDateLabel(meetingDate),
    });
    onClose();
    resetForm();
  };

  const handleSubmit = async () => {
    try {
      if (isFullDay) {
        await handleSubmitFullDay();
      } else {
        await handleSubmitPartial();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-backdropFadeIn">
        <div
          className="flex w-full max-w-md flex-col rounded-xl bg-white shadow-xl animate-modalPopIn"
          role="dialog"
          aria-labelledby="personal-appointment-title"
        >
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 pr-2">
                <h2 id="personal-appointment-title" className="text-lg font-bold text-gray-900">
                  {isFullDay ? "Apply for Full-Day Leave" : "Block Personal Time"}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                  {isFullDay
                    ? "Request a full day (11 AM – 7 PM). Your manager must approve before the calendar is blocked."
                    : "Reserve a calendar slot for personal use. It appears as booked immediately."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div>
              <span className={fieldLabelClass}>Booking type</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange("partial")}
                  className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    !isFullDay
                      ? "border-[#EF0101] bg-[#DDCDC1]/20 text-[#32261C]"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Partial block
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("full_day")}
                  className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    isFullDay
                      ? "border-[#EF0101] bg-[#DDCDC1]/20 text-[#32261C]"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Full day
                </button>
              </div>
            </div>

            <label className="block">
              <span className={fieldLabelClass}>
                Date <span className="text-red-500">*</span>
              </span>
              <CustomDatePicker
                min={todayIso()}
                value={meetingDate}
                onChange={(date) => {
                  setMeetingDate(date);
                  setSelectedStartMin(null);
                }}
              />
            </label>

            {!isFullDay ? (
              <>
                <div>
                  <span className={fieldLabelClass}>
                    Duration <span className="text-red-500">*</span>
                  </span>
                  <div className="flex gap-2">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setDurationMin(d);
                          setSelectedStartMin(null);
                        }}
                        className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                          durationMin === d
                            ? "border-[#EF0101] bg-[#DDCDC1]/20 text-[#32261C]"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {d} min
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className={fieldLabelClass}>
                    Time slot <span className="text-red-500">*</span>
                  </span>
                  {!meetingDate ? (
                    <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-400">
                      Pick a date first, then select a time slot.
                    </p>
                  ) : selectedStartMin !== null ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5">
                      <p className="text-sm font-medium text-gray-900">
                        {formatHubTimeRange(selectedStartMin, selectedStartMin + durationMin)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSlotPickerOpen(true)}
                        className="shrink-0 text-xs font-semibold text-[#00B0ED] hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSlotPickerOpen(true)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Select time slot
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                Full-day leave covers <strong>11:00 AM – 7:00 PM</strong>. You cannot apply if client
                meetings are already scheduled on this date.
              </div>
            )}

            <div>
              <span className={fieldLabelClass}>
                Reason <span className="text-red-500">*</span>
              </span>
              <CustomSelect
                value={reasonPreset}
                onChange={(val) => handleReasonPresetChange(val as PersonalBlockReasonPreset)}
                options={PERSONAL_BLOCK_REASON_PRESETS.map((p) => ({ value: p, label: p }))}
              />

              {isOtherReason && (
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-sm font-medium text-gray-700">
                    Describe the reason <span className="text-red-500">*</span>
                  </span>
                  <textarea
                    className={`${inputClass} min-h-[88px] resize-y`}
                    placeholder="Enter why you need this time block…"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    autoFocus
                  />
                </label>
              )}
            </div>

            {error ? (
              <p
                className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-600"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="rounded-lg bg-[#EF0101] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EF0101] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? isFullDay
                  ? "Submitting…"
                  : "Booking…"
                : isFullDay
                  ? "Submit for Approval"
                  : "Book Appointment"}
            </button>
          </div>
        </div>
      </div>

      {!isFullDay ? (
        <MeetingSlotPickerModal
          key={`${meetingDate}-${durationMin}-${slotRefreshKey}`}
          open={slotPickerOpen}
          onClose={() => setSlotPickerOpen(false)}
          onConfirm={setSelectedStartMin}
          apiBase={apiBase}
          designerName={designerName}
          meetingDate={meetingDate}
          initialStartMin={selectedStartMin}
          durationMin={durationMin}
          sessionId={sessionId}
        />
      ) : null}
    </>
  );
}
