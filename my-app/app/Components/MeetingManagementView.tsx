'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../auth/AuthContext';
import { buildAuthHeaders, getApiBase } from '../lib/apiBase';

/** Who can open Meeting Management. Add roles here when access should widen. */
export function canShowMeetingManagement(role: string | undefined | null): boolean {
  return (role || '').toLowerCase() === 'admin';
}

type ScheduledMeeting = {
  leadId: number;
  projectId: string | null;
  projectName: string | null;
  projectStage: string | null;
  isOnHold: boolean;
  customerName: string;
  phone: string | null;
  salesName: string | null;
  quotationTotal: string | null;
  designerName: string;
  meetingDate: string;
  meetingTime: string | null;
  meetingTimeLabel: string | null;
  meetingType: string | null;
  meetingMode: string | null;
};

const AVATARS = [
  { bg: '#F3E8FF', fg: '#7C3AED' },
  { bg: '#FCE7F3', fg: '#DB2777' },
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#DCFCE7', fg: '#15803D' },
  { bg: '#E0E7FF', fg: '#4338CA' },
  { bg: '#FFEDD5', fg: '#C2410C' },
  { bg: '#E0F2FE', fg: '#0369A1' },
];

function kolkataTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysIso(isoDay: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay);
  if (!match) return isoDay;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

function timeSortKey(meeting: ScheduledMeeting): string {
  const raw = `${meeting.meetingTime || ''} ${meeting.meetingTimeLabel || ''}`;
  const ampm = raw.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
  if (ampm) {
    let hour = Number(ampm[1]) % 12;
    if (ampm[3].toLowerCase() === 'pm') hour += 12;
    return `${String(hour).padStart(2, '0')}:${ampm[2]}`;
  }
  const hm = (meeting.meetingTime || '').match(/^(\d{1,2}):(\d{2})/);
  if (hm) return `${hm[1].padStart(2, '0')}:${hm[2]}`;
  return '99:99';
}

function whenLabel(isoDay: string, today: string): string {
  if (isoDay === today) return 'Today';
  if (isoDay === addDaysIso(today, 1)) return 'Tomorrow';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay);
  if (!match) return isoDay;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function meetingChannel(meeting: ScheduledMeeting): { label: string; kind: 'virtual' | 'showroom' | 'other' } {
  const mode = (meeting.meetingMode || '').trim().toLowerCase();
  if (mode === 'online' || mode === 'virtual' || mode.includes('virtual')) {
    return { label: 'Virtual Meeting', kind: 'virtual' };
  }
  if (mode === 'offline' || mode.includes('showroom') || mode === 'in_person' || mode === 'in-person') {
    return { label: 'Showroom Visit', kind: 'showroom' };
  }
  if (meeting.meetingType) {
    const key = meeting.meetingType.trim().toLowerCase();
    if (key === 'dqc1_first_cut') return { label: 'First cut', kind: 'other' };
    if (key === 'dqc2_material_selection') return { label: 'Material selection', kind: 'other' };
    if (key === 'design_signoff') return { label: 'Design sign-off', kind: 'other' };
    return { label: meeting.meetingType.replace(/_/g, ' '), kind: 'other' };
  }
  return { label: 'Meeting', kind: 'other' };
}

function progressOf(meeting: ScheduledMeeting, today: string): { label: string; className: string } {
  const stage = (meeting.projectStage || '').trim();
  if (/cancel/i.test(stage)) {
    return { label: 'Cancelled', className: 'bg-red-50 text-red-600' };
  }
  if (meeting.isOnHold) {
    return { label: 'On hold', className: 'bg-gray-100 text-gray-600' };
  }
  if (meeting.meetingDate === today) {
    return { label: 'In progress', className: 'bg-amber-50 text-amber-600' };
  }
  return { label: 'Scheduled', className: 'bg-blue-50 text-blue-600' };
}

function formatInr(raw: string | null): string | null {
  if (!raw) return null;
  const numeric = Number(String(raw).replace(/,/g, '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return raw;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numeric);
}

function avatarFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % AVATARS.length;
  return AVATARS[hash];
}

function initial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

export default function MeetingManagementView() {
  const { sessionId } = useAuth();
  const apiBase = getApiBase();
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const today = kolkataTodayIso();

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
    } catch (err) {
      setMeetings([]);
      setError(err instanceof Error ? err.message : 'Failed to load scheduled meetings');
    } finally {
      setLoading(false);
    }
  }, [apiBase, sessionId]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  const ordered = useMemo(() => {
    return [...meetings].sort((a, b) => {
      const aUpcoming = a.meetingDate >= today;
      const bUpcoming = b.meetingDate >= today;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      const byDate = a.meetingDate.localeCompare(b.meetingDate);
      const dateOrder = aUpcoming ? byDate : -byDate;
      if (dateOrder !== 0) return dateOrder;
      const byTime = timeSortKey(a).localeCompare(timeSortKey(b));
      return aUpcoming ? byTime : -byTime;
    });
  }, [meetings, today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((meeting) => {
      const haystack = [
        meeting.customerName,
        meeting.phone,
        meeting.designerName,
        meeting.salesName,
        meeting.projectId,
        meeting.projectName,
        String(meeting.leadId),
        meetingChannel(meeting).label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [ordered, query]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F7FB] px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-[1400px] overflow-hidden rounded-2xl border border-[#EEF1F6] bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#F1F3F7] px-4 py-3 sm:px-5">
          <label className="relative min-w-[240px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by customer, lead ID, designer or phone"
              className="w-full rounded-xl border border-[#E7EAF0] bg-[#FAFBFD] py-2.5 pl-10 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-[#EF0101] focus:bg-white"
            />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full bg-[#F4F6FA] px-3 py-1.5 text-sm font-medium text-gray-500">
              {loading ? '…' : `${filtered.length} meeting${filtered.length === 1 ? '' : 's'}`}
            </span>
            <button
              type="button"
              onClick={() => void loadMeetings()}
              className="rounded-xl border border-[#E7EAF0] px-3 py-2 text-sm font-medium text-gray-600 hover:bg-[#FAFBFD]"
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left">
            <thead>
              <tr className="text-xs font-medium text-gray-400">
                <th className="px-4 py-3 font-medium">No.</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Designer</th>
                <th className="px-3 py-3 font-medium">Progress</th>
                <th className="px-3 py-3 font-medium">Sales</th>
                <th className="px-3 py-3 font-medium">Meeting</th>
                <th className="px-3 py-3 font-medium">Date & time</th>
                <th className="px-3 py-3 font-medium">Lead quote</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-sm text-gray-400">
                    Loading meetings…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-sm text-gray-400">
                    {ordered.length === 0
                      ? 'No scheduled meetings yet.'
                      : 'No meetings match that search.'}
                  </td>
                </tr>
              ) : (
                filtered.map((meeting, index) => {
                  const customerName = meeting.customerName || meeting.projectName || 'Customer';
                  const avatar = avatarFor(customerName);
                  const progress = progressOf(meeting, today);
                  const channel = meetingChannel(meeting);
                  const quote = formatInr(meeting.quotationTotal);
                  const subtitle = meeting.phone || meeting.projectId || `HUB-${meeting.leadId}`;
                  return (
                    <tr key={`${meeting.leadId}-${meeting.meetingDate}`} className="border-t border-[#F3F5F8] hover:bg-[#FAFBFD]">
                      <td className="px-4 py-3.5 text-sm text-gray-400">{index + 1}</td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                            style={{ backgroundColor: avatar.bg, color: avatar.fg }}
                          >
                            {initial(customerName)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-900">{customerName}</div>
                            <div className="truncate text-xs text-gray-400">{subtitle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-sm text-gray-700">{meeting.designerName}</td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${progress.className}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {progress.label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-sm text-gray-600">{meeting.salesName || '—'}</td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                          {channel.kind === 'virtual' ? <VideoIcon /> : <HomeIcon />}
                          {channel.label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="text-sm font-semibold text-emerald-600">{whenLabel(meeting.meetingDate, today)}</div>
                        <div className="text-xs font-medium text-emerald-600">
                          {meeting.meetingTimeLabel || meeting.meetingTime || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-sm text-gray-400">{quote || 'No quote'}</td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/Leads/${meeting.leadId}`}
                          title="Open lead"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7EAF0] text-gray-500 hover:border-[#EF0101] hover:text-[#EF0101]"
                        >
                          <OpenIcon />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.48 9.74l3.14 3.14a.75.75 0 1 0 1.06-1.06l-3.14-3.14A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-400" aria-hidden>
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-3.5a.5.5 0 0 1-.5-.5V14a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v3.5a.5.5 0 0 1-.5.5H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-sky-500" aria-hidden>
      <path d="M3.25 5.5A1.75 1.75 0 0 0 1.5 7.25v5.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0 0 13.5 12.75v-1.19l3.22 2.148a.75.75 0 0 0 1.18-.614V6.906a.75.75 0 0 0-1.18-.614L13.5 8.44V7.25a1.75 1.75 0 0 0-1.75-1.75h-8.5Z" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
      <path d="M11.603 7.17a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
    </svg>
  );
}
