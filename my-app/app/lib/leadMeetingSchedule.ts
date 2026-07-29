import type { LeadshipTypes } from '@/app/Components/Types/Types';
import { MEETING_WIZ_COMPLETED_TASK } from '@/app/lib/meetingWizIncentive';

/** Normalize various date strings to YYYY-MM-DD (local calendar day). */
export function parseMeetingDateToIsoDay(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
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

/**
 * True when this lead has a meeting on today's calendar day.
 * Uses design scheduledMeetingDate, CRM appointmentDate, and any history meta.meetingDate.
 */
export function isLeadMeetingScheduledToday(
  lead: LeadshipTypes | null | undefined,
  historyEvents?: HistoryEventLike[] | null,
): boolean {
  if (historyHasMeetingScheduledToday(historyEvents)) return true;
  return isMeetingOnToday(getLeadScheduledMeetingIsoDay(lead));
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

/**
 * Start Meeting only while a meeting is scheduled for today and that session
 * has not been completed. After Meeting Completed, hides until a newer meeting is scheduled.
 *
 * TEMP: set FORCE_START_MEETING_FOR_TEST to false when done testing.
 */
const FORCE_START_MEETING_FOR_TEST = true;

export function canShowStartMeetingButton(
  lead: LeadshipTypes | null | undefined,
  historyEvents?: HistoryEventLike[] | null,
): boolean {
  if (FORCE_START_MEETING_FOR_TEST) return Boolean(lead);

  if (!isLeadMeetingScheduledToday(lead, historyEvents)) return false;

  const scheduleDay =
    getLeadScheduledMeetingIsoDay(lead) ||
    (historyHasMeetingScheduledToday(historyEvents) ? todayIsoDay() : null);
  if (!scheduleDay) return false;

  const completed = getLatestMeetingWizCompletion(lead, historyEvents);
  if (!completed) return true;

  const scheduleUpdatedAt = getScheduleUpdatedAt(lead);
  // A meeting scheduled/rescheduled after completion unlocks Start Meeting again.
  if (scheduleUpdatedAt && scheduleUpdatedAt > completed.at) {
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
