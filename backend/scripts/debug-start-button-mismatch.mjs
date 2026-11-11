import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let k = t.slice(0, i).trim();
  if (k.startsWith("export ")) k = k.slice(7).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function day(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

const pool = await mysql.createPool({
  host: process.env.DB_HOST || "database-1.cl002gu0o5ft.ap-south-2.rds.amazonaws.com",
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "Hubinterior2019",
  database: process.env.DB_NAME || "DesignMod",
  port: Number(process.env.DB_PORT || 3306),
});

const today = todayIso();
const [rows] = await pool.query(
  `SELECT m.lead_id AS leadId, m.id AS meetingId, m.progress,
          DATE_FORMAT(m.meeting_date,'%Y-%m-%d') AS meetingDate,
          l.project_stage AS projectStage, l.payload
     FROM lead_meetings m
     JOIN leads l ON l.id = m.lead_id
    WHERE m.source='crm' AND m.meeting_status<>'cancelled'
      AND (
        DATE_FORMAT(m.meeting_date,'%Y-%m-%d') = ?
        OR DATE(m.updated_at) = CURDATE()
        OR DATE(m.ended_at) = CURDATE()
      )
    ORDER BY m.updated_at DESC LIMIT 20`,
  [today],
);

console.log("today", today, "crm_meetings_touching_today", rows.length);
for (const row of rows) {
  let p = {};
  try {
    p = row.payload ? JSON.parse(row.payload) : {};
  } catch {
    p = {};
  }
  const wiz = p.meetingWizLastCompleted || null;
  const designDate = day(p.designScheduledMeeting?.date || p.scheduledMeetingDate);
  const appt = day(p.crmSchedule?.date || p.formData?.appointment_date || p.appointment_date);
  const scheduleDayPreferred = designDate || appt || day(row.meetingDate);
  const wizDate = day(wiz?.meetingDate) || day(wiz?.at);
  const designUpdatedAt = p.designScheduledMeeting?.updatedAt || p.designScheduledMeetingUpdatedAt || null;
  const unlockByScheduleUpdate = Boolean(wiz?.at && designUpdatedAt && String(designUpdatedAt) > String(wiz.at));
  const hideByOldRule = Boolean(wizDate && scheduleDayPreferred && wizDate === scheduleDayPreferred);
  const wouldShowOld =
    !wiz?.at
      ? true
      : unlockByScheduleUpdate
        ? true
        : hideByOldRule
          ? false
          : true;

  console.log(
    JSON.stringify({
      leadId: row.leadId,
      meetingDate: row.meetingDate,
      wizAt: wiz?.at || null,
      wizDate,
      designDate,
      appt,
      scheduleDayPreferred,
      unlockByScheduleUpdate,
      hideByOldRule,
      wouldShowStart_OLD: wouldShowOld,
    }),
  );
}
await pool.end();
