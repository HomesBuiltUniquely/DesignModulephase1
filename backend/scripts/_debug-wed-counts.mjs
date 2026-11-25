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

for (const d of ["2026-11-18", "2026-11-19", "2026-11-25", "2026-11-26"]) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c,
            SUM(m.meeting_status='cancelled') AS cancelled,
            SUM(m.progress='completed') AS completed,
            SUM(m.source='crm') AS crm,
            SUM(m.source='design_module') AS design
       FROM lead_meetings m
      WHERE m.meeting_date = ? AND ${orphan}`,
    [d],
  );
  const [raw] = await pool.query(
    `SELECT COUNT(*) AS c FROM lead_meetings WHERE meeting_date = ?`,
    [d],
  );
  console.log(d, "board_filter", rows[0], "raw_all", raw[0].c);
}

// November month totals with orphan filter
const [nov] = await pool.query(
  `SELECT COUNT(*) AS c FROM lead_meetings m
    WHERE m.meeting_date BETWEEN '2026-11-01' AND '2026-11-30' AND ${orphan}`,
);
const [novRaw] = await pool.query(
  `SELECT COUNT(*) AS c FROM lead_meetings WHERE meeting_date BETWEEN '2026-11-01' AND '2026-11-30'`,
);
console.log("nov_board", nov[0].c, "nov_raw", novRaw[0].c);

// Unique leads Nov 18 vs 25
for (const d of ["2026-11-18", "2026-11-25"]) {
  const [u] = await pool.query(
    `SELECT COUNT(DISTINCT lead_id) AS leads, COUNT(*) AS rows
       FROM lead_meetings m WHERE meeting_date = ? AND ${orphan}`,
    [d],
  );
  console.log(d, "distinct", u[0]);
}

await pool.end();
