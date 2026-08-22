'use client';

import { canManageTeamIncentives } from '../lib/designerIncentives';

export function canShowIncentivesNav(role: string | undefined | null): boolean {
  const r = (role || '').toLowerCase();
  return (
    r === 'designer' ||
    canManageTeamIncentives(r)
  );
}

type Props = {
  active?: boolean;
  className?: string;
};

/** Shared Incentives sidebar/header tab (green accent rail). */
export function IncentivesNavLink({ active = false, className = '' }: Props) {
  return (
    <a
      href="/incentives"
      aria-current={active ? 'page' : undefined}
      className={[
        'flex items-center gap-2 rounded-lg border-l-4 px-3 py-2.5 text-sm font-semibold transition-colors',
        active
          ? 'border-l-emerald-500 bg-emerald-100 text-emerald-800'
          : 'border-l-emerald-400 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-4 w-4 shrink-0"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
        />
      </svg>
      Incentives
    </a>
  );
}

/** Left rail used on non-dashboard pages so the Incentives tab stays visible. */
export function IncentivesSideRail({
  pathname,
  showCalendar,
}: {
  pathname: string;
  showCalendar?: boolean;
}) {
  return (
    <aside className="border-b border-gray-200 bg-white px-3 py-3 xl:min-h-[calc(100vh-3.5rem)] xl:border-b-0 xl:border-r xl:border-gray-300 xl:px-2 xl:pt-4 xl:pl-2">
      <nav className="space-y-2 xl:w-66.25" aria-label="App shortcuts">
        <a
          href="/"
          className={`flex items-center gap-2 rounded-lg border-l-4 px-3 py-2.5 text-sm font-semibold transition-colors ${
            pathname === '/'
              ? 'border-l-green-500 bg-gray-100 text-green-700'
              : 'border-l-transparent text-gray-700 hover:border-l-green-400 hover:bg-gray-100 hover:text-green-600'
          }`}
        >
          Dashboard
        </a>
        <IncentivesNavLink active={pathname === '/incentives'} />
        {showCalendar ? (
          <a
            href="/google-calendar"
            className={`flex items-center gap-2 rounded-lg border-l-4 px-3 py-2.5 text-sm font-semibold transition-colors ${
              pathname === '/google-calendar'
                ? 'border-l-green-500 bg-gray-100 text-green-700'
                : 'border-l-transparent text-gray-700 hover:border-l-green-400 hover:bg-gray-100 hover:text-green-600'
            }`}
          >
            HUB Calendar
          </a>
        ) : null}
      </nav>
    </aside>
  );
}
