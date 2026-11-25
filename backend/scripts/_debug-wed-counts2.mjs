import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "database-1.cl002gu0o5ft.ap-south-2.rds.amazonaws.com",
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "Hubinterior2019",
  database: process.env.DB_NAME || "DesignMod",
  connectTimeout: 60000,
});

const orphan = `NOT (
  m.source = 'design_module'
  AND LOWER(REPLACE(REPLACE(TRIM(IFNULL(m.meeting_type,'')), '_', ' '), '-', ' ')) IN ('design meeting', 'designmeeting')
  AND m.meeting_type NOT IN ('dqc1_first_cut', 'dqc2_material_selection', 'design_signoff')
)`;

for (const d of ["2026-11-18", "2026-11-25"]) {
  const [u] = await pool.query(
    `SELECT COUNT(DISTINCT lead_id) AS leads, COUNT(*) AS meeting_rows
       FROM lead_meetings m WHERE meeting_date = ? AND ${orphan}`,
    [d],
  );
  console.log(d, u[0]);
}

// Week comparison Mon-Wed
for (const label of [
  ["prev_week_mon_wed", "2026-11-16", "2026-11-18"],
  ["this_week_mon_wed", "2026-11-23", "2026-11-25"],
  ["prev_wed_only", "2026-11-18", "2026-11-18"],
  ["this_wed_only", "2026-11-25", "2026-11-25"],
]) {
  const [r] = await pool.query(
    `SELECT COUNT(*) AS c, COUNT(DISTINCT lead_id) AS leads
       FROM lead_meetings m
      WHERE meeting_date BETWEEN ? AND ? AND ${orphan}`,
    [label[1], label[2]],
  );
  console.log(label[0], r[0]);
}

// Check payload crmSchedule dates for today that might not be in lead_meetings
const [payloadToday] = await pool.query(`
  SELECT COUNT(*) AS c FROM leads
   WHERE JSON_VALID(payload)
     AND (
       JSON_UNQUOTE(JSON_EXTRACT(payload, '$.crmSchedule.date')) = '2026-11-25'
       OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.formData.appointment_date')) = '2026-11-25'
       OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.formData.appointmentDate')) = '2026-11-25'
     )
`);
console.log("leads_payload_date_today", payloadToday[0]);

const [payloadPrev] = await pool.query(`
  SELECT COUNT(*) AS c FROM leads
   WHERE JSON_VALID(payload)
     AND (
       JSON_UNQUOTE(JSON_EXTRACT(payload, '$.crmSchedule.date')) = '2026-11-18'
       OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.formData.appointment_date')) = '2026-11-18'
     )
`);
console.log("leads_payload_date_prev_wed", payloadPrev[0]);

// Sample today meetings
const [samples] = await pool.query(`
  SELECT m.id, m.lead_id, m.meeting_type, m.source, m.progress, m.meeting_status,
         DATE_FORMAT(m.meeting_date,'%Y-%m-%d') AS d, u.name AS designer
    FROM lead_meetings m
    LEFT JOIN leads l ON l.id = m.lead_id
    LEFT JOIN users u ON u.id = COALESCE(m.designer_id, l.assigned_designer_id)
   WHERE m.meeting_date = '2026-11-25'
`);
console.log("today_rows", samples);

await pool.end();
