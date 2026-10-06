"use client";

import type { RefObject } from "react";
import { useState, useEffect } from "react";
import MileStonesArray from "@/app/Components/Types/MileStoneArray";
import { hasChecklistForTask } from "./Checklists/checklistRegistry";
import MilestonePaymentSummary, { type QuotePaymentSummary } from "./MilestonePaymentSummary";
import { loadQuotePaymentSummary } from "./loadQuotePaymentSummary";
import { clearCachedQuotePaymentSummary } from "./quotePaymentSummaryCache";
import { getApiBase, buildAuthHeaders, getStoredSessionId } from "@/app/lib/apiBase";
import {
  getMilestoneDateRangeLabel,
  type TaskCompletionMap,
  type TimelineAnchors,
} from "../lib/taskDeadlineUtils";

const PAYMENT_MILESTONE_INDICES = new Set([2, 5]);

type TaskStatus = {
  icon: "completed" | "current" | "delayed" | "pending";
  subtitle: string;
  tags: readonly string[];
  isOverdue?: boolean;
  overdueMessage?: string;
  timelineLabel?: string;
  dueBy?: string;
};

type Props = {
  cardClass: string;
  isMaximized: boolean;
  currentMilestoneIndex: number;
  onToggleMaximize: () => void;
  onScrollLeft: () => void;
  onScrollRight: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  onOpenTask: (milestoneIndex: number, taskName: string) => void;
  // new callback when user selects "Visit Checklist" from the three-dot menu
  onVisitChecklist?: (milestoneIndex: number, taskName: string) => void;
  getTaskStatus: (
    milestoneIndex: number,
    taskIndex: number,
    taskList: string[],
  ) => TaskStatus;
  /** Optional role-aware label (e.g. SPM sees "Assign PM") */
  getTaskLabel?: (milestoneIndex: number, taskName: string) => string;
  leadId?: number | null;
  sessionId?: string | null;
  propertyConfiguration?: string | null;
  timelineAnchors?: TimelineAnchors;
  taskCompletions?: TaskCompletionMap;
  /** Bump after payment events so remaining % / amount refreshes. */
  paymentSummaryRefreshKey?: number;
  /** Temp: Hub Pass ON + admin — show bypass X on current milestone */
  hubPassEnabled?: boolean;
  onBypassMilestone?: (milestoneIndex: number) => void;
  bypassBusy?: boolean;
};

/**
 * Project Tracker card: milestone list, task rows, maximize/footer when expanded.
 */
export default function MilestonesCard({
  cardClass,
  isMaximized,
  currentMilestoneIndex,
  onToggleMaximize,
  onScrollLeft,
  onScrollRight,
  scrollRef,
  onOpenTask,
  onVisitChecklist,
  getTaskStatus,
  getTaskLabel,
  leadId,
  sessionId,
  paymentSummaryRefreshKey = 0,
  propertyConfiguration,
  timelineAnchors,
  taskCompletions,
  hubPassEnabled = false,
  onBypassMilestone,
  bypassBusy = false,
}: Props) {
  const [openMenuFor, setOpenMenuFor] = useState<
    { milestoneIndex: number; taskIndex: number } | undefined
  >(undefined);
  const [paymentSummary, setPaymentSummary] = useState<QuotePaymentSummary | null>(null);
  const [paymentSummaryLoading, setPaymentSummaryLoading] = useState(false);
  const [paymentSummaryError, setPaymentSummaryError] = useState<string | null>(null);
  const [xpSummary, setXpSummary] = useState<any | null>(null);

  useEffect(() => {
    if (!leadId || leadId < 1) {
      setXpSummary(null);
      return;
    }

    const token = sessionId || getStoredSessionId();
    if (!token) {
      setXpSummary(null);
      return;
    }

    const controller = new AbortController();
    const headers = buildAuthHeaders(token);
    const url = `${getApiBase()}/api/xp/lead/${leadId}/summary`;

    fetch(url, { headers, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setXpSummary(null);
          return;
        }
        const data = await res.json().catch(() => null);
        if (!controller.signal.aborted && data) {
          setXpSummary(data);
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setXpSummary(null);
      });

    return () => controller.abort();
  }, [leadId, sessionId]);

  useEffect(() => {
    if (!leadId || leadId < 1) {
      setPaymentSummary(null);
      setPaymentSummaryError(null);
      return;
    }
    if (paymentSummaryRefreshKey > 0) {
      clearCachedQuotePaymentSummary(leadId);
    }
    const controller = new AbortController();
    (async () => {
      setPaymentSummaryLoading(true);
      setPaymentSummaryError(null);
      const result = await loadQuotePaymentSummary({
        leadId,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setPaymentSummary(result.summary);
      setPaymentSummaryError(result.message);
      setPaymentSummaryLoading(false);
    })();
    return () => controller.abort();
  }, [leadId, paymentSummaryRefreshKey]);

  // When maximized, scroll so the current milestone is in view.
  useEffect(() => {
    if (!isMaximized || !scrollRef.current) return;
    // Small delay to let the DOM render all milestone columns first.
    const timer = setTimeout(() => {
      const container = scrollRef.current;
      if (!container) return;
      const currentCard = container.querySelector<HTMLElement>('[data-current-milestone="true"]');
      if (currentCard) {
        currentCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [isMaximized, currentMilestoneIndex, scrollRef]);

  const milestones = isMaximized
    ? MileStonesArray.MilestonesName
    : MileStonesArray.MilestonesName.filter((m) => m.id === currentMilestoneIndex);

  return (
    <div className={`${cardClass} flex h-full min-h-0 flex-col`}>
      {isMaximized ? (
        <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-[#32261C]">
              Project Tracker
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Swipe milestones →</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-300 rounded-lg pl-3 pr-3 py-2 bg-white min-w-[200px]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-5 h-5 text-gray-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search tasks..."
                className="ml-2 border-0 outline-none flex-1 min-w-0 text-sm"
              />
            </div>
            <button
              type="button"
              className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
              aria-label="Filter"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-5 h-5 text-gray-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 0 1-3 0M3.75 6h7.5M3.75 6A1.5 1.5 0 0 1 3 4.5m0 0A1.5 1.5 0 0 1 4.5 3h15A1.5 1.5 0 0 1 21 4.5m0 0v15a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-15"
                />
              </svg>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 bg-[#00B0ED] text-white text-sm font-medium rounded-lg hover:bg-[#00B0ED]/90"
            >
              <span className="text-lg leading-none">+</span> New Milestone
            </button>
            <button
              onClick={onToggleMaximize}
              className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50 shadow-sm"
              aria-label="Close fullscreen"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-5 h-5 text-gray-500"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex flex-shrink-0 items-center justify-between">
          <h2 className="text-xl font-bold text-[#32261C]">Project Tracker</h2>
          <button
            onClick={onToggleMaximize}
            className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50 shadow-sm"
            aria-label="Fullscreen"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-5 h-5 text-gray-500"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v-4.5m0 4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
              />
            </svg>
          </button>
        </div>
      )}

      {isMaximized && (
        <>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden xl:flex">
            <button
              type="button"
              onClick={onScrollLeft}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 text-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </button>
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden xl:flex">
            <button
              type="button"
              onClick={onScrollRight}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 text-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          </div>
        </>
      )}

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${isMaximized ? "pt-17" : ""}`}
      >
        <div
          className={
            isMaximized
              ? "flex min-h-0 w-full flex-1 justify-center overflow-hidden"
              : "flex min-h-0 w-full flex-1 flex-col overflow-hidden"
          }
        >
          <div
            ref={scrollRef}
            className={`flex min-h-0 gap-10 pb-2 ${isMaximized ? "mx-auto max-w-[95vw] flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth" : "w-full flex-1 flex-col items-center overflow-hidden"}`}
            style={{ scrollbarWidth: "thin" }}
          >
            {milestones.map((milestone, idx) => {
              const milestoneIndex = milestone.id;
              const milestoneXp = xpSummary?.milestones?.find(
                (m: any) => m.milestoneIndex === milestoneIndex
              );
              const totalPossibleXp = milestoneXp?.totalPossibleXp || 0;
              const earnedMilestoneXp = milestoneXp?.earnedXp || 0;
              const targetVisualIndex = MileStonesArray.MilestonesName.findIndex((m) => m.id === milestoneIndex);
              const currentVisualIndex = MileStonesArray.MilestonesName.findIndex((m) => m.id === currentMilestoneIndex);
              const isCurrent = targetVisualIndex === currentVisualIndex;
              const isNextOrLater = targetVisualIndex > currentVisualIndex;
              const taskList = milestone.taskList;
              const completedCount = taskList.filter(
                (_, taskIndex) => getTaskStatus(milestoneIndex, taskIndex, taskList).icon === "completed",
              ).length;
              const progressPercent = taskList.length
                ? Math.min(100, Math.round((completedCount / taskList.length) * 100))
                : 0;
              const displayIndex = milestone.id === 7 ? 0 : milestone.id + 1;
              const dateRange = getMilestoneDateRangeLabel(
                milestoneIndex,
                propertyConfiguration,
                timelineAnchors ?? {},
                taskCompletions ?? {},
              );
              return (
                <div
                  key={milestone.id}
                  data-current-milestone={isCurrent ? "true" : undefined}
                  className={`flex min-h-0 w-[380px] min-w-0 flex-col xl:w-[550px] ${isMaximized ? "flex-shrink-0 snap-start" : "min-h-0 flex-1"}`}
                >
                  <div className="mb-3 flex flex-shrink-0 items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-black uppercase tracking-wider ${
                          isCurrent ? "text-[#32261C]" : isNextOrLater ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        MILESTONE {String(displayIndex).padStart(2, "0")}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          progressPercent === 100 || milestoneXp?.isWorkflowCompleted
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : milestoneXp?.isDelayed
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : isCurrent
                                ? "bg-sky-50 text-sky-700 border border-sky-200"
                                : "bg-gray-100 text-gray-500 border border-gray-200"
                        }`}
                      >
                        {progressPercent === 100 || milestoneXp?.isWorkflowCompleted
                          ? "Completed"
                          : milestoneXp?.isDelayed
                            ? "Overdue"
                            : isCurrent
                              ? "In Progress"
                              : "Pending"}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold ${isNextOrLater ? "text-[#32261C]/60" : "text-[#32261C]"}`}
                    >
                      {dateRange}
                    </span>
                  </div>
                  <div
                    className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm transition-all ${
                      isCurrent
                        ? "bg-white border-[#EF0101] ring-2 ring-[#EF0101]/20"
                        : isNextOrLater
                          ? "bg-gray-100 border-gray-200 opacity-75"
                          : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2 flex-shrink-0 gap-3">
                      <h3
                        className={`text-lg font-bold min-w-0 truncate ${
                          isNextOrLater ? "text-gray-500" : "text-[#32261C]"
                        }`}
                      >
                        {milestone.name}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hubPassEnabled &&
                          isCurrent &&
                          progressPercent < 100 &&
                          onBypassMilestone && (
                            <button
                              type="button"
                              title="Hub Pass: bypass this milestone"
                              aria-label="Bypass this milestone"
                              disabled={bypassBusy}
                              onClick={(e) => {
                                e.stopPropagation();
                                onBypassMilestone(milestoneIndex);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="2.5"
                                stroke="currentColor"
                                className="h-3.5 w-3.5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18 18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          )}
                        {totalPossibleXp > 0 && (
                          <div className="flex flex-col items-end">
                            <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs">
                              <span className="text-amber-500 font-black">★</span>
                              <span>{totalPossibleXp} XP</span>
                              <span className="text-[10px] font-semibold text-amber-700/90 ml-0.5">Total Possible</span>
                            </span>

                            {milestoneXp?.isWorkflowCompleted ? (
                              milestoneXp.workflowStatus === "ON-TIME" ? (
                                <span className="text-[10px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                                  <span>✓ Earned:</span>
                                  <span className="font-extrabold">+{earnedMilestoneXp} XP</span>
                                </span>
                              ) : (
                                <div className="flex flex-col items-end mt-1 text-[10px]">
                                  <span className="font-bold text-rose-700 flex items-center gap-1">
                                    <span>⚠ Overdue ({milestoneXp.overdueDays || milestoneXp.delayDays || 1}d):</span>
                                    <span className="font-extrabold">{earnedMilestoneXp} XP</span>
                                  </span>
                                  {milestoneXp.penaltyXp > 0 && (
                                    <span className="text-[9px] font-medium text-rose-600">
                                      Deduction: −{milestoneXp.penaltyXp} XP (−2 XP/day)
                                    </span>
                                  )}
                                </div>
                              )
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Progress Bar & Counter */}
                    <div className="mb-3.5 flex-shrink-0">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-1">
                        <span>Progress</span>
                        <span className="font-bold text-[#32261C]">
                          {progressPercent}% ({completedCount}/{taskList.length})
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300 bg-red-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 [scrollbar-gutter:stable]">
                      {PAYMENT_MILESTONE_INDICES.has(milestoneIndex) && (
                        <MilestonePaymentSummary
                          variant={milestoneIndex === 2 ? '10' : '40'}
                          summary={paymentSummary}
                          loading={paymentSummaryLoading}
                          error={paymentSummaryError}
                        />
                      )}
                      {taskList.map((task: string, taskIndex: number) => {
                        const canVisitChecklist = hasChecklistForTask(
                          milestoneIndex,
                          task,
                        );
                        const resolvedStatus = getTaskStatus(milestoneIndex, taskIndex, taskList);
                        const status = isNextOrLater
                          ? {
                              ...resolvedStatus,
                              icon: "pending" as const,
                              subtitle: "Not started",
                              tags: ["PENDING"] as const,
                            }
                          : resolvedStatus;
                        const taskXp = milestoneXp?.tasks?.find(
                          (t: any) =>
                            (t.taskName || "").trim().toLowerCase() === (task || "").trim().toLowerCase() ||
                            (t.aliases && t.aliases.some((a: string) => a.trim().toLowerCase() === (task || "").trim().toLowerCase())),
                        );
                        const isActiveOverdue =
                          status.icon !== "completed" && status.isOverdue === true;
                        const isLateCompleted =
                          status.icon === "completed" && status.tags.includes("LATE");
                        const tags = status.tags;
                        return (
                          <div
                            key={taskIndex}
                            role="button"
                            tabIndex={0}
                            title={
                              isActiveOverdue
                                ? status.overdueMessage
                                : isLateCompleted
                                  ? status.overdueMessage
                                  : undefined
                            }
                            onClick={() => {
                              // clicking the row should close any open menu
                              setOpenMenuFor(undefined);
                              onOpenTask(milestoneIndex, task);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setOpenMenuFor(undefined);
                                onOpenTask(milestoneIndex, task);
                              }
                            }}
                            className={`relative w-full text-left p-3 transition-colors flex items-start gap-3 cursor-pointer rounded-lg ${
                              isActiveOverdue
                                ? "bg-[#EF0101]/10 border border-[#EF0101]/50 ring-1 ring-[#EF0101]/20 hover:bg-[#EF0101]/15"
                                : isLateCompleted
                                  ? "bg-amber-50/80 border border-amber-200/80 hover:bg-amber-50"
                                  : isNextOrLater
                                    ? "hover:bg-gray-200/50 opacity-90"
                                    : "hover:bg-gray-50"
                            } ${!isActiveOverdue && status.icon === "current" ? "border-l-4 border-[#00B0ED] pl-2" : ""}`}
                          >
                            <span className="flex-shrink-0 mt-0.5">
                              {status.icon === "completed" && (
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center bg-red-500`}>
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="2.5"
                                    stroke="white"
                                    className="w-4 h-4"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="m4.5 12.75 6 6 9-13.5"
                                    />
                                  </svg>
                                </span>
                              )}
                              {status.icon === "current" && (() => {
                                const isPay10 =
                                  milestoneIndex === 2 &&
                                  /10%\s*payment\s*collection/i.test(task);
                                const isPay40 =
                                  milestoneIndex === 5 &&
                                  /40%\s*collection/i.test(task);
                                const pct = isPay10
                                  ? paymentSummary?.design10PercentPaid || 0
                                  : isPay40
                                    ? paymentSummary?.design40PercentPaid || 0
                                    : 0;
                                const showPct = (isPay10 || isPay40) && pct > 0 && pct < 100;
                                if (showPct) {
                                  const r = 10;
                                  const c = 2 * Math.PI * r;
                                  const offset = c * (1 - pct / 100);
                                  return (
                                    <span
                                      className="relative mt-1 flex h-6 w-6 items-center justify-center"
                                      title={`${pct}% of this milestone paid`}
                                    >
                                      <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24" aria-hidden>
                                        <circle
                                          cx="12"
                                          cy="12"
                                          r={r}
                                          fill="none"
                                          stroke="#DDCDC1"
                                          strokeWidth="2.5"
                                        />
                                        <circle
                                          cx="12"
                                          cy="12"
                                          r={r}
                                          fill="none"
                                          stroke="#00B0ED"
                                          strokeWidth="2.5"
                                          strokeLinecap="round"
                                          strokeDasharray={c}
                                          strokeDashoffset={offset}
                                        />
                                      </svg>
                                      <span className="absolute text-[7px] font-bold tabular-nums text-[#00B0ED]">
                                        {pct}
                                      </span>
                                    </span>
                                  );
                                }
                                return (
                                  <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#00B0ED]">
                                    <span className="h-2 w-2 rounded-full bg-[#00B0ED]" />
                                  </span>
                                );
                              })()}
                              {status.icon === "delayed" && (
                                <span className="w-6 h-6 flex items-center justify-center text-[#EF0101]">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="w-5 h-5"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.401 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </span>
                              )}
                              {status.icon === "pending" && (
                                <span className="w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center" />
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium truncate ${
                                  isActiveOverdue
                                    ? "text-[#EF0101]"
                                    : isLateCompleted
                                      ? "text-amber-900"
                                      : isNextOrLater
                                        ? "text-gray-500"
                                        : "text-gray-900"
                                }`}
                              >
                                {getTaskLabel ? getTaskLabel(milestoneIndex, task) : task}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">{status.subtitle}</p>
                              {status.timelineLabel && (
                                <p
                                  className={`text-xs mt-1 leading-snug ${
                                    isActiveOverdue
                                      ? "text-[#EF0101] font-semibold"
                                      : "text-[#0077A3] font-medium"
                                  }`}
                                >
                                  {status.timelineLabel}
                                </p>
                              )}
                              {status.dueBy && !isNextOrLater && status.icon !== "completed" && (
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                  Due by: <span className="font-medium">{status.dueBy}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              {/* XP Badge and Status Tags on same line */}
                              <div className="flex items-center gap-1.5">
                                {taskXp && taskXp.isActive && taskXp.baseXp > 0 && (
                                  <>
                                    {/* Base or Earned XP Badge */}
                                    {status.icon === "completed" && taskXp.earnedXp != null && taskXp.earnedXp > 0 ? (
                                      <div className="flex flex-col items-end gap-0.5">
                                        <span
                                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200/90 shadow-2xs"
                                          title={`Earned: ${taskXp.earnedXp} XP`}
                                        >
                                          <span className="text-[#00B0ED] font-black">★</span>
                                          <span>+{taskXp.earnedXp} XP</span>
                                        </span>
                                        {taskXp.isDelayed && (taskXp.delayDays > 0 || taskXp.overdueDays > 0) && (
                                          <span className="text-[9px] text-slate-500 font-medium">
                                            {taskXp.penaltyXp > 0 ? `−${taskXp.penaltyXp} XP` : ""} {taskXp.delayDays > 0 ? `(${taskXp.delayDays}d delayed)` : taskXp.overdueDays > 0 ? `(${taskXp.overdueDays}d overdue)` : ""}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200/90 shadow-2xs"
                                        title={`Base XP: ${taskXp.baseXp} XP`}
                                      >
                                        <span className="text-purple-500 font-black">★</span>
                                        <span>+{taskXp.baseXp} XP</span>
                                        <span className="text-[9px] font-semibold text-purple-600/80">Base</span>
                                      </span>
                                    )}
                                  </>
                                )}
                                {(() => {
                                  const isCompleted = status.icon === "completed";
                                  let displayTags = tags.filter((t) => {
                                    if (isCompleted) {
                                      return t !== "CURRENT" && t !== "ACTION" && t !== "PENDING";
                                    }
                                    return true;
                                  });

                                  if (isCompleted && displayTags.length === 0) {
                                    displayTags = isLateCompleted ? ["LATE"] : ["ON-TIME"];
                                  }

                                  return displayTags.map((tag) => (
                                    <span
                                      key={tag}
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                        tag === "ON-TIME"
                                          ? "bg-[#DDCDC1] text-[#32261C] font-bold"
                                          : tag === "LATE"
                                            ? "bg-amber-100 text-amber-900 border border-amber-300/80 font-semibold"
                                            : tag === "OVERDUE" || tag === "DELAYED"
                                              ? "bg-[#EF0101]/15 text-[#EF0101] border border-[#EF0101]/30 font-bold"
                                              : tag === "CURRENT" || tag === "ACTION"
                                                ? "bg-[#00B0ED]/25 text-[#00B0ED] font-semibold"
                                                : "bg-gray-100 border border-gray-300 text-gray-500"
                                    }`}
                                  >
                                    {tag}
                                  </span>
                                ));
                              })()}
                              </div>
                              {/* Daily Deduction Info below */}
                              {taskXp && taskXp.hasDailyDeduction && (
                                (taskXp.isDelayed || (taskXp.delayDays > 0) || (taskXp.overdueDays > 0) || (taskXp.penaltyXp > 0) || isActiveOverdue) ? (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                                      title={`Daily deduction: -${taskXp.dailyDeductionRate || 2} XP/day (${taskXp.overdueDays || taskXp.delayDays || 1}d overdue)`}
                                    >
                                      <span>−{taskXp.dailyDeductionRate || 2} XP/day</span>
                                      <span className="text-[9px] font-medium text-rose-600">
                                        ({taskXp.overdueDays || taskXp.delayDays || 1}d overdue)
                                      </span>
                                    </span>
                                    {taskXp.finalXp != null && (
                                      <span className="text-[10px] font-extrabold text-slate-700">
                                        Current: {taskXp.finalXp} XP
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span
                                    className="text-[9px] font-medium text-slate-400"
                                    title="Daily deduction applies if delayed"
                                  >
                                    Daily: −{taskXp.dailyDeductionRate || 2} XP/day
                                  </span>
                                )
                              )}
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // show menu for this task
                                  setOpenMenuFor({ milestoneIndex, taskIndex });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    setOpenMenuFor({
                                      milestoneIndex,
                                      taskIndex,
                                    });
                                  }
                                }}
                                className="p-1 rounded hover:bg-gray-200 text-gray-400 cursor-pointer inline-flex relative"
                                aria-label="More"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth="1.5"
                                  stroke="currentColor"
                                  className="w-5 h-5"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
                                  />
                                </svg>
                                {/* menu for this task */}
                                {openMenuFor &&
                                  openMenuFor.milestoneIndex ===
                                    milestoneIndex &&
                                  openMenuFor.taskIndex === taskIndex && (
                                    <div className="absolute right-0 mt-1 w-40 bg-white shadow-lg rounded-md z-20">
                                      {canVisitChecklist && (
                                        <button
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onVisitChecklist?.(
                                              milestoneIndex,
                                              task,
                                            );
                                            setOpenMenuFor(undefined);
                                          }}
                                        >
                                          Visit checklist
                                        </button>
                                      )}
                                    </div>
                                  )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isMaximized && (
        <div className="flex-shrink-0 flex flex-wrap items-center gap-6 py-3 px-2 border-t border-gray-200 mt-2 text-sm">
          <span className="text-gray-600">
            GLOBAL PROGRESS:{" "}
            <strong className="text-gray-900">24% Complete</strong>
          </span>
          <span className="text-gray-600">
            TEAM VELOCITY:{" "}
            <strong className="text-[#32261C]">+12% vs Baseline</strong>
          </span>
          <span className="text-gray-600 flex items-center gap-2">
            ACTIVE MEMBERS
            <span className="flex -space-x-1">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="w-7 h-7 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600"
                >
                  {i === 3 ? "5" : ""}
                </span>
              ))}
            </span>
          </span>
          <span className="text-gray-500 ml-auto flex items-center gap-1">
            Last synchronized: 2 mins ago
            <button
              type="button"
              className="text-[#00B0ED] hover:underline inline-flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              Sync Now
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
