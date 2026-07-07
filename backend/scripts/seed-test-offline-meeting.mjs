/** Insert one test offline meeting for sync verification. */
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Root@123",
  database: process.env.DB_NAME || "DesignMod",
});

const [leads] = await pool.query("SELECT id FROM leads ORDER BY id DESC LIMIT 1");
const leadId = leads[0]?.id;
if (!leadId) {
  console.error("No leads in DesignMod — book a lead first");
  process.exit(1);
}

const now = new Date();
const meetingDate = now.toISOString().slice(0, 10);
await pool.query(
  `INSERT INTO offline_meeting_notifications
   (lead_id, designer_name, client_name, milestone_name, time_slot, meeting_date, branch, created_at, fetched_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  [leadId, "Test Designer", "Test Client EC Sync", "DQC1", "2:00 PM – 3:30 PM", meetingDate, "HBR", now]
);

console.log("Inserted test offline meeting for lead", leadId, "on", meetingDate);
await pool.end();
