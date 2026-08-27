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

  const wsRef = useRef<WebSocket | null>(null);
  const isMutedRef = useRef(isMuted);
  const prevUnreadRef = useRef(0);
  const inboxCountsReadyRef = useRef(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const isNewInboxEvent = (data: { reason?: string }) =>
    data.reason !== 'read' && data.reason !== 'read-all';

  useEffect(() => {
    inboxCountsReadyRef.current = false;
    prevUnreadRef.current = 0;
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

  const loadNotifications = useCallback(() => {
    if (!sessionId || !user) return;
    fetch(`${apiBase}/v1/design/inbox?user_id=${user.id}`, {
      headers: buildAuthHeaders(sessionId),
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((res) => {
        if (res && Array.isArray(res.data)) {
          setNotifications(res.data);
        }
      })
      .catch((err) => console.error('Failed to load notifications:', err));
  }, [sessionId, user, apiBase]);

  const loadUnreadCount = useCallback(
    (options?: { allowChime?: boolean }) => {
      if (!sessionId || !user) return;
      fetch(`${apiBase}/v1/design/inbox/counts?user_id=${user.id}`, {
        headers: buildAuthHeaders(sessionId),
        credentials: 'include',
      })
        .then((r) => r.json())
        .then((res) => {
          if (!res?.data) return;
          const total = Number(res.data.total) || 0;
          const prev = prevUnreadRef.current;

          if (!inboxCountsReadyRef.current) {
            inboxCountsReadyRef.current = true;
            prevUnreadRef.current = total;
            setUnreadCount(total);
            return;
          }

          const countIncreased = total > prev;
          if (!isMutedRef.current && options?.allowChime && countIncreased) {
            playNotificationChime();
          }

          prevUnreadRef.current = total;
          setUnreadCount(total);
        })
        .catch((err) => console.error('Failed to load notification counts:', err));
    },
    [sessionId, user, apiBase],
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

    fetch(`${apiBase}/v1/design/inbox/${id}/read`, {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(sessionId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: user.id }),
      credentials: 'include',
    })
      .then(async (r) => {
        const res = await r.json().catch(() => ({}));
        if (r.ok && (res?.ok || res?.success)) {
          loadNotifications();
          loadUnreadCount();
          return;
        }
        console.error('[notification] mark read failed', r.status, res);
        loadNotifications();
        loadUnreadCount();
      })
      .catch((err) => {
        console.error('Failed to mark read:', err);
        loadNotifications();
        loadUnreadCount();
      });
  };

  const handleMarkAllRead = () => {
    if (!sessionId || !user) return;

    setNotifications((prev) =>
      prev.map((n) => (isNotificationUnread(n) ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    prevUnreadRef.current = 0;
    setUnreadCount(0);

    fetch(`${apiBase}/v1/design/inbox/read-all`, {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(sessionId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: user.id }),
      credentials: 'include',
    })
      .then(async (r) => {
        const res = await r.json().catch(() => ({}));
        if (r.ok && (res?.ok || res?.success)) {
          loadNotifications();
          loadUnreadCount();
          return;
        }
        console.error('[notification] mark all read failed', r.status, res);
        loadNotifications();
        loadUnreadCount();
      })
      .catch((err) => {
        console.error('Failed to mark all read:', err);
        loadNotifications();
        loadUnreadCount();
      });
  };

  useEffect(() => {
    const onChime = () => {
      if (!isMutedRef.current) playNotificationChime();
      loadNotifications();
      loadUnreadCount({ allowChime: true });
    };
    window.addEventListener(DESIGN_NOTIFICATION_CHIME_EVENT, onChime);
    return () => window.removeEventListener(DESIGN_NOTIFICATION_CHIME_EVENT, onChime);
  }, [loadNotifications, loadUnreadCount]);

  useEffect(() => {
    if (!sessionId || !user) return;
    loadNotifications();
    loadUnreadCount();
  }, [sessionId, user, loadNotifications, loadUnreadCount]);

  useEffect(() => {
    if (!isInboxOpen || !sessionId || !user) return;
    loadNotifications();
    loadUnreadCount();
  }, [isInboxOpen, sessionId, user, loadNotifications, loadUnreadCount]);

  useEffect(() => {
    if (!sessionId || !user) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let active = true;

    const scheduleReconnect = () => {
      if (!active) return;
      const delay = Math.min(1000 * 2 ** reconnectAttempt, 15000);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (!active) return;

      fetch(`${apiBase}/v1/design/inbox/ws-ticket`, {
        method: 'POST',
        headers: {
          ...buildAuthHeaders(sessionId),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id }),
        credentials: 'include',
      })
        .then((r) => {
          if (!r.ok) throw new Error(`ws-ticket HTTP ${r.status}`);
          return r.json();
        })
        .then((res) => {
          if (!active || !res || !res.ticket) {
            scheduleReconnect();
            return;
          }

          const wsUrl =
            typeof res.ws_url === 'string' && res.ws_url
              ? res.ws_url
              : `ws://localhost:8080/v1/design/inbox/ws?ticket=${encodeURIComponent(res.ticket)}`;
          socket = new WebSocket(wsUrl);
          wsRef.current = socket;

          socket.onopen = () => {
            reconnectAttempt = 0;
          };

          socket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (!data || data.type !== 'inbox_updated') return;

              if (!isNewInboxEvent(data)) {
                loadNotifications();
                loadUnreadCount();
                return;
              }

              if (!isMutedRef.current) playNotificationChime();
              window.setTimeout(() => {
                loadNotifications();
                loadUnreadCount({ allowChime: true });
              }, 350);
            } catch (e) {
              console.error('Error parsing WebSocket message:', e);
            }
          };

          socket.onerror = () => {
            console.warn('Notification WebSocket error');
          };

          socket.onclose = () => {
            if (!active) return;
            scheduleReconnect();
          };
        })
        .catch((err) => {
          console.error('Failed to establish WebSocket connection:', err);
          scheduleReconnect();
        });
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
      wsRef.current = null;
    };
  }, [sessionId, user, apiBase, loadNotifications, loadUnreadCount]);

  const refreshInbox = useCallback(() => {
    loadNotifications();
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  const value: DesignNotificationContextValue = {
    notifications,
    unreadCount,
    isInboxOpen,
    setIsInboxOpen,
    isMuted,
    toggleMute,
    handleMarkRead,
    handleMarkAllRead,
    refreshInbox,
  };

  return (
    <DesignNotificationContext.Provider value={value}>
      {children}
    </DesignNotificationContext.Provider>
  );
}
