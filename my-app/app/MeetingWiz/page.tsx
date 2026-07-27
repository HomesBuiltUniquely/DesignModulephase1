"use client";

import { useState } from "react";
import Intro from "../Components/MeetingWiz/Intro";
import AboutHub from "../Components/MeetingWiz/AboutHub";
import DesignPort from "../Components/MeetingWiz/DesignPort";
import ScopeOfWork from "../Components/MeetingWiz/ScopeOfWork";
import FinalQuoteSum from "../Components/MeetingWiz/FinalQuoteSum";

function StepPlaceholder({
  stepNumber,
  title,
  onNext,
  onPrev,
}: {
  stepNumber: number;
  title: string;
  onNext: () => void;
  onPrev: () => void;
}) {
  const progress = Math.round((stepNumber / 9) * 100);

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
      {/* Top Bar */}
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
              textTransform: "uppercase" as const,
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
        <button
          onClick={onPrev}
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#6b7280",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 2px",
          }}
        >
          Previous
        </button>
        <button
          onClick={onNext}
          style={{
            borderRadius: "6px",
            backgroundColor: "#2EE86B",
            padding: "8px 18px",
            fontSize: "13px",
            fontWeight: 700,
            color: "#000",
            border: "none",
            cursor: "pointer",
          }}
        >
          Next Phase
        </button>
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

      {/* Body */}
      <div
        style={{
          flex: 1,
          padding: "28px 32px 40px",
          maxWidth: "900px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box" as const,
        }}
      >
        <p
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "#9ca3af",
            textTransform: "uppercase" as const,
            letterSpacing: "0.09em",
            margin: "0 0 4px",
          }}
        >
          Current Step
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <h1
            style={{
              fontSize: "30px",
              fontWeight: 800,
              color: "#111827",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {stepNumber}. {title}
          </h1>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#9ca3af" }}>
            {stepNumber}
            <span style={{ fontSize: "11px" }}>/9</span>
          </span>
        </div>
        <div
          style={{
            height: "3px",
            backgroundColor: "#e5e7eb",
            borderRadius: "9999px",
            overflow: "hidden",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              backgroundColor: "#2EE86B",
              borderRadius: "9999px",
            }}
          />
        </div>

        {/* Placeholder content */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1.5px dashed #d1d5db",
            padding: "60px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "9999px",
              backgroundColor: "#f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#374151",
              margin: 0,
            }}
          >
            Step {stepNumber} — {title}
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "#9ca3af",
              margin: 0,
              maxWidth: "320px",
              lineHeight: 1.6,
            }}
          >
            This step is currently being built by a team member. Pull their
            changes to see the full UI here.
          </p>
        </div>

        {/* Nav button */}
        <div style={{ marginTop: "32px", display: "flex", gap: "12px" }}>
          <button
            onClick={onPrev}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#f3f4f6",
              border: "none",
              borderRadius: "8px",
              padding: "12px 20px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#374151",
              cursor: "pointer",
            }}
          >
            ← Previous
          </button>
          <button
            onClick={onNext}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              backgroundColor: "#2EE86B",
              border: "none",
              borderRadius: "8px",
              padding: "12px 22px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#000",
              cursor: "pointer",
              textTransform: "uppercase" as const,
              letterSpacing: "0.04em",
            }}
          >
            Next →
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Step registry ────────────────────────────────────────────────────────────

const TOTAL_STEPS = 9;

export default function MeetingWizPage() {
  const [step, setStep] = useState(1);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  switch (step) {
    case 1:
      return <Intro onNext={next} onPrev={prev} />;
    case 2:
      return <AboutHub onNext={next} onPrev={prev} />;
    case 3:
      return <DesignPort onNext={next} onPrev={prev} />;
    case 4:
      return <ScopeOfWork onNext={next} onPrev={prev} />;
    case 5:
      return <FinalQuoteSum onNext={next} onPrev={prev} />;
    default:
      return (
        <StepPlaceholder
          stepNumber={step}
          title={`Step ${step}`}
          onNext={next}
          onPrev={prev}
        />
      );
  }
}
