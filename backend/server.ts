import express, { Request, Response } from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
      CREATE TABLE IF NOT EXISTS designers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        lead_name VARCHAR(255) NOT NULL
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

// Dashboard: list all leads (sales closure submissions)
app.get("/api/leads/queue", async (req: Request, res: Response) => {
  const now = new Date();
  try {
    await pool.query(
      "UPDATE leads SET is_on_hold = 0, resume_at = NULL, update_at = ? WHERE is_on_hold = 1 AND resume_at IS NOT NULL AND resume_at <= ?",
      [now, now],
    );

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

// Lead detail by id (for /Leads/[id])
app.get("/api/leads/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  try {
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
});
