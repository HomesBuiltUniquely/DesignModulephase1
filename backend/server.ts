import express, { Request, Response } from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ----- MySQL setup -----
// Defaults are set from the credentials you provided; you can still override via env vars if needed.
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root@root",
  database: process.env.DB_NAME || "DesignMod",
  port: Number(process.env.DB_PORT || 3306),
  connectionLimit: 10,
});

// ----- S3 setup for profile images -----
const S3_REGION = process.env.AWS_REGION || "ap-south-1";
const S3_BUCKET = process.env.S3_BUCKET_NAME || "your-profile-images-bucket";

const s3 = new S3Client({
  region: S3_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      }
    : undefined,
});

// ----- Local uploads (MMT zip folders) -----
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) =>
      cb(null, UPLOADS_DIR),
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid data URL");
  }
  const contentType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");
  let ext = "jpg";
  if (contentType === "image/png") ext = "png";
  else if (contentType === "image/jpeg") ext = "jpg";
  else if (contentType === "image/webp") ext = "webp";
  return { buffer, contentType, ext };
}

async function uploadProfileImageToS3(userId: number, dataUrl: string): Promise<string> {
  const { buffer, contentType, ext } = parseDataUrl(dataUrl);
  const key = `profile-images/user-${userId}-${Date.now()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  // Standard public URL pattern; adjust if you use a CDN or different endpoint
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

const ADMIN_EMAIL = "admin@hubinterior.com";
const ADMIN_PASSWORD = "admin123";

async function initDb() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        profileImage TEXT,
        phone VARCHAR(50)
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id INT NOT NULL,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pid VARCHAR(50) NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        project_stage VARCHAR(50) NOT NULL,
        contact_no VARCHAR(50),
        client_email VARCHAR(255),
        is_on_hold TINYINT(1) DEFAULT 0,
        resume_at DATETIME NULL,
        create_at DATETIME NOT NULL,
        update_at DATETIME NOT NULL,
        payload TEXT NOT NULL
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS checklists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        payload TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        lead_id INT NULL
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS lead_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        event JSON NOT NULL,
        created_at DATETIME NOT NULL
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS lead_task_completions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        milestone_index INT NOT NULL,
        task_name VARCHAR(255) NOT NULL,
        completed_at DATETIME NOT NULL,
        UNIQUE KEY uniq_lead_task (lead_id, milestone_index, task_name)
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS lead_uploads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        uploader_id INT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        stored_path TEXT NOT NULL,
        mime_type VARCHAR(100),
        size_bytes BIGINT,
        uploaded_at DATETIME NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
      );
    `);
    try {
      const [colRows] = await conn.query(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_uploads' AND COLUMN_NAME = 'status'"
      );
      if ((colRows as any[]).length === 0) {
        await conn.query("ALTER TABLE lead_uploads ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'");
      }
    } catch {
      // ignore
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS designers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        lead_name VARCHAR(255) NOT NULL
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS lead_d1_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        assigned_to_user_id INT NOT NULL,
        measurement_date DATE,
        measurement_time VARCHAR(20),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL
      );
    `);

    // seed admin
    const [rows] = await conn.query(
      "SELECT id FROM users WHERE email = ?",
      [ADMIN_EMAIL],
    );
    if ((rows as any[]).length === 0) {
      await conn.query(
        "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
        [ADMIN_EMAIL, ADMIN_PASSWORD, "Admin", "admin"],
      );
    }
  } finally {
    conn.release();
  }
}

initDb().catch((err) => {
  console.error("Error initialising database", err);
});

// helper to map sales-closure payload to lead fields
function toLeadRow(payload: any) {
  const now = new Date();
  const fetched = payload?.fetchedData || {};
  const formData = payload?.formData || {};
  const projectName =
    fetched.customer_name || fetched.sales_lead_name || "Unnamed";
  const payment = formData.payment_received || "";
  const stage =
    payment === "FULL_10%"
      ? "10-20%"
      : payment === "PARTIAL" || payment === "TOKEN"
        ? "Pre 10%"
        : formData.status_of_project || "Active";

  return {
    pid: "", // you can generate a PID here if needed
    projectName,
    projectStage: stage,
    contactNo: fetched.co_no || null,
    clientEmail: fetched.email || null,
    createAt: now,
    updateAt: now,
  };
}

async function getUserFromSession(req: Request) {
  const auth = req.headers.authorization;
  const token = auth?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.name, u.role, u.profileImage, u.phone
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    [token],
  );
  const user = (rows as any[])[0];
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    profileImage: user.profileImage || null,
    phone: user.phone || "",
  };
}

async function addLeadHistoryEvent(leadId: number, event: any) {
  await pool.query(
    "INSERT INTO lead_history (lead_id, event, created_at) VALUES (?, ?, ?)",
    [leadId, JSON.stringify(event), new Date()],
  );
}

// ----- Auth -----

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id, email, name, role, profileImage, phone, password FROM users WHERE email = ?",
      [email],
    );
    const userRow = (rows as any[])[0];
    if (!userRow || userRow.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      profileImage: userRow.profileImage || null,
      phone: userRow.phone || "",
    };

    const sessionId =
      "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    await pool.query(
      "INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)",
      [sessionId, user.id, new Date()],
    );

    return res.status(200).json({ user, sessionId });
  } catch (err) {
    console.error("Login error", err);
    return res.status(500).json({ message: "Login failed" });
  }
});

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  const token = auth?.replace(/^Bearer\s+/i, "");
  if (token) {
    try {
      await pool.query("DELETE FROM sessions WHERE id = ?", [token]);
    } catch (err) {
      console.warn("Logout error", err);
    }
  }
  return res.status(200).json({ ok: true });
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    return res.json(user);
  } catch (err) {
    console.error("me error", err);
    return res.status(500).json({ message: "Failed to load user" });
  }
});

// List MMT executives for assignment (e.g. D1 Measurement popup)
app.get("/api/auth/mmt-executives", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const [rows] = await pool.query(
      "SELECT id, name, email FROM users WHERE role = 'mmt_executive' ORDER BY name ASC",
    );
    return res.json(rows);
  } catch (err) {
    console.error("mmt-executives error", err);
    return res.status(500).json({ message: "Failed to load MMT executives" });
  }
});

// Update profile details (name, email, phone)
app.put("/api/auth/profile", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { name, email, phone } = req.body || {};
    if (!name || !email || !phone) {
      return res
        .status(400)
        .json({ message: "name, email and phone are required" });
    }

    await pool.query(
      "UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?",
      [name, email, phone, user.id],
    );

    const updated = await getUserFromSession(req);
    return res.json({
      message: "Profile updated",
      user: updated,
    });
  } catch (err) {
    console.error("profile update error", err);
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

// Update profile image (data URL stored as TEXT)
app.put("/api/auth/profile-image", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { image } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ message: "image is required" });
    }

    // Upload to S3 and store only the URL in DB
    const url = await uploadProfileImageToS3(user.id, image);

    await pool.query("UPDATE users SET profileImage = ? WHERE id = ?", [
      url,
      user.id,
    ]);

    const updated = await getUserFromSession(req);
    return res.json({
      message: "Profile image updated",
      user: updated,
    });
  } catch (err) {
    console.error("profile image update error", err);
    return res
      .status(500)
      .json({ message: "Failed to update profile image" });
  }
});

// Admin: create MMT Manager user (POST only; GET returns 405 so you can confirm route is loaded)
app.all("/api/auth/create-mmt-manager", async (req: Request, res: Response) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Use POST to create MMT Manager" });
  }
  try {
    const admin = await getUserFromSession(req);
    if (!admin) return res.status(401).json({ message: "Unauthorized" });
    if (admin.role !== "admin") {
      return res.status(403).json({ message: "Only admin can create MMT Manager" });
    }

    const { email, password, name, phone } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) {
      return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    }
    if (!password || String(password).length < 1) {
      return res.status(400).json({ message: "Password is required" });
    }

    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;

    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, "mmt_manager", phoneVal || null],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({
      user: {
        id: insertId,
        email: normalized,
        name: displayName,
        role: "mmt_manager",
      },
    });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "A user with this email already exists" });
    }
    console.error("create-mmt-manager error", err);
    return res.status(500).json({ message: "Failed to create MMT Manager" });
  }
});

// MMT Manager: register MMT Executive user
app.all("/api/auth/register-mmt-executive", async (req: Request, res: Response) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Use POST to register MMT Executive" });
  }
  try {
    const manager = await getUserFromSession(req);
    if (!manager) return res.status(401).json({ message: "Unauthorized" });
    const role = (manager.role || "").toLowerCase();
    if (role !== "mmt_manager" && role !== "admin") {
      return res.status(403).json({ message: "Only MMT Manager or Admin can register MMT Executives" });
    }

    const { email, password, name, phone } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) {
      return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    }
    if (!password || String(password).length < 1) {
      return res.status(400).json({ message: "Password is required" });
    }

    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;

    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, "mmt_executive", phoneVal || null],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({
      user: {
        id: insertId,
        email: normalized,
        name: displayName,
        role: "mmt_executive",
      },
    });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "A user with this email already exists" });
    }
    console.error("register-mmt-executive error", err);
    return res.status(500).json({ message: "Failed to register MMT Executive" });
  }
});

// ----- Sales closure and leads -----

app.post("/api/sales-closure", async (req: Request, res: Response) => {
  const payload = req.body;
  console.log("Received sales-closure:", payload);

  const lead = toLeadRow(payload);
  const pid = ""; // keep empty or generate PID if required

  try {
    await pool.query(
      `INSERT INTO leads
       (pid, project_name, project_stage, contact_no, client_email,
        is_on_hold, resume_at, create_at, update_at, payload)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
      [
        pid,
        lead.projectName,
        lead.projectStage,
        lead.contactNo,
        lead.clientEmail,
        lead.createAt,
        lead.updateAt,
        JSON.stringify(payload),
      ],
    );

    res.status(201).json({
      success: true,
      message: "Sales closure received",
    });
  } catch (err) {
    console.error("Error saving lead", err);
    res.status(500).json({ message: "Failed to save sales closure" });
  }
});

// checklist endpoints (persisted in generic checklists table)
app.post("/api/checklist", async (req: Request, res: Response) => {
  const { leadId, milestoneIndex, taskName, answers } = req.body || {};
  const payload = { milestoneIndex, taskName, answers };
  console.log("Checklist received:", payload);
  try {
    await pool.query(
      "INSERT INTO checklists (type, payload, created_at, lead_id) VALUES (?, ?, ?, ?)",
      ["first_cut", JSON.stringify(payload), new Date(), leadId ?? null],
    );
    if (leadId) {
      const event = {
        id: `checklist-first-cut-${Date.now()}`,
        type: "note",
        taskName,
        milestoneName: "DQC1",
        timestamp: new Date().toISOString(),
        description: `Checklist completed: ${taskName}`,
        user: { name: "System" },
        details: { kind: "note", noteText: "First-cut meeting checklist submitted." },
      };
      await addLeadHistoryEvent(leadId, event);
    }
    res
      .status(201)
      .json({ success: true, message: "Checklist received" });
  } catch (err) {
    console.error("Checklist save error", err);
    res.status(500).json({ message: "Failed to save checklist" });
  }
});

app.get("/api/checklist/last", async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      "SELECT payload FROM checklists WHERE type = ? ORDER BY created_at DESC LIMIT 1",
      ["first_cut"],
    );
    const row = (rows as any[])[0];
    if (!row) {
      return res.status(404).json({ message: "No checklist data yet" });
    }
    return res.json(JSON.parse(row.payload));
  } catch (err) {
    console.error("Checklist load error", err);
    return res.status(500).json({ message: "Failed to load checklist" });
  }
});

// design-freeze-checklist endpoints
app.post("/api/design-freeze-checklist", async (req: Request, res: Response) => {
  const { leadId, milestoneIndex, taskName, answers } = req.body || {};
  const payload = { milestoneIndex, taskName, answers };
  console.log("Design Freeze Checklist received:", payload);
  try {
    await pool.query(
      "INSERT INTO checklists (type, payload, created_at, lead_id) VALUES (?, ?, ?, ?)",
      ["design_freeze", JSON.stringify(payload), new Date()],
    );
    if (leadId) {
      const event = {
        id: `checklist-design-freeze-${Date.now()}`,
        type: "note",
        taskName,
        milestoneName: "DQC1",
        timestamp: new Date().toISOString(),
        description: `Checklist completed: ${taskName}`,
        user: { name: "System" },
        details: { kind: "note", noteText: "Design-freeze meeting checklist submitted." },
      };
      await addLeadHistoryEvent(leadId, event);
    }
    res.status(201).json({
      success: true,
      message: "Design Freeze Checklist received",
    });
  } catch (err) {
    console.error("Design freeze save error", err);
    res.status(500).json({ message: "Failed to save design freeze checklist" });
  }
});

app.get(
  "/api/design-freeze-checklist/last",
  async (req: Request, res: Response) => {
    try {
      const [rows] = await pool.query(
        "SELECT payload FROM checklists WHERE type = ? ORDER BY created_at DESC LIMIT 1",
        ["design_freeze"],
      );
      const row = (rows as any[])[0];
      if (!row) {
        return res
          .status(404)
          .json({ message: "No design freeze checklist data yet" });
      }
      return res.json(JSON.parse(row.payload));
    } catch (err) {
      console.error("Design freeze load error", err);
      return res
        .status(500)
        .json({ message: "Failed to load design freeze checklist" });
    }
  },
);

// color-selection-checklist endpoints
app.post(
  "/api/color-selection-checklist",
  async (req: Request, res: Response) => {
    const { leadId, milestoneIndex, taskName, answers } = req.body || {};
    const payload = { milestoneIndex, taskName, answers };
    console.log("Color Selection Checklist received:", payload);
    try {
      await pool.query(
        "INSERT INTO checklists (type, payload, created_at, lead_id) VALUES (?, ?, ?, ?)",
        ["color_selection", JSON.stringify(payload), new Date()],
      );
      if (leadId) {
        const event = {
          id: `checklist-color-selection-${Date.now()}`,
          type: "note",
          taskName,
          milestoneName: "DQC2",
          timestamp: new Date().toISOString(),
          description: `Checklist completed: ${taskName}`,
          user: { name: "System" },
          details: {
            kind: "note",
            noteText: "Color/material selection checklist submitted.",
          },
        };
        await addLeadHistoryEvent(leadId, event);
      }
      res.status(201).json({
        success: true,
        message: "Color Selection Checklist received",
      });
    } catch (err) {
      console.error("Color selection save error", err);
      res
        .status(500)
        .json({ message: "Failed to save color selection checklist" });
    }
  },
);

app.get(
  "/api/color-selection-checklist/last",
  async (req: Request, res: Response) => {
    try {
      const [rows] = await pool.query(
        "SELECT payload FROM checklists WHERE type = ? ORDER BY created_at DESC LIMIT 1",
        ["color_selection"],
      );
      const row = (rows as any[])[0];
      if (!row) {
        return res
          .status(404)
          .json({ message: "No color selection checklist data yet" });
      }
      return res.json(JSON.parse(row.payload));
    } catch (err) {
      console.error("Color selection load error", err);
      return res
        .status(500)
        .json({ message: "Failed to load color selection checklist" });
    }
  },
);

// sign-off meeting-checklist endpoints
app.post(
  "/api/design-signoff-checklist",
  async (req: Request, res: Response) => {
    const { leadId, milestoneIndex, taskName, answers } = req.body || {};
    const payload = { milestoneIndex, taskName, answers };
    console.log("Design Sign Off Checklist received:", payload);
    try {
      await pool.query(
        "INSERT INTO checklists (type, payload, created_at, lead_id) VALUES (?, ?, ?, ?)",
        ["design_signoff", JSON.stringify(payload), new Date(), leadId ?? null],
      );
      if (leadId) {
        const event = {
          id: `checklist-design-signoff-${Date.now()}`,
          type: "note",
          taskName,
          milestoneName: "40% PAYMENT",
          timestamp: new Date().toISOString(),
          description: `Checklist completed: ${taskName}`,
          user: { name: "System" },
          details: {
            kind: "note",
            noteText: "Design sign-off meeting checklist submitted.",
          },
        };
        await addLeadHistoryEvent(leadId, event);
      }
      res.status(201).json({
        success: true,
        message: "Design Sign Off Checklist received",
      });
    } catch (err) {
      console.error("Design signoff save error", err);
      res
        .status(500)
        .json({ message: "Failed to save design signoff checklist" });
    }
  },
);

app.get(
  "/api/design-signoff-checklist/last",
  async (req: Request, res: Response) => {
    try {
      const [rows] = await pool.query(
        "SELECT payload FROM checklists WHERE type = ? ORDER BY created_at DESC LIMIT 1",
        ["design_signoff"],
      );
      const row = (rows as any[])[0];
      if (!row) {
        return res
          .status(404)
          .json({ message: "No design sign off checklist data yet" });
      }
      return res.json(JSON.parse(row.payload));
    } catch (err) {
      console.error("Design signoff load error", err);
      return res
        .status(500)
        .json({ message: "Failed to load design signoff checklist" });
    }
  },
);

app.get("/api/sales-closure/last", async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      "SELECT payload FROM leads ORDER BY create_at DESC LIMIT 1",
    );
    const row = (rows as any[])[0];
    if (!row) {
      return res.status(404).json({
        message: "No data yet",
      });
    }

    res.json(JSON.parse(row.payload));
  } catch (err) {
    console.error("sales-closure/last error", err);
    res.status(500).json({ message: "Failed to load sales closure" });
  }
});

// Lead history (all events for a lead)
app.get("/api/leads/:id/history", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const [rows] = await pool.query(
      "SELECT event FROM lead_history WHERE lead_id = ? ORDER BY created_at DESC",
      [id],
    );
    const events = (rows as any[]).map((r) => {
      try {
        return JSON.parse(r.event);
      } catch {
        return null;
      }
    }).filter(Boolean);
    return res.json(events);
  } catch (err) {
    console.error("lead history error", err);
    return res.status(500).json({ message: "Failed to load history" });
  }
});

// Persist a history event for a lead (frontend posts HistoryEvent objects here)
app.post("/api/leads/:id/history", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    await addLeadHistoryEvent(id, req.body);
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("lead history insert error", err);
    return res.status(500).json({ message: "Failed to save history" });
  }
});

// Get completed tasks for a lead (used to restore completion state after refresh)
app.get("/api/leads/:id/completions", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const [rows] = await pool.query(
      "SELECT milestone_index as milestoneIndex, task_name as taskName, completed_at as completedAt FROM lead_task_completions WHERE lead_id = ?",
      [id],
    );
    return res.json(rows);
  } catch (err) {
    console.error("lead completions load error", err);
    return res.status(500).json({ message: "Failed to load completions" });
  }
});

// Mark a task completed for a lead (persists across refresh)
app.post("/api/leads/:id/complete-task", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const { milestoneIndex, taskName } = req.body || {};
  if (typeof milestoneIndex !== "number" || !taskName) {
    return res.status(400).json({ message: "milestoneIndex and taskName are required" });
  }
  try {
    await pool.query(
      `INSERT INTO lead_task_completions (lead_id, milestone_index, task_name, completed_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at)`,
      [id, milestoneIndex, taskName, new Date()],
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("complete-task error", err);
    return res.status(500).json({ message: "Failed to save completion" });
  }
});

// MMT uploads: upload a ZIP "folder" for a lead
app.post(
  "/api/leads/:id/uploads",
  upload.single("zip"),
  async (req: Request, res: Response) => {
    const leadId = Number(req.params.id);
    if (Number.isNaN(leadId))
      return res.status(400).json({ message: "Invalid id" });
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ message: "zip file is required" });

    try {
      const user = await getUserFromSession(req);
      const uploaderId = user?.id ?? null;
      const role = (user?.role ?? "").toLowerCase();
      const status = role === "mmt_manager" ? "approved" : "pending";

      await pool.query(
        `INSERT INTO lead_uploads
         (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          leadId,
          uploaderId,
          file.originalname,
          file.filename,
          file.path,
          file.mimetype,
          file.size,
          new Date(),
          status,
        ],
      );

      // Add history event
      const ev = {
        id: `upload-${Date.now()}`,
        type: "file_upload",
        taskName: "MMT upload",
        milestoneName: "D1 SITE MEASUREMENT",
        timestamp: new Date().toISOString(),
        description: `MMT uploaded files: ${file.originalname}`,
        user: { name: user?.name ?? "MMT" },
        details: { kind: "file_upload", fileName: file.originalname, size: `${file.size}` },
      };
      await addLeadHistoryEvent(leadId, ev);

      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("lead upload error", err);
      return res.status(500).json({ message: "Failed to upload files" });
    }
  },
);

// List uploads for a lead (designers see only approved; MMT manager/executive see all with status)
app.get("/api/leads/:id/uploads", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId))
    return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    const role = (user?.role ?? "").toLowerCase();
    const isMmt = role === "mmt_manager" || role === "mmt_executive";
    const onlyApproved = !isMmt;

    const [rows] = await pool.query(
      onlyApproved
        ? `SELECT id, original_name as originalName, uploaded_at as uploadedAt, status
           FROM lead_uploads WHERE lead_id = ? AND status = 'approved' ORDER BY uploaded_at DESC`
        : `SELECT id, original_name as originalName, uploaded_at as uploadedAt, status
           FROM lead_uploads WHERE lead_id = ? ORDER BY uploaded_at DESC`,
      [leadId],
    );
    return res.json(rows);
  } catch (err) {
    console.error("list uploads error", err);
    return res.status(500).json({ message: "Failed to load uploads" });
  }
});

// MMT Manager only: approve an upload so it becomes visible to designers
app.post("/api/leads/:leadId/uploads/:uploadId/approve", async (req: Request, res: Response) => {
  const leadId = Number(req.params.leadId);
  const uploadId = Number(req.params.uploadId);
  if (Number.isNaN(leadId) || Number.isNaN(uploadId))
    return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if ((user.role || "").toLowerCase() !== "mmt_manager")
      return res.status(403).json({ message: "Only MMT Manager can approve uploads" });
    const [result] = await pool.query(
      "UPDATE lead_uploads SET status = 'approved' WHERE id = ? AND lead_id = ?",
      [uploadId, leadId],
    );
    if ((result as any).affectedRows === 0)
      return res.status(404).json({ message: "Upload not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("approve upload error", err);
    return res.status(500).json({ message: "Failed to approve" });
  }
});

// MMT only: delete an upload (so they can re-upload the correct version)
app.delete("/api/leads/:leadId/uploads/:uploadId", async (req: Request, res: Response) => {
  const leadId = Number(req.params.leadId);
  const uploadId = Number(req.params.uploadId);
  if (Number.isNaN(leadId) || Number.isNaN(uploadId))
    return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role || "").toLowerCase();
    const isMmt = ["mmt", "mmt_manager", "mmt_executive"].includes(role);
    if (!isMmt) return res.status(403).json({ message: "Only MMT can delete uploads" });
    const [rows] = await pool.query(
      "SELECT stored_path as storedPath FROM lead_uploads WHERE id = ? AND lead_id = ?",
      [uploadId, leadId],
    );
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ message: "Upload not found" });
    await pool.query("DELETE FROM lead_uploads WHERE id = ? AND lead_id = ?", [uploadId, leadId]);
    if (row.storedPath && fs.existsSync(row.storedPath)) {
      try {
        fs.unlinkSync(row.storedPath);
      } catch (e) {
        console.warn("Could not delete file from disk:", row.storedPath, e);
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("delete upload error", err);
    return res.status(500).json({ message: "Failed to delete upload" });
  }
});

// Download an upload (designers can only download approved uploads)
app.get("/api/leads/:leadId/uploads/:uploadId/download", async (req: Request, res: Response) => {
  const leadId = Number(req.params.leadId);
  const uploadId = Number(req.params.uploadId);
  if (Number.isNaN(leadId) || Number.isNaN(uploadId)) {
    return res.status(400).json({ message: "Invalid id" });
  }
  try {
    const user = await getUserFromSession(req);
    const role = (user?.role ?? "").toLowerCase();
    const isMmt = role === "mmt_manager" || role === "mmt_executive";
    const [rows] = await pool.query(
      `SELECT stored_path as storedPath, original_name as originalName, status
       FROM lead_uploads WHERE id = ? AND lead_id = ?`,
      [uploadId, leadId],
    );
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ message: "Not found" });
    if (!isMmt && row.status !== "approved")
      return res.status(403).json({ message: "Only approved uploads are available" });
    return res.download(row.storedPath, row.originalName);
  } catch (err) {
    console.error("download upload error", err);
    return res.status(500).json({ message: "Failed to download" });
  }
});

// List files inside a ZIP (designers can only list approved uploads)
app.get("/api/leads/:leadId/uploads/:uploadId/contents", async (req: Request, res: Response) => {
  const leadId = Number(req.params.leadId);
  const uploadId = Number(req.params.uploadId);
  if (Number.isNaN(leadId) || Number.isNaN(uploadId)) {
    return res.status(400).json({ message: "Invalid id" });
  }
  try {
    const user = await getUserFromSession(req);
    const role = (user?.role ?? "").toLowerCase();
    const isMmt = role === "mmt_manager" || role === "mmt_executive";
    const [rows] = await pool.query(
      `SELECT stored_path as storedPath, original_name as originalName, size_bytes as sizeBytes, status FROM lead_uploads WHERE id = ? AND lead_id = ?`,
      [uploadId, leadId],
    );
    const row = (rows as any[])[0];
    if (!row || !fs.existsSync(row.storedPath)) return res.status(404).json({ message: "Not found" });
    if (!isMmt && row.status !== "approved")
      return res.status(403).json({ message: "Only approved uploads are available" });
    try {
      const zip = new AdmZip(row.storedPath);
      const entries = zip.getEntries();
      const files = entries
        .filter((e) => !e.isDirectory)
        .map((e) => ({ path: e.entryName, size: e.header?.size ?? 0 }));
      return res.json({ files });
    } catch {
      // Not a ZIP (e.g. single .dwg file) – return single entry so Open/Download still work
      const name = row.originalName || path.basename(row.storedPath);
      return res.json({ files: [{ path: name, size: row.sizeBytes || 0 }] });
    }
  } catch (err) {
    console.error("zip contents error", err);
    return res.status(500).json({ message: "Failed to read contents" });
  }
});

// Serve one file from inside a ZIP (designers can only access approved uploads)
app.get("/api/leads/:leadId/uploads/:uploadId/file", async (req: Request, res: Response) => {
  const leadId = Number(req.params.leadId);
  const uploadId = Number(req.params.uploadId);
  const filePath = req.query.path as string;
  if (Number.isNaN(leadId) || Number.isNaN(uploadId) || !filePath) {
    return res.status(400).json({ message: "Invalid id or path" });
  }
  try {
    const user = await getUserFromSession(req);
    const role = (user?.role ?? "").toLowerCase();
    const isMmt = role === "mmt_manager" || role === "mmt_executive";
    const [rows] = await pool.query(
      `SELECT stored_path as storedPath, original_name as originalName, status FROM lead_uploads WHERE id = ? AND lead_id = ?`,
      [uploadId, leadId],
    );
    const row = (rows as any[])[0];
    if (!row || !fs.existsSync(row.storedPath)) return res.status(404).json({ message: "Not found" });
    if (!isMmt && row.status !== "approved")
      return res.status(403).json({ message: "Only approved uploads are available" });
    const ext = path.extname(filePath).toLowerCase();
    const mime: Record<string, string> = {
      ".pdf": "application/pdf",
      ".dwg": "application/acad",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".txt": "text/plain",
      ".json": "application/json",
      ".xml": "application/xml",
      ".md": "text/markdown",
      ".html": "text/html",
      ".htm": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".properties": "text/plain",
      ".gitignore": "text/plain",
      ".gitattributes": "text/plain",
      ".cmd": "text/plain",
      ".bat": "text/plain",
      ".java": "text/plain",
      ".yml": "text/yaml",
      ".yaml": "text/yaml",
    };
    const contentType = mime[ext] || "application/octet-stream";
    const name = path.basename(filePath);
    const isDwg = ext === ".dwg";

    try {
      const zip = new AdmZip(row.storedPath);
      const entry = zip.getEntry(filePath);
      if (!entry || entry.isDirectory) return res.status(404).json({ message: "File not found in ZIP" });
      const data = entry.getData();
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", isDwg ? `attachment; filename="${name.replace(/"/g, "%22")}"` : `inline; filename="${name.replace(/"/g, "%22")}"`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.send(Buffer.isBuffer(data) ? data : Buffer.from(data));
    } catch {
      // Not a ZIP – treat as single file (e.g. .dwg); serve from disk if path matches
      if (filePath !== row.originalName && filePath !== path.basename(row.storedPath)) {
        return res.status(404).json({ message: "File not found" });
      }
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${(row.originalName || name).replace(/"/g, "%22")}"`);
      return res.sendFile(path.resolve(row.storedPath));
    }
  } catch (err) {
    console.error("file serve error", err);
    return res.status(500).json({ message: "Failed to read file" });
  }
});

// Submit D1 measurement request – assigns an MMT executive to the lead (only they will see it)
app.post("/api/leads/:id/d1-request", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const { measurementExecutiveId, measurementDate, measurementTime } = req.body || {};
    const execId = Number(measurementExecutiveId);
    if (!execId) return res.status(400).json({ message: "measurementExecutiveId is required" });
    await pool.query(
      `INSERT INTO lead_d1_assignments (lead_id, assigned_to_user_id, measurement_date, measurement_time, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [leadId, execId, measurementDate || null, measurementTime || null, new Date()],
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("d1-request error", err);
    return res.status(500).json({ message: "Failed to submit request" });
  }
});

// Dashboard: list all leads (sales closure submissions); MMT executives only see leads they're assigned to
app.get("/api/leads/queue", async (req: Request, res: Response) => {
  const now = new Date();
  try {
    await pool.query(
      "UPDATE leads SET is_on_hold = 0, resume_at = NULL, update_at = ? WHERE is_on_hold = 1 AND resume_at IS NOT NULL AND resume_at <= ?",
      [now, now],
    );

    const user = await getUserFromSession(req);
    const role = (user?.role ?? "").toLowerCase();

    if (role === "mmt_executive" && user) {
      const userId = user.id;
      if (!userId) return res.json([]);
      const [rows] = await pool.query(
        `SELECT l.id, l.pid, l.project_name as projectName, l.project_stage as projectStage,
                l.contact_no as contactNo, l.client_email as clientEmail,
                l.is_on_hold as isOnHold, l.resume_at as resumeAt,
                l.create_at as createAt, l.update_at as updateAt
         FROM leads l
         INNER JOIN lead_d1_assignments a ON a.lead_id = l.id AND a.assigned_to_user_id = ?
         ORDER BY l.id ASC`,
        [userId],
      );
      const list = (rows as any[]).map((r) => ({ ...r, isOnHold: !!r.isOnHold }));
      return res.json(list);
    }

    const [rows] = await pool.query(
      `SELECT id, pid, project_name as projectName, project_stage as projectStage,
              contact_no as contactNo, client_email as clientEmail,
              is_on_hold as isOnHold, resume_at as resumeAt,
              create_at as createAt, update_at as updateAt
       FROM leads
       ORDER BY id ASC`,
    );
    const list = (rows as any[]).map((r) => ({
      ...r,
      isOnHold: !!r.isOnHold,
    }));
    res.json(list);
  } catch (err) {
    console.error("leads/queue error", err);
    res.status(500).json({ message: "Failed to load leads" });
  }
});

// Designers for Sales Closure form
app.get("/api/designers", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, lead_name as leadName FROM designers ORDER BY name ASC",
    );
    res.json(rows);
  } catch (err) {
    console.error("designers error", err);
    res.status(500).json({ message: "Failed to load designers" });
  }
});

// Lead detail by id (for /Leads/[id]); MMT executives only get leads they're assigned to
app.get("/api/leads/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  try {
    const user = await getUserFromSession(req);
    const role = (user?.role ?? "").toLowerCase();

    const [rows] = await pool.query(
      `SELECT id, pid, project_name as projectName, project_stage as projectStage,
              contact_no as contactNo, client_email as clientEmail,
              is_on_hold as isOnHold, resume_at as resumeAt,
              create_at as createAt, update_at as updateAt
       FROM leads
       WHERE id = ?`,
      [id],
    );
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ message: "Lead not found" });

    if (role === "mmt_executive" && user) {
      const [assignRows] = await pool.query(
        "SELECT 1 FROM lead_d1_assignments WHERE lead_id = ? AND assigned_to_user_id = ?",
        [id, user.id],
      );
      if ((assignRows as any[]).length === 0) {
        return res.status(404).json({ message: "Lead not found" });
      }
    }

    // auto-resume if date is reached
    if (row.isOnHold && row.resumeAt && new Date(row.resumeAt) <= new Date()) {
      await pool.query(
        "UPDATE leads SET is_on_hold = 0, resume_at = NULL, update_at = ? WHERE id = ?",
        [new Date(), id],
      );
      row.isOnHold = 0;
      row.resumeAt = null;
    }

    return res.json({
      ...row,
      isOnHold: !!row.isOnHold,
    });
  } catch (err) {
    console.error("lead detail error", err);
    return res.status(500).json({ message: "Failed to load lead" });
  }
});

// Put project on hold until a given date
app.post("/api/leads/:id/hold", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  const { resumeAt } = req.body as { resumeAt?: string };
  if (!resumeAt)
    return res.status(400).json({ message: "resumeAt is required" });

  const date = new Date(resumeAt);
  if (Number.isNaN(date.getTime()))
    return res.status(400).json({ message: "Invalid resumeAt date" });

  try {
    const [rows] = await pool.query(
      "SELECT id FROM leads WHERE id = ?",
      [id],
    );
    const lead = (rows as any[])[0];
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    await pool.query(
      "UPDATE leads SET is_on_hold = 1, resume_at = ?, update_at = ? WHERE id = ?",
      [date, new Date(), id],
    );

    res.json({
      success: true,
      message: "Project put on hold",
      resumeAt: date.toISOString(),
    });
  } catch (err) {
    console.error("hold error", err);
    res.status(500).json({ message: "Failed to put project on hold" });
  }
});

// Resume project immediately (override any hold)
app.post("/api/leads/:id/resume", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  try {
    const [rows] = await pool.query(
      "SELECT id FROM leads WHERE id = ?",
      [id],
    );
    const lead = (rows as any[])[0];
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    await pool.query(
      "UPDATE leads SET is_on_hold = 0, resume_at = NULL, update_at = ? WHERE id = ?",
      [new Date(), id],
    );

    res.json({ success: true, message: "Project resumed" });
  } catch (err) {
    console.error("resume error", err);
    res.status(500).json({ message: "Failed to resume project" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("POST /api/auth/create-mmt-manager and POST /api/auth/register-mmt-executive are registered");
});
