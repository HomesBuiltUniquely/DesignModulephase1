'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getApiBase, buildAuthHeaders } from '../lib/apiBase';
import Dashboard from './Dashboard';
import GoogleCalendarView from './GoogleCalendarView';
import PersonalAppointmentsView from './PersonalAppointmentsView';
import DesignerIncentivesView from './DesignerIncentivesView';
import ThemeModeToggle from './ThemeModeToggle';
import { PersonalAppointmentModal } from './PersonalAppointmentModal';
import {
  AppointmentSuccessToast,
  type AppointmentSuccessPayload,
} from './AppointmentSuccessToast';
import { IncentivesNavLink, IncentivesSideRail, canShowIncentivesNav } from './IncentivesNavLink';
import FinanceRefundsNavLink from './FinanceRefundsNavLink';
import NotificationBell from './notifications/NotificationBell';

export default function DashboardGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout, sessionId } = useAuth();
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [badgeUnread, setBadgeUnread] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentSuccessToast, setAppointmentSuccessToast] =
    useState<AppointmentSuccessPayload | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const apiBase = getApiBase();

  useEffect(() => {
    if (loading) return;
    if (pathname === '/login') return;
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [user, loading, pathname, router]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (consoleRef.current && !consoleRef.current.contains(event.target as Node)) {
        setConsoleOpen(false);
      }
    }
    if (consoleOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [consoleOpen]);

  const userRole = user?.role ?? '';
  const isDesignManager = userRole === 'design_manager';
  const showPersonalAppointmentsBadge =
    userRole === 'admin' ||
    userRole === 'deputy_general_manager' ||
    userRole === 'territorial_design_manager' ||
    userRole === 'design_manager';

  useEffect(() => {
    if (!sessionId || !showPersonalAppointmentsBadge) return;
    const loadBadge = () => {
      fetch(`${apiBase}/api/appointment/personal-appointments-badge`, {
        headers: buildAuthHeaders(sessionId),
        credentials: 'include',
      })
        .then((r) => r.json())
        .then((data) => setBadgeUnread(Boolean(data?.unread)))
        .catch(() => setBadgeUnread(false));
    };
    loadBadge();
    const interval = setInterval(loadBadge, 60_000);
    const onRefresh = () => loadBadge();
    window.addEventListener('personal-appointments-badge-refresh', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('personal-appointments-badge-refresh', onRefresh);
    };
  }, [sessionId, showPersonalAppointmentsBadge, apiBase, pathname]);

  useEffect(() => {
    if (pathname !== '/personal-appointments' || !sessionId || !showPersonalAppointmentsBadge) return;
    fetch(`${apiBase}/api/appointment/personal-appointments/mark-seen`, {
      method: 'POST',
      headers: buildAuthHeaders(sessionId),
      credentials: 'include',
    })
      .then(() => setBadgeUnread(false))
      .catch(() => {});
  }, [pathname, sessionId, showPersonalAppointmentsBadge, apiBase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  const canAccessCalendar =
    user.role === 'admin' ||
    user.role === 'deputy_general_manager' ||
    user.role === 'territorial_design_manager' ||
    user.role === 'design_manager' ||
    user.role === 'designer';

  const canAccessPersonalAppointments =
    user.role === 'admin' ||
    user.role === 'deputy_general_manager' ||
    user.role === 'territorial_design_manager' ||
    user.role === 'design_manager' ||
    user.role === 'designer';

  const canAccessIncentives = canShowIncentivesNav(user.role);

  const mainContent =
    pathname === '/google-calendar' ? (
      <GoogleCalendarView />
    ) : pathname === '/personal-appointments' ? (
      <PersonalAppointmentsView />
    ) : pathname === '/incentives' ? (
      canAccessIncentives ? (
        <DesignerIncentivesView />
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
          Incentives are available for designers.
        </div>
      )
    ) : (
      <Dashboard />
    );

  const navLinkClass = (path: string) =>
    `group relative px-1 py-1 text-sm font-semibold transition-colors duration-200 ${
      pathname === path
        ? 'text-[#EF0101]'
        : 'text-gray-500 hover:text-[#32261C]'
    }`;

  const isOperationsActive =
    pathname === '/tdm/register' ||
    pathname === '/admin/create-tdm' ||
    pathname === '/dqc-manager/register' ||
    pathname === '/finance' ||
    pathname === '/finance/refunds' ||
    pathname === '/finance/sales-closure' ||
    pathname === '/finance/40' ||
    pathname === '/mmt-manager/register' ||
    pathname === '/mmt-manager/d1-requests' ||
    pathname === '/mmt' ||
    pathname === '/d2-uploads';

  const hasExtraLinks =
    (user.role === 'territorial_design_manager' || user.role === 'deputy_general_manager') ||
    user.role === 'dqc_manager' ||
    user.role === 'mmt_manager' ||
    user.role === 'mmt_executive' ||
    user.role === 'finance' ||
    user.role === 'admin' ||
    user.role === 'senior_project_manager' ||
    user.role === 'project_manager';

  const portals: Array<{
    href: string;
    title: string;
    desc: string;
    icon?: React.ReactNode;
    color?: string;
    isRefunds?: boolean;
  }> = [];

  if (user) {
    if (user.role === 'territorial_design_manager' || user.role === 'deputy_general_manager') {
      portals.push({
        href: '/tdm/register',
        title: 'Register DM / Designer',
        desc: 'Add new Design Managers and Designers to the platform.',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.111a6 6 0 0 1 7.553-5.781M9 21h3v-3" />
          </svg>
        ),
        color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      });
    }

    if (user.role === 'deputy_general_manager') {
      portals.push({
        href: '/admin/create-tdm',
        title: 'Create TDM',
        desc: 'Set up new Territorial Design Manager accounts.',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.111a6 6 0 0 1 7.553-5.781M9 21h3v-3" />
          </svg>
        ),
        color: 'text-purple-600 bg-purple-50 border-purple-100',
      });
    }

    if (user.role === 'dqc_manager') {
      portals.push({
        href: '/dqc-manager/register',
        title: 'Register DQE',
        desc: 'Onboard new Design Quality Engineers.',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
          </svg>
        ),
        color: 'text-teal-600 bg-teal-50 border-teal-100',
      });
    }

    if (user.role === 'finance' || user.role === 'admin') {
      portals.push(
        {
          href: '/finance',
          title: '10% Payment',
          desc: 'Review and approve booking deposit transactions.',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.752.75a1.5 1.5 0 0 0 2.122 0v0a1.5 1.5 0 0 0 0-2.122L10.5 13M12 6.5a1.5 1.5 0 0 0-1.5 1.5v0a1.5 1.5 0 0 0 1.5 1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5H12M9 6h6m-6 12h6" />
            </svg>
          ),
          color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        },
        {
          href: '/finance/refunds',
          title: 'Refunds',
          desc: 'Track and process client refunds.',
          isRefunds: true,
          color: 'text-rose-600 bg-rose-50 border-rose-100',
        },
        {
          href: '/finance/sales-closure',
          title: 'Sales Closure',
          desc: 'Verify sales sheets and finalize project closures.',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m-6.375-3h.008v.008H6V15Zm0 3h.008v.008H6V18Zm0-6h.008v.008H6V12m0-6h.008v.008H6V6Zm1.5-3h.008v.008H7.5V3ZM12 3h.008v.008H12V3Zm3 0h.008v.008H15V3Zm0 9h.008v.008H15V12Zm0 3h.008v.008H15V15Zm0 3h.008v.008H15V18Zm3-6h.008v.008H18V12Zm0 3h.008v.008H18V15Zm0 3h.008v.008H18V18ZM21 6v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z" />
            </svg>
          ),
          color: 'text-amber-600 bg-amber-50 border-amber-100',
        },
        {
          href: '/finance/40',
          title: '40% Payment',
          desc: 'Approve Stage-2 production payment releases.',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
          ),
          color: 'text-cyan-600 bg-cyan-50 border-cyan-100',
        }
      );
    }

    if (user.role === 'mmt_manager') {
      portals.push({
        href: '/mmt-manager/register',
        title: 'Register MMT Executive',
        desc: 'Onboard new site measurement executives.',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.111a6 6 0 0 1 7.553-5.781M9 21h3v-3" />
          </svg>
        ),
        color: 'text-blue-600 bg-blue-50 border-blue-100',
      });
    }

    if (user.role === 'mmt_manager' || user.role === 'admin') {
      portals.push({
        href: '/mmt-manager/d1-requests',
        title: 'D1 Requests',
        desc: 'Review site visit and initial layout requests.',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.008 1.24l.885 1.77a2.25 2.25 0 0 0 2.007 1.24h1.98a2.25 2.25 0 0 0 2.007-1.24l.885-1.77a2.25 2.25 0 0 1 2.007-1.24h3.86m-18 0h18" />
          </svg>
        ),
        color: 'text-orange-600 bg-orange-50 border-orange-100',
      });
    }

    if (user.role === 'mmt_manager' || user.role === 'mmt_executive') {
      portals.push({
        href: '/mmt',
        title: 'D1 Uploads',
        desc: 'Upload initial measurements and site files.',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
          </svg>
        ),
        color: 'text-violet-600 bg-violet-50 border-violet-100',
      });
    }

    if (user.role === 'senior_project_manager' || user.role === 'project_manager' || user.role === 'admin') {
      portals.push({
        href: '/d2-uploads',
        title: 'D2 Uploads',
        desc: 'Manage and upload finalized production file packages.',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
          </svg>
        ),
        color: 'text-sky-600 bg-sky-50 border-sky-100',
      });
    }
  }

  const settingPortals: Array<{
    href: string;
    title: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
    badge?: React.ReactNode;
  }> = [];

  if (user) {
    settingPortals.push({
      href: '/profile',
      title: 'Profile',
      desc: 'View and update your personal account information.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      ),
      color: 'text-blue-600 bg-blue-50 border-blue-100',
    });

    settingPortals.push({
      href: '/change-password',
      title: 'Change Password',
      desc: 'Update your account login credentials and security.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
        </svg>
      ),
      color: 'text-amber-600 bg-amber-50 border-amber-100',
    });

    if (canAccessPersonalAppointments) {
      settingPortals.push({
        href: '/personal-appointments',
        title: 'Personal Appointments',
        desc: 'Organize and track your direct customer meetings.',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
        ),
        color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        badge: showPersonalAppointmentsBadge && badgeUnread ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
        ) : undefined,
      });
    }

    if (canAccessIncentives) {
      settingPortals.push({
        href: '/incentives',
        title: 'Incentives',
        desc: 'Review commission rules, payouts, and balances.',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.498m5.007 0a3.375 3.375 0 0 0-3.375-3.375h-1.5a3.375 3.375 0 0 0-3.375 3.375m1.5-3.375v-1.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v1.5M9 2.25h6" />
          </svg>
        ),
        color: 'text-purple-600 bg-purple-50 border-purple-100',
      });
    }

    if (user.role === 'admin') {
      settingPortals.push({
        href: '/admin',
        title: 'Admin Panel',
        desc: 'Access core administrative and system configuration tools.',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
        ),
        color: 'text-rose-600 bg-rose-50 border-rose-100',
      });
    }
  }

  const showIncentivesSideRail =
    canAccessIncentives &&
    (pathname === '/incentives' || pathname === '/personal-appointments');

  return (
    <div>
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-6 py-2.5 flex items-center justify-between shadow-sm transition-all">
        <div className="flex flex-wrap items-center gap-5">
          <a href="/" className={navLinkClass('/')}>
            Dashboard
          </a>
          {canAccessCalendar && (
            <a
              href="/google-calendar"
              className={navLinkClass('/google-calendar')}
            >
              HUB Calendar
            </a>
          )}
          {canAccessIncentives && (
            <IncentivesNavLink
              active={pathname === '/incentives'}
              variant="nav"
              className={navLinkClass('/incentives')}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          {sessionId ? <NotificationBell sessionId={sessionId} /> : null}
          <ThemeModeToggle />
          {isDesignManager && sessionId && user ? (
            <button
              type="button"
              onClick={() => setShowAppointmentModal(true)}
              title="Block personal time on your calendar"
              className="hidden sm:inline-flex px-3 py-2 rounded-lg border border-[#EF0101] text-[#32261C] text-sm font-medium hover:bg-[#DDCDC1]/20"
            >
              Appointment
            </button>
          ) : null}

          {/* Combined Console & Settings Dropdown */}
          <div className="relative" ref={consoleRef}>
            <button
              type="button"
              onClick={() => setConsoleOpen((o) => !o)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all duration-200 ${
                consoleOpen
                  ? 'text-[#EF0101] bg-[#EF0101]/5 border-[#EF0101]/20 shadow-sm'
                  : 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300'
              }`}
              aria-expanded={consoleOpen}
              aria-haspopup="true"
            >
              {showPersonalAppointmentsBadge && badgeUnread ? (
                <span
                  className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse"
                  aria-label="New personal appointment activity"
                />
              ) : null}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
              <span>Menu</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 transition-transform ${consoleOpen ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {consoleOpen && (
              <div className={`absolute right-0 top-full mt-2 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 p-5 animate-in fade-in slide-in-from-top-2 duration-200 ${
                hasExtraLinks ? 'w-[90vw] sm:w-[42rem] md:w-[50rem]' : 'w-[90vw] sm:w-[26rem]'
              }`}>
                <div className="border-b border-gray-100 pb-3 mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#32261C]">Menu</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">Quick access to operational portals and settings</p>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {user.role.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className={`grid gap-6 ${hasExtraLinks ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  {/* Left Column: Operations */}
                  {hasExtraLinks && (
                    <div className="space-y-3">
                      <div className="px-1">
                        <h4 className="text-xs font-bold text-[#EF0101] uppercase tracking-wider">Operations</h4>
                        <p className="text-[10px] text-gray-400 mt-0.5">Run tasks and manage modules</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 max-h-[55vh] overflow-y-auto pr-1">
                        {portals.map((p, idx) => {
                          if (p.isRefunds) {
                            return (
                              <FinanceRefundsNavLink
                                key={idx}
                                variant="card"
                                className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-200 group text-left ${
                                  pathname === '/finance/refunds'
                                    ? 'bg-[#EF0101]/5 border-[#EF0101]/20 shadow-sm'
                                    : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50/50 hover:shadow-sm'
                                }`}
                                onClick={() => setConsoleOpen(false)}
                              />
                            );
                          }
                          const isActive = pathname === p.href;
                          return (
                            <a
                              key={idx}
                              href={p.href}
                              onClick={() => setConsoleOpen(false)}
                              className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-200 group ${
                                isActive
                                  ? 'bg-[#EF0101]/5 border-[#EF0101]/20 shadow-sm'
                                  : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50/50 hover:shadow-sm'
                              }`}
                            >
                              <div className={`p-1.5 rounded-lg border shrink-0 transition-colors ${
                                isActive ? 'bg-[#EF0101]/10 text-[#EF0101] border-[#EF0101]/20' : p.color
                              }`}>
                                {p.icon}
                              </div>
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <div className={`text-xs font-bold transition-colors truncate ${
                                  isActive ? 'text-[#EF0101]' : 'text-gray-900 group-hover:text-gray-900'
                                }`}>
                                  {p.title}
                                </div>
                                <p className="text-[10px] text-gray-500 leading-normal truncate sm:whitespace-normal">
                                  {p.desc}
                                </p>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Right Column: Account & Settings */}
                  <div className="space-y-3">
                    <div className="px-1">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Account & Settings</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">Manage preferences and profile details</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-[55vh] overflow-y-auto pr-1">
                      {settingPortals.map((p, idx) => {
                        const isActive = pathname === p.href;
                        return (
                          <a
                            key={idx}
                            href={p.href}
                            onClick={() => setConsoleOpen(false)}
                            className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-200 group text-left ${
                              isActive
                                ? 'bg-[#EF0101]/5 border-[#EF0101]/20 shadow-sm'
                                : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50/50 hover:shadow-sm'
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg border shrink-0 transition-colors ${
                              isActive ? 'bg-[#EF0101]/10 text-[#EF0101] border-[#EF0101]/20' : p.color
                            }`}>
                              {p.icon}
                            </div>
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className={`text-xs font-bold transition-colors truncate ${
                                  isActive ? 'text-[#EF0101]' : 'text-gray-900 group-hover:text-gray-900'
                                }`}>
                                  {p.title}
                                </div>
                                {p.badge}
                              </div>
                              <p className="text-[10px] text-gray-500 leading-normal truncate sm:whitespace-normal">
                                {p.desc}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0">
              {user.profileImage ? (
                <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-medium text-gray-500">
                  {user.name?.trim() ? user.name.trim().split(/\s+/).length >= 2
                    ? (user.name.trim().split(/\s+/)[0][0] + user.name.trim().split(/\s+/).pop()![0]).toUpperCase()
                    : user.name.trim().slice(0, 2).toUpperCase()
                    : user.email?.trim().slice(0, 2).toUpperCase() || '?'}
                </span>
              )}
            </div>
            <span className="text-sm text-gray-600 hidden md:inline">{user.name} ({user.role.replace(/_/g, ' ')})</span>
          </div>
          <button type="button" onClick={() => logout().then(() => router.replace('/login'))} className="text-sm font-semibold text-red-500 hover:text-red-700 transition-colors">Logout</button>
        </div>
      </header>
      <main>
        {showIncentivesSideRail ? (
          <div className="xl:grid xl:grid-cols-5 xl:gap-4">
            <IncentivesSideRail pathname={pathname} showCalendar={canAccessCalendar} />
            <div className="xl:col-span-4">{mainContent}</div>
          </div>
        ) : (
          mainContent
        )}
      </main>
      {showAppointmentModal && sessionId && user && isDesignManager ? (
        <PersonalAppointmentModal
          open={showAppointmentModal}
          apiBase={apiBase}
          sessionId={sessionId}
          designerName={user.name}
          onClose={() => setShowAppointmentModal(false)}
          onSuccess={(payload) => {
            setShowAppointmentModal(false);
            if (payload) setAppointmentSuccessToast(payload);
          }}
        />
      ) : null}
      {appointmentSuccessToast ? (
        <AppointmentSuccessToast
          payload={appointmentSuccessToast}
          onDismiss={() => setAppointmentSuccessToast(null)}
        />
      ) : null}
    </div>
  );
}
