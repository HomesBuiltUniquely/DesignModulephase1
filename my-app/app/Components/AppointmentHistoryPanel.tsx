"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAuthHeaders } from "@/app/lib/apiBase";
import {
  canCancelPersonalBlockStart,
  formatHubTimeRange,
  isPersonalAppointmentRow,
  minutesToHubTimeLabel,
} from "@/lib/hub-meeting-schedule";
import CustomSelect from "@/app/Components/ui/CustomSelect";
import { formatUserRoleLabel } from "@/app/lib/formatUserRoleLabel";

type ViewableUser = { id: number; name: string; role: string };

type AppointmentRow = {
  id?: string | number;
  erpAppointmentId?: string | number;
  description?: string;
  startTime?: string;
  endTime?: string;
  designerName?: string;
  status?: string;
  cancelledAt?: string;
};

type HistoryTab = "all" | "upcoming" | "cancelled";

type Props = {
  apiBase: string;
  sessionId: string | null;
  currentUserName: string;
  currentUserRole: string;
  canPickTeamMember: boolean;
  refreshKey?: number;
  variant?: "embedded" | "page";
};

const HISTORY_TABS: { id: HistoryTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "cancelled", label: "Cancelled" },
];

const ALL_TEAM_MEMBERS = "__all__";

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeRange(row: AppointmentRow): string {
  const start = row.startTime ? new Date(row.startTime) : null;
  const end = row.endTime ? new Date(row.endTime) : null;
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    return formatHubTimeRange(startMin, endMin);
  }
  if (start && !Number.isNaN(start.getTime())) {
    return minutesToHubTimeLabel(start.getHours() * 60 + start.getMinutes());
  }
  return "—";
}

function durationMinutes(row: AppointmentRow): number | null {
  const start = row.startTime ? new Date(row.startTime) : null;
  const end = row.endTime ? new Date(row.endTime) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function rowSortKey(row: AppointmentRow): number {
  const iso = row.cancelledAt ?? row.startTime ?? "";
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function refreshPersonalAppointmentsBadge(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("personal-appointments-badge-refresh"));
  }
}

export function AppointmentHistoryPanel({
  apiBase,
  sessionId,
  currentUserName,
  currentUserRole,
  canPickTeamMember,
  refreshKey = 0,
  variant = "embedded",
}: Props) {
  const [viewableUsers, setViewableUsers] = useState<ViewableUser[]>([]);
  const [selectedName, setSelectedName] = useState(
    canPickTeamMember ? ALL_TEAM_MEMBERS : currentUserName,
  );
  const [activeRows, setActiveRows] = useState<AppointmentRow[]>([]);
  const [cancelledRows, setCancelledRows] = useState<AppointmentRow[]>([]);
  const [historyTab, setHistoryTab] = useState<HistoryTab>("all");
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AppointmentRow | null>(null);
  const [expanded, setExpanded] = useState(true);

  const isAllTeamView = canPickTeamMember && selectedName === ALL_TEAM_MEMBERS;

  const canCancelRow = (row: AppointmentRow): boolean => {
    const owner = (row.designerName || selectedName).trim().toLowerCase();
    return owner === currentUserName.trim().toLowerCase();
  };

  useEffect(() => {
    if (!sessionId || !canPickTeamMember) return;
    fetch(`${apiBase}/api/appointment/personal/viewable-users`, {
      headers: buildAuthHeaders(sessionId),
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setViewableUsers(data);
      })
      .catch(() => setViewableUsers([]));
  }, [apiBase, sessionId, canPickTeamMember]);

  const loadHistory = useCallback(() => {
    if (!sessionId) return;
    if (!canPickTeamMember && !currentUserName.trim()) return;
    if (canPickTeamMember && selectedName !== ALL_TEAM_MEMBERS && !selectedName.trim()) return;

    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (canPickTeamMember) {
      if (selectedName === ALL_TEAM_MEMBERS) {
        params.set("designerName", "all");
      } else {
        params.set("designerName", selectedName.trim());
      }
    }
    fetch(`${apiBase}/api/appointment/personal/history?${params.toString()}`, {
      headers: buildAuthHeaders(sessionId),
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        setActiveRows(Array.isArray(data?.appointments) ? data.appointments : []);
        setCancelledRows(Array.isArray(data?.cancelled) ? data.cancelled : []);
      })
      .catch(() => {
        setActiveRows([]);
        setCancelledRows([]);
        setError("Failed to load appointment history");
      })
      .finally(() => setLoading(false));
  }, [apiBase, sessionId, selectedName, canPickTeamMember, currentUserName, refreshKey]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const personalActiveRows = useMemo(
    () => activeRows.filter((r) => isPersonalAppointmentRow(r)),
    [activeRows],
  );

  const displayedRows = useMemo(() => {
    const now = Date.now();
    const upcoming = personalActiveRows.filter((r) => {
      const start = r.startTime ? new Date(r.startTime).getTime() : 0;
      return !Number.isNaN(start) && start >= now;
    });

    if (historyTab === "upcoming") {
      return [...upcoming].sort((a, b) => rowSortKey(b) - rowSortKey(a));
    }
    if (historyTab === "cancelled") {
      return [...cancelledRows].sort((a, b) => rowSortKey(b) - rowSortKey(a));
    }

    const merged: AppointmentRow[] = [
      ...personalActiveRows.map((r) => ({ ...r, status: r.status ?? "active" })),
      ...cancelledRows,
    ];
    return merged.sort((a, b) => rowSortKey(b) - rowSortKey(a));
  }, [historyTab, personalActiveRows, cancelledRows]);

  const tabCounts = useMemo(
    () => ({
      all: personalActiveRows.length + cancelledRows.length,
      upcoming: personalActiveRows.filter((r) => {
        const start = r.startTime ? new Date(r.startTime).getTime() : 0;
        return !Number.isNaN(start) && start >= Date.now();
      }).length,
      cancelled: cancelledRows.length,
    }),
    [personalActiveRows, cancelledRows],
  );

  const handleCancel = async (row: AppointmentRow) => {
    if (!sessionId || !row.startTime) return;
    const erpId = row.id ?? row.erpAppointmentId;
    if (erpId == null) return;
    if (!canCancelPersonalBlockStart(row.startTime)) {
      setError("Cannot cancel within 30 minutes of start time or after the block has started.");
      return;
    }
    if (!window.confirm("Cancel this personal time block?")) return;

    setCancellingId(erpId);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/appointment/personal/${erpId}/cancel`, {
        method: "POST",
        headers: buildAuthHeaders(sessionId, { "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ designerName: row.designerName || selectedName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to cancel block");
      refreshPersonalAppointmentsBadge();
      loadHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel block");
    } finally {
      setCancellingId(null);
    }
  };

  const roleLabel = (r: string) => formatUserRoleLabel(r);
  const isPage = variant === "page";
  const panelTitle = isAllTeamView
    ? "Team personal time blocks"
    : canPickTeamMember && selectedName !== currentUserName
      ? `Personal blocks — ${selectedName}`
      : canPickTeamMember
        ? "Team personal time blocks"
        : "My personal time blocks";

  return (
    <div
      className={
        isPage
          ? "rounded-xl border border-gray-200 bg-white shadow-sm"
          : "hidden xl:block rounded-xl border border-gray-200 bg-white shadow-sm"
      }
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={`w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 text-left rounded-t-xl ${!expanded ? "rounded-b-xl border-b-0" : ""}`}
      >
        <div>
          <h3 className="text-sm font-bold text-gray-900">{panelTitle}</h3>
          <p className="text-xs text-gray-500 mt-0.5">Personal time blocks</p>
        </div>
        {!isPage ? (
          <span className="text-gray-500 text-sm" aria-hidden>
            {expanded ? "▾" : "▸"}
          </span>
        ) : null}
      </button>

      {(isPage || expanded) && (
        <div className={`p-4 space-y-3 ${isPage ? "" : ""}`}>
          {canPickTeamMember && viewableUsers.length > 0 && (
            <label className="block">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {viewableUsers.length > 1 ? "Team member" : "Viewing"}
              </span>
              <CustomSelect
                value={selectedName}
                onChange={(val) => setSelectedName(val)}
                options={[
                  { value: ALL_TEAM_MEMBERS, label: "All team members" },
                  ...viewableUsers.map((u) => ({ value: u.name, label: `${u.name} (${roleLabel(u.role)})` }))
                ]}
                placeholder="All team members"
              />
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            {HISTORY_TABS.map((tab) => {
              const active = historyTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistoryTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-gray-800 bg-gray-800 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      active ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tabCounts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {error ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          ) : null}

          {loading ? (
            <p className="text-sm text-gray-500 py-4 text-center">Loading…</p>
          ) : displayedRows.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              {historyTab === "cancelled" ? "No cancelled personal blocks." : "No personal blocks yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {displayedRows.map((row, idx) => {
                const isCancelled = row.status === "cancelled";
                const canCancel =
                  !isCancelled &&
                  canCancelRow(row) &&
                  row.startTime &&
                  canCancelPersonalBlockStart(row.startTime);
                const rowKey = `${row.designerName ?? ""}-${String(row.id ?? row.erpAppointmentId ?? idx)}`;

                return (
                  <li
                    key={rowKey}
                    className={`rounded-lg border px-3 py-2.5 ${
                      isCancelled
                        ? "border-gray-200 bg-gray-50 opacity-80"
                        : "border-gray-100 bg-gray-50/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {isAllTeamView && row.designerName ? (
                          <p className="text-xs font-semibold text-[#32261C] mb-0.5">{row.designerName}</p>
                        ) : null}
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {row.description || "Personal block"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {row.startTime ? formatDateLabel(row.startTime) : "—"} · {formatTimeRange(row)}
                        </p>
                        {isCancelled && row.cancelledAt ? (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Cancelled {formatDateLabel(row.cancelledAt)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isCancelled ? (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                            Cancelled
                          </span>
                        ) : null}
                        {canCancel ? (
                          <button
                            type="button"
                            disabled={cancellingId === (row.id ?? row.erpAppointmentId)}
                            onClick={() => void handleCancel(row)}
                            className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setDetail(row)}
                          className="text-xs font-semibold text-[#00B0ED] hover:underline"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-bold text-gray-900 mb-4">Appointment Details</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>
                <span className="font-medium text-gray-500">Reason:</span> {detail.description || "—"}
              </li>
              <li>
                <span className="font-medium text-gray-500">Date:</span>{" "}
                {detail.startTime ? formatDateLabel(detail.startTime) : "—"}
              </li>
              <li>
                <span className="font-medium text-gray-500">Time:</span> {formatTimeRange(detail)}
              </li>
              <li>
                <span className="font-medium text-gray-500">Duration:</span>{" "}
                {durationMinutes(detail) != null ? `${durationMinutes(detail)} minutes` : "—"}
              </li>
              {detail.status === "cancelled" && detail.cancelledAt ? (
                <li>
                  <span className="font-medium text-gray-500">Cancelled:</span>{" "}
                  {formatDateLabel(detail.cancelledAt)}
                </li>
              ) : null}
              {detail.designerName && (
                <li>
                  <span className="font-medium text-gray-500">Booked by:</span> {detail.designerName}
                </li>
              )}
            </ul>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm font-medium hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
