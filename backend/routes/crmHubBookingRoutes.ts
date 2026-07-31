/**
 * CRM Booking & Token → Design Module hub sync + finance queue.
 */
import fs from "fs";
import path from "path";
import type { Express, Request, Response, NextFunction } from "express";
import type { Pool } from "mysql2/promise";

const HUB_PROOFS_DIR = path.join(process.cwd(), "uploads", "hub-payment-proofs");

type SessionUser = {
  id: number;
  email?: string;
  name?: string;
  role?: string;
} | null;

type RouteDeps = {
  pool: Pool;
  getUserFromSession: (req: Request) => Promise<SessionUser>;
  addLeadHistoryEvent: (leadId: number, event: Record<string, unknown>) => Promise<void>;
};

function envTrim(name: string): string {
  return (process.env[name] || "").trim();
}

function expectedHubApiKey(): string {
  return envTrim("EXTERNAL_LEAD_INGEST_API_KEY") || envTrim("HUB_SYNC_API_KEY") || "hi";
}

function parseHubApiKey(req: Request): string {
  const xApiKey = String(req.headers["x-api-key"] || "").trim();
  if (xApiKey) return xApiKey;
  const xExternal = String(req.headers["x-external-api-key"] || "").trim();
  if (xExternal) return xExternal;
  return String(req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function requireHubApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = expectedHubApiKey();
  const provided = parseHubApiKey(req);
  if (!provided || provided !== expected) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

function parseLeadPayload(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function pickStr(...values: unknown[]): string {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function pickNum(...values: unknown[]): number | null {
  for (const v of values) {
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

type HubLeadBody = Record<string, unknown>;

type BookingFinanceSyncMode = "FULL_10" | "BUFFER_9_9";

type ResolvedBookingFinance = {
  mode: BookingFinanceSyncMode;
  quoteAmount: number | null;
  tenPercentAmount: number | null;
  bufferThresholdAmount: number | null;
  /** Amount credited toward the 10% milestone (excludes finance extra). */
  amountToward10: number;
  remainingAmount: number;
  shortfallAmount: number;
  extraAmountReceived: number;
  totalAmountReceived: number;
  bufferApplied: boolean;
  financeBufferNote: string;
};

function roundMoney(n: number): number {
  return Math.round(n);
}

/**
 * Resolve FULL_10 vs BUFFER_9_9 from CRM convert payload.
 * Accepts explicit bookingApprovalMode, or infers from paid vs 9.9%/10% thresholds.
 */
function resolveBookingFinanceSync(body: HubLeadBody): ResolvedBookingFinance {
  const quoteAmount = pickNum(body.quoteAmount, body.quote_amount, body.quotationTotal, body.quotation_total);
  const tenPercentAmount =
    pickNum(body.tenPercentAmount, body.ten_percent_amount) ??
    (quoteAmount != null && quoteAmount > 0 ? roundMoney(quoteAmount * 0.1) : null);
  const bufferThresholdAmount =
    pickNum(body.bufferThresholdAmount, body.buffer_threshold_amount) ??
    (quoteAmount != null && quoteAmount > 0 ? roundMoney(quoteAmount * 0.099) : null);

  const extraAmountReceived = Math.max(
    0,
    pickNum(body.extraAmountReceived, body.extra_amount_received) ?? 0,
  );
  const totalAmountReceived = pickNum(body.totalAmountReceived, body.total_amount_received);
  const rawAmountReceived = pickNum(body.amountReceived, body.amount_received);

  // Prefer explicit toward-10 amount; else derive from total − extra.
  let amountToward10 =
    rawAmountReceived ??
    (totalAmountReceived != null ? Math.max(0, totalAmountReceived - extraAmountReceived) : null);
  if (amountToward10 == null) amountToward10 = 0;

  const remainingFromBody = pickNum(body.remainingAmount, body.remaining_amount, body.shortfallAmount, body.shortfall_amount);
  const remainingAmount =
    remainingFromBody != null
      ? Math.max(0, remainingFromBody)
      : tenPercentAmount != null
        ? Math.max(0, tenPercentAmount - amountToward10)
        : 0;
  const shortfallAmount = remainingAmount;

  const modeRaw = pickStr(body.bookingApprovalMode, body.booking_approval_mode).toUpperCase();
  let mode: BookingFinanceSyncMode | null =
    modeRaw === "FULL_10" || modeRaw === "BUFFER_9_9" ? (modeRaw as BookingFinanceSyncMode) : null;

  if (!mode) {
    if (tenPercentAmount != null && amountToward10 >= tenPercentAmount) {
      mode = "FULL_10";
    } else if (
      bufferThresholdAmount != null &&
      amountToward10 >= bufferThresholdAmount &&
      (remainingAmount > 0 || (tenPercentAmount != null && amountToward10 < tenPercentAmount))
    ) {
      mode = "BUFFER_9_9";
    } else if (tenPercentAmount != null && amountToward10 >= tenPercentAmount) {
      mode = "FULL_10";
    } else if (amountToward10 > 0 && tenPercentAmount == null) {
      mode = "FULL_10";
    }
  }

  if (!mode) {
    if (bufferThresholdAmount != null && amountToward10 < bufferThresholdAmount) {
      throw new Error("Paid amount below 9.9% buffer threshold");
    }
    if (tenPercentAmount != null && amountToward10 < tenPercentAmount) {
      throw new Error("Paid amount below 9.9% buffer threshold");
    }
    throw new Error("Missing bookingApprovalMode");
  }

  if (mode === "BUFFER_9_9") {
    if (bufferThresholdAmount != null && amountToward10 < bufferThresholdAmount) {
      throw new Error("Paid amount below 9.9% buffer threshold");
    }
    if (
      bufferThresholdAmount == null &&
      tenPercentAmount != null &&
      amountToward10 < roundMoney(tenPercentAmount * 0.99)
    ) {
      throw new Error("Paid amount below 9.9% buffer threshold");
    }
  } else if (mode === "FULL_10") {
    if (tenPercentAmount != null && amountToward10 < tenPercentAmount) {
      throw new Error("Full 10% must be received for FULL_10 finance sync");
    }
  }

  const totalPaid =
    totalAmountReceived != null
      ? Math.max(0, totalAmountReceived)
      : amountToward10 + extraAmountReceived;

  const financeBufferNote =
    pickStr(body.financeBufferNote, body.finance_buffer_note) ||
    (mode === "BUFFER_9_9"
      ? `Booking allowed from 9.9% buffer. ₹${shortfallAmount.toLocaleString("en-IN")} still due toward 10% for Finance.`
      : "");

  return {
    mode,
    quoteAmount,
    tenPercentAmount,
    bufferThresholdAmount,
    amountToward10,
    remainingAmount,
    shortfallAmount,
    extraAmountReceived,
    totalAmountReceived: totalPaid,
    bufferApplied: mode === "BUFFER_9_9" || body.bufferApplied === true || body.buffer_applied === true,
    financeBufferNote,
  };
}

/** Mirror CRM hub sales payment into leads.payload so design milestone math sees it. */
async function persistHubSalesPaymentToLeadPayload(
  pool: Pool,
  leadId: number,
  finance: ResolvedBookingFinance,
): Promise<void> {
  if (finance.amountToward10 <= 0 && finance.totalAmountReceived <= 0) return;
  const [rows] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [leadId]);
  const raw = (rows as { payload?: unknown }[])[0]?.payload;
  const payload = parseLeadPayload(raw);
  const existingToward10 =
    pickNum(payload.total_paid_toward_10_percent, payload.amount_paid) ?? 0;
  const existingTotal =
    pickNum(payload.total_paid_cumulative, payload.total_customer_paid) ?? existingToward10;
  const toward10 = Math.max(existingToward10, finance.amountToward10);
  const totalPaid = Math.max(existingTotal, finance.totalAmountReceived);
  const extra = Math.max(
    pickNum(payload.extra_amount_received, payload.finance_extra_amount) ?? 0,
    finance.extraAmountReceived,
  );

  payload.total_paid_toward_10_percent = toward10;
  payload.amount_paid = toward10;
  payload.total_paid_cumulative = totalPaid;
  payload.total_customer_paid = totalPaid;
  payload.extra_amount_received = extra;
  payload.finance_extra_amount = extra;
  payload.booking_approval_mode = finance.mode;
  payload.buffer_applied = finance.bufferApplied;
  payload.buffer_threshold_amount = finance.bufferThresholdAmount;
  payload.finance_buffer_note = finance.financeBufferNote || null;
  payload.shortfall_toward_10_percent = finance.shortfallAmount;
  payload.remaining_for_10_percent = finance.remainingAmount;

  if (finance.tenPercentAmount != null && finance.tenPercentAmount > 0) {
    payload.ten_percent_target = finance.tenPercentAmount;
    payload.ten_percent_payment_met = toward10 >= finance.tenPercentAmount;
  }
  if (finance.quoteAmount != null && finance.quoteAmount > 0) {
    payload.quotation_total = finance.quoteAmount;
  }
  await pool.query(`UPDATE leads SET payload = ?, update_at = ? WHERE id = ?`, [
    JSON.stringify(payload),
    new Date(),
    leadId,
  ]);
}

function hubProofUrl(base: string, contentPath: string): string {
  const b = base.replace(/\/$/, "");
  const p = contentPath.startsWith("/") ? contentPath : `/${contentPath}`;
  return `${b}${p}`;
}

function ensureHubProofsDir(): void {
  if (!fs.existsSync(HUB_PROOFS_DIR)) fs.mkdirSync(HUB_PROOFS_DIR, { recursive: true });
}

function extFromMime(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("pdf")) return "pdf";
  return "jpg";
}

function hubProofFetchHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = expectedHubApiKey();
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    headers["x-external-api-key"] = apiKey;
  }
  const bearer = envTrim("HUB_PROOF_BEARER_TOKEN");
  if (bearer && !/^https?:\/\//i.test(bearer)) {
    headers.Authorization = bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}`;
  }
  return headers;
}

function hubProofFetchUrls(hubUrl: string): string[] {
  const urls = [hubUrl];
  if (hubUrl.includes("/v1/booking-token/deals/")) {
    urls.push(hubUrl.replace("/v1/booking-token/deals/", "/api/crm/booking-token/deals/"));
  }
  if (hubUrl.includes("/api/crm/booking-token/deals/")) {
    urls.push(hubUrl.replace("/api/crm/booking-token/deals/", "/v1/booking-token/deals/"));
  }
  return [...new Set(urls)];
}

async function fetchHubProofBuffer(
  hubUrl: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  for (const url of hubProofFetchUrls(hubUrl)) {
    try {
      const res = await fetch(url, { headers: hubProofFetchHeaders() });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "application/octet-stream";
      if (contentType.includes("application/json")) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) continue;
      return { buffer, contentType };
    } catch {
      /* try next URL variant */
    }
  }
  return null;
}

async function findInlineProofInSyncPayload(
  pool: Pool,
  leadId: number,
  proofStoredName: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const [rows] = await pool.query(
    `SELECT payment_payload as paymentPayload FROM lead_hub_booking_sync WHERE lead_id = ? ORDER BY synced_at DESC LIMIT 1`,
    [leadId],
  );
  const payload = parseLeadPayload((rows as { paymentPayload?: unknown }[])[0]?.paymentPayload);
  const paymentHistory = Array.isArray(payload.paymentHistory) ? payload.paymentHistory : [];
  for (const entry of paymentHistory) {
    if (!entry || typeof entry !== "object") continue;
    const proofs = Array.isArray((entry as Record<string, unknown>).proofs)
      ? ((entry as Record<string, unknown>).proofs as Record<string, unknown>[])
      : [];
    for (const proof of proofs) {
      if (!proof || typeof proof !== "object") continue;
      const proofId = pickStr(proof.id, proof.proofId);
      if (proofStoredName && proofId && proofId !== proofStoredName) continue;
      const inline = parseInlineProofData(proof);
      if (inline) return inline;
    }
  }
  return null;
}

async function cacheHubProofUpload(
  pool: Pool,
  uploadId: number,
  leadId: number,
  proofKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const ext = extFromMime(contentType);
  const filePath = saveHubProofFile(leadId, proofKey, buffer, ext);
  await pool.query(
    `UPDATE lead_uploads SET stored_path = ?, size_bytes = ?, mime_type = COALESCE(NULLIF(mime_type, ''), ?) WHERE id = ? AND lead_id = ?`,
    [filePath, buffer.length, contentType, uploadId, leadId],
  );
  return filePath;
}

export async function refreshHubPaymentProofsFromSync(pool: Pool, leadId: number): Promise<number> {
  const [rows] = await pool.query(
    `SELECT payment_payload as paymentPayload, synced_at as syncedAt
     FROM lead_hub_booking_sync WHERE lead_id = ? ORDER BY synced_at DESC LIMIT 1`,
    [leadId],
  );
  const sync = (rows as { paymentPayload?: unknown; syncedAt?: unknown }[])[0];
  if (!sync) throw new Error("No CRM hub payment sync found for this lead");
  const payload = parseLeadPayload(sync.paymentPayload);
  return importHubPaymentProofs(pool, leadId, { ...payload, _syncedAt: sync.syncedAt });
}

function saveHubProofFile(leadId: number, proofKey: string, buffer: Buffer, ext: string): string {
  ensureHubProofsDir();
  const safeProof = proofKey.replace(/[^a-zA-Z0-9._-]/g, "_") || "proof";
  const fileName = `lead-${leadId}-${safeProof}-${Date.now()}.${ext}`;
  const filePath = path.join(HUB_PROOFS_DIR, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function parseInlineProofData(
  proof: Record<string, unknown>,
): { buffer: Buffer; contentType: string } | null {
  const raw = pickStr(
    proof.contentBase64,
    proof.base64,
    proof.dataUrl,
    proof.content,
    proof.fileContent,
    proof.imageData,
    proof.screenshot,
  );
  if (!raw) return null;
  if (raw.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(raw);
    if (!match) return null;
    return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
  }
  try {
    const buffer = Buffer.from(raw, "base64");
    if (buffer.length < 16) return null;
    return { buffer, contentType: pickStr(proof.mimeType, proof.contentType, "image/jpeg") };
  } catch {
    return null;
  }
}

async function ensureLeadHubBookingSyncTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_hub_booking_sync (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lead_id INT NOT NULL,
      booking_token_record_id VARCHAR(64) NOT NULL,
      payment_history_id VARCHAR(36) NULL,
      crm_lead_type VARCHAR(32) NOT NULL,
      crm_lead_id BIGINT NOT NULL,
      amount_received DECIMAL(14,2) NULL,
      ten_percent_amount DECIMAL(14,2) NULL,
      payment_payload MEDIUMTEXT NULL,
      synced_at DATETIME NOT NULL,
      UNIQUE KEY uq_booking_token (booking_token_record_id),
      KEY idx_lead (lead_id)
    );
  `);
}

async function ensureLeadHubBookingRefundTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_hub_booking_refunds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      refund_key VARCHAR(96) NOT NULL,
      lead_id INT NOT NULL,
      booking_token_record_id VARCHAR(64) NOT NULL,
      crm_lead_type VARCHAR(32) NULL,
      crm_lead_id BIGINT NULL,
      lead_identifier VARCHAR(128) NULL,
      customer_name VARCHAR(255) NULL,
      refund_amount DECIMAL(14,2) NOT NULL,
      amount_toward_ten_refund DECIMAL(14,2) NULL DEFAULT 0,
      extra_refund_amount DECIMAL(14,2) NULL DEFAULT 0,
      cancellation_reason TEXT NULL,
      cancelled_at DATETIME NULL,
      cancellation_approved_at DATETIME NULL,
      cancellation_approved_by VARCHAR(255) NULL,
      refund_scope VARCHAR(32) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      refund_payload MEDIUMTEXT NULL,
      finance_approved_at DATETIME NULL,
      finance_approved_by VARCHAR(255) NULL,
      created_at DATETIME NOT NULL,
      UNIQUE KEY uq_refund_key (refund_key),
      KEY idx_refund_lead (lead_id),
      KEY idx_refund_booking_token (booking_token_record_id),
      KEY idx_refund_status (status)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_hub_booking_refund_lines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      refund_id INT NOT NULL,
      payment_history_id VARCHAR(64) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      extra_amount DECIMAL(14,2) NULL DEFAULT 0,
      proof_refs MEDIUMTEXT NULL,
      KEY idx_refund_line_refund (refund_id),
      KEY idx_refund_line_payment (payment_history_id)
    );
  `);
  // Best-effort column upgrades for older installs
  const alters = [
    "ALTER TABLE lead_hub_booking_refunds ADD COLUMN lead_identifier VARCHAR(128) NULL",
    "ALTER TABLE lead_hub_booking_refunds ADD COLUMN customer_name VARCHAR(255) NULL",
    "ALTER TABLE lead_hub_booking_refunds ADD COLUMN amount_toward_ten_refund DECIMAL(14,2) NULL DEFAULT 0",
    "ALTER TABLE lead_hub_booking_refunds ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'PENDING'",
    "ALTER TABLE lead_hub_booking_refunds ADD COLUMN finance_approved_at DATETIME NULL",
    "ALTER TABLE lead_hub_booking_refunds ADD COLUMN finance_approved_by VARCHAR(255) NULL",
  ];
  for (const sql of alters) {
    try {
      await pool.query(sql);
    } catch {
      /* column already exists */
    }
  }
}

/** Avoid JSON_EXTRACT errors when payload is empty or invalid (legacy rows). */
const SAFE_PAYLOAD_JSON =
  "CASE WHEN payload IS NULL OR TRIM(payload) = '' OR JSON_VALID(payload) = 0 THEN '{}' ELSE payload END";

const TRANSIENT_DB_CODES = new Set(["ECONNRESET", "PROTOCOL_CONNECTION_LOST", "ETIMEDOUT", "EPIPE"]);

async function queryWithRetry(
  pool: Pool,
  sql: string,
  params?: unknown[],
): Promise<Awaited<ReturnType<Pool["query"]>>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string })?.code;
      if (!code || !TRANSIENT_DB_CODES.has(code) || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function isTransientDbError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return !!code && TRANSIENT_DB_CODES.has(code);
}

async function resolveDesignLeadIdForHubSync(pool: Pool, body: HubLeadBody): Promise<number | null> {
  const leadType = pickStr(body.leadType, body.crmLeadType);
  const leadIdNum = pickNum(body.leadId, body.crmLeadId);
  const leadIdentifier = pickStr(body.leadIdentifier, body.externalReferenceId, body.pid);
  const designLeadId = pickNum(body.designLeadId);

  if (leadType && leadIdNum != null) {
    const [byCrm] = await queryWithRetry(
      pool,
      `SELECT id FROM leads
       WHERE JSON_UNQUOTE(JSON_EXTRACT(${SAFE_PAYLOAD_JSON}, '$.crmLeadType')) = ?
         AND CAST(JSON_UNQUOTE(JSON_EXTRACT(${SAFE_PAYLOAD_JSON}, '$.crmLeadId')) AS UNSIGNED) = ?
       ORDER BY id DESC LIMIT 1`,
      [leadType, leadIdNum],
    );
    const row = (byCrm as { id: number }[])[0];
    if (row?.id) return row.id;
  }

  if (leadIdentifier) {
    const [byRef] = await queryWithRetry(
      pool,
      `SELECT id FROM leads
       WHERE pid = ?
          OR JSON_UNQUOTE(JSON_EXTRACT(${SAFE_PAYLOAD_JSON}, '$.fetchedData.externalReferenceId')) = ?
          OR JSON_UNQUOTE(JSON_EXTRACT(${SAFE_PAYLOAD_JSON}, '$.externalReferenceId')) = ?
       ORDER BY id DESC LIMIT 1`,
      [leadIdentifier, leadIdentifier, leadIdentifier],
    );
    const row = (byRef as { id: number }[])[0];
    if (row?.id) return row.id;
  }

  if (leadType && leadIdNum != null) {
    const fuzzy = `${leadType}#${leadIdNum}`;
    const [all] = await queryWithRetry(pool, `SELECT id, payload FROM leads ORDER BY id DESC LIMIT 500`);
    for (const row of all as { id: number; payload: unknown }[]) {
      const p = parseLeadPayload(row.payload);
      const ext = pickStr(
        (p.fetchedData as Record<string, unknown> | undefined)?.externalReferenceId,
        p.externalReferenceId,
        p.pid,
      );
      if (ext.includes(fuzzy) || ext === leadIdentifier) return row.id;
    }
  }

  if (designLeadId != null) {
    const [rows] = await queryWithRetry(pool, `SELECT id, payload FROM leads WHERE id = ? LIMIT 1`, [designLeadId]);
    const row = (rows as { id: number; payload: unknown }[])[0];
    if (!row) return null;
    const p = parseLeadPayload(row.payload);
    if (leadType && leadIdNum != null) {
      const pType = pickStr(p.crmLeadType);
      const pId = pickNum(p.crmLeadId);
      if (pType === leadType && pId === leadIdNum) return row.id;
    }
    if (leadIdentifier) {
      const ext = pickStr(
        (p.fetchedData as Record<string, unknown> | undefined)?.externalReferenceId,
        p.externalReferenceId,
      );
      if (ext === leadIdentifier) return row.id;
    }
  }

  return null;
}

async function resolveDesignerId(pool: Pool, designerName: string): Promise<number | null> {
  if (!designerName) return null;
  const [rows] = await pool.query(
    `SELECT id FROM users WHERE role = 'designer' AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
    [designerName],
  );
  const row = (rows as { id: number }[])[0];
  return row?.id ?? null;
}

/**
 * When CRM intake + upsert both created rows for the same AL-/GL- id,
 * keep the canonical Design lead and mark the extras Cancelled so Dashboard
 * Active view shows one row.
 */
async function cancelDuplicateCrmLeads(
  pool: Pool,
  args: {
    keepLeadId: number;
    leadIdentifier: string;
    leadType: string;
    leadIdNum: number;
    now: Date;
  },
): Promise<void> {
  const ident = String(args.leadIdentifier || "").trim();
  if (!ident || !Number.isFinite(args.keepLeadId)) return;
  try {
    const [rows] = await queryWithRetry(
      pool,
      `SELECT id FROM leads
       WHERE id <> ?
         AND LOWER(TRIM(COALESCE(project_stage, ''))) <> 'cancelled'
         AND (
           pid = ?
           OR JSON_UNQUOTE(JSON_EXTRACT(${SAFE_PAYLOAD_JSON}, '$.externalReferenceId')) = ?
           OR JSON_UNQUOTE(JSON_EXTRACT(${SAFE_PAYLOAD_JSON}, '$.fetchedData.externalReferenceId')) = ?
           OR (
             JSON_UNQUOTE(JSON_EXTRACT(${SAFE_PAYLOAD_JSON}, '$.crmLeadType')) = ?
             AND CAST(JSON_UNQUOTE(JSON_EXTRACT(${SAFE_PAYLOAD_JSON}, '$.crmLeadId')) AS UNSIGNED) = ?
           )
         )`,
      [args.keepLeadId, ident, ident, ident, args.leadType, args.leadIdNum],
    );
    const dupIds = (rows as { id: number }[])
      .map((r) => Number(r.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    for (const dupId of dupIds) {
      await pool.query(
        `UPDATE leads
         SET project_stage = 'Cancelled', is_on_hold = 0, resume_at = NULL, update_at = ?
         WHERE id = ?`,
        [args.now, dupId],
      );
      console.info("[crm-hub] cancelled duplicate Design lead", {
        keepLeadId: args.keepLeadId,
        cancelledLeadId: dupId,
        leadIdentifier: ident,
      });
    }
  } catch (err) {
    console.warn("[crm-hub] duplicate lead cleanup skipped", err);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildCrmHubPayload(body: HubLeadBody, leadType: string, leadIdNum: number, leadIdentifier: string): Record<string, unknown> {
  const projectName = pickStr(body.projectName, body.customerName, "Unnamed");
  const contactNo = pickStr(body.contactNo, body.contact_no, body.phone);
  const clientEmail = pickStr(body.clientEmail, body.client_email, body.email);
  const designerName = pickStr(body.designerName, body.designer_name);
  const appointmentDate = pickStr(body.appointmentDate, body.appointment_date);
  const appointmentSlot = pickStr(body.appointmentSlot, body.appointment_slot, body.slot);
  const discoveryIn = asRecord(body.discovery) || {};
  const connectionIn = asRecord(body.connection) || {};
  const propertyNotes = pickStr(
    body.propertyNotes,
    body.property_notes,
    discoveryIn.propertyNotes,
  );
  const configuration = pickStr(
    body.configuration,
    body.property_configuration,
    discoveryIn.configuration,
  );
  const budget = pickStr(body.budget, discoveryIn.budget);
  const language = pickStr(body.language, discoveryIn.language);
  const bookingType = pickStr(body.bookingType, body.booking_type, discoveryIn.bookingType);
  const propertyLocation = pickStr(
    body.propertyLocation,
    body.property_location,
    discoveryIn.propertyLocation,
  );
  const meetingType = pickStr(body.meetingType, body.meeting_type, connectionIn.meetingType);
  const floorPlanPublicLink = pickStr(
    body.floorPlanPublicLink,
    body.floorPlanUrl,
    body.floor_plan_public_link,
    connectionIn.floorPlanPublicLink,
    connectionIn.floorPlanUrl,
  );
  const salesExecutive = pickStr(body.salesExecutive, body.sales_executive);
  const salesExecutiveEmail = pickStr(body.salesExecutiveEmail, body.sales_executive_email);
  const pincode = pickStr(body.pincode);
  const leadSource = pickStr(body.leadSource, body.lead_source);
  const possessionDate = pickStr(body.possessionDate, body.possession_date);
  const altPhone = pickStr(body.altPhone, body.alt_phone);
  const scopeSummary =
    asRecord(connectionIn.configurationScope) ||
    asRecord(body.configurationScope) ||
    null;

  const discovery = {
    propertyLocation: propertyLocation || null,
    budget: budget || null,
    language: language || null,
    configuration: configuration || null,
    bookingType: bookingType || null,
    propertyNotes: propertyNotes || null,
  };

  const connection = {
    floorPlanPublicLink: floorPlanPublicLink || null,
    floorPlanUrl: floorPlanPublicLink || null,
    meetingType: meetingType || null,
    designerName: designerName || null,
    configurationScope: scopeSummary,
  };

  return {
    source: "crm_hub",
    intakePath: "crm_booking_token",
    crmLeadType: leadType,
    crmLeadId: leadIdNum,
    fetchedData: {
      externalReferenceId: leadIdentifier || null,
      customer_name: projectName,
      co_no: contactNo || "",
      email: clientEmail || "",
      ...(altPhone ? { alt_phone: altPhone } : {}),
      ...(pincode ? { pincode } : {}),
      ...(leadSource ? { lead_source: leadSource } : {}),
      ...(possessionDate ? { possession_date: possessionDate } : {}),
    },
    formData: {
      customer_name: projectName,
      co_no: contactNo || "",
      email: clientEmail || "",
      status_of_project: "Pre 10%",
      designer_name: designerName || "",
      appointment_date: appointmentDate || "",
      appointment_slot: appointmentSlot || "",
      ...(configuration ? { configuration } : {}),
      ...(propertyNotes ? { property_notes: propertyNotes, propertyNotes } : {}),
      ...(budget ? { budget } : {}),
      ...(language ? { language } : {}),
      ...(bookingType ? { bookingType, booking_type: bookingType } : {}),
      ...(propertyLocation ? { propertyLocation, property_location: propertyLocation } : {}),
      ...(meetingType ? { meetingType, meeting_type: meetingType } : {}),
      ...(floorPlanPublicLink
        ? { floorPlanPublicLink, floorPlanUrl: floorPlanPublicLink }
        : {}),
      ...(salesExecutive ? { sales_executive: salesExecutive } : {}),
      ...(salesExecutiveEmail ? { sales_executive_email: salesExecutiveEmail } : {}),
    },
    crmSchedule: {
      date: appointmentDate || null,
      slot: appointmentSlot || null,
    },
    discovery,
    connection,
    floorPlanPublicLink: floorPlanPublicLink || null,
    floorPlanUrl: floorPlanPublicLink || null,
    meetingType: meetingType || null,
    budget: budget || null,
    language: language || null,
    bookingType: bookingType || null,
    propertyLocation: propertyLocation || null,
    rawHubPayload: body,
  };
}

async function upsertCrmDesignLead(
  pool: Pool,
  body: HubLeadBody,
  addLeadHistoryEvent: RouteDeps["addLeadHistoryEvent"],
): Promise<{ designLeadId: number; created: boolean }> {
  const leadType = pickStr(body.leadType, body.crmLeadType) || "addlead";
  const leadIdNum = pickNum(body.leadId, body.crmLeadId);
  if (leadIdNum == null) {
    throw new Error("leadId is required");
  }
  const leadIdentifier = pickStr(body.leadIdentifier, body.externalReferenceId, body.pid);
  const projectName = pickStr(body.projectName, body.customerName, "Unnamed");
  const contactNo = pickStr(body.contactNo, body.contact_no, body.phone) || null;
  const clientEmail = pickStr(body.clientEmail, body.client_email, body.email) || null;
  const designerName = pickStr(body.designerName, body.designer_name);
  const now = new Date();

  const existingId = await resolveDesignLeadIdForHubSync(pool, body);
  const payloadToPersist = buildCrmHubPayload(body, leadType, leadIdNum, leadIdentifier);
  const assignedDesignerId = designerName ? await resolveDesignerId(pool, designerName) : null;

  if (existingId) {
    const [rows] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [existingId]);
    const prev = parseLeadPayload((rows as { payload: unknown }[])[0]?.payload);
    const prevFetched =
      prev.fetchedData && typeof prev.fetchedData === "object"
        ? (prev.fetchedData as Record<string, unknown>)
        : {};
    const newFetched =
      payloadToPersist.fetchedData && typeof payloadToPersist.fetchedData === "object"
        ? (payloadToPersist.fetchedData as Record<string, unknown>)
        : {};
    const prevForm =
      prev.formData && typeof prev.formData === "object"
        ? (prev.formData as Record<string, unknown>)
        : {};
    const newForm =
      payloadToPersist.formData && typeof payloadToPersist.formData === "object"
        ? (payloadToPersist.formData as Record<string, unknown>)
        : {};
    const prevDiscovery =
      prev.discovery && typeof prev.discovery === "object"
        ? (prev.discovery as Record<string, unknown>)
        : {};
    const newDiscovery =
      payloadToPersist.discovery && typeof payloadToPersist.discovery === "object"
        ? (payloadToPersist.discovery as Record<string, unknown>)
        : {};
    const prevConnection =
      prev.connection && typeof prev.connection === "object"
        ? (prev.connection as Record<string, unknown>)
        : {};
    const newConnection =
      payloadToPersist.connection && typeof payloadToPersist.connection === "object"
        ? (payloadToPersist.connection as Record<string, unknown>)
        : {};
    const prevScope =
      prevConnection.configurationScope && typeof prevConnection.configurationScope === "object"
        ? (prevConnection.configurationScope as Record<string, unknown>)
        : {};
    const newScope =
      newConnection.configurationScope && typeof newConnection.configurationScope === "object"
        ? (newConnection.configurationScope as Record<string, unknown>)
        : {};
    const merged = {
      ...prev,
      ...payloadToPersist,
      fetchedData: { ...prevFetched, ...newFetched },
      formData: { ...prevForm, ...newForm },
      discovery: { ...prevDiscovery, ...newDiscovery },
      connection: {
        ...prevConnection,
        ...newConnection,
        configurationScope:
          Object.keys(newScope).length > 0
            ? {
                ...prevScope,
                ...newScope,
                ...(Array.isArray(newScope.selectedRooms)
                  ? { selectedRooms: newScope.selectedRooms }
                  : {}),
                ...(Array.isArray(newScope.miscAddOns)
                  ? { miscAddOns: newScope.miscAddOns }
                  : {}),
                ...(newScope.referenceInspiration &&
                typeof newScope.referenceInspiration === "object"
                  ? { referenceInspiration: newScope.referenceInspiration }
                  : {}),
                ...(newScope.financialGuardrails &&
                typeof newScope.financialGuardrails === "object"
                  ? { financialGuardrails: newScope.financialGuardrails }
                  : {}),
                ...(newScope.internalExecutiveNotes &&
                typeof newScope.internalExecutiveNotes === "object"
                  ? { internalExecutiveNotes: newScope.internalExecutiveNotes }
                  : {}),
              }
            : Object.keys(prevScope).length > 0
              ? prevScope
              : null,
      },
    };
    await pool.query(
      `UPDATE leads SET project_name = ?, contact_no = COALESCE(?, contact_no), client_email = COALESCE(?, client_email),
       payload = ?, assigned_designer_id = COALESCE(?, assigned_designer_id), update_at = ?
       WHERE id = ?`,
      [projectName, contactNo, clientEmail, JSON.stringify(merged), assignedDesignerId, now, existingId],
    );
    await addLeadHistoryEvent(existingId, {
      id: `crm-hub-upsert-${Date.now()}`,
      type: "note",
      taskName: "CRM Hub intake",
      milestoneName: "Pre 10%",
      timestamp: now.toISOString(),
      description: "Lead updated from CRM Booking & Token",
      user: { name: "CRM Hub" },
      details: { kind: "crm_hub_upsert", crmLeadType: leadType, crmLeadId: leadIdNum },
    });
    await cancelDuplicateCrmLeads(pool, {
      keepLeadId: existingId,
      leadIdentifier,
      leadType,
      leadIdNum,
      now,
    });
    return { designLeadId: existingId, created: false };
  }

  const pid = leadIdentifier || `${leadType}-${leadIdNum}`;
  const [result] = await pool.query(
    `INSERT INTO leads (pid, project_name, project_stage, contact_no, client_email, is_on_hold, resume_at, create_at, update_at, payload, assigned_designer_id)
     VALUES (?, ?, 'Pre 10%', ?, ?, 0, NULL, ?, ?, ?, ?)`,
    [pid, projectName, contactNo, clientEmail, now, now, JSON.stringify(payloadToPersist), assignedDesignerId],
  );
  const designLeadId = Number((result as { insertId?: number }).insertId);
  await addLeadHistoryEvent(designLeadId, {
    id: `crm-hub-upsert-${Date.now()}`,
    type: "note",
    taskName: "CRM Hub intake",
    milestoneName: "Pre 10%",
    timestamp: now.toISOString(),
    description: "Lead created from CRM Booking & Token",
    user: { name: "CRM Hub" },
    details: { kind: "crm_hub_upsert", crmLeadType: leadType, crmLeadId: leadIdNum },
  });
  await cancelDuplicateCrmLeads(pool, {
    keepLeadId: designLeadId,
    leadIdentifier,
    leadType,
    leadIdNum,
    now,
  });
  return { designLeadId, created: true };
}

async function importHubPaymentProofs(
  pool: Pool,
  leadId: number,
  body: HubLeadBody,
): Promise<number> {
  const hubProofBaseUrl = pickStr(body.hubProofBaseUrl, envTrim("HUB_API_BASE_URL"), "http://localhost:8081");
  const paymentHistory = Array.isArray(body.paymentHistory) ? body.paymentHistory : [];
  await pool.query(`DELETE FROM lead_uploads WHERE lead_id = ? AND upload_type = 'hub_payment_proof'`, [leadId]);

  let proofCount = 0;
  const now = new Date();
  const proofUploadedAt =
    body._syncedAt instanceof Date
      ? body._syncedAt
      : body._syncedAt
        ? new Date(String(body._syncedAt))
        : now;
  for (const entry of paymentHistory) {
    if (!entry || typeof entry !== "object") continue;
    const proofs = Array.isArray((entry as Record<string, unknown>).proofs)
      ? ((entry as Record<string, unknown>).proofs as Record<string, unknown>[])
      : [];
    for (const proof of proofs) {
      const proofId = pickStr(proof.id, proof.proofId);
      const originalName = pickStr(proof.originalFileName, proof.fileName, "proof");
      const mimeType = pickStr(proof.mimeType, proof.contentType, "application/octet-stream");
      const contentPath = pickStr(proof.contentPath, proof.url);
      if (!contentPath) continue;
      const proofUrl = contentPath.startsWith("http") ? contentPath : hubProofUrl(hubProofBaseUrl, contentPath);
      const storedName = proofId || `hub-proof-${Date.now()}-${proofCount}`;
      let storedPath = proofUrl;
      let sizeBytes = 0;
      const inline = parseInlineProofData(proof);
      if (inline) {
        const ext = extFromMime(inline.contentType);
        storedPath = saveHubProofFile(leadId, storedName, inline.buffer, ext);
        sizeBytes = inline.buffer.length;
      } else {
        const fetched = await fetchHubProofBuffer(proofUrl);
        if (fetched) {
          const ext = extFromMime(fetched.contentType);
          storedPath = saveHubProofFile(leadId, storedName, fetched.buffer, ext);
          sizeBytes = fetched.buffer.length;
        }
      }
      await pool.query(
        `INSERT INTO lead_uploads
         (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'pending', 'hub_payment_proof', ?)`,
        [leadId, originalName, storedName, storedPath, mimeType, sizeBytes, proofUploadedAt, proofUrl],
      );
      proofCount += 1;
    }
  }
  return proofCount;
}

/** CRM booking token payment approved by finance (pre-DQC1). Not design milestone 2. */
function readCrmBookingFinanceApproved(payload: Record<string, unknown>): boolean {
  return payload.crm_booking_finance_approved === true || payload.crm_booking_finance_approved === "true";
}

/** Includes legacy rows approved via milestone 2 before flow separation (pre-DQC1 only). */
export async function isCrmBookingFinanceApproved(
  pool: Pool,
  leadId: number,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (readCrmBookingFinanceApproved(payload)) return true;
  if (await leadHasDqc1Approval(pool, leadId)) return false;
  const [rows] = await pool.query(
    `SELECT 1 FROM lead_task_completions
     WHERE lead_id = ? AND milestone_index = 2 AND task_name = '10% payment approval' LIMIT 1`,
    [leadId],
  );
  return (rows as unknown[]).length > 0;
}

export async function leadHasDqc1Approval(pool: Pool, leadId: number): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT 1 FROM lead_task_completions
     WHERE lead_id = ? AND milestone_index = 1 AND task_name = 'DQC 1 approval' LIMIT 1`,
    [leadId],
  );
  return (rows as unknown[]).length > 0;
}

async function handleConvertBooking(
  pool: Pool,
  body: HubLeadBody,
  addLeadHistoryEvent: RouteDeps["addLeadHistoryEvent"],
): Promise<{
  designLeadId: number;
  bookingTokenRecordId: string;
  financeSyncMode: BookingFinanceSyncMode;
  shortfallRecorded: number;
  extraAmountReceived: number;
}> {
  const bookingTokenRecordId = pickStr(body.bookingTokenRecordId, body.recordId);
  if (!bookingTokenRecordId) throw new Error("bookingTokenRecordId is required");

  const finance = resolveBookingFinanceSync(body);

  const leadType = pickStr(body.leadType, body.crmLeadType) || "addlead";
  const leadIdNum = pickNum(body.leadId, body.crmLeadId);
  if (leadIdNum == null) throw new Error("leadId is required");

  let designLeadId = await resolveDesignLeadIdForHubSync(pool, body);
  if (!designLeadId) {
    const upserted = await upsertCrmDesignLead(pool, body, addLeadHistoryEvent);
    designLeadId = upserted.designLeadId;
  }

  const paymentHistoryId = pickStr(body.paymentHistoryId) || null;
  const amountReceived = finance.amountToward10;
  const tenPercentAmount = finance.tenPercentAmount;
  const quoteAmount = finance.quoteAmount;
  const now = new Date();
  const payloadJson = JSON.stringify({
    ...body,
    bookingApprovalMode: finance.mode,
    bufferApplied: finance.bufferApplied,
    bufferThresholdAmount: finance.bufferThresholdAmount,
    remainingAmount: finance.remainingAmount,
    shortfallAmount: finance.shortfallAmount,
    extraAmountReceived: finance.extraAmountReceived,
    totalAmountReceived: finance.totalAmountReceived,
    financeBufferNote: finance.financeBufferNote || undefined,
    amountReceived: finance.amountToward10,
    tenPercentAmount: finance.tenPercentAmount,
    quoteAmount: finance.quoteAmount,
  });

  await pool.query(
    `INSERT INTO lead_hub_booking_sync
     (lead_id, booking_token_record_id, payment_history_id, crm_lead_type, crm_lead_id, amount_received, ten_percent_amount, payment_payload, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       lead_id = VALUES(lead_id),
       payment_history_id = VALUES(payment_history_id),
       crm_lead_type = VALUES(crm_lead_type),
       crm_lead_id = VALUES(crm_lead_id),
       amount_received = VALUES(amount_received),
       ten_percent_amount = VALUES(ten_percent_amount),
       payment_payload = VALUES(payment_payload),
       synced_at = VALUES(synced_at)`,
    [
      designLeadId,
      bookingTokenRecordId,
      paymentHistoryId,
      leadType,
      leadIdNum,
      amountReceived,
      tenPercentAmount,
      payloadJson,
      now,
    ],
  );

  await persistHubSalesPaymentToLeadPayload(pool, designLeadId, finance);

  // Merge Experience / Decision / BookingDone snapshot into lead payload for Design View
  try {
    const [leadRows] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [designLeadId]);
    const prev = parseLeadPayload((leadRows as { payload?: unknown }[])[0]?.payload);
    const experience = asRecord(body.experience) || {};
    const decision = asRecord(body.decision) || {};
    const bookingDone = asRecord(body.bookingDone) || {};
    const merged = {
      ...prev,
      experience: {
        ...(asRecord(prev.experience) || {}),
        ...experience,
        quoteAmount: quoteAmount ?? (asRecord(prev.experience) || {}).quoteAmount ?? null,
      },
      decision: {
        ...(asRecord(prev.decision) || {}),
        ...decision,
        finalBudget:
          pickNum(decision.finalBudget, quoteAmount) ??
          (asRecord(prev.decision) || {}).finalBudget ??
          null,
      },
      bookingDone: {
        ...(asRecord(prev.bookingDone) || {}),
        ...bookingDone,
        quoteAmount: quoteAmount ?? null,
        tenPercentAmount: tenPercentAmount ?? null,
        amountReceived: amountReceived ?? null,
        bookingApprovalMode: finance.mode,
        bufferApplied: finance.bufferApplied,
        remainingAmount: finance.remainingAmount,
        shortfallAmount: finance.shortfallAmount,
        extraAmountReceived: finance.extraAmountReceived,
        totalAmountReceived: finance.totalAmountReceived,
        financeBufferNote: finance.financeBufferNote || null,
      },
    };
    await pool.query(`UPDATE leads SET payload = ?, update_at = ? WHERE id = ?`, [
      JSON.stringify(merged),
      now,
      designLeadId,
    ]);
  } catch (mergeErr) {
    console.warn("[crm-hub] experience/decision payload merge skipped", mergeErr);
  }

  await importHubPaymentProofs(pool, designLeadId, { ...body, _syncedAt: now });
  // Buffer converts still enter the finance queue (collection synced) but remain
  // not approval-ready until shortfall is closed (tenPercentMet gate).
  await markTenPercentCollectionComplete(pool, designLeadId);

  const historyNote =
    finance.mode === "BUFFER_9_9"
      ? `CRM Booking & Token synced at 9.9% buffer. Shortfall ₹${finance.shortfallAmount.toLocaleString("en-IN")} toward 10%.`
      : finance.extraAmountReceived > 0
        ? `CRM Booking & Token payment synced (full 10% + extra ₹${finance.extraAmountReceived.toLocaleString("en-IN")}).`
        : "CRM Booking & Token payment synced from Hub";

  await addLeadHistoryEvent(designLeadId, {
    id: `hub-payment-sync-${Date.now()}`,
    type: "note",
    taskName: "CRM Booking Payment Sync",
    milestoneName: "Pre 10%",
    timestamp: now.toISOString(),
    description: historyNote,
    user: { name: "CRM Hub" },
    details: {
      kind: "hub_payment_sync",
      bookingTokenRecordId,
      paymentHistoryId,
      financeSyncMode: finance.mode,
      shortfallAmount: finance.shortfallAmount,
      extraAmountReceived: finance.extraAmountReceived,
      bufferApplied: finance.bufferApplied,
    },
  });

  return {
    designLeadId,
    bookingTokenRecordId,
    financeSyncMode: finance.mode,
    shortfallRecorded: finance.shortfallAmount,
    extraAmountReceived: finance.extraAmountReceived,
  };
}

type TaskCompletion = { leadId: number; milestoneIndex: number; taskName: string; completedAt: Date | string };

function hasTask(completions: TaskCompletion[], leadId: number, milestone: number, task: string): boolean {
  return completions.some((c) => c.leadId === leadId && c.milestoneIndex === milestone && c.taskName === task);
}

function taskCompletedAt(completions: TaskCompletion[], leadId: number, milestone: number, task: string): Date | null {
  const row = completions.find((c) => c.leadId === leadId && c.milestoneIndex === milestone && c.taskName === task);
  if (!row?.completedAt) return null;
  const d = row.completedAt instanceof Date ? row.completedAt : new Date(row.completedAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function buildFinanceQueueRows(
  pool: Pool,
  tab: "pending" | "approved",
  filters: { customer?: string; submittedFrom?: string; submittedTo?: string },
) {
  const [syncRows] = await pool.query(
    `SELECT lead_id as leadId, booking_token_record_id as bookingTokenRecordId, crm_lead_type as crmLeadType,
            crm_lead_id as crmLeadId, amount_received as amountReceived, ten_percent_amount as tenPercentAmount,
            payment_payload as paymentPayload, synced_at as syncedAt
     FROM lead_hub_booking_sync`,
  );
  const syncByLead = new Map<number, Record<string, unknown>>();
  for (const row of syncRows as Record<string, unknown>[]) {
    syncByLead.set(Number(row.leadId), row);
  }

  if (syncByLead.size === 0) return [];

  const ids = Array.from(syncByLead.keys());
  const placeholders = ids.map(() => "?").join(",");
  const [leadRows] = await pool.query(
    `SELECT id, project_name as projectName, payload FROM leads WHERE id IN (${placeholders})`,
    ids,
  );

  const customerFilter = (filters.customer || "").trim().toLowerCase();
  const fromDate = filters.submittedFrom ? new Date(filters.submittedFrom) : null;
  const toDate = filters.submittedTo ? new Date(filters.submittedTo) : null;
  if (toDate) toDate.setHours(23, 59, 59, 999);

  const rows: Record<string, unknown>[] = [];

  for (const lead of leadRows as { id: number; projectName: string; payload: unknown }[]) {
    const leadId = lead.id;
    const sync = syncByLead.get(leadId);
    if (!sync) continue;

    const payload = parseLeadPayload(lead.payload);
    const financeApproved = await isCrmBookingFinanceApproved(pool, leadId, payload);
    if (tab === "pending" && financeApproved) continue;
    if (tab === "approved" && !financeApproved) continue;

    const fetched = (payload.fetchedData || {}) as Record<string, unknown>;
    const customerName =
      pickStr(fetched.customer_name, payload.customer_name, lead.projectName) || lead.projectName || "—";

    if (customerFilter && !customerName.toLowerCase().includes(customerFilter)) continue;

    let paymentPayload: Record<string, unknown> = {};
    if (sync.paymentPayload) {
      paymentPayload = parseLeadPayload(sync.paymentPayload);
    }
    const syncedAt = sync.syncedAt;
    const submittedDate =
      syncedAt instanceof Date ? syncedAt : syncedAt ? new Date(syncedAt as string) : null;

    if (fromDate && submittedDate && submittedDate < fromDate) continue;
    if (toDate && submittedDate && submittedDate > toDate) continue;

    const paymentHistory = Array.isArray(paymentPayload.paymentHistory) ? paymentPayload.paymentHistory : [];
    const tenPercentTarget =
      pickNum(sync.tenPercentAmount, paymentPayload.tenPercentAmount, paymentPayload.quoteAmount != null ? Number(paymentPayload.quoteAmount) * 0.1 : null) ?? 0;
    const totalPaid = pickNum(sync.amountReceived, paymentPayload.amountReceived) ?? 0;
    const remaining =
      pickNum(paymentPayload.remainingAmount, paymentPayload.shortfallAmount) ??
      Math.max(0, tenPercentTarget - totalPaid);
    const extraAmountReceived = pickNum(paymentPayload.extraAmountReceived, paymentPayload.extra_amount_received) ?? 0;
    const bookingApprovalMode = pickStr(paymentPayload.bookingApprovalMode, paymentPayload.booking_approval_mode) || null;
    const bufferApplied =
      paymentPayload.bufferApplied === true ||
      paymentPayload.buffer_applied === true ||
      bookingApprovalMode === "BUFFER_9_9";
    const tenPercentMet = tenPercentTarget > 0 ? totalPaid >= tenPercentTarget : totalPaid > 0;
    const hasCollection = totalPaid > 0 || paymentHistory.length > 0;

    const approvedAtRaw = payload.crm_booking_finance_approved_at;
    const approvedAt =
      typeof approvedAtRaw === "string" && approvedAtRaw.trim()
        ? new Date(approvedAtRaw)
        : null;

    let status = "Awaiting 10% payment";
    if (financeApproved) status = "Approved";
    else if (hasCollection && remaining <= 0) status = "Pending approval";
    else if (hasCollection && bufferApplied) status = "Buffer convert — shortfall due";
    else if (hasCollection) status = "Pending approval";

    const crmLeadType = pickStr(sync.crmLeadType, payload.crmLeadType);
    const crmLeadId = pickNum(sync.crmLeadId, payload.crmLeadId);

    rows.push({
      id: leadId,
      customerName,
      totalPaid,
      tenPercentTarget,
      remaining,
      extraAmountReceived,
      bookingApprovalMode,
      bufferApplied,
      financeBufferNote: pickStr(paymentPayload.financeBufferNote, paymentPayload.finance_buffer_note) || null,
      subs: paymentHistory.length || (hasCollection ? 1 : 0),
      status,
      submittedAt: submittedDate ? submittedDate.toISOString() : null,
      approvedAt: approvedAt && !Number.isNaN(approvedAt.getTime()) ? approvedAt.toISOString() : null,
      canApprove: !financeApproved && tenPercentMet && remaining <= 0,
      paymentSource: "crm_hub",
      crmRef: crmLeadType && crmLeadId != null ? `${crmLeadType}#${crmLeadId}` : null,
      bookingTokenRecordId: sync.bookingTokenRecordId ?? null,
    });
  }

  rows.sort((a, b) => {
    const ta = a.submittedAt ? new Date(String(a.submittedAt)).getTime() : 0;
    const tb = b.submittedAt ? new Date(String(b.submittedAt)).getTime() : 0;
    return tb - ta;
  });

  return rows;
}

/** Legacy `/api/leads/finance-10p-queue` — manual DQC1 path only (CRM leads use Sales Closure queue). */
export async function buildFinance10pQueueList(
  pool: Pool,
  relaxedApproval: boolean,
): Promise<
  {
    id: number;
    projectName: string;
    status: string;
    canApprove: boolean;
  }[]
> {
  const [allLeads] = await pool.query(
    "SELECT id, project_name as projectName FROM leads ORDER BY id ASC",
  );
  const [completions] = await pool.query(
    `SELECT lead_id as leadId, milestone_index as milestoneIndex, task_name as taskName
     FROM lead_task_completions
     WHERE (milestone_index = 1 AND task_name = 'DQC 1 approval')
        OR (milestone_index = 2 AND task_name IN ('10% payment collection', '10% payment approval'))`,
  );
  const compList = completions as TaskCompletion[];
  const hasDqc1 = (leadId: number) => hasTask(compList, leadId, 1, "DQC 1 approval");
  const hasCollection = (leadId: number) => hasTask(compList, leadId, 2, "10% payment collection");
  const hasApproval = (leadId: number) => hasTask(compList, leadId, 2, "10% payment approval");

  return (allLeads as { id: number; projectName: string }[])
    .filter((l) => hasDqc1(l.id) && !hasApproval(l.id))
    .map((l) => ({
      id: l.id,
      projectName: l.projectName || "—",
      status: hasCollection(l.id) ? "Pending approval" : "Pending upload",
      canApprove: relaxedApproval || hasCollection(l.id),
    }));
}

function crmPaymentSubmissionsFromPayload(
  paymentPayload: Record<string, unknown>,
  hubProofBaseUrl: string,
  defaultSubmittedAt: string | null,
  uploadIdByProofId: Map<string, number>,
  orderedUploadIds: number[],
): Record<string, unknown>[] {
  const paymentHistory = Array.isArray(paymentPayload.paymentHistory) ? paymentPayload.paymentHistory : [];
  let proofOffset = 0;
  return paymentHistory.map((entry, idx) => {
    if (!entry || typeof entry !== "object") return { id: String(idx), amount: 0 };
    const e = entry as Record<string, unknown>;
    const proofs = Array.isArray(e.proofs) ? (e.proofs as Record<string, unknown>[]) : [];
    let uploadId: number | null = null;
    for (const proof of proofs) {
      const proofId = pickStr(proof.id, proof.proofId);
      const mapped = proofId ? uploadIdByProofId.get(proofId) : undefined;
      if (mapped != null) {
        uploadId = mapped;
        break;
      }
    }
    if (uploadId == null && proofs.length > 0 && orderedUploadIds[proofOffset] != null) {
      uploadId = orderedUploadIds[proofOffset];
    }
    proofOffset += proofs.length;
    return {
      id: pickStr(e.id, String(idx + 1)),
      amount: pickNum(e.amount) ?? 0,
      cumulativeTotal: pickNum(e.cumulativeReceived, e.cumulativeTotal) ?? 0,
      mode: pickStr(e.paymentKind, e.source) || null,
      paymentReceived: pickStr(e.paymentKind, e.source) || "—",
      submittedAt: defaultSubmittedAt,
      remainingFor10Percent: pickNum(e.remainingAfter) ?? null,
      rejected: false,
      hasScreenshot: proofs.length > 0,
      uploadId,
      // Hub URLs need server-side proxy (browser cannot send x-api-key on <img>).
      screenshot: null,
    };
  });
}

async function loadHubProofUploads(
  pool: Pool,
  leadId: number,
): Promise<{ byProofId: Map<string, number>; orderedIds: number[] }> {
  const [rows] = await pool.query(
    `SELECT id, stored_name as storedName FROM lead_uploads WHERE lead_id = ? AND upload_type = 'hub_payment_proof' ORDER BY id ASC`,
    [leadId],
  );
  const byProofId = new Map<string, number>();
  const orderedIds: number[] = [];
  for (const row of rows as { id: number; storedName: string }[]) {
    orderedIds.push(row.id);
    if (row.storedName) byProofId.set(String(row.storedName), row.id);
  }
  return { byProofId, orderedIds };
}

async function mapCrmHubRowToSalesClosure(
  pool: Pool,
  lead: { id: number; projectName: string; projectStage?: string; payload?: unknown },
  sync: Record<string, unknown>,
  approvedTab: boolean,
): Promise<Record<string, unknown> | null> {
  const leadId = lead.id;
  const payload = parseLeadPayload(lead.payload);
  const financeApproved = await isCrmBookingFinanceApproved(pool, leadId, payload);
  if (approvedTab && !financeApproved) return null;
  if (!approvedTab && financeApproved) return null;

  const paymentPayload = parseLeadPayload(sync.paymentPayload);
  const hubProofBaseUrl = pickStr(paymentPayload.hubProofBaseUrl, envTrim("HUB_API_BASE_URL"), "http://localhost:8081");
  const syncedAt = sync.syncedAt instanceof Date ? sync.syncedAt : sync.syncedAt ? new Date(String(sync.syncedAt)) : null;
  const submittedAtIso =
    syncedAt && !Number.isNaN(syncedAt.getTime()) ? syncedAt.toISOString() : null;
  const amountPaid = pickNum(sync.amountReceived, paymentPayload.amountReceived) ?? 0;
  const tenPercentTarget =
    pickNum(sync.tenPercentAmount, paymentPayload.tenPercentAmount, paymentPayload.quoteAmount != null ? Number(paymentPayload.quoteAmount) * 0.1 : null) ?? 0;
  const remaining =
    pickNum(paymentPayload.remainingAmount, paymentPayload.shortfallAmount) ??
    Math.max(0, tenPercentTarget - amountPaid);
  const extraAmountReceived = pickNum(paymentPayload.extraAmountReceived, paymentPayload.extra_amount_received) ?? 0;
  const bookingApprovalMode = pickStr(paymentPayload.bookingApprovalMode, paymentPayload.booking_approval_mode) || null;
  const bufferApplied =
    paymentPayload.bufferApplied === true ||
    paymentPayload.buffer_applied === true ||
    bookingApprovalMode === "BUFFER_9_9";
  const tenPercentMet = tenPercentTarget > 0 ? amountPaid >= tenPercentTarget : amountPaid > 0;
  const approvedAtRaw = payload.crm_booking_finance_approved_at;
  const approvalAt =
    typeof approvedAtRaw === "string" && approvedAtRaw.trim()
      ? new Date(approvedAtRaw)
      : null;
  const customerName =
    pickStr(paymentPayload.customerName, (paymentPayload.fetchedData as Record<string, unknown>)?.customer_name) ||
    lead.projectName ||
    "—";
  const { byProofId: uploadIdByProofId, orderedIds: orderedUploadIds } = await loadHubProofUploads(pool, leadId);
  const submissions = crmPaymentSubmissionsFromPayload(
    paymentPayload,
    hubProofBaseUrl,
    submittedAtIso,
    uploadIdByProofId,
    orderedUploadIds,
  );
  const firstUploadId = submissions.find((s) => s.uploadId != null)?.uploadId ?? null;

  return {
    id: leadId,
    projectName: lead.projectName || customerName,
    customerName,
    projectStage: financeApproved ? "10-20%" : lead.projectStage || "Pre 10%",
    financeApproved,
    status: financeApproved
      ? "Approved — moved to 10–20%"
      : tenPercentMet
        ? "Ready for approval (10% paid)"
        : bufferApplied
          ? "Buffer convert — shortfall due"
          : "Awaiting 10% payment",
    paymentReceived: pickStr(paymentPayload.paymentKind) || "—",
    paymentMode: pickStr(paymentPayload.paymentKind) || "—",
    paymentScreenshot: firstUploadId,
    amountPaid,
    tenPercentTarget,
    remainingFor10Percent: financeApproved ? 0 : remaining,
    extraAmountReceived,
    bookingApprovalMode,
    bufferApplied,
    financeBufferNote: pickStr(paymentPayload.financeBufferNote, paymentPayload.finance_buffer_note) || null,
    paymentPercentOfQuotation: null,
    tenPercentMet: financeApproved ? true : tenPercentMet,
    canApprove: !financeApproved && tenPercentMet,
    submittedAt: submittedAtIso,
    approvedAt: approvalAt && !Number.isNaN(approvalAt.getTime()) ? approvalAt.toISOString() : null,
    bookingDate: null,
    submissionCount: submissions.length,
    paymentSubmissions: submissions,
    paymentSource: "crm_hub",
    crmRef:
      sync.crmLeadType && sync.crmLeadId != null ? `${sync.crmLeadType}#${sync.crmLeadId}` : null,
    bookingTokenRecordId: sync.bookingTokenRecordId ?? null,
  };
}

/** CRM hub leads for `/api/leads/finance-sales-closure-queue`. */
export async function buildCrmSalesClosureQueueRows(
  pool: Pool,
  approved: boolean,
  filters: { customerName?: string; month?: string; dateFrom?: string; dateTo?: string },
): Promise<Record<string, unknown>[]> {
  const [syncRows] = await pool.query(
    `SELECT lead_id as leadId, booking_token_record_id as bookingTokenRecordId, crm_lead_type as crmLeadType,
            crm_lead_id as crmLeadId, amount_received as amountReceived, ten_percent_amount as tenPercentAmount,
            payment_payload as paymentPayload, synced_at as syncedAt
     FROM lead_hub_booking_sync`,
  );
  if ((syncRows as unknown[]).length === 0) return [];

  const syncByLead = new Map<number, Record<string, unknown>>();
  for (const row of syncRows as Record<string, unknown>[]) {
    syncByLead.set(Number(row.leadId), row);
  }

  const ids = Array.from(syncByLead.keys());
  const placeholders = ids.map(() => "?").join(",");
  const [leadRows] = await pool.query(
    `SELECT id, project_name as projectName, project_stage as projectStage, payload FROM leads WHERE id IN (${placeholders})`,
    ids,
  );

  const customerFilter = (filters.customerName || "").trim().toLowerCase();
  const month = (filters.month || "").trim();
  const fromDate = filters.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom) ? new Date(filters.dateFrom) : null;
  const toDate = filters.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo) ? new Date(filters.dateTo) : null;
  if (toDate) toDate.setHours(23, 59, 59, 999);

  const rows: Record<string, unknown>[] = [];
  for (const lead of leadRows as { id: number; projectName: string; projectStage?: string; payload?: unknown }[]) {
    const sync = syncByLead.get(lead.id);
    if (!sync) continue;
    const mapped = await mapCrmHubRowToSalesClosure(pool, lead, sync, approved);
    if (!mapped) continue;

    if (customerFilter) {
      const name = String(mapped.customerName || mapped.projectName || "").toLowerCase();
      if (!name.includes(customerFilter)) continue;
    }

    const submittedAt = mapped.submittedAt ? new Date(String(mapped.submittedAt)) : null;
    if (month && /^\d{4}-\d{2}$/.test(month) && submittedAt) {
      const ym = `${submittedAt.getFullYear()}-${String(submittedAt.getMonth() + 1).padStart(2, "0")}`;
      if (ym !== month) continue;
    }
    if (fromDate && submittedAt && submittedAt < fromDate) continue;
    if (toDate && submittedAt && submittedAt > toDate) continue;

    rows.push(mapped);
  }

  rows.sort((a, b) => {
    const ta = a.submittedAt ? new Date(String(a.submittedAt)).getTime() : 0;
    const tb = b.submittedAt ? new Date(String(b.submittedAt)).getTime() : 0;
    return tb - ta;
  });

  return rows;
}

export async function buildCrmSalesClosureLeadDetail(
  pool: Pool,
  leadId: number,
): Promise<Record<string, unknown> | null> {
  const [syncRows] = await pool.query(
    `SELECT booking_token_record_id as bookingTokenRecordId, crm_lead_type as crmLeadType, crm_lead_id as crmLeadId,
            amount_received as amountReceived, ten_percent_amount as tenPercentAmount,
            payment_payload as paymentPayload, synced_at as syncedAt
     FROM lead_hub_booking_sync WHERE lead_id = ? ORDER BY synced_at DESC LIMIT 1`,
    [leadId],
  );
  const sync = (syncRows as Record<string, unknown>[])[0];
  if (!sync) return null;

  const [leadRows] = await pool.query(
    `SELECT id, project_name as projectName, project_stage as projectStage, payload FROM leads WHERE id = ? LIMIT 1`,
    [leadId],
  );
  const lead = (leadRows as { id: number; projectName: string; projectStage?: string; payload?: unknown }[])[0];
  if (!lead) return null;

  const payload = parseLeadPayload(lead.payload);
  const financeApproved = await isCrmBookingFinanceApproved(pool, leadId, payload);
  return mapCrmHubRowToSalesClosure(pool, lead, sync, financeApproved);
}

export async function notifyHubFinanceReview(
  pool: Pool,
  leadId: number,
  status: "APPROVED" | "REJECTED",
  reviewedBy: string,
  reason?: string | null,
): Promise<void> {
  const [rows] = await pool.query(
    `SELECT booking_token_record_id as bookingTokenRecordId, payment_history_id as paymentHistoryId
     FROM lead_hub_booking_sync WHERE lead_id = ? ORDER BY synced_at DESC LIMIT 1`,
    [leadId],
  );
  const row = (rows as { bookingTokenRecordId?: string; paymentHistoryId?: string | null }[])[0];
  if (!row?.bookingTokenRecordId) return;

  const hubBase = envTrim("HUB_API_BASE_URL") || "http://localhost:8081";
  const url = `${hubBase.replace(/\/$/, "")}/api/crm/booking-token/internal/finance-review`;
  const apiKey = expectedHubApiKey();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        bookingTokenRecordId: row.bookingTokenRecordId,
        paymentHistoryId: row.paymentHistoryId ?? null,
        status,
        reviewedBy,
        reason: reason ?? null,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[crm-hub] Hub finance-review callback failed:", res.status, text);
    }
  } catch (err) {
    console.error("[crm-hub] Hub finance-review callback error:", err);
  }
}

type RefundSyncResult = {
  refundId: string;
  refundAmount: number;
  designLeadId: number;
  bookingTokenRecordId: string;
  alreadyProcessed?: boolean;
};

function paymentHistoryEntries(body: HubLeadBody): Record<string, unknown>[] {
  const raw = body.paymentHistory ?? body.payment_history;
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && typeof e === "object") as Record<string, unknown>[];
}

function cancelledPaymentIds(body: HubLeadBody): string[] {
  const raw = body.cancelledPaymentEntryIds ?? body.cancelled_payment_entry_ids;
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => String(id).trim()).filter(Boolean);
}

function resolveRefundAmounts(body: HubLeadBody): {
  refundScope: string;
  refundAmount: number;
  amountTowardTenRefund: number;
  extraAmountRefund: number;
  selectedPayments: Record<string, unknown>[];
} {
  const refundScope = (pickStr(body.refundScope, body.refund_scope) || "deal").toLowerCase();
  const history = paymentHistoryEntries(body);
  const cancelledIds = cancelledPaymentIds(body);

  let selectedPayments = history;
  if (refundScope === "payments") {
    if (cancelledIds.length === 0) {
      throw new Error("No payments to refund");
    }
    const idSet = new Set(cancelledIds);
    selectedPayments = history.filter((p) => idSet.has(pickStr(p.id, p.paymentHistoryId, p.payment_history_id)));
    if (selectedPayments.length === 0) {
      throw new Error("No payments to refund");
    }
  }

  const summedSelected = selectedPayments.reduce((sum, p) => sum + (pickNum(p.amount) ?? 0), 0);
  const summedExtraSelected = selectedPayments.reduce((sum, p) => sum + (pickNum(p.extraAmount, p.extra_amount) ?? 0), 0);

  const explicitRefund = pickNum(body.refundAmount, body.refund_amount);
  const totalAmountReceived = pickNum(body.totalAmountReceived, body.total_amount_received);
  const amountReceived = pickNum(body.amountReceived, body.amount_received) ?? 0;
  const extraReceived = Math.max(0, pickNum(body.extraAmountReceived, body.extra_amount_received) ?? 0);

  let refundAmount =
    explicitRefund ??
    (refundScope === "payments" && selectedPayments.length > 0
      ? summedSelected
      : totalAmountReceived ?? amountReceived + extraReceived);

  // Never refund shortfall — only what customer paid
  if (refundAmount == null || !Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new Error("No payments to refund");
  }
  refundAmount = Math.max(0, refundAmount);

  const amountTowardTenRefund =
    pickNum(body.amountTowardTenRefund, body.amount_toward_ten_refund) ??
    (refundScope === "payments"
      ? Math.max(0, summedSelected - summedExtraSelected)
      : Math.max(0, amountReceived));

  const extraAmountRefund =
    pickNum(body.extraAmountRefund, body.extra_amount_refund) ??
    (refundScope === "payments" ? summedExtraSelected : extraReceived);

  if (refundAmount <= 0) throw new Error("No payments to refund");

  return {
    refundScope,
    refundAmount,
    amountTowardTenRefund: Math.max(0, amountTowardTenRefund),
    extraAmountRefund: Math.max(0, extraAmountRefund),
    selectedPayments,
  };
}

async function findExistingRefundByBookingToken(
  pool: Pool,
  bookingTokenRecordId: string,
  refundScope: string,
): Promise<RefundSyncResult | null> {
  const [rows] = await pool.query(
    `SELECT refund_key as refundKey, refund_amount as refundAmount, lead_id as leadId,
            booking_token_record_id as bookingTokenRecordId, status
     FROM lead_hub_booking_refunds
     WHERE booking_token_record_id = ?
       AND LOWER(COALESCE(refund_scope, 'deal')) = ?
     ORDER BY id DESC LIMIT 1`,
    [bookingTokenRecordId, refundScope.toLowerCase()],
  );
  const row = (rows as {
    refundKey?: string;
    refundAmount?: number;
    leadId?: number;
    bookingTokenRecordId?: string;
  }[])[0];
  if (!row?.refundKey) return null;
  return {
    refundId: String(row.refundKey),
    refundAmount: Number(row.refundAmount) || 0,
    designLeadId: Number(row.leadId) || 0,
    bookingTokenRecordId: String(row.bookingTokenRecordId || bookingTokenRecordId),
    alreadyProcessed: true,
  };
}

async function applyFinanceRefundApproval(
  pool: Pool,
  refund: {
    id: number;
    refundKey: string;
    leadId: number;
    refundAmount: number;
    amountTowardTen: number;
    extraAmount: number;
    refundScope: string;
    refundPayload: unknown;
  },
  approvedBy: string,
  addLeadHistoryEvent: RouteDeps["addLeadHistoryEvent"],
): Promise<void> {
  const now = new Date();
  const body = parseLeadPayload(refund.refundPayload);
  const refundScope = (refund.refundScope || "deal").toLowerCase();

  await pool.query(
    `UPDATE lead_hub_booking_refunds
     SET status = 'APPROVED',
         finance_approved_at = ?,
         finance_approved_by = ?
     WHERE id = ? AND UPPER(COALESCE(status, 'PENDING')) = 'PENDING'`,
    [now, approvedBy, refund.id],
  );

  if (refundScope !== "payments") {
    await pool.query(
      `DELETE FROM lead_task_completions
       WHERE lead_id = ?
         AND milestone_index = 2
         AND task_name IN ('10% payment collection', '10% payment approval')`,
      [refund.leadId],
    );
  }

  try {
    const [leadRows] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [refund.leadId]);
    const prev = parseLeadPayload((leadRows as { payload?: unknown }[])[0]?.payload);
    const prevRefunds = Array.isArray(prev.booking_refunds) ? [...prev.booking_refunds] : [];
    const refundRecord = {
      refundId: refund.refundKey,
      refundAmount: refund.refundAmount,
      amountTowardTenRefund: refund.amountTowardTen,
      extraAmountRefund: refund.extraAmount,
      refundScope,
      status: "APPROVED",
      financeApprovedAt: now.toISOString(),
      financeApprovedBy: approvedBy,
      syncedAt: now.toISOString(),
    };
    const idx = prevRefunds.findIndex(
      (r) => r && typeof r === "object" && (r as { refundId?: string }).refundId === refund.refundKey,
    );
    if (idx >= 0) prevRefunds[idx] = { ...(prevRefunds[idx] as object), ...refundRecord };
    else prevRefunds.push(refundRecord);

    const merged: Record<string, unknown> = {
      ...prev,
      booking_cancelled: refundScope !== "payments" ? true : prev.booking_cancelled === true,
      booking_refund: refundRecord,
      booking_refunds: prevRefunds,
      refund_pending: false,
    };
    if (refundScope !== "payments") {
      merged.ten_percent_payment_met = false;
      merged.shortfall_toward_10_percent = null;
      merged.sales_closure_finance_approved = false;
      merged.total_paid_toward_10_percent = 0;
      merged.amount_paid = 0;
      merged.extra_amount_received = 0;
      merged.finance_extra_amount = 0;
      merged.total_paid_cumulative = 0;
      merged.total_customer_paid = 0;
      merged.remaining_for_10_percent =
        pickNum(prev.ten_percent_target) ?? prev.remaining_for_10_percent ?? null;
    } else {
      const prevToward = pickNum(prev.total_paid_toward_10_percent, prev.amount_paid) ?? 0;
      const prevExtra = pickNum(prev.extra_amount_received, prev.finance_extra_amount) ?? 0;
      const nextToward = Math.max(0, prevToward - refund.amountTowardTen);
      const nextExtra = Math.max(0, prevExtra - refund.extraAmount);
      merged.total_paid_toward_10_percent = nextToward;
      merged.amount_paid = nextToward;
      merged.extra_amount_received = nextExtra;
      merged.finance_extra_amount = nextExtra;
      const tenTarget = pickNum(prev.ten_percent_target) ?? 0;
      merged.ten_percent_payment_met = tenTarget > 0 ? nextToward >= tenTarget : false;
      merged.remaining_for_10_percent = tenTarget > 0 ? Math.max(0, tenTarget - nextToward) : 0;
    }
    await pool.query(`UPDATE leads SET payload = ?, update_at = ? WHERE id = ?`, [
      JSON.stringify(merged),
      now,
      refund.leadId,
    ]);
  } catch (payloadErr) {
    console.warn("[crm-hub] refund approve payload merge skipped", payloadErr);
  }

  await addLeadHistoryEvent(refund.leadId, {
    id: `hub-refund-approved-${Date.now()}`,
    type: "note",
    taskName: "Booking cancellation refund",
    milestoneName: "10% PAYMENT",
    timestamp: now.toISOString(),
    description: `Finance approved refund ₹${refund.refundAmount.toLocaleString("en-IN")} (${refund.refundKey}).`,
    user: { name: approvedBy },
    details: {
      kind: "hub_refund_approved",
      refundId: refund.refundKey,
      refundAmount: refund.refundAmount,
      fromPayload: !!body.eventType,
    },
  });
}

async function handleFinanceRefundSync(
  pool: Pool,
  body: HubLeadBody,
  addLeadHistoryEvent: RouteDeps["addLeadHistoryEvent"],
): Promise<RefundSyncResult> {
  const bookingTokenRecordId = pickStr(body.bookingTokenRecordId, body.recordId);
  if (!bookingTokenRecordId) throw new Error("bookingTokenRecordId is required");

  await ensureLeadHubBookingRefundTable(pool);

  const { refundScope, refundAmount, amountTowardTenRefund, extraAmountRefund, selectedPayments } =
    resolveRefundAmounts(body);

  // Idempotency: same deal + scope already synced (pending or approved) → return same refundId
  const existing = await findExistingRefundByBookingToken(pool, bookingTokenRecordId, refundScope);
  if (existing) {
    return existing;
  }

  const leadType = pickStr(body.leadType, body.crmLeadType) || null;
  const leadIdNum = pickNum(body.leadId, body.crmLeadId);
  const leadIdentifier = pickStr(body.leadIdentifier, body.externalReferenceId, body.pid) || null;
  const customerName = pickStr(body.customerName, body.projectName) || null;

  let designLeadId = await resolveDesignLeadIdForHubSync(pool, body);
  if (!designLeadId) {
    const [byToken] = await pool.query(
      `SELECT lead_id as leadId FROM lead_hub_booking_sync WHERE booking_token_record_id = ? LIMIT 1`,
      [bookingTokenRecordId],
    );
    designLeadId = Number((byToken as { leadId?: number }[])[0]?.leadId) || 0;
  }
  if (!designLeadId) throw new Error("Design lead not found for refund sync");

  const now = new Date();
  const cancelledAtRaw = pickStr(body.cancelledAt, body.cancelled_at);
  const approvedAtRaw = pickStr(body.cancellationApprovedAt, body.cancellation_approved_at);
  const cancelledAt = cancelledAtRaw ? new Date(cancelledAtRaw) : null;
  const cancellationApprovedAt = approvedAtRaw ? new Date(approvedAtRaw) : now;
  const cancellationReason = pickStr(body.cancellationReason, body.cancellation_reason) || null;
  const cancellationApprovedBy =
    pickStr(body.cancellationApprovedBy, body.cancellation_approved_by) || "CRM Hub";

  const paymentIdSuffix =
    refundScope === "payments"
      ? cancelledPaymentIds(body).slice().sort().join("-").slice(0, 40) || "partial"
      : "deal";
  const refundKey =
    pickStr(body.refundId, body.refund_id) || `ref-${bookingTokenRecordId.slice(0, 8)}-${paymentIdSuffix}`;

  // Double-check by refund_key uniqueness
  const [byKey] = await pool.query(
    `SELECT refund_key as refundKey, refund_amount as refundAmount, lead_id as leadId,
            booking_token_record_id as bookingTokenRecordId
     FROM lead_hub_booking_refunds WHERE refund_key = ? LIMIT 1`,
    [refundKey],
  );
  const keyHit = (byKey as { refundKey?: string; refundAmount?: number; leadId?: number; bookingTokenRecordId?: string }[])[0];
  if (keyHit?.refundKey) {
    return {
      refundId: String(keyHit.refundKey),
      refundAmount: Number(keyHit.refundAmount) || refundAmount,
      designLeadId: Number(keyHit.leadId) || designLeadId,
      bookingTokenRecordId: String(keyHit.bookingTokenRecordId || bookingTokenRecordId),
      alreadyProcessed: true,
    };
  }

  let refundRowId = 0;
  try {
    const [insertResult] = await pool.query(
      `INSERT INTO lead_hub_booking_refunds
       (refund_key, lead_id, booking_token_record_id, crm_lead_type, crm_lead_id, lead_identifier, customer_name,
        refund_amount, amount_toward_ten_refund, extra_refund_amount,
        cancellation_reason, cancelled_at, cancellation_approved_at, cancellation_approved_by,
        refund_scope, status, refund_payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [
        refundKey,
        designLeadId,
        bookingTokenRecordId,
        leadType,
        leadIdNum,
        leadIdentifier,
        customerName,
        refundAmount,
        amountTowardTenRefund,
        extraAmountRefund,
        cancellationReason,
        cancelledAt && !Number.isNaN(cancelledAt.getTime()) ? cancelledAt : null,
        cancellationApprovedAt && !Number.isNaN(cancellationApprovedAt.getTime())
          ? cancellationApprovedAt
          : now,
        cancellationApprovedBy,
        refundScope,
        JSON.stringify(body),
        now,
      ],
    );
    refundRowId = Number((insertResult as { insertId?: number })?.insertId) || 0;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") {
      const again =
        (await findExistingRefundByBookingToken(pool, bookingTokenRecordId, refundScope)) ||
        ({
          refundId: refundKey,
          refundAmount,
          designLeadId,
          bookingTokenRecordId,
          alreadyProcessed: true,
        } satisfies RefundSyncResult);
      return again;
    }
    throw err;
  }

  for (const payment of selectedPayments) {
    const paymentHistoryId = pickStr(payment.id, payment.paymentHistoryId, payment.payment_history_id) || "unknown";
    const amount = pickNum(payment.amount) ?? 0;
    const extraAmount = pickNum(payment.extraAmount, payment.extra_amount) ?? 0;
    const proofs = Array.isArray(payment.proofs) ? payment.proofs : [];
    if (refundRowId > 0) {
      await pool.query(
        `INSERT INTO lead_hub_booking_refund_lines
         (refund_id, payment_history_id, amount, extra_amount, proof_refs)
         VALUES (?, ?, ?, ?, ?)`,
        [refundRowId, paymentHistoryId, amount, extraAmount, JSON.stringify(proofs)],
      );
    }
  }

  // CRM sync only queues refund for Finance approval — ledger reversal happens on Approve.
  try {
    const [leadRows] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [designLeadId]);
    const prev = parseLeadPayload((leadRows as { payload?: unknown }[])[0]?.payload);
    const prevRefunds = Array.isArray(prev.booking_refunds) ? prev.booking_refunds : [];
    const refundRecord = {
      refundId: refundKey,
      refundAmount,
      amountTowardTenRefund,
      extraAmountRefund,
      cancellationReason,
      cancelledAt: cancelledAtRaw || null,
      cancellationApprovedAt: approvedAtRaw || now.toISOString(),
      cancellationApprovedBy,
      refundScope,
      cancelledPaymentEntryIds: cancelledPaymentIds(body),
      bookingApprovalMode: pickStr(body.bookingApprovalMode) || null,
      bufferApplied: body.bufferApplied === true,
      syncedAt: now.toISOString(),
      status: "PENDING",
    };
    const merged: Record<string, unknown> = {
      ...prev,
      refund_pending: true,
      booking_refund: refundRecord,
      booking_refunds: [...prevRefunds, refundRecord],
    };
    await pool.query(`UPDATE leads SET payload = ?, update_at = ? WHERE id = ?`, [
      JSON.stringify(merged),
      now,
      designLeadId,
    ]);
  } catch (payloadErr) {
    console.warn("[crm-hub] refund payload merge skipped", payloadErr);
  }

  await addLeadHistoryEvent(designLeadId, {
    id: `hub-refund-sync-${Date.now()}`,
    type: "note",
    taskName: "Booking cancellation refund",
    milestoneName: "10% PAYMENT",
    timestamp: now.toISOString(),
    description: `CRM cancel approved — refund ₹${refundAmount.toLocaleString("en-IN")} queued for Finance approval (10% ₹${amountTowardTenRefund.toLocaleString("en-IN")}${
      extraAmountRefund > 0 ? ` + extra ₹${extraAmountRefund.toLocaleString("en-IN")}` : ""
    }, scope: ${refundScope}).`,
    user: { name: cancellationApprovedBy },
    details: {
      kind: "hub_refund_sync",
      eventType: pickStr(body.eventType) || "refund_processed",
      bookingTokenRecordId,
      refundId: refundKey,
      refundAmount,
      amountTowardTenRefund,
      extraAmountRefund,
      cancellationReason,
      refundScope,
      status: "PENDING",
      cancelledPaymentEntryIds: cancelledPaymentIds(body),
    },
  });

  return {
    refundId: refundKey,
    refundAmount,
    designLeadId,
    bookingTokenRecordId,
  };
}

async function listFinanceRefunds(
  pool: Pool,
  filters: { customer?: string; status?: string },
): Promise<Record<string, unknown>[]> {
  await ensureLeadHubBookingRefundTable(pool);
  const [rows] = await pool.query(
    `SELECT id, refund_key as refundId, lead_id as designLeadId, booking_token_record_id as bookingTokenRecordId,
            crm_lead_type as crmLeadType, crm_lead_id as crmLeadId, lead_identifier as leadIdentifier,
            customer_name as customerName, refund_amount as refundAmount,
            amount_toward_ten_refund as amountTowardTenRefund, extra_refund_amount as extraAmountRefund,
            cancellation_reason as cancellationReason, cancelled_at as cancelledAt,
            cancellation_approved_at as cancellationApprovedAt, cancellation_approved_by as cancellationApprovedBy,
            finance_approved_at as financeApprovedAt, finance_approved_by as financeApprovedBy,
            refund_scope as refundScope, status, created_at as createdAt
     FROM lead_hub_booking_refunds
     ORDER BY id DESC
     LIMIT 200`,
  );
  const customerFilter = (filters.customer || "").trim().toLowerCase();
  const statusFilter = (filters.status || "").trim().toUpperCase();
  return (rows as Record<string, unknown>[]).filter((r) => {
    if (customerFilter) {
      const name = String(r.customerName || "").toLowerCase();
      if (!name.includes(customerFilter)) return false;
    }
    const st = String(r.status || "PENDING").toUpperCase();
    if (statusFilter === "PENDING") {
      return st === "PENDING";
    }
    if (statusFilter === "APPROVED" || statusFilter === "HISTORY") {
      // Legacy PROCESSED rows count as approved history
      return st === "APPROVED" || st === "PROCESSED";
    }
    if (statusFilter && st !== statusFilter) return false;
    return true;
  });
}

async function countPendingFinanceRefunds(pool: Pool): Promise<number> {
  await ensureLeadHubBookingRefundTable(pool);
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt FROM lead_hub_booking_refunds
     WHERE UPPER(COALESCE(status, 'PENDING')) = 'PENDING'`,
  );
  return Number((rows as { cnt?: number }[])[0]?.cnt) || 0;
}

export async function getHubBookingSyncForLead(pool: Pool, leadId: number) {
  const [rows] = await pool.query(
    `SELECT booking_token_record_id as bookingTokenRecordId, payment_history_id as paymentHistoryId
     FROM lead_hub_booking_sync WHERE lead_id = ? ORDER BY synced_at DESC LIMIT 1`,
    [leadId],
  );
  return (rows as Record<string, unknown>[])[0] ?? null;
}

export function registerCrmHubBookingRoutes(app: Express, deps: RouteDeps): void {
  const { pool, getUserFromSession, addLeadHistoryEvent } = deps;

  void ensureLeadHubBookingSyncTable(pool).catch((err) => {
    console.error("[crm-hub] Failed to ensure lead_hub_booking_sync table:", err);
  });
  void ensureLeadHubBookingRefundTable(pool).catch((err) => {
    console.error("[crm-hub] Failed to ensure lead_hub_booking_refunds table:", err);
  });

  app.post("/api/hub/crm-lead/upsert", requireHubApiKey, async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as HubLeadBody;
      const { designLeadId, created } = await upsertCrmDesignLead(pool, body, addLeadHistoryEvent);
      return res.json({ ok: true, designLeadId, created });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upsert failed";
      console.error("[crm-hub] upsert error:", err);
      return res.status(400).json({ ok: false, message: msg });
    }
  });

  const convertHandler = async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as HubLeadBody;
      const result = await handleConvertBooking(pool, body, addLeadHistoryEvent);
      return res.json({ ok: true, ...result });
    } catch (err) {
      if (isTransientDbError(err)) {
        console.error("[crm-hub] convert-booking DB connection error:", err);
        return res.status(503).json({
          ok: false,
          message: "Database connection lost. Wait a few seconds and retry Convert to Booking.",
        });
      }
      const msg = err instanceof Error ? err.message : "Convert booking sync failed";
      console.error("[crm-hub] convert-booking error:", err);
      return res.status(400).json({ ok: false, message: msg });
    }
  };

  app.post("/api/hub/crm-lead/convert-booking", requireHubApiKey, convertHandler);
  app.post("/api/hub/booking-token/finance-10p-sync", requireHubApiKey, convertHandler);

  const refundHandler = async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as HubLeadBody;
      const result = await handleFinanceRefundSync(pool, body, addLeadHistoryEvent);
      return res.json({
        ok: true,
        refundId: result.refundId,
        refundAmount: result.refundAmount,
        designLeadId: result.designLeadId,
        bookingTokenRecordId: result.bookingTokenRecordId,
      });
    } catch (err) {
      if (isTransientDbError(err)) {
        console.error("[crm-hub] finance-refund-sync DB connection error:", err);
        return res.status(503).json({
          ok: false,
          message: "Database connection lost. Wait a few seconds and retry refund sync.",
        });
      }
      const msg = err instanceof Error ? err.message : "Finance refund sync failed";
      console.error("[crm-hub] finance-refund-sync error:", err);
      // CRM contract: plain { message } on 400
      return res.status(400).json({ message: msg });
    }
  };

  app.post("/api/hub/booking-token/finance-refund-sync", requireHubApiKey, refundHandler);
  // CRM fallback when primary path 404s
  app.post("/api/hub/crm-lead/refund-booking", requireHubApiKey, refundHandler);

  app.get("/api/sales-closure/finance-refunds", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user.role ?? "").toLowerCase();
      if (role !== "finance" && role !== "admin") {
        return res.status(403).json({ message: "Only finance or admin can access refunds" });
      }
      const rows = await listFinanceRefunds(pool, {
        customer: String(req.query.customer || req.query.customerName || ""),
        status: String(req.query.status || ""),
      });
      return res.json(rows);
    } catch (err) {
      console.error("[crm-hub] finance-refunds list error:", err);
      return res.status(500).json({ message: "Failed to load finance refunds" });
    }
  });

  app.get("/api/sales-closure/finance-refunds/pending-count", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user.role ?? "").toLowerCase();
      if (role !== "finance" && role !== "admin") {
        return res.status(403).json({ message: "Only finance or admin can access refunds" });
      }
      const count = await countPendingFinanceRefunds(pool);
      return res.json({ count });
    } catch (err) {
      console.error("[crm-hub] finance-refunds pending-count error:", err);
      return res.status(500).json({ message: "Failed to load pending refund count" });
    }
  });

  app.post("/api/sales-closure/finance-refunds/:refundId/approve", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user.role ?? "").toLowerCase();
      if (role !== "finance" && role !== "admin") {
        return res.status(403).json({ message: "Only finance or admin can approve refunds" });
      }
      const refundKey = String(req.params.refundId || "").trim();
      if (!refundKey) return res.status(400).json({ message: "Invalid refund id" });
      await ensureLeadHubBookingRefundTable(pool);
      const [rows] = await pool.query(
        `SELECT id, refund_key as refundKey, lead_id as leadId, refund_amount as refundAmount,
                amount_toward_ten_refund as amountTowardTen, extra_refund_amount as extraAmount,
                refund_scope as refundScope, status, refund_payload as refundPayload
         FROM lead_hub_booking_refunds WHERE refund_key = ? OR CAST(id AS CHAR) = ? LIMIT 1`,
        [refundKey, refundKey],
      );
      const row = (rows as {
        id: number;
        refundKey: string;
        leadId: number;
        refundAmount: number;
        amountTowardTen: number;
        extraAmount: number;
        refundScope: string;
        status: string;
        refundPayload: unknown;
      }[])[0];
      if (!row) return res.status(404).json({ message: "Refund not found" });
      const st = String(row.status || "").toUpperCase();
      if (st === "APPROVED" || st === "PROCESSED") {
        return res.json({
          ok: true,
          refundId: row.refundKey,
          status: "APPROVED",
          alreadyApproved: true,
        });
      }
      if (st !== "PENDING") {
        return res.status(400).json({ message: `Refund cannot be approved from status ${row.status}` });
      }
      const approvedBy = pickStr(user.name, user.email) || "Finance";
      await applyFinanceRefundApproval(
        pool,
        {
          id: row.id,
          refundKey: row.refundKey,
          leadId: row.leadId,
          refundAmount: Number(row.refundAmount) || 0,
          amountTowardTen: Number(row.amountTowardTen) || 0,
          extraAmount: Number(row.extraAmount) || 0,
          refundScope: String(row.refundScope || "deal"),
          refundPayload: row.refundPayload,
        },
        approvedBy,
        addLeadHistoryEvent,
      );
      return res.json({ ok: true, refundId: row.refundKey, status: "APPROVED" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve refund";
      console.error("[crm-hub] finance-refund approve error:", err);
      return res.status(400).json({ message: msg });
    }
  });

  app.get("/api/sales-closure/finance-refunds/:refundId", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user.role ?? "").toLowerCase();
      if (role !== "finance" && role !== "admin") {
        return res.status(403).json({ message: "Only finance or admin can access refunds" });
      }
      const refundKey = String(req.params.refundId || "").trim();
      if (!refundKey) return res.status(400).json({ message: "Invalid refund id" });
      await ensureLeadHubBookingRefundTable(pool);
      const [rows] = await pool.query(
        `SELECT id, refund_key as refundId, lead_id as designLeadId, booking_token_record_id as bookingTokenRecordId,
                crm_lead_type as crmLeadType, crm_lead_id as crmLeadId, lead_identifier as leadIdentifier,
                customer_name as customerName, refund_amount as refundAmount,
                amount_toward_ten_refund as amountTowardTenRefund, extra_refund_amount as extraAmountRefund,
                cancellation_reason as cancellationReason, cancelled_at as cancelledAt,
                cancellation_approved_at as cancellationApprovedAt, cancellation_approved_by as cancellationApprovedBy,
                finance_approved_at as financeApprovedAt, finance_approved_by as financeApprovedBy,
                refund_scope as refundScope, status, refund_payload as refundPayload, created_at as createdAt
         FROM lead_hub_booking_refunds WHERE refund_key = ? OR CAST(id AS CHAR) = ? LIMIT 1`,
        [refundKey, refundKey],
      );
      const refund = (rows as Record<string, unknown>[])[0];
      if (!refund) return res.status(404).json({ message: "Refund not found" });
      const [lines] = await pool.query(
        `SELECT payment_history_id as paymentHistoryId, amount, extra_amount as extraAmount, proof_refs as proofRefs
         FROM lead_hub_booking_refund_lines WHERE refund_id = ?`,
        [refund.id],
      );
      const payload = parseLeadPayload(refund.refundPayload);
      delete refund.refundPayload;
      return res.json({
        ...refund,
        paymentLines: lines,
        paymentHistory: Array.isArray(payload.paymentHistory) ? payload.paymentHistory : [],
        cancelledPaymentEntryIds: payload.cancelledPaymentEntryIds ?? [],
      });
    } catch (err) {
      console.error("[crm-hub] finance-refund detail error:", err);
      return res.status(500).json({ message: "Failed to load refund" });
    }
  });

  app.get("/api/sales-closure/finance-queue", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user.role ?? "").toLowerCase();
      if (role !== "finance" && role !== "admin") {
        return res.status(403).json({ message: "Only finance or admin can access this queue" });
      }
      const tabRaw = String(req.query.tab || "pending").toLowerCase();
      const tab = tabRaw === "approved" ? "approved" : "pending";
      const rows = await buildFinanceQueueRows(pool, tab, {
        customer: String(req.query.customer || req.query.customerName || ""),
        submittedFrom: String(req.query.submittedFrom || req.query.dateFrom || ""),
        submittedTo: String(req.query.submittedTo || req.query.dateTo || ""),
      });
      return res.json(rows);
    } catch (err) {
      console.error("[crm-hub] finance-queue error:", err);
      return res.status(500).json({ message: "Failed to load finance queue" });
    }
  });

  app.get("/api/sales-closure/finance-queue/:leadId/payment-history", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user.role ?? "").toLowerCase();
      if (role !== "finance" && role !== "admin") {
        return res.status(403).json({ message: "Only finance or admin can access payment history" });
      }
      const leadId = Number(req.params.leadId);
      if (!Number.isFinite(leadId) || leadId < 1) {
        return res.status(400).json({ message: "Invalid lead ID" });
      }
      const [rows] = await pool.query(
        `SELECT payment_payload as paymentPayload, amount_received as amountReceived,
                ten_percent_amount as tenPercentAmount, booking_token_record_id as bookingTokenRecordId,
                payment_history_id as paymentHistoryId, synced_at as syncedAt,
                crm_lead_type as crmLeadType, crm_lead_id as crmLeadId
         FROM lead_hub_booking_sync WHERE lead_id = ? ORDER BY synced_at DESC LIMIT 1`,
        [leadId],
      );
      const sync = (rows as Record<string, unknown>[])[0];
      if (!sync) {
        return res.status(404).json({ message: "No CRM hub payment sync found for this lead" });
      }
      const payload = parseLeadPayload(sync.paymentPayload);
      const paymentHistory = Array.isArray(payload.paymentHistory) ? payload.paymentHistory : [];
      const hubProofBaseUrl = pickStr(payload.hubProofBaseUrl, envTrim("HUB_API_BASE_URL"), "http://localhost:8081");

      const enrichedHistory = paymentHistory.map((entry) => {
        if (!entry || typeof entry !== "object") return entry;
        const e = entry as Record<string, unknown>;
        const proofs = Array.isArray(e.proofs) ? e.proofs : [];
        return {
          ...e,
          proofs: proofs.map((proof) => {
            if (!proof || typeof proof !== "object") return proof;
            const p = proof as Record<string, unknown>;
            const contentPath = pickStr(p.contentPath, p.url);
            const url = contentPath.startsWith("http") ? contentPath : hubProofUrl(hubProofBaseUrl, contentPath);
            return { ...p, url };
          }),
        };
      });

      return res.json({
        leadId,
        bookingTokenRecordId: sync.bookingTokenRecordId,
        paymentHistoryId: sync.paymentHistoryId,
        crmRef:
          sync.crmLeadType && sync.crmLeadId != null
            ? `${sync.crmLeadType}#${sync.crmLeadId}`
            : null,
        amountReceived: sync.amountReceived,
        tenPercentAmount: sync.tenPercentAmount,
        remainingAmount: payload.remainingAmount ?? payload.shortfallAmount ?? null,
        shortfallAmount: payload.shortfallAmount ?? payload.remainingAmount ?? null,
        extraAmountReceived: payload.extraAmountReceived ?? 0,
        totalAmountReceived: payload.totalAmountReceived ?? null,
        bookingApprovalMode: payload.bookingApprovalMode ?? null,
        bufferApplied: payload.bufferApplied === true || payload.bookingApprovalMode === "BUFFER_9_9",
        bufferThresholdAmount: payload.bufferThresholdAmount ?? null,
        financeBufferNote: payload.financeBufferNote ?? null,
        syncedAt: sync.syncedAt,
        paymentHistory: enrichedHistory,
        quoteAmount: payload.quoteAmount ?? null,
        paymentKind: payload.paymentKind ?? null,
      });
    } catch (err) {
      console.error("[crm-hub] payment-history error:", err);
      return res.status(500).json({ message: "Failed to load payment history" });
    }
  });

  /** Re-import hub payment proofs from stored CRM sync payload (finance session). */
  app.post("/api/leads/:leadId/refresh-hub-payment-proofs", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user.role ?? "").toLowerCase();
      if (role !== "finance" && role !== "admin") {
        return res.status(403).json({ message: "Only finance or admin can refresh payment proofs" });
      }
      const leadId = Number(req.params.leadId);
      if (!Number.isFinite(leadId) || leadId < 1) {
        return res.status(400).json({ message: "Invalid lead ID" });
      }
      const proofCount = await refreshHubPaymentProofsFromSync(pool, leadId);
      return res.json({ ok: true, proofCount });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to refresh payment proofs";
      console.error("[crm-hub] refresh-hub-payment-proofs error:", err);
      return res.status(400).json({ message: msg });
    }
  });

  /** Proxy Hub payment proof images (Hub requires x-api-key; browser img tag cannot send it). */
  app.get("/api/leads/:leadId/hub-payment-proofs/:uploadId/content", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user.role ?? "").toLowerCase();
      if (role !== "finance" && role !== "admin") {
        return res.status(403).json({ message: "Only finance or admin can view payment proofs" });
      }
      const leadId = Number(req.params.leadId);
      const uploadId = Number(req.params.uploadId);
      if (!Number.isFinite(leadId) || !Number.isFinite(uploadId)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const [rows] = await pool.query(
        `SELECT stored_path as storedPath, s3_url as s3Url, mime_type as mimeType, original_name as originalName
         FROM lead_uploads WHERE id = ? AND lead_id = ? AND upload_type = 'hub_payment_proof' LIMIT 1`,
        [uploadId, leadId],
      );
      const row = (rows as { storedPath?: string; s3Url?: string; mimeType?: string; originalName?: string }[])[0];
      if (!row) return res.status(404).json({ message: "Hub payment proof not found" });
      const localPath =
        row.storedPath && !row.storedPath.startsWith("http") && fs.existsSync(row.storedPath)
          ? row.storedPath
          : null;
      if (localPath) {
        res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
        res.setHeader("Cache-Control", "private, max-age=300");
        return res.send(fs.readFileSync(localPath));
      }
      const [uploadMeta] = await pool.query(
        `SELECT stored_name as storedName FROM lead_uploads WHERE id = ? AND lead_id = ? LIMIT 1`,
        [uploadId, leadId],
      );
      const proofKey = String((uploadMeta as { storedName?: string }[])[0]?.storedName || uploadId);
      const inlineFromSync = await findInlineProofInSyncPayload(pool, leadId, proofKey);
      if (inlineFromSync) {
        await cacheHubProofUpload(pool, uploadId, leadId, proofKey, inlineFromSync.buffer, inlineFromSync.contentType);
        res.setHeader("Content-Type", inlineFromSync.contentType);
        res.setHeader("Cache-Control", "private, max-age=300");
        return res.send(inlineFromSync.buffer);
      }
      const hubUrl = pickStr(row.s3Url, row.storedPath);
      if (!hubUrl.startsWith("http")) {
        return res.status(404).json({ message: "Invalid Hub proof URL" });
      }
      const fetched = await fetchHubProofBuffer(hubUrl);
      if (fetched) {
        await cacheHubProofUpload(pool, uploadId, leadId, proofKey, fetched.buffer, fetched.contentType);
        res.setHeader("Content-Type", fetched.contentType);
        res.setHeader("Cache-Control", "private, max-age=300");
        return res.send(fetched.buffer);
      }
      if (!envTrim("HUB_PROOF_BEARER_TOKEN")) {
        console.error("[crm-hub] HUB_PROOF_BEARER_TOKEN is empty in backend/.env — set CRM crm_token there");
      }
      console.error("[crm-hub] Hub proof fetch failed:", hubUrl);
      return res.status(502).json({
        message:
          "Hub rejected proof download (401). Add HUB_PROOF_BEARER_TOKEN to backend/.env with a CRM session token (token_{userId}_{timestamp} from crm_token), or ask Hub team to allow x-api-key on proof download.",
      });
    } catch (err) {
      console.error("[crm-hub] hub proof proxy error:", err);
      return res.status(500).json({ message: "Failed to proxy payment proof" });
    }
  });
}
