'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { primeNotificationSound } from '../lib/notificationSound';
import { useDesignNotifications, isNotificationUnread, type DesignNotificationItem } from './DesignNotificationProvider';
import {
  formatTimeAgo,
  getCategoryLabel,
  getNotificationListTitle,
  getNotificationSubtitle,
  groupNotificationsByDay,
  matchesNotificationFilter,
  notificationCategoryTone,
  notificationTabIdsForRole,
  notificationVisibleForRole,
  NOTIFICATION_FILTERS,
  quoteLinkFromNotification,
  type NotificationFilterId,
} from './notificationBellHelpers';

type Props = {
  className?: string;
};

function TypeIcon({ type }: { type: string }) {
  const t = (type || '').toUpperCase();
  const common = 'h-4 w-4';
  if (t === 'MEETING') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6.75h15A1.5 1.5 0 0 1 21 8.25v10.5a1.5 1.5 0 0 1-1.5 1.5h-15a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5Z" />
      </svg>
    );
  }
  if (t === 'PAYMENT') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 18.75 4.5h-15A2.25 2.25 0 0 0 1.5 6.75v10.5A2.25 2.25 0 0 0 3.75 19.5Z" />
      </svg>
    );
  }
  if (t === 'DQC' || t === 'PM') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    );
  }
  if (t === 'MMT') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    );
  }
  if (t === 'MILESTONE' || t === 'P2P') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9a2.25 2.25 0 0 1-2.12-1.5L3.15 8.4A.75.75 0 0 1 3.86 7.5h16.28a.75.75 0 0 1 .71.9l-2.23 8.85a2.25 2.25 0 0 1-2.12 1.5ZM12 7.5V3.75" />
      </svg>
    );
  }
  if (t === 'QUOTE' || t === 'QUOTATION') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    );
  }
  if (t === 'LEAD' || t === 'PHASE' || t === 'ASSIGNMENT') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.93 17.93 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.077A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.087m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}

export default function NotificationBell({ className = '' }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<NotificationFilterId>('all');

  const {
    notifications,
    unreadCount,
    isInboxOpen,
    setIsInboxOpen,
    isMuted,
    toggleMute,
    handleMarkRead,
    handleMarkAllRead,
    refreshInbox,
  } = useDesignNotifications();

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsInboxOpen(false);
      }
    }
    if (isInboxOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [isInboxOpen, setIsInboxOpen]);

  const tabs = useMemo(() => {
    const allowed = new Set(notificationTabIdsForRole(user?.role));
    return NOTIFICATION_FILTERS.filter((t) => allowed.has(t.id));
  }, [user?.role]);

  useEffect(() => {
    if (!tabs.some((t) => t.id === filter)) setFilter('all');
  }, [tabs, filter]);

  const roleNotifications = useMemo(
    () => notifications.filter((n) => notificationVisibleForRole(n, user?.role)),
    [notifications, user?.role],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<NotificationFilterId, number> = {
      all: 0,
      lead: 0,
      milestone: 0,
      payment: 0,
      meeting: 0,
      dqc: 0,
      mmt: 0,
      assignment: 0,
      quote: 0,
    };
    for (const item of roleNotifications) {
      if (!isNotificationUnread(item)) continue;
      counts.all += 1;
      for (const f of NOTIFICATION_FILTERS) {
        if (f.id !== 'all' && matchesNotificationFilter(item, f.id)) {
          counts[f.id] += 1;
        }
      }
    }
    return counts;
  }, [roleNotifications]);

  const filtered = useMemo(
    () => roleNotifications.filter((item) => matchesNotificationFilter(item, filter)),
    [roleNotifications, filter],
  );

  const groups = useMemo(() => groupNotificationsByDay(filtered), [filtered]);

  const toggleOpen = () => {
    primeNotificationSound();
    const next = !isInboxOpen;
    setIsInboxOpen(next);
    if (next) refreshInbox();
  };

  const markOneSeen = (id: number) => {
    handleMarkRead(id);
  };

  const openItem = (item: DesignNotificationItem) => {
    markOneSeen(item.id);
    if (item.lead_id && Number(item.lead_id) > 0) {
      setIsInboxOpen(false);
      router.push(`/Leads/${item.lead_id}`);
    }
  };

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-[#32261C]"
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isInboxOpen}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.077A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.087m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isInboxOpen && (
        <div className="absolute right-0 top-full z-[60] mt-2 flex w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-[#32261C]">
              Notifications
              {unreadCount > 0 ? (
                <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount} unread
                </span>
              ) : null}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-emerald-600"
                title="Mark all as read"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-[#32261C]"
                title={isMuted ? 'Unmute sound' : 'Mute sound'}
              >
                {isMuted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53L6.75 15H4.5A1.5 1.5 0 0 1 3 13.5v-3A1.5 1.5 0 0 1 4.5 9h2.25Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53L6.75 15.75H4.5A1.5 1.5 0 0 1 3 14.25v-4.5A1.5 1.5 0 0 1 4.5 8.25h2.25Z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={refreshInbox}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-[#EF0101]"
                title="Refresh"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992M19.92 9.348A8.25 8.25 0 0 0 6.34 6.34L2.985 12.66m0 0A8.25 8.25 0 0 0 16.66 17.66l3.345-6.32" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-b border-gray-100 px-3 py-2 no-scrollbar">
            {tabs.map((tab) => {
              const count = filterCounts[tab.id];
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-[#EF0101] bg-white text-[#32261C]'
                      : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                  {count > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        active ? 'bg-[#EF0101] text-white' : 'bg-red-500 text-white'
                      }`}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="max-h-[min(62vh,460px)] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">No notifications</p>
            ) : (
              groups.map((group) => (
                <div key={group.key}>
                  <p className="sticky top-0 z-[1] bg-gray-50/95 px-4 py-1.5 text-[10px] font-semibold tracking-wide text-gray-400">
                    {group.label}
                  </p>
                  <ul>
                    {group.items.map((item) => {
                      const unread = isNotificationUnread(item);
                      const tone = notificationCategoryTone(item.notification_type || '');
                      const subtitle = getNotificationSubtitle(item);
                      const typeKey = (item.notification_type || '').toUpperCase();
                      const quoteLink = quoteLinkFromNotification(item);

                      return (
                        <li key={item.id}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => markOneSeen(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                markOneSeen(item.id);
                              }
                            }}
                            className={`flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                              unread ? 'bg-red-50/35' : ''
                            }`}
                            title="Click to mark as read"
                          >
                            <span
                              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.iconBg} ${tone.iconText}`}
                            >
                              <TypeIcon type={item.notification_type || ''} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start justify-between gap-2">
                                <span className="text-[13px] font-semibold leading-snug text-[#32261C]">
                                  {getNotificationListTitle(item)}
                                </span>
                                <span className="shrink-0 text-[10px] text-gray-400">
                                  {formatTimeAgo(item.created_at)}
                                </span>
                              </span>
                              {subtitle ? (
                                <span className="mt-0.5 line-clamp-3 block text-[11px] leading-snug text-gray-500">
                                  {subtitle}
                                </span>
                              ) : null}
                              {typeKey === 'QUOTE' && quoteLink ? (
                                <a
                                  href={quoteLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markOneSeen(item.id);
                                  }}
                                  className="mt-1.5 inline-flex rounded-md border border-[#EF0101] px-2 py-0.5 text-[11px] font-semibold text-[#EF0101] hover:bg-[#EF0101]/10"
                                >
                                  Open quotation
                                </a>
                              ) : null}
                              <span className="mt-1.5 flex items-center justify-between gap-2">
                                <span
                                  className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${tone.tagBg} ${tone.tagText}`}
                                >
                                  {getCategoryLabel(typeKey)}
                                </span>
                                <span className="flex items-center gap-2">
                                  {unread ? (
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="Unread" />
                                  ) : null}
                                  {item.lead_id && Number(item.lead_id) > 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openItem(item);
                                      }}
                                      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-[#EF0101]/10 hover:text-[#EF0101]"
                                      title="Open lead"
                                      aria-label="Open lead"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                      </svg>
                                    </button>
                                  ) : (
                                    <span className="text-gray-300">›</span>
                                  )}
                                </span>
                              </span>
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={() => {
                setFilter('all');
                refreshInbox();
              }}
              className="text-xs font-medium text-[#EF0101] hover:underline"
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
