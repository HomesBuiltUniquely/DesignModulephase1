"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAuthHeaders } from "@/app/lib/apiBase";
import {
  formatHubTimeRange,
  isPersonalAppointmentRow,
  minutesToHubTimeLabel,
} from "@/lib/hub-meeting-schedule";

type ViewableUser = { id: number; name: string; role: string };

type AppointmentRow = {
  id?: string | number;
  description?: string;
  startTime?: string;
  endTime?: string;
  designerName?: string;
};

type Props = {
  apiBase: string;
  sessionId: string | null;
  currentUserName: string;
  currentUserRole: string;
  canPickTeamMember: boolean;
  refreshKey?: number;
};

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

export function AppointmentHistoryPanel({
  apiBase,
  sessionId,
  currentUserName,
  currentUserRole,
  canPickTeamMember,
  refreshKey = 0,
}: Props) {
  const [viewableUsers, setViewableUsers] = useState<ViewableUser[]>([]);
  const [selectedName, setSelectedName] = useState(currentUserName);
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AppointmentRow | null>(null);
  const [expanded, setExpanded] = useState(true);

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
    if (!sessionId || !selectedName.trim()) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (canPickTeamMember && selectedName !== currentUserName) {
      params.set("designerName", selectedName.trim());
    }
    fetch(`${apiBase}/api/appointment/personal/history?${params.toString()}`, {
      headers: buildAuthHeaders(sessionId),
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        setRows(Array.isArray(data?.appointments) ? data.appointments : []);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [apiBase, sessionId, selectedName, canPickTeamMember, currentUserName, refreshKey]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const personalRows = useMemo(
    () => rows.filter((r) => isPersonalAppointmentRow(r)),
    [rows],
  );

  const roleLabel = (r: string) => r.replace(/_/g, " ");

  return (
    <div className="hidden xl:block rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 text-left"
      >
        <div>
          <h3 className="text-sm font-bold text-gray-900">My Appointments</h3>
          <p className="text-xs text-gray-500 mt-0.5">Personal time blocks (view only)</p>
        </div>
        <span className="text-gray-500 text-sm" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div className="p-4 space-y-3 max-h-[320px] overflow-y-auto">
          {canPickTeamMember && viewableUsers.length > 1 && (
            <label className="block">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Team member</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
              >
                {viewableUsers.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name} ({roleLabel(u.role)})
                  </option>
                ))}
              </select>
            </label>
          )}

          {loading ? (
            <p className="text-sm text-gray-500 py-4 text-center">Loading…</p>
          ) : personalRows.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No personal blocks yet.</p>
          ) : (
            <ul className="space-y-2">
              {personalRows.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {row.description || "Personal block"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {row.startTime ? formatDateLabel(row.startTime) : "—"} · {formatTimeRange(row)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetail(row)}
                      className="shrink-0 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Details
                    </button>
                  </div>
                </li>
              ))}
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
