/**
 * Offline design meetings — same pull pattern as CRM showroom-meeting-scheduled API.
 *
 * GET /v1/Appointment/offline-meeting-scheduled/recent?since=2026-07-04T10:00:00
 * GET /v1/Appointment/offline-meeting-scheduled/{appointmentId}
 *
 * Auth: x-api-key (DESIGN_OFFLINE_MEETING_API_KEY, falls back to EXTERNAL_LEAD_INGEST_API_KEY)
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";

type OfflineMeetingRow = {
  id: number;
  leadId: number;
  designerName: string;
  clientName: string;
  milestoneName: string;
  timeSlot: string;
  branch: string | null;
  meetingDate: Date | string | null;
  createdAt: Date | string;
};

type OfflineMeetingListItem = {
  appointmentId: number;
  createdAt: string;
  leadId: string;
  designerName: string;
  clientName: string;
  milestoneName: string;
  slots: string;
  meetingDate: string;
  branch: string;
};

type OfflineMeetingDetail = Omit<OfflineMeetingListItem, "appointmentId" | "createdAt">;

function envTrim(name: string): string {
  return (process.env[name] || "").trim();
}

function configuredApiKey(): string {
  return envTrim("DESIGN_OFFLINE_MEETING_API_KEY") || envTrim("EXTERNAL_LEAD_INGEST_API_KEY");
}

function isValidApiKey(provided: string | undefined): boolean {
  const expected = configuredApiKey();
  if (!expected) return false;
  return expected === String(provided || "").trim();
}

function meetingError(res: Response, status: number, message: string): Response {
  return res.status(status).json({ success: false, error: message });
}

/** Match CRM ShowroomMeetingScheduledService.parseSince semantics. */
export function parseSinceParam(sinceValue: unknown): Date {
  if (typeof sinceValue !== "string" || !sinceValue.trim()) {
    throw new Error("since query parameter is required (ISO format e.g. 2026-07-04T10:00:00).");
  }
  const trimmed = sinceValue.trim();
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid since value. Use ISO local datetime e.g. 2026-07-04T10:00:00");
  }
  return parsed;
}

function formatCreatedAt(value: Date | string): string {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
      `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
    );
  }
  const raw = String(value).trim();
  if (!raw) return "";
  return raw.replace(" ", "T").replace(/\.\d{3}Z?$/, "").replace(/Z$/, "");
}

function formatMeetingDate(value: Date | string | null | undefined): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const raw = String(value).trim();
  if (!raw) return "";
  return raw.slice(0, 10);
}

function toListItem(row: OfflineMeetingRow): OfflineMeetingListItem {
  return {
    appointmentId: row.id,
    createdAt: formatCreatedAt(row.createdAt),
    leadId: String(row.leadId),
    designerName: row.designerName,
    clientName: row.clientName,
    milestoneName: row.milestoneName,
    slots: row.timeSlot,
    meetingDate: formatMeetingDate(row.meetingDate),
    branch: row.branch ?? "",
  };
}

function toDetail(row: OfflineMeetingRow): OfflineMeetingDetail {
  const item = toListItem(row);
  return {
    leadId: item.leadId,
    designerName: item.designerName,
    clientName: item.clientName,
    milestoneName: item.milestoneName,
    slots: item.slots,
    meetingDate: item.meetingDate,
    branch: item.branch,
  };
}

const SELECT_COLUMNS = `id, lead_id AS leadId, designer_name AS designerName, client_name AS clientName,
            milestone_name AS milestoneName, time_slot AS timeSlot, branch,
            meeting_date AS meetingDate, created_at AS createdAt`;

async function fetchMeetingById(pool: Pool, appointmentId: number): Promise<OfflineMeetingRow | null> {
  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS}
     FROM offline_meeting_notifications
     WHERE id = ?
     LIMIT 1`,
    [appointmentId],
  );
  const list = rows as OfflineMeetingRow[];
  return list[0] ?? null;
}

export function registerOfflineMeetingScheduledRoutes(app: Express, pool: Pool): void {
  app.get("/v1/Appointment/offline-meeting-scheduled/recent", async (req: Request, res: Response) => {
    const apiKey = String(req.headers["x-api-key"] || "").trim();
    if (!isValidApiKey(apiKey)) {
      return meetingError(res, 401, "Invalid API key.");
    }
    if (!configuredApiKey()) {
      return meetingError(res, 503, "Offline meeting poll is disabled (missing DESIGN_OFFLINE_MEETING_API_KEY).");
    }

    let since: Date;
    try {
      since = parseSinceParam(req.query.since);
    } catch (err) {
      return meetingError(res, 400, err instanceof Error ? err.message : "Invalid since parameter.");
    }

    try {
      const [rows] = await pool.query(
        `SELECT ${SELECT_COLUMNS}
         FROM offline_meeting_notifications
         WHERE created_at > ?
         ORDER BY created_at ASC`,
        [since],
      );
      const items = (rows as OfflineMeetingRow[]).map(toListItem);
      return res.json(items);
    } catch (err) {
      console.error("[offline-meeting-scheduled/recent] error", err);
      return meetingError(res, 500, "Failed to fetch recent offline meetings.");
    }
  });

  app.get("/v1/Appointment/offline-meeting-scheduled/:appointmentId", async (req: Request, res: Response) => {
    const apiKey = String(req.headers["x-api-key"] || "").trim();
    if (!isValidApiKey(apiKey)) {
      return meetingError(res, 401, "Invalid API key.");
    }
    if (!configuredApiKey()) {
      return meetingError(res, 503, "Offline meeting poll is disabled (missing DESIGN_OFFLINE_MEETING_API_KEY).");
    }

    const appointmentId = parseInt(String(req.params.appointmentId ?? ""), 10);
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      return meetingError(res, 400, "appointmentId is required.");
    }

    try {
      const row = await fetchMeetingById(pool, appointmentId);
      if (!row) {
        return meetingError(res, 400, "Offline meeting not found.");
      }
      return res.json(toDetail(row));
    } catch (err) {
      console.error("[offline-meeting-scheduled/:id] error", err);
      return meetingError(res, 500, "Failed to fetch offline meeting details.");
    }
  });
}
