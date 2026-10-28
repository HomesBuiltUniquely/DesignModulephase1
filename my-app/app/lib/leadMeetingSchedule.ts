import type { LeadshipTypes } from '@/app/Components/Types/Types';
import { MEETING_WIZ_COMPLETED_TASK } from '@/app/lib/meetingWizIncentive';
import { getPhaseBucket } from '@/app/lib/leadPhaseBucket';

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

/** India calendar day — matches Meeting management / CRM slot day. */
export function todayIsoDay(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now);
}

export function isMeetingOnToday(isoDay: string | null | undefined, today = todayIsoDay()): boolean {
  if (!isoDay) return false;
  return isoDay === today;
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
 * Start Meeting only for Pre 10% leads, while a meeting is scheduled for today
 * and that session has not been completed. After Meeting Completed, hides until
 * a newer meeting is scheduled.
 */
export function canShowStartMeetingButton(
  lead: LeadshipTypes | null | undefined,
  historyEvents?: HistoryEventLike[] | null,
): boolean {
  if (!lead || getPhaseBucket(lead) !== 'Pre 10%') return false;

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

/** Meeting-management board row fields used for Pre 10% Start / End gating. */
export type BoardMeetingStartGate = {
  meetingDate?: string | null;
  source?: string | null;
  meetingType?: string | null;
  progress?: string | null;
  meetingStatus?: string | null;
  projectStage?: string | null;
};

/** Same Pre 10% / CRM bucket the meeting board uses. */
export function isPre10CrmBoardMeeting(meeting: BoardMeetingStartGate | null | undefined): boolean {
  if (!meeting) return false;
  const source = (meeting.source || '').toLowerCase();
  if (source === 'personal') return false;
  if (source === 'crm') return true;
  const key = (meeting.meetingType || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  return key === 'pre 10' || key === 'pre10' || key === 'crm appointment';
}

/** Align board slot date onto the lead so dashboard Start rules see “today” for this row. */
export function alignLeadToBoardMeeting(
  lead: LeadshipTypes,
  meeting: BoardMeetingStartGate | null | undefined,
): LeadshipTypes {
  return {
    ...lead,
    appointmentDate: meeting?.meetingDate || lead.appointmentDate,
    scheduledMeetingDate: meeting?.meetingDate || lead.scheduledMeetingDate,
    // Keep the lead’s real stage (dashboard gate). Fill only when lead stage is empty.
    projectStage: lead.projectStage || meeting?.projectStage || 'PRE_10',
  };
}

/**
 * Start Meeting on the meeting-detail side panel — identical gates to Pre 10% dashboard
 * (`canShowStartMeetingButton`), plus board-row checks (Pre 10%/CRM, not cancelled /
 * completed / abandoned, meeting day = today IST). Lead must be loaded; never flash open.
 */
export function canShowStartMeetingForBoardMeeting(
  meeting: BoardMeetingStartGate | null | undefined,
  lead?: LeadshipTypes | null,
  historyEvents?: HistoryEventLike[] | null,
  todayIso?: string,
): boolean {
  if (!isPre10CrmBoardMeeting(meeting)) return false;
  if ((meeting?.meetingStatus || '').toLowerCase() === 'cancelled') return false;
  const progress = (meeting?.progress || '').toLowerCase();
  if (progress === 'completed' || progress === 'meeting_abandoned') return false;

  const meetingDay = parseMeetingDateToIsoDay(meeting?.meetingDate);
  const today = todayIso || todayIsoDay();
  if (!isMeetingOnToday(meetingDay, today)) return false;

  // Match dashboard: validate only when lead (+ optional history) is available.
  if (!lead) return false;

  return canShowStartMeetingButton(alignLeadToBoardMeeting(lead, meeting), historyEvents);
}

export type BoardStartMeetingBlockReason =
  | 'loading'
  | 'not_pre10'
  | 'cancelled'
  | 'completed'
  | 'abandoned'
  | 'future'
  | 'past'
  | 'no_lead'
  | 'phase_passed'
  | 'wiz_done'
  | 'not_today'
  | null;

/** Why Start is hidden on the meeting-detail panel (null when Start is allowed). */
export function getBoardStartMeetingBlockReason(
  meeting: BoardMeetingStartGate | null | undefined,
  lead: LeadshipTypes | null | undefined,
  historyEvents: HistoryEventLike[] | null | undefined,
  todayIso: string,
  opts?: { loading?: boolean },
): BoardStartMeetingBlockReason {
  if (opts?.loading) return 'loading';
  if (!isPre10CrmBoardMeeting(meeting)) return 'not_pre10';
  if ((meeting?.meetingStatus || '').toLowerCase() === 'cancelled') return 'cancelled';

  const progress = (meeting?.progress || '').toLowerCase();
  if (progress === 'completed') return 'completed';
  if (progress === 'meeting_abandoned') return 'abandoned';

  const meetingDay = parseMeetingDateToIsoDay(meeting?.meetingDate);
  if (!isMeetingOnToday(meetingDay, todayIso)) {
    if (meetingDay && meetingDay > todayIso) return 'future';
    if (meetingDay && meetingDay < todayIso) return 'past';
    return 'not_today';
  }

  if (!lead) return 'no_lead';

  const aligned = alignLeadToBoardMeeting(lead, meeting);
  if (getPhaseBucket(aligned) !== 'Pre 10%') return 'phase_passed';

  if (canShowStartMeetingButton(aligned, historyEvents)) return null;
  return 'wiz_done';
}

/** End Meeting after the CRM meeting was started (in progress). Not today-gated. */
export function canShowEndMeetingForBoardMeeting(
  meeting: BoardMeetingStartGate | null | undefined,
): boolean {
  if (!isPre10CrmBoardMeeting(meeting)) return false;
  if ((meeting?.meetingStatus || '').toLowerCase() === 'cancelled') return false;
  return (meeting?.progress || '').toLowerCase() === 'in_progress';
}
