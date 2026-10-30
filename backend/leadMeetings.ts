import type { Pool, ResultSetHeader } from "mysql2/promise";
import { awardTaskCompletionXp } from "./routes/designerXpRoutes";

export type MeetingProgress = "scheduled" | "in_progress" | "meeting_abandoned" | "completed";
export type MeetingBookingStatus = "scheduled" | "rescheduled" | "cancelled";
export type MeetingSource = "design_module" | "crm";

export type MeetingActor = { id?: number | null; name?: string | null };

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

export function normalizeTimeLabel(value: unknown): string | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const minutes = clockLabelToMinutes(text);
  if (minutes == null) return text.slice(0, 64);
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
/** After the slot end, wait this long before marking an unstarted meeting abandoned. */
const MEETING_ABANDON_BUFFER_MIN = 2 * 60;

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
 * Abandoned only after the meeting end time + 2 hours, and only when the
 * meeting was never started. Started meetings stay in progress until completed.
 */
export function nextMeetingProgress(
  row: {
    meetingStatus: MeetingBookingStatus;
    progress: MeetingProgress;
    meetingDate: string;
    meetingTime: string | null;
    source: MeetingSource;
    startedAt: Date | string | null;
  },
  now = new Date(),
): MeetingProgress {
  if (row.meetingStatus === "cancelled") return row.progress;
  if (row.progress === "completed") return "completed";

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
  if (pastAbandonWindow && neverStarted) return "meeting_abandoned";

  if (row.startedAt) return "in_progress";
  if (row.meetingDate > today.date) return "scheduled";
  if (row.meetingDate < today.date) {
    // Past the meeting day but still inside the end+2h window (late slot).
    return "scheduled";
  }

  const timeReached = startMin == null ? true : today.minutes >= startMin;
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
          progress ENUM('scheduled','in_progress','meeting_abandoned','completed') NOT NULL DEFAULT 'scheduled',
          designer_id INT NULL,
          source ENUM('design_module','crm') NOT NULL,
          branch VARCHAR(64) NULL,
          reschedule_cancel_reason VARCHAR(500) NULL,
          started_at DATETIME NULL,
          ended_at DATETIME NULL,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          INDEX idx_lead_meetings_lead (lead_id),
          INDEX idx_lead_meetings_open (meeting_status, progress, meeting_date)
        )
      `);
      const [branchCol] = await pool.query(
        `SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_meetings' AND COLUMN_NAME = 'branch'`,
      );
      if ((branchCol as unknown[]).length === 0) {
        await pool.query("ALTER TABLE lead_meetings ADD COLUMN branch VARCHAR(64) NULL AFTER source");
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
      await backfillLeadMeetings(pool);
      await reconcileCompletedDesignMeetings(pool);
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

function mapRow(row: Record<string, unknown>): MeetingRow {
  return {
    id: Number(row.id),
    leadId: Number(row.leadId),
    meetingDate: String(row.meetingDate || "").slice(0, 10),
    meetingTime: row.meetingTime == null ? null : String(row.meetingTime),
    meetingType: String(row.meetingType || ""),
    meetingMode: row.meetingMode == null ? null : String(row.meetingMode),
    meetingStatus: String(row.meetingStatus || "scheduled") as MeetingBookingStatus,
    progress: String(row.progress || "scheduled") as MeetingProgress,
    designerId: row.designerId == null ? null : Number(row.designerId),
    designerName: row.designerName == null ? null : String(row.designerName),
    source: String(row.source || "design_module") as MeetingSource,
    cancelReason: row.cancelReason == null ? null : String(row.cancelReason),
    rescheduleCount: Number(row.rescheduleCount || 0),
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
    if (def && (await completionTaskDone(pool, row.leadId, def))) {
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
  const startedAt = next === "in_progress" && !row.startedAt ? new Date() : row.startedAt;
  const [updated] = await pool.query(
    `UPDATE lead_meetings
        SET progress = ?, started_at = ?, updated_at = ?
      WHERE id = ? AND progress = ? AND meeting_status <> 'cancelled'`,
    [next, startedAt, new Date(), row.id, row.progress],
  );
  if (Number((updated as ResultSetHeader).affectedRows) === 0) return row;
  if (writeHistoryOnChange) {
    const label = next === "in_progress" ? "Meeting in progress" : "Meeting abandoned";
    await writeHistory(pool, row.leadId, { name: "System" }, label, `${label} for ${row.meetingDate}.`, {
      action: next,
      meetingId: row.id,
      meetingType: row.meetingType,
      meetingDate: row.meetingDate,
      meetingTime: row.meetingTime,
    });
  }
  return { ...row, progress: next, startedAt };
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

async function completionTaskDone(pool: Pool, leadId: number, def: DesignMeetingDef): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT 1 FROM lead_task_completions
      WHERE lead_id = ? AND milestone_index = ? AND task_name = ? LIMIT 1`,
    [leadId, def.milestoneIndex, def.completionTask],
  );
  return (rows as unknown[]).length > 0;
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
  if (await completionTaskDone(pool, input.leadId, def)) return null;
  const timeLabel = normalizeTimeLabel(input.meetingTime);
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
    designerId?: number | null;
    actor?: MeetingActor | null;
  },
) {
  const dateIso = normalizeDateIso(input.meetingDate);
  if (!dateIso) return null;
  await ensureLeadMeetingsTable(pool);
  const timeLabel = normalizeTimeLabel(input.meetingTime);
  const mode = crmChannel(input.meetingType) || crmChannel(input.meetingMode);
  const meetingType = "pre_10";
  const [rows] = await pool.query(
    `${MEETING_SELECT}
      WHERE m.lead_id = ? AND m.source = 'crm' AND m.meeting_status <> 'cancelled' AND m.progress <> 'completed'
      ORDER BY m.id DESC LIMIT 1`,
    [input.leadId],
  );
  const active = (rows as Record<string, unknown>[])[0] ? mapRow((rows as Record<string, unknown>[])[0]) : null;
  const now = new Date();
  if (active) {
    const nextMode = mode || active.meetingMode;
    if (active.meetingDate === dateIso && normalizeTimeLabel(active.meetingTime) === timeLabel) {
      if (active.meetingType !== meetingType || (active.meetingMode || null) !== (nextMode || null)) {
        await pool.query(
          `UPDATE lead_meetings SET meeting_type = ?, meeting_mode = ?, updated_at = ? WHERE id = ?`,
          [meetingType, nextMode, now, active.id],
        );
        return loadMeeting(pool, active.id);
      }
      return active;
    }
    const progress = nextMeetingProgress(
      { ...active, meetingDate: dateIso, meetingTime: timeLabel, meetingStatus: "rescheduled", progress: "scheduled", startedAt: null },
      now,
    );
    await pool.query(
      `UPDATE lead_meetings
          SET meeting_date = ?, meeting_time = ?, meeting_mode = ?, meeting_type = ?, meeting_status = 'rescheduled',
              reschedule_count = reschedule_count + 1,
              progress = ?, started_at = NULL, ended_at = NULL, updated_at = ?
        WHERE id = ?`,
      [dateIso, timeLabel, mode || active.meetingMode, meetingType, progress, now, active.id],
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
  const [done] = await pool.query(
    `SELECT id, DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meetingDate
       FROM lead_meetings
      WHERE lead_id = ? AND source = 'crm' AND progress = 'completed'
      ORDER BY id DESC LIMIT 1`,
    [input.leadId],
  );
  const doneRow = (done as { meetingDate?: string }[])[0];
  if (doneRow && String(doneRow.meetingDate).slice(0, 10) === dateIso) return null;
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
      (lead_id, meeting_date, meeting_time, meeting_type, meeting_mode, meeting_status, progress, designer_id, source, branch, started_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, 'crm', ?, ?, ?, ?)`,
    [input.leadId, dateIso, timeLabel, meetingType, mode, progress, input.designerId ?? null, branch, progress === "in_progress" ? now : null, now, now],
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
  await writeHistory(pool, input.leadId, input.actor, "Meeting completed", `${def.bookingTask} marked completed.`, {
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
    throw new MeetingActionError(409, "This meeting is already completed");
  }
  if (row.source === "crm") {
    throw new MeetingActionError(409, "Pre 10% meetings from CRM are changed in CRM");
  }
  if (row.source !== "design_module") return;
  const def = DESIGN_MEETINGS.find((item) => item.meetingType === row.meetingType);
  if (def && (await completionTaskDone(pool, row.leadId, def))) {
    const now = new Date();
    await pool.query(
      `UPDATE lead_meetings SET progress = 'completed', ended_at = COALESCE(ended_at, ?), updated_at = ? WHERE id = ?`,
      [now, now, row.id],
    );
    throw new MeetingActionError(409, "This meeting is already completed");
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
  if (row.progress === "completed") throw new MeetingActionError(409, "This meeting is already completed");
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

export async function endCrmMeeting(pool: Pool, meetingId: number, actor?: MeetingActor | null) {
  await ensureLeadMeetingsTable(pool);
  const row = await loadMeeting(pool, meetingId);
  if (!row) throw new MeetingActionError(404, "Meeting not found");
  if (row.source !== "crm") throw new MeetingActionError(400, "End is for CRM meetings");
  if (row.meetingStatus === "cancelled") throw new MeetingActionError(409, "This meeting is cancelled");
  if (row.progress === "completed") return row;
  const now = new Date();
  await pool.query(
    `UPDATE lead_meetings SET progress = 'completed', ended_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, row.id],
  );
  await writeHistory(pool, row.leadId, actor, "Meeting completed", "CRM meeting ended.", {
    action: "completed",
    meetingId: row.id,
    source: "crm",
    meetingDate: row.meetingDate,
    meetingTime: row.meetingTime,
  });
  return loadMeeting(pool, row.id);
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

/**
 * Quote sent only when the lead has a generated quote code, a final amount,
 * and at least one version whose CRM share is finished.
 */
async function quoteShareByLead(
  pool: Pool,
  leadIds: number[],
): Promise<Map<number, { quoteSent: boolean; quoteFinalAmount: number | null }>> {
  const out = new Map<number, { quoteSent: boolean; quoteFinalAmount: number | null }>();
  const ids = [...new Set(leadIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return out;
  const placeholders = ids.map(() => "?").join(",");
  const [leadRows] = await pool.query(
    `SELECT id AS leadId,
            prolance_quote_id AS quoteId,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.quotation_total')) AS quotationTotal,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(payload), payload, '{}'), '$.quotationTotal')) AS quotationTotalAlt
       FROM leads
      WHERE id IN (${placeholders})`,
    ids,
  );
  const [snapRows] = await pool.query(
    `SELECT lead_id AS leadId,
            MAX(CASE
                  WHEN crm_shared_version_number >= 1 AND crm_shared_quote_id > 0 THEN 1
                  ELSE 0
                END) AS crmShared,
            MAX(CASE
                  WHEN crm_shared_quote_id > 0 THEN crm_shared_quote_id
                  ELSE 0
                END) AS sharedQuoteId,
            MAX(CASE
                  WHEN JSON_VALID(payload_json) THEN GREATEST(
                    COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.totalPayableAmount')) AS DECIMAL(18,2)), 0),
                    COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.finalTotalPrice')) AS DECIMAL(18,2)), 0),
                    COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.finalPrice')) AS DECIMAL(18,2)), 0)
                  )
                  ELSE 0
                END) AS snapshotAmount
       FROM lead_prolance_quote_snapshots
      WHERE lead_id IN (${placeholders})
      GROUP BY lead_id`,
    ids,
  );
  const leads = new Map<number, { code: boolean; amount: number | null }>();
  for (const row of leadRows as Record<string, unknown>[]) {
    const id = Number(row.leadId);
    const quoteId = Number(row.quoteId);
    leads.set(id, {
      code: Number.isFinite(quoteId) && quoteId > 0,
      amount: positiveAmount(row.quotationTotal) ?? positiveAmount(row.quotationTotalAlt),
    });
  }
  const snaps = new Map<number, { shared: boolean; sharedQuoteId: number; amount: number | null }>();
  for (const row of snapRows as Record<string, unknown>[]) {
    const id = Number(row.leadId);
    const snapshotAmount = positiveAmount(row.snapshotAmount);
    snaps.set(id, {
      shared: Number(row.crmShared) === 1,
      sharedQuoteId: Number(row.sharedQuoteId) || 0,
      amount: snapshotAmount,
    });
  }
  for (const id of ids) {
    const lead = leads.get(id);
    const snap = snaps.get(id);
    const finalAmount = snap?.amount ?? lead?.amount ?? null;
    const code = lead?.code === true || (snap?.sharedQuoteId ?? 0) > 0;
    out.set(id, {
      quoteSent: code && finalAmount != null && snap?.shared === true,
      quoteFinalAmount: finalAmount,
    });
  }
  return out;
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

export async function listLeadMeetings(pool: Pool, opts?: { leadId?: number; now?: Date; designerIds?: number[] }) {
  await ensureLeadMeetingsTable(pool);
  await reconcileCompletedDesignMeetings(pool);
  const now = opts?.now || new Date();
  const designerIds = opts?.designerIds?.filter((id) => Number.isInteger(id) && id > 0);
  if (opts?.designerIds && (!designerIds || designerIds.length === 0)) return [];
  const scoped = Boolean(designerIds);
  const scopeSql = scoped
    ? `AND COALESCE(m.designer_id, l.assigned_designer_id) IN (${designerIds!.map(() => "?").join(",")})`
    : "";
  const openParams: unknown[] = [];
  if (opts?.leadId) openParams.push(opts.leadId);
  if (scoped) openParams.push(...designerIds!);
  const [openRows] = await pool.query(
    `${MEETING_SELECT}
      ${scoped ? "JOIN leads l ON l.id = m.lead_id" : ""}
      WHERE m.meeting_status <> 'cancelled' AND m.progress <> 'completed'
        ${opts?.leadId ? "AND m.lead_id = ?" : ""}
        ${scopeSql}`,
    openParams,
  );
  for (const raw of openRows as Record<string, unknown>[]) {
    await refreshStoredProgress(pool, mapRow(raw), now, true);
  }

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
            (SELECT COUNT(*) FROM lead_history h WHERE h.lead_id = m.lead_id AND (h.event_title = 'Meeting rescheduled' OR JSON_UNQUOTE(JSON_EXTRACT(h.metadata, '$.action')) = 'rescheduled')) AS historyRescheduleCount,
            u.name AS assignedDesignerName,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.formData.customer_name')) AS customerName,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.formData.customerName')) AS customerNameAlt,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.customer_name')) AS customerNameRoot,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.formData.phone')) AS formPhone,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.formData.mobile')) AS formMobile,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.formData.sales_executive')) AS salesExec,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.formData.salesExecutive')) AS salesExecAlt,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.salesExecutive')) AS salesExecRoot,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.quotation_total')) AS quotationTotal,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.quotationTotal')) AS quotationTotalAlt,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.discovery.budget')) AS discoveryBudget,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.formData.budget')) AS formBudget,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.budget')) AS rootBudget,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.formData.sales_closure_ec')) AS ecFormSales,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.formData.branch')) AS ecFormBranch,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.formData.experience_center')) AS ecFormCenter,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.form_data.sales_closure_ec')) AS ecDataSales,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.form_data.branch')) AS ecDataBranch,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.form_data.experience_center')) AS ecDataCenter,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.sales_closure_ec')) AS ecRootSales,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.branch')) AS ecRootBranch,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.experience_center')) AS ecRootCenter,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.form.sales_closure_ec')) AS ecAltSales,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.form.branch')) AS ecAltBranch,
            JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.form.experience_center')) AS ecAltCenter
       FROM lead_meetings m
       JOIN leads l ON l.id = m.lead_id
       LEFT JOIN users u ON u.id = COALESCE(m.designer_id, l.assigned_designer_id)
      ${opts?.leadId || scoped ? `WHERE ${[opts?.leadId ? "m.lead_id = ?" : "", scoped ? `COALESCE(m.designer_id, l.assigned_designer_id) IN (${designerIds!.map(() => "?").join(",")})` : ""].filter(Boolean).join(" AND ")}` : ""}
      ORDER BY m.meeting_date ASC, m.meeting_time ASC, m.id ASC`,
    [...(opts?.leadId ? [opts.leadId] : []), ...(scoped ? designerIds! : [])],
  );

  let shareByLead = new Map<number, { quoteSent: boolean; quoteFinalAmount: number | null }>();
  try {
    shareByLead = await quoteShareByLead(
      pool,
      (rows as Record<string, unknown>[]).map((row) => Number(row.leadId)),
    );
  } catch (err) {
    console.error("quote share lookup failed", err);
  }

  return (rows as Record<string, unknown>[]).map((row) => {
    const share = shareByLead.get(Number(row.leadId));
    return {
    id: Number(row.id),
    leadId: Number(row.leadId),
    projectId: cleanText(row.projectId),
    projectName: cleanText(row.projectName),
    projectStage: cleanText(row.projectStage),
    isOnHold: row.isOnHold === 1 || row.isOnHold === true || row.isOnHold === "1",
    customerName:
      cleanText(row.customerName) || cleanText(row.customerNameAlt) || cleanText(row.customerNameRoot) || cleanText(row.projectName) || "Customer",
    phone: cleanText(row.contactNo) || cleanText(row.formPhone) || cleanText(row.formMobile),
    salesName: cleanText(row.salesExec) || cleanText(row.salesExecAlt) || cleanText(row.salesExecRoot),
    quotationTotal: cleanText(row.quotationTotal) || cleanText(row.quotationTotalAlt),
    budget: cleanText(row.discoveryBudget) || cleanText(row.formBudget) || cleanText(row.rootBudget),
    branchName:
      cleanText(row.meetingBranch) ||
      cleanText(row.ecFormSales) ||
      cleanText(row.ecFormBranch) ||
      cleanText(row.ecFormCenter) ||
      cleanText(row.ecDataSales) ||
      cleanText(row.ecDataBranch) ||
      cleanText(row.ecDataCenter) ||
      cleanText(row.ecRootSales) ||
      cleanText(row.ecRootBranch) ||
      cleanText(row.ecRootCenter) ||
      cleanText(row.ecAltSales) ||
      cleanText(row.ecAltBranch) ||
      cleanText(row.ecAltCenter),
    designerName: cleanText(row.assignedDesignerName) || "Unassigned",
    meetingDate: String(row.meetingDate || "").slice(0, 10),
    meetingTime: cleanText(row.meetingTime),
    meetingTimeLabel: cleanText(row.meetingTime),
    meetingType: cleanText(row.meetingType),
    meetingMode: cleanText(row.meetingMode),
    meetingStatus: cleanText(row.meetingStatus),
    progress: cleanText(row.progress),
    source: cleanText(row.source),
    cancelReason: cleanText(row.cancelReason),
    cancelFiles: parseCancelFiles(row.cancelFiles),
    reason: cleanText(row.cancelReason),
    endedAt: meetingEndedIso(row.endedAt),
    quoteSent: share?.quoteSent === true,
    quoteFinalAmount: share?.quoteFinalAmount != null ? String(share.quoteFinalAmount) : null,
    rescheduleCount: Math.max(Number(row.rescheduleCount || 0), Number(row.historyRescheduleCount || 0)),
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
      if (designDate) {
        await insertBackfill(pool, {
          leadId: lead.id,
          meetingDate: designDate,
          meetingTime: normalizeTimeLabel(design.time || payload.scheduledMeetingSlot),
          meetingType: def?.meetingType || "design_meeting",
          meetingMode: design.meetingMode ? String(design.meetingMode).slice(0, 32) : null,
          designerId: lead.designerId ?? null,
          source: "design_module",
        });
      }
      const crm = (payload.crmSchedule || {}) as Record<string, unknown>;
      const crmDate = normalizeDateIso(crm.date);
      if (crmDate) {
        const crmLabel = cleanText(payload.meetingType);
        await insertBackfill(pool, {
          leadId: lead.id,
          meetingDate: crmDate,
          meetingTime: normalizeTimeLabel(crm.slot) || embeddedClockLabel(crm.date),
          meetingType: "pre_10",
          meetingMode: crmChannel(crmLabel),
          designerId: lead.designerId ?? null,
          source: "crm",
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
  },
) {
  const [existing] = await pool.query(
    `SELECT id FROM lead_meetings
      WHERE lead_id = ? AND source = ? AND meeting_type = ? AND meeting_date = ? LIMIT 1`,
    [input.leadId, input.source, input.meetingType, input.meetingDate],
  );
  if ((existing as unknown[]).length > 0) return;
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
      (lead_id, meeting_date, meeting_time, meeting_type, meeting_mode, meeting_status, progress, designer_id, source, branch, started_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?)`,
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
      progress === "in_progress" ? now : null,
      now,
      now,
    ],
  );
}
