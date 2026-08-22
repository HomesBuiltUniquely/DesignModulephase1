import type { LeadshipTypes } from '@/app/Components/Types/Types';
import { MEETING_WIZ_COMPLETED_TASK } from '@/app/lib/meetingWizIncentive';
import { getPhaseBucket } from '@/app/lib/leadPhaseBucket';

/** Normalize various date strings to YYYY-MM-DD (local calendar day). */
export function parseMeetingDateToIsoDay(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();

  // Date-only ISO: keep as calendar day (do not UTC-shift).
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // Datetime: use local calendar day (IST on this product).
  if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(s)) {
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return s.slice(0, 10);
  }

  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${month}-${day}`;
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
}

export function todayIsoDay(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isMeetingOnToday(isoDay: string | null | undefined): boolean {
  if (!isoDay) return false;
  return isoDay === todayIsoDay();
}

type HistoryEventLike = {
  taskName?: string;
  timestamp?: string;
  meta?: Record<string, unknown> | null;
};

function collectMeetingIsoDaysFromHistory(
  events: HistoryEventLike[] | null | undefined,
): string[] {
  if (!events?.length) return [];
  const days: string[] = [];
  for (const ev of events) {
    const meta = ev.meta && typeof ev.meta === 'object' ? ev.meta : {};
    const candidate =
      parseMeetingDateToIsoDay(meta.meetingDate as string) ||
      parseMeetingDateToIsoDay(meta.signoffDate as string) ||
      parseMeetingDateToIsoDay(meta.startTime as string) ||
      parseMeetingDateToIsoDay(meta.endTime as string);
    if (candidate) days.push(candidate);
  }
  return days;
}

/** Latest scheduled meeting date from lead history (design-module invites). */
export function getScheduledMeetingIsoDayFromHistory(
  events: HistoryEventLike[] | null | undefined,
): string | null {
  const days = collectMeetingIsoDaysFromHistory(events);
  if (!days.length) return null;
  return days.reduce((best, d) => (!best || d > best ? d : best), null as string | null);
}

export function historyHasMeetingScheduledToday(
  events: HistoryEventLike[] | null | undefined,
): boolean {
  const today = todayIsoDay();
  return collectMeetingIsoDaysFromHistory(events).some((d) => d === today);
}

export function getLeadScheduledMeetingIsoDay(lead: LeadshipTypes | null | undefined): string | null {
  if (!lead) return null;
  const fromDesign =
    parseMeetingDateToIsoDay(lead.scheduledMeetingDate) ||
    parseMeetingDateToIsoDay(
      (lead as { designScheduledMeeting?: { date?: string } }).designScheduledMeeting?.date,
    );
  return fromDesign || parseMeetingDateToIsoDay(lead.appointmentDate);
}

function listLeadMeetingIsoDays(lead: LeadshipTypes | null | undefined): string[] {
  if (!lead) return [];
  const days: string[] = [];
  const push = (raw: string | null | undefined) => {
    const d = parseMeetingDateToIsoDay(raw);
    if (d && !days.includes(d)) days.push(d);
  };
  push(lead.scheduledMeetingDate);
  push((lead as { designScheduledMeeting?: { date?: string } }).designScheduledMeeting?.date);
  push(lead.appointmentDate);
  return days;
}

function leadHasMeetingSlot(lead: LeadshipTypes | null | undefined): boolean {
  if (!lead) return false;
  return Boolean(
    lead.scheduledMeetingSlot?.trim() ||
      lead.appointmentSlot?.trim() ||
      (lead as { designScheduledMeeting?: { time?: string } }).designScheduledMeeting?.time?.trim(),
  );
}

/**
 * True when this lead has a meeting on today's calendar day.
 * Uses design scheduledMeetingDate, CRM appointmentDate, and any history meta.meetingDate.
 * CRM intake sometimes sends a slot with no parseable date — still treat as today's meeting.
 */
export function isLeadMeetingScheduledToday(
  lead: LeadshipTypes | null | undefined,
  historyEvents?: HistoryEventLike[] | null,
): boolean {
  if (historyHasMeetingScheduledToday(historyEvents)) return true;
  if (listLeadMeetingIsoDays(lead).some((d) => isMeetingOnToday(d))) return true;
  if (leadHasMeetingSlot(lead) && listLeadMeetingIsoDays(lead).length === 0) return true;
  return false;
}

function getScheduleUpdatedAt(lead: LeadshipTypes | null | undefined): string | null {
  if (!lead) return null;
  const fromField = lead.designScheduledMeetingUpdatedAt?.trim();
  if (fromField) return fromField;
  const nested = (lead as { designScheduledMeeting?: { updatedAt?: string } }).designScheduledMeeting
    ?.updatedAt;
  return nested?.trim() || null;
}

function getLatestMeetingWizCompletion(
  lead: LeadshipTypes | null | undefined,
  historyEvents?: HistoryEventLike[] | null,
): { at: string; meetingDate: string | null } | null {
  const fromLead = lead?.meetingWizLastCompleted;
  if (fromLead?.at?.trim()) {
    return {
      at: fromLead.at.trim(),
      meetingDate: parseMeetingDateToIsoDay(fromLead.meetingDate) || parseMeetingDateToIsoDay(fromLead.at),
    };
  }

  if (!historyEvents?.length) return null;
  let best: { at: string; meetingDate: string | null } | null = null;
  for (const ev of historyEvents) {
    if (String(ev.taskName || '').trim() !== MEETING_WIZ_COMPLETED_TASK) continue;
    const meta = ev.meta && typeof ev.meta === 'object' ? ev.meta : {};
    const at = String(meta.completedAt || ev.timestamp || '').trim();
    if (!at) continue;
    if (!best || at > best.at) {
      best = {
        at,
        meetingDate:
          parseMeetingDateToIsoDay(meta.meetingDate as string) || parseMeetingDateToIsoDay(at),
      };
    }
  }
  return best;
}

/** Meeting wizard is run by designers; admins can also start it. Other roles only view. */
export function canStartMeetingByRole(role: string | null | undefined): boolean {
  const r = (role || '').toLowerCase();
  return r === 'designer' || r === 'admin';
}

/**
 * Start Meeting only for designers/admins, Pre 10% leads, while a meeting is scheduled for today
 * and that session has not been completed. After Meeting Completed, hides until
 * a newer meeting is scheduled.
 */
export function canShowStartMeetingButton(
  lead: LeadshipTypes | null | undefined,
  historyEvents?: HistoryEventLike[] | null,
  userRole?: string | null,
): boolean {
  if (!canStartMeetingByRole(userRole)) return false;
  if (!lead || getPhaseBucket(lead) !== 'Pre 10%') return false;

  if (!isLeadMeetingScheduledToday(lead, historyEvents)) return false;

  const today = todayIsoDay();
  const scheduleDay =
    listLeadMeetingIsoDays(lead).find((d) => d === today) ||
    (historyHasMeetingScheduledToday(historyEvents) ? today : null) ||
    (leadHasMeetingSlot(lead) && listLeadMeetingIsoDays(lead).length === 0 ? today : null) ||
    getLeadScheduledMeetingIsoDay(lead);
  if (!scheduleDay) return false;

  const completed = getLatestMeetingWizCompletion(lead, historyEvents);
  if (!completed) return true;

  const scheduleUpdatedAt = getScheduleUpdatedAt(lead);
  // A meeting scheduled/rescheduled after completion unlocks Start Meeting again.
  // Ignore tiny timestamp gaps: completing the wizard used to rewrite designScheduledMeeting
  // with a new updatedAt a few ms later, which brought the button back on refresh.
  if (scheduleUpdatedAt && isRealRescheduleAfterCompletion(scheduleUpdatedAt, completed.at)) {
    return true;
  }

  if (completed.meetingDate && completed.meetingDate === scheduleDay) {
    return false;
  }

  // Fallback: completed on the same calendar day as today's schedule.
  const completedDay = parseMeetingDateToIsoDay(completed.at);
  if (completedDay === scheduleDay) return false;

  return true;
}

/** True when a later invite/reschedule is clearly after Meeting Completed (not the completion write itself). */
function isRealRescheduleAfterCompletion(scheduleUpdatedAt: string, completedAt: string): boolean {
  const tSched = Date.parse(scheduleUpdatedAt);
  const tDone = Date.parse(completedAt);
  if (Number.isFinite(tSched) && Number.isFinite(tDone)) {
    return tSched - tDone > 60_000;
  }
  return scheduleUpdatedAt > completedAt;
}
