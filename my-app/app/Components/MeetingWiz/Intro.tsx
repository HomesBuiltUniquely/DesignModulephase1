"use client";

import { useAuth } from "@/app/auth/AuthContext";
import type { LeadshipTypes } from "@/app/Components/Types/Types";
import {
  buildMeetingAgendaTimes,
  getMeetingWizLeadDisplay,
} from "@/app/lib/meetingWizLeadDisplay";
import { MeetingWizDurationBadge } from "./MeetingWizTimer";

const agendaBase = [
  {
    title: "Opening & Soft Intro",
    description: "Personal check-in and project phase summary (5 mins)",
  },
  {
    title: "Concept Walkthrough",
    description: "Review design direction, moodboard, and finishes (20 mins)",
  },
  {
    title: "Budgetary Calibration",
    description: "Align scope, quote, and next steps (15 mins)",
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
          border: "2px solid #d1d5db",
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
        border: "2px solid #d1d5db",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ecfdf5",
        color: "#065f46",
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
  const agendaTimes = buildMeetingAgendaTimes(
    info.timeSlot !== "—" ? info.timeSlot : lead?.appointmentSlot || lead?.scheduledMeetingSlot,
  );
  const agendaItems = agendaBase.map((item, i) => ({
    ...item,
    time: agendaTimes[i] || "—",
  }));

  const metaRows = [
    { label: "Project Name", value: info.projectName },
    { label: "Configuration", value: info.configuration },
    { label: "Property Type", value: info.propertyType },
    { label: "Location", value: info.propertyLocation },
    { label: "Budget", value: info.budget },
    { label: "Meeting slot", value: info.timeSlot },
  ];

  return (
    <main className="min-h-screen w-full bg-[#f0f4f8]">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <MeetingWizDurationBadge />
        <div className="flex items-center gap-4">
          <button
            onClick={onPrev}
            disabled
            className="cursor-not-allowed text-sm font-medium text-gray-300"
          >
            Previous
          </button>
          <button
            onClick={onNext}
            className="rounded-md bg-[#EF0101] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#EF0101]/90"
          >
            Next Phase
          </button>
          <button className="text-xl font-light text-gray-500 transition hover:text-gray-800">×</button>
        </div>
      </div>

      {/* ── Step Progress Dots ── */}
      <div className="flex flex-col items-center py-4">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full w-8 ${i < 1 ? "bg-[#EF0101]" : "bg-gray-300"}`}
            />
          ))}
        </div>
        <span className="mt-1 text-xs font-medium uppercase tracking-widest text-gray-400">
          Step 1 of 5 · {info.hubPid}
        </span>
      </div>

      {/* ── Page Body ── */}
      <div className="flex-1 px-8 md:px-12 py-10 max-w-7xl mx-auto w-full box-border">
        <h1 className="text-4xl font-extrabold text-[#111827] mb-2 leading-tight">
          1. Introduction
        </h1>
        <p className="text-sm text-gray-500 mb-10">
          Personal check-in and project phase overview
          {info.phase !== "—" ? ` · ${info.phase}` : ""}.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Welcome card */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <h2 className="text-3xl font-extrabold text-[#111827] leading-tight mb-4">
              Welcome,
              <br />
              <span className="text-[#EF0101]">{info.customerName}</span>
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-8 max-w-2xl">
              We&apos;re excited to begin the design journey for your{" "}
              <strong className="text-[#111827] font-bold">
                {info.projectName}
              </strong>{" "}
              project. Today, we&apos;ll align on your vision, explore concepts,
              and establish the roadmap for your dream home.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {metaRows.map((m) => (
                <div key={m.label} className="group">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 transition-colors group-hover:text-gray-600">
                    {m.label}
                  </div>
                  <div className="text-sm font-bold text-[#111827]">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-8">
              {[
                { label: "Experience Center", value: info.experienceCenter },
                { label: "Meeting date", value: info.meetingDate },
              ].map((m) => (
                <div key={m.label}>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {m.label}
                  </div>
                  <div className="text-sm font-bold text-gray-800">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Advisor card */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <DesignerAvatar name={designerName} imageUrl={user?.profileImage} />

            <div className="text-center mt-4 mb-6">
              <div className="text-lg font-bold text-[#111827] mb-1">
                {designerName}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                {designerTitle}
              </div>
            </div>

            <div className="w-full border-t border-gray-100 pt-5 flex flex-col gap-3">
              {[
                { label: "Experience", value: experienceLabel },
                { label: "Projects", value: projectsLabel },
                { label: "Specialty", value: specialtyLabel },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex justify-between items-center gap-2"
                >
                  <span className="text-xs text-gray-400 font-medium">
                    {s.label}
                  </span>
                  <span
                    className="text-sm font-bold text-[#111827] text-right truncate max-w-[150px]"
                    title={s.value}
                  >
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
            {quoteLabel ? (
              <p className="text-xs text-gray-400 italic text-center mt-4 leading-relaxed">
                &ldquo;{quoteLabel}&rdquo;
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Meeting Agenda card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm transition-all duration-300 hover:shadow-md mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <span className="text-lg font-bold text-[#111827]">
              Meeting Agenda
            </span>
          </div>

          <div className="flex flex-col">
            {agendaItems.map((item, i) => (
              <div
                key={i}
                className={`flex items-start justify-between py-4 ${
                  i < agendaItems.length - 1 ? "border-b border-gray-100" : ""
                } group`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-200 mt-0.5 shrink-0 transition-colors group-hover:border-[#EF0101]" />
                  <div>
                    <div className="text-sm font-bold text-[#111827] mb-1 transition-colors group-hover:text-[#EF0101]">
                      {item.title}
                    </div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-500 whitespace-nowrap ml-4 mt-1 bg-gray-50 px-2.5 py-1 rounded-md">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onNext}
            className="inline-flex items-center gap-3 rounded-full bg-[#EF0101] px-10 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-red-500/20 transition-all duration-300 hover:bg-[#CC0000] hover:shadow-xl hover:-translate-y-0.5"
          >
            Next: About Hub
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}
