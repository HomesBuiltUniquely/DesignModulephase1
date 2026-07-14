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
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f7f9fc",
        fontFamily: "Arial, Helvetica, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Top Bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
          padding: "10px 24px",
          gap: "14px",
        }}
      >
        {/* Duration pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            borderRadius: "9999px",
            border: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb",
            padding: "6px 16px",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#9ca3af",
            }}
          >
            Duration:
          </span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>
            00:24:18
          </span>
        </div>

        {/* Previous — disabled on step 1 */}
        <button
          onClick={onPrev}
          disabled
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#d1d5db",
            background: "none",
            border: "none",
            cursor: "not-allowed",
            padding: "4px 2px",
          }}
        >
          Previous
        </button>

        {/* Next Phase */}
        <button
          onClick={onNext}
          style={{
            borderRadius: "6px",
            backgroundColor: "#2EE86B",
            padding: "8px 18px",
            fontSize: "13px",
            fontWeight: 700,
            color: "#000000",
            border: "none",
            cursor: "pointer",
          }}
        >
          Next Phase
        </button>

        {/* Close */}
        <button
          style={{
            fontSize: "18px",
            fontWeight: 400,
            color: "#9ca3af",
            background: "none",
            border: "none",
            cursor: "pointer",
            lineHeight: 1,
            padding: "2px 4px",
          }}
        >
          ✕
        </button>
      </div>

      {/* ── Page Body ── */}
      <div
        style={{
          flex: 1,
          padding: "28px 32px 40px",
          maxWidth: "900px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Current step label */}
        <p
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            margin: "0 0 4px",
          }}
        >
          Current Step
        </p>

        {/* Step title + counter */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <h1
            style={{ fontSize: "21px", fontWeight: 800, color: "#111827", margin: 0 }}
          >
            1. Introduction
          </h1>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#9ca3af" }}>
            1<span style={{ fontSize: "11px" }}>/9</span>
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: "3px",
            backgroundColor: "#e5e7eb",
            borderRadius: "9999px",
            overflow: "hidden",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "11%",
              height: "100%",
              backgroundColor: "#2EE86B",
              borderRadius: "9999px",
            }}
          />
        </div>

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
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "#2EE86B",
            border: "none",
            borderRadius: "8px",
            padding: "13px 22px",
            fontSize: "13px",
            fontWeight: 700,
            color: "#000000",
            cursor: "pointer",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Next: About Hub
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000000"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </main>
  );
}
