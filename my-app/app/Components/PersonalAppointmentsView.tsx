"use client";

import { useState } from "react";
import { useAuth } from "@/app/auth/AuthContext";
import { getApiBase } from "@/app/lib/apiBase";
import { AppointmentHistoryPanel } from "./AppointmentHistoryPanel";
import { FullDayLeaveApprovalPanel } from "./FullDayLeaveApprovalPanel";
import { PersonalAppointmentModal } from "./PersonalAppointmentModal";
import {
  AppointmentSuccessToast,
  type AppointmentSuccessPayload,
} from "./AppointmentSuccessToast";

export default function PersonalAppointmentsView() {
  const { user, sessionId } = useAuth();
  const apiBase = getApiBase();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showBookModal, setShowBookModal] = useState(false);
  const [successToast, setSuccessToast] = useState<AppointmentSuccessPayload | null>(null);

  if (!user || !sessionId) return null;

  const role = (user.role || "").toLowerCase();
  const isDesigner = role === "designer";
  const isDesignManager = role === "design_manager";
  const isTdm = role === "territorial_design_manager";
  const isAdmin = role === "admin";
  const isDgm = role === "deputy_general_manager";

  const canBook = isDesigner || isDesignManager;
  const canApproveFullDayLeave = isTdm || isAdmin || isDesignManager;
  const showReviewerInfo = isTdm || isAdmin;
  const canPickTeamMember = isTdm || isAdmin || isDgm || isDesignManager;
  const isManagerView = canPickTeamMember && !isDesigner;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personal Appointments</h1>
          <p className="mt-1 text-sm text-gray-600">
            {isManagerView
              ? "View personal time blocks and full-day leave requests for your team."
              : "View your personal time blocks and full-day leave requests."}
          </p>
        </div>
        {canBook ? (
          <button
            type="button"
            onClick={() => setShowBookModal(true)}
            className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Book appointment
          </button>
        ) : null}
      </div>

      <AppointmentHistoryPanel
        apiBase={apiBase}
        sessionId={sessionId}
        currentUserName={user.name}
        currentUserRole={user.role}
        canPickTeamMember={canPickTeamMember}
        refreshKey={refreshKey}
        variant="page"
      />

      <FullDayLeaveApprovalPanel
        apiBase={apiBase}
        sessionId={sessionId}
        currentUserName={user.name}
        canApprove={canApproveFullDayLeave}
        canPickTeamMember={canPickTeamMember}
        showReviewerInfo={showReviewerInfo}
        approverRole={user.role}
        refreshKey={refreshKey}
        variant="page"
      />

      {showBookModal && canBook ? (
        <PersonalAppointmentModal
          open={showBookModal}
          apiBase={apiBase}
          sessionId={sessionId}
          designerName={user.name}
          onClose={() => setShowBookModal(false)}
          onSuccess={(payload) => {
            setRefreshKey((k) => k + 1);
            if (payload) setSuccessToast(payload);
          }}
        />
      ) : null}

      {successToast ? (
        <AppointmentSuccessToast
          payload={successToast}
          onDismiss={() => setSuccessToast(null)}
        />
      ) : null}
    </div>
  );
}
