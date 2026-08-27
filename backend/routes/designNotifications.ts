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

import type { Pool } from "mysql2/promise";
import type { Request, Response, Application } from "express";

// ── Database & Audience Configuration ──────────────────────────────────────────

let pool: Pool | null = null;

export function initPool(p: Pool): void {
  pool = p;
}

interface InboxRecipient {
  user_id: number;
  role: string;
}

function parseLeadId(projectId: string): number {
  if (!projectId) return 0;
  if (projectId.startsWith("HUB-")) {
    const idStr = projectId.substring(4);
    const id = Number(idStr);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }
  const id = Number(projectId);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

async function resolveLeadId(projectId: string): Promise<number> {
  const direct = parseLeadId(projectId);
  if (direct > 0) return direct;
  if (!pool || !projectId.trim()) return 0;
  const [rows] = await pool.query(
    "SELECT id FROM leads WHERE pid = ? LIMIT 1",
    [projectId.trim()],
  ) as any[];
  const id = rows?.[0]?.id;
  return id ? Number(id) : 0;
}

function buildEventId(type: string, action: string, leadId: number, payload: any): string {
  let suffix = "";
  if (payload) {
    if (payload.slot?.date && payload.slot?.slot_time) {
      suffix = `:${payload.slot.date}:${payload.slot.slot_time}`;
    } else if (payload.meeting_type && payload.slot?.date) {
      suffix = `:${payload.meeting_type}:${payload.slot.date}`;
    } else if (payload.payment_type) {
      suffix = `:${payload.payment_type}`;
    } else if (payload.dqc_round) {
      suffix = `:${payload.dqc_round}`;
    } else if (payload.assignment_type && payload.to_id) {
      suffix = `:${payload.assignment_type}:${payload.to_id}`;
    } else if (payload.quote_id) {
      suffix = `:${payload.quote_id}`;
    } else if (payload.milestone_name) {
      suffix = `:${payload.milestone_name}`;
    }
  }
  const base = `design:${leadId}:${type || ""}:${action || ""}${suffix}`;
  return base.substring(0, 250);
}

export async function resolveNotificationRecipients(args: {
  leadId: number;
  designerId: number | null;
  pmId: number | null;
  notificationType: string;
  notificationAction: string;
  payload: any;
}): Promise<InboxRecipient[]> {
  const recipientsMap = new Map<number, string>();

  if (!pool) {
    console.warn("[notify] database pool not initialized, returning empty recipients");
    return [];
  }

  // 1. Fetch management/system-wide users with special roles
  const [managementRows] = await pool.query(
    "SELECT id, role FROM users WHERE role IN ('admin', 'deputy_general_manager', 'dgm', 'finance', 'dqc_manager', 'mmt_manager')"
  ) as any[];

  const managementUsers = {
    admin: [] as number[],
    deputy_general_manager: [] as number[],
    finance: [] as number[],
    dqc_manager: [] as number[],
    mmt_manager: [] as number[],
  };

  for (const row of managementRows) {
    const role = row.role as string;
    if (role === "dgm") {
      managementUsers.deputy_general_manager.push(row.id);
    } else if (role in managementUsers) {
      managementUsers[role as keyof typeof managementUsers].push(row.id);
    }
  }

  // Always notify DGM & Admin (system copies)
  for (const uid of managementUsers.deputy_general_manager) {
    recipientsMap.set(uid, "dgm");
  }
  for (const uid of managementUsers.admin) {
    recipientsMap.set(uid, "admin");
  }

  // 2. Fetch lead-specific reporting line
  let assignedDesignerId: number | null = args.designerId;
  let assignedPmId: number | null = args.pmId;
  let designManagerId: number | null = null;
  let territorialDesignManagerId: number | null = null;

  if (args.leadId > 0) {
    const [leadRows] = await pool.query(
      `SELECT l.assigned_designer_id, l.assigned_project_manager_id, 
              d.design_manager_id, dm.territorial_design_manager_id
       FROM leads l
       LEFT JOIN users d ON d.id = l.assigned_designer_id
       LEFT JOIN users dm ON dm.id = d.design_manager_id
       WHERE l.id = ? LIMIT 1`,
      [args.leadId]
    ) as any[];

    if (leadRows && leadRows.length > 0) {
      const row = leadRows[0];
      if (row.assigned_designer_id) assignedDesignerId = row.assigned_designer_id;
      if (row.assigned_project_manager_id) assignedPmId = row.assigned_project_manager_id;
      if (row.design_manager_id) designManagerId = row.design_manager_id;
      if (row.territorial_design_manager_id) territorialDesignManagerId = row.territorial_design_manager_id;
    }
  }

  if (!designManagerId && assignedDesignerId) {
    const [userRows] = await pool.query(
      `SELECT d.design_manager_id, dm.territorial_design_manager_id
       FROM users d
       LEFT JOIN users dm ON dm.id = d.design_manager_id
       WHERE d.id = ? LIMIT 1`,
      [assignedDesignerId]
    ) as any[];

    if (userRows && userRows.length > 0) {
      designManagerId = userRows[0].design_manager_id;
      territorialDesignManagerId = userRows[0].territorial_design_manager_id;
    }
  }

  // 3. Resolve role-specific lists from payload
  const extraTo = args.payload?.to_id ? Number(args.payload.to_id) : null;
  const mmtManagerId = args.payload?.mmt_manager_id ? Number(args.payload.mmt_manager_id) : null;
  const requestedSpmId = args.payload?.requested_spm_id ? Number(args.payload.requested_spm_id) : null;

  const type = args.notificationType.toUpperCase();
  const action = args.notificationAction.toUpperCase();

  // 4. Apply Legacy Fanout Routing Rules
  if (type === "P2P") {
    if (assignedDesignerId) recipientsMap.set(assignedDesignerId, "designer");
    if (designManagerId) recipientsMap.set(designManagerId, "dm");
    if (territorialDesignManagerId) recipientsMap.set(territorialDesignManagerId, "tdm");
    if (assignedPmId) recipientsMap.set(assignedPmId, "pm");
    for (const uid of managementUsers.finance) {
      recipientsMap.set(uid, "finance");
    }
    for (const uid of managementUsers.dqc_manager) {
      recipientsMap.set(uid, "dqc_manager");
    }
  } else if (type === "PAYMENT") {
    for (const uid of managementUsers.finance) {
      recipientsMap.set(uid, "finance");
    }
    if (territorialDesignManagerId) recipientsMap.set(territorialDesignManagerId, "tdm");
    if (designManagerId) recipientsMap.set(designManagerId, "dm");
    if (assignedDesignerId) recipientsMap.set(assignedDesignerId, "designer");
  } else if (type === "DQC") {
    for (const uid of managementUsers.dqc_manager) {
      recipientsMap.set(uid, "dqc_manager");
    }
    if (extraTo) recipientsMap.set(extraTo, "dqe");
    if (assignedDesignerId) recipientsMap.set(assignedDesignerId, "designer");
    if (designManagerId) recipientsMap.set(designManagerId, "dm");
    if (territorialDesignManagerId) recipientsMap.set(territorialDesignManagerId, "tdm");
    const round = args.payload?.dqc_round;
    if (round === "DQC2" && assignedPmId) {
      recipientsMap.set(assignedPmId, "pm");
    }
  } else if (type === "MMT") {
    for (const uid of managementUsers.mmt_manager) {
      recipientsMap.set(uid, "mmt_manager");
    }
    if (mmtManagerId) recipientsMap.set(mmtManagerId, "mmt_manager");
    if (extraTo) recipientsMap.set(extraTo, "mmt_executive");
    if (assignedDesignerId) recipientsMap.set(assignedDesignerId, "designer");
    if (designManagerId) recipientsMap.set(designManagerId, "dm");
    if (territorialDesignManagerId) recipientsMap.set(territorialDesignManagerId, "tdm");
    if (assignedPmId) recipientsMap.set(assignedPmId, "pm");
    if (requestedSpmId) recipientsMap.set(requestedSpmId, "spm");
  } else if (type === "ASSIGNMENT") {
    if (extraTo) {
      const role = action === "PM_ASSIGNED" ? "pm" : "designer";
      recipientsMap.set(extraTo, role);
    }
    if (assignedDesignerId) recipientsMap.set(assignedDesignerId, "designer");
    if (designManagerId) recipientsMap.set(designManagerId, "dm");
    if (territorialDesignManagerId) recipientsMap.set(territorialDesignManagerId, "tdm");
    if (assignedPmId) recipientsMap.set(assignedPmId, "pm");
  } else {
    if (assignedDesignerId) recipientsMap.set(assignedDesignerId, "designer");
    if (designManagerId) recipientsMap.set(designManagerId, "dm");
    if (territorialDesignManagerId) recipientsMap.set(territorialDesignManagerId, "tdm");
    if (assignedPmId && (type === "MILESTONE" || type === "PM")) {
      recipientsMap.set(assignedPmId, "pm");
    }
  }

  const list: InboxRecipient[] = [];
  recipientsMap.forEach((role, user_id) => {
    list.push({ user_id, role });
  });

  return list;
}

// ── NotifyProject HTTP helpers ─────────────────────────────────────────────────

function notifyApiBase(): string {
  return (process.env.NOTIFY_API_URL || "http://notify.hubinterior.com").replace(/\/$/, "");
}

function notifyWebSocketBase(): string {
  const explicit = (process.env.NOTIFY_WS_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const http = notifyApiBase();
  if (http.startsWith("https://")) return `wss://${http.slice(8)}`;
  if (http.startsWith("http://")) return `ws://${http.slice(7)}`;
  return `ws://${http}`;
}

function notifyApiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const key = (process.env.HUB_NOTIFY_API_KEY || "").trim();
  if (key) headers["x-external-api-key"] = key;
  return headers;
}

function inboxActionResponse(json: Record<string, unknown>): Record<string, unknown> {
  if (json.ok === true || json.success === true) {
    json.success = true;
    json.ok = true;
  }
  return json;
}

// ── Route Proxying for Bell/Inbox API ──────────────────────────────────────────

export type InboxAuthResolver = (req: Request) => Promise<{ id: number } | null>;

export function registerInboxRoutes(app: Application, authResolver?: InboxAuthResolver): void {
  async function resolveInboxUserId(req: Request, res: Response): Promise<number | null> {
    if (authResolver) {
      const sessionUser = await authResolver(req);
      if (!sessionUser?.id) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
      }
      return Number(sessionUser.id);
    }
    const raw = req.query.user_id || req.body?.user_id;
    const userId = Number(raw);
    if (!userId || userId <= 0) {
      res.status(400).json({ error: "Missing user_id" });
      return null;
    }
    return userId;
  }

  app.get("/v1/design/inbox", async (req: Request, res: Response) => {
    try {
      const userId = await resolveInboxUserId(req, res);
      if (!userId) return;
      let targetUrl = `${notifyApiBase()}/v1/design/inbox?user_id=${userId}`;
      if (req.query.since) targetUrl += `&since=${req.query.since}`;
      if (req.query.project_id) targetUrl += `&project_id=${req.query.project_id}`;
      if (req.query.limit) targetUrl += `&limit=${req.query.limit}`;

      const resp = await fetch(targetUrl, { headers: notifyApiHeaders() });
      const json = await resp.json();
      return res.status(resp.status).json(json);
    } catch (err: any) {
      console.error("[notify] inbox proxy error", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/v1/design/inbox/counts", async (req: Request, res: Response) => {
    try {
      const userId = await resolveInboxUserId(req, res);
      if (!userId) return;
      let targetUrl = `${notifyApiBase()}/v1/design/inbox/counts?user_id=${userId}`;
      if (req.query.since) targetUrl += `&since=${req.query.since}`;

      const resp = await fetch(targetUrl, { headers: notifyApiHeaders() });
      const json = await resp.json();
      return res.status(resp.status).json(json);
    } catch (err: any) {
      console.error("[notify] inbox counts proxy error", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/v1/design/inbox/:id/read", async (req: Request, res: Response) => {
    try {
      const userId = await resolveInboxUserId(req, res);
      if (!userId) return;
      const targetUrl = `${notifyApiBase()}/v1/design/inbox/${req.params.id}/read?user_id=${userId}`;

      const resp = await fetch(targetUrl, {
        method: "POST",
        headers: notifyApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: Number(req.params.id), user_id: userId }),
      });
      const json = await resp.json();
      return res.status(resp.status).json(inboxActionResponse(json));
    } catch (err: any) {
      console.error("[notify] inbox read proxy error", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/v1/design/inbox/read-all", async (req: Request, res: Response) => {
    try {
      const userId = await resolveInboxUserId(req, res);
      if (!userId) return;
      const targetUrl = `${notifyApiBase()}/v1/design/inbox/read-all?user_id=${userId}`;

      const resp = await fetch(targetUrl, {
        method: "POST",
        headers: notifyApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ user_id: userId }),
      });
      const json = await resp.json();
      return res.status(resp.status).json(inboxActionResponse(json));
    } catch (err: any) {
      console.error("[notify] inbox read-all proxy error", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/v1/design/inbox/ws-ticket", async (req: Request, res: Response) => {
    try {
      const userId = await resolveInboxUserId(req, res);
      if (!userId) return;
      const targetUrl = `${notifyApiBase()}/v1/design/inbox/ws-ticket`;

      const resp = await fetch(targetUrl, {
        method: "POST",
        headers: notifyApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ user_id: userId }),
      });
      const json = await resp.json();
      if (resp.ok && json.ticket) {
        json.ws_url = `${notifyWebSocketBase()}/v1/design/inbox/ws?ticket=${encodeURIComponent(json.ticket)}`;
      }
      return res.status(resp.status).json(json);
    } catch (err: any) {
      console.error("[notify] inbox ws-ticket proxy error", err);
      return res.status(500).json({ error: err.message });
    }
  });
}

// ── Core Post Dispatcher with Fanout Resolution ───────────────────────────────

function fanoutPayload(body: Record<string, any>): Record<string, any> {
  const payload = { ...(body.payload || {}) };
  if (body.dqc_round && payload.dqc_round == null) payload.dqc_round = body.dqc_round;
  if (body.payment_type && payload.payment_type == null) payload.payment_type = body.payment_type;
  if (body.mmt_manager_id && payload.mmt_manager_id == null) payload.mmt_manager_id = body.mmt_manager_id;
  return payload;
}

async function post(endpoint: string, body: Record<string, any>): Promise<void> {
  if (process.env.HUB_NOTIFY_ENABLED !== "true") return;

  const leadId = await resolveLeadId(body.project_id || "");
  const designerId = body.designer_id || null;
  const pmId = body.payload?.to_id || null;
  const resolutionPayload = fanoutPayload(body);

  // 1. Calculate deterministic idempotency event_id to prevent duplicates
  const eventId = buildEventId(body.notification_type || "", body.notification_action || "", leadId, resolutionPayload);
  body.event_id = eventId;

  // 2. Resolve audience list
  let recipients: InboxRecipient[] = [];
  try {
    recipients = await resolveNotificationRecipients({
      leadId,
      designerId: designerId ? Number(designerId) : null,
      pmId: pmId ? Number(pmId) : null,
      notificationType: body.notification_type || "",
      notificationAction: body.notification_action || "",
      payload: resolutionPayload,
    });
  } catch (err) {
    console.error("[notify] error resolving notification recipients", err);
    if (designerId) {
      recipients = [{ user_id: Number(designerId), role: "designer" }];
    }
  }
  body.recipients = recipients;

  const url = `${notifyApiBase()}${endpoint}`;

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
      console.log("[notify] sent", { url, eventId, recipientsCount: recipients.length });
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
    notification_type: "LEAD",
    notification_action: "CREATED",
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
    notification_type: "PHASE",
    notification_action: "PHASE_ENTERED",
    payload: {
      previous_phase: "PRE_10",
      trigger: "PHASE_ENTERED",
      message: "Lead entered 10-20% phase",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  03  milestoneCompleted
//  Trigger: complete-task — when every task in a milestone is done (8 milestones total)
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
    notification_type: "MILESTONE",
    notification_action: "COMPLETED",
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
    notification_type: "PAYMENT",
    notification_action: "REQUESTED",
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
    notification_type: "DQC",
    notification_action: "REQUESTED",
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
