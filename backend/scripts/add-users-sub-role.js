const mysql = require("mysql2/promise");
const fs = require("node:fs");
const path = require("node:path");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) return;
    let key = trimmed.slice(0, idx).trim();
    if (key.startsWith("export ")) key = key.slice(7).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  });
}

loadEnvFile();

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hubinterior",
  });

  try {
    const [exists] = await pool.query(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'sub_role'",
    );
    if (exists.length > 0) {
      console.log("users.sub_role already exists. Nothing to do.");
    } else {
      await pool.query("ALTER TABLE users ADD COLUMN sub_role VARCHAR(50) NULL");
      console.log("Added users.sub_role VARCHAR(50) NULL");
    }
  } catch (err) {
    console.error("Failed to add users.sub_role:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
