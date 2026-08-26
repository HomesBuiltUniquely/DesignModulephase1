const mysql = require("mysql2/promise");
require("dotenv").config({ path: "./.env" });

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "Root@123",
    database: process.env.DB_NAME || "DesignMod",
  });
  
  try {
    const [rows] = await pool.query("SELECT id, name, email, role FROM users");
    console.log("Users:", rows);
  } catch (err) {
    console.error("DB Error:", err.message);
  }
  process.exit(0);
}
run();
