'use client';

import { useEffect, useState } from 'react';

/** Default Easebuzz link TTL when createdAt is missing (matches backend EASEBUZZ_LINK_TTL_HOURS=48). */
const DEFAULT_TTL_MS = 48 * 60 * 60 * 1000;

export function parseExpiryDate(expiresAt?: string | Date | null): Date | null {
  if (!expiresAt) return null;
  const d = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatExpiryClock(d: Date): string {
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Live remaining label — includes seconds when under 1 hour. */
export function formatRemainingLabel(msLeft: number): string {
  if (msLeft <= 0) return 'Expired';
  const totalSec = Math.max(0, Math.ceil(msLeft / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) {
    if (mins === 0 && secs === 0) return `${hours}h left`;
    return `${hours}h ${mins}m ${pad(secs)}s left`;
  }
  if (mins > 0) return `${mins}m ${pad(secs)}s left`;
  return `${secs}s left`;
}

type Props = {
  expiresAt?: string | Date | null;
  createdAt?: string | Date | null;
  className?: string;
};

/** Live second-by-second countdown + smooth progress bar. */
export default function LinkExpiryProgress({ expiresAt, createdAt, className = '' }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const end = parseExpiryDate(expiresAt);
  if (!end) return null;

  const startRaw = createdAt
    ? createdAt instanceof Date
      ? createdAt
      : new Date(createdAt)
    : new Date(end.getTime() - DEFAULT_TTL_MS);
  const startMs = Number.isNaN(startRaw.getTime()) ? end.getTime() - DEFAULT_TTL_MS : startRaw.getTime();
  const totalMs = Math.max(60_000, end.getTime() - startMs);
  const msLeft = end.getTime() - now;
  const expired = msLeft <= 0;
  const remainingRatio = expired ? 0 : Math.min(1, Math.max(0, msLeft / totalMs));
  const pct = remainingRatio * 100;
  const pctLabel = Math.round(pct);
  const urgent = !expired && msLeft <= 60 * 60 * 1000;
  const critical = !expired && msLeft <= 5 * 60 * 1000;

  return (
    <div className={`mt-3 max-w-md ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p
          className={`min-w-0 text-xs tabular-nums tracking-wide transition-colors duration-300 ${
            expired
              ? 'font-semibold text-[#EF0101]'
              : critical
                ? 'font-semibold text-[#EF0101]'
                : 'font-medium text-[#32261C]'
          }`}
        >
          {expired ? (
            <>Expired · {formatExpiryClock(end)}</>
          ) : (
            <>
              <span className={critical ? 'animate-payDotPulse inline-block' : undefined}>
                {formatRemainingLabel(msLeft)}
              </span>
              <span className="text-[#32261C]"> · ends {formatExpiryClock(end)}</span>
            </>
          )}
        </p>
        {!expired && (
          <span className="flex-shrink-0 text-[11px] font-semibold tabular-nums text-[#32261C]">
            {pctLabel}%
          </span>
        )}
      </div>
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#DDCDC1]/60"
        role="progressbar"
        aria-valuenow={pctLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Link time remaining"
      >
        <div
          className={`link-expiry-fill absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear ${
            expired
              ? 'bg-[#EF0101]'
              : critical
                ? 'bg-[#EF0101]'
                : urgent
                  ? 'bg-[#32261C]'
                  : 'bg-[#00B0ED]'
          }`}
          style={{ width: `${pct}%` }}
        />
        {!expired && !critical && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-full"
            style={{ width: `${pct}%` }}
          >
            <div className="link-expiry-shine h-full w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
