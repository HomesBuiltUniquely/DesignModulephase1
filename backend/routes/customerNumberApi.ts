/**
 * Customer number API (standalone module).
 *
 * POST /api/customer — phone read from JSON body; full body stored in DB.
 * GET  /api/customer/:customerNumber — lookup by URL path (unchanged).
 * GET  /api/customer?phone=... — lookup by query (optional).
 *
 * External project (poll phones → create lead elsewhere):
 *   GET /api/customer/phones/recent?limit=50&since=2026-06-01T00:00:00.000Z
 *   GET /api/customer/records/:id
 *   Header: X-External-Api-Key: <EXTERNAL_LEAD_INGEST_API_KEY>
 *
 * MSG91 webhook URL: https://api.hubinterior.com/api/customer
 * Body (phone only): { "customer_mobile": "919876543210" }
 */
import type { Express, Request, Response, NextFunction } from "express";
import type { Pool } from "mysql2/promise";

function envTrim(name: string): string {
  return (process.env[name] || "").trim();
}

function parseExternalApiKey(req: Request): string {
  const header = String(req.headers["x-external-api-key"] || "").trim();
  const bearer = String(req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  return header || bearer;
}

/** Same key as POST /api/leads/external-intake (set in env.sh on EC2). */
function requireExternalApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected =
    envTrim("EXTERNAL_LEAD_INGEST_API_KEY") || envTrim("CUSTOMER_NUMBERS_API_KEY");
  if (!expected) {
    res.status(503).json({
      message:
        "External customer API is disabled (set EXTERNAL_LEAD_INGEST_API_KEY or CUSTOMER_NUMBERS_API_KEY)",
    });
    return;
  }
  const provided = parseExternalApiKey(req);
  if (!provided || provided !== expected) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

function parsePayloadField(payload: unknown): unknown {
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }
  return payload;
}

function mapCustomerRecordRow(r: {
  id: number;
  customerNumber: string;
  payload: unknown;
  createdAt: Date | string;
}) {
  return {
    id: r.id,
    phone: r.customerNumber,
    customerNumber: r.customerNumber,
    payload: parsePayloadField(r.payload),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  };
}

function parsePathCustomerNumber(req: Request): string | null {
  const raw = req.params.customerNumber;
  const segment = Array.isArray(raw) ? raw[0] : raw;
  const customerNumber = decodeURIComponent((segment ?? "").trim());
  return customerNumber || null;
}

/** Read phone from JSON body (MSG91 / CRM friendly field names). */
export function extractCustomerNumberFromBody(body: unknown): string | null {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const o = body as Record<string, unknown>;
  const candidates = [
    o.customer_mobile,
    o.customerMobile,
    o.customerNumber,
    o.customer_number,
    o.phone,
    o.mobile,
    o.contact_no,
    o.contactNo,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return null;
}

async function lookupByCustomerNumber(pool: Pool, customerNumber: string, res: Response) {
  try {
    const [recordRows] = await pool.query(
      `SELECT id, customer_number AS customerNumber, payload, created_at AS createdAt
       FROM customer_api_records
       WHERE customer_number = ?
       ORDER BY created_at DESC
       LIMIT 200`,
      [customerNumber]
    );
    const records = (recordRows as { id: number; customerNumber: string; payload: unknown; createdAt: Date }[]).map(
      (r) => ({
        id: r.id,
        customerNumber: r.customerNumber,
        payload:
          typeof r.payload === "string"
            ? (() => {
                try {
                  return JSON.parse(r.payload);
                } catch {
                  return r.payload;
                }
              })()
            : r.payload,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      })
    );

    const [leadRows] = await pool.query(
      `SELECT id, pid, project_name AS projectName, contact_no AS contactNo, client_email AS clientEmail,
              project_stage AS projectStage, create_at AS createAt, update_at AS updateAt
       FROM leads
       WHERE contact_no = ? OR pid = ?
       ORDER BY update_at DESC
       LIMIT 50`,
      [customerNumber, customerNumber]
    );
    const leads = leadRows as Record<string, unknown>[];

    return res.json({
      ok: true,
      customerNumber,
      savedCount: records.length,
      records,
      leadMatchCount: leads.length,
      leads,
    });
  } catch (err) {
    console.error("GET customer lookup error", err);
    return res.status(500).json({ message: "Lookup failed" });
  }
}

export function registerCustomerNumberRoutes(app: Express, pool: Pool): void {
  /** List phones saved via POST /api/customer (for other projects to poll and create leads). */
  app.get("/api/customer/phones/recent", requireExternalApiKey, async (req: Request, res: Response) => {
    const limitRaw = parseInt(String(req.query.limit ?? "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const since =
      typeof req.query.since === "string" && req.query.since.trim()
        ? req.query.since.trim()
        : null;
    const sinceIdRaw = parseInt(String(req.query.sinceId ?? ""), 10);
    const sinceId = Number.isFinite(sinceIdRaw) && sinceIdRaw > 0 ? sinceIdRaw : null;
    const distinct =
      String(req.query.distinct ?? "").toLowerCase() === "1" ||
      String(req.query.distinct ?? "").toLowerCase() === "true";

    try {
      const where: string[] = [];
      const params: unknown[] = [];
      if (since) {
        where.push("created_at > ?");
        params.push(since);
      }
      if (sinceId != null) {
        where.push("id > ?");
        params.push(sinceId);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      if (distinct) {
        const [rows] = await pool.query(
          `SELECT r.id, r.customer_number AS customerNumber, r.payload, r.created_at AS createdAt
           FROM customer_api_records r
           INNER JOIN (
             SELECT customer_number, MAX(id) AS max_id
             FROM customer_api_records
             ${whereSql}
             GROUP BY customer_number
           ) latest ON r.id = latest.max_id
           ORDER BY r.created_at DESC
           LIMIT ?`,
          [...params, limit]
        );
        const items = (rows as { id: number; customerNumber: string; payload: unknown; createdAt: Date }[]).map(
          mapCustomerRecordRow
        );
        return res.json({ ok: true, count: items.length, items });
      }

      const [rows] = await pool.query(
        `SELECT id, customer_number AS customerNumber, payload, created_at AS createdAt
         FROM customer_api_records
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT ?`,
        [...params, limit]
      );
      const items = (rows as { id: number; customerNumber: string; payload: unknown; createdAt: Date }[]).map(
        mapCustomerRecordRow
      );
      return res.json({ ok: true, count: items.length, items });
    } catch (err) {
      console.error("GET /api/customer/phones/recent error", err);
      return res.status(500).json({ ok: false, message: "Failed to list customer phones" });
    }
  });

  /** Fetch one stored record by id (after polling /phones/recent). */
  app.get("/api/customer/records/:id", requireExternalApiKey, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id ?? ""), 10);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ message: "Valid numeric id is required" });
    }
    try {
      const [rows] = await pool.query(
        `SELECT id, customer_number AS customerNumber, payload, created_at AS createdAt
         FROM customer_api_records WHERE id = ? LIMIT 1`,
        [id]
      );
      const row = (rows as { id: number; customerNumber: string; payload: unknown; createdAt: Date }[])[0];
      if (!row) return res.status(404).json({ ok: false, message: "Record not found" });
      return res.json({ ok: true, record: mapCustomerRecordRow(row) });
    } catch (err) {
      console.error("GET /api/customer/records/:id error", err);
      return res.status(500).json({ ok: false, message: "Lookup failed" });
    }
  });

  app.post("/api/customer", async (req: Request, res: Response) => {
    const body = req.body;
    if (body === undefined || body === null || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        message: "Request body must be a JSON object, e.g. { \"customer_mobile\": \"919876543210\" }",
      });
    }

    const customerNumber = extractCustomerNumberFromBody(body);
    if (!customerNumber) {
      return res.status(400).json({
        message:
          "Phone is required in body, e.g. { \"customer_mobile\": \"919876543210\" }",
      });
    }

    const payloadJson = JSON.stringify({ customer_mobile: customerNumber });
    const now = new Date();

    try {
      const [result] = await pool.query(
        `INSERT INTO customer_api_records (customer_number, payload, created_at) VALUES (?, CAST(? AS JSON), ?)`,
        [customerNumber, payloadJson, now]
      );
      const insertId = (result as { insertId?: number }).insertId;
      return res.status(201).json({
        ok: true,
        id: insertId,
        customerNumber,
        message: "Saved",
        createdAt: now.toISOString(),
      });
    } catch (err) {
      console.error("POST /api/customer error", err);
      return res.status(500).json({ message: "Failed to save" });
    }
  });

  /** Backward compatible: phone still allowed in URL path. */
  app.post("/api/customer/:customerNumber", async (req: Request, res: Response) => {
    const fromPath = parsePathCustomerNumber(req);
    if (!fromPath) {
      return res.status(400).json({
        message: "customerNumber is required in the URL path, e.g. POST /api/customer/9876543210",
      });
    }

    const body = req.body;
    if (body === undefined || body === null || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        message: "Request body must be a JSON object, e.g. { \"name\": \"...\", \"email\": \"...\" }",
      });
    }
    if (Object.keys(body as object).length === 0) {
      return res.status(400).json({ message: "Body cannot be an empty object" });
    }

    const payloadJson = JSON.stringify(body);
    const now = new Date();

    try {
      const [result] = await pool.query(
        `INSERT INTO customer_api_records (customer_number, payload, created_at) VALUES (?, CAST(? AS JSON), ?)`,
        [fromPath, payloadJson, now]
      );
      const insertId = (result as { insertId?: number }).insertId;
      return res.status(201).json({
        ok: true,
        id: insertId,
        customerNumber: fromPath,
        message: "Saved",
        createdAt: now.toISOString(),
      });
    } catch (err) {
      console.error("POST /api/customer/:customerNumber error", err);
      return res.status(500).json({ message: "Failed to save" });
    }
  });

  app.get("/api/customer/:customerNumber", async (req: Request, res: Response) => {
    const customerNumber = parsePathCustomerNumber(req);
    if (!customerNumber) {
      return res.status(400).json({
        message: "customerNumber is required in the URL path, e.g. /api/customer/9876543210",
      });
    }
    return lookupByCustomerNumber(pool, customerNumber, res);
  });

  app.get("/api/customer", async (req: Request, res: Response) => {
    const q = typeof req.query.phone === "string" ? req.query.phone.trim() : "";
    if (!q) {
      return res.status(400).json({
        message: "Provide phone query param, e.g. GET /api/customer?phone=919876543210",
      });
    }
    return lookupByCustomerNumber(pool, q, res);
  });
}
