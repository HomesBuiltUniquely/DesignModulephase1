/**
 * @file designNotifications.ts
 * @description Centralized notification triggers for the Design Module.
 *
 * All 16 notification events are defined here as individual, named async functions.
 * Each function corresponds to one POST endpoint on the NotifyProject microservice
 * (http://notify.hubinterior.com / NOTIFY_API_URL env var).
 *
 * Usage in server.ts:
 *   import * as notify from "./routes/designNotifications.js";
 *   void notify.leadPre10({ projectId, leadName, ... });
 *
 * All functions are fire-and-forget (never throw) — call them with `void`.
 * Toggle entire system: set HUB_NOTIFY_ENABLED=true|false in .env
 *
 * ─────────────────────────────────────────────────────────────────
 *  #  | Function                   | Notify Endpoint
 * ────|────────────────────────────|────────────────────────────────
 *  01 | leadPre10()                | /v1/design/notifications/lead/pre-10
 *  02 | leadEntered1020()          | /v1/design/notifications/lead/10-20
 *  03 | milestoneCompleted()       | /v1/design/notifications/milestone
 *  04 | paymentRequested()         | /v1/design/notifications/payment/request
 *  05 | paymentStatus()            | /v1/design/notifications/payment/status
 *  06 | dqcRequested()             | /v1/design/notifications/dqc/request
 *  07 | dqcStatus()                | /v1/design/notifications/dqc/status
 *  08 | mmtRequested()             | /v1/design/notifications/mmt/request
 *  09 | mmtAssigned()              | /v1/design/notifications/mmt/assign
 *  10 | mmtDocReady()              | /v1/design/notifications/mmt/doc-ready
 *  11 | meetingScheduled()         | /v1/design/notifications/meeting
 *  12 | designerAssigned()         | /v1/design/notifications/assign/designer
 *  13 | pmAssigned()               | /v1/design/notifications/assign/pm
 *  14 | quoteSaved()               | /v1/design/notifications/quote
 *  15 | p2pCompleted()             | /v1/design/notifications/p2p
 *  16 | pmApprovalStatus()         | /v1/design/notifications/pm/status
 * ─────────────────────────────────────────────────────────────────
 */

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Core HTTP helper — fire-and-forget POST to the NotifyProject service.
 * Never throws. Gated by HUB_NOTIFY_ENABLED env flag.
 */
async function post(endpoint: string, body: Record<string, unknown>): Promise<void> {
  if (process.env.HUB_NOTIFY_ENABLED !== "true") return;
  const baseUrl = (process.env.NOTIFY_API_URL || "http://notify.hubinterior.com").replace(/\/$/, "");
  const url = `${baseUrl}${endpoint}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.warn("[notify] call failed", { url, status: resp.status, body: text });
    } else {
      console.log("[notify] sent", { url });
    }
  } catch (err) {
    console.warn("[notify] network error (non-fatal)", { url, err });
  }
}

// ── Shared input types ────────────────────────────────────────────────────────

/** Base fields present on every notification payload */
interface NotifyBase {
  projectId: string;
  leadName: string;
  designerId: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  01  leadPre10
//  Trigger: external-intake — new lead created
// ─────────────────────────────────────────────────────────────────────────────
export interface LeadPre10Params extends NotifyBase {
  designerName: string;
  salesExecutiveName: string;
  appointmentDate: string;
  appointmentSlot: string;
}

export async function leadPre10(p: LeadPre10Params): Promise<void> {
  return post("/v1/design/notifications/lead/pre-10", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    payload: {
      current_phase: "PRE_10",
      designer_name: p.designerName,
      sales_executive_name: p.salesExecutiveName,
      slot: {
        date: p.appointmentDate,
        slot_time: p.appointmentSlot,
      },
      meeting_type: "SHOWROOM_VISIT",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  02  leadEntered1020
//  Trigger: approve-10p-payment — lead transitions from PRE_10 → 10-20%
// ─────────────────────────────────────────────────────────────────────────────
export interface LeadEntered1020Params extends NotifyBase {}

export async function leadEntered1020(p: LeadEntered1020Params): Promise<void> {
  return post("/v1/design/notifications/lead/10-20", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    payload: {
      previous_phase: "PRE_10",
      trigger: "PHASE_ENTERED",
      message: "Lead entered 10-20% phase",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  03  milestoneCompleted
//  Trigger: complete-task — any task marked done for the first time
// ─────────────────────────────────────────────────────────────────────────────
export interface MilestoneCompletedParams extends NotifyBase {
  milestoneName: string;
  taskName: string;
  milestoneIndex: number;
  designerName: string;
}

export async function milestoneCompleted(p: MilestoneCompletedParams): Promise<void> {
  return post("/v1/design/notifications/milestone", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    payload: {
      milestone_name: p.milestoneName,
      task_name: p.taskName,
      milestone_index: p.milestoneIndex,
      designer_name: p.designerName,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  04  paymentRequested
//  Trigger: complete-task → "10% payment collection" (milestone 2)
//  Meaning: designer has uploaded proof and is requesting Finance review.
// ─────────────────────────────────────────────────────────────────────────────
export interface PaymentRequestedParams extends NotifyBase {
  paymentType: "PRE_10_PERCENT" | "40_PERCENT";
  uploadName?: string;
  amount?: number;
}

export async function paymentRequested(p: PaymentRequestedParams): Promise<void> {
  return post("/v1/design/notifications/payment/request", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    payload: {
      payment_type: p.paymentType,
      upload_name: p.uploadName ?? "Payment Collection",
      amount: p.amount ?? 0,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  05  paymentStatus
//  Trigger (APPROVED): approve-10p-payment
//  Trigger (REJECTED): reject-10p-payment
// ─────────────────────────────────────────────────────────────────────────────
export interface PaymentStatusParams extends NotifyBase {
  status: "SUCCESS" | "FAILED";
  decision: "APPROVED" | "REJECTED";
  paymentType: "PRE_10_PERCENT" | "40_PERCENT";
  milestoneContext: string;
  approverName: string;
  amount?: number;
  rejectionReason?: string;
}

export async function paymentStatus(p: PaymentStatusParams): Promise<void> {
  return post("/v1/design/notifications/payment/status", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    notification_type: "PAYMENT",
    notification_action: "STATUS_UPDATED",
    status: p.status,
    decision_type: p.decision,
    payment_type: p.paymentType,
    milestone_context: p.milestoneContext,
    approver_name: p.approverName,
    amount: p.amount ?? 0,
    created_at: new Date().toISOString(),
    rejection_reason: p.rejectionReason ?? "",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  06  dqcRequested
//  Trigger: dqc-submission/complete (S3) + dqc-submission (legacy multipart)
// ─────────────────────────────────────────────────────────────────────────────
export interface DqcRequestedParams extends NotifyBase {
  dqcRound: "DQC1" | "DQC2";
  designerName: string;
  reviewId?: number;
}

export async function dqcRequested(p: DqcRequestedParams): Promise<void> {
  return post("/v1/design/notifications/dqc/request", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    dqc_round: p.dqcRound,
    review_id: p.reviewId ?? 0,
    designer_name: p.designerName,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  07  dqcStatus
//  Trigger: dqc-review POST — after DQC manager saves verdict
// ─────────────────────────────────────────────────────────────────────────────
export interface DqcStatusParams extends NotifyBase {
  status: "APPROVED" | "REJECTED";
  dqcRound: "DQC1" | "DQC2";
  designerName: string;
  rejectionReason?: string;
}

export async function dqcStatus(p: DqcStatusParams): Promise<void> {
  return post("/v1/design/notifications/dqc/status", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    notification_type: "DQC",
    notification_action: "STATUS_UPDATED",
    status: p.status,
    decision_type: p.status,
    dqc_round: p.dqcRound,
    designer_name: p.designerName,
    created_at: new Date().toISOString(),
    rejection_reason: p.status === "REJECTED" ? (p.rejectionReason ?? "") : "",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  08  mmtRequested
//  Trigger: d1-request POST — designer requests D1 site measurement
// ─────────────────────────────────────────────────────────────────────────────
export interface MmtRequestedParams extends NotifyBase {
  designerName: string;
  mmtManagerId: number;
  mmtManagerName: string;
  visitDate?: string;
  visitTime?: string;
}

export async function mmtRequested(p: MmtRequestedParams): Promise<void> {
  return post("/v1/design/notifications/mmt/request", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    notification_type: "MMT",
    notification_action: "REQUESTED",
    mmt_scope: "SITE_VISIT",
    visit_date: p.visitDate ?? "",
    visit_time: p.visitTime ?? "",
    mmt_manager_id: p.mmtManagerId,
    designer_name: p.designerName,
    mmt_manager_name: p.mmtManagerName,
    created_at: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  09  mmtAssigned
//  Trigger: assign-d1-executive POST — MMT manager assigns an executive
// ─────────────────────────────────────────────────────────────────────────────
export interface MmtAssignedParams extends NotifyBase {
  executiveId: number;
  executiveName: string;
}

export async function mmtAssigned(p: MmtAssignedParams): Promise<void> {
  return post("/v1/design/notifications/mmt/assign", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    notification_type: "MMT",
    notification_action: "ASSIGNED",
    payload: {
      assignment_type: "MMT_EXECUTIVE",
      to_name: p.executiveName,
      to_id: p.executiveId,
    },
    created_at: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  10  mmtDocReady
//  Trigger: d2-masking-request POST — D2 masking documents uploaded
// ─────────────────────────────────────────────────────────────────────────────
export interface MmtDocReadyParams extends NotifyBase {
  designerName: string;
  uploadName?: string;
}

export async function mmtDocReady(p: MmtDocReadyParams): Promise<void> {
  return post("/v1/design/notifications/mmt/doc-ready", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    notification_type: "MMT",
    notification_action: "DOC_READY",
    payload: {
      mmt_scope: "SITE_VISIT",
      via: "UPLOAD",
      upload_name: p.uploadName ?? "D2 Masking Document",
      approved_by: p.designerName,
    },
    created_at: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  11  meetingScheduled
//  Trigger: schedule-meeting-invite POST — any meeting invite sent
// ─────────────────────────────────────────────────────────────────────────────
export interface MeetingScheduledParams extends NotifyBase {
  meetingType: string;
  meetingMode?: string;
  meetingDate: string;
  meetingTime: string;
}

export async function meetingScheduled(p: MeetingScheduledParams): Promise<void> {
  return post("/v1/design/notifications/meeting", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    notification_type: "MEETING",
    notification_action: "SCHEDULED",
    meeting_type: p.meetingType.toUpperCase().replace(/\s+/g, "_"),
    mod: (p.meetingMode ?? "IN_PERSON").toUpperCase().replace(/\s+/g, "_"),
    slot: {
      date: p.meetingDate,
      time_slot: p.meetingTime,
    },
    created_at: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  12  designerAssigned
//  Trigger: assign-designer POST — designer is assigned or reassigned
// ─────────────────────────────────────────────────────────────────────────────
export interface DesignerAssignedParams extends NotifyBase {
  fromDesignerId?: number;
  fromDesignerName?: string;
  toDesignerId: number;
  toDesignerName: string;
}

export async function designerAssigned(p: DesignerAssignedParams): Promise<void> {
  return post("/v1/design/notifications/assign/designer", {
    project_id: p.projectId,
    lead_name: p.leadName,
    notification_type: "ASSIGNMENT",
    notification_action: "DESIGNER_REASSIGNED",
    payload: {
      assignment_type: "DESIGNER",
      from_id: p.fromDesignerId ?? 0,
      to_id: p.toDesignerId,
      from_name: p.fromDesignerName ?? "",
      to_name: p.toDesignerName,
    },
    created_at: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  13  pmAssigned
//  Trigger: assign-project-manager PATCH — PM assigned to lead
// ─────────────────────────────────────────────────────────────────────────────
export interface PmAssignedParams extends NotifyBase {
  pmId: number;
  pmName: string;
}

export async function pmAssigned(p: PmAssignedParams): Promise<void> {
  return post("/v1/design/notifications/assign/pm", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    notification_type: "ASSIGNMENT",
    notification_action: "PM_ASSIGNED",
    payload: {
      assignment_type: "PROJECT_MANAGER",
      to_id: p.pmId,
      to_name: p.pmName,
    },
    created_at: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  14  quoteSaved
//  Trigger: prolance-quote-snapshots POST — Prolance quote saved or updated
// ─────────────────────────────────────────────────────────────────────────────
export interface QuoteSavedParams extends NotifyBase {
  quoteId: number;
  isNewQuote: boolean;  // true = INSERT, false = UPDATE
}

export async function quoteSaved(p: QuoteSavedParams): Promise<void> {
  return post("/v1/design/notifications/quote", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    notification_type: "QUOTATION",
    notification_action: p.isNewQuote ? "QUOTE_CREATED" : "QUOTE_UPDATED",
    payload: {
      quotation_name: `Quote #${p.quoteId}`,
      link: "",
    },
    created_at: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  15  p2pCompleted
//  Trigger: complete-task → milestone 4 "Project manager approval" (first time)
//  P2P = Push-to-Production sign-off.
// ─────────────────────────────────────────────────────────────────────────────
export interface P2pCompletedParams extends NotifyBase {
  designerName: string;
}

export async function p2pCompleted(p: P2pCompletedParams): Promise<void> {
  return post("/v1/design/notifications/p2p", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    notification_type: "P2P",
    notification_action: "COMPLETED",
    designer_name: p.designerName,
    created_at: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  16  pmApprovalStatus
//  Trigger (APPROVED): complete-task → milestone 4 "Project manager approval"
//  Trigger (REJECTED): reject-pm-approval POST
// ─────────────────────────────────────────────────────────────────────────────
export interface PmApprovalStatusParams extends NotifyBase {
  status: "APPROVED" | "REJECTED";
  dqcRound: "DQC2";
  designerName: string;
  approverName: string;
  rejectionReason?: string;
}

export async function pmApprovalStatus(p: PmApprovalStatusParams): Promise<void> {
  return post("/v1/design/notifications/pm/status", {
    project_id: p.projectId,
    lead_name: p.leadName,
    designer_id: p.designerId,
    notification_type: "PM",
    notification_action: "STATUS_UPDATED",
    status: p.status,
    decision_type: p.status,
    dqc_round: p.dqcRound,
    designer_name: p.designerName,
    approver_name: p.approverName,
    created_at: new Date().toISOString(),
    rejection_reason: p.status === "REJECTED" ? (p.rejectionReason ?? "") : "",
  });
}
