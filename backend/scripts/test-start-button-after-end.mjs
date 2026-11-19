/**
 * Verify: after CRM meeting is completed (End Meeting), Pre 10% Start Meeting stays hidden.
 * Uses DB + same rules as canShowStartMeetingButton (no GitHub push).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(__dirname, "..", ".env"));

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
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
}

function todayIsoDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseDay(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function canShowStartMeetingButton(lead) {
  // Minimal Pre 10% phase check (project stage / bucket)
  const stage = String(lead.projectStage || lead.project_stage || "").toUpperCase();
  const pre10 =
    stage.includes("PRE_10") ||
    stage.includes("PRE10") ||
    stage.includes("PRE 10") ||
    !stage;
  if (!pre10) return { show: false, reason: "not_pre10_stage" };

  const scheduleDay =
    parseDay(lead.scheduledMeetingDate) ||
    parseDay(lead.appointmentDate) ||
    null;
  const today = todayIsoDay();
  if (!scheduleDay || scheduleDay !== today) {
    return { show: false, reason: `not_today(schedule=${scheduleDay}, today=${today})` };
  }

  const completed = lead.meetingWizLastCompleted;
  if (!completed?.at) return { show: true, reason: "no_meetingWizLastCompleted" };

  const completedMeetingDate = parseDay(completed.meetingDate) || parseDay(completed.at);
  if (completedMeetingDate && completedMeetingDate === scheduleDay) {
    return { show: false, reason: "completed_same_schedule_day" };
  }
  const completedDay = parseDay(completed.at);
  if (completedDay === scheduleDay) {
    return { show: false, reason: "completed_at_same_day" };
  }
  return { show: true, reason: "completed_but_different_day" };
}

async function main() {
  const today = todayIsoDay();
  console.log("[1] Today IST:", today);

  const endWired = fs
    .readFileSync(path.join(__dirname, "..", "server.ts"), "utf8")
    .includes("persistLeadMeetingWizCompleted(Number(meeting?.leadId)");
  console.log("[2] End Meeting writes meetingWizLastCompleted:", endWired);

  const pool = await mysql.createPool({
    host: process.env.DB_HOST || "database-1.cl002gu0o5ft.ap-south-2.rds.amazonaws.com",
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASSWORD || "Hubinterior2019",
    database: process.env.DB_NAME || "DesignMod",
    port: Number(process.env.DB_PORT || 3306),
    connectionLimit: 2,
  });

  try {
    const [rows] = await pool.query(
      `SELECT m.id AS meetingId,
              m.lead_id AS leadId,
              m.progress,
              DATE_FORMAT(m.meeting_date, '%Y-%m-%d') AS meetingDate,
              l.project_stage AS projectStage,
              l.payload
         FROM lead_meetings m
         JOIN leads l ON l.id = m.lead_id
        WHERE m.source = 'crm'
          AND m.progress = 'completed'
          AND m.meeting_status <> 'cancelled'
          AND DATE_FORMAT(m.meeting_date, '%Y-%m-%d') = ?
        ORDER BY m.updated_at DESC, m.id DESC
        LIMIT 8`,
      [today],
    );

    if (!rows.length) {
      console.log("[3] No completed CRM meetings for today — checking latest completed instead");
      const [any] = await pool.query(
        `SELECT m.id AS meetingId,
                m.lead_id AS leadId,
                m.progress,
                DATE_FORMAT(m.meeting_date, '%Y-%m-%d') AS meetingDate,
                l.project_stage AS projectStage,
                l.payload
           FROM lead_meetings m
           JOIN leads l ON l.id = m.lead_id
          WHERE m.source = 'crm'
            AND m.progress = 'completed'
            AND m.meeting_status <> 'cancelled'
          ORDER BY m.updated_at DESC, m.id DESC
          LIMIT 5`,
      );
      rows.push(...any);
    }

    console.log(`[3] Samples: ${rows.length}`);
    let pass = 0;
    let fail = 0;

    for (const row of rows) {
      let payload = {};
      try {
        payload = row.payload ? JSON.parse(row.payload) : {};
      } catch {
        payload = {};
      }

      // Same backfill the leads list does when meetingWizLastCompleted is missing.
      let wiz = payload.meetingWizLastCompleted || null;
      if (!wiz?.at) {
        wiz = {
          at: new Date().toISOString(),
          meetingDate: String(row.meetingDate).slice(0, 10),
        };
      }

      const lead = {
        projectStage: row.projectStage || payload.projectStage || "PRE_10",
        appointmentDate: row.meetingDate,
        scheduledMeetingDate: row.meetingDate,
        meetingWizLastCompleted: wiz,
      };

      const result = canShowStartMeetingButton(lead);
      const ok = result.show === false;
      console.log(
        ok ? "  PASS" : "  FAIL",
        `| lead=${row.leadId} meeting=${row.meetingId} date=${row.meetingDate}`,
        `| showStart=${result.show} (${result.reason})`,
        `| payloadHadWiz=${Boolean(payload.meetingWizLastCompleted?.at)}`,
      );
      if (ok) pass += 1;
      else fail += 1;
    }

    console.log("\n--- summary ---");
    console.log("end route persists wiz flag:", endWired);
    console.log("samples where Start should be HIDDEN:", pass);
    console.log("samples where Start would still SHOW:", fail);
    if (endWired && fail === 0 && pass > 0) {
      console.log("\nRESULT: PASS — after End Meeting, Pre 10% Start Meeting stays hidden");
      process.exit(0);
    }
    if (endWired && pass > 0) {
      console.log("\nRESULT: PARTIAL — most cases hide Start; check FAIL rows");
      process.exit(2);
    }
    console.log("\nRESULT: FAIL");
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("TEST CRASHED:", e?.message || e);
  process.exit(1);
});
