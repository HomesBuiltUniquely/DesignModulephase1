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

/** Mirror CRM hub sales payment into leads.payload so design milestone math sees it. */
async function persistHubSalesPaymentToLeadPayload(
  pool: Pool,
  leadId: number,
  amountReceived: number | null,
  tenPercentAmount: number | null,
  quoteAmount: number | null,
): Promise<void> {
  if (amountReceived == null || amountReceived <= 0) return;
  const [rows] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [leadId]);
  const raw = (rows as { payload?: unknown }[])[0]?.payload;
  const payload = parseLeadPayload(raw);
  const existing =
    pickNum(payload.total_paid_cumulative, payload.total_paid_toward_10_percent, payload.amount_paid) ?? 0;
  const cumulative = Math.max(existing, amountReceived);
  payload.total_paid_cumulative = cumulative;
  payload.total_paid_toward_10_percent = cumulative;
  payload.amount_paid = cumulative;
  if (tenPercentAmount != null && tenPercentAmount > 0) {
    payload.ten_percent_target = tenPercentAmount;
    payload.remaining_for_10_percent = Math.max(0, tenPercentAmount - cumulative);
    payload.ten_percent_payment_met = cumulative >= tenPercentAmount;
  }
  if (quoteAmount != null && quoteAmount > 0) {
    payload.quotation_total = quoteAmount;
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

type HubLeadBody = Record<string, unknown>;

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

function buildCrmHubPayload(body: HubLeadBody, leadType: string, leadIdNum: number, leadIdentifier: string): Record<string, unknown> {
  const projectName = pickStr(body.projectName, body.customerName, "Unnamed");
  const contactNo = pickStr(body.contactNo, body.contact_no, body.phone);
  const clientEmail = pickStr(body.clientEmail, body.client_email, body.email);
  const designerName = pickStr(body.designerName, body.designer_name);
  const appointmentDate = pickStr(body.appointmentDate, body.appointment_date);
  const appointmentSlot = pickStr(body.appointmentSlot, body.appointment_slot, body.slot);

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
    },
    formData: {
      customer_name: projectName,
      co_no: contactNo || "",
      email: clientEmail || "",
      status_of_project: "Pre 10%",
      designer_name: designerName || "",
      appointment_date: appointmentDate || "",
      appointment_slot: appointmentSlot || "",
    },
    crmSchedule: {
      date: appointmentDate || null,
      slot: appointmentSlot || null,
    },
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
    const merged = { ...prev, ...payloadToPersist, fetchedData: { ...prevFetched, ...newFetched } };
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

async function markTenPercentCollectionComplete(pool: Pool, leadId: number): Promise<void> {
  const now = new Date();
  await pool.query(
    `INSERT INTO lead_task_completions (lead_id, milestone_index, task_name, completed_at)
     VALUES (?, 2, '10% payment collection', ?)
     ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at)`,
    [leadId, now],
  );
  await pool.query(
    `DELETE FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 2 AND task_name = '10% payment approval'`,
    [leadId],
  );
}

async function handleConvertBooking(
  pool: Pool,
  body: HubLeadBody,
  addLeadHistoryEvent: RouteDeps["addLeadHistoryEvent"],
): Promise<{ designLeadId: number; bookingTokenRecordId: string }> {
  const bookingTokenRecordId = pickStr(body.bookingTokenRecordId, body.recordId);
  if (!bookingTokenRecordId) throw new Error("bookingTokenRecordId is required");

  const leadType = pickStr(body.leadType, body.crmLeadType) || "addlead";
  const leadIdNum = pickNum(body.leadId, body.crmLeadId);
  if (leadIdNum == null) throw new Error("leadId is required");

  let designLeadId = await resolveDesignLeadIdForHubSync(pool, body);
  if (!designLeadId) {
    const upserted = await upsertCrmDesignLead(pool, body, addLeadHistoryEvent);
    designLeadId = upserted.designLeadId;
  }

  const paymentHistoryId = pickStr(body.paymentHistoryId) || null;
  const amountReceived = pickNum(body.amountReceived, body.amount_received);
  const tenPercentAmount = pickNum(body.tenPercentAmount, body.ten_percent_amount, body.quoteAmount != null ? Number(body.quoteAmount) * 0.1 : null);
  const quoteAmount = pickNum(body.quoteAmount, body.quote_amount, body.quotationTotal, body.quotation_total);
  const now = new Date();
  const payloadJson = JSON.stringify(body);

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

  await persistHubSalesPaymentToLeadPayload(
    pool,
    designLeadId,
    amountReceived,
    tenPercentAmount,
    quoteAmount,
  );

  await importHubPaymentProofs(pool, designLeadId, { ...body, _syncedAt: now });
  await markTenPercentCollectionComplete(pool, designLeadId);

  await addLeadHistoryEvent(designLeadId, {
    id: `hub-payment-sync-${Date.now()}`,
    type: "note",
    taskName: "10% payment collection",
    milestoneName: "10% PAYMENT",
    timestamp: now.toISOString(),
    description: "CRM Booking & Token payment synced from Hub",
    user: { name: "CRM Hub" },
    details: { kind: "hub_payment_sync", bookingTokenRecordId, paymentHistoryId },
  });

  return { designLeadId, bookingTokenRecordId };
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

  const [completions] = await pool.query(
    `SELECT lead_id as leadId, milestone_index as milestoneIndex, task_name as taskName, completed_at as completedAt
     FROM lead_task_completions
     WHERE (milestone_index = 1 AND task_name = 'DQC 1 approval')
        OR (milestone_index = 2 AND task_name IN ('10% payment collection', '10% payment approval'))`,
  );
  const compList = completions as TaskCompletion[];

  const eligibleIds = new Set<number>();
  for (const id of syncByLead.keys()) eligibleIds.add(id);
  for (const c of compList) {
    if (c.taskName === "DQC 1 approval" || c.taskName === "10% payment collection") {
      eligibleIds.add(c.leadId);
    }
  }

  if (eligibleIds.size === 0) return [];

  const ids = Array.from(eligibleIds);
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
    const hasApproval = hasTask(compList, leadId, 2, "10% payment approval");
    const hasCollection = hasTask(compList, leadId, 2, "10% payment collection");
    const hasDqc1 = hasTask(compList, leadId, 1, "DQC 1 approval");
    const sync = syncByLead.get(leadId);

    if (tab === "pending" && hasApproval) continue;
    if (tab === "approved" && !hasApproval) continue;

    const payload = parseLeadPayload(lead.payload);
    const fetched = (payload.fetchedData || {}) as Record<string, unknown>;
    const customerName =
      pickStr(fetched.customer_name, payload.customer_name, lead.projectName) || lead.projectName || "—";

    if (customerFilter && !customerName.toLowerCase().includes(customerFilter)) continue;

    const collectionAt = taskCompletedAt(compList, leadId, 2, "10% payment collection");
    const approvalAt = taskCompletedAt(compList, leadId, 2, "10% payment approval");
    const submittedAt = sync?.syncedAt ?? collectionAt;
    const submittedDate = submittedAt instanceof Date ? submittedAt : submittedAt ? new Date(submittedAt as string) : null;

    if (fromDate && submittedDate && submittedDate < fromDate) continue;
    if (toDate && submittedDate && submittedDate > toDate) continue;

    let paymentPayload: Record<string, unknown> = {};
    if (sync?.paymentPayload) {
      paymentPayload = parseLeadPayload(sync.paymentPayload);
    }
    const paymentHistory = Array.isArray(paymentPayload.paymentHistory) ? paymentPayload.paymentHistory : [];
    const tenPercentTarget =
      pickNum(sync?.tenPercentAmount, paymentPayload.tenPercentAmount, paymentPayload.quoteAmount != null ? Number(paymentPayload.quoteAmount) * 0.1 : null) ?? 0;
    const totalPaid = pickNum(sync?.amountReceived, paymentPayload.amountReceived) ?? 0;
    const remaining = Math.max(0, tenPercentTarget - totalPaid);

    let status = "Awaiting 10% payment";
    if (hasApproval) status = "Approved";
    else if (hasCollection) status = "Pending approval";

    const crmLeadType = pickStr(sync?.crmLeadType, payload.crmLeadType);
    const crmLeadId = pickNum(sync?.crmLeadId, payload.crmLeadId);
    const paymentSource = sync ? "crm_hub" : "manual";

    rows.push({
      id: leadId,
      customerName,
      totalPaid,
      tenPercentTarget,
      remaining,
      subs: paymentHistory.length || (hasCollection ? 1 : 0),
      status,
      submittedAt: submittedDate ? submittedDate.toISOString() : null,
      approvedAt: approvalAt ? approvalAt.toISOString() : null,
      canApprove: hasCollection && !hasApproval,
      paymentSource,
      crmRef: crmLeadType && crmLeadId != null ? `${crmLeadType}#${crmLeadId}` : null,
      bookingTokenRecordId: sync?.bookingTokenRecordId ?? null,
      hasDqc1,
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
  lead: { id: number; projectName: string; projectStage?: string },
  sync: Record<string, unknown>,
  compList: TaskCompletion[],
  approved: boolean,
): Promise<Record<string, unknown> | null> {
  const leadId = lead.id;
  const hasApproval = hasTask(compList, leadId, 2, "10% payment approval");
  const hasCollection = hasTask(compList, leadId, 2, "10% payment collection");
  if (approved && !hasApproval) return null;
  if (!approved && hasApproval) return null;
  if (!approved && !hasCollection) return null;

  const paymentPayload = parseLeadPayload(sync.paymentPayload);
  const hubProofBaseUrl = pickStr(paymentPayload.hubProofBaseUrl, envTrim("HUB_API_BASE_URL"), "http://localhost:8081");
  const syncedAt = sync.syncedAt instanceof Date ? sync.syncedAt : sync.syncedAt ? new Date(String(sync.syncedAt)) : null;
  const submittedAtIso =
    syncedAt && !Number.isNaN(syncedAt.getTime()) ? syncedAt.toISOString() : null;
  const amountPaid = pickNum(sync.amountReceived, paymentPayload.amountReceived) ?? 0;
  const tenPercentTarget =
    pickNum(sync.tenPercentAmount, paymentPayload.tenPercentAmount, paymentPayload.quoteAmount != null ? Number(paymentPayload.quoteAmount) * 0.1 : null) ?? 0;
  const remaining = Math.max(0, tenPercentTarget - amountPaid);
  const tenPercentMet = tenPercentTarget > 0 ? amountPaid >= tenPercentTarget : amountPaid > 0;
  const approvalAt = taskCompletedAt(compList, leadId, 2, "10% payment approval");
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
    projectStage: approved ? "10-20%" : lead.projectStage || "Pre 10%",
    financeApproved: approved,
    status: approved
      ? "Approved — moved to 10–20%"
      : tenPercentMet
        ? "Ready for approval (10% paid)"
        : "Awaiting 10% payment",
    paymentReceived: pickStr(paymentPayload.paymentKind) || "—",
    paymentMode: pickStr(paymentPayload.paymentKind) || "—",
    paymentScreenshot: firstUploadId,
    amountPaid,
    tenPercentTarget,
    remainingFor10Percent: approved ? 0 : remaining,
    paymentPercentOfQuotation: null,
    tenPercentMet: approved ? true : tenPercentMet,
    canApprove: !approved && tenPercentMet && hasCollection,
    submittedAt: submittedAtIso,
    approvedAt: approvalAt ? approvalAt.toISOString() : null,
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

  const [completions] = await pool.query(
    `SELECT lead_id as leadId, milestone_index as milestoneIndex, task_name as taskName, completed_at as completedAt
     FROM lead_task_completions
     WHERE milestone_index = 2 AND task_name IN ('10% payment collection', '10% payment approval')`,
  );
  const compList = completions as TaskCompletion[];

  const ids = Array.from(syncByLead.keys());
  const placeholders = ids.map(() => "?").join(",");
  const [leadRows] = await pool.query(
    `SELECT id, project_name as projectName, project_stage as projectStage FROM leads WHERE id IN (${placeholders})`,
    ids,
  );

  const customerFilter = (filters.customerName || "").trim().toLowerCase();
  const month = (filters.month || "").trim();
  const fromDate = filters.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom) ? new Date(filters.dateFrom) : null;
  const toDate = filters.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo) ? new Date(filters.dateTo) : null;
  if (toDate) toDate.setHours(23, 59, 59, 999);

  const rows: Record<string, unknown>[] = [];
  for (const lead of leadRows as { id: number; projectName: string; projectStage?: string }[]) {
    const sync = syncByLead.get(lead.id);
    if (!sync) continue;
    const mapped = await mapCrmHubRowToSalesClosure(pool, lead, sync, compList, approved);
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
    `SELECT id, project_name as projectName, project_stage as projectStage FROM leads WHERE id = ? LIMIT 1`,
    [leadId],
  );
  const lead = (leadRows as { id: number; projectName: string; projectStage?: string }[])[0];
  if (!lead) return null;

  const [completions] = await pool.query(
    `SELECT lead_id as leadId, milestone_index as milestoneIndex, task_name as taskName, completed_at as completedAt
     FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 2`,
    [leadId],
  );
  const compList = completions as TaskCompletion[];
  const hasApproval = hasTask(compList, leadId, 2, "10% payment approval");
  return mapCrmHubRowToSalesClosure(pool, lead, sync, compList, hasApproval);
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
