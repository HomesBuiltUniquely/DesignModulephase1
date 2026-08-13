'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../auth/AuthContext';
import { getApiBase } from '@/app/lib/apiBase';

type Variant = 'nav' | 'button' | 'card';

type Props = {
  variant?: Variant;
  /** Override return path; defaults to current pathname */
  fromPath?: string;
  className?: string;
  onClick?: () => void;
};

export default function FinanceRefundsNavLink({
  variant = 'button',
  fromPath,
  className,
  onClick,
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
            ? 'ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#EF0101] px-1.5 py-0.5 text-[10px] font-bold text-white'
            : variant === 'card'
            ? 'inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#EF0101] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm shrink-0'
            : 'ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/95 px-1.5 py-0.5 text-[11px] font-bold text-[#EF0101]'
        }
        title={`${pendingCount} pending refund approval${pendingCount === 1 ? '' : 's'}`}
      >
        {pendingCount > 99 ? '99+' : pendingCount}
      </span>
    ) : null;

  if (variant === 'nav') {
    return (
      <a href={href} className={className || 'text-gray-600 hover:text-gray-900 text-sm inline-flex items-center'} onClick={onClick}>
        Refunds
        {badge}
      </a>
    );
  }

  if (variant === 'card') {
    return (
      <a
        href={href}
        className={className}
        onClick={onClick}
      >
        <div className={`p-2 rounded-lg border shrink-0 transition-colors ${
          pathname === '/finance/refunds'
            ? 'bg-[#EF0101]/10 text-[#EF0101] border-[#EF0101]/20'
            : 'text-rose-600 bg-rose-50 border-rose-100'
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9.75h4.875a2.625 2.625 0 0 1 0 5.25H12M8.25 9.75 10.5 7.5M8.25 9.75 10.5 12m9-3.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25 2.25V6.75A2.25 2.25 0 0 1 4.5 4.5h12a2.25 2.25 0 0 1 2.25 2.25Z" />
          </svg>
        </div>
        <div className="space-y-0.5 flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className={`text-xs font-bold transition-colors truncate ${
              pathname === '/finance/refunds' ? 'text-[#EF0101]' : 'text-gray-900'
            }`}>
              Refunds
            </div>
            {badge}
          </div>
          <p className="text-[11px] text-gray-500 leading-normal truncate sm:whitespace-normal">
            Track and process client refunds.
          </p>
        </div>
      </a>
    );
  }

  return (
    <a
      href={href}
      className={
        className ||
        'px-4 py-2 rounded-lg bg-[#EF0101] text-white text-sm font-semibold hover:bg-[#EF0101]/90 inline-flex items-center'
      }
      onClick={onClick}
    >
      Refunds
      {badge}
    </a>
  );
}
