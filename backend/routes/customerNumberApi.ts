/**
 * Customer number API (standalone module).
 *
 * POST /api/customer/:customerNumber — JSON body is stored in DB (one row per request).
 * GET  /api/customer/:customerNumber — returns saved rows for that number + matching leads (contact_no / pid).
 *
 * Postman POST: https://api.hubinterior.com/api/customer/{{customer_Number}}
 *   Body → raw → JSON: { "name": "Sam", "note": "..." }
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";

function parseCustomerNumber(req: Request): string | null {
  const raw = req.params.customerNumber;
  const segment = Array.isArray(raw) ? raw[0] : raw;
  const customerNumber = decodeURIComponent((segment ?? "").trim());
  return customerNumber || null;
}

export function registerCustomerNumberRoutes(app: Express, pool: Pool): void {
  app.post("/api/customer/:customerNumber", async (req: Request, res: Response) => {
    const customerNumber = parseCustomerNumber(req);
    if (!customerNumber) {
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
      console.error("POST /api/customer/:customerNumber error", err);
      return res.status(500).json({ message: "Failed to save" });
    }
  });

  app.get("/api/customer/:customerNumber", async (req: Request, res: Response) => {
    const customerNumber = parseCustomerNumber(req);
    if (!customerNumber) {
      return res.status(400).json({
        message: "customerNumber is required in the URL path, e.g. /api/customer/9876543210",
      });
    }

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
          createdAt:
            r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
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
      console.error("GET /api/customer/:customerNumber error", err);
      return res.status(500).json({ message: "Lookup failed" });
    }
  });
}
