"use client";

interface Props {
  onNext: () => void;
  onPrev: () => void;
}

const lineItems = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    room: "Modular Kitchen",
    tags: "KITCHEN, WARDROBES, CIVIL",
    amount: "₹6,20,000",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    room: "Living Room",
    tags: "KITCHEN, WARDROBES, STORAGE",
    amount: "₹7,45,000",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    room: "Master Bedroom",
    tags: "FURNITURE, LIGHTING, ART",
    amount: "₹1,75,000",
  },
];

export default function FinalQuoteSum({ onPrev }: Props) {
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
          backgroundColor: "#f2f4f7",
          padding: "10px 20px",
          flexShrink: 0,
        }}
      >
        {/* Left — timer + step label */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#2EE86B",
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            00:24:15
          </span>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 600,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              lineHeight: 1,
            }}
          >
            STEP 9/9
          </span>
        </div>

        {/* Right — close */}
        <button
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "9999px",
            border: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#6b7280",
            fontSize: "14px",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* ── Scrollable Body ── */}
      <div
        style={{
          flex: 1,
          padding: "8px 32px 60px",
          maxWidth: "700px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Green square icon */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "10px",
              backgroundColor: "#d1fae5",
            }}
          />
        </div>

        {/* Page title */}
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#111827",
            textAlign: "center",
            margin: "0 0 10px",
            lineHeight: 1.2,
          }}
        >
          9. Final Quote &amp; Summary
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "13.5px",
            color: "#6b7280",
            textAlign: "center",
            margin: "0 0 28px",
            lineHeight: 1.6,
            maxWidth: "420px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Thank you,{" "}
          <strong style={{ color: "#111827", fontWeight: 700 }}>
            Julian Montgomery
          </strong>
          , for sharing your vision with HUB. We are excited to build your
          dream home together.
        </p>

        {/* ── Two-column card row ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 200px",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          {/* Left — Estimated Project Value */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "20px 22px 18px",
            }}
          >
            <p
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                margin: "0 0 6px",
              }}
            >
              Estimated Project Value
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "6px",
                marginBottom: "20px",
              }}
            >
              <span
                style={{
                  fontSize: "34px",
                  fontWeight: 800,
                  color: "#111827",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                ₹15,40,000
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#9ca3af",
                  letterSpacing: "0.04em",
                }}
              >
                INR
              </span>
            </div>

            {/* Line items */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {lineItems.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "11px 0",
                    borderTop: "1px solid #f3f4f6",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        backgroundColor: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#111827",
                          lineHeight: 1.2,
                        }}
                      >
                        {item.room}
                      </div>
                      <div
                        style={{
                          fontSize: "9.5px",
                          color: "#9ca3af",
                          fontWeight: 500,
                          letterSpacing: "0.04em",
                          marginTop: "1px",
                        }}
                      >
                        {item.tags}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#111827",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — Handover + Quick Actions */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {/* Estimated Hand-Over card */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "18px 16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <p
                style={{
                  fontSize: "9.5px",
                  fontWeight: 600,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: 0,
                  textAlign: "center",
                }}
              >
                Estimated Hand-Over
              </p>
              {/* Calendar icon */}
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  backgroundColor: "#d1fae5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#059669"
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
              <div
                style={{
                  fontSize: "17px",
                  fontWeight: 800,
                  color: "#111827",
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                April 15, 2025
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#9ca3af",
                  fontWeight: 500,
                  textAlign: "center",
                  letterSpacing: "0.04em",
                }}
              >
                APPROX. 45 DAYS
              </div>
            </div>

            {/* Quick Actions card */}
            <div
              style={{
                backgroundColor: "#111827",
                borderRadius: "12px",
                padding: "16px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <p
                style={{
                  fontSize: "9.5px",
                  fontWeight: 600,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: 0,
                }}
              >
                Quick Actions
              </p>
              {/* Generate quote link */}
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "6px",
                    backgroundColor: "#2EE86B",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#ffffff",
                  }}
                >
                  Generate quote link
                </span>
              </button>
              {/* Email to Client */}
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "6px",
                    backgroundColor: "#2EE86B",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#ffffff",
                  }}
                >
                  Email to Client
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Note on Estimates ── */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "16px 18px",
            backgroundColor: "transparent",
            marginBottom: "32px",
          }}
        >
          {/* Orange info dot */}
          <div style={{ flexShrink: 0, marginTop: "1px" }}>
            <div
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "9999px",
                border: "1.5px solid #f97316",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#f97316", lineHeight: 1 }}>
                i
              </span>
            </div>
          </div>
          <div>
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
              Note on Estimates
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: 0,
                lineHeight: 1.65,
                maxWidth: "520px",
              }}
            >
              These figures are based on the initial preferences and measurements captured during the
              flow. A final on-site verification will be required to convert this estimate into a
              binding contract. Quotes are valid for 7 business days from the date of generation.
            </p>
          </div>
        </div>

        {/* ── Meeting Completed button ── */}
        <button
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            width: "100%",
            backgroundColor: "#2EE86B",
            border: "none",
            borderRadius: "10px",
            padding: "18px 32px",
            fontSize: "14px",
            fontWeight: 800,
            color: "#000000",
            cursor: "pointer",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Meeting Completed
          <span style={{ fontSize: "18px" }}>🚀</span>
        </button>
      </div>
    </main>
  );
}
