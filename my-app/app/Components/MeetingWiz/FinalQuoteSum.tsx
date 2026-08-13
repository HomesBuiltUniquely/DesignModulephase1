"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/auth/AuthContext";
import { getApiBase } from "@/app/lib/apiBase";
import { MEETING_WIZ_COMPLETED_TASK } from "@/app/lib/meetingWizIncentive";
import { getMeetingWizLeadDisplay } from "@/app/lib/meetingWizLeadDisplay";
import {
  getLeadScheduledMeetingIsoDay,
  todayIsoDay,
} from "@/app/lib/leadMeetingSchedule";
import {
  formatMeetingWizInr,
  summarizeMeetingWizQuote,
  type MeetingWizQuoteLineItem,
} from "@/app/lib/meetingWizQuoteSummary";
import { runProlanceGetQuoteApiFlow } from "@/app/lib/prolanceApiGetQuote";
import {
  openInternalQuoteInNewTab,
  persistProlanceQuoteIdsAndSnapshot,
} from "@/app/lib/prolanceGetQuotePersistSnapshot";
import type { LeadshipTypes } from "@/app/Components/Types/Types";
import { useMeetingWizTimer } from "./MeetingWizTimer";
import {
  MeetingWizShell,
  MeetingWizTopBar,
  mwCard,
  mwDarkBtn,
  mwH1,
  mwMuted,
} from "./MeetingWizChrome";

interface Props {
  onNext: () => void;
  onPrev: () => void;
  lead?: LeadshipTypes | null;
  onLeadUpdated?: (lead: LeadshipTypes) => void;
  onMeetingCompleted?: () => void;
}

function RoomIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function formatHandover(lead: LeadshipTypes | null | undefined): { dateLabel: string; subLabel: string } {
  const possession = lead?.intakePossessionDate?.trim();
  const timeline = lead?.configScopeSummary?.expectedTimeline?.trim();
  if (possession) {
    const d = new Date(possession);
    if (!Number.isNaN(d.getTime())) {
      return {
        dateLabel: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        subLabel: timeline ? timeline.toUpperCase() : "POSSESSION TARGET",
      };
    }
    return { dateLabel: possession, subLabel: timeline ? timeline.toUpperCase() : "POSSESSION TARGET" };
  }
  if (timeline) {
    return { dateLabel: timeline, subLabel: "EXPECTED TIMELINE" };
  }
  return { dateLabel: "—", subLabel: "TO BE CONFIRMED" };
}

export default function FinalQuoteSum({
  onPrev,
  onNext: _onNext,
  lead,
  onLeadUpdated,
  onMeetingCompleted,
}: Props) {
  const { sessionId, user } = useAuth();
  const API = getApiBase();
  const timer = useMeetingWizTimer();
  const info = getMeetingWizLeadDisplay(lead);
  const handover = formatHandover(lead);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  const [lineItems, setLineItems] = useState<MeetingWizQuoteLineItem[]>([]);
  const [quoteId, setQuoteId] = useState<number | null>(
    lead?.prolanceQuoteId != null && Number(lead.prolanceQuoteId) >= 1
      ? Number(lead.prolanceQuoteId)
      : null,
  );

  const fetchQuote = useCallback(async () => {
    setQuoteError(null);
    if (!lead) {
      setQuoteError("Open Start meeting from a lead so Get Quote can load the Prolance quotation.");
      return;
    }
    const pid = lead.prolanceProjectId != null ? Number(lead.prolanceProjectId) : NaN;
    if (!Number.isFinite(pid) || pid < 1) {
      setQuoteError(
        "Create or link a Prolance project on Scope of Work first, then open Final Quote again.",
      );
      return;
    }
    if (!sessionId) {
      setQuoteError("Please sign in to fetch the quote.");
      return;
    }

    setQuoteLoading(true);
    try {
      const result = await runProlanceGetQuoteApiFlow({
        appApiBase: API,
        sessionId,
        quoteProjectId: pid,
      });
      if (!result.ok) {
        setQuoteError(result.message);
        return;
      }

      const summary = summarizeMeetingWizQuote(
        result.quoteBody,
        result.redirectQuoteId,
      );
      setLineItems(summary.lineItems);
      setQuoteTotal(summary.totalPayable ?? summary.interiorProjectAmount);
      const resolvedQuoteId = result.redirectQuoteId ?? summary.quoteId;
      if (resolvedQuoteId != null) setQuoteId(resolvedQuoteId);

      if (resolvedQuoteId != null) {
        const patchOk = await persistProlanceQuoteIdsAndSnapshot({
          appApiBase: API,
          sessionId,
          leadId: lead.id,
          prolanceQuoteId: resolvedQuoteId,
          quoteBody: result.quoteBody,
        });
        if (patchOk) {
          onLeadUpdated?.({
            ...lead,
            prolanceQuoteId: resolvedQuoteId,
          });
        }
      }

      if (!summary.lineItems.length && summary.totalPayable == null) {
        setQuoteError(
          "Get Quote returned a response, but no room totals were found. Open the full quote link to review.",
        );
      }
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "Get Quote failed");
    } finally {
      setQuoteLoading(false);
    }
  }, [API, lead, onLeadUpdated, sessionId]);

  useEffect(() => {
    void fetchQuote();
    // Fetch once when entering this step for the current lead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, lead?.prolanceProjectId]);

  const handleOpenQuoteLink = () => {
    if (quoteId != null && lead) {
      openInternalQuoteInNewTab(quoteId, lead.id);
      return;
    }
    setQuoteError("No quote ID yet. Wait for Get Quote to finish, or create a project first.");
  };

  const handleMeetingCompleted = async () => {
    setMessage(null);
    if (!lead) {
      setMessage("Open Start meeting from a lead so this session can count toward incentives.");
      return;
    }
    if (!sessionId) {
      setMessage("Please sign in to mark the meeting complete.");
      return;
    }
    if (done || busy) return;

    setBusy(true);
    try {
      const endedAt = new Date().toISOString();
      const meetingDate =
        getLeadScheduledMeetingIsoDay(lead) || todayIsoDay();
      const event = {
        id: `ev-mwiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: "completed",
        taskName: MEETING_WIZ_COMPLETED_TASK,
        milestoneName: "Meeting Wizard",
        timestamp: endedAt,
        description: `Meeting wizard session completed (${timer.formatted}). Counted toward designer incentives.`,
        user: { name: user?.name ?? "Designer", avatar: user?.profileImage ?? null },
        meta: {
          incentiveMeeting: true,
          completedAt: endedAt,
          startedAt: new Date(timer.startedAtMs).toISOString(),
          durationSeconds: timer.durationSeconds,
          durationFormatted: timer.formatted,
          leadId: lead.id,
          source: "meeting_wiz_final_quote",
          meetingDate,
          quoteId: quoteId,
          quoteTotal: quoteTotal,
        },
      };

      const res = await fetch(`${API}/api/leads/${lead.id}/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionId}`,
        },
        credentials: "include",
        body: JSON.stringify(event),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMessage(
          String((body as { message?: string })?.message || "Failed to record meeting completion."),
        );
        return;
      }

      try {
        const persistRes = await fetch(`${API}/api/leads/${lead.id}/meeting-wiz-completed`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionId}`,
          },
          body: JSON.stringify({ completedAt: endedAt, meetingDate }),
        });
        if (persistRes.ok) {
          const persistBody = await persistRes.json().catch(() => ({}));
          onLeadUpdated?.({
            ...lead,
            meetingWizLastCompleted:
              (persistBody as { meetingWizLastCompleted?: LeadshipTypes["meetingWizLastCompleted"] })
                .meetingWizLastCompleted ?? {
                at: endedAt,
                meetingDate,
              },
          });
        } else {
          onLeadUpdated?.({
            ...lead,
            meetingWizLastCompleted: { at: endedAt, meetingDate },
          });
        }
      } catch {
        onLeadUpdated?.({
          ...lead,
          meetingWizLastCompleted: { at: endedAt, meetingDate },
        });
      }

      setDone(true);
      setMessage("Meeting marked complete. This session counts toward your fortnight meeting total.");
      onMeetingCompleted?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to record meeting completion.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MeetingWizShell className="flex flex-col">
      <MeetingWizTopBar
        onPrev={onPrev}
        hideNext
        extra={
          <button
            type="button"
            onClick={() => void fetchQuote()}
            disabled={quoteLoading}
            className={mwDarkBtn}
          >
            {quoteLoading ? "Fetching quote…" : "Refresh quote"}
          </button>
        }
        leading={
          <div className="flex flex-col items-start gap-0 text-left">
            <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--brand-blue)] tabular-nums">
              {timer.formatted}
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]/50">
              STEP 5/5 · LIVE
            </span>
          </div>
        }
      />

      <div className="flex-1 px-8 md:px-12 py-10 max-w-7xl mx-auto w-full box-border pb-28">


        <h1 className={`${mwH1} mb-4 text-center`}>
          5. Final Quote &amp; Summary
        </h1>

        <p className={`${mwMuted} mx-auto mb-10 max-w-2xl text-center`}>
          Thank you,{" "}
          <strong className="font-bold text-[var(--brand-dark)]">
            {info.customerName}
          </strong>
          , for sharing your vision with HUB
          {info.projectName !== "your project" && info.projectName !== info.customerName ? (
            <>
              {" "}
              on{" "}
              <strong className="font-bold text-[var(--brand-dark)]">
                {info.projectName}
              </strong>
            </>
          ) : null}
          . We are excited to build your dream home together.
        </p>

        {quoteLoading ? (
          <p className="mb-4 text-center text-[13px] text-[var(--brand-blue)]">
            Collecting the latest Prolance quote…
          </p>
        ) : null}
        {quoteError ? (
          <p className="mb-4 text-center text-xs text-[var(--brand-primary)]">
            {quoteError}
          </p>
        ) : null}
        {quoteId != null && !quoteLoading ? (
          <p className="mb-4 text-center text-[11px] text-[var(--foreground)]/50">
            Quote ID {quoteId}
          </p>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 200px",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          <div className={`${mwCard} p-8`}>
            <p
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
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
                  color: "var(--brand-dark)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                {quoteLoading ? "…" : formatMeetingWizInr(quoteTotal)}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
                  letterSpacing: "0.04em",
                }}
              >
                INR
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {!quoteLoading && !lineItems.length ? (
                <p style={{ fontSize: "12px", color: "color-mix(in srgb, var(--foreground) 50%, transparent)", margin: "8px 0" }}>
                  No room-wise quote lines yet. Use Create Project on the previous step, build the quote in
                  Prolance, then Refresh quote.
                </p>
              ) : null}
              {lineItems.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "11px 0",
                    borderTop: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        backgroundColor: "var(--hover-bg)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <RoomIcon />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--brand-dark)",
                          lineHeight: 1.2,
                        }}
                      >
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: "9.5px",
                          color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
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
                      color: "var(--brand-dark)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatMeetingWizInr(item.discountedAmount ?? item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className={`${mwCard} flex flex-col items-center gap-2 p-6`}>
              <p
                style={{
                  fontSize: "9.5px",
                  fontWeight: 600,
                  color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: 0,
                  textAlign: "center",
                }}
              >
                Estimated Hand-Over
              </p>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  backgroundColor: "color-mix(in srgb, var(--brand-blue) 22%, var(--card-bg))",
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
                  stroke="var(--brand-blue)"
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
                  color: "var(--brand-dark)",
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {handover.dateLabel}
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
                  fontWeight: 500,
                  textAlign: "center",
                  letterSpacing: "0.04em",
                }}
              >
                {handover.subLabel}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-sm transition-all duration-300 hover:shadow-md">
              <p
                style={{
                  fontSize: "9.5px",
                  fontWeight: 600,
                  color: "color-mix(in srgb, var(--foreground) 55%, transparent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: 0,
                }}
              >
                Quick Actions
              </p>
              <button
                type="button"
                onClick={handleOpenQuoteLink}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-left transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-secondary)]"
              >
                <div
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "6px",
                    backgroundColor: "var(--brand-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-[var(--brand-dark)]">
                  Generate quote link
                </span>
              </button>
              <button
                type="button"
                onClick={() => void fetchQuote()}
                disabled={quoteLoading}
                className="flex w-full items-center gap-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-left transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "6px",
                    backgroundColor: "var(--brand-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-[var(--brand-dark)]">
                  {quoteLoading ? "Fetching…" : "Refresh Get Quote"}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "16px 18px",
            backgroundColor: "transparent",
            marginBottom: "32px",
          }}
        >
          <div style={{ flexShrink: 0, marginTop: "1px" }}>
            <div
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "9999px",
                border: "1.5px solid var(--brand-yellow)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--brand-yellow)", lineHeight: 1 }}>
                i
              </span>
            </div>
          </div>
          <div>
            <p
              style={{
                fontSize: "9.5px",
                fontWeight: 700,
                color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
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
                color: "color-mix(in srgb, var(--foreground) 62%, transparent)",
                margin: 0,
                lineHeight: 1.65,
                maxWidth: "520px",
              }}
            >
              These figures come from the latest Prolance quotation for this lead. A final on-site
              verification will be required to convert this estimate into a binding contract. Quotes are
              valid for 7 business days from the date of generation.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleMeetingCompleted()}
          disabled={busy || done}
          className={`flex w-full items-center justify-center gap-3 rounded-2xl border-none p-5 text-sm font-bold uppercase tracking-widest transition-all duration-300 ${done ? "cursor-not-allowed bg-[var(--brand-primary)]/50 text-white" : "cursor-pointer bg-[var(--brand-primary)] text-white shadow-sm hover:-translate-y-0.5 hover:opacity-90"} ${busy ? "cursor-not-allowed opacity-75" : ""}`}
        >
          {busy ? "Saving…" : done ? "Meeting Recorded" : "Meeting Completed"}
          <span style={{ fontSize: "18px" }}>🚀</span>
        </button>
        {message ? (
          <p
            style={{
              marginTop: "12px",
              textAlign: "center",
              fontSize: "12px",
              color: message.toLowerCase().includes("fail") ? "var(--brand-primary)" : "var(--brand-blue)",
            }}
          >
            {message}
          </p>
        ) : null}
      </div>
    </MeetingWizShell>
  );
}
