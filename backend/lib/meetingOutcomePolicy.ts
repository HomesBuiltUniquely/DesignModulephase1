/** Server-side rules for Design meeting outcome actions (IST / Asia/Kolkata). */

export const MEETING_OUTCOME_RECENCY_DAYS = (() => {
  const n = Number(process.env.MEETING_OUTCOME_RECENCY_DAYS ?? 14);
  if (!Number.isFinite(n) || n <= 0) return 14;
  return Math.min(Math.floor(n), 90);
})();

/** Same defaults as Design `leadMeetings.ts` — document in UI when time missing. */
export const HUB_MEETING_DURATION_MIN = 90;
export const MEETING_ABANDON_BUFFER_MIN = 4 * 60;
export const HUB_DEFAULT_END_TIME_LABEL = '8:00 PM';

export function meetingModeLabel(mode: string | null | undefined): string {
  const m = String(mode || '').trim().toLowerCase();
  if (m === 'online') return 'Virtual meeting';
  if (m === 'offline' || m === 'site') return 'Showroom visit';
  return 'Not recorded';
}

function kolkataParts(date: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const ymd = `${get('year')}-${get('month')}-${get('day')}`;
  const h = Number(get('hour') || 0);
  const min = Number(get('minute') || 0);
  return { date: ymd, minutes: h * 60 + min };
}

/** Parse "3:30 PM" / "15:30" style labels. */
export function clockLabelToMinutes(label: string | null | undefined): number | null {
  const raw = String(label || '').trim();
  if (!raw || /^time\s*not\s*set$/i.test(raw)) return null;
  const m12 = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = parseInt(m12[2], 10);
    const ap = m12[3].toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h * 60 + min;
  }
  const m24 = raw.match(/^(\d{1,2}):(\d{2})/);
  if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
  return null;
}

function addDaysIso(dateIso: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!match) return dateIso;
  const stamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  return new Date(stamp).toISOString().slice(0, 10);
}

function isAtOrPastKolkata(dateIso: string, minutes: number, now: Date): boolean {
  const today = kolkataParts(now);
  if (today.date > dateIso) return true;
  if (today.date < dateIso) return false;
  return today.minutes >= minutes;
}

/**
 * Meeting slot + abandon buffer has passed (IST) — safe to ask for an outcome.
 * Missing time: assume hub day-end 8:00 PM + duration + buffer (documented).
 */
export function meetingEndedForOutcome(row: {
  meetingDate: string;
  meetingTime?: string | null;
  meetingStatus?: string | null;
  progress?: string | null;
  startedAt?: string | Date | null;
  endedAt?: string | Date | null;
  meetingDateRaw?: string | Date | null;
}, now = new Date()): boolean {
  const status = String(row.meetingStatus || '').toLowerCase();
  if (status === 'cancelled') return false;

  const progress = String(row.progress || 'scheduled').toLowerCase();
  if (progress === 'completed' || progress === 'meeting_never_happened' || progress === 'meeting_abandoned') {
    return false;
  }

  if (row.endedAt) {
    const end = row.endedAt instanceof Date ? row.endedAt : new Date(String(row.endedAt));
    return !Number.isNaN(end.getTime()) && end.getTime() <= now.getTime();
  }

  let dateIso = String(row.meetingDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso) && row.meetingDateRaw) {
    const d = row.meetingDateRaw instanceof Date ? row.meetingDateRaw : new Date(String(row.meetingDateRaw));
    if (!Number.isNaN(d.getTime())) {
      dateIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;

  const today = kolkataParts(now);
  if (dateIso > today.date) return false;

  const startMin = clockLabelToMinutes(row.meetingTime);
  const durationMin = startMin == null ? HUB_MEETING_DURATION_MIN : HUB_MEETING_DURATION_MIN;
  const endMin = (startMin == null ? 20 * 60 : startMin) + durationMin;
  let abandonDate = dateIso;
  let abandonMin = endMin + MEETING_ABANDON_BUFFER_MIN;
  while (abandonMin >= 24 * 60) {
    abandonMin -= 24 * 60;
    abandonDate = addDaysIso(abandonDate, 1);
  }

  if (row.startedAt) {
    return isAtOrPastKolkata(abandonDate, abandonMin, now);
  }

  return isAtOrPastKolkata(abandonDate, abandonMin, now);
}

export function daysSinceMeetingEnd(
  row: { meetingDate: string; meetingTime?: string | null },
  now = new Date()
): number {
  const dateIso = String(row.meetingDate || '').slice(0, 10);
  const startMin = clockLabelToMinutes(row.meetingTime);
  const endMin = (startMin == null ? 20 * 60 : startMin) + HUB_MEETING_DURATION_MIN;
  const endDate = dateIso;
  const msPerDay = 86400000;
  const today = kolkataParts(now);
  const todayMs = Date.parse(`${today.date}T00:00:00+05:30`);
  const endMs = Date.parse(`${endDate}T00:00:00+05:30`) + endMin * 60 * 1000;
  return Math.max(0, Math.floor((todayMs - endMs) / msPerDay));
}

export function formatMeetingAgo(days: number): string {
  if (days <= 0) return 'Ended today';
  if (days === 1) return 'Ended yesterday';
  return `Ended ${days}d ago`;
}

export function ageBucket(days: number): '0-3' | '4-14' | '15-30' | '31+' {
  if (days <= 3) return '0-3';
  if (days <= 14) return '4-14';
  if (days <= 30) return '15-30';
  return '31+';
}