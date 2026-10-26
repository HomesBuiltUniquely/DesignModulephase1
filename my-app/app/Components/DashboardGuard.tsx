'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import Dashboard from './Dashboard';
import GoogleCalendarView from './GoogleCalendarView';
import PersonalAppointmentsView from './PersonalAppointmentsView';
import DesignerIncentivesView from './DesignerIncentivesView';
import { DesignerLeaderboardView } from '../leaderboard/components/DesignerLeaderboardView';
import MeetingManagementView, { canShowMeetingManagement } from './MeetingManagementView';
import { canShowIncentivesNav } from './IncentivesNavLink';
import { redirectToLoginPage } from '../lib/externalLoginUrl';

export default function DashboardGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (pathname === '/login' || pathname === '/auth/accept') return;
    if (!user) {
      redirectToLoginPage();
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-[var(--foreground)]/60">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  const canAccessIncentives = canShowIncentivesNav(user.role);
  const canAccessLeaderboard = [
    'admin',
    'super_admin',
    'superadmin',
    'territorial_design_manager',
    'design_manager',
    'designer',
  ].includes((user.role || '').toLowerCase());
  const canAccessMeetingManagement = canShowMeetingManagement(user.role);

  const mainContent =
    pathname === '/google-calendar' ? (
      <GoogleCalendarView />
    ) : pathname === '/personal-appointments' ? (
      <PersonalAppointmentsView />
    ) : pathname === '/incentives' ? (
      canAccessIncentives ? (
        <DesignerIncentivesView />
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--foreground)]/60">
          Incentives are available for designers.
        </div>
      )
    ) : pathname === '/leaderboard' ? (
      canAccessLeaderboard ? (
        <DesignerLeaderboardView />
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--foreground)]/60">
          Leaderboard and XP Levels & Badges are available to Admin, Territorial Design Manager, Design Manager, and Designer only.
        </div>
      )
    ) : pathname === '/meeting-management' ? (
      canAccessMeetingManagement ? (
        <MeetingManagementView />
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--foreground)]/60">
          Meeting Management is available to admin only.
        </div>
      )
    ) : (
      <Dashboard />
    );

  return <main>{mainContent}</main>;
}
