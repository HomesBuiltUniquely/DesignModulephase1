'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

export type CalendarMeeting = {
  id?: number;
  leadId: number;
  projectId: string | null;
  projectName: string | null;
  customerName: string;
  phone: string | null;
  salesName: string | null;
  quotationTotal: string | null;
  budget?: string | null;
  designerName: string;
  meetingDate: string;
  meetingTime: string | null;
  meetingTimeLabel: string | null;
  meetingType: string | null;
  meetingMode: string | null;
  meetingStatus?: string | null;
  progress?: string | null;
  source?: string | null;
  cancelReason?: string | null;
};

type Channel = 'showroom' | 'virtual' | 'site' | 'other';
type Span = 'day' | 'week' | 'month';
export type BoardFilter = 'scheduled' | 'successful' | 'cancelled' | 'quotes' | 'delayed';

const GRID_FIRST = 9 * 60;
const GRID_LAST = 20 * 60;
const SLOT_MINUTES = 90;
const URGENT_KEY = 'meeting-management-urgent-hide';

const CHANNEL_STYLE: Record<Channel, { bar: string; chip: string; soft: string; label: string }> = {
  showroom: { bar: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 border-blue-200', soft: 'bg-blue-50/90', label: 'Showroom visit' },
  virtual: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', soft: 'bg-emerald-50/90', label: 'Virtual meeting' },
  site: { bar: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 border-violet-200', soft: 'bg-violet-50/90', label: 'Site visit' },
  other: { bar: 'bg-[#EF0101]', chip: 'bg-red-50 text-[#EF0101] border-red-100', soft: 'bg-[#FFF5F5]', label: 'Meeting' },
};

function kolkataTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
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

function startOfWeek(isoDay: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay);
  if (!match) return isoDay;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysIso(isoDay, diff);
}

function monthCells(isoDay: string): string[] {
  const first = `${isoDay.slice(0, 7)}-01`;
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDaysIso(start, index));
}

export function meetingMinutes(meeting: CalendarMeeting): number | null {
  const raw = `${meeting.meetingTimeLabel || ''} ${meeting.meetingTime || ''}`;
  const ampm = raw.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
  if (ampm) {
    let hour = Number(ampm[1]) % 12;
    if (ampm[3].toLowerCase() === 'pm') hour += 12;
    return hour * 60 + Number(ampm[2]);
  }
  const hm = raw.match(/(\d{1,2}):(\d{2})/);
  if (!hm) return null;
  return Number(hm[1]) * 60 + Number(hm[2]);
}

export function meetingStartMs(meeting: CalendarMeeting): number | null {
  const minutes = meetingMinutes(meeting);
  if (minutes == null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(meeting.meetingDate);
  if (!match) return null;
  const utcGuess = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Math.floor(minutes / 60), minutes % 60);
  return utcGuess - 5.5 * 60 * 60 * 1000;
}

export function channelOf(meeting: CalendarMeeting): Channel {
  const mode = `${meeting.meetingMode || ''} ${meeting.meetingType || ''}`.toLowerCase();
  if (mode.includes('site')) return 'site';
  if (mode.includes('online') || mode.includes('virtual')) return 'virtual';
  if (mode.includes('offline') || mode.includes('showroom') || mode.includes('in_person') || mode.includes('in-person')) return 'showroom';
  return 'other';
}

function isCancelled(meeting: CalendarMeeting): boolean {
  return (meeting.meetingStatus || '').toLowerCase() === 'cancelled';
}

function isCompleted(meeting: CalendarMeeting): boolean {
  return (meeting.progress || '').toLowerCase() === 'completed';
}

function hasQuote(meeting: CalendarMeeting): boolean {
  return Boolean(meeting.quotationTotal && meeting.quotationTotal.trim());
}

export function matchesBoardFilter(meeting: CalendarMeeting, filter: BoardFilter, monthPrefix: string, now = new Date()): boolean {
  if (!meeting.meetingDate.startsWith(monthPrefix)) return false;
  if (filter === 'cancelled') return isCancelled(meeting);
  if (filter === 'successful') return isCompleted(meeting) && !isCancelled(meeting);
  if (filter === 'quotes') return hasQuote(meeting) && !isCancelled(meeting);
  if (filter === 'delayed') {
    const start = meetingStartMs(meeting);
    return isCompleted(meeting) && !isCancelled(meeting) && !hasQuote(meeting) && start != null && now.getTime() - start >= 4 * 60 * 60 * 1000;
  }
  return !isCancelled(meeting) && !isCompleted(meeting) && (meeting.progress || 'scheduled') !== 'meeting_abandoned';
}

function formatClock(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  let hour = hour24 % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function dayTitle(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function monthTitle(iso: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatInr(raw: string | null | undefined): string {
  if (!raw) return '—';
  const numeric = Number(String(raw).replace(/,/g, '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return raw;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(numeric);
}

function progressLabel(meeting: CalendarMeeting): string {
  if (isCancelled(meeting)) return 'Cancelled';
  const progress = (meeting.progress || '').toLowerCase();
  if (progress === 'completed') return 'Completed';
  if (progress === 'meeting_abandoned') return 'Meeting Abandoned';
  if (progress === 'in_progress') return 'In progress';
  return 'Scheduled';
}

function canReschedule(meeting: CalendarMeeting): boolean {
  if ((meeting.source || 'design_module') === 'crm') return false;
  if (!meeting.id) return false;
  if (isCancelled(meeting) || isCompleted(meeting)) return false;
  return true;
}

function designerLabel(name: string | null | undefined): string {
  const text = (name || '').trim();
  if (!text || text === '—' || text.toLowerCase() === 'unassigned') return '';
  return text;
}

function shortTime(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  let hour = hour24 % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minute).padStart(2, '0')}`;
}

function onHourGrid(minutes: number | null): boolean {
  return minutes != null && minutes >= GRID_FIRST && minutes <= GRID_LAST + 59;
}

function sortMeetings(list: CalendarMeeting[]): CalendarMeeting[] {
  return [...list].sort((a, b) => {
    const byTime = (meetingMinutes(a) ?? 9999) - (meetingMinutes(b) ?? 9999);
    if (byTime !== 0) return byTime;
    return a.customerName.localeCompare(b.customerName);
  });
}

function dotClass(meeting: CalendarMeeting): string {
  if (isCancelled(meeting)) return 'bg-rose-500';
  const channel = channelOf(meeting);
  if (channel === 'showroom') return 'bg-blue-500';
  if (channel === 'virtual') return 'bg-emerald-500';
  if (channel === 'site') return 'bg-violet-500';
  return 'bg-slate-400';
}

function gridHours(nowMinutes: number): number[] {
  const hours: number[] = [];
  for (let hour = GRID_FIRST; hour <= GRID_LAST; hour += 60) hours.push(hour);
  const nowHour = Math.floor(nowMinutes / 60) * 60;
  if (nowHour < GRID_FIRST) hours.unshift(nowHour);
  if (nowHour > GRID_LAST) hours.push(nowHour);
  return hours;
}

export default function MeetingCalendar({
  meetings,
  loading,
  query,
  onReschedule,
  onOpenFilteredList,
}: {
  meetings: CalendarMeeting[];
  loading: boolean;
  query: string;
  onReschedule: (meeting: CalendarMeeting) => void;
  onOpenFilteredList: (filter: BoardFilter, monthPrefix: string, channel: 'all' | Channel) => void;
}) {
  const today = kolkataTodayIso();
  const [cursor, setCursor] = useState(today);
  const [span, setSpan] = useState<Span>('week');
  const [channel, setChannel] = useState<'all' | Channel>('all');
  const [selected, setSelected] = useState<CalendarMeeting | null>(null);
  const [nowTick, setNowTick] = useState(() => new Date());
  const [urgentHiddenDay, setUrgentHiddenDay] = useState<string | null>(null);
  const [pile, setPile] = useState<{ date: string; hour: number; meetings: CalendarMeeting[] } | null>(null);
  const [scheduleSlot, setScheduleSlot] = useState<{ date: string; minutes: number } | null>(null);
  const [scheduleNote, setScheduleNote] = useState('');
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);

  useEffect(() => {
    setUrgentHiddenDay(window.localStorage.getItem(URGENT_KEY));
    const timer = window.setInterval(() => setNowTick(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const monthPrefix = cursor.slice(0, 7);
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meetings.filter((meeting) => {
      if (channel !== 'all' && channelOf(meeting) !== channel) return false;
      if (!q) return true;
      const haystack = [meeting.customerName, meeting.designerName, meeting.projectId, meeting.quotationTotal, meeting.phone, meeting.salesName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [meetings, query, channel]);

  const monthMeetings = searched.filter((meeting) => meeting.meetingDate.startsWith(monthPrefix));
  const scheduledMonth = monthMeetings.filter((meeting) => matchesBoardFilter(meeting, 'scheduled', monthPrefix, nowTick));
  const successfulMonth = monthMeetings.filter((meeting) => matchesBoardFilter(meeting, 'successful', monthPrefix, nowTick));
  const cancelledMonth = monthMeetings.filter((meeting) => matchesBoardFilter(meeting, 'cancelled', monthPrefix, nowTick));
  const quotesMonth = monthMeetings.filter((meeting) => matchesBoardFilter(meeting, 'quotes', monthPrefix, nowTick));
  const delayedMonth = monthMeetings.filter((meeting) => matchesBoardFilter(meeting, 'delayed', monthPrefix, nowTick));
  const todayChip = searched.filter((meeting) => meeting.meetingDate === today && matchesBoardFilter(meeting, 'scheduled', today.slice(0, 7), nowTick)).length;
  const cancelPercent = monthMeetings.length ? Math.round((cancelledMonth.length / monthMeetings.length) * 100) : 0;

  const visibleDays = span === 'month' ? monthCells(cursor) : span === 'week' ? Array.from({ length: 7 }, (_, index) => addDaysIso(startOfWeek(cursor), index)) : [cursor];
  const nowMinutes = kolkataMinutes(nowTick);

  const todayMeetings = sortMeetings(searched.filter((meeting) => meeting.meetingDate === today));
  const activeToday = todayMeetings.filter((meeting) => !isCancelled(meeting) && !isCompleted(meeting));
  const live = activeToday.find((meeting) => {
    const start = meetingMinutes(meeting);
    return start != null && nowMinutes >= start && nowMinutes < start + SLOT_MINUTES;
  });
  const nextMeeting = activeToday.find((meeting) => {
    const start = meetingMinutes(meeting);
    return start != null && start > nowMinutes;
  });
  const urgent = activeToday.filter((meeting) => {
    const start = meetingMinutes(meeting);
    return start != null && start > nowMinutes && start - nowMinutes <= 30;
  });
  const hideUrgent = urgentHiddenDay === today;

  const shift = (direction: number) => {
    if (span === 'month') {
      const match = /^(\d{4})-(\d{2})/.exec(cursor);
      if (!match) return;
      const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + direction, 1));
      setCursor(date.toISOString().slice(0, 10));
      return;
    }
    setCursor(addDaysIso(cursor, direction * (span === 'week' ? 7 : 1)));
  };

  const cards: { id: BoardFilter; label: string; value: number; note: string; tone: string }[] = [
    { id: 'scheduled', label: 'Scheduled', value: scheduledMonth.length, note: `${todayChip} today`, tone: 'border-blue-200 bg-blue-50/60' },
    { id: 'successful', label: 'Meeting successful', value: successfulMonth.length, note: 'Completed this month', tone: 'border-emerald-200 bg-emerald-50/60' },
    { id: 'cancelled', label: 'Cancelled', value: cancelledMonth.length, note: `${cancelPercent}% of this month`, tone: 'border-rose-200 bg-rose-50/70' },
    { id: 'quotes', label: 'Quotes sent', value: quotesMonth.length, note: 'Meetings with a quote', tone: 'border-amber-200 bg-amber-50/70' },
    { id: 'delayed', label: 'Quote delayed', value: delayedMonth.length, note: 'Open 4 hours after success', tone: 'border-[#EF0101]/30 bg-[#FFF5F5]' },
  ];

  return (
    <div className="mm-cal bg-[#F1F2F6]">
      <style>{`
        @keyframes mm-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .mm-rise { animation: mm-rise .42s cubic-bezier(.2,.7,.2,1) both; }
        .mm-card { transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease; }
        .mm-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(50, 38, 28, .1); border-color: #DDCDC1; }
        .mm-block { transition: transform .18s ease, box-shadow .18s ease; }
        .mm-block:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(50, 38, 28, .12); z-index: 5; }
        .mm-now { box-shadow: 0 0 0 3px rgba(239, 1, 1, .15); animation: mm-pulse 1.8s ease-in-out infinite; }
        @keyframes mm-pulse { 50% { opacity: .55; } }
      `}</style>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card, index) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onOpenFilteredList(card.id, monthPrefix, channel)}
            className={`mm-rise mm-card rounded-2xl border border-[#DDCDC1]/80 bg-white px-4 py-3 text-left shadow-sm ${card.tone}`}
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <div className="text-xs font-medium text-[#32261C]/60">{card.label}</div>
            <div className="mt-1 flex items-end justify-between gap-2">
              <span className="text-2xl font-semibold text-[#32261C]">{loading ? '…' : card.value}</span>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[#32261C]/70">{card.note}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <button type="button" onClick={() => shift(-1)} className="rounded-2xl border border-[#DDCDC1] bg-white px-3 py-2 text-sm text-[#32261C] transition duration-200 hover:-translate-y-0.5 hover:border-[#EF0101] hover:text-[#EF0101] hover:shadow-md">←</button>
        <button type="button" onClick={() => shift(1)} className="rounded-2xl border border-[#DDCDC1] bg-white px-3 py-2 text-sm text-[#32261C] transition duration-200 hover:-translate-y-0.5 hover:border-[#EF0101] hover:text-[#EF0101] hover:shadow-md">→</button>
        <div className="min-w-[160px] text-sm font-semibold text-[#32261C]">{span === 'day' ? dayTitle(cursor) : monthTitle(cursor)}</div>
        <button type="button" onClick={() => { setCursor(today); setSpan('week'); }} className="rounded-2xl bg-[#32261C] px-3.5 py-2 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#EF0101] hover:shadow-[0_8px_18px_rgba(239,1,1,0.28)]">Today</button>
        <div className="flex rounded-2xl bg-white p-1 shadow-sm">
          {(['day', 'week', 'month'] as Span[]).map((item) => (
            <button key={item} type="button" onClick={() => setSpan(item)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold capitalize transition duration-200 ${span === item ? 'bg-[#EF0101] text-white shadow-[0_6px_14px_rgba(239,1,1,0.25)]' : 'text-[#32261C]/70 hover:bg-[#F1F2F6]'}`}>{item}</button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {([
            ['all', 'All'],
            ['showroom', 'Showroom visit'],
            ['virtual', 'Virtual meeting'],
            ['site', 'Site visit'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setChannel(id)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-200 ${channel === id ? 'border-[#EF0101] bg-[#EF0101] text-white shadow-[0_6px_14px_rgba(239,1,1,0.22)]' : 'border-[#DDCDC1] bg-white text-[#32261C]/70 hover:-translate-y-0.5 hover:border-[#32261C]/30 hover:shadow-sm'}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 px-4 pb-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="mm-rise overflow-hidden rounded-3xl border border-[#DDCDC1] bg-white shadow-[0_12px_32px_rgba(50,38,28,0.05)]">
          {span === 'month' ? (
            <MonthGrid days={visibleDays} monthPrefix={monthPrefix} today={today} meetings={searched} onOpenDay={(day) => { setCursor(day); setSpan('day'); }} />
          ) : (
            <TimeGrid
              days={visibleDays}
              meetings={searched}
              today={today}
              monthPrefix={monthPrefix}
              nowMinutes={nowMinutes}
              onSelect={setSelected}
              onOpenPile={(date, hour, items) => setPile({ date, hour, meetings: items })}
              onSchedule={(date, minutes) => { setScheduleSlot({ date, minutes }); setScheduleNote(''); setScheduleMessage(null); }}
            />
          )}
        </div>
        <aside className="space-y-3">
          <section className="mm-rise rounded-3xl border border-[#DDCDC1] bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#32261C]/45">Live / next</h3>
            {live ? <SideMeeting meeting={live} kicker="On the clock" /> : nextMeeting ? <SideMeeting meeting={nextMeeting} kicker="Up next" /> : <p className="mt-3 text-sm text-[#32261C]/50">No meeting is on the clock.</p>}
          </section>
          <section className="rounded-3xl border border-[#DDCDC1] bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#32261C]/45">Today&apos;s schedule</h3>
              <span className="rounded-full bg-[#F4F6FA] px-2 py-0.5 text-[11px] font-semibold text-[#32261C]/60">{activeToday.length} left</span>
            </div>
            <div className={`mt-3 space-y-1 ${todayMeetings.length > 5 ? 'max-h-[220px] overflow-y-auto pr-1' : ''}`}>
              {todayMeetings.length === 0 ? <p className="text-sm text-[#32261C]/45">Nothing scheduled today.</p> : todayMeetings.map((meeting) => {
                const designer = designerLabel(meeting.designerName);
                return (
                  <button key={meeting.id || `${meeting.leadId}-${meeting.meetingTime}`} type="button" onClick={() => setSelected(meeting)} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition duration-200 hover:translate-x-0.5 hover:bg-[#DDCDC1]/25">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass(meeting)}`} />
                    <span className="w-16 shrink-0 text-xs font-semibold text-[#32261C]">{meeting.meetingTimeLabel || meeting.meetingTime || '—'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#32261C]">{meeting.customerName}</span>
                      {designer ? <span className="block truncate text-xs text-[#32261C]/45">{designer}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {todayMeetings.length > 5 ? <p className="mt-2 text-[11px] font-medium text-[#32261C]/45">Showing 5 of {todayMeetings.length}</p> : null}
          </section>
          {!hideUrgent && urgent.length > 0 ? (
            <section className="mm-rise rounded-3xl border border-[#EBD457] bg-[#EBD457]/25 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#32261C]">Starting soon</h3>
                <button type="button" onClick={() => { window.localStorage.setItem(URGENT_KEY, today); setUrgentHiddenDay(today); }} className="text-xs font-semibold text-[#32261C]/60 transition hover:text-[#EF0101]">Hide for now</button>
              </div>
              <p className="mt-1 text-xs text-[#32261C]/60">Open meetings in the next 30 minutes</p>
              <div className="mt-2 space-y-1">
                {urgent.map((meeting) => (
                  <button key={`u-${meeting.id}`} type="button" onClick={() => setSelected(meeting)} className="block w-full rounded-xl bg-white/80 px-2 py-1.5 text-left text-sm font-medium text-[#32261C] transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
                    {meeting.meetingTimeLabel || meeting.meetingTime} · {meeting.customerName}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {selected ? (
        <button type="button" className="fixed inset-0 z-40 bg-[#32261C]/30 backdrop-blur-[2px]" onClick={() => setSelected(null)} aria-label="Close meeting" />
      ) : null}
      {selected ? <MeetingCard meeting={selected} onClose={() => setSelected(null)} onReschedule={onReschedule} /> : null}
      {pile ? (
        <HourPile
          hour={pile.hour}
          meetings={pile.meetings}
          onClose={() => setPile(null)}
          onSelect={(meeting) => { setPile(null); setSelected(meeting); }}
          onSchedule={() => { setScheduleSlot({ date: pile.date, minutes: pile.hour }); setScheduleNote(''); setScheduleMessage(null); setPile(null); }}
        />
      ) : null}
      {scheduleSlot ? (
        <ScheduleForm
          slot={scheduleSlot}
          note={scheduleNote}
          message={scheduleMessage}
          onNote={setScheduleNote}
          onClose={() => setScheduleSlot(null)}
          onSave={() => setScheduleMessage('Schedule this meeting on the lead. Saving here does not create it.')}
        />
      ) : null}
    </div>
  );
}

function SideMeeting({ meeting, kicker }: { meeting: CalendarMeeting; kicker: string }) {
  const style = CHANNEL_STYLE[channelOf(meeting)];
  return (
    <div className={`mt-3 rounded-xl border px-3 py-3 ${style.chip}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide">{kicker}</div>
      <div className="mt-1 text-sm font-semibold">{meeting.customerName}</div>
      <div className="text-xs opacity-80">{meeting.meetingTimeLabel || meeting.meetingTime || 'Time not set'}{designerLabel(meeting.designerName) ? ` · ${designerLabel(meeting.designerName)}` : ''}</div>
    </div>
  );
}

function TimeGrid({
  days,
  meetings,
  today,
  monthPrefix,
  nowMinutes,
  onSelect,
  onOpenPile,
  onSchedule,
}: {
  days: string[];
  meetings: CalendarMeeting[];
  today: string;
  monthPrefix: string;
  nowMinutes: number;
  onSelect: (meeting: CalendarMeeting) => void;
  onOpenPile: (date: string, hour: number, meetings: CalendarMeeting[]) => void;
  onSchedule: (date: string, minutes: number) => void;
}) {
  const hours = gridHours(nowMinutes);
  const nowHour = Math.floor(nowMinutes / 60) * 60;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <div className="grid border-b border-[#F1F3F7]" style={{ gridTemplateColumns: `88px repeat(${days.length}, minmax(140px,1fr))` }}>
          <div className="px-2 py-3 text-[11px] font-semibold text-[#32261C]/40">GMT+5:30</div>
          {days.map((day) => {
            const count = meetings.filter((meeting) => meeting.meetingDate === day).length;
            const beside = day.slice(0, 7) !== monthPrefix;
            const isToday = day === today;
            return (
              <div key={day} className={`px-2 py-3 text-center ${isToday ? 'bg-emerald-50' : beside ? 'bg-blue-50' : ''}`}>
                <div className={`text-xs font-medium ${isToday ? 'text-emerald-700' : 'text-[#32261C]/45'}`}>{new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8))).toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isToday ? 'bg-emerald-600 text-white' : 'text-[#32261C]'}`}>{Number(day.slice(8))}</div>
                <div className="mt-1 text-[10px] font-semibold text-[#32261C]/40">{count} meeting{count === 1 ? '' : 's'}</div>
              </div>
            );
          })}
        </div>
        {hours.map((hour) => (
          <div key={hour} className="grid border-t border-[#F3F5F8]" style={{ gridTemplateColumns: `88px repeat(${days.length}, minmax(140px,1fr))` }}>
            <div className="px-2 py-3 text-[11px] font-medium text-[#32261C]/40">{formatClock(hour)}</div>
            {days.map((day) => {
              const inCell = sortMeetings(meetings.filter((meeting) => meeting.meetingDate === day && Math.floor((meetingMinutes(meeting) ?? -1) / 60) * 60 === hour && onHourGrid(meetingMinutes(meeting))));
              const isToday = day === today;
              const beside = day.slice(0, 7) !== monthPrefix;
              const showLine = isToday && hour === nowHour;
              return (
                <div
                  key={`${day}-${hour}`}
                  onDoubleClick={() => { if (inCell.length === 0) onSchedule(day, hour); }}
                  className={`relative min-h-[92px] border-l border-[#F6F7FB] p-1 ${isToday ? 'bg-emerald-50/70' : beside ? 'bg-blue-50/80' : ''}`}
                >
                  {showLine ? <div className="mm-now pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-[#EF0101]" style={{ top: `${(nowMinutes % 60) / 60 * 100}%` }} /> : null}
                  <HourContents meetings={inCell} onSelect={onSelect} onOpenPile={() => onOpenPile(day, hour, inCell)} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function HourContents({
  meetings,
  onSelect,
  onOpenPile,
}: {
  meetings: CalendarMeeting[];
  onSelect: (meeting: CalendarMeeting) => void;
  onOpenPile: () => void;
}) {
  if (meetings.length === 0) return null;
  if (meetings.length === 1) {
    const meeting = meetings[0];
    const minutes = meetingMinutes(meeting);
    const designer = designerLabel(meeting.designerName);
    const extra = hasQuote(meeting) ? formatInr(meeting.quotationTotal) : designer;
    return (
      <button type="button" onClick={() => onSelect(meeting)} onDoubleClick={(event) => event.stopPropagation()} className={`mm-block h-full w-full rounded-xl border px-2 py-1.5 text-left ${CHANNEL_STYLE[channelOf(meeting)].chip}`}>
        <div className="text-[11px] font-semibold">{minutes == null ? '' : formatClock(minutes)}</div>
        <div className="truncate text-sm font-semibold">{meeting.customerName}</div>
        <div className="truncate text-[11px] opacity-80">{CHANNEL_STYLE[channelOf(meeting)].label}</div>
        {extra ? <div className="truncate text-[11px] font-medium">{extra}</div> : null}
      </button>
    );
  }
  if (meetings.length <= 4) {
    return (
      <div className="flex flex-col gap-0.5">
        {meetings.map((meeting) => {
          const minutes = meetingMinutes(meeting);
          return (
            <button key={meeting.id || `${meeting.leadId}-${minutes}`} type="button" onClick={() => onSelect(meeting)} onDoubleClick={(event) => event.stopPropagation()} className="flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition duration-200 hover:translate-x-0.5 hover:bg-white hover:shadow-sm">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass(meeting)}`} />
              <span className="w-9 shrink-0 text-[11px] font-semibold text-[#32261C]">{minutes == null ? '' : shortTime(minutes)}</span>
              <span className="truncate text-xs text-[#32261C]">{meeting.customerName}</span>
            </button>
          );
        })}
      </div>
    );
  }
  const dots = meetings.slice(0, 3);
  return (
    <button type="button" onClick={onOpenPile} onDoubleClick={(event) => event.stopPropagation()} className="mm-block h-full w-full rounded-xl border border-[#E7EAF0] bg-white px-2 py-1.5 text-left hover:border-[#EF0101]/30">
      <div className="text-sm font-semibold text-[#32261C]">{meetings.length} meetings</div>
      <div className="mt-1 flex gap-1">{dots.map((meeting) => <span key={meeting.id || meeting.leadId} className={`h-2 w-2 rounded-full ${dotClass(meeting)}`} />)}</div>
      <div className="mt-1 truncate text-[11px] text-[#32261C]/70">{meetings[0].customerName}, {meetings[1].customerName} +{meetings.length - 2} more</div>
    </button>
  );
}

function MonthGrid({
  days,
  monthPrefix,
  today,
  meetings,
  onOpenDay,
}: {
  days: string[];
  monthPrefix: string;
  today: string;
  meetings: CalendarMeeting[];
  onOpenDay: (day: string) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-[#F1F3F7] text-center text-[11px] font-semibold uppercase tracking-wide text-[#32261C]/40">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day} className="py-2">{day}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day.startsWith(monthPrefix);
          const dayMeetings = sortMeetings(meetings.filter((meeting) => meeting.meetingDate === day));
          const items = dayMeetings.slice(0, 2);
          const extra = dayMeetings.length - items.length;
          const isToday = day === today;
          return (
            <div key={day} className={`min-h-[104px] border-b border-r border-[#DDCDC1]/50 p-2 text-left transition duration-200 hover:bg-[#DDCDC1]/20 ${isToday ? 'bg-emerald-50' : inMonth ? 'bg-white' : 'bg-blue-50'}`}>
              <button type="button" onClick={() => onOpenDay(day)} className="flex items-center gap-1">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-emerald-600 text-white' : 'text-[#32261C]'}`}>{Number(day.slice(8))}</span>
                <span className="text-[10px] font-semibold text-[#32261C]/40">{dayMeetings.length}</span>
              </button>
              <div className="mt-1 space-y-1">
                {items.map((meeting) => {
                  const minutes = meetingMinutes(meeting);
                  const label = `${minutes == null ? '' : `${formatClock(minutes)} `}${meeting.customerName}`;
                  return (
                    <div key={meeting.id || `${meeting.leadId}-${meeting.meetingTime}`} className="truncate text-[10px] font-medium text-[#32261C]">{label}</div>
                  );
                })}
                {extra > 0 ? (
                  <button type="button" onClick={() => onOpenDay(day)} className="text-[10px] font-semibold text-[#EF0101] hover:underline">+{extra} more</button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HourPile({
  hour,
  meetings,
  onClose,
  onSelect,
  onSchedule,
}: {
  hour: number;
  meetings: CalendarMeeting[];
  onClose: () => void;
  onSelect: (meeting: CalendarMeeting) => void;
  onSchedule: () => void;
}) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.focus(); }, []);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#32261C]/30 px-4" onClick={onClose}>
      <div className="mm-rise w-full max-w-sm rounded-3xl border border-[#DDCDC1] bg-white p-4 shadow-[0_24px_60px_rgba(50,38,28,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="text-sm font-semibold text-[#32261C]">{meetings.length} meetings · {formatClock(hour)}</div>
        <div
          ref={listRef}
          tabIndex={0}
          className="mt-3 max-h-[220px] space-y-1 overflow-y-auto outline-none"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setIndex((value) => Math.min(meetings.length - 1, value + 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); }
            if (event.key === 'Enter') { event.preventDefault(); onSelect(meetings[index]); }
            if (event.key === 'Escape') onClose();
          }}
        >
          {meetings.map((meeting, row) => {
            const minutes = meetingMinutes(meeting);
            const designer = designerLabel(meeting.designerName);
            return (
              <button
                key={meeting.id || `${meeting.leadId}-${row}`}
                type="button"
                data-active={row === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(meeting)}
                onMouseEnter={() => setIndex(row)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${row === index ? 'bg-[#FFF5F5]' : 'hover:bg-[#FAFBFD]'}`}
              >
                <span className={`h-2 w-2 rounded-full ${dotClass(meeting)}`} />
                <span className="w-16 font-semibold text-[#32261C]">{minutes == null ? '' : formatClock(minutes)}</span>
                <span className="min-w-0 flex-1 truncate">{meeting.customerName}</span>
                {designer ? <span className="truncate text-xs text-[#32261C]/50">{designer}</span> : null}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onSchedule} className="mt-3 w-full rounded-xl border border-dashed border-[#EF0101]/40 px-3 py-2 text-sm font-semibold text-[#EF0101] transition hover:bg-[#FFF5F5]">+ Schedule at {formatClock(hour)}</button>
      </div>
    </div>
  );
}

function ScheduleForm({
  slot,
  note,
  message,
  onNote,
  onClose,
  onSave,
}: {
  slot: { date: string; minutes: number };
  note: string;
  message: string | null;
  onNote: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#32261C]/30 px-4">
      <div className="mm-rise w-full max-w-md rounded-3xl border border-[#DDCDC1] bg-white p-5 shadow-[0_24px_60px_rgba(50,38,28,0.18)]">
        <h3 className="text-base font-semibold text-[#32261C]">Schedule a meeting</h3>
        <p className="mt-1 text-sm text-[#32261C]/55">{dayTitle(slot.date)} · {formatClock(slot.minutes)}</p>
        <label className="mt-4 block text-sm text-[#32261C]/70">
          Note
          <textarea value={note} onChange={(event) => onNote(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-[#E7EAF0] px-3 py-2 text-sm outline-none focus:border-[#EF0101]" placeholder="Optional note" />
        </label>
        {message ? <p className="mt-3 rounded-xl bg-[#FFF5F5] px-3 py-2 text-sm text-[#EF0101]">{message}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-[#E7EAF0] px-3 py-2 text-sm text-[#32261C]">Close</button>
          <button type="button" onClick={onSave} className="rounded-xl bg-[#EF0101] px-3 py-2 text-sm font-semibold text-white">Save</button>
        </div>
      </div>
    </div>
  );
}

function MeetingCard({
  meeting,
  onClose,
  onReschedule,
}: {
  meeting: CalendarMeeting;
  onClose: () => void;
  onReschedule: (meeting: CalendarMeeting) => void;
}) {
  const style = isCancelled(meeting) ? { ...CHANNEL_STYLE.other, label: 'Cancelled', chip: 'bg-rose-50 text-rose-700 border-rose-200', bar: 'bg-rose-400' } : CHANNEL_STYLE[channelOf(meeting)];
  const rows = [
    ['Start', `${dayTitle(meeting.meetingDate)} · ${meeting.meetingTimeLabel || meeting.meetingTime || 'Time not set'}`],
    ['Type', style.label],
    ['Designer', designerLabel(meeting.designerName)],
    ['Sales', meeting.salesName || '—'],
    ['Progress', progressLabel(meeting)],
    ['Experience centre', style.label],
    ['Budget', formatInr(meeting.budget)],
    ['Quote', formatInr(meeting.quotationTotal)],
  ];
  return (
    <div className="mm-rise fixed right-4 top-20 z-50 w-[min(380px,calc(100vw-2rem))] rounded-3xl border border-[#DDCDC1] bg-white p-5 shadow-[0_24px_60px_rgba(50,38,28,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.chip}`}>{style.label}</div>
          <h3 className="mt-2 text-lg font-semibold text-[#32261C]">{meeting.customerName}</h3>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-[#32261C]/40 hover:bg-[#F4F6FA] hover:text-[#32261C]">Close</button>
      </div>
      <dl className="mt-4 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3 text-sm">
            <dt className="text-[#32261C]/45">{label}</dt>
            <dd className="text-right font-medium text-[#32261C]">{value}</dd>
          </div>
        ))}
      </dl>
      {meeting.cancelReason ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{meeting.cancelReason}</p> : null}
      <div className="mt-5 flex gap-2">
        {canReschedule(meeting) ? (
          <button type="button" onClick={() => { onReschedule(meeting); onClose(); }} className="rounded-2xl bg-[#EF0101] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(239,1,1,0.25)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(239,1,1,0.32)]">Reschedule</button>
        ) : null}
        <Link href={`/Leads/${meeting.leadId}`} className="rounded-2xl border border-[#DDCDC1] px-3.5 py-2 text-sm font-semibold text-[#32261C] transition duration-200 hover:-translate-y-0.5 hover:border-[#00B0ED] hover:text-[#00B0ED] hover:shadow-md">Open lead</Link>
      </div>
    </div>
  );
}
