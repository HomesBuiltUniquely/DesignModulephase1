"use client";

import Image from "next/image";

const roomCards = [
  {
    icon: "🌿",
    iconBg: "#f0fdf4",
    title: "Living Room",
    coreTheme: "Minimalist, Air-purifying greenery, neutral tones.",
    unitLabel: "INCLUDED UNITS",
    tags: ["TV Unit", "Sofa", "Center Table", "False Ceiling Required"],
    notesLabel: "SPECIFIC ROOM NOTES",
    quote: '"Focus on minimalist vibe with hidden storage for electronics."',
  },
  {
    icon: "🟡",
    iconBg: "#fefce8",
    title: "Modular Kitchen",
    coreTheme: "High-gloss acrylic, ergonomic workflow.",
    unitLabel: "INCLUDED UNITS",
    tags: ["Base Units", "Wall Units", "Tall Unit", "L-Shaped with Island"],
    notesLabel: "SPECIFIC ROOM NOTES",
    quote: '"Quartz countertop preferred; ensure extra space for the dishwasher."',
  },
];

interface Props {
  onNext: () => void;
  onPrev: () => void;
}

export default function ScopeOfWork({ onNext, onPrev }: Props) {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f2f4f7",
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
          justifyContent: "space-between",
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
          padding: "0 24px",
          height: "44px",
          flexShrink: 0,
        }}
      >
        {/* Left — breadcrumb with green underline on active */}
        <div style={{ display: "flex", alignItems: "center", gap: "0", height: "100%" }}>
          {/* STEP 4/9 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 14px",
              height: "100%",
              borderRight: "1px solid #e5e7eb",
            }}
          >
            <span style={{ fontSize: "9px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", lineHeight: 1 }}>
              STEP 4/9
            </span>
          </div>
          {/* SCOPE SUMMARY — active tab with green bottom border */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 14px",
              height: "100%",
              borderBottom: "2.5px solid #2EE86B",
              marginBottom: "-1px",
            }}
          >
            <span style={{ fontSize: "9px", fontWeight: 700, color: "#111827", textTransform: "uppercase", letterSpacing: "0.07em", lineHeight: 1 }}>
              SCOPE SUMMARY
            </span>
          </div>
        </div>

        {/* Right — Previous + Save Draft */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={onPrev}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              fontWeight: 500,
              color: "#6b7280",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 2px",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Previous
          </button>
          <button
            style={{
              borderRadius: "6px",
              backgroundColor: "#111827",
              padding: "7px 16px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Save Draft
          </button>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div
        style={{
          flex: 1,
          padding: "32px 40px 100px",
          maxWidth: "780px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Page title */}
        <h1
          style={{
            fontSize: "26px",
            fontWeight: 800,
            color: "#111827",
            margin: "0 0 6px",
            lineHeight: 1.2,
          }}
        >
          4. Scope of Work Summary
        </h1>
        <p style={{ fontSize: "13px", color: "#9ca3af", margin: "0 0 28px", lineHeight: 1.5 }}>
          Review the final project parameters before proceeding to budget calibration.
        </p>

        {/* ── Design Scope card ── */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "20px 22px 6px",
            marginBottom: "16px",
          }}
        >
          {/* Card header */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "7px",
                backgroundColor: "#111827",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>
              Design Scope
            </span>
          </div>

          {/* Room cards */}
          {roomCards.map((room, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "16px 18px",
                marginBottom: "12px",
                display: "grid",
                gridTemplateColumns: "160px 1fr",
                gap: "20px",
              }}
            >
              {/* Left col — room name + icon + core theme */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "6px",
                      backgroundColor: room.iconBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      flexShrink: 0,
                    }}
                  >
                    {room.icon}
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>
                    {room.title}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "11.5px",
                    color: "#6b7280",
                    margin: 0,
                    lineHeight: 1.55,
                  }}
                >
                  {room.coreTheme}
                </p>
              </div>

              {/* Right col — units + notes */}
              <div>
                {/* Included Units */}
                <p
                  style={{
                    fontSize: "9.5px",
                    fontWeight: 700,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    margin: "0 0 7px",
                  }}
                >
                  {room.unitLabel}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "14px" }}>
                  {room.tags.map((tag, t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 500,
                        color: "#374151",
                        backgroundColor: "#f3f4f6",
                        borderRadius: "4px",
                        padding: "3px 8px",
                        border: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Specific Room Notes */}
                <p
                  style={{
                    fontSize: "9.5px",
                    fontWeight: 700,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    margin: "0 0 5px",
                  }}
                >
                  {room.notesLabel}
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                    fontStyle: "italic",
                    margin: 0,
                    lineHeight: 1.55,
                  }}
                >
                  {room.quote}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Reference & Inspiration card ── */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "20px 22px 20px",
            marginBottom: "28px",
          }}
        >
          {/* Card header */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "7px",
                backgroundColor: "#fefce8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "15px",
              }}
            >
              ✨
            </div>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>
              Reference &amp; Inspiration
            </span>
          </div>

          {/* Image grid */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}>
            {/* Image 1 — Living Room (Scandinavian lounge) */}
            <div
              style={{
                width: "170px",
                height: "120px",
                borderRadius: "8px",
                overflow: "hidden",
                flexShrink: 0,
                position: "relative",
              }}
            >
              <Image
                src="/A. A soft oak Scandinavian lounge chair.png"
                alt="Living Room Reference"
                fill
                style={{ objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "6px 8px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)",
                  display: "flex",
                  alignItems: "flex-end",
                }}
              >
                <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.92)", fontWeight: 600 }}>
                  Living Room Ref
                </span>
              </div>
            </div>

            {/* Image 2 — Kitchen (Modern contemporary) */}
            <div
              style={{
                width: "170px",
                height: "120px",
                borderRadius: "8px",
                overflow: "hidden",
                flexShrink: 0,
                position: "relative",
              }}
            >
              <Image
                src="/F. Modern contemporary kitchen with clean lines.png"
                alt="Kitchen Reference"
                fill
                style={{ objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "6px 8px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)",
                  display: "flex",
                  alignItems: "flex-end",
                }}
              >
                <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.92)", fontWeight: 600 }}>
                  Kitchen Ref
                </span>
              </div>
            </div>

            {/* Add More tile */}
            <div
              style={{
                width: "100px",
                height: "120px",
                borderRadius: "8px",
                border: "1.5px dashed #d1d5db",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: "pointer",
                flexShrink: 0,
                backgroundColor: "#fafafa",
              }}
            >
              <span style={{ fontSize: "22px", color: "#9ca3af", lineHeight: 1 }}>+</span>
              <span style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                ADD MORE
              </span>
            </div>
          </div>

          {/* Aesthetic Notes */}
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "14px" }}>
            <p
              style={{
                fontSize: "9.5px",
                fontWeight: 700,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                margin: "0 0 6px",
              }}
            >
              Aesthetic Notes
            </p>
            <p style={{ fontSize: "12.5px", color: "#6b7280", margin: 0, lineHeight: 1.65 }}>
              Prefers luxury finishes in the living area and kitchen specifically. Client dislikes heavy
              textures or dark wood grains.
            </p>
          </div>
        </div>

        {/* ── CREATE PROJECT button — centered in body ── */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              backgroundColor: "#2EE86B",
              border: "none",
              borderRadius: "8px",
              padding: "14px 36px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#000000",
              cursor: "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {/* Rocket icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
              <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
            Create Project
          </button>
        </div>
      </div>

      {/* ── Bottom footer bar ── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#f2f4f7",
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 50,
          borderTop: "1px solid #e5e7eb",
        }}
      >
        {/* Green dot indicator */}
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "9999px",
            backgroundColor: "#2EE86B",
          }}
        />

        {/* Next: Get Quote */}
        <button
          onClick={onNext}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "#2EE86B",
            border: "none",
            borderRadius: "6px",
            padding: "10px 20px",
            fontSize: "12px",
            fontWeight: 700,
            color: "#000000",
            cursor: "pointer",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Next: Get Quote
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </main>
  );
}
