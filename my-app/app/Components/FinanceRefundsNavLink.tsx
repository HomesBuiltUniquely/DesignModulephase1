'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

type Variant = 'nav' | 'button';

type Props = {
  variant?: Variant;
  /** Override return path; defaults to current pathname */
  fromPath?: string;
  className?: string;
};

export default function FinanceRefundsNavLink({
  variant = 'button',
  fromPath,
  className,
}: Props) {
  const { user, sessionId } = useAuth();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  const role = (user?.role || '').toLowerCase();
  const canSee = role === 'finance' || role === 'admin';

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (sessionId) headers.Authorization = `Bearer ${sessionId}`;
    return headers;
  }, [sessionId]);

  const loadCount = useCallback(async () => {
    if (!sessionId || !canSee) {
      setPendingCount(0);
      return;
    }
    try {
      const res = await fetch(`${getApiBase()}/api/sales-closure/finance-refunds/pending-count`, {
        headers: { ...authHeaders },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setPendingCount(Number((data as { count?: number }).count) || 0);
    } catch {
      /* ignore badge errors */
    }
  }, [sessionId, canSee, authHeaders]);

  useEffect(() => {
    void loadCount();
    const t = window.setInterval(() => void loadCount(), 60_000);
    return () => window.clearInterval(t);
  }, [loadCount]);

  if (!canSee) return null;

  const from = fromPath || pathname || '/finance';
  const href = `/finance/refunds?from=${encodeURIComponent(from)}`;

  const badge =
    pendingCount > 0 ? (
      <span
        className={
          variant === 'nav'
            ? 'ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white'
            : 'ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/95 px-1.5 py-0.5 text-[11px] font-bold text-rose-800'
        }
        title={`${pendingCount} pending refund approval${pendingCount === 1 ? '' : 's'}`}
      >
        {pendingCount > 99 ? '99+' : pendingCount}
      </span>
    ) : null;

  if (variant === 'nav') {
    return (
      <a href={href} className={className || 'text-gray-600 hover:text-gray-900 text-sm inline-flex items-center'}>
        Refunds
        {badge}
      </a>
    );
  }

  return (
    <a
      href={href}
      className={
        className ||
        'px-4 py-2 rounded-lg bg-rose-700 text-white text-sm font-semibold hover:bg-rose-800 inline-flex items-center'
      }
    >
      Refunds
      {badge}
    </a>
  );
}
