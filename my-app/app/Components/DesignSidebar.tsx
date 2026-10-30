"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SideDashboard, SideDashboardStatus } from "../Enums/Enums";
import { canShowIncentivesNav } from "./IncentivesNavLink";
import { canShowMeetingManagement } from "./MeetingManagementView";
import { useWorkspaceFilters } from "./WorkspaceFilters";

type NavLink = { href: string; label: string };

type Props = {
  role: string;
  appointmentUnread?: boolean;
  financeLinks: NavLink[];
  operationLinks: NavLink[];
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative grid h-9 w-9 shrink-0 place-items-center text-[var(--brand-primary)]">{children}</span>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  className: "h-5.5 w-5.5",
} as const;

const chevronButtonClass =
  "grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--foreground)]/55 hover:bg-[var(--hover-bg)]";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      style={{ color: "color-mix(in srgb, var(--foreground) 55%, transparent)" }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 8 5 5 5-5" />
    </svg>
  );
}

function SidebarGroup({
  label,
  links,
  pathname,
  railOpen,
  expanded,
  onToggle,
  rowClass,
  icon,
}: {
  label: string;
  links: NavLink[];
  pathname: string;
  railOpen: boolean;
  expanded: boolean;
  onToggle: () => void;
  rowClass: (active: boolean) => string;
  icon: React.ReactNode;
}) {
  const active = links.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return (
    <>
      <div className={`${rowClass(active)} pr-2`}>
        <button type="button" title={label} className="flex min-w-0 flex-1 items-center gap-3" onClick={onToggle}>
          <Icon>{icon}</Icon>
          <span className={railOpen ? "truncate" : "sr-only"}>{label}</span>
        </button>
        {railOpen ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? `Hide ${label}` : `Show ${label}`}
            onClick={onToggle}
            className={chevronButtonClass}
          >
            <Chevron open={expanded} />
          </button>
        ) : null}
      </div>
      {railOpen && expanded ? (
        <div className="mb-1 ml-4 space-y-1 border-l border-[var(--border-color)] pl-2">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-semibold ${
                pathname === item.href
                  ? "text-[var(--brand-primary)]"
                  : "text-[var(--foreground)]/80 hover:bg-[var(--hover-bg)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </>
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

export default function DesignSidebar({
  role,
  appointmentUnread = false,
  financeLinks,
  operationLinks,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { phase, status, setPhase, setStatus } = useWorkspaceFilters();
  const [open, setOpen] = useState(false);
  const [canHover, setCanHover] = useState(true);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [phasesOpen, setPhasesOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setCanHover(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const normalized = role.toLowerCase();
  const isSpm = normalized === "senior_project_manager";
  const isOps = normalized === "operation_manager";
  const hideWorkspaceFilters = [
    "finance",
    "dqc_manager",
    "dqe",
    "mmt_manager",
    "mmt_executive",
  ].includes(normalized);
  const phases = isOps
    ? [
        SideDashboard.All_Projects,
        SideDashboard.Pre_10,
        SideDashboard.Ten_50,
        SideDashboard.Fifty_above,
        SideDashboard.In_Execution,
      ]
    : isSpm
    ? [
        SideDashboard.All_Projects,
        SideDashboard.Ten_50,
        SideDashboard.Fifty_above,
        SideDashboard.In_Execution,
      ]
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
    `flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm font-semibold transition ${
      active
        ? "bg-[var(--hover-bg)] text-[var(--brand-primary)]"
        : "text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
    }`;

  return (
    <aside
      data-expanded={open ? "true" : "false"}
      className={`sticky top-0 z-30 flex h-screen shrink-0 flex-col overflow-hidden border-r border-[var(--border-color)] bg-[var(--card-bg)] transition-[width] duration-200 ${
        open ? "w-64" : "w-[4.5rem]"
      }`}
      onMouseEnter={() => {
        if (canHover) setOpen(true);
      }}
      onMouseLeave={() => {
        if (canHover) setOpen(false);
      }}
    >
      <div className="flex h-[57px] shrink-0 items-center gap-1 overflow-hidden border-b border-[var(--border-color)]">
        <div className="grid h-full w-[4.5rem] shrink-0 place-items-center">
          <img
            src="/icons/hows-logo.png"
            alt="HOWS"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 object-contain"
          />
        </div>
        <span className="truncate pr-4 text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
          HOWS ERP
        </span>
      </div>
      <nav className="flex min-h-0 w-64 flex-1 flex-col gap-1 overflow-y-auto py-3" aria-label="Design module">
        <div className={`${rowClass(pathname === "/")} pr-2`}>
          <button
            type="button"
            title="Dashboard"
            className="flex min-w-0 flex-1 items-center gap-3"
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
            <button
              type="button"
              aria-expanded={dashboardOpen}
              aria-label={dashboardOpen ? "Hide dashboard lists" : "Show dashboard lists"}
              onClick={() => setDashboardOpen((value) => !value)}
              className={chevronButtonClass}
            >
              <Chevron open={dashboardOpen} />
            </button>
          ) : null}
        </div>
        {open && dashboardOpen && !hideWorkspaceFilters ? (
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

        {showAppointments ? (
          <Link
            href="/personal-appointments"
            className={rowClass(pathname === "/personal-appointments")}
            title="Personal Appointments"
          >
            <Icon>
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v2M16 3v2M4 8h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M12 10v6" />
              </svg>
              {appointmentUnread ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
              ) : null}
            </Icon>
            <span className={open ? "truncate" : "sr-only"}>Personal Appointments</span>
          </Link>
        ) : null}

        {financeLinks.length > 0 ? (
          <SidebarGroup
            label="Finance"
            links={financeLinks}
            pathname={pathname}
            railOpen={open}
            expanded={financeOpen}
            onToggle={() => {
              if (!canHover) setOpen(true);
              setFinanceOpen((value) => !value);
            }}
            rowClass={rowClass}
            icon={
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3S7.5 5.8 7.5 7.5 9.5 10.5 12 10.5s4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" />
              </svg>
            }
          />
        ) : null}
        {operationLinks.length > 0 ? (
          <SidebarGroup
            label="Operations"
            links={operationLinks}
            pathname={pathname}
            railOpen={open}
            expanded={operationsOpen}
            onToggle={() => {
              if (!canHover) setOpen(true);
              setOperationsOpen((value) => !value);
            }}
            rowClass={rowClass}
            icon={
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8M5 4h.01M5 9h.01M5 14h.01M5 19h.01M9 8h6M9 12h6M9 16h4" />
              </svg>
            }
          />
        ) : null}

        <div className={`${rowClass(pathname.startsWith("/profile"))} pr-2`}>
          <Link href="/profile" title="Profile" className="flex min-w-0 flex-1 items-center gap-3">
            <Icon>
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0" />
              </svg>
            </Icon>
            <span className={open ? "truncate" : "sr-only"}>Profile</span>
          </Link>
          {open ? (
            <button
              type="button"
              aria-expanded={profileOpen}
              aria-label={profileOpen ? "Hide profile links" : "Show profile links"}
              onClick={() => setProfileOpen((value) => !value)}
              className={chevronButtonClass}
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
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
