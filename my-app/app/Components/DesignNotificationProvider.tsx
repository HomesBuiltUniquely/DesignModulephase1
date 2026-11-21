'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import { getApiBase, buildAuthHeaders } from '../lib/apiBase';
import {
  DESIGN_NOTIFICATION_CHIME_EVENT,
  playNotificationChime,
  playNotificationSoundPreview,
  primeNotificationSound,
} from '../lib/notificationSound';
import { notificationVisibleForRole } from './notificationBellHelpers';

/** Inbox list page size — counts badge must use the same visible set as the panel. */
const INBOX_LIST_LIMIT = 200;

function isNetworkFetchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|load failed|fetch failed/i.test(msg);
}

/** Never throw — inbox keeps polling if the API or notify service is down. */
async function fetchInboxSafe(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (!isNetworkFetchError(err)) {
      console.warn('[notification] request failed:', err instanceof Error ? err.message : err);
    }
    return null;
  }
}

function countVisibleUnread(
  list: DesignNotificationItem[],
  role: string | null | undefined,
): number {
  return list.reduce((n, item) => {
    if (!isNotificationUnread(item)) return n;
    if (!notificationVisibleForRole(item, role)) return n;
    return n + 1;
  }, 0);
}

export type DesignNotificationItem = {
  id: number;
  event_id?: string;
  user_id?: number;
  recipient_role?: string;
  lead_id?: number;
  project_id?: string;
  lead_name?: string;
  designer_id?: number;
  notification_type?: string;
  notification_action?: string;
  payload?: unknown;
  created_at?: string;
  read_at?: string | null;
};

export function isNotificationUnread(item: DesignNotificationItem): boolean {
  return item.read_at == null || item.read_at === '';
}

type DesignNotificationContextValue = {
  notifications: DesignNotificationItem[];
  unreadCount: number;
  isInboxOpen: boolean;
  setIsInboxOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isMuted: boolean;
  toggleMute: () => void;
  handleMarkRead: (id: number) => void;
  handleMarkAllRead: () => void;
  refreshInbox: () => void;
};

const DesignNotificationContext = createContext<DesignNotificationContextValue | null>(null);

/** Backup poll interval when WebSocket is down. */
const POLL_MS_FALLBACK = 20_000;

export function useDesignNotifications(): DesignNotificationContextValue {
  const ctx = useContext(DesignNotificationContext);
  if (!ctx) {
    throw new Error('useDesignNotifications must be used within DesignNotificationProvider');
  }
  return ctx;
}

export function DesignNotificationProvider({ children }: { children: ReactNode }) {
  const { user, sessionId } = useAuth();
  const apiBase = getApiBase();

  const [notifications, setNotifications] = useState<DesignNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const inboxStreamAbortRef = useRef<AbortController | null>(null);
  const isMutedRef = useRef(isMuted);
  const prevUnreadRef = useRef(0);
  const inboxCountsReadyRef = useRef(false);
  const knownIdsRef = useRef<Set<number> | null>(null);
  const wsLiveRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const isNewInboxEvent = (data: { reason?: string }) =>
    data.reason !== 'read' && data.reason !== 'read-all';

  useEffect(() => {
    inboxCountsReadyRef.current = false;
    prevUnreadRef.current = 0;
    knownIdsRef.current = null;
    wsLiveRef.current = false;
  }, [sessionId, user?.id]);

  useEffect(() => {
    const onUserGesture = () => primeNotificationSound();
    window.addEventListener('pointerdown', onUserGesture, { passive: true });
    window.addEventListener('keydown', onUserGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onUserGesture);
      window.removeEventListener('keydown', onUserGesture);
    };
  }, []);

  useEffect(() => {
    try {
      const savedMute = localStorage.getItem('design-module-notifications-muted');
      if (savedMute === 'true') setIsMuted(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem('design-module-notifications-muted', next.toString());
      if (!next) playNotificationSoundPreview();
      return next;
    });
  };

  const applyListAndMaybeChime = useCallback(
    (list: DesignNotificationItem[], allowChime: boolean) => {
      const nextIds = new Set(list.map((n) => n.id));

      if (knownIdsRef.current === null) {
        knownIdsRef.current = nextIds;
      } else if (allowChime && !isMutedRef.current) {
        const hasNewUnread = list.some(
          (n) => !knownIdsRef.current!.has(n.id) && isNotificationUnread(n),
        );
        if (hasNewUnread) {
          playNotificationChime();
        }
      }

      knownIdsRef.current = nextIds;
      setNotifications(list);
    },
    [],
  );

  const refreshInbox = useCallback(
    async (options?: { allowChime?: boolean }) => {
      if (!sessionId || !user || refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      const allowChime = options?.allowChime ?? false;

      try {
        const headers = buildAuthHeaders(sessionId);
        const [listRes, countRes] = await Promise.all([
          fetchInboxSafe(`${apiBase}/v1/design/inbox?user_id=${user.id}&limit=${INBOX_LIST_LIMIT}`, {
            headers,
            credentials: 'include',
          }),
          fetchInboxSafe(`${apiBase}/v1/design/inbox/counts?user_id=${user.id}`, {
            headers,
            credentials: 'include',
          }),
        ]);

        let list: DesignNotificationItem[] | null = null;
        if (listRes?.ok) {
          const json = await listRes.json().catch(() => ({}));
          if (Array.isArray(json?.data)) list = json.data as DesignNotificationItem[];
        }

        if (list) {
          applyListAndMaybeChime(list, allowChime);
          // Badge must match the panel: role-visible unread in the loaded list.
          // Server total includes every type + older rows outside the list limit (caused 99+ vs All 26).
          const visibleUnread = countVisibleUnread(list, user.role);
          prevUnreadRef.current = visibleUnread;
          inboxCountsReadyRef.current = true;
          setUnreadCount(visibleUnread);
        } else if (countRes?.ok) {
          const countJson = await countRes.json().catch(() => ({}));
          const total = Number(countJson?.data?.total);
          if (Number.isFinite(total)) {
            const countIncreased =
              inboxCountsReadyRef.current && total > prevUnreadRef.current;
            if (allowChime && countIncreased && !isMutedRef.current) {
              playNotificationChime();
            }
            inboxCountsReadyRef.current = true;
            prevUnreadRef.current = total;
            setUnreadCount(total);
          }
        }
      } catch (err) {
        if (!isNetworkFetchError(err)) {
          console.warn('[notification] refresh failed:', err instanceof Error ? err.message : err);
        }
      } finally {
        refreshInFlightRef.current = false;
      }
    },
    [sessionId, user, apiBase, applyListAndMaybeChime],
  );

  const handleMarkRead = (id: number) => {
    if (!sessionId || !user) return;

    let markedUnread = false;
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (!target || !isNotificationUnread(target)) return prev;
      markedUnread = true;
      const readAt = new Date().toISOString();
      return prev.map((n) => (n.id === id ? { ...n, read_at: readAt } : n));
    });

    if (markedUnread && prevUnreadRef.current > 0) {
      prevUnreadRef.current -= 1;
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    void fetchInboxSafe(`${apiBase}/v1/design/inbox/${id}/read`, {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(sessionId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: user.id }),
      credentials: 'include',
    }).then(async (r) => {
      if (!r) return;
      const res = await r.json().catch(() => ({}));
      if (!r.ok || !(res?.ok || res?.success)) {
        console.warn('[notification] mark read failed', r.status);
      }
      void refreshInbox();
    });
  };

  const handleMarkAllRead = () => {
    if (!sessionId || !user) return;

    setNotifications((prev) =>
      prev.map((n) => (isNotificationUnread(n) ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    prevUnreadRef.current = 0;
    setUnreadCount(0);

    void fetchInboxSafe(`${apiBase}/v1/design/inbox/read-all`, {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(sessionId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: user.id }),
      credentials: 'include',
    }).then(async (r) => {
      if (!r) return;
      const res = await r.json().catch(() => ({}));
      if (!r.ok || !(res?.ok || res?.success)) {
        console.warn('[notification] mark all read failed', r.status);
      }
      void refreshInbox();
    });
  };

  useEffect(() => {
    const onChime = () => {
      if (!isMutedRef.current) playNotificationChime();
      void refreshInbox({ allowChime: false });
    };
    window.addEventListener(DESIGN_NOTIFICATION_CHIME_EVENT, onChime);
    return () => window.removeEventListener(DESIGN_NOTIFICATION_CHIME_EVENT, onChime);
  }, [refreshInbox]);

  useEffect(() => {
    if (!sessionId || !user) return;
    void refreshInbox();
  }, [sessionId, user, refreshInbox]);

  useEffect(() => {
    if (!isInboxOpen || !sessionId || !user) return;
    void refreshInbox();
  }, [isInboxOpen, sessionId, user, refreshInbox]);

  // Backup poll so inbox updates even if WebSocket is down
  useEffect(() => {
    if (!sessionId || !user) return;

    const poll = () => {
      if (document.visibilityState === 'hidden') return;
      void refreshInbox({ allowChime: true });
    };

    const interval = setInterval(poll, POLL_MS_FALLBACK);
    return () => clearInterval(interval);
  }, [sessionId, user, refreshInbox]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshInbox({ allowChime: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshInbox]);

  useEffect(() => {
    if (!sessionId || !user) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let active = true;
    const abort = new AbortController();
    inboxStreamAbortRef.current = abort;

    const scheduleReconnect = () => {
      wsLiveRef.current = false;
      if (!active) return;
      if (reconnectAttempt >= 2) return;
      const delay = Math.min(1000 * 2 ** reconnectAttempt, 8000);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        void connect();
      }, delay);
    };

    const handleInboxEvent = (raw: string) => {
      try {
        const data = JSON.parse(raw);
        if (!data || data.type === 'inbox_stream_open') {
          if (data?.type === 'inbox_stream_open') {
            wsLiveRef.current = true;
            reconnectAttempt = 0;
            void refreshInbox({ allowChime: false });
          }
          return;
        }
        if (data.type !== 'inbox_updated') return;
        void refreshInbox({ allowChime: isNewInboxEvent(data) });
      } catch {
        /* ignore non-json keepalive */
      }
    };

    const connect = async () => {
      if (!active) return;
      try {
        const res = await fetch(`${apiBase}/v1/design/inbox/stream`, {
          headers: buildAuthHeaders(sessionId),
          credentials: 'include',
          signal: abort.signal,
        });
        if (!res.ok || !res.body) {
          if (res.status !== 401 && res.status !== 403 && reconnectAttempt === 0) {
            console.warn('[notification] inbox stream unavailable', res.status, '— inbox will keep polling');
          }
          scheduleReconnect();
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (active) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';
          for (const frame of frames) {
            const dataLine = frame
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('');
            if (dataLine) handleInboxEvent(dataLine);
          }
        }
        scheduleReconnect();
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        if (reconnectAttempt === 0) {
          console.warn('[notification] inbox stream failed — inbox will keep polling');
        }
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      active = false;
      wsLiveRef.current = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      abort.abort();
      inboxStreamAbortRef.current = null;
    };
  }, [sessionId, user, apiBase, refreshInbox]);

  const value: DesignNotificationContextValue = {
    notifications,
    unreadCount,
    isInboxOpen,
    setIsInboxOpen,
    isMuted,
    toggleMute,
    handleMarkRead,
    handleMarkAllRead,
    refreshInbox: () => {
      void refreshInbox();
    },
  };

  return (
    <DesignNotificationContext.Provider value={value}>
      {children}
    </DesignNotificationContext.Provider>
  );
}
