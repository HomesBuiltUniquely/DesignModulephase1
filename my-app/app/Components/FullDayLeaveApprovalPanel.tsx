"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAuthHeaders } from "@/app/lib/apiBase";
import type { FullDayRequestStatus } from "@/lib/hub-meeting-schedule";
import { canCancelFullDayBlockDate } from "@/lib/hub-meeting-schedule";
import CustomSelect from "@/app/Components/ui/CustomSelect";

type FullDayRequest = {
  id: number;
  designerName: string;
  designerRole?: string | null;
  blockDate: string;
  reason: string;
  reasonPreset: string;
  status: FullDayRequestStatus;
  createdAt?: string;
  reviewNote?: string | null;
  reviewedByName?: string | null;
  reviewedByRole?: string | null;
  reviewedAt?: string | null;
};

type TeamMember = { id: number; name: string; role: string };

type StatusTab = "all" | "pending" | "approved" | "rejected" | "cancelled";

type Props = {
  apiBase: string;
  sessionId: string | null;
  currentUserName?: string;
  canApprove: boolean;
  canPickTeamMember?: boolean;
  showReviewerInfo?: boolean;
  approverRole?: string;
  refreshKey?: number;
  variant?: "embedded" | "page";
};

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Cancelled" },
];

function refreshPersonalAppointmentsBadge(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("personal-appointments-badge-refresh"));
  }
}

function formatDateLabel(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadgeClass(status: FullDayRequestStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "approved":
      return "bg-[#DDCDC1]/40 text-[#32261C]";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "cancelled":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function roleLabel(role: string): string {
  return role.replace(/_/g, " ");
}

function reasonLabel(row: FullDayRequest): string {
  return row.reasonPreset !== "Other" ? row.reasonPreset : row.reason;
}

function reviewActionLabel(status: FullDayRequestStatus): string {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Reviewed";
}

function ReviewerLine({ row }: { row: FullDayRequest }) {
  if (!row.reviewedByName) return null;
  if (row.status !== "approved" && row.status !== "rejected") return null;
  const role = row.reviewedByRole ? roleLabel(row.reviewedByRole) : null;
  return (
    <p className="mt-1 text-xs text-gray-500">
      {reviewActionLabel(row.status)} by <span className="font-medium text-gray-700">{row.reviewedByName}</span>
      {role ? ` (${role})` : ""}
    </p>
  );
}

export function FullDayLeaveApprovalPanel({
  apiBase,
  sessionId,
  currentUserName = "",
  canApprove,
  canPickTeamMember = false,
  showReviewerInfo = false,
  approverRole = "",
  refreshKey = 0,
  variant = "embedded",
}: Props) {
  const [myRequests, setMyRequests] = useState<FullDayRequest[]>([]);
  const [teamRequests, setTeamRequests] = useState<FullDayRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [filterDesigner, setFilterDesigner] = useState("all");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const isPage = variant === "page";
  const isManagerView = canPickTeamMember;

  const loadData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = buildAuthHeaders(sessionId);
      const tasks: Promise<void>[] = [];

      tasks.push(
        fetch(`${apiBase}/api/appointment/full-day/mine`, { headers, credentials: "include" })
          .then(async (r) => {
            if (r.status === 403) {
              setMyRequests([]);
              return;
            }
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data?.message || "Failed to load your requests");
            setMyRequests(Array.isArray(data.requests) ? data.requests : []);
          }),
      );

      if (canPickTeamMember) {
        tasks.push(
          fetch(`${apiBase}/api/appointment/full-day/team`, { headers, credentials: "include" })
            .then(async (r) => {
              const data = await r.json().catch(() => ({}));
              if (!r.ok) throw new Error(data?.message || "Failed to load team requests");
              setTeamRequests(Array.isArray(data.requests) ? data.requests : []);
              setTeamMembers(Array.isArray(data.teamMembers) ? data.teamMembers : []);
            }),
        );
      } else {
        setTeamRequests([]);
        setTeamMembers([]);
      }

      await Promise.all(tasks);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load full-day leave data");
    } finally {
      setLoading(false);
    }
  }, [apiBase, sessionId, canPickTeamMember]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const sourceRequests = isManagerView ? teamRequests : myRequests;

  const tabCounts = useMemo(() => {
    const base =
      filterDesigner === "all"
        ? sourceRequests
        : sourceRequests.filter(
            (r) => r.designerName.trim().toLowerCase() === filterDesigner.trim().toLowerCase(),
          );
    return {
      all: base.length,
      pending: base.filter((r) => r.status === "pending").length,
      approved: base.filter((r) => r.status === "approved").length,
      rejected: base.filter((r) => r.status === "rejected").length,
      cancelled: base.filter((r) => r.status === "cancelled").length,
    };
  }, [sourceRequests, filterDesigner]);

  const displayedRequests = useMemo(() => {
    let list =
      filterDesigner === "all"
        ? sourceRequests
        : sourceRequests.filter(
            (r) => r.designerName.trim().toLowerCase() === filterDesigner.trim().toLowerCase(),
          );

    if (statusTab !== "all") {
      list = list.filter((r) => r.status === statusTab);
    }

    return [...list].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [sourceRequests, filterDesigner, statusTab]);

  const handleApprove = async (id: number) => {
    if (!sessionId) return;
    setActionId(id);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/appointment/full-day/${id}/approve`, {
        method: "POST",
        headers: buildAuthHeaders(sessionId, { "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to approve request");
      refreshPersonalAppointmentsBadge();
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to approve request");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!sessionId) return;
    setActionId(id);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/appointment/full-day/${id}/reject`, {
        method: "POST",
        headers: buildAuthHeaders(sessionId, { "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ reviewNote: rejectNote.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to reject request");
      setRejectingId(null);
      setRejectNote("");
      refreshPersonalAppointmentsBadge();
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reject request");
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id: number) => {
    if (!sessionId) return;
    setActionId(id);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/appointment/full-day/${id}/cancel`, {
        method: "POST",
        headers: buildAuthHeaders(sessionId, { "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to cancel request");
      refreshPersonalAppointmentsBadge();
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel request");
    } finally {
      setActionId(null);
    }
  };

  const canCancelRequest = (row: FullDayRequest): boolean => {
    if (!["pending", "approved"].includes(row.status)) return false;
    if (!canCancelFullDayBlockDate(row.blockDate)) return false;
    return (
      !!currentUserName &&
      row.designerName.trim().toLowerCase() === currentUserName.trim().toLowerCase()
    );
  };

  const canActOnRequest = (row: FullDayRequest): boolean => {
    if (!canApprove || row.status !== "pending") return false;
    const approver = approverRole.toLowerCase();
    if (
      approver === "design_manager" &&
      currentUserName &&
      row.designerName.trim().toLowerCase() === currentUserName.trim().toLowerCase()
    ) {
      return false;
    }
    if (approver === "design_manager") {
      return (row.designerRole || "").toLowerCase() === "designer";
    }
    if (approver === "territorial_design_manager") {
      return (row.designerRole || "").toLowerCase() === "design_manager";
    }
    return true;
  };

  if (!sessionId) return null;

  const shellClass = isPage
    ? "rounded-xl border border-amber-100 bg-amber-50/40"
    : "mt-4 rounded-xl border border-amber-100 bg-amber-50/40";

  const emptyMessage =
    statusTab === "all"
      ? isManagerView
        ? "No full-day leave requests from your team yet."
        : "No full-day leave requests yet."
      : `No ${statusTab} full-day leave requests.`;

  return (
    <div className={shellClass}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-amber-950">
            {isManagerView ? "Team full-day leave requests" : "My full-day leave requests"}
          </p>
          <p className="text-xs text-amber-800/80">
            {tabCounts.pending} pending · {tabCounts.approved} approved · {tabCounts.rejected} rejected · {tabCounts.cancelled} cancelled
          </p>
        </div>
        {!isPage ? <span className="text-amber-700 text-sm">{expanded ? "▾" : "▸"}</span> : null}
      </button>

      {isPage || expanded ? (
        <div className="border-t border-amber-100 px-4 py-3 space-y-4">
          {loading ? <p className="text-sm text-gray-500 py-2">Loading…</p> : null}
          {error ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => {
                const active = statusTab === tab.id;
                const count = tabCounts[tab.id];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "border-amber-600 bg-amber-600 text-white"
                        : "border-amber-200 bg-white text-amber-900 hover:bg-amber-50"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        active ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {isManagerView && teamMembers.length > 1 ? (
              <div className="w-48">
                <CustomSelect
                  value={filterDesigner}
                  onChange={(val) => setFilterDesigner(val)}
                  options={[
                    { value: "all", label: "All team members" },
                    ...teamMembers.map((m) => ({ value: m.name, label: `${m.name} (${roleLabel(m.role)})` }))
                  ]}
                  placeholder="All team members"
                />
              </div>
            ) : null}
          </div>

          {displayedRequests.length === 0 && !loading ? (
            <p className="text-sm text-gray-500 py-2">{emptyMessage}</p>
          ) : (
            <div className="space-y-2">
              {displayedRequests.map((row) => {
                const showApproveReject = canActOnRequest(row);
                const showCancel = canCancelRequest(row);

                if (showApproveReject) {
                  return (
                    <RequestCard
                      key={row.id}
                      row={row}
                      actionId={actionId}
                      rejectingId={rejectingId}
                      rejectNote={rejectNote}
                      onRejectNoteChange={setRejectNote}
                      onStartReject={setRejectingId}
                      onCancelReject={() => {
                        setRejectingId(null);
                        setRejectNote("");
                      }}
                      onApprove={() => void handleApprove(row.id)}
                      onReject={() => void handleReject(row.id)}
                      onCancelLeave={showCancel ? () => void handleCancel(row.id) : undefined}
                      showActions
                    />
                  );
                }

                return (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white bg-white px-3 py-2.5 shadow-sm"
                  >
                    <div>
                      {isManagerView ? (
                        <p className="text-sm font-semibold text-gray-900">{row.designerName}</p>
                      ) : null}
                      <p className="text-sm font-medium text-gray-900">{formatDateLabel(row.blockDate)}</p>
                      <p className="text-xs text-gray-600">{reasonLabel(row)}</p>
                      {showReviewerInfo ? <ReviewerLine row={row} /> : null}
                      {row.reviewNote ? (
                        <p className="mt-1 text-xs text-gray-500">Note: {row.reviewNote}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                      {showCancel ? (
                        <button
                          type="button"
                          disabled={actionId === row.id}
                          onClick={() => void handleCancel(row.id)}
                          className="text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function RequestCard({
  row,
  actionId,
  rejectingId,
  rejectNote,
  onRejectNoteChange,
  onStartReject,
  onCancelReject,
  onApprove,
  onReject,
  onCancelLeave,
  showActions,
}: {
  row: FullDayRequest;
  actionId: number | null;
  rejectingId: number | null;
  rejectNote: string;
  onRejectNoteChange: (v: string) => void;
  onStartReject: (id: number) => void;
  onCancelReject: () => void;
  onApprove: () => void;
  onReject: () => void;
  onCancelLeave?: () => void;
  showActions: boolean;
}) {
  return (
    <div className="rounded-lg border border-white bg-white px-3 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{row.designerName}</p>
          <p className="text-xs text-gray-600">{formatDateLabel(row.blockDate)}</p>
          <p className="mt-1 text-sm text-gray-700">{reasonLabel(row)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(row.status)}`}>
            {row.status}
          </span>
          {onCancelLeave ? (
            <button
              type="button"
              disabled={actionId === row.id}
              onClick={onCancelLeave}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Cancel leave
            </button>
          ) : null}
        </div>
      </div>

      {showActions && row.status === "pending" ? (
        rejectingId === row.id ? (
          <div className="mt-3 space-y-2">
            <textarea
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Optional note for rejection"
              value={rejectNote}
              onChange={(e) => onRejectNoteChange(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={onReject}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirm reject
              </button>
              <button
                type="button"
                onClick={onCancelReject}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={actionId === row.id}
              onClick={onApprove}
              className="rounded-md bg-[#EF0101] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#EF0101] disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={actionId === row.id}
              onClick={() => onStartReject(row.id)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
