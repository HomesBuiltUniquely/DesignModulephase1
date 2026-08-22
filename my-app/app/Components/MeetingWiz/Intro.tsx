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
            className="rounded-md bg-[#2EE86B] px-6 py-2 text-sm font-semibold text-black transition hover:bg-[#24d45d]"
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
              className={`h-1 rounded-full w-8 ${i < 1 ? "bg-[#2EE86B]" : "bg-gray-300"}`}
            />
          ))}
        </div>
        <span className="mt-1 text-xs font-medium uppercase tracking-widest text-gray-400">
          Step 1 of 5 · {info.hubPid}
        </span>
      </div>

      {/* ── Page Body ── */}
      <div
        style={{
          flex: 1,
          padding: "0 32px 40px",
          maxWidth: "900px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{ fontSize: "30px", fontWeight: 800, color: "#111827", margin: "0 0 4px", lineHeight: 1.1 }}
        >
          1. Introduction
        </h1>
        <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 24px" }}>
          Personal check-in and project phase overview
          {info.phase !== "—" ? ` · ${info.phase}` : ""}.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 250px",
            gap: "18px",
            marginBottom: "18px",
          }}
        >
          {/* Welcome card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "28px 28px 26px",
            }}
          >
            <h2
              style={{
                fontSize: "28px",
                fontWeight: 800,
                color: "#111827",
                lineHeight: 1.2,
                margin: "0 0 14px",
              }}
            >
              Welcome,
              <br />
              {info.customerName}
            </h2>
            <p
              style={{
                fontSize: "13.5px",
                color: "#6b7280",
                lineHeight: 1.65,
                margin: "0 0 28px",
              }}
            >
              We&apos;re excited to begin the design journey for your{" "}
              <strong style={{ color: "#111827", fontWeight: 700 }}>
                {info.projectName}
              </strong>{" "}
              project. Today, we&apos;ll align on your vision, explore concepts,
              and establish the roadmap for your dream home.
            </p>

            <div style={{ display: "flex", gap: "28px", flexWrap: "wrap" }}>
              {metaRows.map((m) => (
                <div key={m.label} style={{ minWidth: "120px" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: "4px",
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: "20px",
                paddingTop: "16px",
                borderTop: "1px solid #f3f4f6",
                display: "flex",
                gap: "28px",
                flexWrap: "wrap",
              }}
            >
              {[
                { label: "Experience Center", value: info.experienceCenter },
                { label: "Meeting date", value: info.meetingDate },
              ].map((m) => (
                <div key={m.label} style={{ minWidth: "120px" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: "4px",
                    }}
                  >
                    {m.label}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Advisor card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "24px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <DesignerAvatar name={designerName} imageUrl={user?.profileImage} />

            <div style={{ textAlign: "center" }}>
              <div
                style={{ fontSize: "15px", fontWeight: 700, color: "#111827", marginBottom: "2px" }}
              >
                {designerName}
              </div>
              <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>
                {designerTitle}
              </div>
            </div>

            <div
              style={{
                width: "100%",
                borderTop: "1px solid #f3f4f6",
                paddingTop: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "9px",
              }}
            >
              {[
                { label: "Experience", value: experienceLabel },
                { label: "Projects", value: projectsLabel },
                { label: "Specialty", value: specialtyLabel },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                >
                  <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>
                    {s.label}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#111827",
                      textAlign: "right",
                      maxWidth: "140px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={s.value}
                  >
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
            {quoteLabel ? (
              <p
                style={{
                  fontSize: "11px",
                  color: "#9ca3af",
                  fontStyle: "italic",
                  textAlign: "center",
                  margin: "4px 0 0",
                  lineHeight: 1.5,
                }}
              >
                &ldquo;{quoteLabel}&rdquo;
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Meeting Agenda card ── */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "22px 28px 8px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "7px",
                backgroundColor: "#fff7ed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f97316"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>
              Meeting Agenda
            </span>
          </div>

          {agendaItems.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "13px 0",
                borderBottom: i < agendaItems.length - 1 ? "1px solid #f3f4f6" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div
                  style={{
                    width: "17px",
                    height: "17px",
                    borderRadius: "9999px",
                    border: "1.5px solid #d1d5db",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                />
                <div>
                  <div
                    style={{ fontSize: "13.5px", fontWeight: 600, color: "#111827", marginBottom: "3px" }}
                  >
                    {item.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>{item.description}</div>
                </div>
              </div>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#6b7280",
                  whiteSpace: "nowrap",
                  marginLeft: "20px",
                  marginTop: "2px",
                }}
              >
                {item.time}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onNext}
          className="inline-flex items-center gap-3 rounded-lg bg-[#2EE86B] px-6 py-3 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-[#24d45d]"
        >
          Next: About Hub
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </main>
  );
}
