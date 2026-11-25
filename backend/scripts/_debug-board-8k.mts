import mysql from "mysql2/promise";
import { listLeadMeetings } from "../leadMeetings.ts";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "database-1.cl002gu0o5ft.ap-south-2.rds.amazonaws.com",
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "Hubinterior2019",
  database: process.env.DB_NAME || "DesignMod",
  connectionLimit: 10,
  connectTimeout: 60000,
});

await listLeadMeetings(pool, { fromIso: "2026-11-25", toIso: "2026-11-26" });
const t0 = Date.now();
const rows = await listLeadMeetings(pool, { fromIso: "2026-11-01", toIso: "2026-11-30" });
console.log(JSON.stringify({
  ms: Date.now() - t0,
  rows: rows.length,
  withSales: rows.filter(r => r.salesName).length,
  hasToday: rows.some(r => String(r.meetingDate).startsWith("2026-11-25")),
  hasTomorrow: rows.some(r => String(r.meetingDate).startsWith("2026-11-26")),
}));
await pool.end();
