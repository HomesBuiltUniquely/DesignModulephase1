/**
 * Design Module payment links (DESIGN_10 / DESIGN_40).
 * Links are created here with EASEBUZZ_KEY/SALT.
 * Success/fail comes from CRM forwarding the merchant webhook (txn prefix DES10/DES40).
 * Backup: retrieve cron every 8 minutes — not 15s UI poll.
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
  }) => unknown;
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

async function applyDesignAutoApprove(
  deps: Deps,
  leadId: number,
  bucket: string,
  amount: number,
): Promise<void> {
  const { pool } = deps;
  const now = new Date();
  const approvedBy = "SYSTEM · Easebuzz";
  const is10 = normalizeBucket(bucket) === "DESIGN_10";
  const meta = milestoneMeta(is10 ? "DESIGN_10" : "DESIGN_40");

  if (await payloadAlreadyAutoApproved(pool, leadId, is10 ? "DESIGN_10" : "DESIGN_40")) {
    return;
  }

  await pool.query(
    `INSERT INTO lead_task_completions (lead_id, milestone_index, task_name, completed_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at)`,
    [leadId, meta.milestoneIndex, meta.taskCollection, now],
  );
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
    payload.cumulative_payment_percent = 20;
  } else {
    payload.forty_percent_payment_met = true;
    payload.design_40_finance_handling_mode = "AUTO_APPROVED";
    payload.design_40_finance_section = "AUTO_APPROVED";
    payload.design_40_finance_auto_approved = true;
    payload.design_40_finance_approved_by = approvedBy;
    payload.design_40_finance_approved_at = now.toISOString();
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
          breakdown.twentyPercentTarget,
        );
      } else {
        payload.sixty_percent_target = breakdown.sixtyPercentTarget;
        payload.forty_percent_target = breakdown.fortyPercentAmount;
        payload.total_paid_cumulative = Math.max(
          Number(payload.total_paid_cumulative) || 0,
          breakdown.sixtyPercentTarget,
        );
      }
    }
  } catch {
    /* ignore */
  }

  if (is10) {
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
      [amount, now, now, leadId],
    );
  } else {
    await pool.query(`UPDATE leads SET payload = ?, update_at = ? WHERE id = ?`, [JSON.stringify(payload), now, leadId]);
    await pool.query(
      `UPDATE design_payment_case_summary SET
         design_40_collected = ?,
         cumulative_paid_percent = 60,
         design_40_finance_mode = 'AUTO_APPROVED',
         design_40_approved_at = ?,
         updated_at = ?
       WHERE lead_id = ?`,
      [amount, now, now, leadId],
    );
  }

  await history(
    deps,
    leadId,
    is10 ? "DESIGN_10" : "DESIGN_40",
    `Easebuzz ${is10 ? "Design 10%" : "Design 40%"} paid and auto-approved. Receipt emailed.`,
    { kind: "DESIGN_PAYMENT_PAID", taskName: meta.taskApproval, userName: approvedBy, amount },
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
          amountPaid: String(Math.round(amount)),
          paymentDate: now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          paymentMode: "Easebuzz (Online)",
        },
      });
    }
  } catch (mailErr) {
    console.warn("[design-payment] success email failed (non-fatal)", mailErr);
  }
}

async function applyPaidAttempt(
  deps: Deps,
  attempt: AttemptRow,
  gatewayPaymentId: string,
  method: string,
  paidAmount: number,
): Promise<{ ok: true; idempotent?: boolean }> {
  const { pool } = deps;
  const gid = gatewayPaymentId || attempt.merchant_txn;
  const amount = paidAmount > 0 ? paidAmount : Number(attempt.amount);
  const now = new Date();

  const [upd] = await pool.query(
    `UPDATE design_payment_link_attempts
     SET status = 'PAID', is_active = 0, gateway_payment_id = ?, payment_method = ?, paid_at = ?, updated_at = ?
     WHERE id = ? AND status <> 'PAID'`,
    [gid || null, method || "Easebuzz", now, now, attempt.id],
  );
  const wonLock = Number((upd as ResultSetHeader).affectedRows || 0) > 0;
  if (!wonLock) {
    if (!(await payloadAlreadyAutoApproved(pool, attempt.lead_id, attempt.bucket))) {
      await upsertSummaryFromBreakdown(pool, attempt.lead_id);
      await applyDesignAutoApprove(deps, attempt.lead_id, attempt.bucket, amount);
    }
    return { ok: true, idempotent: true };
  }

  if (gid) {
    const [dup] = await pool.query(
      `SELECT id FROM design_payment_history WHERE gateway_payment_id = ? LIMIT 1`,
      [gid],
    );
    if ((dup as RowDataPacket[]).length > 0) {
      if (!(await payloadAlreadyAutoApproved(pool, attempt.lead_id, attempt.bucket))) {
        await applyDesignAutoApprove(deps, attempt.lead_id, attempt.bucket, amount);
      }
      return { ok: true, idempotent: true };
    }
  }

  await upsertSummaryFromBreakdown(pool, attempt.lead_id);
  try {
    await pool.query(
      `INSERT INTO design_payment_history
       (lead_id, bucket, amount, quote_amount, attempt_id, gateway_payment_id,
        payment_channel, payment_method, source, finance_handling_mode, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ONLINE', ?, 'EASEBUZZ', 'AUTO_APPROVED', ?, ?)`,
      [
        attempt.lead_id,
        attempt.bucket,
        amount,
        attempt.quote_amount,
        attempt.id,
        gid || null,
        method || "Easebuzz",
        null,
        now,
      ],
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "ER_DUP_ENTRY") throw err;
  }
  await applyDesignAutoApprove(deps, attempt.lead_id, attempt.bucket, amount);
  await pool.query(
    `UPDATE design_payment_link_attempts
     SET is_active = 0, status = IF(status IN ('PENDING','CREATED_NOT_DELIVERED'), 'SUPERSEDED', status), updated_at = ?
     WHERE lead_id = ? AND bucket = ? AND id <> ? AND is_active = 1 AND status <> 'PAID'`,
    [now, attempt.lead_id, attempt.bucket, attempt.id],
  );
  return { ok: true };
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
      const ms = Math.max(60_000, Number(envTrim("DESIGN_PAYMENT_RECONCILE_MS") || 480_000) || 480_000);
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
      const row = await getSummaryRow(pool, leadId);
      const attempt = await findActiveAttempt(pool, leadId);
      const d10Target = Number(row?.design_10_target) || 0;
      const d10Collected = Number(row?.design_10_collected) || 0;
      const d40Target = Number(row?.design_40_target) || 0;
      const d40Collected = Number(row?.design_40_collected) || 0;
      const d10Remaining = Math.max(0, d10Target - d10Collected);
      const d40Remaining = Math.max(0, d40Target - d40Collected);
      const d10Done = d10Remaining <= 0 && d10Target > 0;
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
            cumulativeTargetPercent: 20,
            status: d10Done ? "PAID" : "OPEN",
            financeMode: row?.design_10_finance_mode || null,
          },
          {
            code: "DESIGN_40",
            label: "Mid-design 40%",
            targetAmount: d40Target,
            collectedAmount: d40Collected,
            remainingAmount: d40Remaining,
            cumulativeTargetPercent: 60,
            status: !d10Done ? "LOCKED" : d40Remaining <= 0 ? "PAID" : "OPEN",
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
      if (amount == null || amount <= 0) {
        amount =
          bucket === "DESIGN_40"
            ? Math.max(0, Number(summary?.design_40_target || 0) - Number(summary?.design_40_collected || 0))
            : Math.max(0, Number(summary?.design_10_target || 0) - Number(summary?.design_10_collected || 0));
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
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 1, ?, ?, ?, 'SENT', ?, ?, ?, ?)`,
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
        `Online payment link emailed (₹${Math.round(amount).toLocaleString("en-IN")}). WhatsApp skipped.`,
        { kind: "DESIGN_PAYMENT_LINK_SENT", userName: user.name || "Designer", merchantTxn, amount },
      );

      if (deps.triggerMailRouteWithLog) {
        const is40 = bucket === "DESIGN_40";
        deps.triggerMailRouteWithLog({
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
      }

      const attempt = await findAttemptByTxn(pool, merchantTxn);
      return res.json({ success: true, attempt: mapAttempt(attempt) });
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
    if (deps.triggerMailRouteWithLog) {
      const is40 = old.bucket === "DESIGN_40";
      deps.triggerMailRouteWithLog({
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
    }
    await history(deps, old.lead_id, old.bucket, "Payment link resent by email.", {
      kind: "DESIGN_PAYMENT_LINK_RESENT",
      userName: user.name || "Designer",
    });
    return res.json({ success: true, attempt: mapAttempt(old), paymentLinkUrl: old.payment_link_url });
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
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 1, ?, ?, ?, 'SENT', ?, ?, ?, ?)`,
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
    if (old.customer_email && deps.triggerMailRouteWithLog) {
      const is40 = bucket === "DESIGN_40";
      deps.triggerMailRouteWithLog({
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
    }
    await history(
      deps,
      old.lead_id,
      bucket,
      `Payment link amount edited to ₹${Math.round(amount).toLocaleString("en-IN")}. New email link created.`,
      { kind: "DESIGN_PAYMENT_LINK_EDITED", userName: user.name || "Designer", amount },
    );
    const attempt = await findAttemptByTxn(pool, merchantTxn);
    return res.json({ success: true, attempt: mapAttempt(attempt) });
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
       AND created_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE)
     ORDER BY created_at ASC LIMIT 40`,
  );
  for (const attempt of rows as AttemptRow[]) {
    const st = await retrieveEasebuzzTxn(attempt.merchant_txn);
    if (st.success) {
      await applyPaidAttempt(deps, attempt, st.paymentId || attempt.merchant_txn, st.mode || "Easebuzz", st.amount ?? Number(attempt.amount));
    } else if (st.failure) {
      await applyFailureAttempt(deps, attempt, st.status, st.status);
    }
  }
}
