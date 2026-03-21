'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

type CalendarEventItem = {
  id: string;
  summary: string;
  description?: string;
  htmlLink?: string;
  status?: string;
  location?: string;
  start?: string | null;
  end?: string | null;
  ownerName?: string;
  ownerEmail?: string;
  connectedGoogleEmail?: string;
};

type PositionedEvent = CalendarEventItem & {
  startDate: Date;
  endDate: Date;
  dayIndex: number;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  isAllDay: boolean;
};

const HOUR_HEIGHT = 56;
const DAY_START_HOUR = 0;
const DAY_END_HOUR = 23;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, index) => DAY_START_HOUR + index);
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function endOfWeek(date: Date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayHeader(date: Date) {
  return date.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatMiniMonthLabel(date: Date) {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getEventDates(event: CalendarEventItem) {
  const startDate = event.start ? new Date(event.start) : null;
  const endDate = event.end ? new Date(event.end) : startDate;

  if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) {
    return null;
  }

  return { startDate, endDate };
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function buildMiniCalendarDays(anchorDate: Date) {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function buildPositionedEvents(events: CalendarEventItem[], weekStart: Date): PositionedEvent[] {
  const weekEnd = endOfWeek(weekStart);
  const segments: Array<PositionedEvent> = [];

  for (const event of events) {
    const parsed = getEventDates(event);
    if (!parsed) continue;

    const { startDate, endDate } = parsed;
    const clippedStart = new Date(Math.max(startDate.getTime(), weekStart.getTime()));
    const clippedEnd = new Date(Math.min(endDate.getTime(), weekEnd.getTime()));

    if (clippedStart > clippedEnd) continue;

    let current = startOfDay(clippedStart);
    while (current <= clippedEnd) {
      const dayIndex = Math.floor((current.getTime() - startOfWeek(current).getTime()) / (24 * 60 * 60 * 1000));
      const segmentStart = isSameDay(current, startDate)
        ? new Date(startDate)
        : new Date(current.getFullYear(), current.getMonth(), current.getDate(), DAY_START_HOUR, 0, 0, 0);
      const segmentEnd = isSameDay(current, endDate)
        ? new Date(endDate)
        : new Date(current.getFullYear(), current.getMonth(), current.getDate(), DAY_END_HOUR, 0, 0, 0);

      const isAllDay =
        startDate.getHours() === 0 &&
        startDate.getMinutes() === 0 &&
        endDate.getHours() === 0 &&
        endDate.getMinutes() === 0 &&
        startDate.getDate() !== endDate.getDate();

      if (!isAllDay) {
        const startMinutes = Math.max((segmentStart.getHours() - DAY_START_HOUR) * 60 + segmentStart.getMinutes(), 0);
        const endMinutes = Math.min((segmentEnd.getHours() - DAY_START_HOUR) * 60 + segmentEnd.getMinutes(), (DAY_END_HOUR - DAY_START_HOUR) * 60);
        const durationMinutes = Math.max(endMinutes - startMinutes, 30);

        segments.push({
          ...event,
          startDate,
          endDate,
          dayIndex,
          top: (startMinutes / 60) * HOUR_HEIGHT,
          height: Math.max((durationMinutes / 60) * HOUR_HEIGHT, 34),
          column: 0,
          totalColumns: 1,
          isAllDay: false,
        });
      }

      current = addDays(current, 1);
    }
  }

  const byDay = Array.from({ length: 7 }, (_, index) => segments.filter((event) => event.dayIndex === index && !event.isAllDay));

  byDay.forEach((dayEvents) => {
    dayEvents.sort((a, b) => a.top - b.top || a.height - b.height);
    const columns: PositionedEvent[][] = [];

    dayEvents.forEach((event) => {
      let placed = false;
      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        const lastEvent = columns[columnIndex][columns[columnIndex].length - 1];
        if (lastEvent.top + lastEvent.height <= event.top) {
          columns[columnIndex].push(event);
          event.column = columnIndex;
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([event]);
        event.column = columns.length - 1;
      }
    });

    dayEvents.forEach((event) => {
      event.totalColumns = Math.max(columns.length, 1);
    });
  });

  return segments;
}

function EventDetailsPopover({
  event,
  onClose,
}: {
  event: CalendarEventItem | null;
  onClose: () => void;
}) {
  if (!event) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/20 px-4 py-10" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-[28px] border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-start gap-4">
            <span className="mt-1 h-4 w-4 rounded-full bg-[#1a73e8]" />
            <div>
              <h3 className="text-[30px] font-normal text-[#1f1f1f]">{event.summary || 'Untitled event'}</h3>
              <p className="mt-1 text-[15px] text-[#444746]">
                {formatDateTime(event.start)} {event.end ? `- ${formatTime(new Date(event.end))}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close event details"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-6 py-6 text-[15px] text-[#3c4043]">
          <div className="grid gap-4 sm:grid-cols-[28px_1fr]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 h-6 w-6 text-[#5f6368]">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V10h14v9Z" />
            </svg>
            <div>
              <p>{formatDateTime(event.start)}</p>
              <p className="text-[#5f6368]">{event.end ? `Ends ${formatDateTime(event.end)}` : 'No end time provided'}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[28px_1fr]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 h-6 w-6 text-[#5f6368]">
              <path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4Zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            </svg>
            <div>
              <p className="font-medium text-[#1f1f1f]">{event.ownerName || 'Calendar owner'}</p>
              <p className="text-[#5f6368]">{event.connectedGoogleEmail || event.ownerEmail || 'No owner email'}</p>
            </div>
          </div>

          {(event.location || event.description) && (
            <div className="grid gap-4 sm:grid-cols-[28px_1fr]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 h-6 w-6 text-[#5f6368]">
                <path d="M21 5v14H3V5h18Zm0-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-2 12H5v-2h14v2Zm0-4H5V9h14v2Z" />
              </svg>
              <div className="space-y-2">
                {event.location ? <p>{event.location}</p> : null}
                {event.description ? <p className="whitespace-pre-wrap text-[#5f6368]">{event.description}</p> : null}
              </div>
            </div>
          )}

          {event.htmlLink ? (
            <div className="pt-2">
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-[#dadce0] px-4 py-2 text-sm font-medium text-[#1a73e8] transition hover:bg-[#e8f0fe]"
              >
                Open in HUB Calendar
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function GoogleCalendarView() {
  const { user, sessionId } = useAuth();
  const [status, setStatus] = useState<{ connected: boolean; googleEmail?: string | null; configured?: boolean }>({
    connected: false,
  });
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const role = (user?.role || '').toLowerCase();
  const canSeeAllEvents = role === 'admin' || role === 'territorial_design_manager';
  const canSeeOwnerLabels = role === 'admin' || role === 'territorial_design_manager' || role === 'design_manager' || role === 'mmt_manager';
  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);
  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const miniCalendarDays = useMemo(() => buildMiniCalendarDays(currentDate), [currentDate]);
  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${sessionId || ''}`,
    }),
    [sessionId],
  );

  const positionedEvents = useMemo(() => buildPositionedEvents(events, weekStart), [events, weekStart]);
  const todayIndex = useMemo(() => weekDays.findIndex((day) => isSameDay(day, currentTime)), [weekDays, currentTime]);
  const currentTimeOffset = useMemo(() => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return (minutes / 60) * HOUR_HEIGHT;
  }, [currentTime]);
  const sidebarEvents = useMemo(() => {
    return [...events]
      .map((event) => {
        const parsed = getEventDates(event);
        return parsed ? { ...event, sortTime: parsed.startDate.getTime() } : null;
      })
      .filter((event): event is CalendarEventItem & { sortTime: number } => Boolean(event))
      .sort((a, b) => a.sortTime - b.sortTime)
      .slice(0, 6);
  }, [events]);

  const loadStatus = async () => {
    if (!sessionId) return;
    const res = await fetch(`${getApiBase()}/api/google-calendar/status`, { headers: authHeaders });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || 'Failed to load HUB Calendar status');
    setStatus(data);
  };

  const loadEvents = async (targetWeekStart = weekStart) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('timeMin', `${toInputDate(targetWeekStart)}T00:00:00+05:30`);
      params.set('timeMax', `${toInputDate(endOfWeek(targetWeekStart))}T23:59:59+05:30`);
      const path = canSeeAllEvents ? '/api/google-calendar/all-events' : '/api/google-calendar/my-events';
      const res = await fetch(`${getApiBase()}${path}?${params.toString()}`, { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to load calendar events');
      setEvents(Array.isArray(data?.events) ? data.events : []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to load calendar events.' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/google-calendar/connect-url`, { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.authUrl) {
        throw new Error(data?.message || 'Failed to generate HUB Calendar connect URL');
      }
      window.location.href = data.authUrl;
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to connect HUB Calendar.' });
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/google-calendar/disconnect`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to disconnect HUB Calendar');
      setEvents([]);
      await loadStatus();
      setMessage({ type: 'success', text: 'HUB Calendar disconnected.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to disconnect HUB Calendar.' });
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    loadStatus().catch((err: any) => {
      setMessage({ type: 'error', text: err?.message || 'Failed to load HUB Calendar status.' });
    });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    loadEvents(weekStart).catch(() => undefined);
  }, [sessionId, weekStart, canSeeAllEvents]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcStatus = params.get('gc_status');
    const gcMessage = params.get('gc_message');
    if (gcStatus && gcMessage) {
      setMessage({ type: gcStatus === 'success' ? 'success' : 'error', text: gcMessage });
      window.history.replaceState({}, '', window.location.pathname);
      loadStatus().catch(() => undefined);
      loadEvents(weekStart).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const container = scrollAreaRef.current;
    if (!container) return;

    const targetHour = isSameDay(currentDate, currentTime) ? currentTime.getHours() : 8;
    const top = Math.max(targetHour * HOUR_HEIGHT - 160, 0);
    container.scrollTo({ top, behavior: 'smooth' });
  }, [currentDate, currentTime, weekStart]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#f8fafd] text-[#1f1f1f]">
      <div className="flex flex-col xl:flex-row">
        <aside className="w-full border-b border-[#dadce0] bg-white px-4 py-5 xl:min-h-[calc(100vh-56px)] xl:w-[300px] xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f0fe] text-xl font-semibold text-[#1a73e8]">20</div>
            <div>
              <h1 className="text-[34px] font-normal leading-none">Calendar</h1>
              <p className="mt-1 text-sm text-[#5f6368]">
                {role === 'admin'
                  ? 'Admin view of all connected calendars'
                  : role === 'territorial_design_manager'
                    ? 'TDM view of all connected calendars'
                    : role === 'design_manager'
                      ? 'Your events plus all designer events under you'
                      : role === 'mmt_manager'
                        ? 'Your events plus all MMT executive events under you'
                      : 'Your HUB Calendar events in one place'}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#dadce0] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleConnect}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[#0b57d0] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0842a0]"
              >
                {status.connected ? 'Reconnect' : 'Connect HUB'}
              </button>
              {status.connected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex items-center justify-center rounded-full border border-[#dadce0] px-4 py-2.5 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f1f3f4]"
                >
                  Disconnect
                </button>
              ) : null}
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <p className="font-medium text-[#1f1f1f]">{status.connected ? 'Connected' : 'Not connected'}</p>
              <p className="text-[#5f6368]">{status.connected ? status.googleEmail || 'Unknown account' : 'Connect once to sync calendar events.'}</p>
              {!status.configured ? <p className="text-[#b3261e]">Backend HUB Calendar credentials are missing in `backend/.env`.</p> : null}
            </div>
          </div>

          <div className="mt-6 rounded-[28px] bg-white px-4 py-5 shadow-sm ring-1 ring-[#dadce0]">
            <div className="mb-4 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => setCurrentDate((prev) => addDays(prev, -30))}
                className="rounded-full p-2 text-[#5f6368] transition hover:bg-[#f1f3f4]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="m15.41 16.59-4.58-4.59 4.58-4.59L14 6l-6 6 6 6z" />
                </svg>
              </button>
              <p className="text-[15px] font-medium text-[#3c4043]">{formatMiniMonthLabel(currentDate)}</p>
              <button
                type="button"
                onClick={() => setCurrentDate((prev) => addDays(prev, 30))}
                className="rounded-full p-2 text-[#5f6368] transition hover:bg-[#f1f3f4]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-2 text-center text-xs text-[#5f6368]">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="font-medium">
                  {label[0]}
                </div>
              ))}
              {miniCalendarDays.map((day) => {
                const inMonth = day.getMonth() === currentDate.getMonth();
                const isToday = isSameDay(day, new Date());
                const isSelected = isSameDay(day, currentDate);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setCurrentDate(day)}
                    className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                      isSelected
                        ? 'bg-[#c2e7ff] font-semibold text-[#001d35]'
                        : isToday
                          ? 'bg-[#1a73e8] font-semibold text-white'
                          : inMonth
                            ? 'text-[#1f1f1f] hover:bg-[#f1f3f4]'
                            : 'text-[#9aa0a6] hover:bg-[#f1f3f4]'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 rounded-[28px] bg-white px-4 py-5 shadow-sm ring-1 ring-[#dadce0]">
            <p className="text-[15px] font-medium text-[#3c4043]">{canSeeOwnerLabels ? 'Visible events this week' : 'Meet with...'}</p>
            <div className="mt-4 space-y-3">
              {sidebarEvents.length ? (
                sidebarEvents.map((event) => (
                  <button
                    key={`sidebar-${event.ownerEmail || 'owner'}-${event.id}`}
                    type="button"
                    onClick={() => setSelectedEvent(event)}
                    className="w-full rounded-2xl border border-[#dadce0] px-4 py-3 text-left transition hover:bg-[#f8fafd]"
                  >
                    <p className="truncate text-sm font-medium text-[#1f1f1f]">{event.summary || 'Untitled event'}</p>
                    <p className="mt-1 text-xs text-[#5f6368]">{formatDateTime(event.start)}</p>
                    {canSeeOwnerLabels && event.ownerName ? <p className="mt-1 text-xs text-[#0b57d0]">{event.ownerName}</p> : null}
                  </button>
                ))
              ) : (
                <p className="text-sm text-[#5f6368]">No events scheduled for this week yet.</p>
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="border-b border-[#dadce0] bg-white px-4 py-4 xl:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentDate(startOfDay(new Date()))}
                  className="rounded-full border border-[#dadce0] px-6 py-2.5 text-[15px] font-medium text-[#1f1f1f] transition hover:bg-[#f1f3f4]"
                >
                  Today
                </button>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setCurrentDate((prev) => addDays(prev, -7))}
                    className="rounded-full p-2 text-[#5f6368] transition hover:bg-[#f1f3f4]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                      <path d="m15.41 16.59-4.58-4.59 4.58-4.59L14 6l-6 6 6 6z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentDate((prev) => addDays(prev, 7))}
                    className="rounded-full p-2 text-[#5f6368] transition hover:bg-[#f1f3f4]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                      <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                    </svg>
                  </button>
                </div>
                <h2 className="text-[34px] font-normal text-[#1f1f1f]">{formatMonthLabel(currentDate)}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => loadEvents(weekStart)}
                  className="rounded-full border border-[#dadce0] px-5 py-2.5 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f1f3f4]"
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
                <div className="rounded-full border border-[#dadce0] px-5 py-2.5 text-sm font-medium text-[#1f1f1f]">Week</div>
              </div>
            </div>
            {message ? (
              <div
                className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                  message.type === 'success' ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fce8e6] text-[#b3261e]'
                }`}
              >
                {message.text}
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto bg-[#f8fafd] px-4 py-5 xl:px-8">
            <div className="min-w-[980px] overflow-hidden rounded-[32px] bg-white shadow-sm ring-1 ring-[#dadce0]">
              <div className="grid grid-cols-[96px_repeat(7,minmax(0,1fr))] border-b border-[#dadce0]">
                <div className="border-r border-[#dadce0] bg-white px-4 py-5 text-right text-sm text-[#5f6368]">GMT+05:30</div>
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={day.toISOString()} className="border-r border-[#dadce0] px-4 py-3 last:border-r-0">
                      <p className={`text-center text-[12px] font-semibold tracking-[0.08em] ${isToday ? 'text-[#1a73e8]' : 'text-[#5f6368]'}`}>
                        {formatDayHeader(day)}
                      </p>
                      <div className="mt-2 flex items-center justify-center">
                        <span
                          className={`flex h-[54px] w-[54px] items-center justify-center rounded-full text-[34px] font-normal leading-none ${
                            isToday ? 'bg-[#1a73e8] text-white shadow-[0_1px_2px_rgba(26,115,232,0.35)]' : 'text-[#1f1f1f]'
                          }`}
                        >
                          {day.getDate()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div ref={scrollAreaRef} className="max-h-[calc(100vh-220px)] overflow-y-auto">
                <div className="grid grid-cols-[96px_1fr]">
                  <div className="border-r border-[#dadce0] bg-white">
                    {HOURS.map((hour) => (
                      <div key={hour} className="relative h-[56px] border-b border-[#edf0f2] px-4 text-right text-sm text-[#5f6368]">
                        <span className="-translate-y-3 absolute right-4 top-0 bg-white px-1">{formatTime(new Date(2026, 0, 1, hour, 0, 0, 0))}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {weekDays.map((day, dayIndex) => {
                      const dayEvents = positionedEvents.filter((event) => event.dayIndex === dayIndex);
                      const showCurrentTime = dayIndex === todayIndex && currentTimeOffset >= 0 && currentTimeOffset <= HOURS.length * HOUR_HEIGHT;

                      return (
                        <div key={`grid-${day.toISOString()}`} className="relative border-r border-[#dadce0] last:border-r-0" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
                          {HOURS.map((hour) => (
                            <div key={`${day.toISOString()}-${hour}`} className="h-[56px] border-b border-[#edf0f2]" />
                          ))}

                          {showCurrentTime ? (
                            <div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top: `${currentTimeOffset}px` }}>
                              <div className="absolute -left-[8px] top-[-6px] h-3.5 w-3.5 rounded-full bg-[#d93025]" />
                              <div className="h-[2px] w-full bg-[#d93025]" />
                            </div>
                          ) : null}

                          {dayEvents.map((event) => {
                            const gap = 8;
                            const width = `calc(${100 / event.totalColumns}% - ${gap}px)`;
                            const left = `calc(${(100 / event.totalColumns) * event.column}% + ${gap / 2}px)`;
                            return (
                              <button
                                key={`${event.ownerEmail || 'owner'}-${event.id}-${event.dayIndex}-${event.column}`}
                                type="button"
                                onClick={() => setSelectedEvent(event)}
                                className="absolute z-10 overflow-hidden rounded-2xl border border-[#1a73e8] bg-[#e8f0fe] px-2 py-1.5 text-left text-[#0b57d0] shadow-sm transition hover:bg-[#d2e3fc]"
                                style={{
                                  top: `${event.top}px`,
                                  left,
                                  width,
                                  height: `${event.height}px`,
                                }}
                                title={event.summary}
                              >
                                <p className="truncate text-[13px] font-medium leading-4">{event.summary || 'Untitled event'}</p>
                                <p className="mt-1 truncate text-xs leading-4 text-[#174ea6]">
                                  {formatTime(event.startDate)} - {formatTime(event.endDate)}
                                </p>
                                {canSeeOwnerLabels && event.ownerName ? <p className="mt-1 truncate text-[11px] text-[#1967d2]">{event.ownerName}</p> : null}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <EventDetailsPopover event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
