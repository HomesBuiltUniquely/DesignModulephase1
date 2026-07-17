/**
 * Offline meeting export API for EC pull-sync.
 *
 * GET /v1/Appointment/offline-meeting-scheduled/recent?since=YYYY-MM-DDTHH:mm:ss
 * GET /v1/Appointment/offline-meeting-scheduled/:appointmentId
 *
 * Auth (any one):
 *   x-api-key | x-external-api-key | Authorization: Bearer ...
 * Expected key: DESIGN_OFFLINE_MEETING_API_KEY || EXTERNAL_LEAD_INGEST_API_KEY
 */
import type { Express, Request, Response, NextFunction } from "express";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type OfflineMeetingExportInput = {
  leadId: number;
  clientName: string;
  designerName: string;
  milestoneName: string;
  meetingDate: string;
  timeSlot: string;
  branch?: string | null;
};

type OfflineMeetingExportRow = {
  id: number;
  lead_id: number;
  client_name: string;
  designer_name: string;
  milestone_name: string;
  meeting_date: Date | string;
  time_slot: string;
  branch: string | null;
  created_at: Date | string;
};

function envTrim(name: string): string {
  return (process.env[name] || "").trim();
}

function expectedApiKey(): string {
  return envTrim("DESIGN_OFFLINE_MEETING_API_KEY") || envTrim("EXTERNAL_LEAD_INGEST_API_KEY");
}

function parseProvidedApiKey(req: Request): string {
  const xApi = String(req.headers["x-api-key"] || "").trim();
  const xExt = String(req.headers["x-external-api-key"] || "").trim();
  const bearer = String(req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  return xApi || xExt || bearer;
}

function requireOfflineMeetingApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = expectedApiKey();
  if (!expected) {
    res.status(503).json({
      success: false,
      error:
        "Offline meeting export is disabled (set DESIGN_OFFLINE_MEETING_API_KEY or EXTERNAL_LEAD_INGEST_API_KEY)",
    });
    return;
  }
  const provided = parseProvidedApiKey(req);
  if (!provided || provided !== expected) {
    res.status(401).json({ success: false, error: "Invalid API key." });
    return;
  }
  next();
}

/** Normalize since to MySQL-comparable local datetime string YYYY-MM-DD HH:mm:ss */
export function parseSinceParam(sinceRaw: unknown): string {
  if (typeof sinceRaw !== "string" || !sinceRaw.trim()) {
    throw new Error("since is required. Format: YYYY-MM-DDTHH:mm:ss");
  }
  let normalized = sinceRaw.trim().replace(" ", "T");
  if (normalized.length === 16) {
    // YYYY-MM-DDTHH:mm
    normalized = `${normalized}:00`;
  }
  // Accept trailing Z / offset by stripping to local wall-clock portion when present
  const m = normalized.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/,
  );
  if (!m) {
    throw new Error(
      "Invalid since datetime. Use YYYY-MM-DDTHH:mm:ss (example: 2026-07-04T10:00:00)",
    );
  }
  return `${m[1]} ${m[2]}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format MySQL DATETIME / Date as yyyy-MM-dd'T'HH:mm:ss (no timezone). */
function formatLocalDateTime(value: Date | string | null | undefined): string {
  if (value == null) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}T${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (m) return `${m[1]}T${m[2]}`;
  return s.replace(" ", "T").slice(0, 19);
}

function formatMeetingDate(value: Date | string | null | undefined): string {
  if (value == null) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10);
}

function mapRowToListItem(row: OfflineMeetingExportRow) {
  return {
    appointmentId: Number(row.id),
    createdAt: formatLocalDateTime(row.created_at),
    meetingDate: formatMeetingDate(row.meeting_date),
    leadId: String(row.lead_id),
    designerName: row.designer_name,
    clientName: row.client_name,
    milestoneName: row.milestone_name,
    slots: row.time_slot,
    branch: row.branch ?? "",
  };
}

export async function ensureOfflineMeetingExportTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS offline_meeting_exports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lead_id INT NOT NULL,
      client_name VARCHAR(255) NOT NULL,
      designer_name VARCHAR(255) NOT NULL,
      milestone_name VARCHAR(64) NOT NULL,
      meeting_date DATE NOT NULL,
      time_slot VARCHAR(128) NOT NULL,
      branch VARCHAR(128) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ome_created_at (created_at),
      INDEX idx_ome_lead (lead_id)
    )
  `);
}

export async function recordOfflineMeetingExport(
  pool: Pool,
  data: OfflineMeetingExportInput,
): Promise<number | null> {
  const meetingDate =
    typeof data.meetingDate === "string" && data.meetingDate.length >= 10
      ? data.meetingDate.slice(0, 10)
      : String(data.meetingDate || "").slice(0, 10);
  if (!meetingDate || !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
    console.error("[offline-meeting-export] invalid meetingDate", data.meetingDate);
    return null;
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO offline_meeting_exports
      (lead_id, client_name, designer_name, milestone_name, meeting_date, time_slot, branch)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.leadId,
      data.clientName || "Customer",
      data.designerName || "Designer",
      data.milestoneName,
      meetingDate,
      data.timeSlot || "",
      data.branch?.trim() ? data.branch.trim() : null,
    ],
  );
  const insertId = Number(result.insertId);
  return Number.isFinite(insertId) && insertId > 0 ? insertId : null;
}

export function registerOfflineMeetingExportRoutes(app: Express, pool: Pool): void {
  // Must register /recent before /:appointmentId so "recent" is not parsed as an id.
  app.get(
    "/v1/Appointment/offline-meeting-scheduled/recent",
    requireOfflineMeetingApiKey,
    async (req: Request, res: Response) => {
      try {
        const since = parseSinceParam(req.query.since);
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT id, lead_id, client_name, designer_name, milestone_name,
                  meeting_date, time_slot, branch, created_at
           FROM offline_meeting_exports
           WHERE created_at > ?
           ORDER BY created_at ASC`,
          [since],
        );
        const items = (rows as OfflineMeetingExportRow[]).map(mapRowToListItem);
        return res.json(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("since") || message.includes("datetime")) {
          return res.status(400).json({ success: false, error: message });
        }
        console.error("[offline-meeting-export] recent error", err);
        return res.status(500).json({
          success: false,
          error: `Failed to fetch recent offline meetings: ${message}`,
        });
      }
    },
  );

  app.get(
    "/v1/Appointment/offline-meeting-scheduled/:appointmentId",
    requireOfflineMeetingApiKey,
    async (req: Request, res: Response) => {
      try {
        const appointmentId = Number(req.params.appointmentId);
        if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
          return res.status(400).json({ success: false, error: "appointmentId is required." });
        }
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT id, lead_id, client_name, designer_name, milestone_name,
                  meeting_date, time_slot, branch, created_at
           FROM offline_meeting_exports
           WHERE id = ?
           LIMIT 1`,
          [appointmentId],
        );
        const row = (rows as OfflineMeetingExportRow[])[0];
        if (!row) {
          return res.status(400).json({ success: false, error: "Appointment not found." });
        }
        return res.json(mapRowToListItem(row));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[offline-meeting-export] by-id error", err);
        return res.status(500).json({
          success: false,
          error: `Failed to fetch offline meeting details: ${message}`,
        });
      }
    },
  );
}
