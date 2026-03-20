'use client';

import { useEffect, useMemo, useState } from 'react';
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

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function GoogleCalendarView() {
  const { user, sessionId } = useAuth();
  const [status, setStatus] = useState<{ connected: boolean; googleEmail?: string | null; configured?: boolean }>({
    connected: false,
  });
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [from, setFrom] = useState(() => toInputDate(new Date()));
  const [to, setTo] = useState(() => {
    const next = new Date();
    next.setDate(next.getDate() + 14);
    return toInputDate(next);
  });

  const isAdmin = user?.role === 'admin';
  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${sessionId || ''}`,
    }),
    [sessionId],
  );

  const loadStatus = async () => {
    if (!sessionId) return;
    const res = await fetch(`${getApiBase()}/api/google-calendar/status`, { headers: authHeaders });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || 'Failed to load Google Calendar status');
    setStatus(data);
  };

  const loadEvents = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('timeMin', `${from}T00:00:00+05:30`);
      params.set('timeMax', `${to}T23:59:59+05:30`);
      const path = isAdmin ? '/api/google-calendar/all-events' : '/api/google-calendar/my-events';
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
        throw new Error(data?.message || 'Failed to generate Google connect URL');
      }
      window.location.href = data.authUrl;
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to connect Google Calendar.' });
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/google-calendar/disconnect`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to disconnect Google Calendar');
      setEvents([]);
      await loadStatus();
      setMessage({ type: 'success', text: 'Google Calendar disconnected.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to disconnect Google Calendar.' });
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    loadStatus().catch((err: any) => {
      setMessage({ type: 'error', text: err?.message || 'Failed to load Google Calendar status.' });
    });
  }, [sessionId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcStatus = params.get('gc_status');
    const gcMessage = params.get('gc_message');
    if (gcStatus && gcMessage) {
      setMessage({ type: gcStatus === 'success' ? 'success' : 'error', text: gcMessage });
      window.history.replaceState({}, '', window.location.pathname);
      loadStatus().catch(() => undefined);
    }
  }, []);

  return (
    <div className="p-4 xl:p-6 max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Google Calendar</h1>
        <p className="text-sm text-gray-500">
          {isAdmin
            ? 'Admin can review connected users’ calendar events from this workspace.'
            : 'Connect your Google account once, then view your own meeting events here.'}
        </p>
      </div>

      {message ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Connection</p>
          <div className="mt-4 flex items-center gap-3">
            <span
              className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                status.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {status.connected ? 'Connected' : 'Not connected'}
            </span>
            <button
              type="button"
              onClick={handleConnect}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              {status.connected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
            </button>
            {status.connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Disconnect
              </button>
            ) : null}
          </div>
          <p className="mt-4 text-sm text-gray-600">
            {status.connected
              ? `Connected Google account: ${status.googleEmail || 'Unknown account'}`
              : 'No Google account connected yet.'}
          </p>
          {!status.configured ? (
            <p className="mt-2 text-sm text-amber-700">
              Google Calendar backend credentials are missing. Add them in `backend/.env` before testing.
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filter window</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-700">
              <span className="mb-1 block">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-700">
              <span className="mb-1 block">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={loadEvents}
            disabled={loading}
            className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Load Events'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{isAdmin ? 'All Connected Calendar Events' : 'My Google Calendar Events'}</h2>
            <p className="text-sm text-gray-500">Events are fetched from the connected Google Calendar account(s).</p>
          </div>
          <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-600">
            {events.length} event{events.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="p-5">
          {!events.length ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center text-gray-500">
              No Google Calendar events found for this date range.
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={`${event.ownerEmail || 'owner'}-${event.id}`} className="rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{event.summary}</h3>
                      {event.description ? <p className="mt-2 text-sm text-gray-600">{event.description}</p> : null}
                    </div>
                    <span className="inline-flex rounded-full bg-green-50 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-green-600">
                      {event.status || 'confirmed'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Start</p>
                      <p className="mt-1 text-sm font-medium text-gray-800">{formatDateTime(event.start)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">End</p>
                      <p className="mt-1 text-sm font-medium text-gray-800">{formatDateTime(event.end)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Owner</p>
                      <p className="mt-1 text-sm font-medium text-gray-800">{event.ownerName || '—'}</p>
                      <p className="text-xs text-gray-500">{event.connectedGoogleEmail || event.ownerEmail || ''}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Location</p>
                      <p className="mt-1 text-sm font-medium text-gray-800">{event.location || '—'}</p>
                    </div>
                  </div>
                  {event.htmlLink ? (
                    <div className="mt-4">
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-green-600 hover:underline"
                      >
                        Open in Google Calendar
                      </a>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
