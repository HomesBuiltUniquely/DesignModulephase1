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

export default function DashboardGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout, sessionId } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [badgeUnread, setBadgeUnread] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentSuccessToast, setAppointmentSuccessToast] =
    useState<AppointmentSuccessPayload | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
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
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

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

  const showIncentivesSideRail =
    canAccessIncentives &&
    (pathname === '/incentives' ||
      pathname === '/google-calendar' ||
      pathname === '/personal-appointments');

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
          {((user.role === 'territorial_design_manager' || user.role === 'deputy_general_manager') || user.role === 'dqc_manager' || user.role === 'mmt_manager' || user.role === 'mmt_executive' || user.role === 'finance' || user.role === 'admin' || user.role === 'senior_project_manager' || user.role === 'project_manager') && (
            <>
              {(user.role === 'territorial_design_manager' || user.role === 'deputy_general_manager') && <a href="/tdm/register" className={navLinkClass('/tdm/register')}>Register DM / Designer</a>}
              {user.role === 'deputy_general_manager' && <a href="/admin/create-tdm" className={navLinkClass('/admin/create-tdm')}>Create TDM</a>}
              {user.role === 'dqc_manager' && <a href="/dqc-manager/register" className={navLinkClass('/dqc-manager/register')}>Register DQE</a>}
              {(user.role === 'finance' || user.role === 'admin') && (
                <>
                  <a href="/finance" className={navLinkClass('/finance')}>10% Payment</a>
                  <FinanceRefundsNavLink variant="nav" className={navLinkClass('/finance/refunds')} />
                  <a href="/finance/sales-closure" className={navLinkClass('/finance/sales-closure')}>Sales Closure</a>
                  <a href="/finance/40" className={navLinkClass('/finance/40')}>40% Payment</a>
                </>
              )}
              {user.role === 'mmt_manager' && (
                <>
                  <a href="/mmt-manager/register" className={navLinkClass('/mmt-manager/register')}>Register MMT Executive</a>
                  <a href="/mmt-manager/d1-requests" className={navLinkClass('/mmt-manager/d1-requests')}>D1 Requests</a>
                  <a href="/mmt" className={navLinkClass('/mmt')}>D1 Uploads</a>
                </>
              )}
              {user.role === 'admin' && (
                <a href="/mmt-manager/d1-requests" className={navLinkClass('/mmt-manager/d1-requests')}>D1 Requests</a>
              )}
              {user.role === 'mmt_executive' && (
                <a href="/mmt" className={navLinkClass('/mmt')}>D1 Uploads</a>
              )}
              {(user.role === 'senior_project_manager' || user.role === 'project_manager' || user.role === 'admin') && (
                <a href="/d2-uploads" className={navLinkClass('/d2-uploads')}>D2 Uploads</a>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
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
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-colors duration-200 ${
                settingsOpen
                  ? 'bg-gray-100 text-[#32261C]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-[#32261C]'
              }`}
              aria-expanded={settingsOpen}
              aria-haspopup="true"
            >
              {showPersonalAppointmentsBadge && badgeUnread ? (
                <span
                  className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
                  aria-label="New personal appointment activity"
                />
              ) : null}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a7.723 7.723 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <span>Settings</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-50">
                <a href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setSettingsOpen(false)}>
                  Profile
                </a>
                <a href="/change-password" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setSettingsOpen(false)}>
                  Change password
                </a>
                {canAccessPersonalAppointments && (
                  <a
                    href="/personal-appointments"
                    className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setSettingsOpen(false)}
                  >
                    <span>Personal Appointments</span>
                    {showPersonalAppointmentsBadge && badgeUnread ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
                    ) : null}
                  </a>
                )}
                {canAccessIncentives && (
                  <a
                    href="/incentives"
                    className="block px-4 py-2 text-sm text-[#32261C] font-semibold hover:bg-[#DDCDC1]/20"
                    onClick={() => setSettingsOpen(false)}
                  >
                    Incentives
                  </a>
                )}
                {user.role === 'admin' && (
                  <a href="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setSettingsOpen(false)}>
                    Admin Panel
                  </a>
                )}
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
            <span className="text-sm text-gray-600">{user.name} ({user.role.replace(/_/g, ' ')})</span>
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
