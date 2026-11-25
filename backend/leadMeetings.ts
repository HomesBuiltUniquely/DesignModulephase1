import type { Pool, ResultSetHeader } from "mysql2/promise";
import { awardTaskCompletionXp } from "./routes/designerXpRoutes";

export type MeetingProgress = "scheduled" | "in_progress" | "meeting_never_happened" | "completed";
export type MeetingBookingStatus = "scheduled" | "rescheduled" | "cancelled";
export type MeetingSource = "design_module" | "crm";

/** Board / history display labels — same for Pre 10% and design meetings (Material selection, etc.). */
export function meetingProgressLabel(
  progress: string | null | undefined,
  meetingStatus?: string | null,
): string {
  const status = String(meetingStatus || "").toLowerCase();
  const prog = String(progress || "").toLowerCase();
  if (status === "cancelled" || prog === "cancelled") return "Meeting Cancelled";
  if (prog === "completed") return "Meeting Successful";
  if (prog === "meeting_never_happened" || prog === "meeting_abandoned") return "Meeting never happened";
  if (prog === "in_progress") return "In progress";
  if (status === "rescheduled") return "Meeting Rescheduled";
  return "Meeting Scheduled";
}

export type MeetingActor = { id?: number | null; name?: string | null };

/** Same rules as Meeting Management `isDesignRefinementText` — CRM label variants included. */
export function isCrmDrrLabelText(value?: string | null | undefined): boolean {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  return (
    raw.includes("design refinement") ||
    raw.includes("refinement round") ||
    raw.includes("design-refinement") ||
    raw.includes("refinement-round") ||
    /\bdrr\b/.test(raw)
  );
}

const CRM_DRR_PAYLOAD = `IF(JSON_VALID(l.payload), l.payload, '{}')`;

/**
 * Full DRR detection — explicit Design Refinement Round labels / is_drr_revisit only.
 * Never treat “second CRM meeting after Pre 10% success” as DRR.
 * Use only for single-meeting checks — too expensive for the board SELECT.
 */
const CRM_DRR_REVISIT_SQL = `(
  COALESCE(m.is_drr_revisit, 0) = 1
  OR LOWER(TRIM(IFNULL(m.meeting_type, ''))) IN ('drr', 'design_refinement')
  OR LOWER(IFNULL(m.meeting_type, '')) LIKE '%design%refinement%'
  OR LOWER(IFNULL(m.meeting_type, '')) LIKE '%refinement%round%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.meetingLabel')), '')) LIKE '%design%refinement%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.meetingLabel')), '')) LIKE '%refinement%round%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.meetingLabel')), '')) LIKE '%refinement-meeting%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.designMilestone')), '')) LIKE '%refinement%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.title')), '')) LIKE '%refinement%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.milestoneSubStage')), '')) LIKE '%design%refinement%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.milestoneSubStage')), '')) LIKE '%refinement%round%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.subStage')), '')) LIKE '%design%refinement%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.subStage')), '')) LIKE '%refinement%round%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.formData.milestoneSubStage')), '')) LIKE '%refinement%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.formData.subStage')), '')) LIKE '%refinement%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.connection.milestoneSubStage')), '')) LIKE '%refinement%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.discovery.milestoneSubStage')), '')) LIKE '%refinement%'
  OR LOWER(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(${CRM_DRR_PAYLOAD}, '$.crmDrrRevisit')), '')) IN ('true', '1')
)`;

/**
 * Board-fast DRR flag — column + meeting_type only.
 * Background reconcileCrmDrrScheduledMeetings keeps is_drr_revisit stamped;
 * JSON/EXISTS per row was timing out Meeting Management (10–25s).
 */
const CRM_DRR_REVISIT_BOARD_SQL = `(
  COALESCE(m.is_drr_revisit, 0) = 1
  OR LOWER(TRIM(IFNULL(m.meeting_type, ''))) IN ('drr', 'design_refinement')
  OR LOWER(IFNULL(m.meeting_type, '')) LIKE '%design%refinement%'
  OR LOWER(IFNULL(m.meeting_type, '')) LIKE '%refinement%round%'
)`;

export class MeetingActionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type DesignMeetingDef = {
  meetingType: "dqc1_first_cut" | "dqc2_material_selection" | "design_signoff";
  milestoneIndex: number;
  bookingTask: string;
  completionTask: string;
  aliases: string[];
};

const DESIGN_MEETINGS: DesignMeetingDef[] = [
  {
    meetingType: "dqc1_first_cut",
    milestoneIndex: 1,
    bookingTask: "First cut design + quotation discussion meeting request",
    completionTask: "meeting completed",
    aliases: ["dqc1_first_cut", "dqc1 first cut", "first cut design + quotation discussion meeting request"],
  },
  {
    meetingType: "dqc2_material_selection",
    milestoneIndex: 4,
    bookingTask: "Material selection meeting + quotation discussion",
    completionTask: "Material selection meeting completed",
    aliases: ["dqc2_material_selection", "material selection meeting + quotation discussion"],
  },
  {
    meetingType: "design_signoff",
    milestoneIndex: 5,
    bookingTask: "Design sign off",
    completionTask: "meeting completed",
    aliases: ["design_signoff", "design sign off", "design sign off meeting request", "design sign-off"],
  },
];

export type MeetingRow = {
  id: number;
  leadId: number;
  meetingDate: string;
  meetingTime: string | null;
  meetingType: string;
  meetingMode: string | null;
  meetingStatus: MeetingBookingStatus;
  progress: MeetingProgress;
  designerId: number | null;
  designerName: string | null;
  source: MeetingSource;
  /** Shared reason for cancel or reschedule. */
  cancelReason: string | null;
  rescheduleCount?: number;
  /** CRM Pre-10% note for designer (progress unchanged). */
  feedbackDesigner?: string | null;
  feedbackDesignerAt?: Date | string | null;
  feedbackDesignerBy?: string | null;
  crmAppointmentId?: number | null;
  /** True when this CRM row is a Design Refinement Round revisit. */
  isDrrRevisit?: boolean;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
};

export function normalizeMeetingKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function designMeetingFromLabel(value: unknown): DesignMeetingDef | null {
  const key = normalizeMeetingKey(value);
  if (!key) return null;
  return DESIGN_MEETINGS.find((item) => item.aliases.some((alias) => normalizeMeetingKey(alias) === key)) || null;
}

export function designMeetingFromCompletion(milestoneIndex: number, taskName: unknown): DesignMeetingDef | null {
  const key = normalizeMeetingKey(taskName);
  return (
    DESIGN_MEETINGS.find(
      (item) => item.milestoneIndex === milestoneIndex && normalizeMeetingKey(item.completionTask) === key,
    ) || null
  );
}

/** Booking-request tasks (First cut / Material selection / Design sign off) — meeting rows come from schedule-meeting-invite only. */
export function designMeetingFromBookingTask(milestoneIndex: number, taskName: unknown): DesignMeetingDef | null {
  const key = normalizeMeetingKey(taskName);
  return (
    DESIGN_MEETINGS.find(
      (item) => item.milestoneIndex === milestoneIndex && normalizeMeetingKey(item.bookingTask) === key,
    ) || null
  );
}

export function kolkataParts(now = new Date()): { date: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  let hour = Number(pick("hour"));
  if (hour === 24) hour = 0;
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    minutes: hour * 60 + Number(pick("minute") || 0),
  };
}

export function clockLabelToMinutes(value: unknown): number | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const match = text.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const mer = (match[3] || "").toLowerCase();
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59 || hour > 23) return null;
  if (mer === "pm" && hour < 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;
  if (!mer && hour > 23) return null;
  return hour * 60 + minute;
}

export function formatMinutesLabel(total: number): string {
  const hour24 = Math.floor(total / 60) % 24;
  const minute = total % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  let hour = hour24 % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** Pull a displayable start clock from Hub slot strings/objects (ranges + JSON). */
export function normalizeTimeLabel(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    const nested =
      row.start ??
      row.startTime ??
      row.start_time ??
      row.from ??
      row.slot ??
      row.time ??
      row.label ??
      row.appointmentSlot;
    const fromNested = normalizeTimeLabel(nested);
    if (fromNested) return fromNested;
  }
  let text = String(value || "").trim();
  if (!text) return null;
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const fromJson = normalizeTimeLabel(parsed);
      if (fromJson) return fromJson;
    } catch {
      /* keep raw text */
    }
  }
  // Ranges like "4:00 PM - 5:30 PM" → use the start clock.
  const rangeMatch = text.match(
    /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]m)?)\s*[-–—to]+\s*\d{1,2}:\d{2}/i,
  );
  if (rangeMatch?.[1]) text = rangeMatch[1].trim();
  const minutes = clockLabelToMinutes(text);
  if (minutes == null) {
    // Unparseable blob — don't store JSON/garbage as meeting_time.
    if (/[{}\[\]"]/.test(text) || text.length > 32) return null;
    return text.slice(0, 64);
  }
  return formatMinutesLabel(minutes);
}

function embeddedClockLabel(value: unknown): string | null {
  const rest = String(value || "")
    .trim()
    .replace(/^\d{4}-\d{2}-\d{2}[T\s]?/, "")
    .trim();
  if (!rest || !/\d{1,2}:\d{2}/.test(rest)) return null;
  return normalizeTimeLabel(rest);
}

export function normalizeDateIso(value: unknown): string | null {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function isFutureKolkataSlot(dateIso: string, timeLabel: string | null, now = new Date()): boolean {
  const today = kolkataParts(now);
  if (dateIso > today.date) return true;
  if (dateIso < today.date) return false;
  const minutes = clockLabelToMinutes(timeLabel);
  if (minutes == null) return false;
  return minutes > today.minutes;
}

const HUB_DAY_START_MIN = 10 * 60;
const HUB_MEETING_DURATION_MIN = 90;
const HUB_EARLY_SLOT_DURATION_MIN = 60;
/** After the slot end, wait this long before marking an unstarted meeting as never happened. */
const MEETING_ABANDON_BUFFER_MIN = 4 * 60;

function hubMeetingDurationForStart(startMin: number): number {
  return startMin === HUB_DAY_START_MIN ? HUB_EARLY_SLOT_DURATION_MIN : HUB_MEETING_DURATION_MIN;
}

function addDaysIso(dateIso: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!match) return dateIso;
  const stamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  return new Date(stamp).toISOString().slice(0, 10);
}

function isAtOrPastKolkata(dateIso: string, minutes: number, now: Date): boolean {
  const today = kolkataParts(now);
  if (today.date > dateIso) return true;
  if (today.date < dateIso) return false;
  return today.minutes >= minutes;
}

/**
 * After slot end, keep unstarted meetings In progress for the 4h buffer,
 * then Meeting never happened. Explicitly started meetings (started_at) stay
 * in progress until completed — except null-time rows, which must not stick
 * forever after the abandon window (auto-stamped starts used to trap them).
 * Feedback UI for never-happened reason is Pre 10% only (frontend).
 */
export function nextMeetingProgress(
  row: {
    meetingStatus: MeetingBookingStatus;
    progress: MeetingProgress | "meeting_abandoned";
    meetingDate: string;
    meetingTime: string | null;
    meetingType?: string | null;
    source: MeetingSource;
    startedAt: Date | string | null;
  },
  now = new Date(),
): MeetingProgress {
  // Cancelled meetings must not look "Scheduled" / "In progress" on the board.
  // Enum has no cancelled value — callers use meetingStatus + progressLabel for Cancelled UI.
  if (row.meetingStatus === "cancelled") {
    if (row.progress === "completed") return "completed";
    if (row.progress === "meeting_never_happened" || row.progress === "meeting_abandoned") {
      return "meeting_never_happened";
    }
    return "scheduled";
  }
  if (row.progress === "completed") return "completed";
  if (row.progress === "meeting_never_happened" || row.progress === "meeting_abandoned") {
    return "meeting_never_happened";
  }
  // Legacy junk label must never stay In progress (hid Successful Pre 10% rows).
  const junkType = String(row.meetingType || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (
    row.source === "design_module" &&
    (junkType === "design meeting" || junkType === "designmeeting")
  ) {
    return "meeting_never_happened";
  }

  const today = kolkataParts(now);
  const startMin = clockLabelToMinutes(row.meetingTime);
  const durationMin = startMin == null ? HUB_MEETING_DURATION_MIN : hubMeetingDurationForStart(startMin);
  // No clock on the row: treat the hub day end (8:00 PM) as the slot end.
  const endMin = (startMin == null ? 20 * 60 : startMin) + durationMin;
  let abandonDate = row.meetingDate;
  let abandonMin = endMin + MEETING_ABANDON_BUFFER_MIN;
  while (abandonMin >= 24 * 60) {
    abandonMin -= 24 * 60;
    abandonDate = addDaysIso(abandonDate, 1);
  }

  const pastAbandonWindow = isAtOrPastKolkata(abandonDate, abandonMin, now);
  const neverStarted = !row.startedAt;
  // Null-time rows: after abandon window they are never happened even if started_at
  // was auto-stamped by an older list refresh (that stamp must not lock them forever).
  if (pastAbandonWindow && (neverStarted || startMin == null)) return "meeting_never_happened";

  if (row.startedAt) return "in_progress";

  // Slot ended but still inside the 4h buffer → In progress (then never happened).
  const pastSlotEnd = isAtOrPastKolkata(row.meetingDate, endMin, now);
  if (pastSlotEnd && neverStarted) return "in_progress";

  if (row.meetingDate > today.date) return "scheduled";
  if (row.meetingDate < today.date) return "scheduled";

  const timeReached = startMin == null ? true : today.minutes >= startMin;
  // CRM Pre 10%: stay Scheduled until slot end (then buffer → In progress above).
  if (row.source === "crm") return "scheduled";
  if (!timeReached) return "scheduled";
  return "in_progress";
}

let tableReady: Promise<void> | null = null;

export function ensureLeadMeetingsTable(pool: Pool): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lead_meetings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          lead_id INT NOT NULL,
          meeting_date DATE NOT NULL,
          meeting_time VARCHAR(64) NULL,
          meeting_type VARCHAR(64) NOT NULL,
          meeting_mode VARCHAR(32) NULL,
          meeting_status ENUM('scheduled','rescheduled','cancelled') NOT NULL DEFAULT 'scheduled',
          progress ENUM('scheduled','in_progress','meeting_never_happened','completed') NOT NULL DEFAULT 'scheduled',
          designer_id INT NULL,
          source ENUM('design_module','crm') NOT NULL,
          branch VARCHAR(64) NULL,
          cancel_reason VARCHAR(500) NULL,
          cancel_files TEXT NULL,
          reschedule_count INT NOT NULL DEFAULT 0,
          started_at DATETIME NULL,
          ended_at DATETIME NULL,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          INDEX idx_lead_meetings_lead (lead_id),
          INDEX idx_lead_meetings_date (meeting_date),
          INDEX idx_lead_meetings_open (meeting_status, progress, meeting_date)
        )
      `);
      try {
        const [dateIdx] = await pool.query(
          `SELECT 1 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND INDEX_NAME = 'idx_lead_meetings_date'
            LIMIT 1`,
        );
        if ((dateIdx as unknown[]).length === 0) {
          await pool.query("CREATE INDEX idx_lead_meetings_date ON lead_meetings (meeting_date)");
        }
      } catch (dateIdxErr) {
        console.error("[lead-meetings] idx_lead_meetings_date ensure failed", dateIdxErr);
      }
      const [branchCol] = await pool.query(
        `SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'branch'`,
      );
      if ((branchCol as unknown[]).length === 0) {
        await pool.query("ALTER TABLE lead_meetings ADD COLUMN branch VARCHAR(64) NULL AFTER source");
      }
      const [cancelReasonCol] = await pool.query(
        `SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'cancel_reason'`,
      );
      if ((cancelReasonCol as unknown[]).length === 0) {
        const [legacyReasonCol] = await pool.query(
          `SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'reschedule_cancel_reason'`,
        );
        if ((legacyReasonCol as unknown[]).length > 0) {
          await pool.query(
            "ALTER TABLE lead_meetings CHANGE COLUMN reschedule_cancel_reason cancel_reason VARCHAR(500) NULL",
          );
        } else {
          await pool.query("ALTER TABLE lead_meetings ADD COLUMN cancel_reason VARCHAR(500) NULL AFTER branch");
        }
      }
      const [cancelFilesCol] = await pool.query(
        `SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'cancel_files'`,
      );
      if ((cancelFilesCol as unknown[]).length === 0) {
        await pool.query("ALTER TABLE lead_meetings ADD COLUMN cancel_files TEXT NULL AFTER cancel_reason");
      }
      const [rescheduleCountCol] = await pool.query(
        `SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'reschedule_count'`,
      );
      if ((rescheduleCountCol as unknown[]).length === 0) {
        await pool.query("ALTER TABLE lead_meetings ADD COLUMN reschedule_count INT NOT NULL DEFAULT 0 AFTER cancel_files");
      }
      const [feedbackDesignerCol] = await pool.query(
        `SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'feedback_designer'`,
      );
      if ((feedbackDesignerCol as unknown[]).length === 0) {
        await pool.query(
          "ALTER TABLE lead_meetings ADD COLUMN feedback_designer TEXT NULL AFTER reschedule_count",
        );
      }
      const [feedbackDesignerAtCol] = await pool.query(
        `SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'feedback_designer_at'`,
      );
      if ((feedbackDesignerAtCol as unknown[]).length === 0) {
        await pool.query(
          "ALTER TABLE lead_meetings ADD COLUMN feedback_designer_at DATETIME NULL AFTER feedback_designer",
        );
      }
      const [feedbackDesignerByCol] = await pool.query(
        `SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'feedback_designer_by'`,
      );
      if ((feedbackDesignerByCol as unknown[]).length === 0) {
        await pool.query(
          "ALTER TABLE lead_meetings ADD COLUMN feedback_designer_by VARCHAR(255) NULL AFTER feedback_designer_at",
        );
      }
      const [crmAppointmentIdCol] = await pool.query(
        `SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'crm_appointment_id'`,
      );
      if ((crmAppointmentIdCol as unknown[]).length === 0) {
        await pool.query(
          "ALTER TABLE lead_meetings ADD COLUMN crm_appointment_id BIGINT NULL AFTER feedback_designer_by",
        );
      }
      const [drrRevisitCol] = await pool.query(
        `SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'is_drr_revisit'`,
      );
      if ((drrRevisitCol as unknown[]).length === 0) {
        await pool.query(
          "ALTER TABLE lead_meetings ADD COLUMN is_drr_revisit TINYINT(1) NOT NULL DEFAULT 0 AFTER crm_appointment_id",
        );
      }
      // Rename progress: meeting_abandoned → meeting_never_happened (DB + rows).
      try {
        const [progressCol] = await pool.query(
          `SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'progress'
            LIMIT 1`,
        );
        const columnType = String((progressCol as { columnType?: string }[])[0]?.columnType || "");
        if (columnType.includes("meeting_abandoned")) {
          await pool.query(
            `ALTER TABLE lead_meetings
             MODIFY COLUMN progress ENUM(
               'scheduled','in_progress','meeting_abandoned','meeting_never_happened','completed'
             ) NOT NULL DEFAULT 'scheduled'`,
          );
          await pool.query(
            `UPDATE lead_meetings
                SET progress = 'meeting_never_happened'
              WHERE progress = 'meeting_abandoned'`,
          );
          await pool.query(
            `ALTER TABLE lead_meetings
             MODIFY COLUMN progress ENUM(
               'scheduled','in_progress','meeting_never_happened','completed'
             ) NOT NULL DEFAULT 'scheduled'`,
          );
        } else if (columnType && !columnType.includes("meeting_never_happened")) {
          await pool.query(
            `ALTER TABLE lead_meetings
             MODIFY COLUMN progress ENUM(
               'scheduled','in_progress','meeting_never_happened','completed'
             ) NOT NULL DEFAULT 'scheduled'`,
          );
        }
      } catch (progressRenameErr) {
        console.error("[lead-meetings] progress rename meeting_never_happened failed", progressRenameErr);
      }
      await pool.query(
        `UPDATE lead_meetings
            SET meeting_mode = CASE
                  WHEN LOWER(meeting_type) LIKE '%virtual%' OR LOWER(meeting_type) LIKE '%online%' THEN 'online'
                  WHEN LOWER(meeting_type) LIKE '%site%' THEN 'site'
                  WHEN LOWER(meeting_type) LIKE '%showroom%' THEN 'offline'
                  ELSE meeting_mode
                END,
                meeting_type = 'pre_10'
          WHERE source = 'crm' AND meeting_type <> 'pre_10'`,
      );
      // Never block API requests on backfill/reconcile — that timed out hosted Meeting Management.
      void cleanupOrphanMeetingRows(pool)
        .then(() => backfillLeadMeetings(pool))
        .then(() => reconcileCrmDrrScheduledMeetings(pool))
        .catch((err) => console.error("[lead-meetings] background backfill/cleanup failed", err));
      void reconcileCompletedDesignMeetings(pool).catch((err) =>
        console.error("[lead-meetings] background reconcile failed", err),
      );
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

async function writeHistory(
  pool: Pool,
  leadId: number,
  actor: MeetingActor | null | undefined,
  taskName: string,
  description: string,
  meta: Record<string, unknown>,
) {
  const event = {
    id: `meeting-${leadId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "note",
    taskName,
    timestamp: new Date().toISOString(),
    description,
    user: { name: actor?.name?.trim() || "System", avatar: null },
    meta,
    details: { kind: "note", noteText: description },
  };
  await pool.query("INSERT INTO lead_history (lead_id, event, created_at) VALUES (?, ?, ?)", [
    leadId,
    JSON.stringify(event),
    new Date(),
  ]);
}

/** Public activity-history write for meeting flows (DRR CRM sync notes, etc.). */
export async function recordLeadMeetingHistory(
  pool: Pool,
  leadId: number,
  actor: MeetingActor | null | undefined,
  taskName: string,
  description: string,
  meta: Record<string, unknown> = {},
) {
  if (!Number.isFinite(leadId) || leadId < 1) return;
  await writeHistory(pool, leadId, actor, taskName, description, meta);
}

function mapRow(row: Record<string, unknown>): MeetingRow {
  return {
    id: Number(row.id),
    leadId: Number(row.leadId),
    meetingDate: String(row.meetingDate || "").slice(0, 10),
    meetingTime: row.meetingTime == null ? null : String(row.meetingTime),
    meetingType: String(row.meetingType || ""),
    meetingMode: row.meetingMode == null ? null : String(row.meetingMode),
    meetingStatus: String(row.meetingStatus || "scheduled") as MeetingBookingStatus,
    progress: (() => {
      const raw = String(row.progress || "scheduled");
      if (raw === "meeting_abandoned") return "meeting_never_happened" as MeetingProgress;
      return raw as MeetingProgress;
    })(),
    designerId: row.designerId == null ? null : Number(row.designerId),
    designerName: row.designerName == null ? null : String(row.designerName),
    source: String(row.source || "design_module") as MeetingSource,
    cancelReason: row.cancelReason == null ? null : String(row.cancelReason),
    rescheduleCount: Number(row.rescheduleCount || 0),
    feedbackDesigner: row.feedbackDesigner == null ? null : String(row.feedbackDesigner),
    feedbackDesignerAt: (row.feedbackDesignerAt as Date | string | null) ?? null,
    feedbackDesignerBy: row.feedbackDesignerBy == null ? null : String(row.feedbackDesignerBy),
    crmAppointmentId: row.crmAppointmentId == null ? null : Number(row.crmAppointmentId),
    isDrrRevisit:
      row.isDrrRevisit === true ||
      Number(row.isDrrRevisit) === 1,
    startedAt: (row.startedAt as Date | string | null) ?? null,
    endedAt: (row.endedAt as Date | string | null) ?? null,
  };
}

const MEETING_SELECT = `
  SELECT m.id,
         m.lead_id AS leadId,
         DATE_FORMAT(m.meeting_date, '%Y-%m-%d') AS meetingDate,
         m.meeting_time AS meetingTime,
         m.meeting_type AS meetingType,
         m.meeting_mode AS meetingMode,
         m.meeting_status AS meetingStatus,
         m.progress,
         m.designer_id AS designerId,
         u.name AS designerName,
         m.source,
         m.cancel_reason AS cancelReason,
         COALESCE(m.reschedule_count, 0) AS rescheduleCount,
         m.feedback_designer AS feedbackDesigner,
         m.feedback_designer_at AS feedbackDesignerAt,
         m.feedback_designer_by AS feedbackDesignerBy,
         m.crm_appointment_id AS crmAppointmentId,
         COALESCE(m.is_drr_revisit, 0) AS isDrrRevisit,
         m.started_at AS startedAt,
         m.ended_at AS endedAt
    FROM lead_meetings m
    LEFT JOIN users u ON u.id = m.designer_id
`;

export async function loadMeeting(pool: Pool, id: number): Promise<MeetingRow | null> {
  const [rows] = await pool.query(`${MEETING_SELECT} WHERE m.id = ? LIMIT 1`, [id]);
  const row = (rows as Record<string, unknown>[])[0];
  return row ? mapRow(row) : null;
}

async function refreshStoredProgress(pool: Pool, row: MeetingRow, now: Date, writeHistoryOnChange: boolean) {
  if (row.source === "design_module" && row.meetingStatus !== "cancelled" && row.progress !== "completed") {
    const def = DESIGN_MEETINGS.find((item) => item.meetingType === row.meetingType) || designMeetingFromLabel(row.meetingType);
    if (def && (await designMeetingCycleComplete(pool, row.leadId, def))) {
      const nowStamp = new Date();
      await pool.query(
        `UPDATE lead_meetings
            SET progress = 'completed', ended_at = COALESCE(ended_at, ?), updated_at = ?
          WHERE id = ? AND progress <> 'completed' AND meeting_status <> 'cancelled'`,
        [nowStamp, nowStamp, row.id],
      );
      return { ...row, progress: "completed" as MeetingProgress, endedAt: row.endedAt || nowStamp };
    }
  }
  const next = nextMeetingProgress(row, now);
  if (next === row.progress) return row;
  // Never invent started_at on background refresh — only Start Meeting APIs stamp a real start.
  // Auto-stamping used to lock null-time / unstarted rows as In progress forever.
  const [updated] = await pool.query(
    `UPDATE lead_meetings
        SET progress = ?, updated_at = ?
      WHERE id = ? AND progress = ? AND meeting_status <> 'cancelled'`,
    [next, new Date(), row.id, row.progress],
  );
  if (Number((updated as ResultSetHeader).affectedRows) === 0) return row;
  if (writeHistoryOnChange) {
    const label = next === "in_progress" ? "Meeting in progress" : "Meeting never happened";
    await writeHistory(pool, row.leadId, { name: "System" }, label, `${label} for ${row.meetingDate}.`, {
      action: next,
      meetingId: row.id,
      meetingType: row.meetingType,
      meetingDate: row.meetingDate,
      meetingTime: row.meetingTime,
    });
  }
  const updatedRow: MeetingRow = { ...row, progress: next };
  // CRM does not auto-abandon — Design must call outcome API after local end+4h never-happened.
  if (
    next === "meeting_never_happened" &&
    row.source === "crm" &&
    row.progress !== "meeting_never_happened" &&
    crmAutoNeverHappenedHandler
  ) {
    void Promise.resolve(crmAutoNeverHappenedHandler(updatedRow)).catch((err) => {
      console.error("[lead-meetings] CRM auto never-happened sync failed", {
        meetingId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
  return updatedRow;
}

async function activeDesignRow(pool: Pool, leadId: number, meetingType: string): Promise<MeetingRow | null> {
  const [rows] = await pool.query(
    `${MEETING_SELECT}
      WHERE m.lead_id = ? AND m.source = 'design_module' AND m.meeting_type = ?
        AND m.meeting_status <> 'cancelled' AND m.progress <> 'completed'
      ORDER BY m.id DESC LIMIT 1`,
    [leadId, meetingType],
  );
  const row = (rows as Record<string, unknown>[])[0];
  return row ? mapRow(row) : null;
}

async function bookingTaskStillComplete(pool: Pool, leadId: number, def: DesignMeetingDef): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT 1 FROM lead_task_completions
      WHERE lead_id = ? AND milestone_index = ? AND task_name = ? LIMIT 1`,
    [leadId, def.milestoneIndex, def.bookingTask],
  );
  return (rows as unknown[]).length > 0;
}

async function taskCompletionAt(
  pool: Pool,
  leadId: number,
  milestoneIndex: number,
  taskName: string,
): Promise<Date | null> {
  const [rows] = await pool.query(
    `SELECT completed_at FROM lead_task_completions
      WHERE lead_id = ? AND milestone_index = ? AND task_name = ? LIMIT 1`,
    [leadId, milestoneIndex, taskName],
  );
  const at = (rows as { completed_at?: Date | string }[])[0]?.completed_at;
  if (!at) return null;
  const parsed = new Date(at);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function completionTaskDone(pool: Pool, leadId: number, def: DesignMeetingDef): Promise<boolean> {
  return (await taskCompletionAt(pool, leadId, def.milestoneIndex, def.completionTask)) != null;
}

/**
 * "meeting completed" only counts for the current booking cycle.
 * If booking was marked done again after an old MOM, the stale completion must not
 * block scheduling or instantly mark the new row as Meeting Successful.
 */
async function designMeetingCycleComplete(pool: Pool, leadId: number, def: DesignMeetingDef): Promise<boolean> {
  const completionAt = await taskCompletionAt(pool, leadId, def.milestoneIndex, def.completionTask);
  if (!completionAt) return false;
  const bookingAt = await taskCompletionAt(pool, leadId, def.milestoneIndex, def.bookingTask);
  if (bookingAt && completionAt < bookingAt) return false;
  return true;
}

async function readPayload(pool: Pool, leadId: number): Promise<Record<string, unknown> | null> {
  const [rows] = await pool.query("SELECT payload FROM leads WHERE id = ? LIMIT 1", [leadId]);
  const row = (rows as { payload?: string | null }[])[0];
  if (!row) return null;
  try {
    const parsed = row.payload ? JSON.parse(row.payload) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function persistCrmDrrLeadMarkers(
  pool: Pool,
  leadId: number,
  input: {
    meetingLabel?: string | null;
    milestoneSubStage?: string | null;
    subStage?: string | null;
  },
) {
  const payload = await readPayload(pool, leadId);
  if (!payload) return;
  const label = String(input.meetingLabel || "").trim();
  const milestone = String(input.milestoneSubStage || "").trim();
  const sub = String(input.subStage || "").trim();
  const drrText =
    isCrmDrrLabelText(label) || isCrmDrrLabelText(milestone) || isCrmDrrLabelText(sub);
  if (!drrText) return;
  if (label) payload.meetingLabel = label;
  if (milestone) payload.milestoneSubStage = milestone;
  if (sub) payload.subStage = sub;
  payload.crmDrrRevisit = true;
  await pool.query("UPDATE leads SET payload = ?, update_at = ? WHERE id = ?", [
    JSON.stringify(payload),
    new Date(),
    leadId,
  ]);
}

async function writeDesignPayload(
  pool: Pool,
  leadId: number,
  meeting: { meetingDate: string; meetingTime: string | null; meetingType: string; meetingMode: string | null } | null,
) {
  const payload = await readPayload(pool, leadId);
  if (!payload) return;
  if (!meeting) {
    delete payload.designScheduledMeeting;
    delete payload.scheduledMeetingDate;
    delete payload.scheduledMeetingSlot;
  } else {
    payload.designScheduledMeeting = {
      date: meeting.meetingDate,
      time: meeting.meetingTime,
      meetingType: meeting.meetingType,
      meetingMode: meeting.meetingMode,
      updatedAt: new Date().toISOString(),
    };
    payload.scheduledMeetingDate = meeting.meetingDate;
    if (meeting.meetingTime) payload.scheduledMeetingSlot = meeting.meetingTime;
  }
  await pool.query("UPDATE leads SET payload = ?, update_at = ? WHERE id = ?", [
    JSON.stringify(payload),
    new Date(),
    leadId,
  ]);
}

export async function recordDesignMeetingFromSchedule(
  pool: Pool,
  input: {
    leadId: number;
    meetingDate?: string | null;
    meetingTime?: string | null;
    meetingType?: string | null;
    meetingMode?: string | null;
    actor?: MeetingActor | null;
  },
) {
  const def = designMeetingFromLabel(input.meetingType);
  const dateIso = normalizeDateIso(input.meetingDate);
  if (!def || !dateIso) return null;
  await ensureLeadMeetingsTable(pool);
  if (await designMeetingCycleComplete(pool, input.leadId, def)) return null;
  const timeLabel = normalizeTimeLabel(input.meetingTime);
  // Same as CRM: never create a board row with "Time not set".
  if (!timeLabel) {
    console.warn("[recordDesignMeetingFromSchedule] skip — date without slot", {
      leadId: input.leadId,
      dateIso,
      meetingType: def.meetingType,
      rawTime: input.meetingTime ?? null,
    });
    return null;
  }
  const mode = input.meetingMode ? String(input.meetingMode).trim().slice(0, 32) : null;
  const active = await activeDesignRow(pool, input.leadId, def.meetingType);
  const [leadRows] = await pool.query("SELECT assigned_designer_id AS designerId FROM leads WHERE id = ? LIMIT 1", [
    input.leadId,
  ]);
  const designerId = (leadRows as { designerId?: number | null }[])[0]?.designerId ?? null;
  const now = new Date();
  const progress = nextMeetingProgress(
    {
      meetingStatus: "scheduled",
      progress: "scheduled",
      meetingDate: dateIso,
      meetingTime: timeLabel,
      source: "design_module",
      startedAt: null,
    },
    now,
  );

  if (active) {
    if (
      active.meetingDate === dateIso &&
      normalizeTimeLabel(active.meetingTime) === timeLabel &&
      (active.meetingMode || null) === mode
    ) {
      return active;
    }
    await pool.query(
      `UPDATE lead_meetings
          SET meeting_date = ?, meeting_time = ?, meeting_mode = ?, meeting_status = 'rescheduled',
              progress = ?, designer_id = COALESCE(?, designer_id),
              started_at = ?, ended_at = NULL, updated_at = ?
        WHERE id = ?`,
      [dateIso, timeLabel, mode, progress, designerId, progress === "in_progress" ? now : null, now, active.id],
    );
    await writeHistory(pool, input.leadId, input.actor, "Meeting rescheduled", `Meeting moved to ${dateIso} ${timeLabel || ""}.`.trim(), {
      action: "rescheduled",
      meetingId: active.id,
      meetingType: def.meetingType,
      fromDate: active.meetingDate,
      fromTime: active.meetingTime,
      meetingDate: dateIso,
      meetingTime: timeLabel,
    });
    return loadMeeting(pool, active.id);
  }

  if (await bookingTaskStillComplete(pool, input.leadId, def)) {
    const [doneRows] = await pool.query(
      `SELECT id FROM lead_meetings
        WHERE lead_id = ? AND source = 'design_module' AND meeting_type = ? AND progress = 'completed'
        LIMIT 1`,
      [input.leadId, def.meetingType],
    );
    if ((doneRows as unknown[]).length > 0) return null;
  }

  const branch = await leadBranch(pool, input.leadId);
  const [result] = await pool.query(
    `INSERT INTO lead_meetings
      (lead_id, meeting_date, meeting_time, meeting_type, meeting_mode, meeting_status, progress, designer_id, source, branch, started_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, 'design_module', ?, ?, ?, ?)`,
    [input.leadId, dateIso, timeLabel, def.meetingType, mode, progress, designerId, branch, progress === "in_progress" ? now : null, now, now],
  );
  const id = Number((result as ResultSetHeader).insertId);
  await writeHistory(pool, input.leadId, input.actor, "Meeting scheduled", `Meeting scheduled for ${dateIso} ${timeLabel || ""}.`.trim(), {
    action: "scheduled",
    meetingId: id,
    meetingType: def.meetingType,
    meetingDate: dateIso,
    meetingTime: timeLabel,
    meetingMode: mode,
  });
  return loadMeeting(pool, id);
}

/** CRM appointments are the Pre 10% meeting. Showroom, virtual, and site stay on meeting_mode. */
function crmChannel(value: string | null | undefined): string | null {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text === "pre_10" || text === "pre10") return null;
  if (text === "online" || text.includes("virtual")) return "online";
  if (text === "site" || text.includes("site")) return "site";
  if (text === "offline" || text.includes("showroom")) return "offline";
  return null;
}

export async function recordCrmMeeting(
  pool: Pool,
  input: {
    leadId: number;
    meetingDate?: string | null;
    meetingTime?: string | null;
    meetingMode?: string | null;
    meetingType?: string | null;
    meetingLabel?: string | null;
    milestoneSubStage?: string | null;
    subStage?: string | null;
    designerId?: number | null;
    actor?: MeetingActor | null;
  },
) {
  const dateIso = normalizeDateIso(input.meetingDate);
  if (!dateIso) return null;
  await ensureLeadMeetingsTable(pool);
  const incomingTime = normalizeTimeLabel(input.meetingTime);
  const mode = crmChannel(input.meetingType) || crmChannel(input.meetingMode);

  // Successful CRM meetings stay frozen (never rewritten below).
  // A later CRM booking with a real date+slot (DRR revisit) creates a NEW open row instead.
  // Keep CRM meeting_type as pre_10 so Meeting Management MEETING column badges stay unchanged.
  // DRR is tracked via meetingLabel / crmDrrRevisit for the filter only.
  const meetingType = "pre_10";

  const [rows] = await pool.query(
    `${MEETING_SELECT}
      WHERE m.lead_id = ? AND m.source = 'crm' AND m.meeting_status <> 'cancelled' AND m.progress <> 'completed'
      ORDER BY m.id DESC LIMIT 1`,
    [input.leadId],
  );
  const active = (rows as Record<string, unknown>[])[0] ? mapRow((rows as Record<string, unknown>[])[0]) : null;
  const now = new Date();
  // DRR only when CRM/Hub sends Design Refinement Round label/substage — never “2nd meeting”.
  const drrVisit =
    isCrmDrrLabelText(input.meetingLabel) ||
    isCrmDrrLabelText(input.meetingType) ||
    isCrmDrrLabelText(input.milestoneSubStage) ||
    isCrmDrrLabelText(input.subStage);
  if (drrVisit) {
    await persistCrmDrrLeadMarkers(pool, input.leadId, {
      meetingLabel: input.meetingLabel,
      milestoneSubStage: input.milestoneSubStage,
      subStage: input.subStage,
    });
  }
  if (active) {
    // Hub null/omit slot is a bug upstream — keep existing meeting_time as-is.
    const timeLabel = incomingTime ?? normalizeTimeLabel(active.meetingTime) ?? active.meetingTime;
    if (!incomingTime && active.meetingTime) {
      console.warn("[recordCrmMeeting] Hub sent null/empty slot — keeping existing meeting_time", {
        leadId: input.leadId,
        meetingId: active.id,
        keptTime: active.meetingTime,
        dateIso,
      });
    }
    const nextMode = mode || active.meetingMode;
    const sameDate = active.meetingDate === dateIso;
    const sameTime = normalizeTimeLabel(active.meetingTime) === normalizeTimeLabel(timeLabel);
    if (sameDate && sameTime) {
      if (active.meetingType !== meetingType || (active.meetingMode || null) !== (nextMode || null) || drrVisit) {
        await pool.query(
          `UPDATE lead_meetings
              SET meeting_type = ?, meeting_mode = ?, is_drr_revisit = CASE WHEN ? THEN 1 ELSE is_drr_revisit END, updated_at = ?
            WHERE id = ?`,
          [meetingType, nextMode, drrVisit ? 1 : 0, now, active.id],
        );
        return loadMeeting(pool, active.id);
      }
      return active;
    }
    // Date/time truly changed → reschedule. COALESCE so null never wipes time in SQL.
    const progress = nextMeetingProgress(
      { ...active, meetingDate: dateIso, meetingTime: timeLabel, meetingStatus: "rescheduled", progress: "scheduled", startedAt: null },
      now,
    );
    await pool.query(
      `UPDATE lead_meetings
          SET meeting_date = ?, meeting_time = COALESCE(?, meeting_time), meeting_mode = ?, meeting_type = ?, meeting_status = 'rescheduled',
              reschedule_count = reschedule_count + 1,
              progress = ?, started_at = NULL, ended_at = NULL,
              is_drr_revisit = CASE WHEN ? THEN 1 ELSE is_drr_revisit END, updated_at = ?
        WHERE id = ?`,
      [dateIso, timeLabel, mode || active.meetingMode, meetingType, progress, drrVisit ? 1 : 0, now, active.id],
    );
    await writeHistory(pool, input.leadId, input.actor, "Meeting rescheduled", `CRM meeting moved to ${dateIso} ${timeLabel || ""}.`.trim(), {
      action: "rescheduled",
      meetingId: active.id,
      source: "crm",
      fromDate: active.meetingDate,
      fromTime: active.meetingTime,
      meetingDate: dateIso,
      meetingTime: timeLabel,
    });
    return loadMeeting(pool, active.id);
  }

  // New schedule must include a real slot — null slot from Hub is a bug; do not create "Time not set".
  if (!incomingTime) {
    console.warn("[recordCrmMeeting] skip create — Hub sent date without slot", {
      leadId: input.leadId,
      dateIso,
      rawSlot: input.meetingTime ?? null,
    });
    return null;
  }
  const timeLabel = incomingTime;
  const progress = nextMeetingProgress(
    {
      meetingStatus: "scheduled",
      progress: "scheduled",
      meetingDate: dateIso,
      meetingTime: timeLabel,
      source: "crm",
      startedAt: null,
    },
    now,
  );
  const branch = await leadBranch(pool, input.leadId);
  const [result] = await pool.query(
    `INSERT INTO lead_meetings
      (lead_id, meeting_date, meeting_time, meeting_type, meeting_mode, meeting_status, progress, designer_id, source, branch, is_drr_revisit, started_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, 'crm', ?, ?, ?, ?, ?)`,
    [
      input.leadId,
      dateIso,
      timeLabel,
      meetingType,
      mode,
      progress,
      input.designerId ?? null,
      branch,
      drrVisit ? 1 : 0,
      progress === "in_progress" ? now : null,
      now,
      now,
    ],
  );
  const id = Number((result as ResultSetHeader).insertId);
  await writeHistory(pool, input.leadId, input.actor, "Meeting scheduled", `CRM meeting scheduled for ${dateIso} ${timeLabel || ""}.`.trim(), {
    action: "scheduled",
    meetingId: id,
    source: "crm",
    meetingDate: dateIso,
    meetingTime: timeLabel,
  });
  return loadMeeting(pool, id);
}

export async function markDesignMeetingCompleted(
  pool: Pool,
  input: { leadId: number; milestoneIndex: number; taskName: string; actor?: MeetingActor | null },
) {
  const def = designMeetingFromCompletion(input.milestoneIndex, input.taskName);
  if (!def) return null;
  await ensureLeadMeetingsTable(pool);
  const active = await activeDesignRow(pool, input.leadId, def.meetingType);
  if (!active) return null;
  const now = new Date();
  await pool.query(
    `UPDATE lead_meetings SET progress = 'completed', ended_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, active.id],
  );
  await writeHistory(pool, input.leadId, input.actor, "Meeting Successful", `${def.bookingTask} marked Meeting Successful.`, {
    action: "completed",
    meetingId: active.id,
    meetingType: def.meetingType,
    meetingDate: active.meetingDate,
    meetingTime: active.meetingTime,
  });
  return loadMeeting(pool, active.id);
}

async function assertDesignMutable(pool: Pool, row: MeetingRow) {
  if (row.meetingStatus === "cancelled") {
    throw new MeetingActionError(409, "This meeting is already cancelled");
  }
  if (row.progress === "completed") {
    throw new MeetingActionError(409, "This meeting is already Meeting Successful");
  }
  if (row.source === "crm") {
    throw new MeetingActionError(409, "Pre 10% meetings from CRM are changed in CRM");
  }
  if (row.source !== "design_module") return;
  const def = DESIGN_MEETINGS.find((item) => item.meetingType === row.meetingType);
  if (def && (await designMeetingCycleComplete(pool, row.leadId, def))) {
    const now = new Date();
    await pool.query(
      `UPDATE lead_meetings SET progress = 'completed', ended_at = COALESCE(ended_at, ?), updated_at = ? WHERE id = ?`,
      [now, now, row.id],
    );
    throw new MeetingActionError(409, "This meeting is already Meeting Successful");
  }
}

export async function rescheduleLeadMeeting(
  pool: Pool,
  meetingId: number,
  input: {
    meetingDate: unknown;
    meetingTime: unknown;
    meetingMode?: unknown;
    reason?: unknown;
    actor?: MeetingActor | null;
    now?: Date;
    assertDesignerAvailable?: (designerName: string | null, meetingDate: string) => Promise<void>;
  },
) {
  await ensureLeadMeetingsTable(pool);
  const row = await loadMeeting(pool, meetingId);
  if (!row) throw new MeetingActionError(404, "Meeting not found");
  await assertDesignMutable(pool, row);
  const dateIso = normalizeDateIso(input.meetingDate);
  const timeLabel = normalizeTimeLabel(input.meetingTime);
  if (!dateIso || !timeLabel) {
    throw new MeetingActionError(400, "A future date and time are required");
  }
  const reason = String(input.reason || "").trim();
  if (!reason) throw new MeetingActionError(400, "A reschedule reason is required");
  if (reason.length > 500) throw new MeetingActionError(400, "Reason must be 500 characters or less");
  const now = input.now || new Date();
  if (!isFutureKolkataSlot(dateIso, timeLabel, now)) {
    throw new MeetingActionError(400, "Pick a date and time that is still ahead");
  }
  if (row.meetingDate === dateIso && normalizeTimeLabel(row.meetingTime) === timeLabel) {
    throw new MeetingActionError(400, "Pick a different date or time");
  }
  if (input.assertDesignerAvailable) {
    await input.assertDesignerAvailable(row.designerName, dateIso);
  }
  const mode =
    input.meetingMode == null || String(input.meetingMode).trim() === ""
      ? row.meetingMode
      : String(input.meetingMode).trim().slice(0, 32);
  const progress = nextMeetingProgress(
    {
      meetingStatus: "rescheduled",
      progress: "scheduled",
      meetingDate: dateIso,
      meetingTime: timeLabel,
      source: row.source,
      startedAt: null,
    },
    now,
  );
  // Cancel and reschedule share cancel_reason as the single reason column.
  await pool.query(
    `UPDATE lead_meetings
        SET meeting_date = ?, meeting_time = ?, meeting_mode = ?, meeting_status = 'rescheduled',
            reschedule_count = reschedule_count + 1,
            progress = ?, cancel_reason = ?, started_at = NULL, ended_at = NULL, updated_at = ?
      WHERE id = ?`,
    [dateIso, timeLabel, mode, progress, reason, new Date(), row.id],
  );
  if (row.source === "design_module") {
    await writeDesignPayload(pool, row.leadId, {
      meetingDate: dateIso,
      meetingTime: timeLabel,
      meetingType: row.meetingType,
      meetingMode: mode,
    });
  }
  await writeHistory(pool, row.leadId, input.actor, "Meeting rescheduled", `Meeting moved from ${row.meetingDate} ${row.meetingTime || ""} to ${dateIso} ${timeLabel}. ${reason}`.trim(), {
    action: "rescheduled",
    meetingId: row.id,
    meetingType: row.meetingType,
    fromDate: row.meetingDate,
    fromTime: row.meetingTime,
    meetingDate: dateIso,
    meetingTime: timeLabel,
    meetingMode: mode,
    reason,
  });
  return loadMeeting(pool, row.id);
}

/**
 * Hub/CRM cancel via external-upsert or hub-appointment-cancelled —
 * marks open Pre 10% CRM meetings cancelled.
 * Design-board cancel stays blocked for CRM rows (`assertDesignMutable`).
 */
export async function cancelCrmMeetingsForLead(
  pool: Pool,
  leadId: number,
  input: { reason?: string | null; actor?: MeetingActor | null; from?: string | null },
): Promise<number> {
  if (!Number.isInteger(leadId) || leadId < 1) return 0;
  await ensureLeadMeetingsTable(pool);
  const reason = String(input.reason || "").trim() || "Meeting Cancelled from CRM";
  const [rows] = await pool.query(
    `SELECT id FROM lead_meetings
      WHERE lead_id = ? AND source = 'crm'
        AND meeting_status <> 'cancelled' AND progress <> 'completed'`,
    [leadId],
  );
  const ids = (rows as { id?: unknown }[])
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) return 0;

  const now = new Date();
  await pool.query(
    `UPDATE lead_meetings
        SET meeting_status = 'cancelled', cancel_reason = ?, updated_at = ?
      WHERE id IN (${ids.map(() => "?").join(",")})`,
    [reason.slice(0, 500), now, ...ids],
  );
  await writeHistory(
    pool,
    leadId,
    input.actor,
    "Meeting cancelled",
    `CRM Pre 10% meeting cancelled. ${reason}`.trim(),
    {
      action: "cancelled",
      source: "crm",
      reason,
      meetingIds: ids,
      from: String(input.from || "external_upsert").trim() || "external_upsert",
    },
  );
  return ids.length;
}

/**
 * CRM Pre-10% designer feedback. Updates matching CRM meeting only —
 * does not change meeting_status / progress.
 */
export async function applyCrmMeetingFeedback(
  pool: Pool,
  input: {
    leadId: number;
    feedbackDesigner: string;
    feedbackBy?: string | null;
    appointmentDate?: string | null;
    appointmentSlot?: string | null;
    crmAppointmentId?: number | null;
    actor?: MeetingActor | null;
  },
) {
  await ensureLeadMeetingsTable(pool);
  const feedback = String(input.feedbackDesigner || "").trim();
  if (!feedback) throw new MeetingActionError(400, "feedbackDesigner is required");
  if (feedback.length > 4000) {
    throw new MeetingActionError(400, "feedbackDesigner must be 4000 characters or less");
  }
  const now = new Date();
  const by = String(input.feedbackBy || input.actor?.name || "CRM").trim() || "CRM";
  const crmAppointmentId =
    input.crmAppointmentId != null && Number.isFinite(Number(input.crmAppointmentId))
      ? Number(input.crmAppointmentId)
      : null;
  const dateIso = normalizeDateIso(input.appointmentDate);

  let meetingId: number | null = null;
  if (crmAppointmentId != null) {
    const [byApptLead] = await pool.query(
      `SELECT id FROM lead_meetings
        WHERE lead_id = ? AND source = 'crm' AND crm_appointment_id = ?
        ORDER BY id DESC LIMIT 1`,
      [input.leadId, crmAppointmentId],
    );
    meetingId = Number((byApptLead as { id?: number }[])[0]?.id) || null;
    if (meetingId == null) {
      const [byApptOnly] = await pool.query(
        `SELECT id FROM lead_meetings
          WHERE source = 'crm' AND crm_appointment_id = ?
          ORDER BY id DESC LIMIT 1`,
        [crmAppointmentId],
      );
      meetingId = Number((byApptOnly as { id?: number }[])[0]?.id) || null;
    }
  }
  if (meetingId == null && dateIso) {
    const [byDate] = await pool.query(
      `SELECT id FROM lead_meetings
        WHERE lead_id = ? AND source = 'crm' AND meeting_date = ?
        ORDER BY id DESC LIMIT 1`,
      [input.leadId, dateIso],
    );
    meetingId = Number((byDate as { id?: number }[])[0]?.id) || null;
  }
  if (meetingId == null) {
    const [latest] = await pool.query(
      `SELECT id FROM lead_meetings
        WHERE lead_id = ? AND source = 'crm'
        ORDER BY id DESC LIMIT 1`,
      [input.leadId],
    );
    meetingId = Number((latest as { id?: number }[])[0]?.id) || null;
  }
  if (meetingId == null) {
    // Create a lightweight CRM meeting row so feedback still lands on Pre 10%.
    if (!dateIso) {
      throw new MeetingActionError(404, "No CRM meeting found for feedback");
    }
    const created = await recordCrmMeeting(pool, {
      leadId: input.leadId,
      meetingDate: dateIso,
      meetingTime: input.appointmentSlot || null,
      meetingType: "pre_10",
      actor: input.actor || { name: "CRM" },
    });
    meetingId = created?.id ?? null;
  }
  if (meetingId == null) {
    throw new MeetingActionError(404, "No CRM meeting found for feedback");
  }

  await pool.query(
    `UPDATE lead_meetings
        SET feedback_designer = ?,
            feedback_designer_at = ?,
            feedback_designer_by = ?,
            crm_appointment_id = COALESCE(?, crm_appointment_id),
            updated_at = ?
      WHERE id = ?`,
    [feedback, now, by, crmAppointmentId, now, meetingId],
  );
  await writeHistory(pool, input.leadId, input.actor || { name: by }, "CRM designer feedback", feedback, {
    action: "feedback_designer",
    meetingId,
    crmAppointmentId,
    feedbackBy: by,
    from: "crm_hub",
  });
  return loadMeeting(pool, meetingId);
}

export async function cancelLeadMeeting(
  pool: Pool,
  meetingId: number,
  input: {
    reason: unknown;
    actor?: MeetingActor | null;
    files?: { id: number; name: string; mimeType: string | null }[] | null;
  },
) {
  await ensureLeadMeetingsTable(pool);
  const row = await loadMeeting(pool, meetingId);
  if (!row) throw new MeetingActionError(404, "Meeting not found");
  await assertDesignMutable(pool, row);
  const reason = String(input.reason || "").trim();
  if (!reason) throw new MeetingActionError(400, "A cancel reason is required");
  if (reason.length > 500) throw new MeetingActionError(400, "Cancel reason must be 500 characters or less");
  const files = (input.files || []).filter((file) => Number.isFinite(file.id));
  const now = new Date();
  await pool.query(
    `UPDATE lead_meetings
        SET meeting_status = 'cancelled', cancel_reason = ?, cancel_files = ?, updated_at = ?
      WHERE id = ?`,
    [reason, files.length ? JSON.stringify(files) : null, now, row.id],
  );
  const def = row.source === "design_module" ? DESIGN_MEETINGS.find((item) => item.meetingType === row.meetingType) : undefined;
  let milestoneReopened = false;
  if (def) {
    const [deleted] = await pool.query(
      `DELETE FROM lead_task_completions
        WHERE lead_id = ? AND milestone_index = ? AND task_name = ?`,
      [row.leadId, def.milestoneIndex, def.bookingTask],
    );
    milestoneReopened = Number((deleted as ResultSetHeader).affectedRows) > 0;
    try {
      await awardTaskCompletionXp(pool, {
        leadId: row.leadId,
        milestoneIndex: def.milestoneIndex,
        taskName: def.bookingTask,
        completionDate: now,
      });
    } catch (err) {
      console.error("[lead-meetings] xp reconcile after cancel failed", err);
    }
  }
  const payload = await readPayload(pool, row.leadId);
  const storedDate = normalizeDateIso(
    (payload?.designScheduledMeeting as { date?: string } | undefined)?.date || payload?.scheduledMeetingDate,
  );
  const storedType = designMeetingFromLabel(
    (payload?.designScheduledMeeting as { meetingType?: string } | undefined)?.meetingType,
  );
  if (
    row.source === "design_module" &&
    payload &&
    storedDate === row.meetingDate &&
    (!storedType || storedType.meetingType === row.meetingType)
  ) {
    await writeDesignPayload(pool, row.leadId, null);
  }
  const fileNames = files.map((file) => file.name).filter(Boolean);
  await writeHistory(pool, row.leadId, input.actor, "Meeting cancelled", `Meeting on ${row.meetingDate} was cancelled. ${reason}`, {
    action: "cancelled",
    meetingId: row.id,
    meetingType: row.meetingType,
    meetingDate: row.meetingDate,
    meetingTime: row.meetingTime,
    reason,
    files: fileNames,
    milestoneReopened,
  });
  return { meeting: await loadMeeting(pool, row.id), milestoneReopened };
}

export async function startCrmMeeting(
  pool: Pool,
  meetingId: number,
  actor?: MeetingActor | null,
  now = new Date(),
) {
  await ensureLeadMeetingsTable(pool);
  const row = await loadMeeting(pool, meetingId);
  if (!row) throw new MeetingActionError(404, "Meeting not found");
  if (row.source !== "crm") throw new MeetingActionError(400, "Start Meeting is for CRM meetings");
  if (row.meetingStatus === "cancelled") throw new MeetingActionError(409, "This meeting is cancelled");
  if (row.progress === "completed") throw new MeetingActionError(409, "This meeting is already Meeting Successful");
  const today = kolkataParts(now).date;
  if (row.meetingDate !== today) {
    throw new MeetingActionError(409, "Start Meeting is available on the meeting day");
  }
  if (row.progress === "in_progress" && row.startedAt) return row;
  const started = new Date();
  await pool.query(
    `UPDATE lead_meetings SET progress = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?`,
    [started, started, row.id],
  );
  await writeHistory(pool, row.leadId, actor, "Meeting in progress", "CRM meeting started.", {
    action: "started",
    meetingId: row.id,
    meetingDate: row.meetingDate,
    meetingTime: row.meetingTime,
  });
  return loadMeeting(pool, row.id);
}

/** Fired when Design auto-marks a CRM visit Meeting never happened (slot end + 4h). */
export type CrmAutoNeverHappenedHandler = (meeting: MeetingRow) => void | Promise<void>;

let crmAutoNeverHappenedHandler: CrmAutoNeverHappenedHandler | null = null;

/** Register CRM sync for auto never-happened (server wires outcome API). */
export function registerCrmAutoNeverHappenedHandler(handler: CrmAutoNeverHappenedHandler | null) {
  crmAutoNeverHappenedHandler = handler;
}

export async function endCrmMeeting(
  pool: Pool,
  meetingId: number,
  actor?: MeetingActor | null,
  opts?: { isDrr?: boolean },
) {
  await ensureLeadMeetingsTable(pool);
  const row = await loadMeeting(pool, meetingId);
  if (!row) throw new MeetingActionError(404, "Meeting not found");
  if (row.source !== "crm") throw new MeetingActionError(400, "End is for CRM meetings");
  if (row.meetingStatus === "cancelled") throw new MeetingActionError(409, "This meeting is cancelled");
  // CRM blocks Successful ↔ Never Happened flips (409). Keep Design aligned.
  if (row.progress === "meeting_never_happened") {
    throw new MeetingActionError(
      409,
      "Cannot mark Meeting successful — already Meeting never happened",
    );
  }
  if (row.progress === "completed") return row;
  const now = new Date();
  await pool.query(
    `UPDATE lead_meetings SET progress = 'completed', ended_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, row.id],
  );
  const isDrr = opts?.isDrr === true || row.isDrrRevisit === true;
  await writeHistory(
    pool,
    row.leadId,
    actor,
    isDrr ? "Meeting Successful (DRR)" : "Meeting Successful",
    isDrr
      ? "Design Refinement Round visit marked Meeting Successful."
      : "CRM meeting ended.",
    {
      action: "completed",
      meetingId: row.id,
      source: "crm",
      isDrr,
      meetingDate: row.meetingDate,
      meetingTime: row.meetingTime,
    },
  );
  return loadMeeting(pool, row.id);
}

/** Mark CRM visit as Meeting never happened (Design DRR outcome). */
export async function abandonCrmMeeting(
  pool: Pool,
  meetingId: number,
  actor?: MeetingActor | null,
  opts?: { isDrr?: boolean },
) {
  await ensureLeadMeetingsTable(pool);
  const row = await loadMeeting(pool, meetingId);
  if (!row) throw new MeetingActionError(404, "Meeting not found");
  if (row.source !== "crm") throw new MeetingActionError(400, "Never happened is for CRM meetings");
  if (row.meetingStatus === "cancelled") throw new MeetingActionError(409, "This meeting is cancelled");
  if (row.progress === "completed") {
    throw new MeetingActionError(409, "This meeting is already successful");
  }
  if (row.progress === "meeting_never_happened") return row;
  const now = new Date();
  await pool.query(
    `UPDATE lead_meetings SET progress = 'meeting_never_happened', ended_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, row.id],
  );
  const isDrr = opts?.isDrr === true || row.isDrrRevisit === true;
  await writeHistory(
    pool,
    row.leadId,
    actor,
    isDrr ? "Meeting never happened (DRR)" : "Meeting never happened",
    isDrr
      ? "Design Refinement Round visit marked Meeting never happened."
      : "CRM meeting marked never happened.",
    {
      action: "meeting_never_happened",
      meetingId: row.id,
      source: "crm",
      isDrr,
      meetingDate: row.meetingDate,
      meetingTime: row.meetingTime,
    },
  );
  return loadMeeting(pool, row.id);
}

/** Persist CRM appointment id on a meeting row when resolved later (feedback / DRR outcome). */
export async function stampCrmAppointmentId(
  pool: Pool,
  meetingId: number,
  crmAppointmentId: number,
): Promise<void> {
  if (!Number.isFinite(meetingId) || meetingId < 1) return;
  if (!Number.isFinite(crmAppointmentId) || crmAppointmentId < 1) return;
  await ensureLeadMeetingsTable(pool);
  await pool.query(
    `UPDATE lead_meetings
        SET crm_appointment_id = COALESCE(crm_appointment_id, ?), updated_at = ?
      WHERE id = ?`,
    [crmAppointmentId, new Date(), meetingId],
  );
}

/** True when this CRM row is a Design Refinement Round (DRR) revisit. */
export async function isCrmDrrMeeting(pool: Pool, meetingId: number): Promise<boolean> {
  await ensureLeadMeetingsTable(pool);
  const [rows] = await pool.query(
    `SELECT CASE WHEN ${CRM_DRR_REVISIT_SQL} THEN 1 ELSE 0 END AS crmDrrRevisit
       FROM lead_meetings m
       JOIN leads l ON l.id = m.lead_id
      WHERE m.id = ?
      LIMIT 1`,
    [meetingId],
  );
  const flag = (rows as { crmDrrRevisit?: number | boolean | string }[])[0]?.crmDrrRevisit;
  return flag === 1 || flag === true || flag === "1";
}

export async function startActiveCrmMeetingForLead(pool: Pool, leadId: number, actor?: MeetingActor | null) {
  await ensureLeadMeetingsTable(pool);
  const today = kolkataParts().date;
  const [rows] = await pool.query(
    `${MEETING_SELECT}
      WHERE m.lead_id = ? AND m.source = 'crm' AND m.meeting_status <> 'cancelled' AND m.progress <> 'completed'
        AND DATE_FORMAT(m.meeting_date, '%Y-%m-%d') = ?
      ORDER BY m.id DESC LIMIT 1`,
    [leadId, today],
  );
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) throw new MeetingActionError(404, "No CRM meeting is scheduled for today");
  return startCrmMeeting(pool, Number(row.id), actor);
}

export async function endActiveCrmMeeting(pool: Pool, leadId: number, actor?: MeetingActor | null) {
  await ensureLeadMeetingsTable(pool);
  const [rows] = await pool.query(
    `${MEETING_SELECT}
      WHERE m.lead_id = ? AND m.source = 'crm' AND m.meeting_status <> 'cancelled' AND m.progress <> 'completed'
      ORDER BY m.meeting_date DESC, m.id DESC LIMIT 1`,
    [leadId],
  );
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) return null;
  return endCrmMeeting(pool, Number(row.id), actor);
}

function cleanText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return null;
  return text;
}

function storedBranch(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const raw = text.toLowerCase();
  if (raw === "experience center" || raw === "experience centre") return null;
  if (raw === "hbr" || raw.includes("hbr")) return "HBR";
  if (raw === "sjr" || raw.includes("sarjapur") || raw.includes("sjr")) return "SJR";
  if (raw === "jpn" || raw.includes("jp nagar") || raw.includes("j.p") || raw.includes("jpn")) return "JPN";
  return text.slice(0, 64);
}

async function leadBranch(pool: Pool, leadId: number): Promise<string | null> {
  const [rows] = await pool.query(
    `SELECT
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.formData.sales_closure_ec')) AS ecFormSales,
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.formData.branch')) AS ecFormBranch,
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.formData.experience_center')) AS ecFormCenter,
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.form_data.sales_closure_ec')) AS ecDataSales,
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.form_data.branch')) AS ecDataBranch,
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.form_data.experience_center')) AS ecDataCenter,
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.sales_closure_ec')) AS ecRootSales,
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.branch')) AS ecRootBranch,
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.experience_center')) AS ecRootCenter,
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.form.sales_closure_ec')) AS ecAltSales,
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.form.branch')) AS ecAltBranch,
        JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.form.experience_center')) AS ecAltCenter
       FROM leads
      WHERE id = ? LIMIT 1`,
    [leadId],
  );
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) return null;
  return (
    storedBranch(row.ecFormSales) ||
    storedBranch(row.ecFormBranch) ||
    storedBranch(row.ecFormCenter) ||
    storedBranch(row.ecDataSales) ||
    storedBranch(row.ecDataBranch) ||
    storedBranch(row.ecDataCenter) ||
    storedBranch(row.ecRootSales) ||
    storedBranch(row.ecRootBranch) ||
    storedBranch(row.ecRootCenter) ||
    storedBranch(row.ecAltSales) ||
    storedBranch(row.ecAltBranch) ||
    storedBranch(row.ecAltCenter)
  );
}

function positiveAmount(value: unknown): number | null {
  if (value == null) return null;
  const numeric = Number(String(value).replace(/,/g, "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

export function meetingEndedIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const text = String(value || "").trim();
  if (!text || text.toLowerCase() === "null") return null;
  const parsed = new Date(text.includes("T") ? text : text.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

const QUOTE_AMOUNT_KEYS = [
  "totalPayableAmount",
  "totalPayable",
  "quotation_total",
  "quotationTotal",
  "quotation_total_at_sales_closure",
  "grandTotal",
  "netPayable",
  "finalTotalPrice",
  "finalPrice",
  "final_amount",
  "finalAmount",
  "totalAmount",
  "totalPrice",
  "payableAmount",
  "amountPayable",
] as const;

function pickQuoteAmountFromObject(source: Record<string, unknown> | null | undefined): number | null {
  if (!source) return null;
  for (const key of QUOTE_AMOUNT_KEYS) {
    const amount = positiveAmount(source[key]);
    if (amount != null) return amount;
  }
  return null;
}

/** Regex fallback when nested JSON shape varies / partial parse fails. */
function quoteAmountFromRawText(raw: string): number | null {
  if (!raw || raw.length < 8) return null;
  // Prefer earlier (root) matches — scan a capped prefix so huge room arrays stay fast.
  const sample = raw.length > 120_000 ? raw.slice(0, 120_000) : raw;
  for (const key of QUOTE_AMOUNT_KEYS) {
    const re = new RegExp(`"${key}"\\s*:\\s*"?([0-9][0-9,]*(?:\\.[0-9]+)?)"?`, "i");
    const match = sample.match(re);
    if (!match) continue;
    const amount = positiveAmount(match[1]);
    if (amount != null) return amount;
  }
  return null;
}

/** Pull payable amount from a quote snapshot / lead payload (object + nested + text). */
function quoteAmountFromPayloadRaw(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const fromText = quoteAmountFromRawText(raw);
    const payload = parseLeadPayload(raw);
    if (!payload) return fromText;
    const fromObj = quoteAmountFromParsedPayload(payload);
    return fromObj ?? fromText;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return quoteAmountFromParsedPayload(raw as Record<string, unknown>);
  }
  return null;
}

function quoteAmountFromParsedPayload(payload: Record<string, unknown>): number | null {
  const hosts: Record<string, unknown>[] = [payload];
  const data = payload.data ?? payload.Data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    hosts.push(data as Record<string, unknown>);
  } else if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    hosts.push(data[0] as Record<string, unknown>);
  }
  for (const nestKey of ["breakdown", "quoteSummary", "summary", "pricing", "totals", "quote", "formData"] as const) {
    for (const host of [...hosts]) {
      const nested = host[nestKey];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        hosts.push(nested as Record<string, unknown>);
      }
    }
  }
  for (const host of hosts) {
    const amount = pickQuoteAmountFromObject(host);
    if (amount != null) return amount;
  }
  return null;
}

function preferAmount(current: number | null | undefined, next: number | null | undefined): number | null {
  if (next != null && next > 0) return next;
  if (current != null && current > 0) return current;
  return null;
}

/**
 * Quote amount for Meeting Management board + CRM-shared flag.
 * Covers: latest snapshot, CRM-shared snapshot, prolance quote snapshot,
 * any snapshot with an amount, lead.payload quotation fields.
 * Chunked so every board lead is covered (no silent 500-cap miss).
 *
 * `mode: "board"` skips the heaviest payload fallbacks so `/api/meetings/scheduled`
 * stays under the frontend timeout; CRM-shared alone counts as quoteSent.
 */
async function quoteShareByLead(
  pool: Pool,
  leadIds: number[],
  opts?: { mode?: "full" | "board" },
): Promise<Map<number, { quoteSent: boolean; quoteFinalAmount: number | null; hasQuote: boolean }>> {
  const out = new Map<number, { quoteSent: boolean; quoteFinalAmount: number | null; hasQuote: boolean }>();
  const ids = [...new Set(leadIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return out;

  const mode = opts?.mode === "board" ? "board" : "full";
  const CHUNK = mode === "board" ? 500 : 400;
  for (let offset = 0; offset < ids.length; offset += CHUNK) {
    const chunk = ids.slice(offset, offset + CHUNK);
    const chunkResult = await quoteShareByLeadChunk(pool, chunk, mode);
    for (const [id, value] of chunkResult) out.set(id, value);
  }
  return out;
}

async function quoteShareByLeadChunk(
  pool: Pool,
  ids: number[],
  mode: "full" | "board" = "full",
): Promise<Map<number, { quoteSent: boolean; quoteFinalAmount: number | null; hasQuote: boolean }>> {
  const out = new Map<number, { quoteSent: boolean; quoteFinalAmount: number | null; hasQuote: boolean }>();
  if (ids.length === 0) return out;
  const placeholders = ids.map(() => "?").join(",");
  const boardFast = mode === "board";

  const amountByLead = new Map<number, number | null>();
  const hasSnapshotByLead = new Map<number, boolean>();
  const sharedByLead = new Map<number, { shared: boolean; sharedQuoteId: number }>();
  const leadQuoteId = new Map<number, number>();

  const [leadRows] = await pool.query(
    `SELECT id AS leadId, prolance_quote_id AS quoteId
       FROM leads
      WHERE id IN (${placeholders})`,
    ids,
  );
  for (const row of leadRows as Record<string, unknown>[]) {
    const id = Number(row.leadId);
    const quoteId = Number(row.quoteId);
    if (Number.isFinite(id) && id > 0) {
      leadQuoteId.set(id, Number.isFinite(quoteId) && quoteId > 0 ? quoteId : 0);
    }
  }

  // Share flags across all snapshots for the lead.
  const [shareAggRows] = await pool.query(
    `SELECT lead_id AS leadId,
            MAX(CASE
                  WHEN crm_shared_version_number >= 1 AND crm_shared_quote_id > 0 THEN 1
                  ELSE 0
                END) AS crmShared,
            MAX(CASE
                  WHEN crm_shared_quote_id > 0 THEN crm_shared_quote_id
                  ELSE 0
                END) AS sharedQuoteId,
            MAX(CASE WHEN quote_id > 0 THEN 1 ELSE 0 END) AS hasSnap
       FROM lead_prolance_quote_snapshots
      WHERE lead_id IN (${placeholders})
      GROUP BY lead_id`,
    ids,
  );
  for (const row of shareAggRows as Record<string, unknown>[]) {
    const id = Number(row.leadId);
    if (!Number.isFinite(id) || id < 1) continue;
    const sharedQuoteId = Number(row.sharedQuoteId) || 0;
    sharedByLead.set(id, {
      shared: Number(row.crmShared) === 1 && sharedQuoteId > 0,
      sharedQuoteId,
    });
    if (Number(row.hasSnap) === 1) hasSnapshotByLead.set(id, true);
  }

  if (!boardFast) {
    // Latest snapshot amount.
    const [latestRows] = await pool.query(
      `SELECT s.lead_id AS leadId, s.payload_json AS payloadJson
         FROM lead_prolance_quote_snapshots s
         INNER JOIN (
           SELECT lead_id, MAX(id) AS maxId
             FROM lead_prolance_quote_snapshots
            WHERE lead_id IN (${placeholders})
            GROUP BY lead_id
         ) latest ON latest.maxId = s.id`,
      ids,
    );
    for (const row of latestRows as Record<string, unknown>[]) {
      const id = Number(row.leadId);
      if (!Number.isFinite(id) || id < 1) continue;
      hasSnapshotByLead.set(id, true);
      amountByLead.set(id, preferAmount(amountByLead.get(id), quoteAmountFromPayloadRaw(row.payloadJson)));
    }

    // CRM-shared snapshot amount (may differ from latest).
    const sharedPairs = [...sharedByLead.entries()].filter(([, v]) => v.sharedQuoteId > 0);
    if (sharedPairs.length > 0) {
      const sharedQuoteIds = [...new Set(sharedPairs.map(([, v]) => v.sharedQuoteId))];
      const sharedPlaceholders = sharedQuoteIds.map(() => "?").join(",");
      try {
        const [sharedSnapRows] = await pool.query(
          `SELECT lead_id AS leadId, quote_id AS quoteId, payload_json AS payloadJson
             FROM lead_prolance_quote_snapshots
            WHERE quote_id IN (${sharedPlaceholders})`,
          sharedQuoteIds,
        );
        for (const row of sharedSnapRows as Record<string, unknown>[]) {
          const id = Number(row.leadId);
          if (!Number.isFinite(id) || id < 1) continue;
          hasSnapshotByLead.set(id, true);
          amountByLead.set(id, preferAmount(amountByLead.get(id), quoteAmountFromPayloadRaw(row.payloadJson)));
        }
      } catch (err) {
        console.error("quote amount shared snapshot failed", err);
      }
    }

    // Snapshot by leads.prolance_quote_id when amount still missing.
    const missingAfterLatest = ids.filter((id) => !(amountByLead.get(id) != null && (amountByLead.get(id) as number) > 0));
    const prolancePairs = missingAfterLatest
      .map((id) => ({ id, quoteId: leadQuoteId.get(id) || 0 }))
      .filter((row) => row.quoteId > 0);
    if (prolancePairs.length > 0) {
      const quoteIds = [...new Set(prolancePairs.map((row) => row.quoteId))];
      const qPlaceholders = quoteIds.map(() => "?").join(",");
      try {
        const [prolanceSnapRows] = await pool.query(
          `SELECT lead_id AS leadId, quote_id AS quoteId, payload_json AS payloadJson
             FROM lead_prolance_quote_snapshots
            WHERE quote_id IN (${qPlaceholders})`,
          quoteIds,
        );
        const byQuoteId = new Map<number, unknown>();
        for (const row of prolanceSnapRows as Record<string, unknown>[]) {
          byQuoteId.set(Number(row.quoteId), row.payloadJson);
          const leadId = Number(row.leadId);
          if (Number.isFinite(leadId) && leadId > 0) hasSnapshotByLead.set(leadId, true);
        }
        for (const pair of prolancePairs) {
          const amount = quoteAmountFromPayloadRaw(byQuoteId.get(pair.quoteId));
          amountByLead.set(pair.id, preferAmount(amountByLead.get(pair.id), amount));
          if (byQuoteId.has(pair.quoteId)) hasSnapshotByLead.set(pair.id, true);
        }
      } catch (err) {
        console.error("quote amount prolance snapshot failed", err);
      }
    }

    // Any other snapshot for leads still missing amount (older versions may hold totals).
    const stillMissing = ids.filter((id) => !(amountByLead.get(id) != null && (amountByLead.get(id) as number) > 0));
    if (stillMissing.length > 0) {
      const missPlaceholders = stillMissing.map(() => "?").join(",");
      try {
        const [anySnapRows] = await pool.query(
          `SELECT lead_id AS leadId, payload_json AS payloadJson
             FROM lead_prolance_quote_snapshots
            WHERE lead_id IN (${missPlaceholders})
            ORDER BY id DESC`,
          stillMissing,
        );
        for (const row of anySnapRows as Record<string, unknown>[]) {
          const id = Number(row.leadId);
          if (!Number.isFinite(id) || id < 1) continue;
          hasSnapshotByLead.set(id, true);
          if (amountByLead.get(id) != null && (amountByLead.get(id) as number) > 0) continue;
          const amount = quoteAmountFromPayloadRaw(row.payloadJson);
          if (amount != null) amountByLead.set(id, amount);
        }
      } catch (err) {
        console.error("quote amount any-snapshot failed", err);
      }
    }

    // Lead.payload fallback — only remaining misses.
    const missingAmountIds = ids.filter((id) => !(amountByLead.get(id) != null && (amountByLead.get(id) as number) > 0));
    if (missingAmountIds.length > 0) {
      const missingPlaceholders = missingAmountIds.map(() => "?").join(",");
      try {
        const [fallbackRows] = await pool.query(
          `SELECT id AS leadId, payload
             FROM leads
            WHERE id IN (${missingPlaceholders})`,
          missingAmountIds,
        );
        for (const row of fallbackRows as Record<string, unknown>[]) {
          const id = Number(row.leadId);
          const amount = quoteAmountFromPayloadRaw(row.payload);
          if (amount != null) amountByLead.set(id, amount);
        }
      } catch (err) {
        console.error("quote amount lead fallback failed", err);
      }
    }
  }

  for (const id of ids) {
    const amount = amountByLead.get(id) ?? null;
    const share = sharedByLead.get(id);
    const hasQuoteCode =
      (leadQuoteId.get(id) ?? 0) > 0 ||
      (share?.sharedQuoteId ?? 0) > 0 ||
      hasSnapshotByLead.get(id) === true ||
      amount != null;
    out.set(id, {
      // Board: CRM-shared means quote was sent even if amount parse is slow/missing.
      quoteSent: boardFast
        ? share?.shared === true
        : hasQuoteCode && amount != null && share?.shared === true,
      quoteFinalAmount: amount,
      hasQuote: hasQuoteCode,
    });
  }
  return out;
}

function payloadText(payload: Record<string, unknown> | null, ...paths: string[]): string {
  if (!payload) return "";
  for (const path of paths) {
    const parts = path.split(".");
    let cur: unknown = payload;
    for (const part of parts) {
      if (cur == null || typeof cur !== "object") {
        cur = null;
        break;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    const text = cleanText(cur);
    if (text) return text;
  }
  return "";
}

function leadPayloadIndicatesDrr(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  if (payload.crmDrrRevisit === true || payload.crmDrrRevisit === 1) return true;
  const texts = [
    payloadText(payload, "meetingLabel"),
    payloadText(payload, "milestoneSubStage"),
    payloadText(payload, "subStage"),
    payloadText(payload, "title"),
    payloadText(payload, "designMilestone"),
    payloadText(payload, "formData.milestoneSubStage"),
    payloadText(payload, "formData.subStage"),
    payloadText(payload, "formData.sub_stage"),
    payloadText(payload, "connection.milestoneSubStage"),
    payloadText(payload, "discovery.milestoneSubStage"),
    payloadText(payload, "action"),
    payloadText(payload, "meetingStatus"),
  ];
  return texts.some((text) => isCrmDrrLabelText(text));
}

function extractCrmAppointmentFromLeadPayload(payload: Record<string, unknown> | null): {
  meetingDate: string | null;
  meetingTime: string | null;
  meetingLabel: string | null;
  milestoneSubStage: string | null;
  subStage: string | null;
} {
  if (!payload) {
    return { meetingDate: null, meetingTime: null, meetingLabel: null, milestoneSubStage: null, subStage: null };
  }
  const meetingDate = normalizeDateIso(
    payloadText(payload, "crmSchedule.date", "formData.appointment_date", "formData.appointmentDate", "appointmentDate"),
  );
  const meetingTime = normalizeTimeLabel(
    payloadText(payload, "crmSchedule.slot", "formData.appointment_slot", "formData.appointmentSlot", "appointment_slot"),
  );
  return {
    meetingDate,
    meetingTime,
    meetingLabel: payloadText(payload, "meetingLabel", "formData.meetingLabel", "designMilestone") || null,
    milestoneSubStage: payloadText(payload, "milestoneSubStage", "formData.milestoneSubStage") || null,
    subStage: payloadText(payload, "subStage", "formData.subStage", "formData.sub_stage") || null,
  };
}

function parseLeadPayload(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Pre 10% only: if any quote version was Shared to CRM, mark open CRM meetings Successful.
 * Covers share-time push and board reload for older shares.
 */
export async function completePre10CrmMeetingAfterQuoteShare(
  pool: Pool,
  leadId: number,
  actor?: MeetingActor | null,
): Promise<number> {
  if (!Number.isInteger(leadId) || leadId < 1) return 0;
  await ensureLeadMeetingsTable(pool);
  const now = new Date();
  const [openRows] = await pool.query(
    `SELECT id FROM lead_meetings
      WHERE lead_id = ?
        AND source = 'crm'
        AND meeting_status <> 'cancelled'
        AND progress <> 'completed'
        AND COALESCE(is_drr_revisit, 0) = 0
        AND (
          meeting_type = 'pre_10'
          OR meeting_type = 'pre10'
          OR meeting_type IS NULL
          OR TRIM(meeting_type) = ''
        )`,
    [leadId],
  );
  const ids = (openRows as { id?: unknown }[])
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) return 0;

  await pool.query(
    `UPDATE lead_meetings
        SET progress = 'completed',
            ended_at = COALESCE(ended_at, ?),
            updated_at = ?
      WHERE id IN (${ids.map(() => "?").join(",")})`,
    [now, now, ...ids],
  );
  await writeHistory(
    pool,
    leadId,
    actor,
    "Meeting Successful",
    "Pre 10% meeting marked Meeting Successful after quote Shared to CRM.",
    {
      action: "completed",
      source: "crm",
      reason: "crm_quote_share",
      meetingIds: ids,
    },
  );
  return ids.length;
}

/** Backfill: Pre 10% CRM meetings become Successful once a quote version is shared to CRM. */
/**
 * After successful Pre 10%, CRM often keeps the same crmSchedule in payload without a new external-intake.
 * Create the missing open CRM row so Meeting Management can show Scheduled (DRR).
 */
async function reconcileCrmDrrScheduledMeetings(pool: Pool) {
  const { fromIso, toIso } = meetingBoardDateWindow();
  const [rows] = await pool.query(
    `SELECT l.id AS leadId, l.assigned_designer_id AS designerId, l.project_stage AS projectStage, l.payload
       FROM leads l
      WHERE l.payload IS NOT NULL
        AND (
          l.payload LIKE '%refinement%'
          OR l.payload LIKE '%crmDrrRevisit%'
          OR (
            l.project_stage IS NOT NULL
            AND TRIM(l.project_stage) <> ''
            AND TRIM(l.project_stage) <> 'Pre 10%'
          )
          OR EXISTS (
            SELECT 1 FROM lead_prolance_quote_snapshots q
              WHERE q.lead_id = l.id
                AND q.crm_shared_quote_id IS NOT NULL
                AND q.crm_shared_quote_id > 0
          )
        )
        AND EXISTS (
          SELECT 1 FROM lead_meetings done
            WHERE done.lead_id = l.id
              AND done.source = 'crm'
              AND done.progress = 'completed'
              AND done.meeting_status <> 'cancelled'
        )
        AND NOT EXISTS (
          SELECT 1 FROM lead_meetings openm
            WHERE openm.lead_id = l.id
              AND openm.source = 'crm'
              AND openm.meeting_status <> 'cancelled'
              AND openm.progress NOT IN ('completed', 'meeting_never_happened')
        )
      ORDER BY l.update_at DESC
      LIMIT 120`,
  );
  for (const row of rows as {
    leadId?: number;
    designerId?: number | null;
    projectStage?: string | null;
    payload?: string | null;
  }[]) {
    const leadId = Number(row.leadId);
    if (!Number.isFinite(leadId) || leadId < 1) continue;
    const payload = parseLeadPayload(row.payload);
    const appt = extractCrmAppointmentFromLeadPayload(payload);
    if (!appt.meetingDate || !appt.meetingTime) continue;
    if (appt.meetingDate < fromIso || appt.meetingDate > toIso) continue;
    try {
      await recordCrmMeeting(pool, {
        leadId,
        meetingDate: appt.meetingDate,
        meetingTime: appt.meetingTime,
        meetingLabel: appt.meetingLabel,
        milestoneSubStage: appt.milestoneSubStage,
        subStage: appt.subStage,
        designerId: row.designerId ?? null,
        actor: { name: "reconcile-drr" },
      });
    } catch (err) {
      console.error("[reconcile-drr] failed", { leadId, err });
    }
  }
}

async function reconcilePre10MeetingsAfterCrmQuoteShare(pool: Pool) {
  // Quote share closes the Pre 10% visit only. A DRR revisit is stored as pre_10
  // with is_drr_revisit = 1 and must stay Scheduled (DRR).
  await pool.query(
    `UPDATE lead_meetings m
       JOIN (
         SELECT DISTINCT lead_id AS leadId
           FROM lead_prolance_quote_snapshots
          WHERE crm_shared_quote_id IS NOT NULL
            AND crm_shared_quote_id > 0
            AND crm_shared_version_number IS NOT NULL
            AND crm_shared_version_number >= 1
       ) s ON s.leadId = m.lead_id
        SET m.progress = 'completed',
            m.ended_at = COALESCE(m.ended_at, NOW()),
            m.updated_at = NOW()
      WHERE m.source = 'crm'
        AND m.meeting_status <> 'cancelled'
        AND m.progress <> 'completed'
        AND COALESCE(m.is_drr_revisit, 0) = 0
        AND (
          m.meeting_type = 'pre_10'
          OR m.meeting_type = 'pre10'
          OR m.meeting_type IS NULL
          OR TRIM(m.meeting_type) = ''
        )`,
  );

  await reopenDrrMeetingsClosedByQuoteShare(pool);
}

/** DRR visits quote-share had marked successful. An explicit Meeting successful stays completed. */
async function reopenDrrMeetingsClosedByQuoteShare(pool: Pool) {
  await pool.query(
    `UPDATE lead_meetings m
        SET m.progress = 'scheduled',
            m.ended_at = NULL,
            m.updated_at = NOW()
      WHERE m.source = 'crm'
        AND m.meeting_status <> 'cancelled'
        AND m.progress = 'completed'
        AND (
          COALESCE(m.is_drr_revisit, 0) = 1
          OR LOWER(IFNULL(m.meeting_type, '')) LIKE '%design%refinement%'
          OR LOWER(IFNULL(m.meeting_type, '')) LIKE '%refinement%round%'
        )
        AND NOT EXISTS (
          SELECT 1 FROM lead_history h2
           WHERE h2.lead_id = m.lead_id
             AND h2.event LIKE '%CRM meeting ended%'
             AND h2.event LIKE CONCAT('%"meetingId":', m.id, '%')
        )`,
  );
}

/** Design meetings whose MOM / meeting-completed milestone is already done are successful, not abandoned. */
async function reconcileCompletedDesignMeetings(pool: Pool) {
  await pool.query(
    `UPDATE lead_meetings m
       JOIN lead_task_completions c ON c.lead_id = m.lead_id
        SET m.progress = 'completed',
            m.ended_at = COALESCE(m.ended_at, NOW()),
            m.updated_at = NOW()
      WHERE m.source = 'design_module'
        AND m.meeting_status <> 'cancelled'
        AND m.progress <> 'completed'
        AND (
          (
            c.milestone_index = 1
            AND LOWER(TRIM(c.task_name)) = 'meeting completed'
            AND (
              m.meeting_type = 'dqc1_first_cut'
              OR LOWER(m.meeting_type) LIKE '%first%cut%'
              OR LOWER(m.meeting_type) LIKE '%firstcut%'
            )
          )
          OR (
            c.milestone_index = 4
            AND LOWER(TRIM(c.task_name)) = 'material selection meeting completed'
            AND (
              m.meeting_type = 'dqc2_material_selection'
              OR LOWER(m.meeting_type) LIKE '%material%'
            )
          )
          OR (
            c.milestone_index = 5
            AND LOWER(TRIM(c.task_name)) = 'meeting completed'
            AND (
              m.meeting_type = 'design_signoff'
              OR LOWER(m.meeting_type) LIKE '%signoff%'
              OR LOWER(m.meeting_type) LIKE '%sign_off%'
              OR LOWER(m.meeting_type) LIKE '%sign off%'
            )
          )
        )`,
  );
}

let lastMeetingListReconcileAt = 0;
const MEETING_LIST_RECONCILE_MS = 60_000;
/** Board list window — keeps hosted `/api/meetings/scheduled` under ~5s. */
const MEETING_BOARD_PAST_DAYS = 60;
const MEETING_BOARD_FUTURE_DAYS = 45;

function meetingBoardDateWindow(now = new Date()): { fromIso: string; toIso: string } {
  const today = kolkataParts(now).date;
  return {
    fromIso: addDaysIso(today, -MEETING_BOARD_PAST_DAYS),
    toIso: addDaysIso(today, MEETING_BOARD_FUTURE_DAYS),
  };
}

/** Persist open-meeting progress in the background — never block the board response. */
function scheduleOpenMeetingProgressRefresh(
  pool: Pool,
  opts: { leadId?: number; designerIds?: number[]; now: Date },
): void {
  void (async () => {
    try {
      const designerIds = opts.designerIds?.filter((id) => Number.isInteger(id) && id > 0);
      const scoped = Boolean(designerIds?.length);
      const params: unknown[] = [];
      let sql = `${MEETING_SELECT}
        ${scoped ? "JOIN leads l ON l.id = m.lead_id" : ""}
        WHERE m.meeting_status <> 'cancelled' AND m.progress <> 'completed'
          AND m.meeting_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
          AND m.meeting_date <= DATE_ADD(CURDATE(), INTERVAL 2 DAY)`;
      if (opts.leadId) {
        sql += " AND m.lead_id = ?";
        params.push(opts.leadId);
      }
      if (scoped) {
        sql += ` AND COALESCE(m.designer_id, l.assigned_designer_id) IN (${designerIds!.map(() => "?").join(",")})`;
        params.push(...designerIds!);
      }
      sql += " ORDER BY m.meeting_date ASC, m.id ASC LIMIT 200";
      const [openRows] = await pool.query(sql, params);
      for (const raw of openRows as Record<string, unknown>[]) {
        // Skip history writes on list refresh — history was making hosted loads time out.
        await refreshStoredProgress(pool, mapRow(raw), opts.now, false);
      }
    } catch (err) {
      console.error("[lead-meetings] background progress refresh failed", err);
    }
  })();
}

const LEAD_PAYLOAD_JSON = "IF(JSON_VALID(payload), payload, '{}')";

function leadPayloadJsonText(jsonPath: string): string {
  return `NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${LEAD_PAYLOAD_JSON}, '${jsonPath}'))), '')`;
}

const SALES_EXECUTIVE_FROM_PAYLOAD_SQL = `COALESCE(
  ${leadPayloadJsonText("$.formData.salesExecutive")},
  ${leadPayloadJsonText("$.formData.sales_executive")},
  ${leadPayloadJsonText("$.formData.sales_person")},
  ${leadPayloadJsonText("$.form_data.salesExecutive")},
  ${leadPayloadJsonText("$.form_data.sales_executive")},
  ${leadPayloadJsonText("$.form_data.sales_person")},
  ${leadPayloadJsonText("$.fetchedData.salesExecutive")},
  ${leadPayloadJsonText("$.fetchedData.sales_person")},
  ${leadPayloadJsonText("$.fetched_data.salesExecutive")},
  ${leadPayloadJsonText("$.fetched_data.sales_person")},
  ${leadPayloadJsonText("$.rawPayload.salesExecutive")},
  ${leadPayloadJsonText("$.rawPayload.sales_executive")},
  ${leadPayloadJsonText("$.salesExecutive")},
  ${leadPayloadJsonText("$.sales_executive")},
  ${leadPayloadJsonText("$.sales_person")}
)`;

/** Fewer JSON paths for the meeting board — full COALESCE was scanning huge payloads per lead. */
const SALES_EXECUTIVE_BOARD_SQL = `COALESCE(
  ${leadPayloadJsonText("$.formData.salesExecutive")},
  ${leadPayloadJsonText("$.formData.sales_executive")},
  ${leadPayloadJsonText("$.formData.sales_person")},
  ${leadPayloadJsonText("$.fetchedData.salesExecutive")},
  ${leadPayloadJsonText("$.salesExecutive")},
  ${leadPayloadJsonText("$.sales_executive")}
)`;

async function salesExecutiveByLeadChunk(
  pool: Pool,
  ids: number[],
  mode: "full" | "board" = "full",
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (ids.length === 0) return out;
  const placeholders = ids.map(() => "?").join(",");
  const salesSql = mode === "board" ? SALES_EXECUTIVE_BOARD_SQL : SALES_EXECUTIVE_FROM_PAYLOAD_SQL;
  const [leadRows] = await pool.query(
    `SELECT id AS leadId, ${salesSql} AS salesExecutiveName
       FROM leads
      WHERE id IN (${placeholders})`,
    ids,
  );
  for (const row of leadRows as Record<string, unknown>[]) {
    const leadId = Number(row.leadId);
    const name = cleanText(row.salesExecutiveName);
    if (Number.isFinite(leadId) && leadId > 0 && name) out.set(leadId, name);
  }
  return out;
}

/** CRM sales executive name from lead payload (batched JSON paths — no full payload fetch per meeting). */
async function salesExecutiveByLeadIds(
  pool: Pool,
  leadIds: number[],
  opts?: { mode?: "full" | "board" },
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const ids = [...new Set(leadIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return out;
  const mode = opts?.mode === "board" ? "board" : "full";
  const CHUNK = mode === "board" ? 300 : 200;
  for (let offset = 0; offset < ids.length; offset += CHUNK) {
    const chunk = ids.slice(offset, offset + CHUNK);
    const chunkResult = await salesExecutiveByLeadChunk(pool, chunk, mode);
    for (const [id, value] of chunkResult) out.set(id, value);
  }
  return out;
}

export async function listLeadMeetings(pool: Pool, opts?: { leadId?: number; now?: Date; designerIds?: number[] }) {
  await ensureLeadMeetingsTable(pool);
  const now = opts?.now || new Date();
  if (Date.now() - lastMeetingListReconcileAt >= MEETING_LIST_RECONCILE_MS) {
    lastMeetingListReconcileAt = Date.now();
    try {
      await reopenDrrMeetingsClosedByQuoteShare(pool);
    } catch (err) {
      console.error("[lead-meetings] DRR reopen failed", err);
    }
    // Delay so reconcile cannot steal pool connections from this board response.
    setTimeout(() => {
      void (async () => {
        try {
          await cleanupOrphanMeetingRows(pool);
          await reconcileCompletedDesignMeetings(pool);
          await reconcilePre10MeetingsAfterCrmQuoteShare(pool);
          await reconcileCrmDrrScheduledMeetings(pool);
        } catch (err) {
          console.error("meeting list reconcile failed", err);
        }
      })();
    }, 2500);
  }

  const designerIds = opts?.designerIds?.filter((id) => Number.isInteger(id) && id > 0);
  if (opts?.designerIds && (!designerIds || designerIds.length === 0)) return [];
  const scoped = Boolean(designerIds);
  const { fromIso, toIso } = meetingBoardDateWindow(now);
  const whereParts: string[] = [];
  const queryParams: unknown[] = [];
  if (opts?.leadId) {
    whereParts.push("m.lead_id = ?");
    queryParams.push(opts.leadId);
  } else {
    whereParts.push("m.meeting_date >= ?");
    whereParts.push("m.meeting_date <= ?");
    queryParams.push(fromIso, toIso);
  }
  // Never return legacy "design meeting" junk — it hid Successful Pre 10% rows (e.g. Hansmukh).
  whereParts.push(
    `NOT (
      m.source = 'design_module'
      AND ${sqlIsOrphanDesignMeetingType("m.meeting_type")}
      AND m.meeting_type NOT IN ('dqc1_first_cut', 'dqc2_material_selection', 'design_signoff')
    )`,
  );
  if (scoped) {
    whereParts.push(
      `COALESCE(m.designer_id, l.assigned_designer_id) IN (${designerIds!.map(() => "?").join(",")})`,
    );
    queryParams.push(...designerIds!);
  }

  // Defer background writes so they never steal pool connections from this request.
  setTimeout(() => {
    scheduleOpenMeetingProgressRefresh(pool, {
      leadId: opts?.leadId,
      designerIds: scoped ? designerIds : undefined,
      now,
    });
  }, 3000);

  // Board-fast select: scalar columns only + light DRR (no per-row payload JSON / EXISTS).
  // No hard 1500 cap — ASC LIMIT 1500 dropped all of November 2026 (0 of 3200+ rows).
  // Date window already bounds volume; soft ceiling only as a safety valve.
  const [rows] = await pool.query(
    `SELECT m.id,
            l.id AS leadId,
            l.pid AS projectId,
            l.project_name AS projectName,
            l.project_stage AS projectStage,
            l.contact_no AS contactNo,
            l.is_on_hold AS isOnHold,
            m.branch AS meetingBranch,
            DATE_FORMAT(m.meeting_date, '%Y-%m-%d') AS meetingDate,
            m.meeting_time AS meetingTime,
            m.meeting_type AS meetingType,
            m.meeting_mode AS meetingMode,
            m.meeting_status AS meetingStatus,
            m.progress,
            m.source,
            m.cancel_reason AS cancelReason,
            m.cancel_files AS cancelFiles,
            m.ended_at AS endedAt,
            COALESCE(m.reschedule_count, 0) AS rescheduleCount,
            m.feedback_designer AS feedbackDesigner,
            m.feedback_designer_at AS feedbackDesignerAt,
            m.feedback_designer_by AS feedbackDesignerBy,
            m.crm_appointment_id AS crmAppointmentId,
            m.started_at AS startedAt,
            u.name AS assignedDesignerName,
            CASE WHEN ${CRM_DRR_REVISIT_BOARD_SQL} THEN 1 ELSE 0 END AS crmDrrRevisit
       FROM lead_meetings m
       JOIN leads l ON l.id = m.lead_id
       LEFT JOIN users u ON u.id = COALESCE(m.designer_id, l.assigned_designer_id)
      WHERE ${whereParts.join(" AND ")}
      ORDER BY m.meeting_date ASC, m.meeting_time ASC, m.id ASC
      LIMIT 10000`,
    queryParams,
  );

  // Recover slot only for rows missing meeting_time (small set), not for the whole board.
  const missingTimeLeadIds = [
    ...new Set(
      (rows as Record<string, unknown>[])
        .filter((row) => !normalizeTimeLabel(row.meetingTime) && !cleanText(row.meetingTime))
        .map((row) => Number(row.leadId))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ].slice(0, 80);
  const slotByLead = new Map<number, string>();
  if (missingTimeLeadIds.length > 0) {
    try {
      const [slotRows] = await pool.query(
        `SELECT id AS leadId, payload
           FROM leads
          WHERE id IN (${missingTimeLeadIds.map(() => "?").join(",")})`,
        missingTimeLeadIds,
      );
      for (const slotRow of slotRows as Record<string, unknown>[]) {
        const payload = parseLeadPayload(slotRow.payload);
        const slot =
          payloadText(payload, "crmSchedule.slot", "formData.appointment_slot") ||
          normalizeTimeLabel((payload?.crmSchedule as Record<string, unknown> | undefined)?.slot) ||
          "";
        const label = normalizeTimeLabel(slot) || cleanText(slot);
        if (label) slotByLead.set(Number(slotRow.leadId), label);
      }
    } catch (err) {
      console.error("meeting slot recovery failed", err);
    }
  }

  const meetingLeadIds = [
    ...new Set((rows as Record<string, unknown>[]).map((row) => Number(row.leadId))),
  ].filter((id) => Number.isFinite(id) && id > 0);

  let shareByLead = new Map<
    number,
    { quoteSent: boolean; quoteFinalAmount: number | null; hasQuote: boolean }
  >();
  let salesByLead = new Map<number, string>();
  // Quote + sales in parallel — sequential enrichment was a major board timeout driver.
  // Sales JSON-on-payload can spike; budget it so the board never waits on it.
  const [shareResult, salesResult] = await Promise.all([
    quoteShareByLead(pool, meetingLeadIds, { mode: "board" }).catch((err) => {
      console.error("quote share lookup failed", err);
      return shareByLead;
    }),
    Promise.race([
      salesExecutiveByLeadIds(pool, meetingLeadIds, { mode: "board" }).catch((err) => {
        console.error("sales executive lookup failed", err);
        return new Map<number, string>();
      }),
      new Promise<Map<number, string>>((resolve) => {
        setTimeout(() => resolve(new Map()), 1200);
      }),
    ]),
  ]);
  shareByLead = shareResult;
  salesByLead = salesResult;

  return (rows as Record<string, unknown>[]).map((row) => {
    const share = shareByLead.get(Number(row.leadId));
    const leadIdNum = Number(row.leadId);
    const storedProgress = (() => {
      const raw = String(row.progress || "scheduled");
      if (raw === "meeting_abandoned") return "meeting_never_happened";
      return raw;
    })();
    const meetingStatusValue = String(row.meetingStatus || "scheduled");
    const isCancelled = meetingStatusValue.toLowerCase() === "cancelled";
    const liveProgress =
      storedProgress === "completed"
        ? storedProgress
        : isCancelled
          ? storedProgress
          : nextMeetingProgress(
              {
                meetingStatus: meetingStatusValue as MeetingBookingStatus,
                progress: storedProgress as MeetingProgress,
                meetingDate: String(row.meetingDate || "").slice(0, 10),
                meetingTime: row.meetingTime == null ? null : String(row.meetingTime),
                meetingType: row.meetingType == null ? null : String(row.meetingType),
                source: (String(row.source || "crm") as MeetingSource) || "crm",
                startedAt: (row.startedAt as Date | string | null) ?? null,
              },
              now,
            );
    const resolvedTime =
      normalizeTimeLabel(row.meetingTime) ||
      cleanText(row.meetingTime) ||
      slotByLead.get(Number(row.leadId)) ||
      "";
    const projectName = cleanText(row.projectName);
    const quoteAmount =
      share?.quoteFinalAmount != null && Number(share.quoteFinalAmount) > 0
        ? String(share.quoteFinalAmount)
        : null;
    return {
    id: Number(row.id),
    leadId: Number(row.leadId),
    projectId: cleanText(row.projectId),
    projectName,
    projectStage: cleanText(row.projectStage),
    isOnHold: row.isOnHold === 1 || row.isOnHold === true || row.isOnHold === "1",
    customerName: projectName || "Customer",
    phone: cleanText(row.contactNo),
    salesName: salesByLead.get(leadIdNum) || "",
    quotationTotal: quoteAmount || "",
    budget: "",
    branchName: cleanText(row.meetingBranch),
    designerName: cleanText(row.assignedDesignerName) || "Unassigned",
    meetingDate: String(row.meetingDate || "").slice(0, 10),
    meetingTime: resolvedTime,
    meetingTimeLabel: resolvedTime,
    meetingType: cleanText(row.meetingType),
    meetingMode: cleanText(row.meetingMode),
    meetingStatus: cleanText(row.meetingStatus) || (isCancelled ? "cancelled" : meetingStatusValue),
    progress: liveProgress,
    // Always prefer Cancelled label when meeting_status is cancelled (even if progress enum stays scheduled).
    progressLabel: isCancelled
      ? "Meeting Cancelled"
      : meetingProgressLabel(liveProgress, cleanText(row.meetingStatus)),
    source: cleanText(row.source),
    crmDrrRevisit:
      row.crmDrrRevisit === 1 ||
      row.crmDrrRevisit === true ||
      row.crmDrrRevisit === "1" ||
      /design\s*refinement|refinement\s*round|\bdrr\b/i.test(String(row.meetingType || "")),
    cancelReason: cleanText(row.cancelReason),
    cancelFiles: parseCancelFiles(row.cancelFiles),
    reason: cleanText(row.cancelReason),
    endedAt: meetingEndedIso(row.endedAt),
    quoteSent: share?.quoteSent === true,
    hasQuote: share?.hasQuote === true || quoteAmount != null,
    quoteFinalAmount: quoteAmount,
    rescheduleCount: Number(row.rescheduleCount || 0),
    feedbackDesigner: cleanText(row.feedbackDesigner),
    feedbackDesignerAt: meetingEndedIso(row.feedbackDesignerAt),
    feedbackDesignerBy: cleanText(row.feedbackDesignerBy),
    crmAppointmentId: (() => {
      const id = Number(row.crmAppointmentId);
      return Number.isFinite(id) && id > 0 ? id : null;
    })(),
  };
  });
}

function parseCancelFiles(raw: unknown): { id: number; name: string; mimeType: string | null }[] {
  if (raw == null || raw === "") return [];
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      const row = item as { id?: unknown; name?: unknown; mimeType?: unknown };
      const id = Number(row?.id);
      if (!Number.isFinite(id)) return [];
      return [{
        id,
        name: String(row?.name || "file"),
        mimeType: row?.mimeType == null || row.mimeType === "" ? null : String(row.mimeType),
      }];
    });
  } catch {
    return [];
  }
}

/** True when meeting_type is the legacy junk label (not a real milestone). */
function sqlIsOrphanDesignMeetingType(column = "meeting_type"): string {
  return `LOWER(REPLACE(REPLACE(TRIM(${column}), '_', ' '), '-', ' ')) IN ('design meeting', 'designmeeting')`;
}

/**
 * Junk rows that made "design meeting" + "Time not set" come back after manual fixes:
 * backfill used to invent meeting_type=design_meeting from payload dates with no real
 * First-cut / Material / Sign-off type. Cancel open orphans (including stuck in_progress
 * with started_at) so they cannot hide a successful CRM Pre 10% row on the board.
 */
async function cleanupOrphanMeetingRows(pool: Pool) {
  const now = new Date();
  // Legacy label always dies — even if someone stamped started_at / in_progress on it.
  await pool.query(
    `UPDATE lead_meetings
        SET meeting_status = 'cancelled',
            progress = 'meeting_never_happened',
            cancel_reason = COALESCE(NULLIF(TRIM(cancel_reason), ''), 'Orphan design_meeting row (not a real Pre 10% or design milestone)'),
            updated_at = ?
      WHERE source = 'design_module'
        AND meeting_status <> 'cancelled'
        AND progress <> 'completed'
        AND ${sqlIsOrphanDesignMeetingType("meeting_type")}
        AND meeting_type NOT IN ('dqc1_first_cut', 'dqc2_material_selection', 'design_signoff')`,
    [now],
  );
  // Untyped / empty-time design_module rows that are not real milestones.
  await pool.query(
    `UPDATE lead_meetings
        SET meeting_status = 'cancelled',
            progress = 'meeting_never_happened',
            cancel_reason = COALESCE(NULLIF(TRIM(cancel_reason), ''), 'Orphan design_meeting row (not a real Pre 10% or design milestone)'),
            updated_at = ?
      WHERE source = 'design_module'
        AND meeting_status <> 'cancelled'
        AND progress <> 'completed'
        AND (meeting_time IS NULL OR TRIM(meeting_time) = '')
        AND meeting_type NOT IN ('dqc1_first_cut', 'dqc2_material_selection', 'design_signoff')`,
    [now],
  );
  // Past open CRM rows with no clock also become never-happened (do not invent "Time not set").
  await pool.query(
    `UPDATE lead_meetings
        SET progress = 'meeting_never_happened',
            updated_at = ?
      WHERE source = 'crm'
        AND meeting_status <> 'cancelled'
        AND progress NOT IN ('completed', 'meeting_never_happened')
        AND (meeting_time IS NULL OR TRIM(meeting_time) = '')
        AND meeting_date < CURDATE()`,
    [now],
  );
}

async function backfillLeadMeetings(pool: Pool) {
  const [locked] = await pool.query("SELECT GET_LOCK('lead_meetings_backfill', 15) AS got");
  if (Number((locked as { got?: number }[])[0]?.got) !== 1) return;
  try {
    const [rows] = await pool.query(
      `SELECT id, assigned_designer_id AS designerId, payload
         FROM leads
        WHERE payload IS NOT NULL
          AND (payload LIKE '%scheduledMeetingDate%' OR payload LIKE '%designScheduledMeeting%' OR payload LIKE '%crmSchedule%')`,
    );
    for (const lead of rows as { id: number; designerId?: number | null; payload?: string }[]) {
      let payload: Record<string, unknown> = {};
      try {
        payload = lead.payload ? (JSON.parse(lead.payload) as Record<string, unknown>) : {};
      } catch {
        continue;
      }
      const design = (payload.designScheduledMeeting || {}) as Record<string, unknown>;
      const designDate = normalizeDateIso(design.date || payload.scheduledMeetingDate);
      const def = designMeetingFromLabel(design.meetingType) || designMeetingFromLabel(payload.meetingType);
      // Only real design milestones — never invent "design_meeting" (that label kept coming back on Pre 10% leads).
      if (designDate && def) {
        const designTime = normalizeTimeLabel(design.time || payload.scheduledMeetingSlot);
        if (designTime) {
          await insertBackfill(pool, {
            leadId: lead.id,
            meetingDate: designDate,
            meetingTime: designTime,
            meetingType: def.meetingType,
            meetingMode: design.meetingMode ? String(design.meetingMode).slice(0, 32) : null,
            designerId: lead.designerId ?? null,
            source: "design_module",
          });
        }
      }
      const appt = extractCrmAppointmentFromLeadPayload(payload);
      if (appt.meetingDate && appt.meetingTime) {
        const crmLabel = cleanText(payload.meetingType);
        const drrVisit = leadPayloadIndicatesDrr(payload);
        await insertBackfill(pool, {
          leadId: lead.id,
          meetingDate: appt.meetingDate,
          meetingTime: appt.meetingTime,
          meetingType: "pre_10",
          meetingMode: crmChannel(crmLabel),
          designerId: lead.designerId ?? null,
          source: "crm",
          isDrrRevisit: drrVisit,
        });
      }
    }
  } finally {
    await pool.query("SELECT RELEASE_LOCK('lead_meetings_backfill')");
  }
}

async function insertBackfill(
  pool: Pool,
  input: {
    leadId: number;
    meetingDate: string;
    meetingTime: string | null;
    meetingType: string;
    meetingMode: string | null;
    designerId: number | null;
    source: MeetingSource;
    isDrrRevisit?: boolean;
  },
) {
  if (!input.meetingTime) return;
  if (input.source === "design_module" && !designMeetingFromLabel(input.meetingType)) return;
  const [existing] = await pool.query(
    `SELECT id, progress FROM lead_meetings
      WHERE lead_id = ? AND source = ? AND meeting_type = ? AND meeting_date = ?
      ORDER BY id DESC LIMIT 1`,
    [input.leadId, input.source, input.meetingType, input.meetingDate],
  );
  const prior = (existing as { id?: number; progress?: string }[])[0];
  if (prior?.id) {
    const priorProgress = String(prior.progress || "").toLowerCase();
    const allowSecondRow =
      input.isDrrRevisit && priorProgress === "completed" && input.source === "crm";
    if (!allowSecondRow) return;
    const [openSameDay] = await pool.query(
      `SELECT id FROM lead_meetings
        WHERE lead_id = ? AND source = 'crm' AND meeting_date = ?
          AND meeting_status <> 'cancelled'
          AND progress NOT IN ('completed', 'meeting_never_happened')
        LIMIT 1`,
      [input.leadId, input.meetingDate],
    );
    if ((openSameDay as unknown[]).length > 0) return;
  }
  const now = new Date();
  const progress = nextMeetingProgress(
    {
      meetingStatus: "scheduled",
      progress: "scheduled",
      meetingDate: input.meetingDate,
      meetingTime: input.meetingTime,
      source: input.source,
      startedAt: null,
    },
    now,
  );
  const branch = await leadBranch(pool, input.leadId);
  await pool.query(
    `INSERT INTO lead_meetings
      (lead_id, meeting_date, meeting_time, meeting_type, meeting_mode, meeting_status, progress, designer_id, source, branch, is_drr_revisit, started_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      input.leadId,
      input.meetingDate,
      input.meetingTime,
      input.meetingType,
      input.meetingMode,
      progress,
      input.designerId,
      input.source,
      branch,
      input.isDrrRevisit ? 1 : 0,
      now,
      now,
    ],
  );
}
