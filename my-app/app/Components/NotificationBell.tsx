'use client';

import { useEffect, useRef } from 'react';
import { primeNotificationSound } from '../lib/notificationSound';
import { useDesignNotifications, isNotificationUnread } from './DesignNotificationProvider';
import {
  formatNotificationPayload,
  formatNotificationTime,
  getNotificationIcon,
} from './notificationBellHelpers';

type Props = {
  /** light = dashboard header; dark = lead / project pages */
  variant?: 'light' | 'dark';
  className?: string;
};

export default function NotificationBell({ variant = 'light', className = '' }: Props) {
  const inboxRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    isInboxOpen,
    setIsInboxOpen,
    isMuted,
    toggleMute,
    handleMarkRead,
    handleMarkAllRead,
  } = useDesignNotifications();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (inboxRef.current && !inboxRef.current.contains(event.target as Node)) {
        setIsInboxOpen(false);
      }
    }
    if (isInboxOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isInboxOpen, setIsInboxOpen]);

  const isDark = variant === 'dark';
  const buttonClass = isDark
    ? `relative rounded-lg border border-gray-500/60 p-2 text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200 shrink-0 ${
        isInboxOpen ? 'bg-white/10 text-white' : ''
      }`
    : `relative rounded-lg border border-gray-200 p-2 text-gray-500 hover:text-[#32261C] hover:bg-gray-100/80 transition-all duration-200 shrink-0 ${
        isInboxOpen ? 'bg-gray-100/80 text-[#32261C]' : ''
      }`;

  return (
    <div className={`relative flex items-center ${className}`} ref={inboxRef}>
      <button
        type="button"
        onClick={() => {
          primeNotificationSound();
          setIsInboxOpen((open) => !open);
        }}
        className={buttonClass}
        title="Notifications"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a3 3 0 0 1-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF0101] text-[9px] font-bold text-white ring-2 ring-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isInboxOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-gray-200 shadow-xl z-[100] p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
            <span className="text-sm font-bold text-[#32261C]">Notifications</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleMute}
                className="text-gray-400 hover:text-gray-700 transition-colors"
                title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
              >
                {isMuted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                  </svg>
                )}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs font-semibold text-[#EF0101] hover:underline"
                  title="Mark all as read"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">No notifications yet.</div>
            ) : (
              notifications.map((item) => {
                const unread = isNotificationUnread(item);
                const payloadText = formatNotificationPayload(item.payload);
                return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (unread) handleMarkRead(item.id);
                  }}
                  disabled={!unread}
                  className={`w-full p-3 rounded-xl border text-left transition-all duration-200 flex items-start gap-3 ${
                    unread
                      ? 'bg-red-50/20 border-red-100 hover:bg-red-50/40 cursor-pointer'
                      : 'border-gray-50 hover:bg-gray-50/60 cursor-default'
                  }`}
                  title={unread ? 'Mark as read' : 'Read'}
                >
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      unread ? 'bg-[#EF0101]/10 text-[#EF0101]' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {getNotificationIcon(item.notification_type || '')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-gray-900 truncate">
                        {item.notification_type} — {item.notification_action?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[9px] text-gray-400 shrink-0">
                        {formatNotificationTime(item.created_at || '')}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1 font-semibold leading-normal">
                      Project: <span className="text-gray-900">{item.project_id}</span> • Lead:{' '}
                      <span className="text-gray-900">{item.lead_name}</span>
                    </p>
                    {payloadText ? (
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-normal italic truncate">
                        {payloadText}
                      </p>
                    ) : null}
                  </div>

                  {unread && (
                    <span
                      className="h-2 w-2 rounded-full bg-[#EF0101] shrink-0 mt-1.5 ring-2 ring-white"
                      aria-hidden="true"
                    />
                  )}
                </button>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-100 pt-2 mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setIsInboxOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
