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

// Simulate frontend dedupe: 1 row per lead+day for crm/pre10
const [deduped] = await pool.query(`
  SELECT COUNT(*) AS after_dedupe FROM (
    SELECT lead_id, meeting_date
      FROM lead_meetings m
     WHERE meeting_date BETWEEN '2026-11-01' AND '2026-11-30'
       AND ${orphan}
       AND (
         source = 'crm'
         OR meeting_type IN ('pre_10','pre10')
         OR meeting_type IS NULL
         OR TRIM(meeting_type) = ''
       )
     GROUP BY lead_id, meeting_date
  ) t
`);
console.log("nov_pre10_deduped", deduped[0]);

const [nonPre10] = await pool.query(`
  SELECT COUNT(*) AS c FROM lead_meetings m
   WHERE meeting_date BETWEEN '2026-11-01' AND '2026-11-30'
     AND ${orphan}
     AND NOT (
       source = 'crm'
       OR meeting_type IN ('pre_10','pre10')
       OR meeting_type IS NULL
       OR TRIM(meeting_type) = ''
     )
`);
console.log("nov_non_pre10_rows", nonPre10[0]);

const [approxUi] = await pool.query(`
  SELECT
    (SELECT COUNT(*) FROM (
      SELECT lead_id, meeting_date FROM lead_meetings m
       WHERE meeting_date BETWEEN '2026-11-01' AND '2026-11-30' AND ${orphan}
         AND (source='crm' OR meeting_type IN ('pre_10','pre10') OR meeting_type IS NULL OR TRIM(meeting_type)='')
       GROUP BY lead_id, meeting_date
    ) x)
    +
    (SELECT COUNT(*) FROM lead_meetings m
      WHERE meeting_date BETWEEN '2026-11-01' AND '2026-11-30' AND ${orphan}
        AND NOT (source='crm' OR meeting_type IN ('pre_10','pre10') OR meeting_type IS NULL OR TRIM(meeting_type)='')
    ) AS approx_ui_count
`);
console.log("nov_approx_ui", approxUi[0]);

// Why 291 on Nov 18 - top leads
const [top] = await pool.query(`
  SELECT lead_id, COUNT(*) AS c, MAX(meeting_type) AS t, MAX(source) AS s
    FROM lead_meetings WHERE meeting_date='2026-11-18'
   GROUP BY lead_id ORDER BY c DESC LIMIT 15
`);
console.log("nov18_top_leads", top);

// Duplicate id spread for worst lead
const [dup] = await pool.query(`
  SELECT id, meeting_type, source, progress, meeting_status, meeting_time, created_at
    FROM lead_meetings WHERE lead_id=? AND meeting_date='2026-11-18' ORDER BY id DESC LIMIT 20
`, [top[0].lead_id]);
console.log("sample_dup_lead", top[0].lead_id, dup);

await pool.end();
