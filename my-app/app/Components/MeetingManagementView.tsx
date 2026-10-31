'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { buildAuthHeaders, getApiBase } from '../lib/apiBase';
import { BRANCH_LOCATIONS, resolveBranchCode } from '../constants/branches';
import CustomSelect from './ui/CustomSelect';
import MeetingSlotPickerModal from '../Leads/[id]/components/popups/MeetingSlotPickerModal';
import { MeetingWizSessionOverlay } from './MeetingWiz/MeetingWizSessionOverlay';
import type { LeadshipTypes } from './Types/Types';
import {
  canShowEndMeetingForBoardMeeting,
  canShowStartMeetingForBoardMeeting,
  getBoardStartMeetingBlockReason,
} from '../lib/leadMeetingSchedule';
import {
  formatHubTimeRange,
  HUB_MEETING_DURATION_MIN,
  HUB_MEETING_TIMELINE_END_MIN,
  HUB_MEETING_TIMELINE_START_MIN,
  hubMeetingDurationForStart,
  minutesToHubTime24,
} from '../../lib/hub-meeting-schedule';
import styles from './meetingManagement.module.css';
import { statusNoteFileProblem } from '../lib/statusNoteFiles';

/** Designer sees their own meetings. Design manager and TDM see the people under them. Admin sees everyone. */
export function canShowMeetingManagement(role: string | undefined | null): boolean {
  const value = (role || '').toLowerCase();
  return value === 'admin' || value === 'designer' || value === 'design_manager' || value === 'territorial_design_manager';
}

type ScheduledMeeting = {
  id?: number;
  leadId: number;
  projectId: string | null;
  projectName: string | null;
  projectStage: string | null;
  isOnHold: boolean;
  customerName: string;
  phone: string | null;
  salesName: string | null;
  quotationTotal: string | null;
  budget?: string | null;
  designerName: string;
  branchName?: string | null;
  meetingDate: string;
  meetingTime: string | null;
  meetingTimeLabel: string | null;
  meetingType: string | null;
  meetingMode: string | null;
  meetingStatus?: string | null;
  progress?: string | null;
  source?: string | null;
  cancelReason?: string | null;
  cancelFiles?: { id: number; name: string; mimeType?: string | null }[] | null;
  reason?: string | null;
  endedAt?: string | null;
  quoteSent?: boolean;
  quoteFinalAmount?: string | null;
  rescheduleCount?: number | null;
  personalKey?: string | null;
  personalKind?: 'block' | 'full_day' | null;
  personalReason?: string | null;
  personalApproval?: 'active' | 'pending' | 'approved' | 'cancelled' | 'expired' | null;
  meetingEndTime?: string | null;
};

type MeetingMode = 'online' | 'offline';
type ClientMeetingType = 'pre_10' | 'dqc1_first_cut' | 'dqc2_material_selection' | 'design_signoff';
type TypeFilter = 'all' | ClientMeetingType;
type Venue = 'Showroom visit' | 'Virtual meeting' | 'Site visit';
type ViewStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'abandoned';
type StatusKey = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'abandoned';
type DatePreset = 'all' | 'month' | '3m' | '6m' | '1y' | 'prev' | 'custom';
type PersonalKindFilter = 'all' | 'block' | 'full_day';

type ViewMeeting = {
  key: string;
  raw: ScheduledMeeting;
  id?: number;
  leadId: number;
  customer: string;
  phone: string | null;
  designer: string;
  sales: string;
  branchKey: string;
  branchLabel: string;
  venue: string;
  kind: string;
  typeKey: ClientMeetingType | null;
  mode: MeetingMode;
  start: string;
  day: string;
  minutes: number | null;
  status: ViewStatus;
  quote: number | null;
  quoteSent: boolean;
  endedAt: string | null;
  personal: boolean;
  personalKind: 'block' | 'full_day' | null;
  personalReason: string;
  personalApproval: string | null;
  endMinutes: number | null;
  overlapsClient: boolean;
  insideLeave: boolean;
  rescheduleCount?: number;
};

const AVATARS = [
  { bg: '#F8E4E4', fg: '#9A3B3B' },
  { bg: '#E5F4EF', fg: '#138A6B' },
  { bg: '#F3E6DA', fg: '#8A5230' },
  { bg: '#E7EEF6', fg: '#3D5A80' },
  { bg: '#F8EFD6', fg: '#8A6A1F' },
  { bg: '#EEE7F6', fg: '#5C4A86' },
];

const STATUS_LABEL: Record<ViewStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Successful',
  cancelled: 'Cancelled',
  abandoned: 'Meeting abandoned',
};

const STEP_LABELS = ['Scheduled', 'In progress', 'Successful'] as const;
const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pre_10', label: 'Pre 10%' },
  { id: 'dqc1_first_cut', label: 'First cut' },
  { id: 'dqc2_material_selection', label: 'Material selection' },
  { id: 'design_signoff', label: 'Design sign off' },
];
const TYPE_LABEL: Record<ClientMeetingType, string> = {
  pre_10: 'Pre 10%',
  dqc1_first_cut: 'First cut',
  dqc2_material_selection: 'Material selection',
  design_signoff: 'Design sign off',
};
const GRID_START_HOUR = HUB_MEETING_TIMELINE_START_MIN / 60;
const GRID_LAST_HOUR = Math.floor((HUB_MEETING_TIMELINE_END_MIN - HUB_MEETING_DURATION_MIN) / 60);
const HOURS = Array.from({ length: GRID_LAST_HOUR - GRID_START_HOUR + 1 }, (_, index) => GRID_START_HOUR + index);
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PAGE_SIZE = 10;
const QUOTE_DELAY_MS = 4 * 60 * 60 * 1000;

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
  { id: '3m', label: 'Last 3 months' },
  { id: '6m', label: 'Last 6 months' },
  { id: '1y', label: 'Last 1 year' },
  { id: 'prev', label: 'Previous month' },
  { id: 'custom', label: 'Custom range' },
];

function kolkataTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function kolkataMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  let hour = pick('hour');
  if (hour === 24) hour = 0;
  return hour * 60 + pick('minute');
}

function addDaysIso(isoDay: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay);
  if (!match) return isoDay;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

function addMonthsIso(isoDay: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay);
  if (!match) return isoDay;
  const target = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(Number(match[3]), last);
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day)).toISOString().slice(0, 10);
}

function startOfWeek(isoDay: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay);
  if (!match) return isoDay;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const weekday = date.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDaysIso(isoDay, diff);
}

function previousMonthBounds(today: string): { from: string; to: string } {
  const to = addDaysIso(`${today.slice(0, 7)}-01`, -1);
  return { from: `${to.slice(0, 7)}-01`, to };
}

function monthBounds(monthKey: string): { from: string; to: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const last = new Date(Date.UTC(Number(match[1]), month, 0)).getUTCDate();
  return {
    from: `${match[1]}-${match[2]}-01`,
    to: `${match[1]}-${match[2]}-${String(last).padStart(2, '0')}`,
  };
}

function dateBounds(
  preset: DatePreset,
  from: string,
  to: string,
  today: string,
  monthKey: string,
): { from: string; to: string } | null {
  if (preset === 'all') return null;
  if (preset === 'month') return monthBounds(monthKey) || monthBounds(today.slice(0, 7));
  if (preset === '3m') return { from: addMonthsIso(today, -3), to: today };
  if (preset === '6m') return { from: addMonthsIso(today, -6), to: today };
  if (preset === '1y') return { from: addMonthsIso(today, -12), to: today };
  if (preset === 'prev') return previousMonthBounds(today);
  if (preset === 'custom' && from && to) return from <= to ? { from, to } : { from: to, to: from };
  return null;
}

function parseMinutes(label: string | null | undefined, time?: string | null | undefined): number | null {
  const raw = `${label || ''} ${time || ''}`.trim();
  if (!raw) return null;
  const ampm = raw.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
  if (ampm) {
    let hour = Number(ampm[1]) % 12;
    if (ampm[3].toLowerCase() === 'pm') hour += 12;
    return hour * 60 + Number(ampm[2]);
  }
  const hm = raw.match(/(\d{1,2}):(\d{2})/);
  if (!hm) return null;
  const hour = Number(hm[1]);
  const minute = Number(hm[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Week rows follow the hub day: 10:00 AM through the last 90-minute start. */
function gridHour(minutes: number | null): number | null {
  if (minutes == null || minutes < HUB_MEETING_TIMELINE_START_MIN || minutes >= HUB_MEETING_TIMELINE_END_MIN) return null;
  const hour = Math.floor(minutes / 60);
  if (hour < GRID_START_HOUR || hour > GRID_LAST_HOUR) return null;
  return hour;
}

function slotRangeLabel(startMin: number): string {
  return formatHubTimeRange(startMin, startMin + hubMeetingDurationForStart(startMin));
}

function toStartIso(day: string, minutes: number | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return new Date(0).toISOString();
  const mins = minutes ?? 0;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Math.floor(mins / 60), mins % 60);
  return new Date(utc - 5.5 * 60 * 60 * 1000).toISOString();
}

function formatClock(minutes: number | null): string {
  if (minutes == null) return 'Time not set';
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  let hour = hour24 % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h} ${suffix}`;
}

function dayHeading(day: string, today: string): string {
  if (day === today) return 'Today';
  if (day === addDaysIso(today, 1)) return 'Tomorrow';
  if (day === addDaysIso(today, -1)) return 'Yesterday';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return day;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(date);
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(date);
  return `${weekday}, ${Number(match[3])} ${month}`;
}

function formatFullDate(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return day;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function prettyDay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(date);
  return `${Number(match[3])} ${month} ${match[1]}`;
}

function weekdayShort(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(date);
}

function monthAbbrev(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(date);
}

function monthTitle(cursor: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(cursor);
  if (!match) return cursor;
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)),
  );
}

function weekTitle(days: string[]): string {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(days[0] || '');
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(days[6] || '');
  if (!a || !b) return '';
  const aDate = new Date(Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3])));
  const bDate = new Date(Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3])));
  const aMon = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(aDate);
  const bMon = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(bDate);
  if (a[1] === b[1] && aMon === bMon) return `${Number(a[3])} – ${Number(b[3])} ${bMon} ${b[1]}`;
  if (a[1] === b[1]) return `${Number(a[3])} ${aMon} – ${Number(b[3])} ${bMon} ${b[1]}`;
  return `${Number(a[3])} ${aMon} ${a[1]} – ${Number(b[3])} ${bMon} ${b[1]}`;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function meetingEndedMs(meeting: { endedAt: string | null; day: string; minutes: number | null }): number | null {
  if (meeting.endedAt) {
    const ended = Date.parse(meeting.endedAt);
    if (Number.isFinite(ended)) return ended;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(meeting.day);
  if (!match) return null;
  const mins = meeting.minutes ?? 0;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Math.floor(mins / 60), mins % 60);
  return utc - 5.5 * 60 * 60 * 1000;
}

/** Successful meeting whose quote is still not shared to CRM 4 hours later. */
function isQuoteDelayed(meeting: ViewMeeting, nowMs: number): boolean {
  if (meeting.personal || meeting.status !== 'completed' || meeting.quoteSent) return false;
  const ended = meetingEndedMs(meeting);
  if (ended == null) return false;
  return nowMs - ended >= QUOTE_DELAY_MS;
}

function mapQuote(raw: string | null): number | null {
  if (!raw) return null;
  const numeric = Number(String(raw).replace(/,/g, '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

/** Same buckets the meetings are stored in: Pre 10%, First cut, Material selection, Design sign off. */
function clientMeetingType(meeting: ScheduledMeeting): ClientMeetingType | null {
  if ((meeting.source || '').toLowerCase() === 'personal') return null;
  if ((meeting.source || '').toLowerCase() === 'crm') return 'pre_10';
  const key = (meeting.meetingType || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!key || key === 'design meeting') return null;
  if (key === 'pre 10' || key === 'pre10' || key === 'crm appointment') return 'pre_10';
  if (key.includes('first cut') || key.includes('firstcut') || /first.*cut/.test(key)) return 'dqc1_first_cut';
  if (key.includes('material')) return 'dqc2_material_selection';
  if (key.includes('signoff') || key.includes('sign off')) return 'design_signoff';
  return null;
}

function meetingKindLabel(meeting: ScheduledMeeting): string {
  if ((meeting.source || '').toLowerCase() === 'personal') {
    const leave = meeting.personalKind === 'full_day' || (meeting.meetingType || '').includes('full_day');
    if (!leave) return 'Personal';
    if (meeting.personalApproval === 'pending') return 'Leave pending';
    if (meeting.personalApproval === 'expired') return 'Leave expired';
    if (meeting.personalApproval === 'cancelled') return 'Leave cancelled';
    return 'Full-day leave';
  }
  const type = clientMeetingType(meeting);
  if (type) return TYPE_LABEL[type];
  const raw = (meeting.meetingType || '').trim();
  return raw ? raw.replace(/[_-]+/g, ' ') : '—';
}

function mapChannel(meeting: ScheduledMeeting): { venue: Venue; mode: MeetingMode } {
  const blob = `${meeting.meetingMode || ''} ${meeting.meetingType || ''}`.toLowerCase();
  if (blob.includes('site')) return { venue: 'Site visit', mode: 'offline' };
  if (blob.includes('online') || blob.includes('virtual')) return { venue: 'Virtual meeting', mode: 'online' };
  return { venue: 'Showroom visit', mode: 'offline' };
}

function mapStatus(meeting: ScheduledMeeting): ViewStatus {
  const meetingStatus = (meeting.meetingStatus || '').toLowerCase();
  const progress = (meeting.progress || '').toLowerCase();
  if (meetingStatus === 'cancelled' || progress === 'cancelled') return 'cancelled';
  if (progress === 'completed') return 'completed';
  if (progress === 'in_progress') return 'in_progress';
  if (progress === 'meeting_abandoned') return 'abandoned';
  return 'scheduled';
}

/** Maps a scheduled-meetings API row onto the page's view model. */
function toViewMeeting(meeting: ScheduledMeeting, index: number): ViewMeeting | null {
  const day = String(meeting.meetingDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const personal = (meeting.source || '').toLowerCase() === 'personal';
  const personalKind: 'block' | 'full_day' | null = personal
    ? meeting.personalKind === 'full_day' || (meeting.meetingType || '').includes('full_day')
      ? 'full_day'
      : 'block'
    : null;
  const minutes = parseMinutes(meeting.meetingTime, meeting.meetingTimeLabel);
  const endMinutes = parseMinutes(meeting.meetingEndTime, null);
  const channel = mapChannel(meeting);
  const designer = (meeting.designerName || '').trim();
  const sales = (meeting.salesName || '').trim();
  const branch = branchOf(meeting.branchName);
  const reason = (meeting.personalReason || '').trim();
  return {
    key: meeting.personalKey
      ? `personal-${meeting.personalKey}`
      : meeting.id != null
        ? `id-${meeting.id}`
        : `na-${meeting.leadId}-${day}-${meeting.meetingTime || ''}-${index}`,
    raw: meeting,
    id: personal ? undefined : meeting.id,
    leadId: meeting.leadId,
    customer: meeting.customerName || meeting.projectName || (personal ? 'Personal time' : 'Customer'),
    phone: personal ? null : meeting.phone,
    designer,
    sales,
    branchKey: branch.key,
    branchLabel: branch.label,
    venue: personal
      ? personalKind === 'full_day'
        ? reason || 'Full day'
        : meeting.meetingEndTime
          ? `Until ${meeting.meetingEndTime}`
          : 'Personal time'
      : channel.venue,
    kind: meetingKindLabel(meeting),
    typeKey: clientMeetingType(meeting),
    mode: channel.mode,
    start: toStartIso(day, minutes),
    day,
    minutes,
    status: mapStatus(meeting),
    quote: personal ? null : mapQuote(meeting.quoteFinalAmount || meeting.quotationTotal || null),
    quoteSent: !personal && meeting.quoteSent === true,
    endedAt: personal ? null : meeting.endedAt || null,
    personal,
    personalKind,
    personalReason: reason,
    personalApproval: meeting.personalApproval || null,
    endMinutes: endMinutes != null && minutes != null && endMinutes > minutes ? endMinutes : null,
    overlapsClient: false,
    insideLeave: false,
    rescheduleCount: Number(meeting.rescheduleCount || 0),
  };
}

function markOverlaps(rows: ViewMeeting[]): ViewMeeting[] {
  const clients = rows.filter((row) => !row.personal && row.status !== 'cancelled' && row.status !== 'abandoned');
  const leaveDays = new Set(
    rows
      .filter((row) => row.personal && row.personalKind === 'full_day' && row.status !== 'cancelled')
      .map((row) => `${row.designer.trim().toLowerCase()}|${row.day}`),
  );
  return rows.map((row) => {
    if (!row.personal || row.status === 'cancelled') return row;
    const designerKey = row.designer.trim().toLowerCase();
    const overlapsClient = clients.some((client) => {
      if (client.designer.trim().toLowerCase() !== designerKey || client.day !== row.day) return false;
      if (row.personalKind === 'full_day') return true;
      if (row.minutes == null || client.minutes == null) return false;
      const rowEnd = row.endMinutes ?? row.minutes + 30;
      return row.minutes < client.minutes + hubMeetingDurationForStart(client.minutes) && rowEnd > client.minutes;
    });
    const insideLeave = row.personalKind === 'block' && leaveDays.has(`${designerKey}|${row.day}`);
    if (!overlapsClient && !insideLeave) return row;
    return { ...row, overlapsClient, insideLeave };
  });
}

function approvalLabel(value: string | null): string {
  if (value === 'pending') return 'Pending approval';
  if (value === 'approved') return 'Approved';
  if (value === 'expired') return 'Expired';
  if (value === 'cancelled') return 'Cancelled';
  return 'Booked';
}

function personLabel(name: string): string {
  const text = name.trim();
  if (!text || text.toLowerCase() === 'unassigned') return '—';
  return text;
}

function uniqueNames(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const text = value.trim();
    if (!text || text.toLowerCase() === 'unassigned') continue;
    const key = text.toLocaleLowerCase();
    if (!seen.has(key)) seen.set(key, text);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Prefer the live visit when the same Pre 10% lead has duplicate rows for one day. */
const PRE10_STATUS_RANK: Record<ViewStatus, number> = {
  in_progress: 5,
  scheduled: 4,
  completed: 3,
  abandoned: 2,
  cancelled: 1,
};

function isPre10Meeting(meeting: ViewMeeting): boolean {
  if (meeting.personal) return false;
  if (meeting.typeKey === 'pre_10') return true;
  if ((meeting.raw.source || '').toLowerCase() === 'crm') return true;
  // Legacy CRM/import rows sometimes stored type as "design meeting" instead of pre_10.
  const type = (meeting.raw.meetingType || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  return type === 'design meeting';
}

function preferPre10Meeting(a: ViewMeeting, b: ViewMeeting): ViewMeeting {
  const rankDiff = PRE10_STATUS_RANK[a.status] - PRE10_STATUS_RANK[b.status];
  if (rankDiff !== 0) return rankDiff > 0 ? a : b;
  const aTimed = a.minutes != null ? 1 : 0;
  const bTimed = b.minutes != null ? 1 : 0;
  if (aTimed !== bTimed) return aTimed > bTimed ? a : b;
  const aId = a.id ?? 0;
  const bId = b.id ?? 0;
  if (aId !== bId) return aId > bId ? a : b;
  return a.key >= b.key ? a : b;
}

/**
 * Same lead can get more than one Pre 10% row for the same day (CRM sync / reschedule leftovers).
 * Keep one row per lead+day for the board and totals. Other meeting types are unchanged.
 */
function dedupePre10Meetings(rows: ViewMeeting[]): ViewMeeting[] {
  const bestByLeadDay = new Map<string, ViewMeeting>();
  const dropKeys = new Set<string>();

  for (const meeting of rows) {
    if (!isPre10Meeting(meeting) || meeting.leadId <= 0) continue;
    const groupKey = `${meeting.leadId}|${meeting.day}`;
    const current = bestByLeadDay.get(groupKey);
    if (!current) {
      bestByLeadDay.set(groupKey, meeting);
      continue;
    }
    const preferred = preferPre10Meeting(current, meeting);
    const dropped = preferred.key === current.key ? meeting : current;
    bestByLeadDay.set(groupKey, preferred);
    dropKeys.add(dropped.key);
  }

  if (dropKeys.size === 0) return rows;
  return rows.filter((meeting) => !dropKeys.has(meeting.key));
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

function branchOf(raw: string | null | undefined): { key: string; label: string } {
  const text = (raw || '').trim();
  const code = resolveBranchCode(text);
  if (code) {
    return { key: code, label: BRANCH_LOCATIONS[code].label };
  }
  const generic = !text || text.toLowerCase() === 'experience center' || text.toLowerCase() === 'experience centre';
  if (generic) return { key: '', label: '' };
  return { key: text.toLocaleLowerCase(), label: text };
}

function compareMeetings(a: ViewMeeting, b: ViewMeeting, dir: 1 | -1): number {
  if (a.day !== b.day) return a.day < b.day ? -dir : dir;
  if (a.minutes == null && b.minutes == null) return a.key < b.key ? -1 : 1;
  if (a.minutes == null) return 1;
  if (b.minutes == null) return -1;
  if (a.minutes !== b.minutes) return a.minutes < b.minutes ? -dir : dir;
  return a.key < b.key ? -1 : 1;
}

function orderMeetings(rows: ViewMeeting[], today: string): ViewMeeting[] {
  const upcoming = rows.filter((meeting) => meeting.day >= today).sort((a, b) => compareMeetings(a, b, 1));
  const past = rows.filter((meeting) => meeting.day < today).sort((a, b) => compareMeetings(a, b, -1));
  return [...upcoming, ...past];
}

function groupDays(rows: ViewMeeting[]): { day: string; meetings: ViewMeeting[] }[] {
  const groups: { day: string; meetings: ViewMeeting[] }[] = [];
  for (const meeting of rows) {
    const last = groups[groups.length - 1];
    if (!last || last.day !== meeting.day) groups.push({ day: meeting.day, meetings: [meeting] });
    else last.meetings.push(meeting);
  }
  return groups;
}

type DaySlice = { day: string; meetings: ViewMeeting[]; continued: boolean };
type MeetingPage = { kind: 'today' | 'rest'; slices: DaySlice[] };

function chunkMeetings(rows: ViewMeeting[], pageSize: number): MeetingPage[] {
  const pages: MeetingPage[] = [];
  for (let offset = 0; offset < rows.length; offset += pageSize) {
    const slice = rows.slice(offset, offset + pageSize);
    pages.push({
      kind: 'rest',
      slices: groupDays(slice).map((group, index) => ({
        day: group.day,
        meetings: group.meetings,
        continued: index === 0 && offset > 0 && rows[offset - 1]?.day === group.day,
      })),
    });
  }
  return pages;
}

function buildMeetingPages(rows: ViewMeeting[], today: string, pageSize: number): MeetingPage[] {
  const todayRows = rows.filter((meeting) => meeting.day === today);
  // A short today list used to sit alone (2 or 4 rows). Fill that page to
  // pageSize with the next days — tomorrow first — so the list always shows
  // a full page when more meetings exist.
  if (todayRows.length > 0 && todayRows.length < pageSize) {
    return chunkMeetings(rows, pageSize);
  }
  const rest = rows.filter((meeting) => meeting.day !== today);
  const pages: MeetingPage[] = [];
  if (todayRows.length > 0) {
    pages.push({
      kind: 'today',
      slices: groupDays(todayRows).map((group) => ({ day: group.day, meetings: group.meetings, continued: false })),
    });
  }
  pages.push(...chunkMeetings(rest, pageSize));
  return pages;
}

function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);
  const items: (number | 'gap')[] = [0];
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);
  if (start > 1) items.push('gap');
  for (let index = start; index <= end; index += 1) items.push(index);
  if (end < total - 2) items.push('gap');
  items.push(total - 1);
  return items;
}

function canManageMeeting(meeting: ScheduledMeeting): boolean {
  if (!meeting.id) return false;
  if ((meeting.meetingStatus || '').toLowerCase() === 'cancelled') return false;
  if ((meeting.progress || '').toLowerCase() === 'completed') return false;
  return true;
}

function ownSlotLabel(meeting: ScheduledMeeting): string {
  const label = String(meeting.meetingTimeLabel || meeting.meetingTime || '').trim();
  const clocks = label.match(/\d{1,2}:\d{2}/g) || [];
  if (clocks.length >= 2) return label;
  const mins = parseMinutes(meeting.meetingTime, meeting.meetingTimeLabel);
  if (mins == null) return 'Time not set';
  return slotRangeLabel(mins);
}

function slotHasPassed(meeting: ViewMeeting, today: string, nowMinutes: number): boolean {
  if (meeting.day < today) return true;
  if (meeting.day > today) return false;
  if (meeting.minutes == null) return false;
  return meeting.minutes <= nowMinutes;
}

function canAct(meeting: ViewMeeting, today: string, nowMinutes: number): boolean {
  if (meeting.personal) return false;
  if (slotHasPassed(meeting, today, nowMinutes)) return false;
  if (meeting.status !== 'scheduled' && meeting.status !== 'in_progress') return false;
  if ((meeting.raw.source || '').toLowerCase() === 'crm') return false;
  return canManageMeeting(meeting.raw);
}

function clockToMinutes(value: string | null | undefined): number | null {
  const match = String(value || '').trim().match(/(\d{1,2}):(\d{2})\s*([ap]m)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const mer = (match[3] || '').toLowerCase();
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59 || hour > 23) return null;
  if (mer === 'pm' && hour < 12) hour += 12;
  if (mer === 'am' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function rescheduleProblem(date: string, time: string, currentDate: string, currentTime: string | null): string | null {
  if (!date || !time) return 'Choose the new date and time.';
  const mins = clockToMinutes(time);
  if (mins == null) return 'Choose a valid time.';
  const today = kolkataTodayIso();
  if (date < today || (date === today && mins <= kolkataMinutes())) {
    return 'Pick a date and time that is still ahead.';
  }
  const currentMins = clockToMinutes(currentTime);
  if (date === currentDate && currentMins != null && mins === currentMins) {
    return 'Pick a different date or time.';
  }
  return null;
}

function avatarFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % AVATARS.length;
  return AVATARS[hash];
}

function initial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const ch = Array.from(trimmed)[0] || '?';
  return ch.toLocaleUpperCase();
}

function Avatar({ name }: { name: string }) {
  const tone = avatarFor(name);
  return (
    <span className={styles.avatar} style={{ background: tone.bg, color: tone.fg }} aria-hidden>
      {initial(name)}
    </span>
  );
}

function StatusPill({ status, meeting }: { status: ViewStatus; meeting?: ViewMeeting }) {
  let label = STATUS_LABEL[status];
  let pillStatus: string = status;
  if (meeting && (meeting.raw.source === 'crm' || meeting.typeKey === 'pre_10')) {
    if (status === 'cancelled') {
      label = 'Meeting Cancelled';
      pillStatus = 'cancelled';
    } else if (
      meeting.raw.meetingStatus === 'rescheduled' ||
      (meeting.rescheduleCount && meeting.rescheduleCount > 0)
    ) {
      const count = Math.max(1, meeting.rescheduleCount || 1);
      label = `Meeting Rescheduled ${count}`;
      pillStatus = 'rescheduled';
    } else if (status === 'scheduled') {
      label = 'Meeting Scheduled';
      pillStatus = 'scheduled';
    }
  }
  return (
    <span className={styles.pill} data-status={pillStatus}>
      {label}
    </span>
  );
}

function ModeTag({ mode }: { mode: MeetingMode }) {
  return (
    <span className={styles.modeTag} data-mode={mode}>
      {mode === 'online' ? 'Online' : 'Offline'}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden>
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.48 9.74l3.14 3.14a.75.75 0 1 0 1.06-1.06l-3.14-3.14A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className={styles.rot} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M16.4 10a6.4 6.4 0 1 1-1.7-4.3" strokeLinecap="round" />
      <path d="M16.6 3.4V6.6h-3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className={styles.chevron} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
    </svg>
  );
}

export default function MeetingManagementView() {
  const { sessionId } = useAuth();
  const apiBase = getApiBase();
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [personalWarning, setPersonalWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [viewDir, setViewDir] = useState<'next' | 'prev' | 'none'>('none');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [designerFilter, setDesignerFilter] = useState('');
  const [salesFilter, setSalesFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilters, setStatusFilters] = useState<StatusKey[]>([]);
  const [personalKind, setPersonalKind] = useState<PersonalKindFilter>('all');
  const [quoteOnly, setQuoteOnly] = useState(false);
  const [quoteDelayedOnly, setQuoteDelayedOnly] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState<DatePreset>('month');
  const [draftMonthKey, setDraftMonthKey] = useState('');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [liveExpanded, setLiveExpanded] = useState(false);
  const [selected, setSelected] = useState<ViewMeeting | null>(null);
  const [panelPhase, setPanelPhase] = useState<'in' | 'out' | null>(null);
  const [actionMeeting, setActionMeeting] = useState<ScheduledMeeting | null>(null);
  const [actionKind, setActionKind] = useState<'reschedule' | 'cancel' | null>(null);
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [cancelFiles, setCancelFiles] = useState<File[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStep, setActionStep] = useState<'details' | 'form' | 'confirm'>('details');
  const [nextStartMin, setNextStartMin] = useState<number | null>(null);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [nowMinutes, setNowMinutes] = useState(kolkataMinutes);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const dateRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const followLiveMonth = useRef(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [today, setToday] = useState(kolkataTodayIso);
  const todayMonth = today.slice(0, 7);
  const [viewMonth, setViewMonth] = useState(todayMonth);
  const [panelLead, setPanelLead] = useState<LeadshipTypes | null>(null);
  const [panelHistory, setPanelHistory] = useState<Array<{
    taskName?: string;
    timestamp?: string;
    meta?: Record<string, unknown> | null;
  }> | null>(null);
  const [panelLeadLoading, setPanelLeadLoading] = useState(false);
  const [startMeetingBusy, setStartMeetingBusy] = useState(false);
  const [endMeetingBusy, setEndMeetingBusy] = useState(false);
  const [pre10ActionError, setPre10ActionError] = useState<string | null>(null);
  const [meetingWizOpen, setMeetingWizOpen] = useState(false);
  const [meetingWizLead, setMeetingWizLead] = useState<LeadshipTypes | null>(null);

  const loadMeetings = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/meetings/scheduled`, {
        headers: buildAuthHeaders(sessionId),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to load scheduled meetings');
      }
      setMeetings(Array.isArray(data?.meetings) ? data.meetings : []);
      setPersonalWarning(typeof data?.personalWarning === 'string' && data.personalWarning.trim() ? data.personalWarning : null);
    } catch (err) {
      setMeetings([]);
      setPersonalWarning(null);
      setError(err instanceof Error ? err.message : 'Failed to load scheduled meetings');
    } finally {
      setLoading(false);
    }
  }, [apiBase, sessionId]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    if (!selected || selected.personal || selected.typeKey !== 'pre_10' || !sessionId) {
      setPanelLead(null);
      setPanelHistory(null);
      setPanelLeadLoading(false);
      setPre10ActionError(null);
      return;
    }
    let cancelled = false;
    const leadId = selected.leadId;
    setPanelLeadLoading(true);
    setPre10ActionError(null);
    const headers = buildAuthHeaders(sessionId);
    Promise.all([
      fetch(`${apiBase}/api/leads/${leadId}`, { headers, credentials: 'include' }).then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || 'Could not load lead');
        return data as LeadshipTypes;
      }),
      fetch(`${apiBase}/api/leads/${leadId}/history`, { headers, credentials: 'include' }).then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) return [] as Array<{ taskName?: string; timestamp?: string; meta?: Record<string, unknown> | null }>;
        const events = Array.isArray(data)
          ? data
          : Array.isArray(data?.events)
            ? data.events
            : Array.isArray(data?.history)
              ? data.history
              : [];
        return events as Array<{ taskName?: string; timestamp?: string; meta?: Record<string, unknown> | null }>;
      }),
    ])
      .then(([lead, history]) => {
        if (cancelled) return;
        setPanelLead(lead);
        setPanelHistory(history);
      })
      .catch(() => {
        if (cancelled) return;
        setPanelLead(null);
        setPanelHistory(null);
      })
      .finally(() => {
        if (!cancelled) setPanelLeadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, selected?.key, selected?.leadId, selected?.personal, selected?.typeKey, sessionId]);

  const closeAction = () => {
    if (savingAction) return;
    setActionMeeting(null);
    setActionKind(null);
    setActionStep('details');
    setSlotPickerOpen(false);
    setActionReason('');
    setCancelFiles([]);
    setActionError(null);
  };

  const openAction = (kind: 'reschedule' | 'cancel', meeting: ScheduledMeeting) => {
    const mins = parseMinutes(meeting.meetingTime, meeting.meetingTimeLabel);
    setActionKind(kind);
    setActionMeeting(meeting);
    setActionStep('details');
    setNextDate(meeting.meetingDate || '');
    setNextStartMin(mins);
    setNextTime(mins == null ? '' : minutesToHubTime24(mins));
    setSlotPickerOpen(false);
    setActionReason('');
    setCancelFiles([]);
    setActionError(null);
  };

  const reviewAction = () => {
    if (!actionMeeting || !actionKind) return;
    const reason = actionReason.trim();
    if (!reason) {
      setActionError(actionKind === 'reschedule' ? 'A reschedule reason is required.' : 'A cancel reason is required.');
      return;
    }
    if (reason.length > 500) {
      setActionError('Reason must be 500 characters or less.');
      return;
    }
    if (actionKind === 'reschedule') {
      if (nextStartMin == null) {
        setActionError('Choose a time slot for this designer.');
        return;
      }
      const chosenTime = minutesToHubTime24(nextStartMin);
      setNextTime(chosenTime);
      const issue = rescheduleProblem(
        nextDate,
        chosenTime,
        actionMeeting.meetingDate,
        actionMeeting.meetingTimeLabel || actionMeeting.meetingTime,
      );
      setActionError(issue);
      if (issue) return;
    } else {
      const fileIssue = statusNoteFileProblem(cancelFiles);
      if (fileIssue) {
        setActionError(fileIssue);
        return;
      }
    }
    setActionError(null);
    setActionStep('confirm');
  };

  const submitAction = async () => {
    if (!sessionId || !actionMeeting?.id || !actionKind) return;
    setSavingAction(true);
    setActionError(null);
    try {
      const path = actionKind === 'reschedule' ? 'reschedule' : 'cancel';
      const cancelBody = new FormData();
      if (actionKind === 'cancel') {
        cancelBody.append('reason', actionReason.trim());
        cancelFiles.forEach((file) => cancelBody.append('files', file));
      }
      const res = await fetch(`${apiBase}/api/meetings/${actionMeeting.id}/${path}`, {
        method: 'POST',
        headers: actionKind === 'cancel'
          ? buildAuthHeaders(sessionId)
          : buildAuthHeaders(sessionId, { 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: actionKind === 'cancel'
          ? cancelBody
          : JSON.stringify({ meetingDate: nextDate, meetingTime: nextTime, reason: actionReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Could not update the meeting');
      setActionMeeting(null);
      setActionKind(null);
      await loadMeetings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the meeting');
    } finally {
      setSavingAction(false);
    }
  };

  const mapped = useMemo(
    () =>
      dedupePre10Meetings(
        markOverlaps(meetings.map(toViewMeeting).filter((meeting): meeting is ViewMeeting => meeting != null)),
      ),
    [meetings],
  );

  useEffect(() => {
    setSelected((current) => {
      if (!current) return current;
      return mapped.find((meeting) => meeting.key === current.key) ?? null;
    });
  }, [mapped]);

  const designers = useMemo(() => uniqueNames(mapped.map((meeting) => meeting.designer)), [mapped]);
  const salesPeople = useMemo(() => uniqueNames(mapped.map((meeting) => meeting.sales)), [mapped]);
  const designerOptions = useMemo(
    () => [{ value: '', label: 'All designers' }, ...designers.map((name) => ({ value: name, label: name }))],
    [designers],
  );
  const salesOptions = useMemo(
    () => [{ value: '', label: 'All sales' }, ...salesPeople.map((name) => ({ value: name, label: name }))],
    [salesPeople],
  );
  const branchOptions = useMemo(() => {
    const known = ['HBR', 'SJR', 'JPN'] as const;
    const extras = new Map<string, string>();
    for (const meeting of mapped) {
      if (!meeting.branchKey || (known as readonly string[]).includes(meeting.branchKey)) continue;
      extras.set(meeting.branchKey, meeting.branchLabel || meeting.branchKey);
    }
    return [
      { value: '', label: 'All branches' },
      ...known.map((code) => ({ value: code, label: BRANCH_LOCATIONS[code].label })),
      ...Array.from(extras, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    ];
  }, [mapped]);
  const statusChoices: { id: StatusKey; label: string }[] = [
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'completed', label: 'Successful' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'abandoned', label: 'Meeting abandoned' },
  ];
  const statusClosedLabel =
    statusFilters.length === 0
      ? 'All'
      : statusFilters.length === 1
        ? statusChoices.find((item) => item.id === statusFilters[0])?.label || 'Status'
        : `${statusFilters.length} selected`;

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = kolkataTodayIso();
      setToday((current) => (current === next ? current : next));
      setNowMinutes(kolkataMinutes());
      setNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!followLiveMonth.current) return;
    setViewMonth(todayMonth);
  }, [todayMonth]);

  const matchesClientFilters = useCallback((meeting: ViewMeeting, range: { from: string; to: string } | null) => {
    if (meeting.personal) return false;
    const q = query.trim().toLowerCase();
    if (typeFilter !== 'all' && meeting.typeKey !== typeFilter) return false;
    if (designerFilter && !sameName(meeting.designer, designerFilter)) return false;
    if (salesFilter && !sameName(meeting.sales, salesFilter)) return false;
    if (branchFilter && meeting.branchKey !== branchFilter) return false;
    if (range && (meeting.day < range.from || meeting.day > range.to)) return false;
    if (!q) return true;
    const haystack = [meeting.customer, meeting.phone || '', meeting.designer, meeting.sales, meeting.branchLabel, meeting.branchKey, String(meeting.leadId)]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  }, [query, typeFilter, designerFilter, salesFilter, branchFilter]);

  const matchesPersonalFilters = useCallback((meeting: ViewMeeting, range: { from: string; to: string } | null) => {
    if (!meeting.personal) return false;
    if (designerFilter && !sameName(meeting.designer, designerFilter)) return false;
    if (range && (meeting.day < range.from || meeting.day > range.to)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [meeting.customer, meeting.designer, meeting.personalReason, meeting.kind, meeting.branchLabel, 'personal', meeting.personalKind === 'full_day' ? 'leave' : 'block']
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  }, [query, designerFilter]);

  const activeRange = useMemo(
    () => dateBounds(datePreset, customFrom, customTo, today, viewMonth),
    [datePreset, customFrom, customTo, today, viewMonth],
  );

  const baseFiltered = useMemo(
    () => mapped.filter((meeting) => matchesClientFilters(meeting, activeRange)),
    [mapped, matchesClientFilters, activeRange],
  );

  const personalBase = useMemo(
    () => orderMeetings(mapped.filter((meeting) => matchesPersonalFilters(meeting, activeRange)), today),
    [mapped, matchesPersonalFilters, activeRange, today],
  );

  const focusMonth = datePreset === 'month'
    ? viewMonth
    : activeRange
      ? activeRange.from.slice(0, 7)
      : todayMonth;

  const matchesStatus = useCallback((meeting: ViewMeeting) => {
    if (statusFilters.length === 0) return true;
    return statusFilters.includes(meeting.status);
  }, [statusFilters]);

  const filtered = useMemo(() => {
    let rows = baseFiltered.filter(matchesStatus);
    if (quoteOnly) rows = rows.filter((meeting) => meeting.quoteSent);
    if (quoteDelayedOnly) rows = rows.filter((meeting) => isQuoteDelayed(meeting, nowMs));
    return orderMeetings(rows, today);
  }, [baseFiltered, matchesStatus, quoteOnly, quoteDelayedOnly, nowMs, today]);

  const calendarMeetings = filtered;

  const personalListed = useMemo(() => {
    const rows = personalKind === 'all' ? personalBase : personalBase.filter((meeting) => meeting.personalKind === personalKind);
    return rows.filter(matchesStatus);
  }, [personalBase, personalKind, matchesStatus]);

  const stats = useMemo(() => {
    let scheduled = 0;
    let scheduledToday = 0;
    let successful = 0;
    let cancelled = 0;
    let quotes = 0;
    let quoteDelayed = 0;
    for (const meeting of baseFiltered) {
      if (meeting.status === 'scheduled') {
        scheduled += 1;
        if (meeting.day === today) scheduledToday += 1;
      } else if (meeting.status === 'completed') successful += 1;
      else if (meeting.status === 'cancelled') cancelled += 1;
      if (meeting.quoteSent) quotes += 1;
      if (isQuoteDelayed(meeting, nowMs)) quoteDelayed += 1;
    }
    const pct = baseFiltered.length === 0 ? 0 : Math.round((cancelled / baseFiltered.length) * 100);
    return { scheduled, scheduledToday, successful, cancelled, pct, quotes, quoteDelayed };
  }, [baseFiltered, today, nowMs]);

  const inProgress = useMemo(
    () => filtered.filter((meeting) => meeting.status === 'in_progress').sort((a, b) => compareMeetings(a, b, 1)),
    [filtered],
  );

  useEffect(() => {
    setPage(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query, typeFilter, designerFilter, salesFilter, branchFilter, statusFilters, quoteOnly, quoteDelayedOnly, personalKind, datePreset, customFrom, customTo, viewMonth]);

  useEffect(() => {
    if (!dateOpen && !filterOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.custom-select-dropdown')) return;
      if (dateOpen && dateRef.current && !dateRef.current.contains(target)) setDateOpen(false);
      if (filterOpen && filterRef.current && !filterRef.current.contains(target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dateOpen, filterOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (actionMeeting) {
        if (savingAction) return;
        if (actionStep === 'confirm') {
          setActionStep('form');
          return;
        }
        closeAction();
        return;
      }
      if (filterOpen) {
        setFilterOpen(false);
        return;
      }
      if (dateOpen) {
        setDateOpen(false);
        return;
      }
      if (selected && panelPhase !== 'out') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actionMeeting, actionStep, dateOpen, filterOpen, selected, panelPhase, savingAction]);

  useEffect(() => {
    if (!selected) return;
    closeRef.current?.focus();
  }, [selected?.key]);

  const dateIsDefault = datePreset === 'month' && viewMonth === todayMonth;
  const filtersActive =
    query.trim() !== '' ||
    typeFilter !== 'all' ||
    designerFilter !== '' ||
    salesFilter !== '' ||
    branchFilter !== '' ||
    statusFilters.length > 0 ||
    personalKind !== 'all' ||
    quoteOnly ||
    quoteDelayedOnly ||
    !dateIsDefault;

  const showCurrentMonth = () => {
    followLiveMonth.current = true;
    setViewMonth(todayMonth);
    setDatePreset('month');
    setCustomFrom('');
    setCustomTo('');
    setDraftPreset('month');
    setDraftMonthKey(todayMonth);
    setDraftFrom('');
    setDraftTo('');
    setDateError(null);
    setDateOpen(false);
  };

  const showMonth = (isoDay: string) => {
    if (datePreset !== 'month') return;
    const key = isoDay.slice(0, 7);
    if (!monthBounds(key)) return;
    followLiveMonth.current = key === todayMonth;
    setViewMonth(key);
    setDatePreset('month');
    setCustomFrom('');
    setCustomTo('');
    setDraftPreset('month');
    setDraftMonthKey(key);
    setDraftFrom('');
    setDraftTo('');
    setDateError(null);
  };

  const clearAll = () => {
    setQuery('');
    setTypeFilter('all');
    setDesignerFilter('');
    setSalesFilter('');
    setBranchFilter('');
    setStatusFilters([]);
    setPersonalKind('all');
    setQuoteOnly(false);
    setQuoteDelayedOnly(false);
    showCurrentMonth();
  };

  const switchView = (next: 'list' | 'calendar') => {
    if (next === view) return;
    setViewDir(next === 'calendar' ? 'next' : 'prev');
    setFilterOpen(false);
    setDateOpen(false);
    setView(next);
  };

  const toggleStatus = (status: StatusKey) => {
    setStatusFilters((current) => (
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status]
    ));
  };

  const toggleQuotes = () => {
    setQuoteOnly((on) => !on);
    setQuoteDelayedOnly(false);
  };

  const toggleQuoteDelayed = () => {
    setQuoteDelayedOnly((on) => !on);
    setQuoteOnly(false);
  };

  const openDate = () => {
    setDraftPreset(datePreset);
    setDraftMonthKey(datePreset === 'month' ? viewMonth : '');
    setDraftFrom(customFrom);
    setDraftTo(customTo);
    setDateError(null);
    setDateOpen((open) => !open);
  };

  const applyDate = () => {
    if (draftPreset === 'custom') {
      if (!draftFrom || !draftTo) {
        setDateError('Choose a from and to date');
        return;
      }
      setCustomFrom(draftFrom <= draftTo ? draftFrom : draftTo);
      setCustomTo(draftFrom <= draftTo ? draftTo : draftFrom);
      followLiveMonth.current = false;
    } else if (draftPreset === 'month') {
      const key = draftMonthKey === todayMonth ? todayMonth : viewMonth;
      followLiveMonth.current = key === todayMonth;
      setViewMonth(key);
      setCustomFrom('');
      setCustomTo('');
    } else {
      followLiveMonth.current = false;
    }
    setDatePreset(draftPreset);
    setDateError(null);
    setDateOpen(false);
  };

  const clearDate = () => {
    showCurrentMonth();
  };

  const rangeNote = (() => {
    if (datePreset === 'month') return monthTitle(viewMonth);
    if (datePreset === 'prev') return monthTitle(previousMonthBounds(today).from);
    if (datePreset === 'custom' && customFrom && customTo) return `${prettyDay(customFrom)} – ${prettyDay(customTo)}`;
    return DATE_PRESETS.find((preset) => preset.id === datePreset)?.label || 'This month';
  })();

  const openMeeting = (meeting: ViewMeeting) => {
    setSelected(meeting);
    setPanelPhase('in');
  };

  const closePanel = () => {
    if (!selected || panelPhase === 'out') return;
    setPanelPhase('out');
  };

  useEffect(() => {
    if (panelPhase !== 'out') return;
    const id = window.setTimeout(() => {
      setSelected(null);
      setPanelPhase(null);
    }, 260);
    return () => window.clearTimeout(id);
  }, [panelPhase]);

  const pages = useMemo(() => buildMeetingPages(filtered, today, PAGE_SIZE), [filtered, today]);
  const pageCount = pages.length;
  const safePage = pageCount === 0 ? 0 : Math.min(page, pageCount - 1);
  const currentPage = pages[safePage];
  const pageGroups = currentPage?.slices ?? [];
  const listTotal = filtered.length;
  const shownBefore = pages.slice(0, safePage).reduce((total, entry) => (
    total + entry.slices.reduce((count, slice) => count + slice.meetings.length, 0)
  ), 0);
  const pageIsTodayOnly = !!currentPage
    && currentPage.slices.length > 0
    && currentPage.slices.every((slice) => slice.day === today);
  const shownOnPage = pageGroups.reduce((count, slice) => count + slice.meetings.length, 0);
  const goToPage = (next: number) => {
    setPage(next);
    if (listRef.current) listRef.current.scrollTop = 0;
  };
  const liveChips = liveExpanded ? inProgress : inProgress.slice(0, 4);
  const liveHidden = Math.max(0, inProgress.length - 4);

  const showPre10Start =
    !!selected &&
    !panelLeadLoading &&
    canShowStartMeetingForBoardMeeting(selected.raw, panelLead, panelHistory, today);
  const showPre10End = selected ? canShowEndMeetingForBoardMeeting(selected.raw) : false;
  const pre10StartBlock = selected
    ? getBoardStartMeetingBlockReason(selected.raw, panelLead, panelHistory, today, {
        loading: panelLeadLoading,
      })
    : null;

  const pre10StartBlockMessage = (() => {
    switch (pre10StartBlock) {
      case 'loading':
        return 'Checking Pre 10% dashboard rules for this visit…';
      case 'future':
        return 'Start meeting appears on the meeting day — same as the Pre 10% dashboard.';
      case 'past':
        return 'This Pre 10% slot has passed. Reschedule stays in CRM.';
      case 'not_today':
        return 'Start meeting is only for today’s Pre 10% visit.';
      case 'completed':
        return 'This Pre 10% meeting is already successful. Start returns after a newer schedule.';
      case 'abandoned':
        return 'This meeting was abandoned. Schedule a new Pre 10% visit to start again.';
      case 'cancelled':
        return 'This meeting is cancelled, so Start meeting stays hidden.';
      case 'phase_passed':
        return 'Lead is past Pre 10%, so Start meeting is locked — same as the Pre 10% dashboard.';
      case 'wiz_done':
        return 'Meeting wizard already completed for this schedule. Start returns after a newer reschedule.';
      case 'no_lead':
        return 'Could not load lead details to verify Start meeting rules.';
      case 'not_pre10':
        return null;
      default:
        return null;
    }
  })();

  const resolvePanelLead = async (): Promise<LeadshipTypes | null> => {
    if (panelLead) return panelLead;
    if (!selected?.leadId || !sessionId) return null;
    const res = await fetch(`${apiBase}/api/leads/${selected.leadId}`, {
      headers: buildAuthHeaders(sessionId),
      credentials: 'include',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return null;
    const lead = data as LeadshipTypes;
    setPanelLead(lead);
    return lead;
  };

  const openPre10StartMeeting = async () => {
    if (!selected || !sessionId || startMeetingBusy) return;
    setPre10ActionError(null);
    setStartMeetingBusy(true);
    try {
      const lead = await resolvePanelLead();
      if (!lead) {
        throw new Error('Lead details are needed to open the meeting.');
      }
      if (!canShowStartMeetingForBoardMeeting(selected.raw, lead, panelHistory, today)) {
        throw new Error('Start meeting is locked by the same Pre 10% dashboard rules.');
      }
      const meetingId = selected.id ?? selected.raw.id;
      if (meetingId != null) {
        const startRes = await fetch(`${apiBase}/api/meetings/${meetingId}/start`, {
          method: 'POST',
          headers: buildAuthHeaders(sessionId),
          credentials: 'include',
        });
        const startData = await startRes.json().catch(() => ({}));
        if (!startRes.ok) {
          throw new Error(startData?.message || 'Could not start this meeting.');
        }
      }
      // Same CRM kickoff the Pre 10% dashboard uses before opening the wizard.
      void fetch(`${apiBase}/api/leads/${selected.leadId}/crm-meeting/start`, {
        method: 'POST',
        headers: buildAuthHeaders(sessionId),
        credentials: 'include',
      }).catch(() => undefined);
      setMeetingWizLead(lead);
      setMeetingWizOpen(true);
      await loadMeetings();
      setSelected((prev) =>
        prev && prev.key === selected.key
          ? {
              ...prev,
              status: 'in_progress',
              raw: { ...prev.raw, progress: 'in_progress' },
            }
          : prev,
      );
    } catch (err) {
      setPre10ActionError(err instanceof Error ? err.message : 'Could not start meeting.');
    } finally {
      setStartMeetingBusy(false);
    }
  };

  const endPre10Meeting = async () => {
    if (!selected || !sessionId || endMeetingBusy) return;
    if (!canShowEndMeetingForBoardMeeting(selected.raw)) return;
    const meetingId = selected.id ?? selected.raw.id;
    if (meetingId == null) {
      setPre10ActionError('This meeting has no id to end.');
      return;
    }
    if (!window.confirm('End this Pre 10% meeting now? Mark it successful only when the visit is done.')) {
      return;
    }
    setPre10ActionError(null);
    setEndMeetingBusy(true);
    try {
      const res = await fetch(`${apiBase}/api/meetings/${meetingId}/end`, {
        method: 'POST',
        headers: buildAuthHeaders(sessionId),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Could not end this meeting.');
      }
      await loadMeetings();
      setSelected((prev) =>
        prev && prev.key === selected.key
          ? {
              ...prev,
              status: 'completed',
              raw: { ...prev.raw, progress: 'completed' },
            }
          : prev,
      );
    } catch (err) {
      setPre10ActionError(err instanceof Error ? err.message : 'Could not end meeting.');
    } finally {
      setEndMeetingBusy(false);
    }
  };

  return (
    <div className={styles.root}>
      <header className={styles.pageHead}>
          <div className={styles.titleBlock}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>Meeting management</h1>
              <span className={styles.monthChip}>{rangeNote}</span>
          </div>
            <p className={styles.subtitle}>India time · design and CRM meetings</p>
          </div>
        <div className={styles.headActions}>
          <div className={styles.dateWrap} ref={filterRef}>
              <button
                type="button"
              className={styles.rangeBtn}
              data-on={designerFilter !== '' || salesFilter !== '' || branchFilter !== ''}
              data-open={filterOpen}
              aria-expanded={filterOpen}
              aria-haspopup="dialog"
              onClick={() => setFilterOpen((open) => !open)}
            >
              <svg className={styles.rangeIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                <path d="M3 4.5h14l-5.2 6.1v4.2l-3.6 1.6V10.6L3 4.5Z" strokeLinejoin="round" />
              </svg>
              Filter
              <svg className={styles.rangeCaret} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
              </button>
            {filterOpen ? (
              <div className={`${styles.popover} ${styles.popoverEnd} ${styles.filterMenu}`} role="dialog" aria-label="Filter meetings">
                <div className={styles.filterFields}>
                  <label>
                    Designer
                    <CustomSelect value={designerFilter} onChange={setDesignerFilter} options={designerOptions} placeholder="All designers" buttonClassName={styles.filterSelect} />
                  </label>
                  <label>
                    Sales
                    <CustomSelect value={salesFilter} onChange={setSalesFilter} options={salesOptions} placeholder="All sales" buttonClassName={styles.filterSelect} />
                  </label>
                  <label>
                    Branch / EC
                    <CustomSelect value={branchFilter} onChange={setBranchFilter} options={branchOptions} placeholder="All branches" buttonClassName={styles.filterSelect} />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
          <div className={styles.dateWrap} ref={dateRef}>
              <button
                type="button"
                className={styles.rangeBtn}
                data-on={!dateIsDefault}
                data-open={dateOpen}
                aria-expanded={dateOpen}
                aria-haspopup="dialog"
                onClick={openDate}
              >
                <svg className={styles.rangeIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  <rect x="3" y="4.5" width="14" height="12" rx="2" />
                  <path d="M3 8h14M7 3.2v2.6M13 3.2v2.6" strokeLinecap="round" />
                </svg>
                Date range
                <svg className={styles.rangeCaret} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            {dateOpen ? (
              <div className={`${styles.popover} ${styles.popoverEnd} ${styles.dateMenu}`} role="dialog" aria-label="Date range">
                {DATE_PRESETS.map((preset) => (
            <button
                    key={preset.id}
              type="button"
                    className={styles.popOption}
                    data-on={preset.id === 'month' ? draftPreset === 'month' && draftMonthKey === todayMonth : draftPreset === preset.id}
                    onClick={() => {
                      setDraftPreset(preset.id);
                      if (preset.id === 'month') setDraftMonthKey(todayMonth);
                    }}
                  >
                    <i className={styles.popMark} aria-hidden="true" />
                    {preset.label}
            </button>
                ))}
                {draftPreset === 'custom' ? (
                  <div className={styles.popDates}>
                    <label>
                      From
                      <input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} />
                    </label>
                    <label>
                      To
                      <input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} />
                    </label>
          </div>
                ) : null}
                {dateError ? <p className={styles.popError}>{dateError}</p> : null}
                <div className={styles.menuActions}>
                  <button type="button" className={styles.menuClear} onClick={clearDate}>Clear</button>
                  <button type="button" className={styles.menuApply} onClick={applyDate}>Apply</button>
        </div>
              </div>
        ) : null}
          </div>
          <div className={styles.viewToggle} data-view={view} role="group" aria-label="Meeting view">
            <span className={styles.viewGlide} aria-hidden="true" />
            <button type="button" data-on={view === 'list'} onClick={() => switchView('list')}>
              List
            </button>
            <button type="button" data-on={view === 'calendar'} onClick={() => switchView('calendar')}>
                Calendar
              </button>
            </div>
        </div>
      </header>

      <section className={styles.stats} aria-label="Meeting totals">
        <button type="button" className={styles.stat} data-static="false" data-on={statusFilters.includes('scheduled')} aria-pressed={statusFilters.includes('scheduled')} onClick={() => toggleStatus('scheduled')}>
          <span className={styles.statLabel}>Scheduled</span>
          <span className={styles.statValue}>{loading ? '—' : stats.scheduled}</span>
          <span className={styles.statSub}>{loading ? '' : `${stats.scheduledToday} today`}</span>
        </button>
        <button type="button" className={styles.stat} data-static="false" data-on={statusFilters.includes('completed')} aria-pressed={statusFilters.includes('completed')} onClick={() => toggleStatus('completed')}>
          <span className={styles.statLabel}>Successful</span>
          <span className={styles.statValue}>{loading ? '—' : stats.successful}</span>
          <span className={styles.statSub}>{'\u00a0'}</span>
        </button>
        <button type="button" className={styles.stat} data-static="false" data-on={statusFilters.includes('cancelled')} aria-pressed={statusFilters.includes('cancelled')} onClick={() => toggleStatus('cancelled')}>
          <span className={styles.statLabel}>Cancelled</span>
          <span className={styles.statValue}>{loading ? '—' : stats.cancelled}</span>
          <span className={styles.statSub}>{loading ? '' : `${stats.pct}% of meetings`}</span>
        </button>
        <button type="button" className={styles.stat} data-static="false" data-on={quoteOnly} aria-pressed={quoteOnly} onClick={toggleQuotes}>
          <span className={styles.statLabel}>Quotes sent</span>
          <span className={styles.statValue}>{loading ? '—' : stats.quotes}</span>
          <span className={styles.statSub}>Shared to CRM</span>
        </button>
        <button type="button" className={styles.stat} data-static="false" data-on={quoteDelayedOnly} aria-pressed={quoteDelayedOnly} onClick={toggleQuoteDelayed}>
          <span className={styles.statLabel}>Quote delayed</span>
          <span className={styles.statValue}>{loading ? '—' : stats.quoteDelayed}</span>
          <span className={styles.statSub}>Still open after 4 hours</span>
        </button>
      </section>

      {inProgress.length > 0 ? (
        <div className={styles.live}>
          <span className={styles.liveLabel}>
            <span className={styles.pulse} aria-hidden />
            In progress
            </span>
          <div className={styles.liveChips}>
            {liveChips.map((meeting) => (
              <button key={meeting.key} type="button" className={styles.liveChip} data-personal={meeting.personal ? meeting.personalKind || 'block' : undefined} onClick={() => openMeeting(meeting)}>
                <span>{meeting.customer}</span>
                <span>{formatClock(meeting.minutes)}</span>
              </button>
            ))}
            {liveHidden > 0 ? (
                              <button
                                type="button"
                className={styles.liveChip}
                aria-expanded={liveExpanded}
                onClick={() => setLiveExpanded((open) => !open)}
                              >
                {liveExpanded ? 'Show less' : `+${liveHidden} more`}
                              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <div className={styles.err}>{error}</div> : null}

      <div key={view} className={styles.viewStage} data-dir={viewDir}>
      {view === 'list' ? (
      <>
      <section className={styles.card}>
        <div className={styles.tools}>
          <div className={styles.toolRow}>
            <label className={styles.search}>
              <span className={styles.sr}>Search meetings</span>
              <SearchIcon />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Customer, lead ID, designer, sales"
              />
            </label>
            <div
              className={`${styles.seg} ${styles.typeSeg} ${styles.statusSeg}`}
              data-open={statusOpen}
              role="group"
              aria-label="Meeting status"
              onMouseEnter={() => setStatusOpen(true)}
              onMouseLeave={() => setStatusOpen(false)}
              onFocus={() => setStatusOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setStatusOpen(false);
              }}
            >
              <button
                type="button"
                className={styles.statusClosed}
                data-on="true"
                data-closed-only="true"
                tabIndex={statusOpen ? -1 : 0}
                aria-label={`Status filter: ${statusClosedLabel}`}
                onClick={() => setStatusOpen(true)}
              >
                {statusClosedLabel}
              </button>
              <button
                type="button"
                data-on={statusFilters.length === 0}
                data-open-only="true"
                data-index={0}
                aria-pressed={statusFilters.length === 0}
                tabIndex={statusOpen ? 0 : -1}
                onClick={() => {
                  setStatusFilters([]);
                  window.setTimeout(() => setStatusOpen(false), 260);
                }}
              >
                All
              </button>
              {statusChoices.map((status, index) => (
                <button
                  key={status.id}
                  type="button"
                  data-on={statusFilters.includes(status.id)}
                  data-open-only="true"
                  data-index={index + 1}
                  aria-pressed={statusFilters.includes(status.id)}
                  tabIndex={statusOpen ? 0 : -1}
                  onClick={() => {
                    toggleStatus(status.id);
                    window.setTimeout(() => setStatusOpen(false), 260);
                  }}
                >
                  {status.label}
                </button>
              ))}
              <span className={styles.typeCaret} aria-hidden="true">▾</span>
            </div>
            <div
              className={`${styles.seg} ${styles.typeSeg}`}
              data-open={typeOpen}
              role="group"
              aria-label="Meeting type"
              onMouseEnter={() => setTypeOpen(true)}
              onMouseLeave={() => setTypeOpen(false)}
              onFocus={() => setTypeOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTypeOpen(false);
              }}
            >
              {TYPE_FILTERS.map((type, index) => (
                <button
                  key={type.id}
                  type="button"
                  data-on={typeFilter === type.id}
                  data-index={index}
                  aria-pressed={typeFilter === type.id}
                  tabIndex={typeOpen || typeFilter === type.id ? 0 : -1}
                  onClick={() => {
                    setTypeFilter(type.id);
                    window.setTimeout(() => setTypeOpen(false), 260);
                  }}
                >
                  {type.label}
                </button>
              ))}
              <span className={styles.typeCaret} aria-hidden="true">▾</span>
            </div>
                              <button
                                type="button"
              className={styles.iconBtn}
              data-loading={loading}
              aria-label="Refresh meetings"
              onClick={() => void loadMeetings()}
            >
              <RefreshIcon />
                              </button>
            <span className={styles.count} title={loading ? 'Loading meetings' : `${filtered.length.toLocaleString('en-IN')} of ${mapped.length.toLocaleString('en-IN')} meetings`}>
              {loading ? '…' : filtered.length.toLocaleString('en-IN')}
            </span>
            {filtersActive ? (
              <button type="button" className={styles.textBtn} onClick={clearAll}>Clear all</button>
                          ) : null}
                        </div>
        </div>

        {view === 'list' ? (
          loading && mapped.length === 0 ? (
            <div className={styles.empty}><p>Loading meetings…</p></div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <p>
                {mapped.length === 0
                  ? 'No meetings yet.'
                  : query.trim() || typeFilter !== 'all' || designerFilter || salesFilter || branchFilter || statusFilters.length > 0 || quoteOnly || quoteDelayedOnly || datePreset !== 'month'
                    ? 'No meetings match these filters.'
                    : 'No meetings in this month.'}
              </p>
              {filtersActive ? (
                <button type="button" className={styles.moreBtn} onClick={clearAll}>Clear all filters</button>
              ) : null}
            </div>
        ) : (
        <>
              <div className={styles.tableWrap} ref={listRef}>
                <table className={styles.table}>
                  <caption className={styles.sr}>Meetings</caption>
                  <thead>
                    <tr>
                      <th scope="col">Customer</th>
                      <th scope="col">Designer</th>
                      <th scope="col">Sales</th>
                      <th scope="col">Meeting</th>
                      <th scope="col">When</th>
                      <th scope="col">Status</th>
                      <th scope="col">Quote</th>
                      <th scope="col"><span className={styles.sr}>Open</span></th>
                    </tr>
            </thead>
            <tbody>
                    {pageGroups.map((group) => (
                      <GroupRows key={`${group.day}-${group.continued ? 'more' : 'start'}`} day={group.day} today={today} meetings={group.meetings} continued={group.continued} onOpen={openMeeting} />
                    ))}
            </tbody>
          </table>
        </div>
              <nav className={styles.pager} aria-label="Meeting pages">
                  <span className={styles.pagerMeta}>
                    {pageIsTodayOnly ? (
                      <>Today · {shownOnPage.toLocaleString('en-IN')}</>
                    ) : (
                      <>{listTotal === 0 ? 0 : shownBefore + 1}–{shownBefore + shownOnPage} of {listTotal.toLocaleString('en-IN')}</>
                    )}
                    <span className={styles.pagerHint}>
                      {pageIsTodayOnly
                        ? 'Only today'
                        : currentPage?.slices.some((slice) => slice.day === today)
                          ? 'Today and upcoming'
                          : 'Other days'}
                    </span>
                  </span>
                  <div className={styles.pagerBtns}>
                    {pageCount > 1 ? (
                      <>
                        <button type="button" className={styles.pageBtn} aria-label="Previous page" disabled={safePage === 0} onClick={() => goToPage(safePage - 1)}>‹</button>
                        {pageWindow(safePage, pageCount).map((item, index) => (
                          item === 'gap' ? (
                            <span key={`gap-${index}`} className={styles.pageGap} aria-hidden="true">…</span>
                          ) : (
            <button
                              key={item}
              type="button"
                              className={styles.pageBtn}
                              data-on={item === safePage}
                              aria-label={pages[item]?.kind === 'today' ? 'Today' : `Page ${item + 1}`}
                              aria-current={item === safePage ? 'page' : undefined}
                              onClick={() => goToPage(item)}
                            >
                              {pages[item]?.kind === 'today' ? 'Today' : item + 1}
            </button>
                          )
                        ))}
                        <button type="button" className={styles.pageBtn} aria-label="Next page" disabled={safePage >= pageCount - 1} onClick={() => goToPage(safePage + 1)}>›</button>
                      </>
                    ) : null}
                  </div>
                </nav>
            </>
          )
        ) : null}
      </section>
      </>
      ) : null}

      {view === 'calendar' ? (
        <CalendarBoard
          meetings={calendarMeetings}
          personalMeetings={personalListed}
          personalKind={personalKind}
          onPersonalKind={setPersonalKind}
          personalWarning={personalWarning}
          today={today}
          focusMonth={focusMonth}
          onMonthChange={showMonth}
          onOpen={openMeeting}
        />
      ) : null}
      </div>

      {selected ? (
        <>
          <div className={styles.overlay} data-phase={panelPhase || 'in'} onClick={closePanel} />
          <aside className={styles.panel} data-phase={panelPhase || 'in'} role="dialog" aria-modal="true" aria-label="Meeting details">
            <div className={styles.panelHead}>
              <button ref={closeRef} type="button" className={styles.closeBtn} aria-label="Close meeting details" onClick={closePanel}>
                ×
            </button>
              <div className={styles.panelKicker}>{selected.personal ? (selected.personalKind === 'full_day' ? 'Full-day leave' : 'Personal appointment') : dayHeading(selected.day, today)}</div>
              <p className={styles.panelTime}>
                {selected.personal && selected.endMinutes != null
                  ? `${formatClock(selected.minutes)} – ${formatClock(selected.endMinutes)}`
                  : formatClock(selected.minutes)}
              </p>
              <p className={styles.panelDate}>{formatFullDate(selected.day)}</p>
          </div>
            <div className={styles.custCard} data-personal={selected.personal ? selected.personalKind || 'block' : undefined}>
              <Avatar name={selected.personal ? selected.designer : selected.customer} />
              <div className={styles.custBody}>
                <span className={styles.custName}>{selected.customer}</span>
                <span className={styles.sub}>
                  {selected.personal
                    ? `${personLabel(selected.designer)} · ${approvalLabel(selected.personalApproval)}`
                    : `Lead ${selected.leadId}`}
                </span>
                <div className={styles.tags}>
                  {selected.personal ? (
                    <span className={styles.modeTag} data-personal={selected.personalKind || 'block'}>
                      {selected.personalKind === 'full_day' ? 'Leave' : 'Personal'}
                    </span>
                  ) : (
                    <ModeTag mode={selected.mode} />
                  )}
                  <span className={styles.venue}>{selected.venue}</span>
                  <span className={styles.kind}>{selected.kind}</span>
                  <StatusPill status={selected.status} meeting={selected} />
        </div>
              </div>
            </div>
            <div className={styles.panelBody}>
              {selected.personal && selected.personalApproval === 'pending' ? (
                <div className={styles.note}>
                  <p>Waiting for leave approval</p>
                  <p className={styles.noteSub}>This day stays blocked until the request is approved or rejected.</p>
                </div>
              ) : selected.status === 'cancelled' || selected.status === 'abandoned' ? (
                <div className={styles.note}>
                  <p>
                    {selected.personal && selected.personalApproval === 'expired'
                      ? 'This leave request expired'
                      : selected.personal && selected.status === 'cancelled'
                        ? 'This personal time was cancelled'
                        : selected.status === 'cancelled'
                          ? 'This meeting was cancelled'
                          : 'This meeting was abandoned'}
                  </p>
                  {selected.status === 'abandoned' ? (
                    <p className={styles.noteSub}>
                      The slot end plus 2 hours passed and this meeting was never started.
                    </p>
                  ) : null}
                  {(selected.raw.reason || selected.raw.cancelReason) ? (
                    <p className={styles.noteSub}>{selected.raw.reason || selected.raw.cancelReason}</p>
                          ) : null}
                  {selected.status === 'cancelled' && selected.raw.cancelFiles?.length ? (
                    <ul className={styles.attachList}>
                      {selected.raw.cancelFiles.map((file) => (
                        <li key={file.id}>
                          <a
                            href={`${apiBase}/api/leads/${selected.leadId}/uploads/${file.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {file.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                        </div>
              ) : (
                <ol className={styles.steps}>
                  {STEP_LABELS.map((label, index) => {
                    const active = selected.status === 'completed' ? 2 : selected.status === 'in_progress' ? 1 : 0;
                    return (
                      <li
                        key={label}
                        className={styles.step}
                        data-on={index <= active}
                        data-current={index === active}
                        data-next={index < active}
                      >
                        <span className={styles.dot} />
                        {label}
                      </li>
                    );
                  })}
                </ol>
              )}
              {selected.overlapsClient ? (
                <div className={styles.note} data-tone="overlap">
                  <p>Overlaps a client meeting for this designer</p>
                </div>
              ) : null}
              {selected.insideLeave ? (
                <div className={styles.note} data-tone="leave">
                  <p>This block sits inside a full-day leave</p>
                </div>
              ) : null}
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Designer</span>
                  <span className={styles.metaValue}>{personLabel(selected.designer)}</span>
      </div>
                {selected.personal ? (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Reason</span>
                    <span className={styles.metaValue}>{selected.personalReason || selected.customer}</span>
                  </div>
                ) : (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Sales</span>
                    <span className={styles.metaValue}>{personLabel(selected.sales)}</span>
                  </div>
                )}
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{selected.personal ? 'Type' : 'Meeting type'}</span>
                  <span className={styles.metaValue}>{selected.kind}</span>
        </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{selected.personal ? 'Approval' : 'Lead ID'}</span>
                  <span className={styles.metaValue}>{selected.personal ? approvalLabel(selected.personalApproval) : selected.leadId}</span>
                </div>
                {!selected.personal && (selected.raw.reason || selected.raw.cancelReason) ? (
                  <div className={`${styles.metaItem} ${styles.metaItemWide}`}>
                    <span className={styles.metaLabel}>Reason</span>
                    <span className={styles.metaValue}>{selected.raw.reason || selected.raw.cancelReason}</span>
                  </div>
                ) : null}
              </div>
              {selected.personal ? null : (
              <div className={styles.leadQuote} data-empty={selected.quote == null}>
                <span className={styles.metaLabel}>Lead quote</span>
                {selected.quote != null ? (
                  <span className={styles.leadAmount}>{formatInr(selected.quote)}</span>
                ) : (
                  <span className={styles.metaValue}>No quote yet</span>
        )}
      </div>
              )}
              {(() => {
                if (selected.personal || selected.typeKey !== 'pre_10') return null;
                const fromList = Array.isArray(panelLead?.floorPlans)
                  ? panelLead.floorPlans
                      .map((item, i) => ({
                        index: typeof item?.index === 'number' ? item.index : i,
                        filename: String(item?.filename || '').trim() || `Floor plan ${i + 1}`,
                        publicUrl: String(item?.publicUrl || '').trim(),
                      }))
                      .filter((item) => item.publicUrl)
                      .sort((a, b) => a.index - b.index)
                  : [];
                const plans =
                  fromList.length > 0
                    ? fromList
                    : panelLead?.floorPlanPublicLink?.trim()
                      ? [{ index: 0, filename: 'Floor plan', publicUrl: panelLead.floorPlanPublicLink.trim() }]
                      : [];
                if (!plans.length) return null;
                return (
                  <div className={styles.floorPlansBlock}>
                    <span className={styles.metaLabel}>
                      Floor plan{plans.length > 1 ? 's' : ''}
                    </span>
                    <ul className={styles.floorPlanList}>
                      {plans.map((plan) => (
                        <li key={`${plan.index}-${plan.publicUrl}`}>
                          <a
                            href={plan.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.floorPlanLink}
                            title={plan.filename}
                          >
                            <span>{plan.filename}</span>
                            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
                              <path fill="currentColor" d="M11 3a1 1 0 1 0 0 2h2.586l-6.293 6.293a1 1 0 1 0 1.414 1.414L15 6.414V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
                              <path fill="currentColor" d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
                            </svg>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>
            {canAct(selected, today, nowMinutes) ? (
              <div className={styles.foot}>
                <button type="button" className={`${styles.actBtn} ${styles.actReschedule}`} onClick={() => openAction('reschedule', selected.raw)}>
                  Reschedule
                </button>
                <button type="button" className={`${styles.actBtn} ${styles.actCancel}`} onClick={() => openAction('cancel', selected.raw)}>
                  Cancel meeting
                </button>
              </div>
            ) : selected.personal ? (
              <div className={styles.foot}>
                <p className={styles.crmHint}>
                  Personal time is booked by the designer. Change or cancel it from Personal Appointments.
                </p>
              </div>
            ) : selected.typeKey === 'pre_10' && (selected.status === 'scheduled' || selected.status === 'in_progress' || selected.status === 'completed' || selected.status === 'abandoned') ? (
              <div className={`${styles.foot} ${styles.pre10Foot}`}>
                <div
                  className={styles.pre10ActionCard}
                  data-state={showPre10End ? 'live' : showPre10Start ? 'ready' : 'locked'}
                >
                  <div className={styles.pre10ActionShine} aria-hidden="true" />
                  <div className={styles.pre10ActionTop}>
                    <span className={styles.pre10Badge}>
                      <span className={styles.pre10BadgeDot} aria-hidden="true" />
                      {showPre10End ? 'In progress' : showPre10Start ? 'Ready now' : 'Pre 10%'}
                    </span>
                    {selected.day === today ? (
                      <span className={styles.pre10TodayChip}>Today</span>
                    ) : null}
                  </div>
                  <div className={styles.pre10ActionBody}>
                    <p className={styles.pre10ActionTitle}>
                      {showPre10End
                        ? 'Finish this visit when you’re done'
                        : showPre10Start
                          ? selected.status === 'in_progress'
                            ? 'Continue the meeting'
                            : 'Ready to begin?'
                          : 'Start meeting locked'}
                    </p>
                    <p className={styles.pre10ActionSub}>
                      {showPre10Start || showPre10End
                        ? showPre10End
                          ? 'Open the wizard to keep going, or end the meeting once the visit is complete.'
                          : 'Opens the Pre 10% meeting wizard for this lead — same rules as the dashboard.'
                        : pre10StartBlockMessage || 'Same Pre 10% dashboard rules apply here.'}
                    </p>
                  </div>
                  {(showPre10Start || showPre10End) ? (
                    <div
                      className={`${styles.pre10ActionRow}${showPre10Start && showPre10End ? ` ${styles.pre10ActionRowSplit}` : ''}`}
                    >
                      {showPre10Start ? (
                        <button
                          type="button"
                          className={`${styles.actBtn} ${styles.actStart}`}
                          disabled={startMeetingBusy || panelLeadLoading}
                          onClick={() => void openPre10StartMeeting()}
                        >
                          <svg className={styles.pre10BtnIcon} viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                            <path fill="currentColor" d="M6.5 4.8c0-.7.8-1.1 1.4-.7l7.2 4.7c.6.4.6 1.2 0 1.5l-7.2 4.7c-.6.4-1.4 0-1.4-.7V4.8Z" />
                          </svg>
                          {startMeetingBusy
                            ? 'Opening…'
                            : selected.status === 'in_progress'
                              ? 'Continue meeting'
                              : 'Start meeting'}
                        </button>
                      ) : null}
                      {showPre10End ? (
                        <button
                          type="button"
                          className={`${styles.actBtn} ${styles.actEnd}`}
                          disabled={endMeetingBusy}
                          onClick={() => void endPre10Meeting()}
                        >
                          <svg className={styles.pre10BtnIcon} viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                            <rect x="5" y="5" width="10" height="10" rx="2" fill="currentColor" />
                          </svg>
                          {endMeetingBusy ? 'Ending…' : 'End meeting'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {pre10ActionError ? <p className={styles.pre10ActionError}>{pre10ActionError}</p> : null}
                </div>
              </div>
            ) : null}
          </aside>
        </>
      ) : null}

      <MeetingWizSessionOverlay
        open={meetingWizOpen}
        lead={meetingWizLead}
        onLeadUpdated={(updated) => {
          setMeetingWizLead(updated);
          setPanelLead(updated);
        }}
        onClose={() => {
          setMeetingWizOpen(false);
          if (meetingWizLead) setPanelLead(meetingWizLead);
          setMeetingWizLead(null);
          void loadMeetings();
          // Refresh history so “wizard completed” edge case matches the dashboard.
          if (selected?.leadId && sessionId && selected.typeKey === 'pre_10' && !selected.personal) {
            const leadId = selected.leadId;
            fetch(`${apiBase}/api/leads/${leadId}/history`, {
              headers: buildAuthHeaders(sessionId),
              credentials: 'include',
            })
              .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (!res.ok) return;
                const events = Array.isArray(data)
                  ? data
                  : Array.isArray(data?.events)
                    ? data.events
                    : Array.isArray(data?.history)
                      ? data.history
                      : [];
                setPanelHistory(events);
              })
              .catch(() => undefined);
          }
        }}
      />

      {actionMeeting && actionKind ? (
        <div className={styles.modal} onClick={(event) => { if (event.target === event.currentTarget) closeAction(); }}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="meeting-action-title" data-kind={actionKind}>
            <p className={styles.actionKicker}>
              {actionStep === 'details' ? 'Confirm current meeting' : actionStep === 'confirm' ? 'Confirm' : actionKind === 'reschedule' ? 'Reschedule' : 'Cancel meeting'}
            </p>
            <h2 id="meeting-action-title">{actionMeeting.customerName}</h2>
            <div className={styles.actionChips}>
              <span className={styles.kind}>{meetingKindLabel(actionMeeting)}</span>
              <span className={styles.venue}>{mapChannel(actionMeeting).venue}</span>
            </div>
            {actionStep === 'details' ? (
              <div className={styles.currentSlot}>
                <span>Current slot</span>
                <strong>{formatFullDate(actionMeeting.meetingDate)}</strong>
                <em>{ownSlotLabel(actionMeeting)}</em>
              </div>
            ) : null}
            {actionStep === 'form' && actionKind === 'reschedule' ? (
              <div className={styles.fields}>
                <div className={styles.currentSlot}>
                  <span>Current slot</span>
                  <strong>{formatFullDate(actionMeeting.meetingDate)}</strong>
                  <em>{ownSlotLabel(actionMeeting)}</em>
                </div>
                <label>
                  New date
                  <input type="date" value={nextDate} min={today} onChange={(event) => { setNextDate(event.target.value); setActionError(null); }} />
                </label>
                <div className={styles.slotField}>
                  <span>New slot</span>
                  <button
                    type="button"
                    className={styles.slotPick}
                    data-empty={nextStartMin == null ? 'true' : 'false'}
                    disabled={!nextDate || !actionMeeting.designerName}
                    onClick={() => setSlotPickerOpen(true)}
                  >
                    <span>
                      {nextStartMin == null
                        ? 'Choose this designer’s slot'
                        : slotRangeLabel(nextStartMin)}
                    </span>
                    <span className={styles.slotPickHint}>{nextStartMin == null ? 'Select' : 'Change'}</span>
                  </button>
                </div>
                <label className={styles.reasonField}>
                  Reason
                  <textarea
                    value={actionReason}
                    onChange={(event) => { setActionReason(event.target.value); setActionError(null); }}
                    rows={3}
                    maxLength={500}
                    placeholder="Why is this meeting being rescheduled?"
                  />
                </label>
              </div>
            ) : null}
            {actionStep === 'form' && actionKind === 'cancel' ? (
              <>
                <div className={styles.currentSlot}>
                  <span>Current slot</span>
                  <strong>{formatFullDate(actionMeeting.meetingDate)}</strong>
                  <em>{ownSlotLabel(actionMeeting)}</em>
                </div>
                <label className={styles.reasonField}>
                  Reason
                  <textarea
                    value={actionReason}
                    onChange={(event) => { setActionReason(event.target.value); setActionError(null); }}
                    rows={3}
                    maxLength={500}
                    placeholder="Why is this meeting cancelled?"
                  />
                </label>
                <label className={styles.filePick}>
                  Attach images or PDFs
                  <input
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    multiple
                    onChange={(event) => {
                      const picked = Array.from(event.target.files || []);
                      event.target.value = '';
                      if (!picked.length) return;
                      const next = [...cancelFiles, ...picked];
                      const problem = statusNoteFileProblem(next);
                      if (problem) {
                        setActionError(problem);
                        return;
                      }
                      setActionError(null);
                      setCancelFiles(next);
                    }}
                  />
                </label>
                {cancelFiles.length > 0 ? (
                  <ul className={styles.fileNames}>
                    {cancelFiles.map((file, index) => (
                      <li key={`${file.name}-${file.size}-${index}`}>
                        <span>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setCancelFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
            {actionStep === 'confirm' && actionKind === 'reschedule' && nextStartMin != null ? (
              <div className={styles.cancelReview}>
                <div className={styles.move}>
                  <div>
                    <span className={styles.metaLabel}>Now</span>
                    <strong>{formatFullDate(actionMeeting.meetingDate)}</strong>
                    <span className={styles.moveTime}>{ownSlotLabel(actionMeeting)}</span>
                  </div>
                  <span className={styles.moveArrow} aria-hidden>→</span>
                  <div>
                    <span className={styles.metaLabel}>New slot</span>
                    <strong>{formatFullDate(nextDate)}</strong>
                    <span className={styles.moveTime}>{slotRangeLabel(nextStartMin)}</span>
                  </div>
                </div>
                <p>This meeting will be moved to the new slot.</p>
                <blockquote>{actionReason.trim()}</blockquote>
              </div>
            ) : null}
            {actionStep === 'confirm' && actionKind === 'cancel' ? (
              <div className={styles.cancelReview}>
                <div className={styles.currentSlot}>
                  <span>Cancelling</span>
                  <strong>{formatFullDate(actionMeeting.meetingDate)}</strong>
                  <em>{ownSlotLabel(actionMeeting)}</em>
                </div>
                <p>This meeting will be marked cancelled.</p>
                <blockquote>{actionReason.trim()}</blockquote>
                {cancelFiles.length > 0 ? (
                  <ul className={styles.fileNames}>
                    {cancelFiles.map((file) => (
                      <li key={`${file.name}-${file.size}`}><span>{file.name}</span></li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {actionError ? <p className={styles.popError}>{actionError}</p> : null}
            <div className={styles.modalActions}>
              {actionStep === 'details' ? (
                <>
                  <button type="button" className={styles.btn} onClick={closeAction}>Close</button>
                  <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setActionError(null); setActionStep('form'); }}>
                    {actionKind === 'reschedule' ? 'Change this meeting' : 'Continue'}
                  </button>
                </>
              ) : actionStep === 'form' ? (
                <>
                  <button type="button" className={styles.btn} onClick={() => { setActionError(null); setSlotPickerOpen(false); setActionStep('details'); }}>Back</button>
                  <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={reviewAction}>
                    {actionKind === 'reschedule' ? 'Review new slot' : 'Review cancellation'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={styles.btn} disabled={savingAction} onClick={() => setActionStep('form')}>Back</button>
                  <button
                    type="button"
                    className={`${styles.btn} ${actionKind === 'reschedule' ? styles.btnPrimary : styles.btnStop}`}
                    disabled={savingAction}
                    onClick={() => void submitAction()}
                  >
                    {savingAction ? 'Saving…' : actionKind === 'reschedule' ? 'Confirm reschedule' : 'Confirm cancel'}
                  </button>
                </>
              )}
            </div>
          </div>
          {actionKind === 'reschedule' && actionMeeting.designerName ? (
            <MeetingSlotPickerModal
              open={slotPickerOpen}
              onClose={() => setSlotPickerOpen(false)}
              onConfirm={(startMin) => {
                setNextStartMin(startMin);
                setNextTime(minutesToHubTime24(startMin));
                setActionError(null);
              }}
              apiBase={apiBase}
              designerName={actionMeeting.designerName}
              meetingDate={nextDate}
              initialStartMin={nextStartMin}
              durationMin={HUB_MEETING_DURATION_MIN}
              sessionId={sessionId}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GroupRows({
  day,
  today,
  meetings,
  continued = false,
  onOpen,
}: {
  day: string;
  today: string;
  meetings: ViewMeeting[];
  continued?: boolean;
  onOpen: (meeting: ViewMeeting) => void;
}) {
  return (
    <>
      <tr className={styles.dayRow}>
        <th colSpan={8} scope="colgroup">
          {dayHeading(day, today)}
          {continued ? <span className={styles.continued}>continued</span> : null}
        </th>
      </tr>
      {meetings.map((meeting) => (
        <tr
          key={meeting.key}
          className={styles.row}
          data-mode={meeting.personal ? undefined : meeting.mode}
          data-personal={meeting.personal ? meeting.personalKind || 'block' : undefined}
          data-overlap={meeting.overlapsClient || meeting.insideLeave ? 'true' : undefined}
          tabIndex={0}
          aria-label={meeting.personal ? `Open personal time for ${meeting.designer}` : `Open meeting for ${meeting.customer}`}
          onClick={() => onOpen(meeting)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen(meeting);
            }
          }}
        >
          <td className={styles.customerCell}>
            <div className={styles.person}>
              <Avatar name={meeting.customer} />
              <div className={styles.personText}>
                <span className={styles.name} title={meeting.customer}>{meeting.customer}</span>
                {meeting.personal ? (
                  <span className={styles.personalMark} data-kind={meeting.personalKind || 'block'}>
                    {meeting.personalKind === 'full_day' ? 'Full-day leave' : 'Personal'}
                    {meeting.overlapsClient ? ' · overlaps a client meeting' : ''}
                    {meeting.insideLeave ? ' · inside full-day leave' : ''}
                  </span>
                ) : null}
              </div>
            </div>
          </td>
          <td className={styles.nameCell}>
            <span className={styles.cellText} title={personLabel(meeting.designer)}>{personLabel(meeting.designer)}</span>
          </td>
          <td className={styles.nameCell}>
            <span className={styles.cellText} title={personLabel(meeting.sales)}>{personLabel(meeting.sales)}</span>
          </td>
          <td className={styles.meetCell}>
            <div className={styles.meetBox}>
              <div className={styles.meetTags}>
                {meeting.personal ? (
                  <span className={styles.modeTag} data-personal={meeting.personalKind || 'block'}>
                    {meeting.personalKind === 'full_day' ? 'Leave' : 'Personal'}
                  </span>
                ) : (
                  <ModeTag mode={meeting.mode} />
                )}
                <span className={styles.kind}>{meeting.kind}</span>
              </div>
              <span className={styles.venue}>{meeting.venue}</span>
            </div>
          </td>
          <td className={styles.whenCell}>
            <div className={styles.whenTime}>{formatClock(meeting.minutes)}</div>
            <div className={styles.whenDay}>{dayHeading(meeting.day, today)}</div>
          </td>
          <td className={styles.statusCell}><StatusPill status={meeting.status} meeting={meeting} /></td>
          <td className={styles.quoteCell}>
            {meeting.personal ? (
              <span className={styles.moneyNone}>Personal</span>
            ) : meeting.quote != null ? (
              <span className={styles.money}>{formatInr(meeting.quote)}</span>
            ) : (
              <span className={styles.moneyNone}>No quote</span>
            )}
          </td>
          <td className={styles.chevronCell}><ChevronIcon /></td>
        </tr>
      ))}
    </>
  );
}

function isPersonalUpcoming(meeting: ViewMeeting, today: string): boolean {
  if (meeting.status === 'cancelled' || meeting.status === 'completed') return false;
  return meeting.day >= today;
}

function PersonalBoard({
  meetings,
  today,
  kind,
  onKind,
  warning,
  loading = false,
  onOpen,
  compact = false,
}: {
  meetings: ViewMeeting[];
  today: string;
  kind: PersonalKindFilter;
  onKind: (kind: PersonalKindFilter) => void;
  warning: string | null;
  loading?: boolean;
  onOpen: (meeting: ViewMeeting) => void;
  compact?: boolean;
}) {
  const upcoming = meetings.filter((meeting) => isPersonalUpcoming(meeting, today));
  const past = meetings.filter((meeting) => !isPersonalUpcoming(meeting, today));
  const groups = [
    { id: 'upcoming', label: 'Upcoming', rows: upcoming },
    { id: 'past', label: 'Past', rows: past },
  ];
  return (
    <section className={compact ? styles.personalSide : styles.personalBoard} aria-label="Personal appointments">
      <div className={styles.personalHead}>
        <div>
          <h2 className={styles.personalTitle}>Personal appointments</h2>
          <p className={styles.personalSub}>
            {loading ? 'Loading designer time…' : `${upcoming.length} upcoming · ${past.length} past`}
          </p>
        </div>
        <div className={styles.seg} role="group" aria-label="Personal appointment type">
          {([
            ['all', 'All'],
            ['block', 'Blocks'],
            ['full_day', 'Leave'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" data-on={kind === id} onClick={() => onKind(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {meetings.length === 0 ? (
        <p className={styles.quiet}>
          {warning ? 'Personal time blocks are waiting on the calendar service.' : 'No personal appointments in this range.'}
        </p>
      ) : (
        <div className={styles.personalGroups}>
          {groups.map((group) => (
            <div key={group.id} className={styles.personalGroup} data-group={group.id}>
              <div className={styles.personalGroupLabel}>
                {group.label}
                <span>{group.rows.length}</span>
              </div>
              {group.rows.length === 0 ? (
                <p className={styles.personalEmpty}>{group.id === 'upcoming' ? 'Nothing coming up.' : 'Nothing earlier in this range.'}</p>
              ) : (
                group.rows.map((meeting) => (
                  <button
                    key={meeting.key}
                    type="button"
                    className={styles.personalItem}
                    data-kind={meeting.personalKind || 'block'}
                    data-overlap={meeting.overlapsClient || meeting.insideLeave ? 'true' : undefined}
                    onClick={() => onOpen(meeting)}
                  >
                    <span className={styles.personalWhen}>
                      <strong>{meeting.personalKind === 'full_day' ? 'Full day' : formatClock(meeting.minutes)}</strong>
                      <span>{dayHeading(meeting.day, today)}</span>
                    </span>
                    <span className={styles.personalBody}>
                      <span className={styles.personalName}>{meeting.personalKind === 'full_day' ? (meeting.personalReason || 'Full-day leave') : meeting.customer}</span>
                      <span className={styles.personalMeta}>
                        {personLabel(meeting.designer)}
                        {meeting.endMinutes != null && meeting.personalKind !== 'full_day' ? ` · until ${formatClock(meeting.endMinutes)}` : ''}
                        {meeting.overlapsClient ? ' · overlaps a client meeting' : ''}
                      </span>
                    </span>
                    <span className={styles.modeTag} data-personal={meeting.personalKind || 'block'}>
                      {meeting.personalKind === 'full_day' ? 'Leave' : 'Personal'}
                    </span>
                    <StatusPill status={meeting.status} meeting={meeting} />
                  </button>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CalendarBoard({
  meetings,
  personalMeetings,
  personalKind,
  onPersonalKind,
  personalWarning,
  today,
  focusMonth,
  onMonthChange,
  onOpen,
}: {
  meetings: ViewMeeting[];
  personalMeetings: ViewMeeting[];
  personalKind: PersonalKindFilter;
  onPersonalKind: (kind: PersonalKindFilter) => void;
  personalWarning: string | null;
  today: string;
  focusMonth: string;
  onMonthChange: (isoDay: string) => void;
  onOpen: (meeting: ViewMeeting) => void;
}) {
  const [cursor, setCursor] = useState(() => (focusMonth === today.slice(0, 7) ? today : `${focusMonth}-01`));
  const [span, setSpan] = useState<'week' | 'month'>('week');
  const [clock, setClock] = useState<number | null>(null);
  const [motion, setMotion] = useState<{ dir: 'next' | 'prev'; id: number } | null>(null);

  useEffect(() => {
    const update = () => setClock(kolkataMinutes());
    update();
    const id = window.setInterval(update, 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setCursor((current) => {
      if (current.slice(0, 7) === focusMonth) return current;
      return focusMonth === today.slice(0, 7) ? today : `${focusMonth}-01`;
    });
  }, [focusMonth, today]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDaysIso(startOfWeek(cursor), index)), [cursor]);
  const monthDays = useMemo(() => {
    const first = `${cursor.slice(0, 7)}-01`;
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => addDaysIso(start, index));
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, ViewMeeting[]>();
    for (const meeting of meetings) {
      const list = map.get(meeting.day) || [];
      list.push(meeting);
      map.set(meeting.day, list);
    }
    for (const list of map.values()) list.sort((a, b) => compareMeetings(a, b, 1));
    return map;
  }, [meetings]);

  const todayMeetings = byDay.get(today) || [];
  const inProgress = meetings.filter((meeting) => meeting.status === 'in_progress').sort((a, b) => compareMeetings(a, b, 1));
  const live = inProgress.find((meeting) => meeting.day === today) || inProgress[0] || null;
  const nextToday = todayMeetings.find((meeting) => {
    if (meeting.status !== 'scheduled') return false;
    if (clock == null || meeting.minutes == null) return true;
    return meeting.minutes >= clock;
  });
  const spotlight = live || nextToday || null;

  const jumpMonth = (day: string) => {
    setMotion(null);
    setSpan('month');
    setCursor(day);
    if (day.slice(0, 7) !== focusMonth) onMonthChange(day);
  };

  const shiftCalendar = (direction: 1 | -1) => {
    const next = span === 'week' ? addDaysIso(cursor, direction * 7) : addMonthsIso(cursor, direction);
    setMotion({ dir: direction > 0 ? 'next' : 'prev', id: Date.now() });
    setCursor(next);
    if (next.slice(0, 7) !== focusMonth) onMonthChange(next);
  };

  return (
    <div className={styles.calLayout}>
      <div className={styles.calFrame}>
        <button
          type="button"
          key={motion?.dir === 'prev' ? `prev-${motion.id}` : 'prev-idle'}
          className={styles.edgeBtn}
          data-side="left"
          data-go={motion?.dir === 'prev' ? 'true' : 'false'}
          aria-label={span === 'week' ? 'Previous week' : 'Previous month'}
          onClick={() => shiftCalendar(-1)}
        >
          ‹
        </button>
        <section className={styles.calCard}>
          <div className={styles.calHead}>
            <h2 className={styles.calTitle}>{span === 'week' ? weekTitle(weekDays) : monthTitle(cursor)}</h2>
            <div className={styles.calTools}>
              <button type="button" className={styles.todayBtn} onClick={() => { setMotion(null); setCursor(today); if (today.slice(0, 7) !== focusMonth) onMonthChange(today); }}>Today</button>
              <div className={styles.seg} role="group" aria-label="Calendar span">
                <button type="button" data-on={span === 'week'} onClick={() => { setMotion(null); setSpan('week'); }}>Week</button>
                <button type="button" data-on={span === 'month'} onClick={() => { setMotion(null); setSpan('month'); }}>Month</button>
              </div>
            </div>
          </div>
          <div key={motion?.id ?? 'still'} className={styles.calMotion} data-slide={motion?.dir || 'none'}>
        {span === 'week' ? (
          <div className={styles.weekWrap}>
            <div className={styles.week}>
              <div className={styles.corner} />
              {weekDays.map((day) => {
                const outside = day.slice(0, 7) !== weekDays[0].slice(0, 7);
                const nextStart = outside && day.endsWith('-01');
                return (
                  <div key={day} className={styles.weekHead} data-today={day === today} data-out={outside} data-next-start={nextStart}>
                    <span>{weekdayShort(day)}</span>
                    <span className={styles.dateNum} data-today={day === today} data-next-start={nextStart}>{Number(day.slice(8))}</span>
                    {nextStart ? <span className={styles.monthMark}>{monthAbbrev(day)}</span> : null}
                  </div>
                );
              })}
              {HOURS.map((hour) => (
                <HourRow key={hour} hour={hour} days={weekDays} today={today} anchorMonth={weekDays[0].slice(0, 7)} byDay={byDay} onOpen={onOpen} onMore={jumpMonth} />
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.monthWrap}>
            <div className={styles.month}>
              {WEEKDAYS.map((label) => (
                <div key={label} className={styles.monthHead}>{label}</div>
              ))}
              {monthDays.map((day) => {
                const events = byDay.get(day) || [];
                const extra = events.length - 3;
                const shownMonth = cursor.slice(0, 7);
                const outside = !day.startsWith(shownMonth);
                const nextStart = outside && day.endsWith('-01') && day.slice(0, 7) > shownMonth;
                return (
                  <div key={day} className={styles.monthCell} data-today={day === today} data-out={outside} data-next-start={nextStart}>
                    <span className={styles.dateLine}>
                      <span className={styles.dateNum} data-today={day === today} data-next-start={nextStart}>{Number(day.slice(8))}</span>
                      {nextStart ? <span className={styles.monthMark}>{monthAbbrev(day)}</span> : null}
                    </span>
                    {events.slice(0, 3).map((meeting) => (
                      <EventChip key={meeting.key} meeting={meeting} onOpen={onOpen} />
                    ))}
                    {extra > 0 ? <span className={styles.moreQuiet}>+{extra} more</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
          </div>
        <div className={styles.legend}>
          <span><i className={styles.swatch} data-mode="offline" /> Offline</span>
          <span><i className={styles.swatch} data-mode="online" /> Online</span>
          <span><i className={styles.statusDot} data-status="scheduled" /> Scheduled</span>
          <span><i className={styles.statusDot} data-status="in_progress" /> In progress</span>
          <span><i className={styles.statusDot} data-status="completed" /> Successful</span>
          <span><i className={styles.statusDot} data-status="abandoned" /> Abandoned</span>
        </div>
        </section>
        <button
          type="button"
          key={motion?.dir === 'next' ? `next-${motion.id}` : 'next-idle'}
          className={styles.edgeBtn}
          data-side="right"
          data-go={motion?.dir === 'next' ? 'true' : 'false'}
          aria-label={span === 'week' ? 'Next week' : 'Next month'}
          onClick={() => shiftCalendar(1)}
        >
          ›
        </button>
      </div>
      <aside className={styles.side}>
        <div className={styles.liveCard} data-live={live ? 'true' : 'false'}>
          <div className={styles.liveKicker}>
            {live ? <span className={styles.pulse} aria-hidden /> : null}
            {live ? 'Happening now' : 'Up next'}
          </div>
          {spotlight ? (
            <button type="button" className={styles.liveBody} onClick={() => onOpen(spotlight)}>
              <span className={styles.liveTime}>{spotlight.minutes == null ? 'Time not on this booking' : formatClock(spotlight.minutes)}</span>
              <span className={styles.liveName}>{spotlight.customer}</span>
              <span className={styles.liveMeta}>
                {personLabel(spotlight.designer)}
                {spotlight.venue ? ` · ${spotlight.venue}` : ''}
              </span>
              <span className={styles.tags}>
                <ModeTag mode={spotlight.mode} />
                <StatusPill status={spotlight.status} meeting={spotlight} />
              </span>
            </button>
          ) : (
            <p className={styles.liveEmpty}>No meeting is in progress, and nothing else is scheduled today.</p>
          )}
        </div>
        <PersonalBoard
          meetings={personalMeetings}
          today={today}
          kind={personalKind}
          onKind={onPersonalKind}
          warning={personalWarning}
          onOpen={onOpen}
          compact
        />
        <div className={styles.sideCard}>
          <div className={styles.sideLabel}>
            Today&apos;s schedule
            <span className={styles.badge}>{todayMeetings.length}</span>
          </div>
          {todayMeetings.length === 0 ? (
            <p className={styles.quiet}>Nothing scheduled today.</p>
          ) : (
            <div className={styles.timeline}>
              {todayMeetings.map((meeting) => (
                <button key={meeting.key} type="button" className={styles.tlBtn} data-personal={meeting.personal ? meeting.personalKind || 'block' : undefined} onClick={() => onOpen(meeting)}>
                  <span className={styles.tlTime}>{meeting.minutes == null ? '—' : formatClock(meeting.minutes)}</span>
                  <span className={styles.tlName}>{meeting.customer}</span>
                  <StatusPill status={meeting.status} meeting={meeting} />
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function HourRow({
  hour,
  days,
  today,
  anchorMonth,
  byDay,
  onOpen,
  onMore,
}: {
  hour: number;
  days: string[];
  today: string;
  anchorMonth: string;
  byDay: Map<string, ViewMeeting[]>;
  onOpen: (meeting: ViewMeeting) => void;
  onMore: (day: string) => void;
}) {
  return (
    <>
      <div className={styles.hourLabel}>{hourLabel(hour)}</div>
      {days.map((day) => {
        const events = (byDay.get(day) || []).filter((meeting) => gridHour(meeting.minutes) === hour);
        const extra = events.length - 3;
        const outside = !day.startsWith(anchorMonth);
        const nextStart = outside && day.endsWith('-01');
        return (
          <div key={`${day}-${hour}`} className={styles.weekCell} data-today={day === today} data-out={outside} data-next-start={nextStart}>
            {events.slice(0, 3).map((meeting) => (
              <EventChip key={meeting.key} meeting={meeting} onOpen={onOpen} />
            ))}
            {extra > 0 ? (
              <button type="button" className={styles.moreLink} onClick={() => onMore(day)}>
                +{extra} more
              </button>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function EventChip({ meeting, onOpen }: { meeting: ViewMeeting; onOpen: (meeting: ViewMeeting) => void }) {
  const when = meeting.minutes == null ? meeting.customer : `${formatClock(meeting.minutes)} ${meeting.customer}`;
  const channel = meeting.personal
    ? meeting.personalKind === 'full_day'
      ? 'Full-day leave'
      : 'Personal'
    : meeting.mode === 'online'
      ? 'Online'
      : 'Offline';
  return (
    <button
      type="button"
      className={styles.chip}
      data-mode={meeting.personal ? undefined : meeting.mode}
      data-personal={meeting.personal ? meeting.personalKind || 'block' : undefined}
      data-overlap={meeting.overlapsClient || meeting.insideLeave ? 'true' : undefined}
      data-status={meeting.status}
      aria-label={`${when}, ${channel} ${meeting.venue}, ${STATUS_LABEL[meeting.status]}${meeting.overlapsClient ? ', overlaps a client meeting' : ''}`}
      title={when}
      onClick={() => onOpen(meeting)}
    >
      <i className={styles.statusDot} data-status={meeting.status} aria-hidden="true" />
      <span className={styles.chipLabel}>{when}</span>
    </button>
  );
}
