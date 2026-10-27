"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth/AuthContext";
import { buildAuthHeaders, getApiBase } from "../lib/apiBase";
import { formatUserRoleLabel } from "../lib/formatUserRoleLabel";
import NotificationBell from "./NotificationBell";
import ThemeModeToggle from "./ThemeModeToggle";
import { PersonalAppointmentModal } from "./PersonalAppointmentModal";
import {
  AppointmentSuccessToast,
  type AppointmentSuccessPayload,
} from "./AppointmentSuccessToast";
import AppSwitcher from "./AppSwitcher";
import DesignSidebar from "./DesignSidebar";
import { WorkspaceFilterProvider, useWorkspaceFilters } from "./WorkspaceFilters";
import { SideDashboard, SideDashboardStatus } from "../Enums/Enums";

const BARE_PREFIXES = ["/login", "/auth", "/quote", "/MeetingWiz", "/mail-templates", "/newEmail", "/receipt"];

function isBarePath(pathname: string) {
  return BARE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hallwayHomeUrl() {
  const raw = (process.env.NEXT_PUBLIC_HALLWAY_URL || "https://hallway-liart.vercel.app").trim();
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return `${url.origin}/`;
  } catch {
    return "https://hallway-liart.vercel.app/";
  }
}

const MODULE_NAME = "Hows Design";

const HEADER_PAGES: Record<string, string> = {
  "/google-calendar": "HUB Calendar",
  "/incentives": "Incentives",
  "/leaderboard": "Leaderboard",
  "/meeting-management": "Meeting Management",
  "/profile": "Profile",
  "/profile/experience": "Experience & stats",
  "/profile/inspiration": "Portfolio projects",
  "/change-password": "Change Password",
  "/personal-appointments": "Personal Appointments",
  "/admin": "Admin Panel",
  "/admin/manage-users": "Manage Design Roles",
  "/admin/create-admin": "Create Admin",
  "/admin/create-tdm": "Create Territory Design Manager",
  "/admin/create-deputy-general-manager": "Create Deputy General Manager",
  "/admin/create-dqc-manager": "Create DQC Manager",
  "/admin/create-mmt-manager": "Create MMT Manager",
  "/admin/create-finance": "Create Finance Team",
  "/admin/create-project-manager": "Create Project Manager",
  "/admin/create-senior-project-manager": "Create Senior Project Manager",
  "/admin/create-escalation-manager": "Create Escalation Manager",
  "/admin/prolance-test": "Prolance API Test",
  "/finance": "10% Payment",
  "/finance/refunds": "Refunds",
  "/finance/sales-closure": "Sales Closure",
  "/finance/40": "40% Payment",
  "/tdm/register": "Register DM / Designer",
  "/dqc-manager/register": "Register DQE",
  "/mmt-manager/register": "Register MMT Executive",
  "/mmt-manager/d1-requests": "D1 Requests",
  "/mmt": "D1 Uploads",
  "/d2-uploads": "D2 Uploads",
  "/project-managers": "Project Managers",
};

function resolveHeaderCrumb(pathname: string, phase: string, status: string) {
  if (pathname === "/") {
    const phaseSet = phase !== SideDashboard.All_Projects;
    const statusSet = status !== SideDashboardStatus.All_Statuses;
    if (phaseSet && statusSet) return { section: MODULE_NAME, page: `${phase} · ${status}` };
    if (phaseSet) return { section: MODULE_NAME, page: phase };
    if (statusSet) return { section: MODULE_NAME, page: status };
    return { section: MODULE_NAME, page: "Dashboard" };
  }
  if (HEADER_PAGES[pathname]) return { section: MODULE_NAME, page: HEADER_PAGES[pathname] };
  if (pathname.startsWith("/leaderboard")) return { section: MODULE_NAME, page: "Leaderboard" };
  if (pathname.startsWith("/profile")) return { section: MODULE_NAME, page: "Profile" };
  if (pathname.startsWith("/admin")) return { section: MODULE_NAME, page: "Admin Panel" };
  if (pathname.startsWith("/finance")) return { section: MODULE_NAME, page: "Finance" };
  const segment = pathname.split("/").filter(Boolean).pop() || "Dashboard";
  const page = segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return { section: MODULE_NAME, page };
}

function HeaderContext() {
  const pathname = usePathname();
  const { phase, status } = useWorkspaceFilters();
  const { section, page } = resolveHeaderCrumb(pathname, phase, status);

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="truncate text-[var(--foreground)]/75">{section}</span>
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-[var(--foreground)]/40" fill="currentColor" aria-hidden>
          <path d="M7.2 4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06L11.17 10 7.2 5.56a.75.75 0 0 1 0-1.06Z" />
        </svg>
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-[var(--brand-primary)]/10 px-2.5 py-1 font-medium text-[var(--brand-primary)]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
          <span className="truncate">{page}</span>
        </span>
    </div>
  );
}

function initials(name?: string | null, email?: string | null) {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return trimmed.slice(0, 2).toUpperCase();
  }
  return email?.trim().slice(0, 2).toUpperCase() || "?";
}

export default function DesignAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logoutAndRedirectToLogin, sessionId } = useAuth();
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentToast, setAppointmentToast] = useState<AppointmentSuccessPayload | null>(null);
  const [appointmentUnread, setAppointmentUnread] = useState(false);
  const apiBase = getApiBase();

  const role = (user?.role || "").toLowerCase();
  const showAppointmentButton = [
    "admin",
    "deputy_general_manager",
    "territorial_design_manager",
    "design_manager",
  ].includes(role);
  const isDesignManager = role === "design_manager";

  useEffect(() => {
    if (!sessionId || !showAppointmentButton) return;
    const loadBadge = () => {
      fetch(`${apiBase}/api/appointment/personal-appointments-badge`, {
        headers: buildAuthHeaders(sessionId),
        credentials: "include",
      })
        .then((response) => response.json())
        .then((data) => setAppointmentUnread(Boolean(data?.unread)))
        .catch(() => setAppointmentUnread(false));
    };
    loadBadge();
    const interval = setInterval(loadBadge, 60_000);
    window.addEventListener("personal-appointments-badge-refresh", loadBadge);
    return () => {
      clearInterval(interval);
      window.removeEventListener("personal-appointments-badge-refresh", loadBadge);
    };
  }, [sessionId, showAppointmentButton, apiBase, pathname]);

  if (loading || !user || isBarePath(pathname)) {
    return <>{children}</>;
  }

  const financeLinks =
    role === "finance" || role === "admin"
      ? [
          { href: "/finance", label: "10% Payment" },
          { href: "/finance/refunds", label: "Refunds" },
          { href: "/finance/sales-closure", label: "Sales Closure" },
          { href: "/finance/40", label: "40% Payment" },
        ]
      : [];
  const operationLinks = [
    ...(role === "territorial_design_manager" || role === "deputy_general_manager"
      ? [{ href: "/tdm/register", label: "Register DM / Designer" }]
      : []),
    ...(role === "deputy_general_manager"
      ? [{ href: "/admin/create-tdm", label: "Create TDM" }]
      : []),
    ...(role === "dqc_manager"
      ? [{ href: "/dqc-manager/register", label: "Register DQE" }]
      : []),
    ...(role === "mmt_manager"
      ? [{ href: "/mmt-manager/register", label: "Register MMT Executive" }]
      : []),
    ...(role === "mmt_manager" || role === "admin"
      ? [{ href: "/mmt-manager/d1-requests", label: "D1 Requests" }]
      : []),
    ...(role === "mmt_manager" || role === "mmt_executive"
      ? [{ href: "/mmt", label: "D1 Uploads" }]
      : []),
    ...(role === "senior_project_manager" || role === "project_manager" || role === "admin"
      ? [{ href: "/d2-uploads", label: "D2 Uploads" }]
      : []),
  ];
  const hallwayUrl = hallwayHomeUrl();

  return (
    <WorkspaceFilterProvider>
      <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <DesignSidebar
          role={role}
          appointmentUnread={appointmentUnread}
          financeLinks={financeLinks}
          operationLinks={operationLinks}
        />
        <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[57px] items-center justify-between gap-3 border-b border-[var(--border-color)] bg-[var(--card-bg)]/90 px-4 shadow-sm backdrop-blur-sm">
            <HeaderContext />
            <div className="flex shrink-0 items-center gap-3">
            {isDesignManager && sessionId ? (
              <button
                type="button"
                onClick={() => setAppointmentOpen(true)}
                title="Block personal time on your calendar"
                className="hidden rounded-lg border border-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-[var(--brand-dark)] hover:bg-[var(--hover-bg)] sm:inline-flex"
              >
                Appointment
              </button>
            ) : null}
            <NotificationBell />
            <ThemeModeToggle />
            <AppSwitcher
              hallwayUrl={hallwayUrl}
              hallwayUser={user}
              hallwaySessionId={sessionId}
              showAdmin={role === "admin"}
            />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-color)] bg-[var(--hover-bg)]">
                {user.profileImage ? (
                  <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-medium">{initials(user.name, user.email)}</span>
                )}
              </div>
              <span className="hidden text-sm text-[var(--foreground)]/70 md:inline">
                {user.name} ({formatUserRoleLabel(user.role)})
              </span>
            </div>
            <button
              type="button"
              onClick={() => void logoutAndRedirectToLogin()}
              className="text-sm font-semibold text-[var(--brand-primary)]"
            >
              Logout
            </button>
            </div>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
      {appointmentOpen && sessionId && isDesignManager ? (
        <PersonalAppointmentModal
          open={appointmentOpen}
          apiBase={apiBase}
          sessionId={sessionId}
          designerName={user.name}
          onClose={() => setAppointmentOpen(false)}
          onSuccess={(payload) => {
            setAppointmentOpen(false);
            if (payload) setAppointmentToast(payload);
          }}
        />
      ) : null}
      {appointmentToast ? (
        <AppointmentSuccessToast payload={appointmentToast} onDismiss={() => setAppointmentToast(null)} />
      ) : null}
    </WorkspaceFilterProvider>
  );
}
