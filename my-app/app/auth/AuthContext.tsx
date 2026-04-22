'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getApiBase } from '@/app/lib/apiBase';

export type AuthRole = 'admin' | 'territorial_design_manager' | 'deputy_general_manager' | 'design_manager' | 'designer' | 'dqc_manager' | 'dqe' | 'mmt_manager' | 'mmt_executive' | 'finance' | 'project_manager' | 'escalation_manager';

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: AuthRole;
  profileImage?: string;
};

const STORAGE_KEY = 'design_module_auth';

type StoredAuth = { user: AuthUser; sessionId: string } | null;

const AuthContext = createContext<{
  user: AuthUser | null;
  sessionId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: true; user: AuthUser } | { success: false; message?: string }>;
  logout: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
  refreshUser: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const data: StoredAuth = raw ? JSON.parse(raw) : null;
      if (data?.user && data?.sessionId) {
        setUserState(data.user);
        setSessionId(data.sessionId);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
    if (!u) setSessionId(null);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: true; user: AuthUser } | { success: false; message: string }> => {
    const res = await fetch(`${getApiBase()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    let data: { user?: AuthUser; sessionId?: string; message?: string } = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return { success: false, message: 'Invalid response from server' };
    }
    if (!res.ok) return { success: false, message: data.message || 'Login failed' };
    const { user: u, sessionId: sid } = data;
    if (!u || !sid) return { success: false, message: 'Invalid response' };
    setUserState(u);
    setSessionId(sid);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: u, sessionId: sid }));
    return { success: true, user: u };
  }, []);

  const logout = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch(`${getApiBase()}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionId}` },
        });
      } catch (_) {}
    }
    setUserState(null);
    setSessionId(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [sessionId]);

  const refreshUser = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${getApiBase()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${sessionId}` },
      });
      if (!res.ok) return;
      const text = await res.text();
      let u: AuthUser | null = null;
      try {
        u = text ? JSON.parse(text) : null;
      } catch {
        return; // response was not JSON (e.g. HTML 404)
      }
      if (!u) return;
      setUserState(u);
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const data: StoredAuth = raw ? JSON.parse(raw) : null;
      if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, user: u }));
    } catch (_) {}
  }, [sessionId]);

  return (
    <AuthContext.Provider value={{ user, sessionId, loading, login, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
