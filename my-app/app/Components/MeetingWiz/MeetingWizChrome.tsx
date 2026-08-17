"use client";

import type { ReactNode } from "react";
import { MeetingWizDurationBadge } from "./MeetingWizTimer";

export const mwCard =
  "rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm transition-all duration-300 hover:shadow-md";
export const mwH1 = "mb-2 text-4xl font-extrabold leading-tight text-[var(--brand-dark)]";
export const mwMuted = "text-sm text-[var(--foreground)]/65";
export const mwCta =
  "inline-flex cursor-pointer items-center justify-center gap-3 rounded-full bg-[var(--brand-primary)] px-8 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:opacity-90";
export const mwGhostBtn =
  "cursor-pointer text-sm font-medium text-[var(--foreground)]/65 transition hover:text-[var(--brand-dark)]";
export const mwPrimaryBtn =
  "cursor-pointer rounded-md bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90";
export const mwDarkBtn =
  "cursor-pointer rounded-md bg-[var(--brand-dark)] px-6 py-2 text-sm font-semibold text-[var(--card-bg)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

export function MeetingWizShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`meeting-wiz min-h-screen w-full bg-[var(--brand-surface)] text-[var(--foreground)] ${className}`}
    >
      {children}
    </main>
  );
}

export function MeetingWizTopBar({
  onPrev,
  onNext,
  prevDisabled,
  nextLabel = "Next Phase",
  extra,
  hideNext,
  leading,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextLabel?: string;
  extra?: ReactNode;
  hideNext?: boolean;
  leading?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--card-bg)] px-6 py-3">
      {leading ?? <MeetingWizDurationBadge />}
      <div className="flex items-center gap-4">
        {onPrev ? (
          <button
            type="button"
            onClick={onPrev}
            disabled={prevDisabled}
            className={
              prevDisabled
                ? "cursor-not-allowed text-sm font-medium text-[var(--foreground)]/35"
                : mwGhostBtn
            }
          >
            Previous
          </button>
        ) : null}
        {extra}
        {!hideNext && onNext ? (
          <button type="button" onClick={onNext} className={mwPrimaryBtn}>
            {nextLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function MeetingWizStepDots({
  current,
  caption,
}: {
  current: number;
  caption?: string;
}) {
  return (
    <div className="flex flex-col items-center py-4">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-1 w-8 rounded-full ${
              i < current ? "bg-[var(--brand-primary)]" : "bg-[var(--border-color)]"
            }`}
          />
        ))}
      </div>
      <span className="mt-1 text-xs font-medium uppercase tracking-widest text-[var(--foreground)]/50">
        {caption ?? `Step ${current} of 5`}
      </span>
    </div>
  );
}
