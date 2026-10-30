"use client";

import { useAuth } from "@/app/auth/AuthContext";
import type { LeadshipTypes } from "@/app/Components/Types/Types";
import { getMeetingWizLeadDisplay } from "@/app/lib/meetingWizLeadDisplay";
import { MeetingWizShell, MeetingWizStepDots, MeetingWizTopBar, mwCard } from "./MeetingWizChrome";

/** Matches the Pre-10 Start Meeting wizard steps, in order. */
const meetingAgenda = [
  {
    title: "Introduction",
    description: "Personal check-in and a clear overview of today’s design journey",
  },
  {
    title: "About HUB",
    description: "Our story, craft, and how we partner with you on the home",
  },
  {
    title: "Design Portfolio",
    description: "Selected projects that show our style, quality, and approach",
  },
  {
    title: "Scope of Work",
    description: "Align rooms, preferences, and the work we will take on",
  },
  {
    title: "Final Quote & Summary",
    description: "Walk through the estimate, timeline, and agreed next steps",
  },
];

interface Props {
  onNext: () => void;
  onPrev: () => void;
  lead?: LeadshipTypes | null;
}

function DesignerAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string | null;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  if (imageUrl) {
    return (
      <div
        style={{
          width: "68px",
          height: "68px",
          borderRadius: "9999px",
          overflow: "hidden",
          border: "2px solid var(--border-color)",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {/* next/image requires known remote domains; fall back to img for profile URLs */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "68px",
        height: "68px",
        borderRadius: "9999px",
        border: "2px solid var(--border-color)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "color-mix(in srgb, var(--brand-blue) 18%, var(--card-bg))",
        color: "var(--brand-dark)",
        fontWeight: 800,
        fontSize: "18px",
      }}
    >
      {initials || "D"}
    </div>
  );
}

export default function Intro({ onNext, onPrev, lead }: Props) {
  const { user } = useAuth();
  const info = getMeetingWizLeadDisplay(lead);
  const designerName = user?.name?.trim() || info.designerName;
  const designerTitle =
    user?.designerTitle?.trim() ||
    (user?.role === "design_manager"
      ? "Design Manager"
      : user?.role === "designer"
        ? "Interior Designer"
        : info.designerTitle);
  const experienceLabel = user?.designerExperience?.trim() || "—";
  const projectsLabel = user?.designerProjects?.trim() || "—";
  const specialtyLabel = user?.designerSpecialty?.trim() || "—";
  const quoteLabel = user?.designerQuote?.trim() || "";
  const metaRows = [
    { label: "Project Name", value: info.projectName },
    { label: "Configuration", value: info.configuration },
    { label: "Property Type", value: info.propertyType },
    { label: "Property Name", value: info.propertyLocation },
    { label: "Budget", value: info.budget },
    { label: "Meeting slot", value: info.timeSlot },
  ];

  return (
    <MeetingWizShell>
      <MeetingWizTopBar onPrev={onPrev} onNext={onNext} prevDisabled />
      <MeetingWizStepDots current={1} caption={`Step 1 of 5 · ${info.hubPid}`} />

      <div className="mx-auto box-border w-full max-w-7xl flex-1 px-8 py-10 md:px-12">
        <h1 className="mb-2 text-4xl font-extrabold leading-tight text-[var(--brand-dark)]">
          1. Introduction
        </h1>
        <p className="mb-10 text-sm text-[var(--foreground)]/65">
          Personal check-in and project phase overview
          {info.phase !== "—" ? ` · ${info.phase}` : ""}.
        </p>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className={`${mwCard} p-8 lg:col-span-8 hover:-translate-y-1 hover:shadow-lg`}>
            <h2 className="mb-4 text-3xl font-extrabold leading-tight text-[var(--brand-dark)]">
              Welcome,
              <br />
              <span className="text-[var(--brand-primary)]">{info.customerName}</span>
            </h2>
            <p className="mb-8 max-w-2xl text-sm leading-relaxed text-[var(--foreground)]/70">
              We&apos;re excited to begin the design journey for your{" "}
              <strong className="font-bold text-[var(--brand-dark)]">
                {info.projectName}
              </strong>{" "}
              project. Today, we&apos;ll align on your vision, explore concepts,
              and establish the roadmap for your dream home.
            </p>

            <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
              {metaRows.map((m) => (
                <div key={m.label} className="group">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--foreground)]/50 transition-colors group-hover:text-[var(--brand-dark)]">
                    {m.label}
                  </div>
                  <div className="text-sm font-bold text-[var(--brand-dark)]">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-8 border-t border-[var(--border-color)] pt-6">
              {[
                { label: "Experience Center", value: info.experienceCenter },
                { label: "Meeting date", value: info.meetingDate },
              ].map((m) => (
                <div key={m.label}>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--foreground)]/50">
                    {m.label}
                  </div>
                  <div className="text-sm font-bold text-[var(--brand-dark)]">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${mwCard} flex flex-col items-center p-8 lg:col-span-4 hover:-translate-y-1 hover:shadow-lg`}>
            <DesignerAvatar name={designerName} imageUrl={user?.profileImage} />

            <div className="mb-6 mt-4 text-center">
              <div className="mb-1 text-lg font-bold text-[var(--brand-dark)]">
                {designerName}
              </div>
              <div className="text-xs font-medium text-[var(--foreground)]/60">
                {designerTitle}
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 border-t border-[var(--border-color)] pt-5">
              {[
                { label: "Experience", value: experienceLabel },
                { label: "Projects", value: projectsLabel },
                { label: "Specialty", value: specialtyLabel },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-medium text-[var(--foreground)]/50">
                    {s.label}
                  </span>
                  <span
                    className="max-w-[150px] truncate text-right text-sm font-bold text-[var(--brand-dark)]"
                    title={s.value}
                  >
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
            {quoteLabel ? (
              <p className="mt-4 text-center text-xs italic leading-relaxed text-[var(--foreground)]/55">
                &ldquo;{quoteLabel}&rdquo;
              </p>
            ) : null}
          </div>
        </div>

        <div className={`${mwCard} mb-10 p-8`}>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-secondary)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <span className="text-lg font-bold text-[var(--brand-dark)]">
              Meeting Agenda
            </span>
          </div>

          <ol className="m-0 flex list-none flex-col p-0">
            {meetingAgenda.map((item, i) => {
              const isCurrent = i === 0;
              const isLast = i === meetingAgenda.length - 1;
              return (
                <li key={item.title} className="relative flex gap-4">
                  <div className="relative flex w-8 shrink-0 flex-col items-center">
                    <span
                      className={`relative z-[1] grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                        isCurrent
                          ? "bg-[var(--brand-primary)] text-white"
                          : "border-2 border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)]/55"
                      }`}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {i + 1}
                    </span>
                    {!isLast ? (
                      <span
                        className="absolute top-8 bottom-0 w-0.5 bg-[var(--border-color)]"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-6"}`}>
                    <div
                      className={`mb-1 text-sm font-bold ${
                        isCurrent ? "text-[var(--brand-primary)]" : "text-[var(--brand-dark)]"
                      }`}
                    >
                      {item.title}
                    </div>
                    <div className="text-xs leading-relaxed text-[var(--foreground)]/60">
                      {item.description}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onNext}
            className="inline-flex cursor-pointer items-center gap-3 rounded-full bg-[var(--brand-primary)] px-10 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:opacity-90"
          >
            Next: About Hub
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </MeetingWizShell>
  );
}
