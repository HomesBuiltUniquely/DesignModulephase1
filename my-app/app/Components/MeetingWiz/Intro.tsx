"use client";

import Image from "next/image";

const agendaItems = [
  {
    title: "Opening & Soft Intro",
    description: "Personal check-in and project phase summary (5 mins)",
    time: "09:00 AM",
  },
  {
    title: "V02 Concept Walkthrough",
    description: "Reviewing the primary suite moodboard and finishes (20 mins)",
    time: "09:05 AM",
  },
  {
    title: "Budgetary Calibration",
    description: "Finalizing material selections for sourcing (15 mins)",
    time: "09:25 AM",
  },
];

interface Props {
  onNext: () => void;
  onPrev: () => void;
}

export default function Intro({ onNext, onPrev }: Props) {
  return (
    <main className="min-h-screen w-full bg-[#f0f4f8]">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-gray-400"></div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Duration:</span>
          <span className="text-sm font-bold text-gray-900">00:24:18</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Previous — disabled on step 1 */}
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
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full w-8 ${i < 1 ? "bg-[#2EE86B]" : "bg-gray-300"}`}
            />
          ))}
        </div>
        <span className="mt-1 text-xs font-medium uppercase tracking-widest text-gray-400">
          Step 1 of 9
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
        {/* Step title */}
        <h1
          style={{ fontSize: "30px", fontWeight: 800, color: "#111827", margin: "0 0 4px", lineHeight: 1.1 }}
        >
          1. Introduction
        </h1>
        <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 24px" }}>
          Personal check-in and project phase overview.
        </p>

        {/* ── Two-column card row ── */}
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
              Julian Montgomery
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
                Imperial Suite
              </strong>{" "}
              project. Today, we&apos;ll align on your vision, explore concepts,
              and establish the roadmap for your dream home.
            </p>

            {/* Project meta */}
            <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
              {[
                { label: "Project Name", value: "Imperial Suite" },
                { label: "Configuration", value: "4 BHK" },
                { label: "Property Type", value: "Premium Penthouse" },
              ].map((m) => (
                <div key={m.label}>
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
            {/* Avatar */}
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
              <Image
                src="/profile1.jpg"
                alt="Alex Rivera"
                fill
                style={{ objectFit: "cover" }}
              />
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{ fontSize: "15px", fontWeight: 700, color: "#111827", marginBottom: "2px" }}
              >
                Alex Rivera
              </div>
              <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>
                Lead Interior Architect
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
                { label: "Experience", value: "12 Years" },
                { label: "Projects", value: "140+ Suites" },
                { label: "Specialty", value: "Modern Luxury" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#111827" }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>

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
              &ldquo;Creating spaces that breathe and inspire.&rdquo;
            </p>
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

        {/* ── Next Button ── */}
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
