/**
 * Design Module payment links (DESIGN_10 / DESIGN_40).
 * Links are created here with EASEBUZZ_KEY/SALT.
 * Success/fail comes from CRM forwarding the merchant webhook (txn prefix DES10/DES40).
 * Backup: Design retrieve on active-link GET + ~20s cron — does not wait for a CRM refresh.
 */
import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { resolveLeadMilestonePaymentBreakdown } from "./prolanceApi";
import {
  createEasebuzzPaymentLink,
  deactivateEasebuzzPaymentLink,
  easebuzzConfigured,
  isDesignMerchantTxn,
  isGatewayFailure,
  isGatewaySuccess,
  newDesignMerchantTxn,
  retrieveEasebuzzTxn,
} from "./easebuzzClient";
import { awardTaskCompletionXp } from "./designerXpRoutes";
import { stampEntered1020At } from "../leadTimelineAnchors";

type SessionUser = { id: number; name?: string | null; email?: string | null; role?: string | null };

function isEasebuzzAdmin(user: SessionUser | null): boolean {
  const r = String(user?.role || "").trim().toLowerCase();
  return r === "admin" || r === "super_admin" || r === "superadmin";
}

type Deps = {
  pool: Pool;
  getUserFromSession: (req: Request) => Promise<SessionUser | null>;
  addLeadHistoryEvent: (leadId: number, event: Record<string, unknown>) => Promise<void>;
  triggerMailRouteWithLog?: (args: {
    leadId: number;
    milestoneIndex?: number;
    taskName: string;
    route: string;
    visibility: "external" | "internal";
    payload: Record<string, unknown>;
  }) => Promise<boolean> | boolean | unknown;
  maybeNotifyMilestoneCompleted?: (leadId: number, milestoneIndex: number, extra?: Record<string, unknown>) => void;
};

type AttemptRow = {
  id: string;
  lead_id: number;
  bucket: string;
  merchant_txn: string;
  amount: number;
  quote_amount: number | null;
  payment_link_url: string | null;
  status: string;
  is_active: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  email_status: string | null;
  failure_count: number;
  last_failure_reason: string | null;
  gateway_payment_id: string | null;
  payment_method: string | null;
  created_by_name: string | null;
  expires_at: Date | string | null;
  paid_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function envTrim(key: string): string {
  return String(process.env[key] || "").trim();
}

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function pickNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function webhookKeyOk(req: Request): boolean {
  const key =
    pickStr(req.headers["x-api-key"], req.headers["x-external-api-key"]) ||
    pickStr(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  if (!key) return false;
  const allowed = [
    envTrim("DESIGN_PAYMENT_WEBHOOK_KEY"),
    envTrim("HUB_SYNC_API_KEY"),
    envTrim("EXTERNAL_LEAD_INGEST_API_KEY"),
    "hi",
  ].filter(Boolean);
  return allowed.includes(key);
}

/** CRM may wrap Easebuzz fields; also accept mixed-case keys. */
function flattenWebhookBody(raw: Record<string, unknown>): Record<string, unknown> {
  const nestedKeys = ["data", "fields", "payload", "body", "msg", "result", "params"];
  let out: Record<string, unknown> = { ...raw };
  for (const k of nestedKeys) {
    const n = raw[k];
    if (n && typeof n === "object" && !Array.isArray(n)) {
      out = { ...(n as Record<string, unknown>), ...out };
    }
  }
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(out)) {
    lower[k.toLowerCase()] = v;
  }
  return { ...out, ...lower };
}

function normalizeBucket(raw: string): "DESIGN_10" | "DESIGN_40" {
  const b = raw.trim().toUpperCase();
  if (b.includes("40")) return "DESIGN_40";
  return "DESIGN_10";
}

function milestoneMeta(bucket: string) {
  const is40 = bucket === "DESIGN_40";
  return {
    is40,
    taskCollection: is40 ? "40% collection" : "10% payment collection",
    taskApproval: is40 ? "40% payment approval" : "10% payment approval",
    milestoneName: is40 ? "40% PAYMENT" : "10% PAYMENT",
    milestoneIndex: is40 ? 5 : 2,
  };
}

async function history(
  deps: Deps,
  leadId: number,
  bucket: string,
  description: string,
  extra?: Record<string, unknown>,
  type: "note" | "completed" = "note",
) {
  const meta = milestoneMeta(bucket);
  await deps.addLeadHistoryEvent(leadId, {
    id: `design-pay-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    taskName: extra?.taskName || meta.taskCollection,
    milestoneName: meta.milestoneName,
    timestamp: new Date().toISOString(),
    description,
    user: { name: pickStr(extra?.userName, "SYSTEM · Easebuzz") },
    details: {
      ...(extra || {}),
      kind: "note",
      noteText: description,
      paymentKind: pickStr(extra?.kind, "DESIGN_PAYMENT"),
      bucket,
    },
  });
}

async function ensureDesignPaymentTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS design_payment_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      lead_id INT NOT NULL,
      bucket VARCHAR(32) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      quote_amount DECIMAL(14,2) NULL,
      attempt_id VARCHAR(64) NULL,
      gateway_payment_id VARCHAR(64) NULL,
      payment_channel VARCHAR(16) NOT NULL,
      payment_method VARCHAR(32) NULL,
      source VARCHAR(32) NOT NULL,
      finance_handling_mode VARCHAR(32) NOT NULL DEFAULT 'AUTO_APPROVED',
      notes VARCHAR(512) NULL,
      created_at DATETIME NOT NULL,
      UNIQUE KEY uq_design_gateway (gateway_payment_id),
      KEY idx_design_pay_lead (lead_id),
      KEY idx_design_pay_bucket (lead_id, bucket)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS design_payment_case_summary (
      lead_id INT NOT NULL PRIMARY KEY,
      quote_amount DECIMAL(14,2) NULL,
      design_10_target DECIMAL(14,2) NULL,
      design_10_collected DECIMAL(14,2) NOT NULL DEFAULT 0,
      design_40_target DECIMAL(14,2) NULL,
      design_40_collected DECIMAL(14,2) NOT NULL DEFAULT 0,
      cumulative_paid_percent DECIMAL(8,2) NOT NULL DEFAULT 10,
      design_10_finance_mode VARCHAR(32) NULL,
      design_40_finance_mode VARCHAR(32) NULL,
      design_10_approved_at DATETIME NULL,
      design_40_approved_at DATETIME NULL,
      updated_at DATETIME NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS design_payment_link_attempts (
      id CHAR(36) NOT NULL PRIMARY KEY,
      lead_id INT NOT NULL,
      bucket VARCHAR(32) NOT NULL,
      merchant_txn VARCHAR(64) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      quote_amount DECIMAL(14,2) NULL,
      payment_link_url VARCHAR(1024) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      customer_name VARCHAR(200) NULL,
      customer_email VARCHAR(200) NULL,
      customer_phone VARCHAR(32) NULL,
      email_status VARCHAR(16) NULL,
      failure_count INT NOT NULL DEFAULT 0,
      last_failure_reason VARCHAR(512) NULL,
      gateway_payment_id VARCHAR(64) NULL,
      payment_method VARCHAR(32) NULL,
      created_by_name VARCHAR(120) NULL,
      expires_at DATETIME NULL,
      paid_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      UNIQUE KEY uq_des_merchant_txn (merchant_txn),
      KEY idx_des_lead_active (lead_id, is_active, status)
    )
  `);
}

async function loadLeadContact(
  pool: Pool,
  leadId: number,
): Promise<{ name: string; email: string; phone: string; pid: string }> {
  const [rows] = await pool.query(
    `SELECT pid, project_name as projectName, client_email as clientEmail, contact_no as contactNo, payload
     FROM leads WHERE id = ? LIMIT 1`,
    [leadId],
  );
  const row = (rows as RowDataPacket[])[0];
  if (!row) throw new Error("Lead not found");
  let payload: Record<string, unknown> = {};
  try {
    payload = row.payload ? (JSON.parse(String(row.payload)) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }
  const form = (payload.formData || payload.form_data || payload.form || {}) as Record<string, unknown>;
  return {
    pid: String(row.pid || `HUB-${leadId}`),
    name: pickStr(form.customer_name, payload.customer_name, row.projectName, "Customer"),
    email: pickStr(row.clientEmail, form.email, payload.email, form.sales_email),
    phone: pickStr(row.contactNo, form.phone, form.mobile, payload.phone),
  };
}

async function upsertSummaryFromBreakdown(pool: Pool, leadId: number): Promise<void> {
  const breakdown = await resolveLeadMilestonePaymentBreakdown(pool, leadId);
  const now = new Date();
  const quote = breakdown?.totalPayableAmount ?? null;
  const d10 =
    breakdown?.twentyPercentTarget != null && breakdown?.tenPercentAmount != null
      ? Math.max(0, Number(breakdown.twentyPercentTarget) - Number(breakdown.tenPercentAmount || 0))
      : breakdown
        ? Math.round(Number(breakdown.totalPayableAmount) * 0.1)
        : null;
  const d40 = breakdown?.fortyPercentAmount ?? (quote != null ? Math.round(quote * 0.4) : null);
  await pool.query(
    `INSERT INTO design_payment_case_summary
     (lead_id, quote_amount, design_10_target, design_40_target, cumulative_paid_percent, updated_at)
     VALUES (?, ?, ?, ?, 10, ?)
     ON DUPLICATE KEY UPDATE
       quote_amount = COALESCE(VALUES(quote_amount), quote_amount),
       design_10_target = COALESCE(VALUES(design_10_target), design_10_target),
       design_40_target = COALESCE(VALUES(design_40_target), design_40_target),
       updated_at = VALUES(updated_at)`,
    [leadId, quote, d10, d40, now],
  );
}

async function getSummaryRow(pool: Pool, leadId: number): Promise<RowDataPacket | null> {
  const [rows] = await pool.query(`SELECT * FROM design_payment_case_summary WHERE lead_id = ? LIMIT 1`, [leadId]);
  return (rows as RowDataPacket[])[0] || null;
}

function mapAttempt(row: AttemptRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    amount: Number(row.amount),
    paymentLinkUrl: row.payment_link_url,
    linkUrl: row.payment_link_url,
    emailStatus: row.email_status,
    whatsappStatus: "SKIPPED",
    expiresAt: row.expires_at,
    paymentFailureCount: row.failure_count,
    lastPaymentFailureReason: row.last_failure_reason,
    bucket: row.bucket,
    merchantTxn: row.merchant_txn,
    customerEmail: row.customer_email,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
  };
}

async function findActiveAttempt(pool: Pool, leadId: number): Promise<AttemptRow | null> {
  const [rows] = await pool.query(
    `SELECT * FROM design_payment_link_attempts
     WHERE lead_id = ? AND is_active = 1 AND status IN ('PENDING', 'CREATED_NOT_DELIVERED')
     ORDER BY created_at DESC LIMIT 1`,
    [leadId],
  );
  return ((rows as AttemptRow[])[0] as AttemptRow) || null;
}

async function findAttemptByTxn(pool: Pool, txn: string): Promise<AttemptRow | null> {
  const [rows] = await pool.query(
    `SELECT * FROM design_payment_link_attempts WHERE UPPER(merchant_txn) = UPPER(?) LIMIT 1`,
    [txn.trim()],
  );
  return ((rows as AttemptRow[])[0] as AttemptRow) || null;
}

async function findRecentlyPaidAttempt(pool: Pool, leadId: number): Promise<AttemptRow | null> {
  const [rows] = await pool.query(
    `SELECT * FROM design_payment_link_attempts
     WHERE lead_id = ? AND status = 'PAID'
       AND paid_at IS NOT NULL AND paid_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
     ORDER BY paid_at DESC LIMIT 1`,
    [leadId],
  );
  return ((rows as AttemptRow[])[0] as AttemptRow) || null;
}

async function payloadAlreadyAutoApproved(pool: Pool, leadId: number, bucket: string): Promise<boolean> {
  const [lr] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [leadId]);
  let payload: Record<string, unknown> = {};
  try {
    const raw = (lr as { payload?: unknown }[])[0]?.payload;
    payload = raw ? (JSON.parse(String(raw)) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }
  const flag =
    normalizeBucket(bucket) === "DESIGN_40"
      ? payload.design_40_finance_auto_approved
      : payload.design_10_finance_auto_approved;
  return flag === true || flag === "true";
}

async function sumBucketCollected(pool: Pool, leadId: number, bucket: string): Promise<number> {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM design_payment_history
     WHERE lead_id = ? AND UPPER(bucket) = UPPER(?)`,
    [leadId, normalizeBucket(bucket)],
  );
  return Number((rows as RowDataPacket[])[0]?.total) || 0;
}

async function syncCollectedFromHistory(pool: Pool, leadId: number): Promise<{
  d10Target: number;
  d10Collected: number;
  d10Extra: number;
  d10Remaining: number;
  d40Target: number;
  d40Collected: number;
  d40Extra: number;
  d40Remaining: number;
}> {
  await upsertSummaryFromBreakdown(pool, leadId);
  const d10Collected = await sumBucketCollected(pool, leadId, "DESIGN_10");
  const d40Collected = await sumBucketCollected(pool, leadId, "DESIGN_40");
  const now = new Date();
  await pool.query(
    `UPDATE design_payment_case_summary
     SET design_10_collected = ?, design_40_collected = ?, updated_at = ?
     WHERE lead_id = ?`,
    [d10Collected, d40Collected, now, leadId],
  );
  const row = await getSummaryRow(pool, leadId);
  const d10Target = Number(row?.design_10_target) || 0;
  const d40Target = Number(row?.design_40_target) || 0;
  return {
    d10Target,
    d10Collected,
    d10Extra: Math.max(0, d10Collected - d10Target),
    d10Remaining: Math.max(0, d10Target - d10Collected),
    d40Target,
    d40Collected,
    d40Extra: Math.max(0, d40Collected - d40Target),
    d40Remaining: Math.max(0, d40Target - d40Collected),
  };
}

/**
 * Extra beyond current milestone target is credited to the next design bucket
 * (10% overpay → 40% remaining). Idempotent via unique gateway_payment_id suffix.
 */
async function carryExtraTowardNextPayment(
  deps: Deps,
  leadId: number,
  fromBucket: string,
  extraPaid: number,
  opts?: { attemptId?: string; gatewayPaymentId?: string },
): Promise<number> {
  if (!(extraPaid > 0)) return 0;
  const { pool } = deps;
  const from = normalizeBucket(fromBucket);
  const now = new Date();

  if (from === "DESIGN_10") {
    const carryId = `${opts?.gatewayPaymentId || opts?.attemptId || `lead-${leadId}`}-CARRY-D40`;
    const [dup] = await pool.query(
      `SELECT id FROM design_payment_history WHERE gateway_payment_id = ? LIMIT 1`,
      [carryId],
    );
    if ((dup as RowDataPacket[]).length > 0) return extraPaid;

    await pool.query(
      `INSERT INTO design_payment_history
       (lead_id, bucket, amount, quote_amount, attempt_id, gateway_payment_id,
        payment_channel, payment_method, source, finance_handling_mode, notes, created_at)
       VALUES (?, 'DESIGN_40', ?, NULL, ?, ?, 'ONLINE', 'CARRY_FORWARD', 'EASEBUZZ', 'CREDIT_FROM_PRIOR', ?, ?)`,
      [
        leadId,
        extraPaid,
        opts?.attemptId || null,
        carryId,
        `Extra from Design 10% applied toward Design 40% (₹${Math.round(extraPaid).toLocaleString("en-IN")})`,
        now,
      ],
    );
    await syncCollectedFromHistory(pool, leadId);
    await history(
      deps,
      leadId,
      "DESIGN_40",
      `₹${Math.round(extraPaid).toLocaleString("en-IN")} extra from Design 10% added toward Design 40% payment.`,
      {
        kind: "DESIGN_PAYMENT_CARRY_FORWARD",
        userName: "SYSTEM · Easebuzz",
        amount: extraPaid,
        fromBucket: "DESIGN_10",
        toBucket: "DESIGN_40",
      },
    );
    return extraPaid;
  }

  // DESIGN_40 overpay → advance toward remaining project balance (stored on lead payload).
  const [lr] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [leadId]);
  let payload: Record<string, unknown> = {};
  try {
    const raw = (lr as { payload?: unknown }[])[0]?.payload;
    payload = raw ? (JSON.parse(String(raw)) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }
  const prevAdvance = Number(payload.design_advance_beyond_60) || 0;
  payload.design_advance_beyond_60 = prevAdvance + extraPaid;
  payload.design_40_extra_paid = Number(payload.design_40_extra_paid) || 0;
  if (Number(payload.design_40_extra_paid) < extraPaid) {
    payload.design_40_extra_paid = extraPaid;
  }
  await pool.query(`UPDATE leads SET payload = ?, update_at = ? WHERE id = ?`, [
    JSON.stringify(payload),
    now,
    leadId,
  ]);
  await history(
    deps,
    leadId,
    "DESIGN_40",
    `₹${Math.round(extraPaid).toLocaleString("en-IN")} extra beyond Design 40% held as advance toward the next project payment.`,
    {
      kind: "DESIGN_PAYMENT_ADVANCE",
      userName: "SYSTEM · Easebuzz",
      amount: extraPaid,
    },
  );
  return extraPaid;
}

async function applyDesignAutoApprove(
  deps: Deps,
  leadId: number,
  bucket: string,
  amount: number,
  opts?: {
    collected?: number;
    target?: number;
    extraPaid?: number;
    attemptId?: string;
    gatewayPaymentId?: string;
  },
): Promise<void> {
  const { pool } = deps;
  const now = new Date();
  const approvedBy = "SYSTEM · Easebuzz";
  const is10 = normalizeBucket(bucket) === "DESIGN_10";
  const meta = milestoneMeta(is10 ? "DESIGN_10" : "DESIGN_40");
  const collected = opts?.collected ?? amount;
  const target = opts?.target ?? amount;
  const extraPaid = opts?.extraPaid ?? Math.max(0, collected - target);

  if (await payloadAlreadyAutoApproved(pool, leadId, is10 ? "DESIGN_10" : "DESIGN_40")) {
    // Still try carry if extra wasn't credited yet (idempotent).
    if (extraPaid > 0) {
      await carryExtraTowardNextPayment(deps, leadId, bucket, extraPaid, {
        attemptId: opts?.attemptId,
        gatewayPaymentId: opts?.gatewayPaymentId,
      });
    }
    return;
  }

  await pool.query(
    `INSERT INTO lead_task_completions (lead_id, milestone_index, task_name, completed_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at)`,
    [leadId, meta.milestoneIndex, meta.taskCollection, now],
  );
  try {
    void awardTaskCompletionXp(pool, {
      leadId,
      milestoneIndex: meta.milestoneIndex,
      taskName: meta.taskCollection,
      completionDate: now,
    });
  } catch (xpErr) {
    console.error("[designer-xp] Hook error in applyAutoApprovalSideEffects (non-fatal):", xpErr);
  }
  await pool.query(
    `INSERT INTO lead_task_completions (lead_id, milestone_index, task_name, completed_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at)`,
    [leadId, meta.milestoneIndex, meta.taskApproval, now],
  );
  deps.maybeNotifyMilestoneCompleted?.(leadId, meta.milestoneIndex, { taskName: meta.taskApproval });

  const [lr] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [leadId]);
  let payload: Record<string, unknown> = {};
  try {
    const raw = (lr as { payload?: unknown }[])[0]?.payload;
    payload = raw ? (JSON.parse(String(raw)) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }

  if (is10) {
    payload.design_ten_percent_payment_met = true;
    payload.design_10_finance_handling_mode = "AUTO_APPROVED";
    payload.design_10_finance_section = "AUTO_APPROVED";
    payload.design_10_finance_auto_approved = true;
    payload.design_10_finance_approved_by = approvedBy;
    payload.design_10_finance_approved_at = now.toISOString();
    payload.design_10_collected = collected;
    payload.design_10_target = target;
    payload.design_10_extra_paid = extraPaid;
    payload.cumulative_payment_percent = 20;
  } else {
    payload.forty_percent_payment_met = true;
    payload.design_40_finance_handling_mode = "AUTO_APPROVED";
    payload.design_40_finance_section = "AUTO_APPROVED";
    payload.design_40_finance_auto_approved = true;
    payload.design_40_finance_approved_by = approvedBy;
    payload.design_40_finance_approved_at = now.toISOString();
    payload.design_40_collected = collected;
    payload.design_40_target = target;
    payload.design_40_extra_paid = extraPaid;
    payload.cumulative_payment_percent = 60;
  }

  try {
    const breakdown = await resolveLeadMilestonePaymentBreakdown(pool, leadId);
    if (breakdown) {
      payload.quotation_total = breakdown.totalPayableAmount;
      if (is10) {
        payload.twenty_percent_target = breakdown.twentyPercentTarget;
        payload.ten_percent_target = breakdown.tenPercentAmount;
        payload.total_paid_cumulative = Math.max(
          Number(payload.total_paid_cumulative) || 0,
          breakdown.twentyPercentTarget + extraPaid,
        );
      } else {
        payload.sixty_percent_target = breakdown.sixtyPercentTarget;
        payload.forty_percent_target = breakdown.fortyPercentAmount;
        payload.total_paid_cumulative = Math.max(
          Number(payload.total_paid_cumulative) || 0,
          breakdown.sixtyPercentTarget + extraPaid,
        );
      }
    }
  } catch {
    /* ignore */
  }

  if (is10) {
    stampEntered1020At(payload);
    if (extraPaid > 0) {
      payload.design_10_extra_applied_to_40 = extraPaid;
    }
    await pool.query(`UPDATE leads SET project_stage = '10-20%', payload = ?, update_at = ? WHERE id = ?`, [
      JSON.stringify(payload),
      now,
      leadId,
    ]);
    await pool.query(
      `UPDATE design_payment_case_summary SET
         design_10_collected = ?,
         cumulative_paid_percent = 20,
         design_10_finance_mode = 'AUTO_APPROVED',
         design_10_approved_at = ?,
         updated_at = ?
       WHERE lead_id = ?`,
      [collected, now, now, leadId],
    );
  } else {
    if (extraPaid > 0) {
      payload.design_advance_beyond_60 = Math.max(Number(payload.design_advance_beyond_60) || 0, extraPaid);
    }
    await pool.query(`UPDATE leads SET payload = ?, update_at = ? WHERE id = ?`, [JSON.stringify(payload), now, leadId]);
    await pool.query(
      `UPDATE design_payment_case_summary SET
         design_40_collected = ?,
         cumulative_paid_percent = 60,
         design_40_finance_mode = 'AUTO_APPROVED',
         design_40_approved_at = ?,
         updated_at = ?
       WHERE lead_id = ?`,
      [collected, now, now, leadId],
    );
  }

  // Credit overpay to the next payment bucket (10% → 40%, 40% → project advance).
  if (extraPaid > 0) {
    await carryExtraTowardNextPayment(deps, leadId, bucket, extraPaid, {
      attemptId: opts?.attemptId,
      gatewayPaymentId: opts?.gatewayPaymentId,
    });
  }

  const extraNote =
    extraPaid > 0
      ? is10
        ? ` Client paid ₹${Math.round(extraPaid).toLocaleString("en-IN")} extra — credited toward Design 40%.`
        : ` Client paid ₹${Math.round(extraPaid).toLocaleString("en-IN")} extra — held as advance toward the next project payment.`
      : "";
  await history(
    deps,
    leadId,
    is10 ? "DESIGN_10" : "DESIGN_40",
    `Easebuzz ${is10 ? "Design 10%" : "Design 40%"} paid and auto-approved (₹${Math.round(collected).toLocaleString("en-IN")} collected).${extraNote} Receipt emailed.`,
    {
      kind: "DESIGN_PAYMENT_PAID",
      taskName: meta.taskApproval,
      userName: approvedBy,
      amount: collected,
      extraPaid,
      target,
    },
    "completed",
  );

  try {
    const contact = await loadLeadContact(pool, leadId);
    if (contact.email && deps.triggerMailRouteWithLog) {
      deps.triggerMailRouteWithLog({
        leadId,
        milestoneIndex: is10 ? 2 : 5,
        taskName: meta.taskApproval,
        route: is10
          ? "/api/email/send-ten-percent-payment-approval"
          : "/api/email/send-design-signoff-40pc-payment-approval",
        visibility: "external",
        payload: {
          to: contact.email,
          customerName: contact.name,
          projectId: contact.pid,
          amountPaid: String(Math.round(collected)),
          amountReceived: String(Math.round(collected)),
          milestoneTarget: String(Math.round(target)),
          extraPaid: extraPaid > 0 ? String(Math.round(extraPaid)) : "",
          extraAppliedToNext: extraPaid > 0 ? String(Math.round(extraPaid)) : "",
          extraAppliedNote: is10
            ? "Extra amount credited toward your next (Design 40%) payment."
            : "Extra amount held as advance toward your next project payment.",
          paymentDate: now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          dateOfReceipt: now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          paymentMode: "Easebuzz (Online)",
          modeOfPayment: "Easebuzz (Online)",
        },
      });
    }
  } catch (mailErr) {
    console.warn("[design-payment] success email failed (non-fatal)", mailErr);
  }
}

async function applyPartialPaymentRecorded(
  deps: Deps,
  leadId: number,
  bucket: string,
  paidThisTxn: number,
  collected: number,
  target: number,
  remaining: number,
): Promise<void> {
  const { pool } = deps;
  const is10 = normalizeBucket(bucket) === "DESIGN_10";
  const label = is10 ? "Design 10%" : "Design 40%";
  const now = new Date();
  await history(
    deps,
    leadId,
    normalizeBucket(bucket),
    `Partial ${label} payment received ₹${Math.round(paidThisTxn).toLocaleString("en-IN")}. Collected ₹${Math.round(collected).toLocaleString("en-IN")} of ₹${Math.round(target).toLocaleString("en-IN")}. Remaining ₹${Math.round(remaining).toLocaleString("en-IN")}. Confirmation emailed.`,
    {
      kind: "DESIGN_PAYMENT_PARTIAL",
      userName: "SYSTEM · Easebuzz",
      amount: paidThisTxn,
      collected,
      target,
      remaining,
    },
  );
  await pool.query(
    `UPDATE design_payment_case_summary SET
       ${is10 ? "design_10_finance_mode" : "design_40_finance_mode"} = 'PARTIAL',
       updated_at = ?
     WHERE lead_id = ?`,
    [now, leadId],
  );

  // Same receipt look as full approval — with target / achieved / remaining for this milestone.
  try {
    const contact = await loadLeadContact(pool, leadId);
    if (contact.email && deps.triggerMailRouteWithLog) {
      const dateStr = now.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      deps.triggerMailRouteWithLog({
        leadId,
        milestoneIndex: is10 ? 2 : 5,
        taskName: is10 ? "10% payment collection" : "40% collection",
        route: is10
          ? "/api/email/send-ten-percent-payment-approval"
          : "/api/email/send-design-signoff-40pc-payment-approval",
        visibility: "external",
        payload: {
          to: contact.email,
          customerName: contact.name,
          projectId: contact.pid,
          isPartial: true,
          amountPaid: String(Math.round(paidThisTxn)),
          amountReceived: String(Math.round(paidThisTxn)),
          amountAchieved: String(Math.round(collected)),
          remainingMilestone: String(Math.round(remaining)),
          milestoneTarget: String(Math.round(target)),
          paymentDate: dateStr,
          dateOfReceipt: dateStr,
          paymentMode: "Easebuzz (Online)",
          modeOfPayment: "Easebuzz (Online)",
          subject: is10
            ? "10% Payment Received — Partial Confirmation"
            : "Payment Received – 40% Milestone (Partial)",
        },
      });
    }
  } catch (mailErr) {
    console.warn("[design-payment] partial confirmation email failed (non-fatal)", mailErr);
  }
}

async function applyPaidAttempt(
  deps: Deps,
  attempt: AttemptRow,
  gatewayPaymentId: string,
  method: string,
  paidAmount: number,
): Promise<{ ok: true; idempotent?: boolean; autoApproved?: boolean }> {
  const { pool } = deps;
  const gid = gatewayPaymentId || attempt.merchant_txn;
  const amount = paidAmount > 0 ? paidAmount : Number(attempt.amount);
  const now = new Date();
  const bucket = normalizeBucket(attempt.bucket);

  const [upd] = await pool.query(
    `UPDATE design_payment_link_attempts
     SET status = 'PAID', is_active = 0, gateway_payment_id = ?, payment_method = ?, paid_at = ?, updated_at = ?
     WHERE id = ? AND status <> 'PAID'`,
    [gid || null, method || "Easebuzz", now, now, attempt.id],
  );
  const wonLock = Number((upd as ResultSetHeader).affectedRows || 0) > 0;

  const maybeComplete = async (): Promise<boolean> => {
    const synced = await syncCollectedFromHistory(pool, attempt.lead_id);
    const collected = bucket === "DESIGN_40" ? synced.d40Collected : synced.d10Collected;
    const target = bucket === "DESIGN_40" ? synced.d40Target : synced.d10Target;
    const extraPaid = bucket === "DESIGN_40" ? synced.d40Extra : synced.d10Extra;
    if (target > 0 && collected + 0.009 >= target) {
      if (!(await payloadAlreadyAutoApproved(pool, attempt.lead_id, bucket))) {
        await applyDesignAutoApprove(deps, attempt.lead_id, bucket, amount, {
          collected,
          target,
          extraPaid,
          attemptId: attempt.id,
          gatewayPaymentId: gid || undefined,
        });
      }
      return true;
    }
    // Idempotent retries: do not re-log partial history.
    return false;
  };

  if (!wonLock) {
    const autoApproved = await maybeComplete();
    return { ok: true, idempotent: true, autoApproved };
  }

  if (gid) {
    const [dup] = await pool.query(
      `SELECT id FROM design_payment_history WHERE gateway_payment_id = ? LIMIT 1`,
      [gid],
    );
    if ((dup as RowDataPacket[]).length > 0) {
      const autoApproved = await maybeComplete();
      return { ok: true, idempotent: true, autoApproved };
    }
  }

  await upsertSummaryFromBreakdown(pool, attempt.lead_id);
  try {
    await pool.query(
      `INSERT INTO design_payment_history
       (lead_id, bucket, amount, quote_amount, attempt_id, gateway_payment_id,
        payment_channel, payment_method, source, finance_handling_mode, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ONLINE', ?, 'EASEBUZZ', ?, ?, ?)`,
      [
        attempt.lead_id,
        bucket,
        amount,
        attempt.quote_amount,
        attempt.id,
        gid || null,
        method || "Easebuzz",
        "RECORDED",
        null,
        now,
      ],
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "ER_DUP_ENTRY") throw err;
  }

  const synced = await syncCollectedFromHistory(pool, attempt.lead_id);
  const collected = bucket === "DESIGN_40" ? synced.d40Collected : synced.d10Collected;
  const target = bucket === "DESIGN_40" ? synced.d40Target : synced.d10Target;
  const remaining = bucket === "DESIGN_40" ? synced.d40Remaining : synced.d10Remaining;
  const extraPaid = bucket === "DESIGN_40" ? synced.d40Extra : synced.d10Extra;

  let autoApproved = false;
  if (target > 0 && collected + 0.009 >= target) {
    await pool.query(
      `UPDATE design_payment_history SET finance_handling_mode = 'AUTO_APPROVED' WHERE attempt_id = ?`,
      [attempt.id],
    );
    await applyDesignAutoApprove(deps, attempt.lead_id, bucket, amount, {
      collected,
      target,
      extraPaid,
      attemptId: attempt.id,
      gatewayPaymentId: gid || undefined,
    });
    autoApproved = true;
  } else {
    await pool.query(
      `UPDATE design_payment_history SET finance_handling_mode = 'PARTIAL' WHERE attempt_id = ?`,
      [attempt.id],
    );
    await applyPartialPaymentRecorded(deps, attempt.lead_id, bucket, amount, collected, target, remaining);
  }

  await pool.query(
    `UPDATE design_payment_link_attempts
     SET is_active = 0, status = IF(status IN ('PENDING','CREATED_NOT_DELIVERED'), 'SUPERSEDED', status), updated_at = ?
     WHERE lead_id = ? AND bucket = ? AND id <> ? AND is_active = 1 AND status <> 'PAID'`,
    [now, attempt.lead_id, bucket, attempt.id],
  );
  return { ok: true, autoApproved };
}

async function applyFailureAttempt(deps: Deps, attempt: AttemptRow, status: string, reason: string): Promise<void> {
  if (attempt.status === "PAID" || attempt.status === "CANCELLED") return;
  const reasonText = (reason || status).slice(0, 500);
  const prevAt = attempt.updated_at ? new Date(attempt.updated_at).getTime() : 0;
  const sameRecentFailure =
    Number(attempt.failure_count) > 0 &&
    String(attempt.last_failure_reason || "") === reasonText &&
    Number.isFinite(prevAt) &&
    Date.now() - prevAt < 120_000;
  if (sameRecentFailure) return;
  const now = new Date();
  await deps.pool.query(
    `UPDATE design_payment_link_attempts
     SET failure_count = failure_count + 1, last_failure_reason = ?, status = 'PENDING', is_active = 1, updated_at = ?
     WHERE id = ? AND status <> 'PAID'`,
    [reasonText, now, attempt.id],
  );
  await history(
    deps,
    attempt.lead_id,
    attempt.bucket,
    `Customer Easebuzz pay failed (${status || "failed"}). Link still open for retry.`,
    { kind: "DESIGN_PAYMENT_FAILED", reason: reasonText, userName: "SYSTEM · Easebuzz" },
  );
}

const lastGatewayCheckAt = new Map<string, number>();
const GATEWAY_CHECK_DEBOUNCE_MS = 1_500;

/** Ask Easebuzz directly so Design does not wait for CRM webhook / CRM page refresh. */
async function refreshAttemptFromGateway(deps: Deps, attempt: AttemptRow, force = false): Promise<void> {
  if (!easebuzzConfigured() || !attempt.merchant_txn) return;
  if (String(attempt.status).toUpperCase() === "PAID") return;
  const txn = attempt.merchant_txn;
  const now = Date.now();
  const prev = lastGatewayCheckAt.get(txn) || 0;
  if (!force && now - prev < GATEWAY_CHECK_DEBOUNCE_MS) return;
  lastGatewayCheckAt.set(txn, now);
  const st = await retrieveEasebuzzTxn(txn);
  if (st.success) {
    await applyPaidAttempt(
      deps,
      attempt,
      st.paymentId || txn,
      st.mode || "Easebuzz",
      st.amount ?? Number(attempt.amount),
    );
  } else if (st.failure) {
    await applyFailureAttempt(deps, attempt, st.status, st.status);
  }
}

async function deactivateQuietly(attempt: AttemptRow): Promise<void> {
  await deactivateEasebuzzPaymentLink({
    merchantTxn: attempt.merchant_txn,
    name: attempt.customer_name || "Customer",
    email: attempt.customer_email || "noreply@hubinterior.com",
    phone: attempt.customer_phone || "0000000000",
    amount: Number(attempt.amount),
    message: `HUB design deactivate ${attempt.merchant_txn}`,
    udf1: "DESIGN",
    udf2: String(attempt.lead_id),
  });
}

export function registerDesignPaymentRoutes(app: Express, deps: Deps): void {
  const { pool, getUserFromSession } = deps;

  const requireEasebuzzAdmin = async (req: Request, res: Response): Promise<SessionUser | null> => {
    const user = await getUserFromSession(req);
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return null;
    }
    if (!isEasebuzzAdmin(user)) {
      res.status(403).json({ message: "Only super admin can manage Easebuzz payment links." });
      return null;
    }
    return user;
  };

  void ensureDesignPaymentTables(pool)
    .then(() => {
      const requested = Number(envTrim("DESIGN_PAYMENT_RECONCILE_MS") || 3_000) || 3_000;
      const ms = Math.min(5_000, Math.max(2_000, requested));
      void reconcilePending(deps).catch((err) => console.warn("[design-payment] reconcile", err));
      setInterval(() => {
        void reconcilePending(deps).catch((err) => console.warn("[design-payment] reconcile", err));
      }, ms);
    })
    .catch((err) => console.error("[design-payment] ensure tables failed", err));

  const webhookHandler = async (req: Request, res: Response) => {
    if (!webhookKeyOk(req)) {
      return res.status(401).json({ ok: false, message: "Invalid API key" });
    }
    try {
      const body = flattenWebhookBody({ ...(req.body || {}), ...(req.query || {}) } as Record<string, unknown>);
      const txn = pickStr(
        body.merchant_txn,
        body.merchanttxn,
        body.txnid,
        body.txn_id,
        body.txnId,
      );
      const status = pickStr(body.status, body.txn_status, body.txnstatus);
      if (!txn) {
        return res.json({ ok: true, ignored: true, reason: "missing_txn" });
      }
      if (!isDesignMerchantTxn(txn)) {
        return res.json({ ok: true, ignored: true, reason: "not_design_txn" });
      }
      const attempt = await findAttemptByTxn(pool, txn);
      if (!attempt) {
        return res.json({ ok: true, ignored: true, reason: "attempt_not_found", merchantTxn: txn });
      }
      if (isGatewayFailure(status)) {
        await applyFailureAttempt(
          deps,
          attempt,
          status,
          pickStr(body.error, body.error_message, body.error_msg, body.msg, body.mode, status),
        );
        return res.json({ ok: true, result: "failure_recorded", attemptId: attempt.id });
      }
      if (!isGatewaySuccess(status)) {
        return res.json({ ok: true, ignored: true, reason: "non_final_status", status: status || "empty" });
      }
      const paid = await applyPaidAttempt(
        deps,
        attempt,
        pickStr(body.easepayid, body.easebuzz_id, body.gatewayPaymentId, body.gateway_payment_id, txn),
        pickStr(body.mode, body.payment_method, "Easebuzz"),
        pickNum(body.amount) ?? Number(attempt.amount),
      );
      return res.json({ ok: true, result: "paid", idempotent: paid.idempotent, attemptId: attempt.id, leadId: attempt.lead_id });
    } catch (err) {
      console.error("[design-payment] webhook error", err);
      return res.status(500).json({ ok: false, message: "Failed to apply webhook" });
    }
  };

  app.post("/api/crm/design-payment/easebuzz-webhook", webhookHandler);
  app.post("/api/hub/design-payment/easebuzz-webhook", webhookHandler);
  app.post("/api/hub/design-payment/easebuzz-paid", webhookHandler);

  app.get("/api/design-payment/cases/:leadId/summary", async (req: Request, res: Response) => {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const leadId = Number(req.params.leadId);
    if (!Number.isFinite(leadId)) return res.status(400).json({ message: "Invalid lead id" });
    try {
      await upsertSummaryFromBreakdown(pool, leadId);
      const synced = await syncCollectedFromHistory(pool, leadId);
      const attempt = await findActiveAttempt(pool, leadId);
      const d10Target = synced.d10Target;
      const d10Collected = synced.d10Collected;
      const d40Target = synced.d40Target;
      const d40Collected = synced.d40Collected;
      const d10Remaining = synced.d10Remaining;
      const d40Remaining = synced.d40Remaining;
      const d10Done = d10Remaining <= 0 && d10Target > 0;
      const row = await getSummaryRow(pool, leadId);
      return res.json({
        caseId: String(leadId),
        quoteAmount: Number(row?.quote_amount) || null,
        cumulativePaidPercent: Number(row?.cumulative_paid_percent) || 10,
        canStartDesignWork: Number(row?.cumulative_paid_percent) >= 20,
        canCollectDesign10: !d10Done,
        canCollectDesign40: d10Done && d40Remaining > 0,
        buckets: [
          {
            code: "DESIGN_10",
            label: "Design kickoff 10%",
            targetAmount: d10Target,
            collectedAmount: d10Collected,
            remainingAmount: d10Remaining,
            extraPaidAmount: synced.d10Extra,
            cumulativeTargetPercent: 20,
            status: d10Done ? "PAID" : d10Collected > 0 ? "PARTIAL" : "OPEN",
            financeMode: row?.design_10_finance_mode || null,
          },
          {
            code: "DESIGN_40",
            label: "Mid-design 40%",
            targetAmount: d40Target,
            collectedAmount: d40Collected,
            remainingAmount: d40Remaining,
            extraPaidAmount: synced.d40Extra,
            cumulativeTargetPercent: 60,
            status: !d10Done ? "LOCKED" : d40Remaining <= 0 ? "PAID" : d40Collected > 0 ? "PARTIAL" : "OPEN",
            financeMode: row?.design_40_finance_mode || null,
          },
        ],
        activePaymentLink: isEasebuzzAdmin(user) ? mapAttempt(attempt) : null,
      });
    } catch (err) {
      console.error("[design-payment] summary error", err);
      return res.status(500).json({ message: "Failed to load summary" });
    }
  });

  app.get("/api/design-payment/cases/:leadId/payment-history", async (req: Request, res: Response) => {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const leadId = Number(req.params.leadId);
    const [rows] = await pool.query(
      `SELECT id, bucket, amount, quote_amount as quoteAmount, attempt_id as attemptId,
              gateway_payment_id as gatewayPaymentId, payment_channel as paymentChannel,
              payment_method as paymentMethod, source, finance_handling_mode as financeHandlingMode,
              notes, created_at as createdAt
       FROM design_payment_history WHERE lead_id = ? ORDER BY created_at DESC`,
      [leadId],
    );
    return res.json({ ok: true, rows });
  });

  app.get("/api/design-payment/cases/:leadId/payment-links/active", async (req: Request, res: Response) => {
    const user = await requireEasebuzzAdmin(req, res);
    if (!user) return;
    const leadId = Number(req.params.leadId);
    const pending = await findActiveAttempt(pool, leadId);
    if (pending) {
      await refreshAttemptFromGateway(deps, pending);
    }
    const attempt = await findActiveAttempt(pool, leadId);
    const recentlyPaid = await findRecentlyPaidAttempt(pool, leadId);
    return res.json({
      success: true,
      attempt: mapAttempt(attempt),
      recentlyPaid: recentlyPaid
        ? {
            id: recentlyPaid.id,
            bucket: recentlyPaid.bucket,
            amount: Number(recentlyPaid.amount),
            paidAt: recentlyPaid.paid_at,
            status: "PAID",
          }
        : null,
    });
  });

  app.post("/api/design-payment/cases/:leadId/payment-links", async (req: Request, res: Response) => {
    const user = await requireEasebuzzAdmin(req, res);
    if (!user) return;
    const leadId = Number(req.params.leadId);
    if (!Number.isFinite(leadId)) return res.status(400).json({ message: "Invalid lead id" });
    try {
      if (!easebuzzConfigured()) {
        return res.status(503).json({
          message: "Easebuzz is not configured on Design. Set EASEBUZZ_KEY and EASEBUZZ_SALT, or use Offline proof.",
        });
      }
      const body = (req.body || {}) as Record<string, unknown>;
      const bucket = normalizeBucket(pickStr(body.bucket, "DESIGN_10"));
      const existing = await findActiveAttempt(pool, leadId);
      if (existing) {
        return res.status(409).json({
          error: "PAYMENT_LINK_ACTIVE",
          message: "An unpaid payment link is already active.",
          attempt: mapAttempt(existing),
        });
      }
      await upsertSummaryFromBreakdown(pool, leadId);
      const summary = await getSummaryRow(pool, leadId);
      const contact = await loadLeadContact(pool, leadId);
      if (!contact.email) {
        return res.status(400).json({
          message: "Customer email is required. Design payment links are sent by email only.",
        });
      }
      let amount = pickNum(body.amount);
      const remainingDefault =
        bucket === "DESIGN_40"
          ? Math.max(0, Number(summary?.design_40_target || 0) - Number(summary?.design_40_collected || 0))
          : Math.max(0, Number(summary?.design_10_target || 0) - Number(summary?.design_10_collected || 0));
      // Designer may set less (partial) or more (extra advance) than remaining.
      if (amount == null || amount <= 0) {
        amount = remainingDefault;
      }
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Nothing remaining to collect for this bucket." });
      }

      const merchantTxn = newDesignMerchantTxn(bucket);
      const created = await createEasebuzzPaymentLink({
        merchantTxn,
        name: pickStr(body.customerName, contact.name),
        email: pickStr(body.customerEmail, contact.email),
        phone: pickStr(body.customerPhone, contact.phone),
        amount,
        message: `HUB design ${bucket} ${contact.pid}`,
        udf1: "DESIGN",
        udf2: String(leadId),
      });
      if (!created.ok) {
        return res.status(503).json({ message: created.error || "Easebuzz create-link failed. Use Offline proof." });
      }

      const now = new Date();
      const ttlHours = Math.max(1, Number(envTrim("EASEBUZZ_LINK_TTL_HOURS") || 24) || 24);
      const id = randomUUID();
      await pool.query(
        `INSERT INTO design_payment_link_attempts
         (id, lead_id, bucket, merchant_txn, amount, quote_amount, payment_link_url, status, is_active,
          customer_name, customer_email, customer_phone, email_status, created_by_name, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 1, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
        [
          id,
          leadId,
          bucket,
          merchantTxn,
          amount,
          pickNum(body.quoteAmount, summary?.quote_amount),
          created.paymentUrl,
          contact.name,
          contact.email,
          contact.phone || null,
          user.name || "Designer",
          new Date(now.getTime() + ttlHours * 3600 * 1000),
          now,
          now,
        ],
      );

      await history(
        deps,
        leadId,
        bucket,
        `Online payment link created (₹${Math.round(amount).toLocaleString("en-IN")}).`,
        { kind: "DESIGN_PAYMENT_LINK_SENT", userName: user.name || "Designer", merchantTxn, amount },
      );

      let emailed = false;
      if (deps.triggerMailRouteWithLog) {
        const is40 = bucket === "DESIGN_40";
        try {
          const result = await deps.triggerMailRouteWithLog({
            leadId,
            milestoneIndex: is40 ? 5 : 2,
            taskName: is40 ? "40% collection" : "10% payment collection",
            route: is40
              ? "/api/email/send-design-signoff-40pc-payment-request"
              : "/api/email/send-ten-percent-payment-request",
            visibility: "external",
            payload: {
              to: contact.email,
              customerName: contact.name,
              projectId: contact.pid,
              amountDue: `₹${Math.round(amount).toLocaleString("en-IN")}`,
              paymentLink: created.paymentUrl,
            },
          });
          emailed = result === true;
        } catch (mailErr) {
          console.error("[design-payment] create-link mail error", mailErr);
          emailed = false;
        }
      }

      await pool.query(`UPDATE design_payment_link_attempts SET email_status = ?, updated_at = ? WHERE id = ?`, [
        emailed ? "SENT" : "FAILED",
        now,
        id,
      ]);

      if (emailed) {
        await history(
          deps,
          leadId,
          bucket,
          `Payment link emailed (₹${Math.round(amount).toLocaleString("en-IN")}).`,
          { kind: "DESIGN_PAYMENT_LINK_EMAILED", userName: user.name || "Designer", merchantTxn, amount },
        );
      } else {
        await history(
          deps,
          leadId,
          bucket,
          `Payment link created but email failed. Use Resend email.`,
          { kind: "DESIGN_PAYMENT_LINK_EMAIL_FAILED", userName: user.name || "Designer", merchantTxn, amount },
        );
      }

      const attempt = await findAttemptByTxn(pool, merchantTxn);
      return res.json({
        success: true,
        attempt: mapAttempt(attempt),
        emailSent: emailed,
        message: emailed
          ? undefined
          : "Payment link created, but the customer email failed to send. Use Resend email.",
      });
    } catch (err) {
      console.error("[design-payment] create link error", err);
      return res.status(500).json({ message: "Failed to create payment link" });
    }
  });

  const loadAttempt = async (attemptId: string) => {
    const [rows] = await pool.query(`SELECT * FROM design_payment_link_attempts WHERE id = ? LIMIT 1`, [attemptId]);
    return ((rows as AttemptRow[])[0] as AttemptRow) || null;
  };

  app.post("/api/design-payment/payment-links/:attemptId/copy", async (req: Request, res: Response) => {
    const user = await requireEasebuzzAdmin(req, res);
    if (!user) return;
    const attempt = await loadAttempt(String(req.params.attemptId));
    if (!attempt || !attempt.is_active) return res.status(400).json({ message: "No active pending payment link." });
    await history(deps, attempt.lead_id, attempt.bucket, "Payment link copied.", {
      kind: "DESIGN_PAYMENT_LINK_COPIED",
      userName: user.name || "Designer",
    });
    return res.json({ success: true, attempt: mapAttempt(attempt) });
  });

  app.post("/api/design-payment/payment-links/:attemptId/resend", async (req: Request, res: Response) => {
    const user = await requireEasebuzzAdmin(req, res);
    if (!user) return;
    const old = await loadAttempt(String(req.params.attemptId));
    if (!old || !old.is_active) return res.status(400).json({ message: "No active pending payment link." });
    if (!old.customer_email) return res.status(400).json({ message: "Customer email missing." });

    let emailed = false;
    if (deps.triggerMailRouteWithLog) {
      const is40 = old.bucket === "DESIGN_40";
      try {
        const result = await deps.triggerMailRouteWithLog({
          leadId: old.lead_id,
          milestoneIndex: is40 ? 5 : 2,
          taskName: is40 ? "40% collection" : "10% payment collection",
          route: is40
            ? "/api/email/send-design-signoff-40pc-payment-request"
            : "/api/email/send-ten-percent-payment-request",
          visibility: "external",
          payload: {
            to: old.customer_email,
            customerName: old.customer_name,
            amountDue: `₹${Math.round(Number(old.amount)).toLocaleString("en-IN")}`,
            paymentLink: old.payment_link_url,
          },
        });
        emailed = result === true;
      } catch (mailErr) {
        console.error("[design-payment] resend mail error", mailErr);
        emailed = false;
      }
    }

    const now = new Date();
    await pool.query(`UPDATE design_payment_link_attempts SET email_status = ?, updated_at = ? WHERE id = ?`, [
      emailed ? "SENT" : "FAILED",
      now,
      old.id,
    ]);

    await history(
      deps,
      old.lead_id,
      old.bucket,
      emailed ? "Payment link resent by email." : "Payment link resend failed. Try again.",
      {
        kind: emailed ? "DESIGN_PAYMENT_LINK_RESENT" : "DESIGN_PAYMENT_LINK_EMAIL_FAILED",
        userName: user.name || "Designer",
      },
    );

    const refreshed = await loadAttempt(String(req.params.attemptId));
    return res.json({
      success: emailed,
      attempt: mapAttempt(refreshed || old),
      paymentLinkUrl: old.payment_link_url,
      emailSent: emailed,
      message: emailed ? undefined : "Email failed to send. Check SMTP / FRONTEND_BASE_URL and try Resend again.",
    });
  });

  app.post("/api/design-payment/payment-links/:attemptId/edit", async (req: Request, res: Response) => {
    const user = await requireEasebuzzAdmin(req, res);
    if (!user) return;
    const old = await loadAttempt(String(req.params.attemptId));
    if (!old || !old.is_active) return res.status(400).json({ message: "No active pending payment link." });
    const amount = pickNum((req.body as Record<string, unknown>)?.amount);
    if (!amount || amount <= 0) return res.status(400).json({ message: "amount must be greater than 0." });
    if (!easebuzzConfigured()) {
      return res.status(503).json({ message: "Easebuzz is not configured. Use Offline proof." });
    }
    const bucket = normalizeBucket(old.bucket);
    const merchantTxn = newDesignMerchantTxn(bucket);
    const created = await createEasebuzzPaymentLink({
      merchantTxn,
      name: old.customer_name || "Customer",
      email: old.customer_email || "",
      phone: old.customer_phone || "",
      amount,
      message: `HUB design ${bucket} ${old.lead_id}`,
      udf1: "DESIGN",
      udf2: String(old.lead_id),
    });
    if (!created.ok) {
      return res.status(503).json({ message: created.error || "Easebuzz create-link failed. Previous link is still active." });
    }
    const now = new Date();
    const ttlHours = Math.max(1, Number(envTrim("EASEBUZZ_LINK_TTL_HOURS") || 24) || 24);
    const id = randomUUID();
    await pool.query(
      `INSERT INTO design_payment_link_attempts
       (id, lead_id, bucket, merchant_txn, amount, quote_amount, payment_link_url, status, is_active,
        customer_name, customer_email, customer_phone, email_status, created_by_name, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 1, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
      [
        id,
        old.lead_id,
        bucket,
        merchantTxn,
        amount,
        old.quote_amount,
        created.paymentUrl,
        old.customer_name,
        old.customer_email,
        old.customer_phone,
        user.name || "Designer",
        new Date(now.getTime() + ttlHours * 3600 * 1000),
        now,
        now,
      ],
    );
    await pool.query(
      `UPDATE design_payment_link_attempts SET status = 'SUPERSEDED', is_active = 0, updated_at = ? WHERE id = ?`,
      [now, old.id],
    );
    void deactivateQuietly(old);

    let emailed = false;
    if (old.customer_email && deps.triggerMailRouteWithLog) {
      const is40 = bucket === "DESIGN_40";
      try {
        const result = await deps.triggerMailRouteWithLog({
          leadId: old.lead_id,
          milestoneIndex: is40 ? 5 : 2,
          taskName: is40 ? "40% collection" : "10% payment collection",
          route: is40
            ? "/api/email/send-design-signoff-40pc-payment-request"
            : "/api/email/send-ten-percent-payment-request",
          visibility: "external",
          payload: {
            to: old.customer_email,
            customerName: old.customer_name,
            amountDue: `₹${Math.round(amount).toLocaleString("en-IN")}`,
            paymentLink: created.paymentUrl,
          },
        });
        emailed = result === true;
      } catch (mailErr) {
        console.error("[design-payment] edit-link mail error", mailErr);
        emailed = false;
      }
    }
    await pool.query(`UPDATE design_payment_link_attempts SET email_status = ?, updated_at = ? WHERE id = ?`, [
      emailed ? "SENT" : "FAILED",
      now,
      id,
    ]);

    await history(
      deps,
      old.lead_id,
      bucket,
      emailed
        ? `Payment link updated to ₹${Math.round(amount).toLocaleString("en-IN")} and emailed.`
        : `Payment link updated to ₹${Math.round(amount).toLocaleString("en-IN")}. Email failed — use Resend.`,
      { kind: "DESIGN_PAYMENT_LINK_EDITED", userName: user.name || "Designer", amount },
    );
    const attempt = await findAttemptByTxn(pool, merchantTxn);
    return res.json({
      success: true,
      attempt: mapAttempt(attempt),
      emailSent: emailed,
      message: emailed ? undefined : "Link updated, but email failed to send. Use Resend email.",
    });
  });

  app.post("/api/design-payment/payment-links/:attemptId/cancel", async (req: Request, res: Response) => {
    const user = await requireEasebuzzAdmin(req, res);
    if (!user) return;
    const attempt = await loadAttempt(String(req.params.attemptId));
    if (!attempt || !attempt.is_active) return res.status(400).json({ message: "No active pending payment link." });
    await deactivateQuietly(attempt);
    await pool.query(
      `UPDATE design_payment_link_attempts SET status = 'CANCELLED', is_active = 0, updated_at = ? WHERE id = ?`,
      [new Date(), attempt.id],
    );
    await history(deps, attempt.lead_id, attempt.bucket, "Online payment link cancelled.", {
      kind: "DESIGN_PAYMENT_LINK_CANCELLED",
      userName: user.name || "Designer",
    });
    return res.json({ success: true, attempt: mapAttempt({ ...attempt, status: "CANCELLED", is_active: 0 }) });
  });

  app.post("/api/design-payment/payment-links/:attemptId/switch-offline", async (req: Request, res: Response) => {
    const user = await requireEasebuzzAdmin(req, res);
    if (!user) return;
    const attempt = await loadAttempt(String(req.params.attemptId));
    if (!attempt || !attempt.is_active) return res.status(400).json({ message: "No active pending payment link." });
    await deactivateQuietly(attempt);
    await pool.query(
      `UPDATE design_payment_link_attempts SET status = 'CANCELLED', is_active = 0, updated_at = ? WHERE id = ?`,
      [new Date(), attempt.id],
    );
    await history(deps, attempt.lead_id, attempt.bucket, "Switched from Online Easebuzz to Offline proof.", {
      kind: "DESIGN_PAYMENT_SWITCH_OFFLINE",
      userName: user.name || "Designer",
    });
    return res.json({ success: true, switched: true });
  });

  app.get("/api/design-payment/finance-queue", async (req: Request, res: Response) => {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = String(user.role || "").toLowerCase();
    if (role !== "finance" && role !== "admin") {
      return res.status(403).json({ message: "Finance only" });
    }
    const bucket = pickStr(req.query.bucket, "DESIGN_10").toUpperCase();
    const section = pickStr(req.query.section, "AUTO_APPROVED").toUpperCase();
    const modeCol = bucket.startsWith("DESIGN_40") ? "design_40_finance_mode" : "design_10_finance_mode";
    const approvedCol = bucket.startsWith("DESIGN_40") ? "design_40_approved_at" : "design_10_approved_at";
    if (section !== "AUTO_APPROVED") return res.json([]);
    const [rows] = await pool.query(
      `SELECT s.lead_id as id, l.project_name as projectName, s.${modeCol} as financeHandlingMode,
              s.${approvedCol} as approvedAt, 'AUTO_APPROVED' as status, 0 as canApprove
       FROM design_payment_case_summary s
       JOIN leads l ON l.id = s.lead_id
       WHERE s.${modeCol} = 'AUTO_APPROVED'
       ORDER BY s.${approvedCol} DESC
       LIMIT 200`,
    );
    return res.json(rows);
  });
}

async function reconcilePending(deps: Deps): Promise<void> {
  if (!easebuzzConfigured()) return;
  const [rows] = await deps.pool.query(
    `SELECT * FROM design_payment_link_attempts
     WHERE is_active = 1 AND status IN ('PENDING', 'CREATED_NOT_DELIVERED')
       AND created_at < DATE_SUB(NOW(), INTERVAL 2 SECOND)
     ORDER BY created_at ASC LIMIT 40`,
  );
  for (const attempt of rows as AttemptRow[]) {
    await refreshAttemptFromGateway(deps, attempt, true);
  }
}
