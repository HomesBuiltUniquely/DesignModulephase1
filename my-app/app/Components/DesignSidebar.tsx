"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SideDashboard, SideDashboardStatus } from "../Enums/Enums";
import { canShowIncentivesNav } from "./IncentivesNavLink";
import { canShowMeetingManagement } from "./MeetingManagementView";
import { useWorkspaceFilters } from "./WorkspaceFilters";

type Props = {
  role: string;
  appointmentUnread?: boolean;
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center text-[var(--brand-primary)]">{children}</span>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  className: "h-[18px] w-[18px]",
} as const;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)] transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 8 5 5 5-5" />
    </svg>
  );
}

function SectionToggle({
  label,
  open,
  onClick,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
    >
      <span>{label}</span>
      <Chevron open={open} />
    </button>
  );
}

export default function DesignSidebar({ role, appointmentUnread = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { phase, status, setPhase, setStatus } = useWorkspaceFilters();
  const [open, setOpen] = useState(false);
  const [canHover, setCanHover] = useState(true);
  const [phasesOpen, setPhasesOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setCanHover(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const normalized = role.toLowerCase();
  const isSpm = normalized === "senior_project_manager";
  const hideWorkspaceFilters = [
    "finance",
    "dqc_manager",
    "dqe",
    "mmt_manager",
    "mmt_executive",
  ].includes(normalized);
  const phases = isSpm
    ? [SideDashboard.All_Projects, SideDashboard.Ten_50, SideDashboard.Fifty_above]
    : Object.values(SideDashboard);
  const statuses = Object.values(SideDashboardStatus);
  const showCalendar = [
    "admin",
    "deputy_general_manager",
    "territorial_design_manager",
    "design_manager",
    "designer",
  ].includes(normalized);
  const showAppointments = showCalendar;
  const showIncentives = canShowIncentivesNav(normalized);
  const showLeaderboard = [
    "admin",
    "super_admin",
    "superadmin",
    "territorial_design_manager",
    "design_manager",
    "designer",
  ].includes(normalized);
  const showMeetings = canShowMeetingManagement(normalized);

  const choosePhase = (next: string) => {
    setPhase(next);
    if (pathname !== "/") router.push("/");
  };
  const chooseStatus = (next: string) => {
    setStatus(next);
    if (pathname !== "/") router.push("/");
  };

  const rowClass = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-lg px-4 py-2 text-left text-sm font-semibold transition ${
      active
        ? "bg-[var(--hover-bg)] text-[var(--brand-primary)]"
        : "text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
    }`;

  return (
    <aside
      className={`sticky top-0 z-30 flex h-screen shrink-0 flex-col overflow-hidden border-r border-[var(--border-color)] bg-[var(--card-bg)] transition-[width] duration-200 ${
        open ? "w-64" : "w-16"
      }`}
      onMouseEnter={() => {
        if (canHover) setOpen(true);
      }}
      onMouseLeave={() => {
        if (canHover) setOpen(false);
      }}
    >
      <div className="h-[57px] shrink-0 border-b border-[var(--border-color)]" aria-hidden />
      <nav className="flex min-h-0 w-64 flex-1 flex-col gap-1 overflow-y-auto py-3" aria-label="Design module">
        <button
          type="button"
          className={rowClass(pathname === "/")}
          title="Dashboard"
          onClick={() => {
            if (!canHover) setOpen((value) => !value);
            router.push("/");
          }}
        >
          <Icon>
            <svg {...iconProps}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
            </svg>
          </Icon>
          <span className={open ? "truncate" : "sr-only"}>Dashboard</span>
        </button>
        {open && !hideWorkspaceFilters ? (
          <div className="mb-1 ml-4 space-y-1 border-l border-[var(--border-color)] pl-2">
            <SectionToggle
              label="Design Phases"
              open={phasesOpen}
              onClick={() => setPhasesOpen((value) => !value)}
            />
            {phasesOpen
              ? phases.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => choosePhase(item)}
                    className={`block w-full rounded-r-lg border-l-4 px-3 py-2 text-left text-sm font-semibold ${
                      pathname === "/" && phase === item
                        ? "border-[var(--brand-primary)] bg-[var(--hover-bg)] text-[var(--brand-dark)]"
                        : "border-transparent text-[var(--foreground)]/80 hover:bg-[var(--hover-bg)]"
                    }`}
                  >
                    {item}
                  </button>
                ))
              : null}
            {!isSpm ? (
              <>
                <SectionToggle
                  label="Project Status"
                  open={statusOpen}
                  onClick={() => setStatusOpen((value) => !value)}
                />
                {statusOpen ? (
                  statuses.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => chooseStatus(item)}
                        className={`block w-full rounded-r-lg border-l-4 px-3 py-2 text-left text-sm font-semibold ${
                          pathname === "/" && status === item
                            ? "border-[var(--brand-primary)] bg-[var(--hover-bg)] text-[var(--brand-dark)]"
                            : "border-transparent text-[var(--foreground)]/80 hover:bg-[var(--hover-bg)]"
                        }`}
                      >
                        {item}
                      </button>
                    ))
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {showCalendar ? (
          <Link href="/google-calendar" className={rowClass(pathname === "/google-calendar")} title="HUB Calendar">
            <Icon>
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v2M16 3v2M4 8h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
              </svg>
            </Icon>
            <span className={open ? "truncate" : "sr-only"}>HUB Calendar</span>
          </Link>
        ) : null}
        {showIncentives ? (
          <Link href="/incentives" className={rowClass(pathname === "/incentives")} title="Incentives">
            <Icon>
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l5-5 3 3 7-8" />
              </svg>
            </Icon>
            <span className={open ? "truncate" : "sr-only"}>Incentives</span>
          </Link>
        ) : null}
        {showLeaderboard ? (
          <Link href="/leaderboard" className={rowClass(pathname === "/leaderboard")} title="Leaderboard">
            <Icon>
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 20h8M12 16v4M7 4h10v3a5 5 0 0 1-10 0V4ZM7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3" />
              </svg>
            </Icon>
            <span className={open ? "truncate" : "sr-only"}>Leaderboard</span>
          </Link>
        ) : null}
        {showMeetings ? (
          <Link href="/meeting-management" className={rowClass(pathname === "/meeting-management")} title="Meeting Management">
            <Icon>
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 19a5 5 0 0 1 10 0M14 19a4 4 0 0 1 7 0" />
              </svg>
            </Icon>
            <span className={open ? "truncate" : "sr-only"}>Meeting Management</span>
          </Link>
        ) : null}

        <div className={`${rowClass(pathname.startsWith("/profile"))} pr-2`}>
          <Link href="/profile" title="Profile" className="flex min-w-0 flex-1 items-center gap-3">
            <Icon>
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0" />
              </svg>
              {appointmentUnread ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
              ) : null}
            </Icon>
            <span className={open ? "truncate" : "sr-only"}>Profile</span>
          </Link>
          {open ? (
            <button
              type="button"
              aria-expanded={profileOpen}
              aria-label={profileOpen ? "Hide profile links" : "Show profile links"}
              onClick={() => setProfileOpen((value) => !value)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--foreground)]/50 hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
            >
              <Chevron open={profileOpen} />
            </button>
          ) : null}
        </div>
        {open && profileOpen ? (
          <div className="ml-4 space-y-1 border-l border-[var(--border-color)] pl-2">
            <Link
              href="/change-password"
              className={`block rounded-lg px-3 py-2 text-sm font-semibold ${
                pathname === "/change-password"
                  ? "text-[var(--brand-primary)]"
                  : "text-[var(--foreground)]/80 hover:bg-[var(--hover-bg)]"
              }`}
            >
              Change Password
            </Link>
            {showAppointments ? (
              <Link
                href="/personal-appointments"
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  pathname === "/personal-appointments"
                    ? "text-[var(--brand-primary)]"
                    : "text-[var(--foreground)]/80 hover:bg-[var(--hover-bg)]"
                }`}
              >
                <span>Personal Appointments</span>
                {appointmentUnread ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                ) : null}
              </Link>
            ) : null}
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
