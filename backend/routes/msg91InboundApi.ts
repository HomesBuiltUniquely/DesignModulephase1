/**
 * MSG91 WhatsApp inbound webhook + phone lookup API.
 *
 * Configure in MSG91 Dashboard → WhatsApp → Webhook:
 *   POST https://api.hubinterior.com/api/msg91/webhook
 *   Event: "On Inbound Request Received" (or inbound report)
 *
 * GET  /api/msg91/phone/:phoneNumber — latest inbound records + matching leads
 * POST /api/msg91/webhook — MSG91 calls this; phone is extracted and stored
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";

function envTrim(name: string): string {
  return (process.env[name] || "").trim();
}

function parsePathPhone(req: Request): string | null {
  const raw = req.params.phoneNumber;
  const segment = Array.isArray(raw) ? raw[0] : raw;
  const phone = decodeURIComponent((segment ?? "").trim());
  return phone || null;
}

/** Normalize to digits only (MSG91 often uses 91xxxxxxxxxx). */
export function normalizePhoneDigits(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  while (d.startsWith("0")) {
    d = d.slice(1);
    if (!d) return null;
  }
  if (d.length === 10 && d.charAt(0) >= "6" && d.charAt(0) <= "9") {
    return "91" + d;
  }
  return d;
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Walk common MSG91 inbound payload shapes for sender phone. */
export function extractPhoneFromMsg91Payload(body: unknown): {
  phone: string | null;
  customerNumber: string | null;
  integratedNumber: string | null;
  direction: string | null;
  eventType: string | null;
} {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { phone: null, customerNumber: null, integratedNumber: null, direction: null, eventType: null };
  }
  const o = body as Record<string, unknown>;

  const customerNumber =
    asNonEmptyString(o.customerNumber) ||
    asNonEmptyString(o.customer_number) ||
    asNonEmptyString(o.sender) ||
    asNonEmptyString(o.from) ||
    asNonEmptyString(o.mobile) ||
    asNonEmptyString(o.phone) ||
    asNonEmptyString(o.wa_id);

  const integratedNumber =
    asNonEmptyString(o.integratedNumber) ||
    asNonEmptyString(o.integrated_number) ||
    asNonEmptyString(o.receiver);

  const direction = asNonEmptyString(o.direction) || asNonEmptyString(o.type);
  const eventType =
    asNonEmptyString(o.event) ||
    asNonEmptyString(o.eventType) ||
    asNonEmptyString(o.event_type) ||
    asNonEmptyString(o.status);

  let nestedPhone: string | null = null;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    nestedPhone =
      asNonEmptyString(d.customerNumber) ||
      asNonEmptyString(d.from) ||
      asNonEmptyString(d.mobile);
  }

  const raw = customerNumber || nestedPhone;
  const phone = normalizePhoneDigits(raw);

  return { phone, customerNumber: raw, integratedNumber, direction, eventType };
}

function webhookAuthorized(req: Request): boolean {
  const secret = envTrim("MSG91_WEBHOOK_SECRET");
  if (!secret) return true;
  const header =
    asNonEmptyString(req.headers["x-msg91-webhook-secret"]) ||
    asNonEmptyString(req.headers["x-webhook-secret"]) ||
    asNonEmptyString(req.query.secret);
  return header === secret;
}

export function registerMsg91InboundRoutes(app: Express, pool: Pool): void {
  app.post("/api/msg91/webhook", async (req: Request, res: Response) => {
    if (!webhookAuthorized(req)) {
      return res.status(401).json({ ok: false, message: "Invalid webhook secret" });
    }

    const body = req.body;
    if (body === undefined || body === null) {
      return res.status(400).json({ ok: false, message: "JSON body required" });
    }

    const extracted = extractPhoneFromMsg91Payload(body);
    if (!extracted.phone) {
      return res.status(400).json({
        ok: false,
        message:
          "Could not extract phone from payload. Expected fields like customerNumber, from, mobile, or sender.",
        receivedKeys: typeof body === "object" && body !== null && !Array.isArray(body) ? Object.keys(body) : [],
      });
    }

    const payloadJson = JSON.stringify(body);
    const now = new Date();

    try {
      const [result] = await pool.query(
        `INSERT INTO msg91_inbound_records
           (phone_number, customer_number, integrated_number, direction, event_type, payload, created_at)
         VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), ?)`,
        [
          extracted.phone,
          extracted.customerNumber,
          extracted.integratedNumber,
          extracted.direction,
          extracted.eventType,
          payloadJson,
          now,
        ]
      );
      const insertId = (result as { insertId?: number }).insertId;

      return res.status(201).json({
        ok: true,
        id: insertId,
        phoneNumber: extracted.phone,
        customerNumber: extracted.customerNumber,
        integratedNumber: extracted.integratedNumber,
        direction: extracted.direction,
        eventType: extracted.eventType,
        message: "Inbound phone saved",
        createdAt: now.toISOString(),
      });
    } catch (err) {
      console.error("POST /api/msg91/webhook error", err);
      return res.status(500).json({ ok: false, message: "Failed to save inbound record" });
    }
  });

  app.get("/api/msg91/phone/:phoneNumber", async (req: Request, res: Response) => {
    const input = parsePathPhone(req);
    if (!input) {
      return res.status(400).json({
        ok: false,
        message: "phoneNumber is required in the URL path, e.g. /api/msg91/phone/919876543210",
      });
    }

    const phone = normalizePhoneDigits(input) || input.replace(/\D/g, "");
    if (!phone) {
      return res.status(400).json({ ok: false, message: "Invalid phone number" });
    }

    const last10 = phone.length >= 10 ? phone.slice(-10) : phone;

    try {
      const [recordRows] = await pool.query(
        `SELECT id, phone_number AS phoneNumber, customer_number AS customerNumber,
                integrated_number AS integratedNumber, direction, event_type AS eventType,
                payload, created_at AS createdAt
         FROM msg91_inbound_records
         WHERE phone_number = ? OR phone_number LIKE ? OR phone_number LIKE ?
         ORDER BY created_at DESC
         LIMIT 100`,
        [phone, `%${last10}`, `91${last10}`]
      );

      const records = (
        recordRows as {
          id: number;
          phoneNumber: string;
          customerNumber: string | null;
          integratedNumber: string | null;
          direction: string | null;
          eventType: string | null;
          payload: unknown;
          createdAt: Date;
        }[]
      ).map((r) => ({
        id: r.id,
        phoneNumber: r.phoneNumber,
        customerNumber: r.customerNumber,
        integratedNumber: r.integratedNumber,
        direction: r.direction,
        eventType: r.eventType,
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
      }));

      const [leadRows] = await pool.query(
        `SELECT id, pid, project_name AS projectName, contact_no AS contactNo, client_email AS clientEmail,
                project_stage AS projectStage, create_at AS createAt, update_at AS updateAt
         FROM leads
         WHERE contact_no = ? OR contact_no LIKE ? OR contact_no LIKE ? OR pid = ? OR pid LIKE ?
         ORDER BY update_at DESC
         LIMIT 50`,
        [phone, `%${last10}`, `91${last10}`, phone, `%${last10}`]
      );
      const leads = leadRows as Record<string, unknown>[];

      return res.json({
        ok: true,
        phoneNumber: phone,
        inboundCount: records.length,
        records,
        leadMatchCount: leads.length,
        leads,
      });
    } catch (err) {
      console.error("GET /api/msg91/phone/:phoneNumber error", err);
      return res.status(500).json({ ok: false, message: "Lookup failed" });
    }
  });

  app.get("/api/msg91/phones/recent", async (req: Request, res: Response) => {
    const limitRaw = parseInt(String(req.query.limit ?? "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    try {
      const [rows] = await pool.query(
        `SELECT id, phone_number AS phoneNumber, customer_number AS customerNumber,
                integrated_number AS integratedNumber, direction, event_type AS eventType, created_at AS createdAt
         FROM msg91_inbound_records
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );
      const items = (rows as { createdAt: Date }[]).map((r) => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      }));
      return res.json({ ok: true, count: items.length, items });
    } catch (err) {
      console.error("GET /api/msg91/phones/recent error", err);
      return res.status(500).json({ ok: false, message: "Failed to list recent phones" });
    }
  });
}
