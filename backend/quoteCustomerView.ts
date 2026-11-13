import crypto from "crypto";
import type { Express, Request, Response } from "express";
import type { Pool, PoolConnection } from "mysql2/promise";

const VIEW_SESSION_RE = /^[0-9a-fA-F-]{16,64}$/;

export async function ensureQuoteCustomerViewTables(conn: PoolConnection): Promise<void> {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS quote_customer_view_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      quote_id INT NOT NULL,
      version_number INT NULL,
      view_session_id VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_quote_view_session (quote_id, view_session_id),
      KEY idx_qcvs_quote (quote_id)
    );
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS quote_customer_view_stats (
      quote_id INT NOT NULL PRIMARY KEY,
      open_count INT NOT NULL DEFAULT 0,
      last_open_at DATETIME NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);
}

function parsePayloadJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const v = JSON.parse(raw);
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function crmLeadFromPayload(payload: Record<string, unknown> | null): {
  crmLeadId: number | null;
  leadType: string | null;
} {
  if (!payload) return { crmLeadId: null, leadType: null };
  const crmLeadId = Number(
    payload.crmLeadId ?? payload.crm_lead_id ?? payload.CRMLeadId ?? payload.crmLeadID,
  );
  const leadType = String(
    payload.leadType ?? payload.lead_type ?? payload.crmLeadType ?? payload.crm_lead_type ?? "",
  ).trim();
  return {
    crmLeadId: Number.isFinite(crmLeadId) && crmLeadId > 0 ? Math.trunc(crmLeadId) : null,
    leadType: leadType || null,
  };
}

async function resolveDesignLeadIdForQuote(pool: Pool, quoteId: number): Promise<number | null> {
  const [snapRows] = await pool.query(
    `SELECT lead_id AS leadId FROM lead_prolance_quote_snapshots WHERE quote_id = ? LIMIT 1`,
    [quoteId],
  );
  const fromSnap = (snapRows as { leadId?: unknown }[])[0]?.leadId;
  if (fromSnap != null && Number(fromSnap) > 0) return Number(fromSnap);

  const [verRows] = await pool.query(
    `SELECT lead_id AS leadId FROM lead_prolance_quote_versions WHERE quote_id = ? LIMIT 1`,
    [quoteId],
  );
  const fromVer = (verRows as { leadId?: unknown }[])[0]?.leadId;
  if (fromVer != null && Number(fromVer) > 0) return Number(fromVer);

  const [lRows] = await pool.query(`SELECT id AS leadId FROM leads WHERE prolance_quote_id = ? LIMIT 1`, [
    quoteId,
  ]);
  const fromLead = (lRows as { leadId?: unknown }[])[0]?.leadId;
  if (fromLead != null && Number(fromLead) > 0) return Number(fromLead);
  return null;
}

async function resolveCrmRefForQuote(
  pool: Pool,
  quoteId: number,
): Promise<{ crmLeadId: number; leadType: string } | null> {
  const designLeadId = await resolveDesignLeadIdForQuote(pool, quoteId);
  if (designLeadId == null) return null;
  const [rows] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [designLeadId]);
  const payloadRaw = (rows as { payload?: unknown }[])[0]?.payload;
  const payload = parsePayloadJson(payloadRaw);
  const { crmLeadId, leadType } = crmLeadFromPayload(payload);
  if (crmLeadId == null) return null;
  return { crmLeadId, leadType: leadType ?? "formlead" };
}

export type RecordQuoteViewResult = {
  recorded: boolean;
  openCount: number;
  lastOpenAt: string | null;
};

export async function recordCustomerQuoteView(
  pool: Pool,
  quoteId: number,
  viewSessionId: string,
): Promise<RecordQuoteViewResult> {
  const sid = viewSessionId.trim();
  if (!VIEW_SESSION_RE.test(sid)) {
    return { recorded: false, openCount: 0, lastOpenAt: null };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ins] = await conn.query(
      `INSERT IGNORE INTO quote_customer_view_sessions (quote_id, view_session_id) VALUES (?, ?)`,
      [quoteId, sid],
    );
    const inserted = (ins as { affectedRows?: number }).affectedRows === 1;
    if (inserted) {
      await conn.query(
        `INSERT INTO quote_customer_view_stats (quote_id, open_count, last_open_at)
         VALUES (?, 1, NOW())
         ON DUPLICATE KEY UPDATE
           open_count = open_count + 1,
           last_open_at = NOW()`,
        [quoteId],
      );
    }
    await conn.commit();

    const [statRows] = await pool.query(
      `SELECT open_count AS openCount, last_open_at AS lastOpenAt
       FROM quote_customer_view_stats WHERE quote_id = ? LIMIT 1`,
      [quoteId],
    );
    const stat = (statRows as { openCount?: unknown; lastOpenAt?: unknown }[])[0];
    const openCount = stat?.openCount != null ? Math.max(0, Number(stat.openCount)) : 0;
    const lastOpenAt =
      stat?.lastOpenAt != null && String(stat.lastOpenAt).trim()
        ? new Date(String(stat.lastOpenAt)).toISOString()
        : null;

    return { recorded: inserted, openCount, lastOpenAt };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
}

type CrmSyncDeps = {
  erpBaseUrl: string;
  webhookSecret: string;
};

function signWebhookBody(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

export async function syncQuoteOpenCountToCrm(
  pool: Pool,
  deps: CrmSyncDeps,
  quoteId: number,
  openCount: number,
  lastOpenAt: string | null,
): Promise<void> {
  const base = String(deps.erpBaseUrl || "").trim().replace(/\/+$/, "");
  if (!base) return;

  const crmRef = await resolveCrmRefForQuote(pool, quoteId);
  const payload: Record<string, unknown> = {
    quoteId: String(quoteId),
    customerQuoteOpenCount: openCount,
    lastCustomerQuoteOpenAt: lastOpenAt,
  };
  if (crmRef) {
    payload.leadId = String(crmRef.crmLeadId);
    payload.leadType = crmRef.leadType;
  }

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = String(deps.webhookSecret || "").trim();
  if (secret) {
    headers["X-Hub-Signature"] = signWebhookBody(body, secret);
  }

  try {
    const res = await fetch(`${base}/v1/quote/customer-view`, {
      method: "POST",
      headers,
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[quote-customer-view] CRM sync failed", {
        quoteId,
        status: res.status,
        body: text.slice(0, 200),
      });
    }
  } catch (err) {
    console.warn("[quote-customer-view] CRM sync error", { quoteId, error: err });
  }
}

export function registerQuoteCustomerViewRoutes(
  app: Express,
  pool: Pool,
  deps: CrmSyncDeps,
): void {
  app.post("/api/public/quote/:quoteId/view", async (req: Request, res: Response): Promise<void> => {
    const quoteId = Number(String(req.params.quoteId || "").trim());
    if (!Number.isFinite(quoteId) || quoteId < 1) {
      res.status(400).json({ message: "Invalid quoteId" });
      return;
    }

    const audience = String(req.query.audience || req.body?.audience || "")
      .trim()
      .toLowerCase();
    const internal =
      String(req.query.internal || req.body?.internal || "").trim() === "1" ||
      audience === "crm" ||
      audience === "internal";
    if (internal) {
      res.status(200).json({ recorded: false, skipped: "internal", openCount: 0 });
      return;
    }

    const viewSessionId = String(req.body?.viewSessionId ?? req.body?.view_session_id ?? "").trim();
    if (!viewSessionId) {
      res.status(400).json({ message: "viewSessionId is required" });
      return;
    }

    try {
      const result = await recordCustomerQuoteView(pool, quoteId, viewSessionId);
      if (result.recorded) {
        void syncQuoteOpenCountToCrm(pool, deps, quoteId, result.openCount, result.lastOpenAt);
      }
      res.status(200).json({
        recorded: result.recorded,
        openCount: result.openCount,
        lastOpenAt: result.lastOpenAt,
      });
    } catch (err) {
      console.error("quote customer view error", err);
      res.status(500).json({ message: "Failed to record view" });
    }
  });
}
