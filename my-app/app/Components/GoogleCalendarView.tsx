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
            <span className="mt-1 h-4 w-4 rounded-full bg-[#EF0101]" />
            <div>
              <h3 className="text-[30px] font-normal text-gray-900">{event.summary || 'Untitled event'}</h3>
              <p className="mt-1 text-[15px] text-gray-700">
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

        <div className="space-y-5 px-6 py-6 text-[15px] text-gray-800">
          <div className="grid gap-4 sm:grid-cols-[28px_1fr]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 h-6 w-6 text-gray-600">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V10h14v9Z" />
            </svg>
            <div>
              <p>{formatDateTime(event.start)}</p>
              <p className="text-gray-600">{event.end ? `Ends ${formatDateTime(event.end)}` : 'No end time provided'}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[28px_1fr]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 h-6 w-6 text-gray-600">
              <path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4Zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            </svg>
            <div>
              <p className="font-medium text-gray-900">{event.ownerName || 'Calendar owner'}</p>
              <p className="text-gray-600">{event.connectedGoogleEmail || event.ownerEmail || 'No owner email'}</p>
            </div>
          </div>

          {(event.location || event.description) && (
            <div className="grid gap-4 sm:grid-cols-[28px_1fr]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 h-6 w-6 text-gray-600">
                <path d="M21 5v14H3V5h18Zm0-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-2 12H5v-2h14v2Zm0-4H5V9h14v2Z" />
              </svg>
              <div className="space-y-2">
                {event.location ? <p>{event.location}</p> : null}
                {event.description ? <p className="whitespace-pre-wrap text-gray-600">{event.description}</p> : null}
              </div>
            </div>
          )}

          {event.htmlLink ? (
            <div className="pt-2">
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-[#EF0101] transition hover:bg-[#EF0101]/10"
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
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const miniCalendarRef = useRef<HTMLDivElement | null>(null);
  const agendaRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const role = (user?.role || '').toLowerCase();
  const canSeeAllEvents = role === 'admin' || role === 'deputy_general_manager';
  const canSeeOwnerLabels =
    role === 'admin' ||
    role === 'deputy_general_manager' ||
    role === 'territorial_design_manager' ||
    role === 'design_manager';
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
  const weekEvents = useMemo(() => {
    return [...events]
      .map((event) => {
        const parsed = getEventDates(event);
        return parsed ? { ...event, sortTime: parsed.startDate.getTime() } : null;
      })
      .filter((event): event is CalendarEventItem & { sortTime: number } => Boolean(event))
      .sort((a, b) => a.sortTime - b.sortTime);
  }, [events]);

  const roleDescription =
    role === 'admin'
      ? 'All connected calendars'
      : role === 'deputy_general_manager'
        ? 'All connected calendars'
        : role === 'territorial_design_manager'
          ? 'Your events plus your design team'
          : role === 'design_manager'
            ? 'Your events plus designers under you'
            : 'Your events in one place';

  const shiftMonth = (delta: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

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

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (miniCalendarRef.current && !miniCalendarRef.current.contains(target)) {
        setShowMiniCalendar(false);
      }
      if (agendaRef.current && !agendaRef.current.contains(target)) {
        setShowAgenda(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col bg-white text-gray-900">
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight text-gray-900 lg:text-2xl">HUB Calendar</h1>
              <p className="truncate text-xs text-gray-500">{roleDescription}</p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentDate(startOfDay(new Date()))}
              className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
            >
              Today
            </button>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setCurrentDate((prev) => addDays(prev, -7))}
                className="rounded-full p-1.5 text-gray-600 transition hover:bg-gray-100"
                aria-label="Previous week"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="m15.41 16.59-4.58-4.59 4.58-4.59L14 6l-6 6 6 6z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setCurrentDate((prev) => addDays(prev, 7))}
                className="rounded-full p-1.5 text-gray-600 transition hover:bg-gray-100"
                aria-label="Next week"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                </svg>
              </button>
            </div>
            <div className="relative" ref={miniCalendarRef}>
              <button
                type="button"
                onClick={() => {
                  setShowMiniCalendar((open) => !open);
                  setShowAgenda(false);
                  setShowAccountMenu(false);
                }}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-gray-50"
              >
                <h2 className="text-lg font-medium text-gray-900 lg:text-xl">{formatMonthLabel(currentDate)}</h2>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`h-4 w-4 text-gray-500 transition ${showMiniCalendar ? 'rotate-180' : ''}`}>
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>
              {showMiniCalendar ? (
                <div className="absolute left-0 top-full z-30 mt-2 w-[300px] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <button type="button" onClick={() => shiftMonth(-1)} className="rounded-full p-2 text-gray-600 transition hover:bg-gray-100" aria-label="Previous month">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                        <path d="m15.41 16.59-4.58-4.59 4.58-4.59L14 6l-6 6 6 6z" />
                      </svg>
                    </button>
                    <p className="text-sm font-medium text-gray-800">{formatMiniMonthLabel(currentDate)}</p>
                    <button type="button" onClick={() => shiftMonth(1)} className="rounded-full p-2 text-gray-600 transition hover:bg-gray-100" aria-label="Next month">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                        <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-gray-500">
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
                          onClick={() => {
                            setCurrentDate(day);
                            setShowMiniCalendar(false);
                          }}
                          className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                            isSelected
                              ? 'bg-[#EF0101]/15 font-semibold text-[#EF0101]'
                              : isToday
                                ? 'bg-[#EF0101] font-semibold text-white'
                                : inMonth
                                  ? 'text-gray-900 hover:bg-gray-100'
                                  : 'text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={agendaRef}>
              <button
                type="button"
                onClick={() => {
                  setShowAgenda((open) => !open);
                  setShowMiniCalendar(false);
                  setShowAccountMenu(false);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
              >
                Agenda
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{weekEvents.length}</span>
              </button>
              {showAgenda ? (
                <div className="absolute right-0 top-full z-30 mt-2 w-[340px] max-w-[90vw] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">{canSeeOwnerLabels ? 'Events this week' : 'Your week'}</p>
                    <p className="text-xs text-gray-500">Tap an event to open details</p>
                  </div>
                  <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
                    {weekEvents.length ? (
                      weekEvents.map((event) => (
                        <button
                          key={`agenda-${event.ownerEmail || 'owner'}-${event.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowAgenda(false);
                          }}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-left transition hover:bg-gray-50"
                        >
                          <p className="truncate text-sm font-medium text-gray-900">{event.summary || 'Untitled event'}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{formatDateTime(event.start)}</p>
                          {canSeeOwnerLabels && event.ownerName ? <p className="mt-0.5 text-xs text-[#EF0101]">{event.ownerName}</p> : null}
                        </button>
                      ))
                    ) : (
                      <p className="px-1 py-6 text-center text-sm text-gray-500">No events scheduled for this week yet.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => loadEvents(weekStart)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700">Week</span>

            {!status.connected ? (
              <button
                type="button"
                onClick={handleConnect}
                className="rounded-lg bg-[#EF0101] px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-[#EF0101]/90"
              >
                Connect calendar
              </button>
            ) : (
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountMenu((open) => !open);
                    setShowMiniCalendar(false);
                    setShowAgenda(false);
                  }}
                  className="inline-flex max-w-[260px] items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm transition hover:bg-gray-50"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <span className="truncate text-gray-800">{status.googleEmail || 'Connected'}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-gray-500">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
                {showAccountMenu ? (
                  <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                    <p className="px-2 py-1.5 text-xs text-gray-500">Connected account</p>
                    <p className="truncate px-2 pb-2 text-sm font-medium text-gray-900">{status.googleEmail || 'Unknown account'}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountMenu(false);
                        handleConnect();
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-800 transition hover:bg-gray-50"
                    >
                      Reconnect
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountMenu(false);
                        handleDisconnect();
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#b3261e] transition hover:bg-red-50"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
        {message ? (
          <div
            className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${
              message.type === 'success' ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fce8e6] text-[#b3261e]'
            }`}
          >
            {message.text}
          </div>
        ) : null}
        {!status.configured ? (
          <p className="mt-3 text-sm text-[#b3261e]">Backend HUB Calendar credentials are missing in `backend/.env`.</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="flex h-full min-w-[980px] flex-col">
          <div className="grid shrink-0 grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-gray-200">
            <div className="px-2 py-3 text-right text-[11px] text-gray-400">GMT+05:30</div>
            {weekDays.map((day) => {
              const isToday = isSameDay(day, new Date());
              const isSelected = isSameDay(day, currentDate);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setCurrentDate(day)}
                  className="border-l border-gray-100 px-2 py-2 transition hover:bg-gray-50"
                >
                  <p className={`text-center text-[11px] font-semibold tracking-[0.08em] ${isToday ? 'text-[#EF0101]' : 'text-gray-500'}`}>
                    {formatDayHeader(day)}
                  </p>
                  <div className="mt-1 flex items-center justify-center">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none ${
                        isToday
                          ? 'bg-[#EF0101] font-semibold text-white'
                          : isSelected
                            ? 'bg-[#EF0101]/10 font-medium text-[#EF0101]'
                            : 'text-gray-900'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-[72px_1fr]">
              <div className="border-r border-gray-100 bg-white">
                {HOURS.map((hour) => (
                  <div key={hour} className="relative h-[56px] border-b border-gray-100 px-2 text-right text-xs text-gray-400">
                    <span className="absolute right-2 top-0 -translate-y-2 bg-white px-1">{formatTime(new Date(2026, 0, 1, hour, 0, 0, 0))}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {weekDays.map((day, dayIndex) => {
                  const dayEvents = positionedEvents.filter((event) => event.dayIndex === dayIndex);
                  const showCurrentTime = dayIndex === todayIndex && currentTimeOffset >= 0 && currentTimeOffset <= HOURS.length * HOUR_HEIGHT;

                  return (
                    <div key={`grid-${day.toISOString()}`} className="relative border-l border-gray-100" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
                      {HOURS.map((hour) => (
                        <div key={`${day.toISOString()}-${hour}`} className="h-[56px] border-b border-gray-100" />
                      ))}

                      {showCurrentTime ? (
                        <div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top: `${currentTimeOffset}px` }}>
                          <div className="absolute -left-[6px] top-[-5px] h-3 w-3 rounded-full bg-[#EF0101]" />
                          <div className="h-[2px] w-full bg-[#EF0101]" />
                        </div>
                      ) : null}

                      {dayEvents.map((event) => {
                        const gap = 6;
                        const width = `calc(${100 / event.totalColumns}% - ${gap}px)`;
                        const left = `calc(${(100 / event.totalColumns) * event.column}% + ${gap / 2}px)`;
                        return (
                          <button
                            key={`${event.ownerEmail || 'owner'}-${event.id}-${event.dayIndex}-${event.column}`}
                            type="button"
                            onClick={() => setSelectedEvent(event)}
                            className="absolute z-10 overflow-hidden rounded-lg border border-[#EF0101]/25 bg-[#EF0101]/10 px-2 py-1 text-left transition hover:bg-[#EF0101]/15"
                            style={{
                              top: `${event.top}px`,
                              left,
                              width,
                              height: `${event.height}px`,
                            }}
                            title={event.summary}
                          >
                            <p className="truncate text-[12px] font-semibold leading-4 text-[#EF0101]">{event.summary || 'Untitled event'}</p>
                            <p className="mt-0.5 truncate text-[11px] leading-4 text-[#32261C]">
                              {formatTime(event.startDate)} - {formatTime(event.endDate)}
                            </p>
                            {canSeeOwnerLabels && event.ownerName ? <p className="mt-0.5 truncate text-[11px] text-[#32261C]">{event.ownerName}</p> : null}
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

      <EventDetailsPopover event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
