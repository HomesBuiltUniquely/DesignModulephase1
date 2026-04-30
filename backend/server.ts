import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import AdmZip from "adm-zip";
import * as XLSX from "xlsx";
import { registerCustomerNumberRoutes } from "./routes/customerNumberApi";
import { registerProlanceRoutes } from "./routes/prolanceApi";

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const app = express();
const PORT = Number(process.env.PORT || 3001);

/** Browsers send Origin on cross-origin requests; preflight must allow the exact origin (incl. www). */
function buildAllowedOrigins(): string[] {
  const fromEnv = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [
    "https://design.hubinterior.com",
    "https://www.design.hubinterior.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
  const set = new Set<string>([...defaults, ...fromEnv]);
  const fe = (process.env.FRONTEND_BASE_URL || "").replace(/\/$/, "");
  if (fe.startsWith("http://") || fe.startsWith("https://")) set.add(fe);
  return Array.from(set);
}

let allowedOrigins = buildAllowedOrigins();

function reflectCorsHeaders(req: Request, res: Response): void {
  const origin = req.headers.origin;
  if (typeof origin === "string" && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.append("Vary", "Origin");
  }
}

/**
 * Explicit OPTIONS handler *before* cors(): multipart + Authorization triggers a preflight.
 * If anything in the stack mishandles OPTIONS, the browser shows a generic CORS error on the real POST.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "OPTIONS") return next();
  const origin = req.headers.origin;
  if (typeof origin !== "string" || !allowedOrigins.includes(origin)) return next();
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Prolance-Token, X-Prolance-Origin-Session, X-Prolance-Api-Key, X-External-Api-Key",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
  return res.status(204).end();
});

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      console.warn("CORS: blocked origin:", origin, "| allowed count:", allowedOrigins.length);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "X-Prolance-Token",
      "X-Prolance-Origin-Session",
      "X-Prolance-Api-Key",
      "X-External-Api-Key",
    ],
    optionsSuccessStatus: 204,
  })
);
// Allow large DQC submissions and uploads (drawing + quotation can be big)
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// ----- MySQL setup -----
// Defaults are set from the credentials you provided; you can still override via env vars if needed.
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Root@123",
  database: process.env.DB_NAME || "DesignMod",
  port: Number(process.env.DB_PORT || 3306),
  connectionLimit: 10,
});

// Standalone route: /api/customer/:customerNumber (see routes/customerNumberApi.ts)
registerCustomerNumberRoutes(app, pool);

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

// Local profile images when S3 is not configured
const PROFILE_IMAGES_DIR = path.join(UPLOADS_DIR, "profile-images");
if (!fs.existsSync(PROFILE_IMAGES_DIR)) fs.mkdirSync(PROFILE_IMAGES_DIR, { recursive: true });
const API_BASE = process.env.API_BASE_URL || "http://localhost:3001";
const FRONTEND_BASE = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
const ERP_BASE_URL = process.env.ERP_BASE_URL || "https://hows.hubinterior.com";
const ERP_USERNAME = process.env.ERP_USERNAME || "admin@hubinterior.com";
const ERP_PASSWORD = process.env.ERP_PASSWORD || "admin123";

let cachedErpToken: string | null = null;

async function getErpToken(forceRefresh = false): Promise<string | null> {
  if (cachedErpToken && !forceRefresh) return cachedErpToken;

  try {
    let res = await fetch(`${ERP_BASE_URL}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: ERP_USERNAME, password: ERP_PASSWORD })
    });

    if (!res.ok) {
      res = await fetch(`${ERP_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: ERP_USERNAME, password: ERP_PASSWORD })
      });
    }

    if (res.ok) {
      const data = await res.json();
      cachedErpToken = data.accessToken || data.token || data.jwt || null;
      return cachedErpToken;
    }
    
    console.error("Failed to login to ERP:", await res.text());
    return null;
  } catch (err) {
    console.error("Error logging into ERP:", err);
    return null;
  }
}

async function fetchFromErpWithRetry(endpoint: string) {
  let token = await getErpToken();
  if (!token) throw new Error("Could not get ERP auth token");

  let res = await fetch(`${ERP_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 401) {
    token = await getErpToken(true);
    if (!token) throw new Error("Could not refresh ERP auth token");
    
    res = await fetch(`${ERP_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  if (!res.ok) throw new Error(`ERP API error: ${res.status}`);
  return res.json();
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${API_BASE}/api/google-calendar/oauth/callback`;
const GOOGLE_SCOPE =
  process.env.GOOGLE_CALENDAR_SCOPE ||
  "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email openid profile";
const GOOGLE_AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
const GOOGLE_EVENTS_URI = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GOOGLE_USERINFO_URI = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_TIME_ZONE = "Asia/Kolkata";
const GOOGLE_SHARED_EVENT_PROPERTY_KEY = "source";
const GOOGLE_SHARED_EVENT_PROPERTY_VALUE = "Project-ERP";

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

async function uploadProfileImage(userId: number, dataUrl: string): Promise<string> {
  const { buffer, contentType, ext } = parseDataUrl(dataUrl);
  const filename = `user-${userId}-${Date.now()}.${ext}`;

  if (process.env.AWS_ACCESS_KEY_ID) {
    const key = `profile-images/${filename}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  }

  // No AWS credentials: save locally and return URL for our API to serve
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(PROFILE_IMAGES_DIR, safeName);
  fs.writeFileSync(filePath, buffer);
  return `${API_BASE}/api/profile-images/${safeName}`;
}

/** Upload a lead file to S3; returns public URL or null if S3 not configured. */
/** Stream S3 GetObject body to Express response (avoids loading large PDFs into one Buffer). */
async function pipeS3BodyToResponse(res: Response, body: unknown): Promise<void> {
  const stream = body as Readable | null;
  if (!stream || typeof stream.pipe !== "function") {
    throw new Error("S3 object has no readable body");
  }
  await pipeline(stream, res);
}

async function uploadLeadFileToS3(leadId: number, filePath: string, originalName: string, mimeType?: string): Promise<string | null> {
  if (!process.env.AWS_ACCESS_KEY_ID) return null;
  try {
    const buf = fs.readFileSync(filePath);
    const safe = (originalName || path.basename(filePath)).replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `lead-uploads/lead-${leadId}-${Date.now()}-${safe}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buf,
        ContentType: mimeType || "application/octet-stream",
      }),
    );
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  } catch (err) {
    console.error("uploadLeadFileToS3 error", err);
    return null;
  }
}

/** Public URL for a key (same pattern as uploadLeadFileToS3). */
function buildS3PublicUrl(key: string): string {
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

/** Copy object from S3 to local disk (mirrors multer so zip/list/download paths keep working). */
async function streamS3ObjectToDisk(key: string, destPath: string): Promise<void> {
  const obj = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  const body = obj.Body as Readable;
  if (!body || typeof body.pipe !== "function") throw new Error("S3 object has no body");
  await pipeline(body, fs.createWriteStream(destPath));
}

function buildMailChainSubject(
  idOrPid?: string | number | null,
  projectName?: string | null,
  customerName?: string | null,
): string {
  const name = customerName || projectName || "CUSTOMER";
  // The user requested the format: HUB [Client Name] DESIGN JOURNEY
  return `HUB ${name.toUpperCase()} DESIGN JOURNEY`.replace(/\s+/g, " ").trim();
}

async function getMailLoopCcEmails(extraEmails: Array<string | null | undefined> = []): Promise<string[]> {
  const validExtras = extraEmails.filter(Boolean) as string[];

  const [teamRows] = await pool.query(
    "SELECT email FROM users WHERE role IN ('admin','territorial_design_manager') AND email IS NOT NULL",
  );
  let teamEmails = (teamRows as { email: string | null }[]).map((r) => r.email || null);

  if (validExtras.length > 0) {
    const [dmRows] = await pool.query(
      `SELECT dm.email 
       FROM users u 
       JOIN users dm ON dm.id = u.design_manager_id 
       WHERE u.email IN (?) AND dm.email IS NOT NULL`,
      [validExtras]
    );
    const dmEmails = (dmRows as { email: string | null }[]).map((r) => r.email || null);
    teamEmails = [...teamEmails, ...dmEmails];
  }

  return distinctEmails([...validExtras, ...teamEmails]);
}

type MailVisibility = "internal" | "external" | "internal+external";

async function triggerMailRouteWithLog(args: {
  leadId: number;
  milestoneIndex?: number;
  taskName: string;
  route: string;
  visibility: MailVisibility;
  payload: Record<string, unknown>;
}): Promise<void> {
  const toRaw = args.payload.to;
  const ccRaw = args.payload.cc;
  const to = Array.isArray(toRaw) ? toRaw.map(String) : toRaw ? [String(toRaw)] : [];
  const cc = Array.isArray(ccRaw) ? ccRaw.map(String) : ccRaw ? [String(ccRaw)] : [];

  console.log("[mail-trigger]", {
    leadId: args.leadId,
    milestoneIndex: args.milestoneIndex ?? null,
    taskName: args.taskName,
    route: args.route,
    visibility: args.visibility,
    to,
    cc,
  });

  try {
    const resp = await fetch(`${FRONTEND_BASE}${args.route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args.payload),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error("[mail-trigger-failed]", {
        leadId: args.leadId,
        route: args.route,
        status: resp.status,
        taskName: args.taskName,
        visibility: args.visibility,
        body,
      });
      return;
    }
    console.log("[mail-trigger-sent]", {
      leadId: args.leadId,
      route: args.route,
      taskName: args.taskName,
      visibility: args.visibility,
      to,
      cc,
    });
  } catch (error) {
    console.error("[mail-trigger-error]", {
      leadId: args.leadId,
      route: args.route,
      taskName: args.taskName,
      visibility: args.visibility,
      error,
    });
  }
}

async function triggerCustomerEmailForLead(
  leadId: number,
  emailRoutePath: string,
  opts?: { actorEmail?: string | null },
): Promise<void> {
  try {
    const [rows] = await pool.query(
      `SELECT l.pid as projectPid,
              l.project_name as projectName,
              l.client_email as clientEmail,
              l.client_email_alt as alternateClientEmail,
              l.payload,
              u.name as designerName,
              u.email as designerEmail
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_designer_id
       WHERE l.id = ?`,
      [leadId],
    );
    const row = (rows as any[])[0];
    if (!row) return;

    let payload: any = {};
    try {
      payload = row.payload ? JSON.parse(row.payload) : {};
    } catch {
      payload = {};
    }

    const customerEmail =
      row.clientEmail ||
      row.alternateClientEmail ||
      payload.email ||
      payload?.form?.email ||
      null;
    const customerName =
      payload.customer_name ||
      payload?.form?.customer_name ||
      row.projectName ||
      "Customer";
    const designerName =
      row.designerName ||
      payload?.designer_name ||
      payload?.designerName ||
      payload?.form?.designer_name ||
      payload?.form?.designerName ||
      "Designer";
    const mailChainCc = await getMailLoopCcEmails([
      opts?.actorEmail || null,
      row.designerEmail || null,
    ]);
    const mailChainSubject = buildMailChainSubject(
      row.projectPid || null,
      row.projectName || null,
      customerName,
    );

    if (!customerEmail) return;

    // Fire-and-forget; do not block backend response
    void triggerMailRouteWithLog({
      leadId,
      taskName: "customer-email-trigger",
      route: emailRoutePath,
      visibility: "external",
      payload: {
        to: customerEmail,
        cc: mailChainCc,
        subject: mailChainSubject,
        customerName,
        designerName,
        leadPayload: payload,
      },
    });
  } catch (err) {
    console.error("triggerCustomerEmailForLead error", { leadId, route: emailRoutePath, error: err });
  }
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
    // Add design_manager_id for mapping designers to their design manager (id in users table)
    try {
      const [mgrCol] = await conn.query(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'design_manager_id'",
      );
      if ((mgrCol as any[]).length === 0) {
        await conn.query(
          "ALTER TABLE users ADD COLUMN design_manager_id INT NULL",
        );
      }
    } catch {
      // ignore
    }
    // Add mmt_manager_id for mapping MMT executives to their manager
    try {
      const [mmtMgrCol] = await conn.query(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'mmt_manager_id'",
      );
      if ((mmtMgrCol as any[]).length === 0) {
        await conn.query(
          "ALTER TABLE users ADD COLUMN mmt_manager_id INT NULL",
        );
      }
    } catch {
      // ignore
    }
    // Add territorial_design_manager_id for mapping design managers to their TDM
    try {
      const [tdmMgrCol] = await conn.query(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'territorial_design_manager_id'",
      );
      if ((tdmMgrCol as any[]).length === 0) {
        await conn.query(
          "ALTER TABLE users ADD COLUMN territorial_design_manager_id INT NULL",
        );
      }
    } catch {
      // ignore
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id INT NOT NULL,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS google_calendar_connections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        google_email VARCHAR(255) NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NULL,
        expires_at DATETIME NULL,
        scope TEXT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
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
        assigned_designer_id INT NULL,
        is_on_hold TINYINT(1) DEFAULT 0,
        resume_at DATETIME NULL,
        create_at DATETIME NOT NULL,
        update_at DATETIME NOT NULL,
        payload MEDIUMTEXT NOT NULL
      );
    `);

    // Existing deployments may still have TEXT; upgrade to MEDIUMTEXT so base64 image payloads fit.
    await conn.query(`
      ALTER TABLE leads
      MODIFY COLUMN payload MEDIUMTEXT NOT NULL
    `);

    // Add assigned_designer_id if missing (mapping leads to designers)
    try {
      const [designerCol] = await conn.query(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'assigned_designer_id'",
      );
      if ((designerCol as any[]).length === 0) {
        await conn.query(
          "ALTER TABLE leads ADD COLUMN assigned_designer_id INT NULL",
        );
      }
    } catch {
      // ignore
    }

    try {
      const [altEmailCol] = await conn.query(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'client_email_alt'",
      );
      if ((altEmailCol as any[]).length === 0) {
        await conn.query(
          "ALTER TABLE leads ADD COLUMN client_email_alt VARCHAR(255) NULL",
        );
      }
    } catch {
      // ignore
    }

    try {
      const [pmCol] = await conn.query(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'assigned_project_manager_id'",
      );
      if ((pmCol as any[]).length === 0) {
        await conn.query(
          "ALTER TABLE leads ADD COLUMN assigned_project_manager_id INT NULL",
        );
      }
    } catch {
      // ignore
    }

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
    try {
      const [typeCol] = await conn.query(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_uploads' AND COLUMN_NAME = 'upload_type'"
      );
      if ((typeCol as any[]).length === 0) {
        await conn.query("ALTER TABLE lead_uploads ADD COLUMN upload_type VARCHAR(20) NULL");
      }
    } catch {
      // ignore
    }
    try {
      const [s3Col] = await conn.query(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_uploads' AND COLUMN_NAME = 's3_url'"
      );
      if ((s3Col as any[]).length === 0) {
        await conn.query("ALTER TABLE lead_uploads ADD COLUMN s3_url TEXT NULL");
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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS lead_d2_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        assigned_to_user_id INT NOT NULL,
        masking_date DATE,
        masking_time VARCHAR(20),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS lead_dqc_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        verdict VARCHAR(50) NOT NULL,
        remarks JSON NOT NULL,
        created_at DATETIME NOT NULL,
        reviewed_by_user_id INT NULL
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS lead_dqc_remark_resolutions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        dqc_review_id INT NOT NULL,
        remark_index INT NOT NULL,
        resolved_at DATETIME NOT NULL,
        resolved_by_user_id INT NULL,
        UNIQUE KEY uniq_resolution (dqc_review_id, remark_index)
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS customer_api_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_number VARCHAR(100) NOT NULL,
        payload JSON NOT NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_customer_api_records_number (customer_number)
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
  const formData = payload?.formData || payload?.form_data || payload || {};
  const fetched = payload?.fetchedData || formData || {};
  const projectName =
    formData.customer_name ||
    fetched.customer_name ||
    formData.sales_lead_name ||
    fetched.sales_lead_name ||
    "Unnamed";
  const payment =
    formData.payment_received || payload?.payment_received || "";
  const stage =
    payment === "FULL_10%"
      ? "10-20%"
      : payment === "PARTIAL" || payment === "TOKEN"
        ? "Pre 10%"
        : formData.status_of_project || payload?.status_of_project || "Active";

  return {
    pid: "", // you can generate a PID here if needed
    projectName,
    projectStage: stage,
    contactNo: formData.co_no || fetched.co_no || null,
    clientEmail: formData.email || fetched.email || null,
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

type SessionUser = Awaited<ReturnType<typeof getUserFromSession>>;

type GoogleCalendarConnectionRow = {
  id: number;
  user_id: number;
  google_email: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: Date | string | null;
  scope: string | null;
  active: number;
};

function normalizeEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isGoogleCalendarConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

function buildGoogleCalendarRedirect(status: "success" | "error", message?: string) {
  const url = new URL("/google-calendar", FRONTEND_BASE);
  url.searchParams.set("gc_status", status);
  if (message) url.searchParams.set("gc_message", message);
  return url.toString();
}

function buildGoogleCalendarAuthUrl(userId: number) {
  if (!isGoogleCalendarConfigured()) return null;
  const url = new URL(GOOGLE_AUTH_URI);
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", GOOGLE_SCOPE);
  url.searchParams.set("state", `${userId}:${Date.now()}`);
  return url.toString();
}

function parseGoogleState(state?: string | null) {
  const raw = (state || "").trim();
  const userId = Number(raw.split(":")[0]);
  return Number.isFinite(userId) ? userId : null;
}

function formatGoogleDateTime(meetingDate?: string | null, meetingTime?: string | null) {
  if (!meetingDate || !meetingTime) return null;
  const time = /^\d{2}:\d{2}$/.test(meetingTime) ? `${meetingTime}:00` : meetingTime;
  const iso = `${meetingDate}T${time}+05:30`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function addHoursToIso(iso: string, hours: number) {
  const parsed = new Date(iso);
  parsed.setHours(parsed.getHours() + hours);
  return parsed.toISOString();
}

function distinctEmails(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const email = normalizeEmail(value);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    output.push(email);
  }
  return output;
}

async function getUserById(userId: number) {
  const [rows] = await pool.query(
    "SELECT id, email, name, role FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  return ((rows as any[])[0] || null) as
    | { id: number; email: string; name: string; role: string }
    | null;
}

async function getGoogleConnectionByUserId(userId: number) {
  const [rows] = await pool.query(
    `SELECT id, user_id, google_email, access_token, refresh_token, expires_at, scope, active
     FROM google_calendar_connections
     WHERE user_id = ? AND active = 1
     LIMIT 1`,
    [userId],
  );
  return ((rows as any[])[0] || null) as GoogleCalendarConnectionRow | null;
}

function canAccessHubCalendar(role: string | null | undefined) {
  const normalizedRole = (role || "").toLowerCase();
  return (
    normalizedRole === "admin" ||
    normalizedRole === "deputy_general_manager" ||
    normalizedRole === "territorial_design_manager" ||
    normalizedRole === "design_manager" ||
    normalizedRole === "designer"
  );
}

function canViewAllHubCalendarEvents(role: string | null | undefined) {
  const normalizedRole = (role || "").toLowerCase();
  return normalizedRole === "admin" || normalizedRole === "deputy_general_manager";
}

async function getCalendarVisibleUsers(currentUser: { id: number; email: string; name: string; role: string }) {
  const role = (currentUser.role || "").toLowerCase();

  if (role === "admin" || role === "deputy_general_manager") {
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.email, u.name, u.role
       FROM users u
       INNER JOIN google_calendar_connections gcc ON gcc.user_id = u.id
       WHERE gcc.active = 1
       ORDER BY u.name ASC`,
    );
    return rows as { id: number; email: string; name: string; role: string }[];
  }

  if (role === "territorial_design_manager") {
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.email, u.name, u.role
       FROM users u
       INNER JOIN google_calendar_connections gcc ON gcc.user_id = u.id
       LEFT JOIN users dm ON dm.id = u.design_manager_id
       WHERE gcc.active = 1
         AND (
           u.id = ?
           OR (u.role = 'design_manager' AND u.territorial_design_manager_id = ?)
           OR (u.role = 'designer' AND dm.territorial_design_manager_id = ?)
         )
       ORDER BY u.name ASC`,
      [currentUser.id, currentUser.id, currentUser.id],
    );
    return rows as { id: number; email: string; name: string; role: string }[];
  }

  if (role === "design_manager") {
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.email, u.name, u.role
       FROM users u
       INNER JOIN google_calendar_connections gcc ON gcc.user_id = u.id
       WHERE gcc.active = 1
         AND (u.id = ? OR (u.role = 'designer' AND u.design_manager_id = ?))
       ORDER BY u.name ASC`,
      [currentUser.id, currentUser.id],
    );
    return rows as { id: number; email: string; name: string; role: string }[];
  }

  return [currentUser];
}

async function exchangeGoogleCodeForTokens(code: string) {
  const body = new URLSearchParams();
  body.set("code", code);
  body.set("client_id", GOOGLE_CLIENT_ID);
  body.set("client_secret", GOOGLE_CLIENT_SECRET);
  body.set("redirect_uri", GOOGLE_REDIRECT_URI);
  body.set("grant_type", "authorization_code");

  const response = await fetch(GOOGLE_TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || "Failed to exchange Google authorization code");
  }
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

async function refreshGoogleAccessToken(connection: GoogleCalendarConnectionRow) {
  if (!connection.refresh_token) {
    throw new Error("Google refresh token missing. Please reconnect Google Calendar.");
  }

  const body = new URLSearchParams();
  body.set("client_id", GOOGLE_CLIENT_ID);
  body.set("client_secret", GOOGLE_CLIENT_SECRET);
  body.set("refresh_token", connection.refresh_token);
  body.set("grant_type", "refresh_token");

  const response = await fetch(GOOGLE_TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "Failed to refresh Google access token");
  }

  const expiresAt =
    data.expires_in && Number.isFinite(Number(data.expires_in))
      ? new Date(Date.now() + Number(data.expires_in) * 1000)
      : null;

  await pool.query(
    `UPDATE google_calendar_connections
     SET access_token = ?, expires_at = ?, scope = COALESCE(?, scope), updated_at = ?
     WHERE id = ?`,
    [data.access_token, expiresAt, data.scope || null, new Date(), connection.id],
  );

  return {
    ...connection,
    access_token: data.access_token as string,
    expires_at: expiresAt,
    scope: (data.scope as string | undefined) || connection.scope,
  };
}

async function ensureValidGoogleConnection(userId: number) {
  const connection = await getGoogleConnectionByUserId(userId);
  if (!connection) return null;

  const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null;
  const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() + 60_000 : false;
  if (!isExpired) return connection;
  return refreshGoogleAccessToken(connection);
}

async function fetchGoogleUserEmail(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URI, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Failed to read Google account email");
  }
  return normalizeEmail(data?.email || "");
}

async function upsertGoogleConnection(args: {
  userId: number;
  googleEmail: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number;
  scope?: string | null;
}) {
  const now = new Date();
  const expiresAt =
    args.expiresIn && Number.isFinite(Number(args.expiresIn))
      ? new Date(Date.now() + Number(args.expiresIn) * 1000)
      : null;

  await pool.query(
    `INSERT INTO google_calendar_connections
      (user_id, google_email, access_token, refresh_token, expires_at, scope, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON DUPLICATE KEY UPDATE
      google_email = VALUES(google_email),
      access_token = VALUES(access_token),
      refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
      expires_at = VALUES(expires_at),
      scope = VALUES(scope),
      active = 1,
      updated_at = VALUES(updated_at)`,
    [
      args.userId,
      args.googleEmail,
      args.accessToken,
      args.refreshToken || null,
      expiresAt,
      args.scope || null,
      now,
      now,
    ],
  );
}

async function fetchGoogleEventsForConnection(
  connection: GoogleCalendarConnectionRow,
  owner: { id: number; email: string; name: string; role: string },
  timeMin?: string | null,
  timeMax?: string | null,
) {
  const url = new URL(GOOGLE_EVENTS_URI);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  url.searchParams.set(
    "sharedExtendedProperty",
    `${GOOGLE_SHARED_EVENT_PROPERTY_KEY}=${GOOGLE_SHARED_EVENT_PROPERTY_VALUE}`,
  );
  if (timeMin) url.searchParams.set("timeMin", new Date(timeMin).toISOString());
  if (timeMax) url.searchParams.set("timeMax", new Date(timeMax).toISOString());

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${connection.access_token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Failed to fetch Google Calendar events");
  }

  return ((data?.items as any[]) || []).map((event) => ({
    id: event.id,
    summary: event.summary || "Untitled event",
    description: event.description || "",
    htmlLink: event.htmlLink || "",
    status: event.status || "confirmed",
    location: event.location || "",
    start: event.start?.dateTime || event.start?.date || null,
    end: event.end?.dateTime || event.end?.date || null,
    attendees: Array.isArray(event.attendees)
      ? event.attendees.map((attendee: any) => ({
        email: attendee.email || "",
        displayName: attendee.displayName || "",
        responseStatus: attendee.responseStatus || "",
      }))
      : [],
    ownerUserId: owner.id,
    ownerName: owner.name,
    ownerEmail: owner.email,
    ownerRole: owner.role,
    connectedGoogleEmail: connection.google_email,
  }));
}

async function createGoogleCalendarEventForUser(args: {
  userId: number;
  summary: string;
  description?: string;
  startDateTimeIso: string;
  endDateTimeIso: string;
  attendees?: string[];
}) {
  const connection = await ensureValidGoogleConnection(args.userId);
  if (!connection) return null;

  const response = await fetch(`${GOOGLE_EVENTS_URI}?sendUpdates=all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: args.summary,
      description: args.description || "",
      start: { dateTime: args.startDateTimeIso, timeZone: GOOGLE_TIME_ZONE },
      end: { dateTime: args.endDateTimeIso, timeZone: GOOGLE_TIME_ZONE },
      attendees: (args.attendees || []).map((email) => ({ email })),
      extendedProperties: {
        shared: {
          [GOOGLE_SHARED_EVENT_PROPERTY_KEY]: GOOGLE_SHARED_EVENT_PROPERTY_VALUE,
        },
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Failed to create Google Calendar event");
  }
  return data as { id?: string; htmlLink?: string };
}

async function createGoogleCalendarEventForFirstAvailableUser(args: {
  userIds: Array<number | null | undefined>;
  summary: string;
  description?: string;
  startDateTimeIso: string;
  endDateTimeIso: string;
  attendees?: string[];
}) {
  let lastError: unknown = null;
  for (const rawUserId of args.userIds) {
    const userId = Number(rawUserId);
    if (!userId) continue;
    try {
      const event = await createGoogleCalendarEventForUser({
        userId,
        summary: args.summary,
        description: args.description,
        startDateTimeIso: args.startDateTimeIso,
        endDateTimeIso: args.endDateTimeIso,
        attendees: args.attendees,
      });
      if (event) {
        return { ...event, ownerUserId: userId };
      }
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return null;
}

function normalizeHeaderKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function canImportLeads(role: string | null | undefined): boolean {
  const r = (role || "").toLowerCase();
  return r === "admin" || r === "territorial_design_manager" || r === "deputy_general_manager" || r === "design_manager";
}

function canAssignLeads(role: string | null | undefined): boolean {
  const r = (role || "").toLowerCase();
  return r === "admin" || r === "territorial_design_manager" || r === "deputy_general_manager" || r === "design_manager";
}

/** Who may pick the project manager on a lead (after DQC 2 approval). */
function canAssignProjectManagerRole(role: string | null | undefined): boolean {
  const r = (role || "").toLowerCase();
  return (
    r === "admin" ||
    r === "territorial_design_manager" ||
    r === "deputy_general_manager" ||
    r === "senior_project_manager"
  );
}

type ImportedPreview = {
  createdAt: number;
  rows: Record<string, unknown>[];
  headers: string[];
};

const excelImportPreviewStore = new Map<string, ImportedPreview>();
const EXCEL_PREVIEW_TTL_MS = 30 * 60 * 1000;

function saveExcelPreview(rows: Record<string, unknown>[], headers: string[]): string {
  const token = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  excelImportPreviewStore.set(token, { createdAt: Date.now(), rows, headers });
  // Best-effort cleanup of expired previews.
  for (const [k, v] of excelImportPreviewStore.entries()) {
    if (Date.now() - v.createdAt > EXCEL_PREVIEW_TTL_MS) excelImportPreviewStore.delete(k);
  }
  return token;
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

app.post("/api/auth/change-password", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    const [rows] = await pool.query(
      "SELECT password FROM users WHERE id = ?",
      [user.id],
    );
    const row = (rows as any[])[0];
    if (!row || row.password !== String(currentPassword)) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    await pool.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [String(newPassword), user.id],
    );

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("change-password error", err);
    return res.status(500).json({ message: "Failed to change password" });
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

app.get("/api/google-calendar/connect-url", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!canAccessHubCalendar(user.role)) {
      return res.status(403).json({ message: "You do not have access to HUB Calendar." });
    }
    if (!isGoogleCalendarConfigured()) {
      return res.status(400).json({ message: "Google Calendar is not configured on the backend." });
    }
    const authUrl = buildGoogleCalendarAuthUrl(user.id);
    if (!authUrl) {
      return res.status(400).json({ message: "Failed to generate Google connect URL." });
    }
    return res.json({ authUrl });
  } catch (err) {
    console.error("google-calendar connect-url error", err);
    return res.status(500).json({ message: "Failed to generate Google connect URL" });
  }
});

app.get("/api/google-calendar/oauth/callback", async (req: Request, res: Response) => {
  const code = String(req.query.code || "");
  const error = String(req.query.error || "");
  const state = String(req.query.state || "");
  if (error) return res.redirect(buildGoogleCalendarRedirect("error", error));

  try {
    if (!code) {
      return res.redirect(buildGoogleCalendarRedirect("error", "Missing Google authorization code."));
    }
    const userId = parseGoogleState(state);
    if (!userId) {
      return res.redirect(buildGoogleCalendarRedirect("error", "Invalid Google connection state."));
    }
    const user = await getUserById(userId);
    if (!user) {
      return res.redirect(buildGoogleCalendarRedirect("error", "User not found for Google connection."));
    }

    const tokenData = await exchangeGoogleCodeForTokens(code);
    const googleEmail = await fetchGoogleUserEmail(tokenData.access_token);
    if (!googleEmail || normalizeEmail(user.email) !== googleEmail) {
      return res.redirect(
        buildGoogleCalendarRedirect(
          "error",
          `Please connect the same Google email as your module login (${user.email}).`,
        ),
      );
    }

    await upsertGoogleConnection({
      userId: user.id,
      googleEmail,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope || GOOGLE_SCOPE,
    });

    return res.redirect(buildGoogleCalendarRedirect("success", "Google Calendar connected successfully."));
  } catch (err: any) {
    console.error("google-calendar callback error", err);
    return res.redirect(buildGoogleCalendarRedirect("error", err?.message || "Failed to connect Google Calendar."));
  }
});

app.get("/api/google-calendar/status", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!canAccessHubCalendar(user.role)) {
      return res.status(403).json({ message: "You do not have access to HUB Calendar." });
    }
    const connection = await getGoogleConnectionByUserId(user.id);
    return res.json({
      configured: isGoogleCalendarConfigured(),
      connected: Boolean(connection),
      googleEmail: connection?.google_email || null,
      expiresAt: connection?.expires_at || null,
    });
  } catch (err) {
    console.error("google-calendar status error", err);
    return res.status(500).json({ message: "Failed to load Google Calendar status" });
  }
});

app.post("/api/google-calendar/disconnect", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!canAccessHubCalendar(user.role)) {
      return res.status(403).json({ message: "You do not have access to HUB Calendar." });
    }
    await pool.query(
      "UPDATE google_calendar_connections SET active = 0, updated_at = ? WHERE user_id = ?",
      [new Date(), user.id],
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("google-calendar disconnect error", err);
    return res.status(500).json({ message: "Failed to disconnect Google Calendar" });
  }
});

app.get("/api/google-calendar/my-events", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!canAccessHubCalendar(user.role)) {
      return res.status(403).json({ message: "You do not have access to HUB Calendar." });
    }
    const visibleUsers = await getCalendarVisibleUsers(user);
    const allEvents: any[] = [];

    for (const visibleUser of visibleUsers) {
      try {
        const connection = await ensureValidGoogleConnection(visibleUser.id);
        if (!connection) continue;

        const events = await fetchGoogleEventsForConnection(
          connection,
          { id: visibleUser.id, email: visibleUser.email, name: visibleUser.name, role: visibleUser.role },
          (req.query.timeMin as string | undefined) || null,
          (req.query.timeMax as string | undefined) || null,
        );
        allEvents.push(...events);
      } catch (innerErr) {
        console.error("google-calendar my-events user fetch error", {
          userId: visibleUser.id,
          error: innerErr,
        });
      }
    }

    allEvents.sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
    return res.json({ events: allEvents });
  } catch (err: any) {
    console.error("google-calendar my-events error", err);
    return res.status(500).json({ message: err?.message || "Failed to load Google Calendar events" });
  }
});

app.get("/api/google-calendar/all-events", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!canViewAllHubCalendarEvents(user.role)) {
      return res.status(403).json({ message: "Only admin or Deputy General Manager can view all calendar events." });
    }

    const [rows] = await pool.query(
      `SELECT gcc.id, gcc.user_id, gcc.google_email, gcc.access_token, gcc.refresh_token, gcc.expires_at, gcc.scope, gcc.active,
              u.email as user_email, u.name as user_name, u.role as user_role
       FROM google_calendar_connections gcc
       INNER JOIN users u ON u.id = gcc.user_id
       WHERE gcc.active = 1
       ORDER BY u.name ASC`,
    );

    const allEvents: any[] = [];
    for (const row of rows as any[]) {
      try {
        const connection = await ensureValidGoogleConnection(row.user_id);
        if (!connection) continue;
        const events = await fetchGoogleEventsForConnection(
          connection,
          { id: row.user_id, email: row.user_email, name: row.user_name, role: row.user_role },
          (req.query.timeMin as string | undefined) || null,
          (req.query.timeMax as string | undefined) || null,
        );
        allEvents.push(...events);
      } catch (innerErr) {
        console.error("google-calendar all-events user fetch error", {
          userId: row.user_id,
          error: innerErr,
        });
      }
    }

    allEvents.sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
    return res.json({ events: allEvents });
  } catch (err) {
    console.error("google-calendar all-events error", err);
    return res.status(500).json({ message: "Failed to load admin Google Calendar events" });
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

    // Upload to S3 (or local disk when AWS not configured) and store URL in DB
    const url = await uploadProfileImage(user.id, image);

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

// Team contact details for Mail loop / Group description (admins, TDMs, DMs)
app.get("/api/auth/team-emails", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const [rows] = await pool.query(
      "SELECT name, email, role FROM users WHERE role IN ('admin','territorial_design_manager','design_manager') ORDER BY role, name ASC",
    );
    const admins: { name: string; email: string }[] = [];
    const territorial_design_managers: { name: string; email: string }[] = [];
    const design_managers: { name: string; email: string }[] = [];
    (rows as { name: string | null; email: string | null; role: string }[]).forEach(
      (r) => {
        const name = r.name || "";
        const email = r.email || "";
        if (!email) return;
        const role = (r.role || "").toLowerCase();
        if (role === "admin") admins.push({ name, email });
        else if (role === "territorial_design_manager")
          territorial_design_managers.push({ name, email });
        else if (role === "design_manager") design_managers.push({ name, email });
      },
    );
    return res.json({ admins, territorial_design_managers, design_managers });
  } catch (err) {
    console.error("team-emails error", err);
    return res.status(500).json({ message: "Failed to load team emails" });
  }
});

app.get("/api/auth/team-phones", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const [rows] = await pool.query(
      "SELECT name, phone, role FROM users WHERE role IN ('admin','territorial_design_manager','design_manager') ORDER BY role, name ASC",
    );
    const admins: { name: string; phone: string }[] = [];
    const territorial_design_managers: { name: string; phone: string }[] = [];
    const design_managers: { name: string; phone: string }[] = [];
    (rows as { name: string | null; phone: string | null; role: string }[]).forEach(
      (r) => {
        const name = r.name || "";
        const phone = r.phone || "";
        if (!phone) return;
        const role = (r.role || "").toLowerCase();
        if (role === "admin") admins.push({ name, phone });
        else if (role === "territorial_design_manager")
          territorial_design_managers.push({ name, phone });
        else if (role === "design_manager") design_managers.push({ name, phone });
      },
    );
    return res.json({ admins, territorial_design_managers, design_managers });
  } catch (err) {
    console.error("team-phones error", err);
    return res.status(500).json({ message: "Failed to load team phones" });
  }
});

// Serve local profile images (when S3 is not configured)
app.get("/api/profile-images/:filename", (req: Request, res: Response) => {
  const raw = Array.isArray(req.params.filename) ? req.params.filename[0] : (req.params.filename ?? "");
  const filename = path.basename(String(raw)).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!filename) return res.status(400).send("Invalid filename");
  const resolved = path.resolve(PROFILE_IMAGES_DIR, filename);
  const dirResolved = path.resolve(PROFILE_IMAGES_DIR);
  if (!resolved.startsWith(dirResolved) || !fs.existsSync(resolved)) {
    return res.status(404).send("Not found");
  }
  res.sendFile(resolved);
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
      "INSERT INTO users (email, password, name, role, phone, mmt_manager_id) VALUES (?, ?, ?, ?, ?, ?)",
      [
        normalized,
        String(password),
        displayName,
        "mmt_executive",
        phoneVal || null,
        role === "mmt_manager" ? manager.id : null,
      ],
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

// Admin or Deputy General Manager: create TDM (Territorial Design Manager)
app.all("/api/auth/create-tdm", async (req: Request, res: Response) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Use POST" });
  try {
    const current = await getUserFromSession(req);
    if (!current) return res.status(401).json({ message: "Unauthorized" });
    const role = (current.role || "").toLowerCase();
    if (role !== "admin" && role !== "deputy_general_manager") {
      return res.status(403).json({ message: "Only admin or Deputy General Manager can create TDM" });
    }
    const { email, password, name, phone } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    if (!password || String(password).length < 1) return res.status(400).json({ message: "Password is required" });
    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;
    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, "territorial_design_manager", phoneVal || null],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({ user: { id: insertId, email: normalized, name: displayName, role: "territorial_design_manager" } });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "A user with this email already exists" });
    console.error("create-tdm error", err);
    return res.status(500).json({ message: "Failed to create Territorial Design Manager" });
  }
});

// Admin: create Deputy General Manager (same access model as TDM)
app.all("/api/auth/create-deputy-general-manager", async (req: Request, res: Response) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Use POST" });
  try {
    const admin = await getUserFromSession(req);
    if (!admin) return res.status(401).json({ message: "Unauthorized" });
    if (admin.role !== "admin") return res.status(403).json({ message: "Only admin can create Deputy General Manager" });
    const { email, password, name, phone } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    if (!password || String(password).length < 1) return res.status(400).json({ message: "Password is required" });
    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;
    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, "deputy_general_manager", phoneVal || null],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({ user: { id: insertId, email: normalized, name: displayName, role: "deputy_general_manager" } });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "A user with this email already exists" });
    console.error("create-deputy-general-manager error", err);
    return res.status(500).json({ message: "Failed to create Deputy General Manager" });
  }
});

// Admin: create Admin
app.all("/api/auth/create-admin", async (req: Request, res: Response) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Use POST" });
  try {
    const admin = await getUserFromSession(req);
    if (!admin) return res.status(401).json({ message: "Unauthorized" });
    if (admin.role !== "admin") return res.status(403).json({ message: "Only admin can create Admin" });
    const { email, password, name, phone } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    if (!password || String(password).length < 1) return res.status(400).json({ message: "Password is required" });
    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;
    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, "admin", phoneVal || null],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({ user: { id: insertId, email: normalized, name: displayName, role: "admin" } });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "A user with this email already exists" });
    console.error("create-admin error", err);
    return res.status(500).json({ message: "Failed to create Admin" });
  }
});

// Admin: create DQC Manager
app.all("/api/auth/create-dqc-manager", async (req: Request, res: Response) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Use POST" });
  try {
    const admin = await getUserFromSession(req);
    if (!admin) return res.status(401).json({ message: "Unauthorized" });
    if (admin.role !== "admin") return res.status(403).json({ message: "Only admin can create DQC Manager" });
    const { email, password, name, phone } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    if (!password || String(password).length < 1) return res.status(400).json({ message: "Password is required" });
    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;
    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, "dqc_manager", phoneVal || null],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({ user: { id: insertId, email: normalized, name: displayName, role: "dqc_manager" } });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "A user with this email already exists" });
    console.error("create-dqc-manager error", err);
    return res.status(500).json({ message: "Failed to create DQC Manager" });
  }
});

// Admin: create Escalation Manager
app.all("/api/auth/create-escalation-manager", async (req: Request, res: Response) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Use POST" });
  try {
    const admin = await getUserFromSession(req);
    if (!admin) return res.status(401).json({ message: "Unauthorized" });
    if (admin.role !== "admin") return res.status(403).json({ message: "Only admin can create Escalation Manager" });
    const { email, password, name, phone } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    if (!password || String(password).length < 1) return res.status(400).json({ message: "Password is required" });
    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;
    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, "escalation_manager", phoneVal || null],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({ user: { id: insertId, email: normalized, name: displayName, role: "escalation_manager" } });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "A user with this email already exists" });
    console.error("create-escalation-manager error", err);
    return res.status(500).json({ message: "Failed to create Escalation Manager" });
  }
});

// Admin / TDM / DGM: create Project Manager
app.all("/api/auth/create-project-manager", async (req: Request, res: Response) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Use POST" });
  try {
    const admin = await getUserFromSession(req);
    if (!admin) return res.status(401).json({ message: "Unauthorized" });
    const r = (admin.role || "").toLowerCase();
    const allowed = ["admin", "territorial_design_manager", "deputy_general_manager"];
    if (!allowed.includes(r)) {
      return res.status(403).json({
        message: "Only Admin, Territorial Design Manager, or Deputy General Manager can create a Project Manager",
      });
    }
    const { email, password, name, phone } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    if (!password || String(password).length < 1) return res.status(400).json({ message: "Password is required" });
    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;
    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, "project_manager", phoneVal || null],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({ user: { id: insertId, email: normalized, name: displayName, role: "project_manager" } });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "A user with this email already exists" });
    console.error("create-project-manager error", err);
    return res.status(500).json({ message: "Failed to create Project Manager" });
  }
});

// Admin: create Senior Project Manager (full project visibility; assigns PMs on leads)
app.all("/api/auth/create-senior-project-manager", async (req: Request, res: Response) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Use POST" });
  try {
    const admin = await getUserFromSession(req);
    if (!admin) return res.status(401).json({ message: "Unauthorized" });
    if ((admin.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({ message: "Only admin can create a Senior Project Manager" });
    }
    const { email, password, name, phone } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    if (!password || String(password).length < 1) return res.status(400).json({ message: "Password is required" });
    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;
    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, "senior_project_manager", phoneVal || null],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({
      user: { id: insertId, email: normalized, name: displayName, role: "senior_project_manager" },
    });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "A user with this email already exists" });
    console.error("create-senior-project-manager error", err);
    return res.status(500).json({ message: "Failed to create Senior Project Manager" });
  }
});

// List project managers (for assigning to a lead after DQC 2)
app.get("/api/auth/project-managers", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role || "").toLowerCase();
    if (!canAssignProjectManagerRole(role)) {
      return res.status(403).json({ message: "Not allowed to list project managers" });
    }
    const [rows] = await pool.query(
      "SELECT id, name, email FROM users WHERE role = 'project_manager' ORDER BY name ASC",
    );
    return res.json(rows);
  } catch (err) {
    console.error("project-managers list error", err);
    return res.status(500).json({ message: "Failed to load project managers" });
  }
});

// Admin: create Finance
app.all("/api/auth/create-finance", async (req: Request, res: Response) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Use POST" });
  try {
    const admin = await getUserFromSession(req);
    if (!admin) return res.status(401).json({ message: "Unauthorized" });
    if (admin.role !== "admin") return res.status(403).json({ message: "Only admin can create Finance" });
    const { email, password, name, phone } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    if (!password || String(password).length < 1) return res.status(400).json({ message: "Password is required" });
    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;
    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, "finance", phoneVal || null],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({ user: { id: insertId, email: normalized, name: displayName, role: "finance" } });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "A user with this email already exists" });
    console.error("create-finance error", err);
    return res.status(500).json({ message: "Failed to create Finance" });
  }
});

// DQC Manager or Admin: register DQE (Design Quality Executive)
app.all("/api/auth/register-dqe", async (req: Request, res: Response) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Use POST" });
  try {
    const manager = await getUserFromSession(req);
    if (!manager) return res.status(401).json({ message: "Unauthorized" });
    const role = (manager.role || "").toLowerCase();
    if (role !== "dqc_manager" && role !== "admin") return res.status(403).json({ message: "Only DQC Manager or Admin can register DQE" });
    const { email, password, name, phone } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    if (!password || String(password).length < 1) return res.status(400).json({ message: "Password is required" });
    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;
    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, "dqe", phoneVal || null],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({ user: { id: insertId, email: normalized, name: displayName, role: "dqe" } });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "A user with this email already exists" });
    console.error("register-dqe error", err);
    return res.status(500).json({ message: "Failed to register DQE" });
  }
});

// TDM / Deputy GM / Admin: register designer or design_manager
app.all("/api/auth/register", async (req: Request, res: Response) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Use POST" });
  try {
    const current = await getUserFromSession(req);
    if (!current) return res.status(401).json({ message: "Unauthorized" });
    const role = (current.role || "").toLowerCase();
    if (role !== "territorial_design_manager" && role !== "deputy_general_manager" && role !== "admin") return res.status(403).json({ message: "Only TDM, Deputy General Manager, or Admin can register designers" });
    const { email, password, name, phone, role: bodyRole, managerId } = req.body || {};
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized.endsWith("@hubinterior.com")) return res.status(400).json({ message: "Email must end with @hubinterior.com" });
    if (!password || String(password).length < 1) return res.status(400).json({ message: "Password is required" });
    const targetRole = bodyRole === "design_manager" ? "design_manager" : "designer";
    const displayName = (name || normalized).trim() || normalized;
    const phoneVal = phone != null ? String(phone).trim() : null;
    let designManagerId: number | null = null;
    let territorialDesignManagerId: number | null = null;
    const isTdm = role === "territorial_design_manager";
    if (targetRole === "design_manager" && isTdm) {
      territorialDesignManagerId = current.id;
    }
    if (targetRole === "designer" && managerId != null && managerId !== "") {
      const idNum = Number(managerId);
      if (!Number.isNaN(idNum)) {
        const [mgrRows] = await pool.query(
          "SELECT id, territorial_design_manager_id FROM users WHERE id = ? AND role = 'design_manager'",
          [idNum],
        );
        if ((mgrRows as any[]).length === 0) {
          return res.status(400).json({ message: "Invalid design manager selected" });
        }
        const manager = (mgrRows as any[])[0];
        if (isTdm && Number(manager.territorial_design_manager_id) !== Number(current.id)) {
          return res.status(403).json({ message: "You can assign designers only under your own design managers" });
        }
        designManagerId = idNum;
      }
    }
    const [result] = await pool.query(
      "INSERT INTO users (email, password, name, role, phone, design_manager_id, territorial_design_manager_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [normalized, String(password), displayName, targetRole, phoneVal || null, designManagerId, territorialDesignManagerId],
    );
    const insertId = (result as any).insertId;
    return res.status(201).json({ user: { id: insertId, email: normalized, name: displayName, role: targetRole } });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "A user with this email already exists" });
    console.error("register (TDM) error", err);
    return res.status(500).json({ message: "Registration failed" });
  }
});

// ----- Sales closure and leads -----

app.post("/api/sales-closure", async (req: Request, res: Response) => {
  const payload = req.body;
  console.log("Received sales-closure:", payload);

  const lead = toLeadRow(payload);
  const pid = ""; // keep empty or generate PID if required

  try {
    // Determine assigned designer based on designer_name in payload (if any)
    let assignedDesignerId: number | null = null;
    try {
      const designerName: string | undefined =
        (payload && (payload.designer_name || payload.designerName)) || undefined;
      if (designerName) {
        const [rows] = await pool.query(
          "SELECT id FROM users WHERE name = ? AND role = 'designer' LIMIT 1",
          [designerName],
        );
        const row = (rows as { id: number }[])[0];
        if (row?.id) assignedDesignerId = row.id;
      }
    } catch {
      // ignore mapping errors; assignedDesignerId stays null
    }

    const [result] = await pool.query(
      `INSERT INTO leads
       (pid, project_name, project_stage, contact_no, client_email,
        is_on_hold, resume_at, create_at, update_at, payload, assigned_designer_id)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?)`,
      [
        pid,
        lead.projectName,
        lead.projectStage,
        lead.contactNo,
        lead.clientEmail,
        lead.createAt,
        lead.updateAt,
        JSON.stringify(payload),
        assignedDesignerId,
      ],
    );
    const insertId = (result as any).insertId;

    // Fire-and-forget: trigger D1 Site Measurement welcome email via frontend mail service
    try {
      const customerEmail =
        lead.clientEmail || payload.email || payload?.form?.email || null;
      const customerName =
        payload.customer_name ||
        payload?.form?.customer_name ||
        lead.projectName ||
        "Customer";

      if (customerEmail) {
        const frontendBase =
          process.env.FRONTEND_BASE_URL || "http://localhost:3000";
        const mailChainCc = await getMailLoopCcEmails();
        const mailChainSubject = buildMailChainSubject(pid, lead.projectName, customerName);

        // Do not block main response if email fails; just log.
        const propertyType = payload.property_configuration || payload?.formData?.property_configuration || payload?.form?.property_configuration || "Apartment";

        fetch(`${frontendBase}/api/email/send-d1-site-measurement`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: customerEmail,
            cc: mailChainCc,
            subject: mailChainSubject,
            customerName,
            projectId: `PJ-${insertId}`,
            propertyType,
          }),
        }).catch((err) => {
          console.error("Failed to trigger D1 email from backend", err);
        });
      }
    } catch (emailErr) {
      console.error("D1 email trigger error (non-fatal)", emailErr);
    }

    res.status(201).json({
      success: true,
      message: "Sales closure received",
    });
  } catch (err) {
    console.error("Error saving lead", err);
    res.status(500).json({ message: "Failed to save sales closure" });
  }
});

// External system intake: create a lead directly in Pre 10%.
// This endpoint is meant to be called by another project/service.
app.post("/api/leads/external-intake", async (req: Request, res: Response) => {
  const expectedKey = (process.env.EXTERNAL_LEAD_INGEST_API_KEY || "").trim();
  if (!expectedKey) {
    return res.status(503).json({
      message: "External lead intake is disabled (missing EXTERNAL_LEAD_INGEST_API_KEY)",
    });
  }

  const apiKeyHeader = String(req.headers["x-external-api-key"] || "").trim();
  const bearer = String(req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const providedKey = apiKeyHeader || bearer;
  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const payload = req.body || {};
  const formData = payload?.formData || payload?.form_data || payload || {};
  const fetched = payload?.fetchedData || formData || {};

  const projectName =
    String(
      payload.projectName ||
      payload.customer_name ||
      payload.sales_lead_name ||
      formData.projectName ||
      formData.customer_name ||
      formData.sales_lead_name ||
      fetched.customer_name ||
      fetched.sales_lead_name ||
      "",
    ).trim() || "Unnamed";

  const contactNo =
    String(
      payload.contactNo ||
      payload.contact_no ||
      payload.phone ||
      formData.co_no ||
      fetched.co_no ||
      "",
    ).trim() || null;

  const clientEmail =
    String(
      payload.clientEmail ||
      payload.client_email ||
      payload.email ||
      formData.email ||
      fetched.email ||
      "",
    ).trim() || null;

  const pid = String(payload.pid || payload.externalLeadId || payload.referenceId || "").trim();
  const sourceProject = String(payload.sourceProject || payload.source || "").trim() || null;
  const now = new Date();

  try {
    const payloadToPersist = {
      source: "external_intake_api",
      sourceProject,
      externalReferenceId: pid || null,
      receivedAt: now.toISOString(),
      formData: {
        customer_name: projectName,
        co_no: contactNo || "",
        email: clientEmail || "",
        status_of_project: "Pre 10%",
      },
      rawPayload: payload,
    };

    const [result] = await pool.query(
      `INSERT INTO leads
       (pid, project_name, project_stage, contact_no, client_email,
        is_on_hold, resume_at, create_at, update_at, payload, assigned_designer_id)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, NULL)`,
      [
        pid,
        projectName,
        "Pre 10%",
        contactNo,
        clientEmail,
        now,
        now,
        JSON.stringify(payloadToPersist),
      ],
    );

    return res.status(201).json({
      ok: true,
      leadId: (result as any)?.insertId ?? null,
      projectName,
      projectStage: "Pre 10%",
      message: "Lead received via external intake",
    });
  } catch (err) {
    console.error("external-intake error", err);
    return res.status(500).json({ message: "Failed to create lead from external intake" });
  }
});

// Upload Excel and preview headers/rows for lead import.
app.post("/api/leads/import-excel/preview", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!canImportLeads(user.role)) {
      return res.status(403).json({ message: "Only admin, TDM, and design manager can import leads" });
    }
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ message: "Excel file is required" });

    const workbook = XLSX.readFile(file.path, { cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return res.status(400).json({ message: "Workbook has no sheets" });
    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    if (!matrix.length) return res.status(400).json({ message: "Sheet is empty" });
    const headers = (matrix[0] || [])
      .map((h) => String(h || "").trim())
      .filter((h) => h.length > 0);
    if (headers.length === 0) return res.status(400).json({ message: "Header row is empty" });

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as Record<string, unknown>[];
    const trimmedRows = rows.slice(0, 1000);
    const token = saveExcelPreview(trimmedRows, headers);

    // remove temporary upload
    try { fs.unlinkSync(file.path); } catch { }

    return res.json({
      token,
      headers,
      sampleRows: trimmedRows.slice(0, 5),
      rowCount: trimmedRows.length,
      targetFields: [
        { key: "projectName", label: "Project Name", required: true },
        { key: "customerName", label: "Customer Name", required: false },
        { key: "clientEmail", label: "Customer Email", required: false },
        { key: "contactNo", label: "Contact No", required: false },
        { key: "projectStage", label: "Project Stage", required: false },
      ],
    });
  } catch (err) {
    console.error("import-excel preview error", err);
    return res.status(500).json({ message: "Failed to preview excel file" });
  }
});

// Commit lead import from previously previewed Excel data using chosen header mapping.
app.post("/api/leads/import-excel/commit", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!canImportLeads(user.role)) {
      return res.status(403).json({ message: "Only admin, TDM, and design manager can import leads" });
    }

    const token = String(req.body?.token || "");
    const mappings = (req.body?.mappings || {}) as Record<string, string>;
    const defaultDesignerIdRaw = req.body?.defaultDesignerId;
    const defaultDesignerId =
      defaultDesignerIdRaw === undefined || defaultDesignerIdRaw === null || defaultDesignerIdRaw === ""
        ? null
        : Number(defaultDesignerIdRaw);
    if (!token) return res.status(400).json({ message: "token is required" });
    if (!mappings || typeof mappings !== "object") return res.status(400).json({ message: "mappings are required" });
    const cached = excelImportPreviewStore.get(token);
    if (!cached) return res.status(400).json({ message: "Preview token not found or expired" });
    if (Date.now() - cached.createdAt > EXCEL_PREVIEW_TTL_MS) {
      excelImportPreviewStore.delete(token);
      return res.status(400).json({ message: "Preview token expired. Please upload the file again." });
    }

    const pickValue = (row: Record<string, unknown>, targetField: string): string => {
      const mappedHeader = String(mappings[targetField] || "").trim();
      if (!mappedHeader) return "";
      if (row[mappedHeader] != null && String(row[mappedHeader]).trim() !== "") {
        return String(row[mappedHeader]).trim();
      }
      const normalizedMapped = normalizeHeaderKey(mappedHeader);
      const matchedKey = Object.keys(row).find((k) => normalizeHeaderKey(k) === normalizedMapped);
      return matchedKey ? String(row[matchedKey] ?? "").trim() : "";
    };

    let defaultDesignerName = "";
    if (defaultDesignerId !== null) {
      if (!Number.isFinite(defaultDesignerId) || defaultDesignerId <= 0) {
        return res.status(400).json({ message: "Invalid defaultDesignerId" });
      }
      const [designerRows] = await pool.query(
        "SELECT id, name, role, design_manager_id FROM users WHERE id = ? AND role IN ('designer', 'design_manager') LIMIT 1",
        [defaultDesignerId],
      );
      const designer = (designerRows as any[])[0];
      if (!designer) return res.status(400).json({ message: "Invalid default designer selected" });

      const role = (user.role || "").toLowerCase();
      if (role === "design_manager") {
        const allowed =
          (designer.role === "design_manager" && Number(designer.id) === Number(user.id)) ||
          (designer.role === "designer" && Number(designer.design_manager_id) === Number(user.id));
        if (!allowed) {
          return res.status(403).json({ message: "You can assign only to yourself or your designers" });
        }
      }
      defaultDesignerName = String(designer.name || "");
    }

    const rows = cached.rows;
    let imported = 0;
    const errors: Array<{ row: number; message: string }> = [];
    const now = new Date();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const projectName = pickValue(row, "projectName");
      if (!projectName) continue;

      const customerName = pickValue(row, "customerName");
      const clientEmail = pickValue(row, "clientEmail") || null;
      const contactNo = pickValue(row, "contactNo") || null;
      const projectStage = pickValue(row, "projectStage") || "Active";

      let assignedDesignerId: number | null = null;
      let designerName = "";
      if (defaultDesignerId !== null) {
        assignedDesignerId = defaultDesignerId;
        designerName = defaultDesignerName;
      }

      const payload = {
        source: "excel_import",
        importedBy: { id: user.id, name: user.name, role: user.role },
        importedAt: now.toISOString(),
        formData: {
          customer_name: customerName || projectName,
          designer_name: designerName || "",
          co_no: contactNo || "",
          email: clientEmail || "",
          status_of_project: projectStage,
        },
        rawRow: row,
      };

      try {
        await pool.query(
          `INSERT INTO leads
           (pid, project_name, project_stage, contact_no, client_email,
            is_on_hold, resume_at, create_at, update_at, payload, assigned_designer_id)
           VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?)`,
          [
            "",
            projectName,
            projectStage,
            contactNo,
            clientEmail,
            now,
            now,
            JSON.stringify(payload),
            assignedDesignerId,
          ],
        );
        imported += 1;
      } catch (insertErr: any) {
        errors.push({ row: i + 2, message: insertErr?.message || "Insert failed" });
      }
    }

    excelImportPreviewStore.delete(token);
    return res.json({
      ok: true,
      imported,
      totalRows: rows.length,
      failed: errors.length,
      errors: errors.slice(0, 50),
    });
  } catch (err) {
    console.error("import-excel commit error", err);
    return res.status(500).json({ message: "Failed to import leads" });
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
      ["design_freeze", JSON.stringify(payload), new Date(), leadId ?? null],
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
        ["color_selection", JSON.stringify(payload), new Date(), leadId ?? null],
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

    if (events.length > 0) {
      return res.json(events);
    }

    // Fallback for older leads that pre-date explicit history events:
    // synthesize basic "completed" entries from task completions so History is never empty.
    const [compRows] = await pool.query(
      "SELECT milestone_index as milestoneIndex, task_name as taskName, completed_at as completedAt FROM lead_task_completions WHERE lead_id = ? ORDER BY completed_at DESC",
      [id],
    );
    const completions = compRows as {
      milestoneIndex: number;
      taskName: string;
      completedAt: Date | null;
    }[];
    const synthetic = completions.map((c) => {
      const ts = c.completedAt ? new Date(c.completedAt) : new Date();
      const milestoneName = MILESTONE_NAMES[c.milestoneIndex] ?? `Milestone ${c.milestoneIndex + 1}`;
      return {
        id: `legacy-completion-${id}-${c.milestoneIndex}-${c.taskName}-${ts.getTime()}`,
        type: "completed",
        taskName: c.taskName,
        milestoneName,
        timestamp: ts.toISOString(),
        description: `${c.taskName} completed.`,
        user: { name: "System", avatar: null },
        details: {
          kind: "note",
          noteText: "Imported from existing completion record.",
        },
      };
    });
    return res.json(synthetic);
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
  const { milestoneIndex, taskName, meta } = req.body || {};
  if (typeof milestoneIndex !== "number" || !taskName) {
    return res.status(400).json({ message: "milestoneIndex and taskName are required" });
  }
  try {
    const tNorm = String(taskName).trim();
    if (milestoneIndex === 4 && tNorm === "Project manager approval") {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user.role || "").toLowerCase();
      if (role !== "project_manager") {
        return res.status(403).json({ message: "Only the assigned Project Manager can complete this task" });
      }
      const [lr] = await pool.query(
        "SELECT assigned_project_manager_id as pmId FROM leads WHERE id = ?",
        [id],
      );
      const pmId = (lr as any[])[0]?.pmId;
      if (!pmId || Number(pmId) !== user.id) {
        return res.status(403).json({ message: "You are not the assigned Project Manager for this lead" });
      }
    }
    if (milestoneIndex === 4 && tNorm === "Assign project manager") {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user.role || "").toLowerCase();
      if (!canAssignProjectManagerRole(role)) {
        return res.status(403).json({
          message:
            "Only Admin, Territorial Design Manager, Deputy General Manager, or Senior Project Manager can complete this step",
        });
      }
      const [ar] = await pool.query(
        "SELECT assigned_project_manager_id as pmId FROM leads WHERE id = ?",
        [id],
      );
      if (!(ar as any[])[0]?.pmId) {
        return res
          .status(400)
          .json({ message: "Choose a project manager and save before marking this step complete" });
      }
    }

    const actingUser = await getUserFromSession(req);
    if (!actingUser) return res.status(401).json({ message: "Unauthorized" });

    await pool.query(
      `INSERT INTO lead_task_completions (lead_id, milestone_index, task_name, completed_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at)`,
      [id, milestoneIndex, taskName, new Date()],
    );

    // Fire-and-forget: trigger milestone-specific customer emails where defined
    const emailRoutePath: string | null = (() => {
      const t = String(taskName).trim();
      switch (milestoneIndex) {
        // Milestone 0: D1 SITE MEASUREMENT
        case 0:
          if (t === "Mail loop chain 2 initiate") {
            // Sl no 2 – initiate customer mail loop chain from backend SMTP
            return "/api/email/send-mail-loop-chain-initiate";
          }
          if (t === "D1 for MMT request") {
            // Sl no 3 – D1 for MMT request (measurement visit scheduling)
            return "/api/email/send-d1-mmt-visit-scheduled";
          }
          break;

        // Milestone 1: DQC1
        case 1:
          if (t === "First cut design + quotation discussion meeting request") {
            // Sl no 5 – first cut design + quotation discussion (meeting request)
            // Email invite is triggered directly from /api/leads/:id/first-cut-design-upload (Send Invite button).
            // Do not fire an additional email on task completion.
          }
          if (t === "meeting completed") {
            // After DQC1 first‑cut meeting completed → project design timeline mail
            return "/api/email/send-project-design-timeline";
          }
          // DQC 1 approval → fires BOTH internal (designer) and CX (10% payment) emails
          if (t === "DQC 1 approval") {
            return "DQC1_APPROVAL_DUAL";
          }
          break;

        // Milestone 2: 10% PAYMENT
        case 2:
          // 10% payment collection: fire BOTH internal + CX (fallback if not sent at DQC 1 approval)
          if (t === "10% payment collection") {
            return "10P_COLLECTION_DUAL";
          }
          // 10% payment approval email is triggered in /api/leads/:id/approve-10p-payment
          break;

        // Milestone 3: D2 SITE MASKING
        case 3:
          if (t === "D2 - masking request raise") {
            // Sl no 9 – D2 masking: internal (Designer→PM) + CX
            return "D2_MASKING_DUAL";
          }
          break;

        // Milestone 4: DQC2
        case 4:
          if (t === "Material selection meeting + quotation discussion") {
            // Sl no 11 – DQC2 material selection meeting scheduled
            return "/api/email/send-dqc2-material-selection-scheduled";
          }
          if (t === "Material selection meeting completed") {
            // Sl no 11b – MOM Color & Laminate Selection Confirmation
            return "/api/email/send-mom-color-laminate-selection-confirmation";
          }
          if (t === "DQC 2 submission") {
            // Sl no 12 – DQC2 submission: internal only (to DQC)
            return "DQC2_SUBMISSION_DUAL";
          }
          if (t === "DQC 2 approval" || t === "DQC 2 approval ") {
            // DQC 2 approval: internal only (to designer)
            return "/api/email/send-dqc2-approval-internal";
          }
          // design sign‑off meeting email is triggered from 40% PAYMENT milestone.
          break;

        // Milestone 5: 40% PAYMENT
        case 5: {
          if (t === "Design sign off") {
            // Sl no 14 – design sign‑off meeting request (after DQC2 approval)
            // Email invite is triggered directly from /api/leads/:id/schedule-meeting-invite (Send Invite button).
            // Do not fire an additional email on task completion.
            // return "/api/email/send-design-signoff-meeting-scheduled";
          }
          if (t === "meeting completed" || t === "40% collection" || t === "meeting completed & 40% payment request") {
            // Sl no 15 – 40% collection (CX payment request; legacy combined task name still triggers)
            return "/api/email/send-design-signoff-40pc-payment-request";
          }
          // 40% payment approval email is triggered in /api/leads/:id/approve-40p-payment
          break;
        }

        // Milestone 6: PUSH TO PRODUCTION
        case 6:
          if (t === "Cx approval for production") {
            // Sl no 16 – CX approval for production
            return "/api/email/send-production-approval-request";
          }
          if (t === "POC mail" || t === "POC mail " || t === "POC mail & Timeline submission" || t === "POC mail & Timeline submission ") {
            // Sl no 16 (second task) – POC mail & timeline submission
            return "/api/email/send-production-poc-timeline";
          }
          break;

        default:
          break;
      }
      return null;
    })();

    if (emailRoutePath) {
      console.log("[complete-task] Email trigger:", { leadId: id, milestoneIndex, taskName, emailRoutePath });
      // DQC 1 approval: fire BOTH internal (to designer) and CX (10% payment request)
      if (emailRoutePath === "DQC1_APPROVAL_DUAL") {
        try {
          console.log("[DQC1_APPROVAL_DUAL] Triggered for leadId:", id);
          const [leadRows] = await pool.query(
            `SELECT l.pid, l.project_name as projectName, l.client_email as clientEmail, l.payload, l.assigned_designer_id,
                    u.id as designerId, u.email as designerEmail, u.name as designerName
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.id = ?`,
            [id],
          );
          const leadRow = (leadRows as any[])[0];
          if (!leadRow) {
            console.warn("[DQC1_APPROVAL_DUAL] No lead found for id:", id);
          }
          if (leadRow) {
            let payload: any = {};
            try {
              payload = leadRow.payload ? JSON.parse(leadRow.payload) : {};
            } catch {
              payload = {};
            }
            const formData =
              payload?.formData ||
              payload?.form_data ||
              payload?.form ||
              payload ||
              {};
            const customerEmail =
              leadRow.clientEmail ||
              formData.email ||
              formData.sales_email ||
              payload?.email ||
              payload?.form?.email ||
              null;
            const customerName =
              formData.customer_name ||
              formData.sales_lead_name ||
              payload.customer_name ||
              payload?.form?.customer_name ||
              leadRow.projectName ||
              "Customer";
            const ecName =
              payload.experience_center ||
              payload?.form?.experience_center ||
              leadRow.experienceCenter ||
              "Experience Center";
            let designerName = leadRow.designerName || "Designer";
            let designerEmail = leadRow.designerEmail || null;
            if (!designerEmail && (formData.designer_name || formData.designerName || payload.designer_name || payload.designerName)) {
              const dn = formData.designer_name || formData.designerName || payload.designer_name || payload.designerName || "";
              const [uRows] = await pool.query("SELECT email, name FROM users WHERE (name = ? OR email = ?) AND role IN ('designer', 'design_manager') LIMIT 1", [dn, dn]);
              const uRow = (uRows as any[])[0];
              if (uRow) {
                designerEmail = uRow.email;
                designerName = uRow.name || designerName;
              }
            }

            const projectId = leadRow.pid || `PJ-${id}`;
            const propertyType = formData.property_configuration || "";
            const rawOrderValue = formData.order_value ?? payload.order_value ?? null;
            let amountDue: string | undefined;
            if (typeof rawOrderValue === "number") {
              amountDue = `₹${(rawOrderValue * 0.1).toFixed(0)}`;
            } else if (typeof rawOrderValue === "string" && rawOrderValue.trim()) {
              const num = Number(rawOrderValue.replace(/[^0-9.]/g, ""));
              if (!Number.isNaN(num) && num > 0) {
                amountDue = `₹${(num * 0.1).toFixed(0)}`;
              }
            }

            console.log("[DQC1_APPROVAL_DUAL] Lead data:", {
              leadId: id,
              designerEmail: designerEmail ? "ok" : "MISSING",
              customerEmail: customerEmail ? "ok" : "MISSING",
              customerName,
              ecName,
              assignedDesignerId: leadRow.assigned_designer_id ?? null,
              FRONTEND_BASE,
            });

            const sendInternal = designerEmail && customerName && designerName && ecName;
            const sendCx = !!customerEmail;
            if (!sendInternal && !sendCx) {
              console.warn("[DQC1_APPROVAL_DUAL] Skipping emails: no designerEmail or customerEmail", {
                leadId: id,
                hasDesigner: !!designerEmail,
                hasCustomer: !!customerEmail,
              });
            }

            // 1. Internal email to designer: DQC 1 approved, proceed for masking
            if (sendInternal) {
              const url = `${FRONTEND_BASE}/api/email/send-ten-percent-payment-internal`;
              const mailChainCc = await getMailLoopCcEmails([actingUser.email, designerEmail]);
              const mailChainSubject = buildMailChainSubject(projectId, leadRow.projectName, customerName);
              try {
                const r = await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: designerEmail,
                    cc: mailChainCc,
                    subject: mailChainSubject,
                    customerName,
                    designerName,
                    ecName,
                  }),
                });
                const text = await r.text();
                if (!r.ok) {
                  console.error("10% internal email API error", {
                    leadId: id,
                    status: r.status,
                    body: text,
                  });
                } else {
                  console.log("[DQC1_APPROVAL_DUAL] Internal email sent to designer");
                }
              } catch (err) {
                console.error("10% internal email trigger error", { leadId: id, error: err });
              }
            }

            // 2. CX email: 10% payment request with account details
            if (sendCx) {
              const url = `${FRONTEND_BASE}/api/email/send-ten-percent-payment-request`;
              const mailChainCc = await getMailLoopCcEmails([actingUser.email, designerEmail]);
              const mailChainSubject = buildMailChainSubject(projectId, leadRow.projectName, customerName);
              try {
                const r = await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: customerEmail,
                    cc: mailChainCc,
                    subject: mailChainSubject,
                    customerName,
                    projectId,
                    propertyType,
                    amountDue,
                    attachments: await (async () => {
                      try {
                        const [ups] = await pool.query(
                          `SELECT original_name as originalName, s3_url as s3Url, stored_path as storedPath
                           FROM lead_uploads
                           WHERE lead_id = ? AND upload_type = 'first_cut_design' AND status = 'approved'
                           ORDER BY id DESC`,
                          [id],
                        );
                        return ((ups as any[]) || []).map((u) => ({
                          filename: (u.originalName || "Attachment").toString(),
                          path: (u.s3Url || u.storedPath || "").toString(),
                        })).filter(a => a.path);
                      } catch (e) {
                        console.error("10% fetch attachments error", e);
                        return [];
                      }
                    })(),
                  }),
                });
                const text = await r.text();
                if (!r.ok) {
                  console.error("10% CX email API error", {
                    leadId: id,
                    status: r.status,
                    body: text,
                  });
                } else {
                  console.log("[DQC1_APPROVAL_DUAL] CX email sent to customer");
                }
              } catch (err) {
                console.error("10% payment request CX email trigger error", { leadId: id, error: err });
              }
            }
          }
        } catch (err) {
          console.error("DQC1 approval dual-email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }
      } else if (emailRoutePath === "10P_COLLECTION_DUAL") {
        // 10% payment collection: same dual emails as DQC 1 approval (fallback when marked complete manually)
        try {
          const [leadRows] = await pool.query(
            `SELECT l.pid, l.project_name as projectName, l.client_email as clientEmail, l.payload, l.assigned_designer_id,
                    u.id as designerId, u.email as designerEmail, u.name as designerName
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.id = ?`,
            [id],
          );
          let leadRow = (leadRows as any[])[0];
          let designerEmail = leadRow?.designerEmail || null;
          let designerName = leadRow?.designerName || "Designer";

          if (!designerEmail && leadRow) {
            const [d1Rows] = await pool.query(
              `SELECT u.email as designerEmail, u.name as designerName
               FROM lead_d1_assignments a
               LEFT JOIN users u ON u.id = a.assigned_to_user_id
               WHERE a.lead_id = ? ORDER BY a.created_at DESC LIMIT 1`,
              [id],
            );
            const d1Row = (d1Rows as any[])[0];
            if (d1Row?.designerEmail) {
              designerEmail = d1Row.designerEmail;
              designerName = d1Row.designerName || designerName;
            }
          }
          if (!designerEmail && leadRow) {
            let payload: any = {};
            try {
              payload = leadRow.payload ? JSON.parse(leadRow.payload) : {};
            } catch {
              payload = {};
            }
            const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
            const dn = formData.designer_name || formData.designerName || payload.designer_name || payload.designerName || "";
            if (dn) {
              const [uRows] = await pool.query(
                "SELECT email, name FROM users WHERE (name = ? OR email = ?) AND role IN ('designer', 'design_manager') LIMIT 1",
                [dn, dn],
              );
              const uRow = (uRows as any[])[0];
              if (uRow) {
                designerEmail = uRow.email;
                designerName = uRow.name || designerName;
              }
            }
          }

          if (leadRow) {
            let payload: any = {};
            try {
              payload = leadRow.payload ? JSON.parse(leadRow.payload) : {};
            } catch {
              payload = {};
            }
            const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
            const customerEmail =
              leadRow.clientEmail ||
              formData.email ||
              formData.sales_email ||
              payload?.email ||
              payload?.form?.email ||
              null;
            const customerName =
              formData.customer_name ||
              formData.sales_lead_name ||
              payload.customer_name ||
              payload?.form?.customer_name ||
              leadRow.projectName ||
              "Customer";
            const ecName =
              payload.experience_center ||
              payload?.form?.experience_center ||
              "Experience Center";
            const projectId = leadRow.pid || "";
            const propertyType = formData.property_configuration || "";
            const rawOrderValue = formData.order_value ?? payload.order_value ?? null;
            let amountDue: string | undefined;
            if (typeof rawOrderValue === "number") {
              amountDue = `₹${(rawOrderValue * 0.1).toFixed(0)}`;
            } else if (typeof rawOrderValue === "string" && rawOrderValue.trim()) {
              const num = Number(rawOrderValue.replace(/[^0-9.]/g, ""));
              if (!Number.isNaN(num) && num > 0) {
                amountDue = `₹${(num * 0.1).toFixed(0)}`;
              }
            }

            if (!designerEmail) {
              console.warn("[10P_COLLECTION_DUAL] Skipping internal email: no designer email (tried assigned_designer_id, lead_d1_assignments, designer_name lookup)", {
                leadId: id,
              });
            }
            if (designerEmail && customerName && designerName && ecName) {
              const internalCc = await getMailLoopCcEmails([actingUser.email, designerEmail]);
              const internalSubject = buildMailChainSubject(projectId, leadRow.projectName, customerName);
              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 2,
                taskName: "10% payment collection",
                route: "/api/email/send-ten-percent-payment-internal",
                visibility: "internal+external",
                payload: {
                  to: designerEmail,
                  cc: internalCc,
                  subject: internalSubject,
                  customerName,
                  designerName,
                  ecName,
                },
              });
            }

            if (customerEmail) {
              const mailChainCc = await getMailLoopCcEmails([actingUser.email, designerEmail]);
              const mailChainSubject = buildMailChainSubject(projectId, leadRow.projectName, customerName);
              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 2,
                taskName: "10% payment collection",
                route: "/api/email/send-ten-percent-payment-request",
                visibility: "internal+external",
                payload: {
                  to: customerEmail,
                  cc: mailChainCc,
                  subject: mailChainSubject,
                  customerName,
                  projectId,
                  propertyType,
                  amountDue,
                },
              });
            }
          }
        } catch (err) {
          console.error("10% collection dual-email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }
      } else if (emailRoutePath === "D2_MASKING_DUAL") {
        try {
          const [rows] = await pool.query(
            `SELECT l.project_name as projectName, l.client_email as clientEmail, l.payload,
                    a.masking_date as maskingDate, a.masking_time as maskingTime,
                    a.assigned_to_user_id as executiveUserId,
                    u_designer.email as designerEmail, u_designer.name as designerName,
                    u_designer.mmt_manager_id as executiveManagerId
             FROM leads l
             LEFT JOIN lead_d2_assignments a ON a.lead_id = l.id
             LEFT JOIN users u_designer ON u_designer.id = a.assigned_to_user_id
             WHERE l.id = ?
             ORDER BY a.created_at DESC
             LIMIT 1`,
            [id],
          );
          const row = (rows as any[])[0];
          const [pmRows] = await pool.query(
            "SELECT email, name FROM users WHERE role = 'project_manager' AND email IS NOT NULL ORDER BY id ASC LIMIT 1",
          );
          const pmRow = (pmRows as any[])[0];
          let pmEmail = pmRow?.email || null;
          let pmName = pmRow?.name || null;
          if (!pmEmail) {
            const [mmtRows] = await pool.query(
              "SELECT email, name FROM users WHERE role IN ('mmt_manager', 'mmt_executive') AND email IS NOT NULL ORDER BY id ASC LIMIT 1",
            );
            const mmtRow = (mmtRows as any[])[0];
            if (mmtRow) {
              pmEmail = mmtRow.email;
              pmName = mmtRow.name || "MMT";
            }
          }
          if (row) {
            let payload: any = {};
            try {
              payload = row.payload ? JSON.parse(row.payload) : {};
            } catch {
              payload = {};
            }
            const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
            const customerEmail =
              row.clientEmail ||
              formData.email ||
              formData.sales_email ||
              payload?.email ||
              payload?.form?.email ||
              null;
            const customerName =
              formData.customer_name ||
              formData.sales_lead_name ||
              payload.customer_name ||
              payload?.form?.customer_name ||
              row.projectName ||
              "Customer";
            const ecName =
              payload.experience_center ||
              payload?.form?.experience_center ||
              row.experienceCenter ||
              "Experience Center";
            const designerName = row.designerName || "Designer";
            const maskingDate = row.maskingDate
              ? (row.maskingDate instanceof Date ? row.maskingDate.toISOString().split("T")[0] : row.maskingDate)
              : null;
            const maskingTime = row.maskingTime || null;
            const googleStart = formatGoogleDateTime(maskingDate, maskingTime);

            if (googleStart) {
              try {
                await createGoogleCalendarEventForFirstAvailableUser({
                  userIds: [row.executiveUserId, row.executiveManagerId, actingUser.id],
                  summary: `D2 Site Masking - ${customerName}`,
                  description: [
                    `D2 masking visit scheduled for ${customerName}.`,
                    designerName ? `Assigned MMT executive: ${designerName}` : null,
                    pmName ? `MMT manager: ${pmName}` : null,
                  ].filter(Boolean).join("\n"),
                  startDateTimeIso: googleStart,
                  endDateTimeIso: addHoursToIso(googleStart, 1),
                  attendees: distinctEmails([customerEmail, row.designerEmail, pmEmail, actingUser.email]),
                });
              } catch (calendarErr) {
                console.error("D2 masking Google event create error (non-fatal)", {
                  leadId: id,
                  error: calendarErr,
                });
              }
            }

            if (pmEmail && customerName && designerName && ecName) {
              const [mmtRows] = await pool.query(
                "SELECT name FROM users WHERE role IN ('mmt_manager', 'mmt_executive') AND email IS NOT NULL ORDER BY id ASC LIMIT 1",
              );
              const mmtName = (mmtRows as any[])[0]?.name || null;
              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 3,
                taskName: "D2 - masking request raise",
                route: "/api/email/send-d2-masking-request-internal",
                visibility: "internal+external",
                payload: {
                  to: pmEmail,
                  customerName,
                  designerName,
                  ecName,
                  mmtName,
                  pmName,
                  maskingDate,
                  maskingTime,
                },
              });
            }

            if (customerEmail) {
              const mailChainCc = await getMailLoopCcEmails([
                actingUser.email,
                row.designerEmail,
                pmEmail,
              ]);
              const mailChainSubject = buildMailChainSubject(id, row.projectName, customerName);
              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 3,
                taskName: "D2 - masking request raise",
                route: "/api/email/send-d2-masking-request",
                visibility: "internal+external",
                payload: {
                  to: customerEmail,
                  cc: mailChainCc,
                  subject: mailChainSubject,
                  customerName,
                  designerName,
                  maskingDate,
                  maskingTime,
                },
              });
            }
          }
        } catch (err) {
          console.error("D2 masking dual-email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }
      } else if (emailRoutePath === "DQC2_SUBMISSION_DUAL") {
        try {
          const [leadRows] = await pool.query(
            `SELECT l.project_name as projectName, l.client_email as clientEmail, l.payload,
                    u.id as designerId, u.email as designerEmail, u.name as designerName
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.id = ?`,
            [id],
          );
          const leadRow = (leadRows as any[])[0];
          if (leadRow) {
            let payload: any = {};
            try {
              payload = leadRow.payload ? JSON.parse(leadRow.payload) : {};
            } catch {
              payload = {};
            }
            const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
            const customerEmail =
              leadRow.clientEmail ||
              formData.email ||
              formData.sales_email ||
              payload?.email ||
              payload?.form?.email ||
              null;
            const customerName =
              formData.customer_name ||
              formData.sales_lead_name ||
              payload.customer_name ||
              payload?.form?.customer_name ||
              leadRow.projectName ||
              "Customer";
            const ecName =
              payload.experience_center ||
              payload?.form?.experience_center ||
              leadRow.experienceCenter ||
              "Experience Center";
            const designerName = leadRow.designerName || "Designer";
            const projectValue = payload.project_value || payload?.form?.project_value || "";

            const [dqcRows] = await pool.query(
              "SELECT email, name FROM users WHERE role IN ('dqc_manager', 'dqe') AND email IS NOT NULL ORDER BY id ASC",
            );
            const dqcUsers = (dqcRows as any[]).filter((u) => u?.email);
            const dqcUser = dqcUsers[0];

            // Collect latest DQC2 drawing & quotation uploads for this lead (if S3 is configured)
            let attachments: { filename: string; path: string }[] | undefined;
            if (process.env.AWS_ACCESS_KEY_ID) {
              try {
                const [uploadRows] = await pool.query(
                  `SELECT original_name as originalName, upload_type as uploadType, s3_url as s3Url
                 FROM lead_uploads
                 WHERE lead_id = ? AND upload_type IN ('dqc2_drawing', 'dqc2_quotation') AND status = 'approved' AND s3_url IS NOT NULL
                 ORDER BY id DESC`,
                  [id],
                );
                const list = (uploadRows as any[]) || [];
                const seenTypes = new Set<string>();
                attachments = list
                  .map((r) => {
                    const type = (r.uploadType || r.uploadtype || "").toString();
                    if (!type || seenTypes.has(type)) return null;
                    seenTypes.add(type);
                    const name = (r.originalName || "").toString();
                    const url = (r.s3Url || "").toString();
                    return name && url ? { filename: name, path: url } : null;
                  })
                  .filter((v): v is { filename: string; path: string } => !!v);
                if (attachments.length === 0) {
                  attachments = undefined;
                }
              } catch (attachErr) {
                console.error("Failed to load DQC2 submission attachments (non-fatal)", {
                  leadId: id,
                  error: attachErr,
                });
              }
            }

            if (dqcUser && dqcUser.email && customerName && ecName && designerName && dqcUser.name) {
              const ccBase = await getMailLoopCcEmails([actingUser.email, leadRow.designerEmail || null]);
              const cc = distinctEmails([
                ...ccBase,
                ...dqcUsers.slice(1).map((u) => String(u.email || "")),
              ]);
              const subject = buildMailChainSubject(id, leadRow.projectName, customerName);
              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 4,
                taskName: "DQC 2 submission",
                route: "/api/email/send-dqc2-final-design-submission-internal",
                visibility: "internal",
                payload: {
                  to: dqcUser.email,
                  cc,
                  subject,
                  customerName,
                  ecName,
                  designerName,
                  dqcRepName: dqcUser.name || "DQC Team",
                  projectValue: String(projectValue || ""),
                  ...(attachments ? { attachments } : {}),
                },
              });
            } else {
              console.warn("DQC2 internal email skipped: no DQC recipient with email", {
                leadId: id,
                customerName,
                ecName,
              });
            }
            // DQC 2 submission: internal only (no CX email)
          }
        } catch (err) {
          console.error("DQC2 submission dual-email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }
      } else if (emailRoutePath === ("/api/email/send-dqc1-first-cut-design-scheduled" as string)) {
        try {
          const [rows] = await pool.query(
            `SELECT l.project_name as projectName, l.client_email as clientEmail, l.payload,
                    u.name as designerName, u.role as designerRole, u.profileImage as designerAvatarUrl
             FROM leads l
             LEFT JOIN users u ON l.assigned_designer_id = u.id
             WHERE l.id = ?`,
            [id],
          );
          const row = (rows as any[])[0];
          if (row) {
            let payload: any = {};
            try {
              payload = row.payload ? JSON.parse(row.payload) : {};
            } catch {
              payload = {};
            }
            const customerEmail =
              row.clientEmail || payload.email || payload?.form?.email || null;
            const customerName =
              payload.customer_name ||
              payload?.form?.customer_name ||
              row.projectName ||
              "Customer";

            // Collect latest first-cut design uploads (if any) to attach.
            let attachments: { filename: string; path: string }[] | undefined;
            try {
              const [uploadRows] = await pool.query(
                `SELECT original_name as originalName, s3_url as s3Url, stored_path as storedPath
                 FROM lead_uploads
                 WHERE lead_id = ? AND upload_type = 'first_cut_design' AND status = 'approved'
                 ORDER BY id DESC`,
                [id],
              );
              const list = (uploadRows as any[]) || [];
              attachments = list
                .map((r) => {
                  const name = (r.originalName || "").toString();
                  const url = (r.s3Url || r.storedPath || "").toString();
                  return name && url ? { filename: name, path: url } : null;
                })
                .filter((v): v is { filename: string; path: string } => !!v);
              if (attachments.length === 0) {
                attachments = undefined;
              }
            } catch (attachErr) {
              console.error("Failed to load first-cut design attachments (non-fatal)", {
                leadId: id,
                error: attachErr,
              });
            }

            if (customerEmail) {
              const meetingDate = meta?.meetingDate || null;
              const meetingTime = meta?.meetingTime || null;
              const googleStart = formatGoogleDateTime(meetingDate, meetingTime);

              if (googleStart) {
                try {
                  const event = await createGoogleCalendarEventForUser({
                    userId: actingUser.id,
                    summary: `First Cut Design Discussion - ${customerName}`,
                    description: `First cut design and quotation discussion for ${customerName}.`,
                    startDateTimeIso: googleStart,
                    endDateTimeIso: addHoursToIso(googleStart, 1),
                    attendees: distinctEmails([customerEmail, actingUser.email]),
                  });
                } catch (calendarErr) {
                  console.error("DQC1 first-cut Google event create error (non-fatal)", {
                    leadId: id,
                    error: calendarErr,
                  });
                }
              }

              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 1,
                taskName: "First cut design + quotation discussion meeting request",
                route: emailRoutePath,
                visibility: "external",
                payload: {
                  to: customerEmail,
                  cc: await getMailLoopCcEmails([actingUser.email]),
                  subject: buildMailChainSubject(id, row.projectName, customerName),
                  customerName,
                  meetingDate,
                  meetingTime,
                  meetingMode: meta?.meetingMode || null,
                  meetingLink: meta?.meetingLink || null,
                  designerName: row.designerName || actingUser.name,
                  designerTitle: row.designerRole === 'designer' ? 'Lead Designer, HUB Interior' : (row.designerRole || 'Lead Designer, HUB Interior'),
                  designerAvatarUrl: row.designerAvatarUrl || null,
                  ...(attachments ? { attachments } : {}),
                },
              });
            }
          }
        } catch (err) {
          console.error("DQC1 first-cut email prepare error (non-fatal)", {
            leadId: id,
            route: emailRoutePath,
            error: err,
          });
        }
      } else if (emailRoutePath === "/api/email/send-d1-mmt-visit-scheduled") {
        // Special-case D1 MMT visit so we can include visit details (date, time, executive)
        try {
          const [rows] = await pool.query(
            `SELECT a.measurement_date as measurementDate,
                    a.measurement_time as measurementTime,
                    a.assigned_to_user_id as executiveUserId,
                    u.name as executiveName,
                    u.email as executiveEmail,
                    u.mmt_manager_id as executiveManagerId,
                    u.phone as executivePhone,
                    d.email as designerEmail,
                    l.client_email as clientEmail,
                    l.pid as projectPid,
                    l.project_name as projectName,
                    l.payload
             FROM lead_d1_assignments a
             INNER JOIN leads l ON l.id = a.lead_id
             LEFT JOIN users u ON u.id = a.assigned_to_user_id
             LEFT JOIN users d ON d.id = l.assigned_designer_id
             WHERE a.lead_id = ?
             ORDER BY a.created_at DESC
             LIMIT 1`,
            [id],
          );
          const row = (rows as any[])[0];
          if (row && row.clientEmail) {
            let payload: any = {};
            try {
              payload = row.payload ? JSON.parse(row.payload) : {};
            } catch {
              payload = {};
            }
            const customerEmail =
              row.clientEmail || payload.email || payload?.form?.email || null;
            const customerName =
              payload.customer_name ||
              payload?.form?.customer_name ||
              row.projectName ||
              "Customer";

            if (customerEmail) {
              const visitDate =
                row.measurementDate instanceof Date
                  ? row.measurementDate.toISOString().split("T")[0]
                  : row.measurementDate || null;
              const visitTime = row.measurementTime || null;
              const executiveName = row.executiveName || null;
              const executiveEmail = row.executiveEmail || null;
              const executivePhone = row.executivePhone || null;
              const designerEmail = row.designerEmail || null;
              const googleStart = formatGoogleDateTime(visitDate, visitTime);

              let managerEmail: string | null = null;
              let managerName: string | null = null;
              if (row.executiveManagerId) {
                const manager = await getUserById(Number(row.executiveManagerId));
                managerEmail = manager?.email || null;
                managerName = manager?.name || null;
              }

              if (googleStart) {
                try {
                  await createGoogleCalendarEventForFirstAvailableUser({
                    userIds: [row.executiveUserId, row.executiveManagerId, actingUser.id],
                    summary: `D1 Site Measurement - ${customerName}`,
                    description: [
                      `D1 site measurement scheduled for ${customerName}.`,
                      executiveName ? `Assigned MMT executive: ${executiveName}` : null,
                      managerName ? `MMT manager: ${managerName}` : null,
                    ].filter(Boolean).join("\n"),
                    startDateTimeIso: googleStart,
                    endDateTimeIso: addHoursToIso(googleStart, 1),
                    attendees: distinctEmails([customerEmail, executiveEmail, managerEmail, actingUser.email]),
                  });
                } catch (calendarErr) {
                  console.error("D1 MMT Google event create error (non-fatal)", {
                    leadId: id,
                    error: calendarErr,
                  });
                }
              }

              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 0,
                taskName: "D1 for MMT request",
                route: emailRoutePath,
                visibility: "external",
                payload: {
                  to: customerEmail,
                  cc: distinctEmails([actingUser.email, designerEmail, executiveEmail, managerEmail]),
                  customerName,
                  subject: row.projectPid
                    ? `Project ${row.projectPid} ${row.projectName || ""} - Design discussion`
                    : `Project ${row.projectName || customerName} - Design discussion`,
                  visitDate,
                  visitTime,
                  executiveName,
                  executivePhone,
                },
              });
            }
          }
        } catch (err) {
          console.error("D1 MMT email prepare error (non-fatal)", {
            leadId: id,
            route: emailRoutePath,
            error: err,
          });
        }
      } else if (emailRoutePath === "/api/email/send-dqc2-approval-internal") {
        // DQC 2 approval: internal only – email to designer (no CX)
        try {
          const [rows] = await pool.query(
            `SELECT l.project_name as projectName, l.payload, l.assigned_designer_id,
                    u.email as designerEmail, u.name as designerName
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.id = ?`,
            [id],
          );
          const row = (rows as any[])[0];
          if (row) {
            let payload: any = {};
            try {
              payload = row.payload ? JSON.parse(row.payload) : {};
            } catch {
              payload = {};
            }
            const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
            const customerName =
              formData.customer_name ||
              formData.sales_lead_name ||
              payload?.customer_name ||
              payload?.form?.customer_name ||
              row.projectName ||
              "Customer";
            let designerEmail = row.designerEmail || null;
            let designerName = row.designerName || null;
            if (!designerEmail) {
              const maybeDesigner = formData.designer_name || formData.designerName || payload.designer_name || payload.designerName || "";
              if (maybeDesigner) {
                const [uRows] = await pool.query(
                  "SELECT email, name FROM users WHERE (name = ? OR email = ?) AND role IN ('designer', 'design_manager') LIMIT 1",
                  [maybeDesigner, maybeDesigner],
                );
                const uRow = (uRows as any[])[0];
                if (uRow) {
                  designerEmail = uRow.email || designerEmail;
                  designerName = uRow.name || designerName;
                }
              }
            }
            if (!designerEmail || !designerName) {
              console.warn("DQC2 approval internal email skipped: designer recipient missing", { leadId: id });
            } else {
              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 4,
                taskName: "DQC 2 approval",
                route: emailRoutePath,
                visibility: "internal",
                payload: {
                  to: designerEmail,
                  cc: await getMailLoopCcEmails([actingUser.email]),
                  subject: buildMailChainSubject(id, row.projectName, customerName),
                  designerName,
                  customerName,
                },
              });
            }
          }
        } catch (err) {
          console.error("DQC2 approval internal email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }

        // ── Also fire: "Assign Project Manager" internal notification ──
        try {
          const [pmRows] = await pool.query(
            `SELECT l.pid, l.project_name as projectName, l.client_email as clientEmail, l.payload, l.assigned_designer_id,
                    u.name as designerName
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.id = ?`,
            [id],
          );
          const pmRow = (pmRows as any[])[0];
          if (pmRow) {
            let pmPayload: any = {};
            try {
              pmPayload = pmRow.payload ? JSON.parse(pmRow.payload) : {};
            } catch {
              pmPayload = {};
            }
            const pmFormData = pmPayload?.formData || pmPayload?.form_data || pmPayload?.form || pmPayload || {};
            const pmCustomerName =
              pmFormData.customer_name ||
              pmFormData.sales_lead_name ||
              pmPayload?.customer_name ||
              pmPayload?.form?.customer_name ||
              pmRow.projectName ||
              "Customer";
            const pmDesignerName = pmRow.designerName || pmFormData.designer_name || pmFormData.designerName || "Design Team";
            const pmBranch = pmFormData.sales_closure_ec || pmFormData.branch || pmFormData.experience_center || pmPayload?.branch || null;
            const pmProjectId = pmRow.pid || `PJ-${id}`;

            // Send to admin + CC the mail loop
            const adminCc = await getMailLoopCcEmails([actingUser.email]);
            const adminTo = "admin@hubinterior.com";
            void triggerMailRouteWithLog({
              leadId: id,
              milestoneIndex: 4,
              taskName: "DQC 2 approval – Assign PM",
              route: "/api/email/send-dqc2-assign-pm-internal",
              visibility: "internal",
              payload: {
                to: adminTo,
                cc: adminCc,
                subject: `Action Required – Assign Project Manager for ${pmCustomerName}`,
                customerName: pmCustomerName,
                projectName: pmRow.projectName || undefined,
                projectId: pmProjectId,
                designerName: pmDesignerName,
                branchLocation: pmBranch || undefined,
              },
            });
          }
        } catch (err) {
          console.error("DQC2 assign-PM internal email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }
      } else if (emailRoutePath === "/api/email/send-mom-color-laminate-selection-confirmation") {
        // Material selection meeting completed: MOM Color & Laminate Selection Confirmation
        try {
          const [rows] = await pool.query(
            `SELECT l.project_name as projectName, l.client_email as clientEmail, l.payload, l.assigned_designer_id,
                    u.name as designerName, u.email as designerEmail
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.id = ?`,
            [id],
          );
          const row = (rows as any[])[0];
          if (row) {
            let payload: any = {};
            try {
              payload = row.payload ? JSON.parse(row.payload) : {};
            } catch {
              payload = {};
            }
            const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
            const customerEmail =
              row.clientEmail ||
              formData.email ||
              formData.sales_email ||
              payload?.email ||
              payload?.form?.email ||
              null;
            const customerName =
              formData.customer_name ||
              formData.sales_lead_name ||
              payload?.customer_name ||
              payload?.form?.customer_name ||
              row.projectName ||
              "Customer";
            const designerName = row.designerName || formData.designer_name || formData.designerName || "Designer";
            const laminateSelections = meta?.laminateSelections ?? null;

            console.log("[mom-color-laminate-email] customerEmail:", customerEmail || "MISSING", "| leadId:", id);

            if (customerEmail) {
              // Fetch MOM reference files – prioritization: meta.attachments > (last 10 mins uploads) > Database query
              let attachments: { filename: string; path: string }[] | undefined = (meta?.attachments as any[]) || undefined;

              if (!attachments) {
                try {
                  const [uploadRows] = await pool.query(
                    `SELECT original_name as originalName, s3_url as s3Url, stored_path as storedPath
                     FROM lead_uploads
                     WHERE lead_id = ? AND upload_type = 'mom_attachment' AND status = 'approved'
                     ORDER BY id DESC LIMIT 10`,
                    [id],
                  );
                  const list = (uploadRows as any[]) || [];
                  attachments = list
                    .map((r) => {
                      const name = (r.originalName || "").toString();
                      const url = (r.s3Url || r.storedPath || "").toString();
                      return name && url ? { filename: name, path: url } : null;
                    })
                    .filter((v): v is { filename: string; path: string } => !!v);
                  if (attachments.length === 0) attachments = undefined;
                } catch (attachErr) {
                  console.error("Failed to load MOM attachments (non-fatal)", { leadId: id, error: attachErr });
                }
              }

              const mailChainCc = await getMailLoopCcEmails([actingUser.email, row.designerEmail || null]);
              const mailChainSubject = buildMailChainSubject(id, row.projectName, customerName);
              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 4,
                taskName: "Material selection meeting completed",
                route: emailRoutePath,
                visibility: "external",
                payload: {
                  to: customerEmail,
                  cc: mailChainCc,
                  subject: mailChainSubject,
                  customerName,
                  designerName,
                  laminateSelections,
                  ...(attachments ? { attachments } : {}),
                },
              });
            } else {
              console.warn("[mom-color-laminate-email] Skipped – no customerEmail found for leadId:", id);
            }
          }
        } catch (err) {
          console.error("MOM color laminate selection email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }
      } else if (emailRoutePath === "/api/email/send-design-signoff-meeting-scheduled") {
        // Design sign off (40% milestone): CX only, pass meeting date/time, designer name
        try {
          const [rows] = await pool.query(
            `SELECT l.pid, l.project_name as projectName, l.client_email as clientEmail, l.payload, l.assigned_designer_id,
                    u.name as designerName, u.email as designerEmail
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.id = ?`,
            [id],
          );
          const row = (rows as any[])[0];
          if (row) {
            let payload: any = {};
            try {
              payload = row.payload ? JSON.parse(row.payload) : {};
            } catch {
              payload = {};
            }
            const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
            const customerEmail =
              row.clientEmail ||
              formData.email ||
              formData.sales_email ||
              payload?.email ||
              payload?.form?.email ||
              null;
            const customerName =
              formData.customer_name ||
              formData.sales_lead_name ||
              payload?.customer_name ||
              payload?.form?.customer_name ||
              row.projectName ||
              "Customer";
            const designerName = row.designerName || formData.designer_name || formData.designerName || "Designer";
            const projectId = row.pid || `PJ-${id}`;

            const meetingDate = meta?.meetingDate ?? meta?.signoffDate ?? null;
            const meetingTime = meta?.meetingTime ?? meta?.signoffTime ?? null;
            const meetingMode = meta?.meetingMode ?? null;
            const meetingLink = meta?.meetingLink ?? null;
            const attachments = (meta?.attachments as any[]) || undefined;

            const resolvedEcLocation =
              (meta as any)?.ecLocation ||
              formData.experience_center ||
              payload?.experience_center ||
              payload?.form?.experience_center ||
              "Experience Center";

            if (meetingDate && meetingTime) {
              const googleStart = formatGoogleDateTime(meetingDate, meetingTime);
              if (googleStart) {
                try {
                  await createGoogleCalendarEventForFirstAvailableUser({
                    userIds: [row.assigned_designer_id, actingUser.id],
                    summary: `Design Sign-Off - ${customerName}`,
                    description: `Design sign-off meeting at ${resolvedEcLocation}.`,
                    startDateTimeIso: googleStart,
                    endDateTimeIso: addHoursToIso(googleStart, 1),
                    attendees: distinctEmails([customerEmail, row.designerEmail, actingUser.email]),
                  });
                } catch (calendarErr) {
                  console.error("Design signoff Google event create error (non-fatal)", { leadId: id, error: calendarErr });
                }
              }
            }

            if (customerEmail) {
              const mailChainCc = await getMailLoopCcEmails([actingUser.email, row.designerEmail]);
              const mailChainSubject = buildMailChainSubject(projectId, row.projectName, customerName);
              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 5,
                taskName: "Design sign off",
                route: emailRoutePath,
                visibility: "external",
                payload: {
                  to: customerEmail,
                  cc: mailChainCc,
                  subject: mailChainSubject,
                  customerName,
                  projectId,
                  designerName,
                  meetingDate: meetingDate || undefined,
                  meetingTime: meetingTime || undefined,
                  meetingMode: meetingMode || undefined,
                  meetingLink: meetingLink || undefined,
                  ecLocation: resolvedEcLocation,
                  ...(attachments && attachments.length ? { attachments } : {}),
                },
              });
            }
          }
        } catch (err) {
          console.error("Design signoff meeting scheduled email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }
      } else if (emailRoutePath === "/api/email/send-design-signoff-40pc-payment-request") {
        // 40% collection: CX payment request email; pass amount, bank details, designer
        try {
          const [rows] = await pool.query(
            `SELECT l.project_name as projectName, l.client_email as clientEmail, l.payload, l.assigned_designer_id,
                    u.name as designerName
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.id = ?`,
            [id],
          );
          const row = (rows as any[])[0];
          if (row) {
            let payload: any = {};
            try {
              payload = row.payload ? JSON.parse(row.payload) : {};
            } catch {
              payload = {};
            }
            const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
            const customerEmail =
              row.clientEmail ||
              formData.email ||
              formData.sales_email ||
              payload?.email ||
              payload?.form?.email ||
              null;
            const customerName =
              formData.customer_name ||
              formData.sales_lead_name ||
              payload?.customer_name ||
              payload?.form?.customer_name ||
              row.projectName ||
              "Customer";
            const designerName = row.designerName || formData.designer_name || formData.designerName || "Team HUB Interiors";
            const amount = meta?.amount ?? meta?.amountDue ?? meta?.payableAmount ?? formData.forty_percent_amount ?? payload?.forty_percent_amount ?? null;
            const accountName = meta?.accountName ?? "Brightspace Creation Private Limited";
            const accountNumber = meta?.accountNumber ?? "748305000519";
            const ifscCode = meta?.ifscCode ?? "ICIC0007483";

            if (customerEmail) {
              const mailChainCc = await getMailLoopCcEmails([actingUser.email]);
              const mailChainSubject = buildMailChainSubject(id, row.projectName, customerName);
              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 5,
                taskName: "meeting completed & 40% payment request",
                route: emailRoutePath,
                visibility: "external",
                payload: {
                  to: customerEmail,
                  cc: mailChainCc,
                  subject: mailChainSubject,
                  customerName,
                  designerName,
                  amount: amount != null ? String(amount) : undefined,
                  accountName,
                  accountNumber,
                  ifscCode,
                },
              });
            }
          }
        } catch (err) {
          console.error("40% payment request email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }
      } else if (emailRoutePath === "/api/email/send-dqc2-material-selection-scheduled") {
        // DQC2 material selection: pass meeting date/time, ec location, designer name
        try {
          const [rows] = await pool.query(
            `SELECT l.project_name as projectName, l.client_email as clientEmail, l.payload, l.assigned_designer_id,
                    u.name as designerName, u.email as designerEmail
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.id = ?`,
            [id],
          );
          const row = (rows as any[])[0];
          if (row) {
            let payload: any = {};
            try {
              payload = row.payload ? JSON.parse(row.payload) : {};
            } catch {
              payload = {};
            }
            const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
            const customerEmail =
              row.clientEmail ||
              formData.email ||
              formData.sales_email ||
              payload?.email ||
              payload?.form?.email ||
              null;
            const customerName =
              formData.customer_name ||
              formData.sales_lead_name ||
              payload?.customer_name ||
              payload?.form?.customer_name ||
              row.projectName ||
              "Customer";
            const ecName =
              formData.experience_center ||
              payload?.experience_center ||
              payload?.form?.experience_center ||
              "Experience Center";
            const designerName = row.designerName || formData.designer_name || formData.designerName || "Designer";
            const meetingDate = meta?.meetingDate ?? null;
            const meetingTime = meta?.meetingTime ?? null;
            const meetingMode = meta?.meetingMode ?? null;
            const meetingLink = meta?.meetingLink ?? null;
            const ecLocation = meta?.ecLocation ?? meta?.ecAddress ?? ecName;
            if (meetingDate && meetingTime) {
              const googleStart = formatGoogleDateTime(meetingDate, meetingTime);

              if (googleStart) {
                try {
                  await createGoogleCalendarEventForFirstAvailableUser({
                    userIds: [row.assigned_designer_id, actingUser.id],
                    summary: `Material Selection - ${customerName}`,
                    description: `Material selection meeting at ${ecLocation || ecName}.`,
                    startDateTimeIso: googleStart,
                    endDateTimeIso: addHoursToIso(googleStart, 1),
                    attendees: distinctEmails([customerEmail, row.designerEmail, actingUser.email]),
                  });
                } catch (calendarErr) {
                  console.error("DQC2 material selection Google event create error (non-fatal)", {
                    leadId: id,
                    error: calendarErr,
                  });
                }
              }

              if (customerEmail) {
                const mailChainCc = await getMailLoopCcEmails([
                  actingUser.email,
                  row.designerEmail,
                ]);
                const mailChainSubject = buildMailChainSubject(id, row.projectName, customerName);
                void triggerMailRouteWithLog({
                  leadId: id,
                  milestoneIndex: 4,
                  taskName: "Material selection meeting + quotation discussion",
                  route: emailRoutePath,
                  visibility: "external",
                  payload: {
                    to: customerEmail,
                    cc: mailChainCc,
                    subject: mailChainSubject,
                    customerName,
                    designerName,
                    meetingDate,
                    meetingTime,
                    meetingMode,
                    meetingLink,
                    ecLocation,
                  },
                });
              }
            }
          }
        } catch (err) {
          console.error("DQC2 material selection email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }
      } else if (emailRoutePath === "/api/email/send-production-poc-timeline") {
        // POC mail & Timeline submission: CX only, pass POC details and designer
        try {
          const [rows] = await pool.query(
            `SELECT l.project_name as projectName, l.client_email as clientEmail, l.payload, l.assigned_designer_id,
                    u.name as designerName,
                    pm.name as pmName, pm.email as pmEmail
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_designer_id
             LEFT JOIN users pm ON pm.id = l.assigned_project_manager_id
             WHERE l.id = ?`,
            [id],
          );
          const row = (rows as any[])[0];
          if (row) {
            let payload: any = {};
            try {
              payload = row.payload ? JSON.parse(row.payload) : {};
            } catch {
              payload = {};
            }
            const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
            const customerEmail =
              row.clientEmail ||
              formData.client_email ||
              formData.email ||
              formData.customer_email ||
              payload?.email ||
              payload?.customer_email ||
              payload?.form?.email ||
              null;

            if (customerEmail) {
              const customerName =
                formData.customer_name ||
                formData.sales_lead_name ||
                payload?.customer_name ||
                payload?.form?.customer_name ||
                row.projectName ||
                "Customer";
              const designerName = row.designerName || formData.designer_name || formData.designerName || "Designer";
              const productionPoc = meta?.productionPoc ?? "Prajwal - prajwal@hubinterior.com";
              const executionPoc = row.pmName && row.pmEmail ? `${row.pmName} - ${row.pmEmail}` : (meta?.executionPoc ?? "Project Manager - PM automatically");
              const spmPoc = meta?.spmPoc ?? "Dummy SPM - dummy.spm@hubinterior.com";
              const operationManager = meta?.operationManager ?? "Balaji - balaji@hubinterior.com";
              const operationHead = meta?.operationHead ?? "Alex - alex@hubinterior.com";
              const mailChainCc = await getMailLoopCcEmails([actingUser.email]);
              const mailChainSubject = buildMailChainSubject(id, row.projectName, customerName);
              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 6,
                taskName: "POC mail & Timeline submission",
                route: emailRoutePath,
                visibility: "external",
                payload: {
                  to: customerEmail,
                  cc: mailChainCc,
                  subject: mailChainSubject,
                  customerName,
                  designerName,
                  productionPoc,
                  executionPoc,
                  spmPoc,
                  operationManager,
                  operationHead,
                },
              });
            } else {
              console.warn("[complete-task] No customer email found for POC timeline email", { leadId: id });
            }
          }
        } catch (err) {
          console.error("Production POC timeline email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }
      } else if (emailRoutePath === "/api/email/send-production-approval-request") {
        // Cx approval for production: CX only, pass designer name
        try {
          const [rows] = await pool.query(
            `SELECT l.project_name as projectName, l.client_email as clientEmail, l.payload, l.assigned_designer_id,
                    u.name as designerName
             FROM leads l
             LEFT JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.id = ?`,
            [id],
          );
          const row = (rows as any[])[0];
          if (row) {
            let payload: any = {};
            try {
              payload = row.payload ? JSON.parse(row.payload) : {};
            } catch {
              payload = {};
            }
            const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
            const customerEmail =
              row.clientEmail ||
              formData.client_email ||
              formData.email ||
              formData.customer_email ||
              payload?.email ||
              payload?.customer_email ||
              payload?.form?.email ||
              null;

            if (customerEmail) {
              const customerName =
                formData.customer_name ||
                formData.sales_lead_name ||
                payload?.customer_name ||
                payload?.form?.customer_name ||
                row.projectName ||
                "Customer";
              const designerName = row.designerName || formData.designer_name || formData.designerName || "Team HUB Interiors";
              const mailChainCc = await getMailLoopCcEmails([actingUser.email]);
              const mailChainSubject = buildMailChainSubject(id, row.projectName, customerName);
              void triggerMailRouteWithLog({
                leadId: id,
                milestoneIndex: 6,
                taskName: "Cx approval for production",
                route: emailRoutePath,
                visibility: "external",
                payload: {
                  to: customerEmail,
                  cc: mailChainCc,
                  subject: mailChainSubject,
                  customerName,
                  designerName,
                },
              });
            } else {
              console.warn("[complete-task] No customer email found for Production approval email", { leadId: id });
            }
          }
        } catch (err) {
          console.error("Production approval request email prepare error (non-fatal)", {
            leadId: id,
            error: err,
          });
        }
      } else {
        triggerCustomerEmailForLead(id, emailRoutePath, { actorEmail: actingUser.email || null }).catch((err) => {
          console.error("complete-task email trigger error (non-fatal)", {
            leadId: id,
            milestoneIndex,
            taskName,
            route: emailRoutePath,
            error: err,
          });
        });
      }
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("complete-task error", err);
    return res.status(500).json({ message: "Failed to save completion" });
  }
});

// Trigger mail loop chain initiation mail (SMTP-backed).
app.post("/api/leads/:id/mail-loop-chain-initiate", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const actingUser = await getUserFromSession(req);
    if (!actingUser) return res.status(401).json({ message: "Unauthorized" });

    await triggerCustomerEmailForLead(
      id,
      "/api/email/send-mail-loop-chain-initiate",
      { actorEmail: actingUser.email || null },
    );

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("mail-loop-chain-initiate error", { leadId: id, error: err });
    return res.status(500).json({ message: "Failed to start mail chain" });
  }
});

// Get all completed tasks for a lead (used to hydrate milestone progress on load)
app.get("/api/leads/:id/completions", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const [rows] = await pool.query(
      "SELECT milestone_index as milestoneIndex, task_name as taskName FROM lead_task_completions WHERE lead_id = ?",
      [id],
    );
    return res.json(rows);
  } catch (err) {
    console.error("lead completions error", err);
    return res.status(500).json({ message: "Failed to load completions" });
  }
});

// ----- Finance 10% payment: queue (limited fields), upload screenshots, approve -----
// Finance team sees only leads at 10% payment stage with id, name, status, upload, approve.
app.get("/api/leads/finance-10p-queue", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user?.role ?? "").toLowerCase();
    if (role !== "finance" && role !== "admin") {
      return res.status(403).json({ message: "Only finance or admin can access this queue" });
    }
    const [allLeads] = await pool.query(
      "SELECT id, project_name as projectName, project_stage as projectStage FROM leads ORDER BY id ASC"
    );
    const leads = allLeads as { id: number; projectName: string; projectStage: string }[];
    const [completions] = await pool.query(
      "SELECT lead_id as leadId, milestone_index as milestoneIndex, task_name as taskName FROM lead_task_completions"
    );
    const compList = completions as { leadId: number; milestoneIndex: number; taskName: string }[];
    const hasDqc1Approval = (leadId: number) =>
      compList.some((c) => c.leadId === leadId && c.milestoneIndex === 1 && c.taskName === "DQC 1 approval");
    const has10pCollection = (leadId: number) =>
      compList.some((c) => c.leadId === leadId && c.milestoneIndex === 2 && c.taskName === "10% payment collection");
    const has10pApproval = (leadId: number) =>
      compList.some((c) => c.leadId === leadId && c.milestoneIndex === 2 && c.taskName === "10% payment approval");
    const at10p = leads.filter((l) => hasDqc1Approval(l.id) && !has10pApproval(l.id));
    const list = at10p.map((l) => ({
      id: l.id,
      projectName: l.projectName || "—",
      status: has10pCollection(l.id) ? "Pending approval" : "Pending upload",
      canApprove: has10pCollection(l.id),
    }));
    return res.json(list);
  } catch (err) {
    console.error("finance-10p-queue error", err);
    return res.status(500).json({ message: "Failed to load queue" });
  }
});

// Project/lead side: upload 10% payment screenshots for finance to review and approve. Any authenticated user.
app.post(
  "/api/leads/:id/10p-payment-upload",
  upload.array("files"),
  async (req: Request, res: Response) => {
    const leadId = Number(req.params.id);
    if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
    const files = (req as any).files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) return res.status(400).json({ message: "At least one file is required" });
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const now = new Date();
      for (const file of files) {
        let s3Url: string | null = null;
        if (process.env.AWS_ACCESS_KEY_ID) {
          s3Url = await uploadLeadFileToS3(leadId, file.path, file.originalname, file.mimetype);
        }
        await pool.query(
          `INSERT INTO lead_uploads
           (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'payment_10p', ?)`,
          [leadId, user.id, file.originalname, file.filename, file.path, file.mimetype, file.size, now, s3Url]
        );
      }
      const ev = {
        id: `10p-upload-${Date.now()}`,
        type: "file_upload",
        taskName: "10% payment collection",
        milestoneName: "10% PAYMENT",
        timestamp: now.toISOString(),
        description: `10% payment screenshots uploaded for finance review: ${files.map((f) => f.originalname).join(", ")}`,
        user: { name: user.name ?? "User" },
        details: { kind: "payment_10p", fileNames: files.map((f) => f.originalname) },
      };
      await addLeadHistoryEvent(leadId, ev);
      const [rows] = await pool.query(
        "SELECT 1 FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 2 AND task_name = ?",
        [leadId, "10% payment collection"]
      );
      if ((rows as any[]).length === 0) {
        await pool.query(
          `INSERT INTO lead_task_completions (lead_id, milestone_index, task_name, completed_at)
           VALUES (?, 2, '10% payment collection', ?)
           ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at)`,
          [leadId, now]
        );
      }
      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("10p-payment-upload error", err);
      return res.status(500).json({ message: "Failed to upload" });
    }
  }
);

// Finance: upload payment screenshot(s) for a lead. Marks "10% payment collection" complete on first upload.
app.post(
  "/api/leads/:id/payment-screenshots",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const leadId = Number(req.params.id);
    if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ message: "file is required" });
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user?.role ?? "").toLowerCase();
      if (role !== "finance" && role !== "admin") {
        return res.status(403).json({ message: "Only finance can upload payment screenshots" });
      }
      const now = new Date();
      let s3Url: string | null = null;
      if (process.env.AWS_ACCESS_KEY_ID) {
        s3Url = await uploadLeadFileToS3(leadId, file.path, file.originalname, file.mimetype);
      }
      await pool.query(
        `INSERT INTO lead_uploads
         (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'payment_screenshot', ?)`,
        [leadId, user.id, file.originalname, file.filename, file.path, file.mimetype, file.size, now, s3Url]
      );
      const ev = {
        id: `payment-screenshot-${Date.now()}`,
        type: "file_upload",
        taskName: "10% payment collection",
        milestoneName: "10% PAYMENT",
        timestamp: now.toISOString(),
        description: `Payment screenshot uploaded: ${file.originalname}`,
        user: { name: user.name ?? "Finance" },
        details: { kind: "payment_screenshot", fileName: file.originalname },
      };
      await addLeadHistoryEvent(leadId, ev);
      const [rows] = await pool.query(
        "SELECT 1 FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 2 AND task_name = ?",
        [leadId, "10% payment collection"]
      );
      if ((rows as any[]).length === 0) {
        await pool.query(
          `INSERT INTO lead_task_completions (lead_id, milestone_index, task_name, completed_at)
           VALUES (?, 2, '10% payment collection', ?)
           ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at)`,
          [leadId, now]
        );
      }
      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("payment-screenshots error", err);
      return res.status(500).json({ message: "Failed to upload" });
    }
  }
);

// Finance: approve 10% payment (marks "10% payment approval" complete; lead moves to next stage)
app.post("/api/leads/:id/approve-10p-payment", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user?.role ?? "").toLowerCase();
    if (role !== "finance" && role !== "admin") {
      return res.status(403).json({ message: "Only finance can approve 10% payment" });
    }
    const now = new Date();
    await pool.query(
      `INSERT INTO lead_task_completions (lead_id, milestone_index, task_name, completed_at)
       VALUES (?, 2, '10% payment approval', ?)
       ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at)`,
      [leadId, now]
    );
    await pool.query(
      "UPDATE lead_uploads SET status = 'approved' WHERE lead_id = ? AND upload_type = 'payment_10p' AND status = 'pending'",
      [leadId]
    );
    const ev = {
      id: `10p-approval-${Date.now()}`,
      type: "note",
      taskName: "10% payment approval",
      milestoneName: "10% PAYMENT",
      timestamp: now.toISOString(),
      description: "10% payment approved by Finance.",
      user: { name: user.name ?? "Finance" },
      details: { kind: "note", noteText: "10% payment approved. Lead moves to next stage." },
    };
    await addLeadHistoryEvent(leadId, ev);
    // Fire-and-forget: trigger 10% payment approval email (custom template with receipt details)
    try {
      const [rows] = await pool.query(
        "SELECT pid, project_name as projectName, client_email as clientEmail, payload FROM leads WHERE id = ?",
        [leadId],
      );
      const row = (rows as any[])[0];
      if (row) {
        let payload: any = {};
        try {
          payload = row.payload ? JSON.parse(row.payload) : {};
        } catch {
          payload = {};
        }
        const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
        const customerEmail =
          row.clientEmail ||
          formData.email ||
          formData.sales_email ||
          payload?.email ||
          payload?.form?.email ||
          null;
        const customerName =
          formData.customer_name ||
          formData.sales_lead_name ||
          payload.customer_name ||
          payload?.form?.customer_name ||
          row.projectName ||
          "Customer";
        const projectId = row.pid || `PJ-${leadId}`;
        const rawOrderValue = formData.order_value ?? payload.order_value ?? null;
        let amountPaid: string | undefined;
        if (typeof rawOrderValue === "number") {
          amountPaid = `₹${(rawOrderValue * 0.1).toFixed(0)}`;
        } else if (typeof rawOrderValue === "string" && rawOrderValue.trim()) {
          const num = Number(rawOrderValue.replace(/[^0-9.]/g, ""));
          if (!Number.isNaN(num) && num > 0) {
            amountPaid = `₹${(num * 0.1).toFixed(0)}`;
          }
        }
        const paymentDate = now.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const transactionRef = projectId ? `${projectId}-10PCT-${Date.now()}` : `10PCT-${Date.now()}`;

        // Collect approved payment screenshots (if any) to attach to the email when S3 URLs are available.
        let attachments: { filename: string; path: string }[] | undefined;
        if (process.env.AWS_ACCESS_KEY_ID) {
          try {
            const [uploadRows] = await pool.query(
              `SELECT original_name as originalName, s3_url as s3Url
               FROM lead_uploads
               WHERE lead_id = ? AND upload_type = 'payment_screenshot' AND status = 'approved' AND s3_url IS NOT NULL`,
              [leadId],
            );
            const list = (uploadRows as any[]) || [];
            attachments = list
              .map((r) => {
                const name = (r.originalName || "").toString();
                const url = (r.s3Url || "").toString();
                return name && url ? { filename: name, path: url } : null;
              })
              .filter((v): v is { filename: string; path: string } => !!v);
            if (attachments.length === 0) {
              attachments = undefined;
            }
          } catch (attachErr) {
            console.error("Failed to load payment screenshot attachments (non-fatal)", {
              leadId,
              error: attachErr,
            });
          }
        }

        if (customerEmail) {
          const mailChainCc = await getMailLoopCcEmails([user.email || null]);
          const mailChainSubject = buildMailChainSubject(projectId, row.projectName, customerName);
          void triggerMailRouteWithLog({
            leadId,
            milestoneIndex: 2,
            taskName: "10% payment approval",
            route: "/api/email/send-ten-percent-payment-approval",
            visibility: "external",
            payload: {
              to: customerEmail,
              cc: mailChainCc,
              subject: mailChainSubject,
              customerName,
              projectId: projectId || undefined,
              amountPaid: amountPaid || undefined,
              paymentDate,
              transactionRef,
              ...(attachments ? { attachments } : {}),
            },
          });
        }
      }
    } catch (emailErr) {
      console.error("10% payment approval email prepare error (non-fatal)", emailErr);
    }
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("approve-10p-payment error", err);
    return res.status(500).json({ message: "Failed to approve" });
  }
});

// Project/lead side: upload 40% payment screenshots for finance to review and approve. Any authenticated user.
app.post(
  "/api/leads/:id/40p-payment-upload",
  upload.array("files"),
  async (req: Request, res: Response) => {
    const leadId = Number(req.params.id);
    if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
    const files = (req as any).files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) return res.status(400).json({ message: "At least one file is required" });
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const now = new Date();
      for (const file of files) {
        let s3Url: string | null = null;
        if (process.env.AWS_ACCESS_KEY_ID) {
          s3Url = await uploadLeadFileToS3(leadId, file.path, file.originalname, file.mimetype);
        }
        await pool.query(
          `INSERT INTO lead_uploads
           (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'payment_40p', ?)`,
          [leadId, user.id, file.originalname, file.filename, file.path, file.mimetype, file.size, now, s3Url]
        );
      }
      const ev = {
        id: `40p-upload-${Date.now()}`,
        type: "file_upload",
        taskName: "40% collection",
        milestoneName: "40% PAYMENT",
        timestamp: now.toISOString(),
        description: `40% payment screenshots uploaded for finance review: ${files.map((f) => f.originalname).join(", ")}`,
        user: { name: user.name ?? "User" },
        details: { kind: "payment_40p", fileNames: files.map((f) => f.originalname) },
      };
      await addLeadHistoryEvent(leadId, ev);
      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("40p-payment-upload error", err);
      return res.status(500).json({ message: "Failed to upload" });
    }
  }
);

// ----- Finance 40% payment: same as 10% – queue, upload screenshots, approve -----
app.get("/api/leads/finance-40p-queue", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user?.role ?? "").toLowerCase();
    if (role !== "finance" && role !== "admin") {
      return res.status(403).json({ message: "Only finance or admin can access this queue" });
    }
    const [allLeads] = await pool.query(
      "SELECT id, project_name as projectName FROM leads ORDER BY id ASC"
    );
    const leads = allLeads as { id: number; projectName: string }[];
    const [completions] = await pool.query(
      "SELECT lead_id as leadId, milestone_index as milestoneIndex, task_name as taskName FROM lead_task_completions"
    );
    const compList = completions as { leadId: number; milestoneIndex: number; taskName: string }[];
    const has40pCollectionDone = (leadId: number) =>
      compList.some(
        (c) =>
          c.leadId === leadId &&
          c.milestoneIndex === 5 &&
          (c.taskName === "40% collection" ||
            c.taskName === "meeting completed & 40% payment request"),
      );
    const has40pApproval = (leadId: number) =>
      compList.some((c) => c.leadId === leadId && c.milestoneIndex === 5 && c.taskName === "40% payment approval");
    const [uploadRows] = await pool.query(
      "SELECT lead_id as leadId FROM lead_uploads WHERE upload_type = 'payment_40p'"
    );
    const has40pUpload = (leadId: number) =>
      (uploadRows as { leadId: number }[]).some((r) => r.leadId === leadId);
    const at40p = leads.filter((l) => has40pCollectionDone(l.id) && !has40pApproval(l.id));
    const list = at40p.map((l) => ({
      id: l.id,
      projectName: l.projectName || "—",
      status: has40pUpload(l.id) ? "Pending approval" : "Pending upload",
      canApprove: has40pUpload(l.id),
    }));
    return res.json(list);
  } catch (err) {
    console.error("finance-40p-queue error", err);
    return res.status(500).json({ message: "Failed to load queue" });
  }
});

app.post(
  "/api/leads/:id/payment-40p-screenshots",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const leadId = Number(req.params.id);
    if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ message: "file is required" });
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user?.role ?? "").toLowerCase();
      if (role !== "finance" && role !== "admin") {
        return res.status(403).json({ message: "Only finance can upload 40% payment screenshots" });
      }
      const now = new Date();
      let s3Url: string | null = null;
      if (process.env.AWS_ACCESS_KEY_ID) {
        s3Url = await uploadLeadFileToS3(leadId, file.path, file.originalname, file.mimetype);
      }
      await pool.query(
        `INSERT INTO lead_uploads
         (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'payment_40p', ?)`,
        [leadId, user.id, file.originalname, file.filename, file.path, file.mimetype, file.size, now, s3Url]
      );
      const ev = {
        id: `payment-40p-screenshot-${Date.now()}`,
        type: "file_upload",
        taskName: "40% collection",
        milestoneName: "40% PAYMENT",
        timestamp: now.toISOString(),
        description: `40% payment screenshot uploaded: ${file.originalname}`,
        user: { name: user.name ?? "Finance" },
        details: { kind: "payment_40p", fileName: file.originalname },
      };
      await addLeadHistoryEvent(leadId, ev);
      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("payment-40p-screenshots error", err);
      return res.status(500).json({ message: "Failed to upload" });
    }
  }
);

app.post("/api/leads/:id/approve-40p-payment", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user?.role ?? "").toLowerCase();
    if (role !== "finance" && role !== "admin") {
      return res.status(403).json({ message: "Only finance can approve 40% payment" });
    }
    const now = new Date();
    await pool.query(
      `INSERT INTO lead_task_completions (lead_id, milestone_index, task_name, completed_at)
       VALUES (?, 5, '40% payment approval', ?)
       ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at)`,
      [leadId, now]
    );
    await pool.query(
      "UPDATE lead_uploads SET status = 'approved' WHERE lead_id = ? AND upload_type = 'payment_40p' AND status = 'pending'",
      [leadId]
    );
    const ev = {
      id: `40p-approval-${Date.now()}`,
      type: "note",
      taskName: "40% payment approval",
      milestoneName: "40% PAYMENT",
      timestamp: now.toISOString(),
      description: "40% payment approved by Finance.",
      user: { name: user.name ?? "Finance" },
      details: { kind: "note", noteText: "40% payment approved. Lead moves to next stage." },
    };
    await addLeadHistoryEvent(leadId, ev);
    // Fire-and-forget: trigger 40% payment approval CX email (receipt)
    try {
      const [rows] = await pool.query(
        "SELECT project_name as projectName, client_email as clientEmail, payload FROM leads WHERE id = ?",
        [leadId],
      );
      const row = (rows as any[])[0];
      if (row?.clientEmail) {
        let payload: any = {};
        try {
          payload = row.payload ? JSON.parse(row.payload) : {};
        } catch {
          payload = {};
        }
        const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
        const customerName =
          formData.customer_name ||
          formData.sales_lead_name ||
          payload?.customer_name ||
          payload?.form?.customer_name ||
          row.projectName ||
          "Customer";
        const projectName = row.projectName || customerName || "Project";
        const dateStr = now.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        // Collect approved 40% payment screenshots (if any) to attach when S3 URLs are available.
        let attachments: { filename: string; path: string }[] | undefined;
        if (process.env.AWS_ACCESS_KEY_ID) {
          try {
            const [uploadRows] = await pool.query(
              `SELECT original_name as originalName, s3_url as s3Url
               FROM lead_uploads
               WHERE lead_id = ? AND upload_type = 'payment_40p' AND status = 'approved' AND s3_url IS NOT NULL`,
              [leadId],
            );
            const list = (uploadRows as any[]) || [];
            attachments = list
              .map((r) => {
                const name = (r.originalName || "").toString();
                const url = (r.s3Url || "").toString();
                return name && url ? { filename: name, path: url } : null;
              })
              .filter((v): v is { filename: string; path: string } => !!v);
            if (attachments.length === 0) {
              attachments = undefined;
            }
          } catch (attachErr) {
            console.error("Failed to load 40% payment attachments (non-fatal)", {
              leadId,
              error: attachErr,
            });
          }
        }

        void triggerMailRouteWithLog({
          leadId,
          milestoneIndex: 5,
          taskName: "40% payment approval",
          route: "/api/email/send-design-signoff-40pc-payment-approval",
          visibility: "external",
          payload: {
            to: row.clientEmail,
            cc: await getMailLoopCcEmails([user.email || null]),
            subject: buildMailChainSubject(leadId, row.projectName, customerName),
            customerName,
            projectName,
            amountReceived: formData.forty_percent_amount ?? payload?.forty_percent_amount ?? undefined,
            dateOfReceipt: dateStr,
            modeOfPayment: "Bank Transfer",
            ...(attachments ? { attachments } : {}),
          },
        });
      }
    } catch (e) {
      console.error("40% payment approval email prepare error (non-fatal)", e);
    }
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("approve-40p-payment error", err);
    return res.status(500).json({ message: "Failed to approve" });
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
      const now = new Date();
      let s3Url: string | null = null;
      if (process.env.AWS_ACCESS_KEY_ID) {
        s3Url = await uploadLeadFileToS3(leadId, file.path, file.originalname, file.mimetype);
      }
      await pool.query(
        `INSERT INTO lead_uploads
         (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, s3_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          leadId,
          uploaderId,
          file.originalname,
          file.filename,
          file.path,
          file.mimetype,
          file.size,
          now,
          status,
          s3Url,
        ],
      );

      const uploadType = (req.body?.uploadType as string) || "";
      const isD2 = uploadType === "d2_masking";
      const ev = {
        id: `upload-${Date.now()}`,
        type: "file_upload",
        taskName: isD2 ? "D2 - files upload" : "MMT upload",
        milestoneName: isD2 ? "D2 SITE MASKING" : "D1 SITE MEASUREMENT",
        timestamp: new Date().toISOString(),
        description: isD2 ? `D2 files uploaded: ${file.originalname}` : `MMT uploaded files: ${file.originalname}`,
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

app.post("/api/leads/:id/schedule-meeting-invite", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });

  try {
    const actingUser = await getUserFromSession(req);
    if (!actingUser) return res.status(401).json({ message: "Unauthorized" });

    const role = (actingUser.role || "").toLowerCase();
    const allowed = ["designer", "design_manager", "territorial_design_manager", "admin"];
    if (!allowed.includes(role)) {
      return res.status(403).json({ message: "Not allowed to send meeting invites" });
    }

    const {
      meetingType,
      meetingDate,
      meetingTime,
      meetingLink,
      meetingMode,
      ecLocation,
      attachments,
    } = req.body || {};

    if (!meetingType || !meetingDate || !meetingTime) {
      return res.status(400).json({ message: "meetingType, meetingDate and meetingTime are required" });
    }

    const [rows] = await pool.query(
      `SELECT l.pid, l.project_name as projectName, l.client_email as clientEmail, l.payload, l.assigned_designer_id,
              u.name as designerName, u.email as designerEmail
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_designer_id
       WHERE l.id = ?`,
      [leadId],
    );
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ message: "Lead not found" });

    let payload: any = {};
    try {
      payload = row.payload ? JSON.parse(row.payload) : {};
    } catch {
      payload = {};
    }

    const formData = payload?.formData || payload?.form_data || payload?.form || payload || {};
    const customerEmail =
      row.clientEmail ||
      formData.email ||
      formData.sales_email ||
      payload?.email ||
      payload?.form?.email ||
      null;
    const customerName =
      formData.customer_name ||
      formData.sales_lead_name ||
      payload?.customer_name ||
      payload?.form?.customer_name ||
      row.projectName ||
      "Customer";
    const designerName = row.designerName || formData.designer_name || formData.designerName || "Designer";
    const projectId = row.pid || `PJ-${leadId}`;
    const eventStart = formatGoogleDateTime(meetingDate, meetingTime);
    if (!eventStart) {
      return res.status(400).json({ message: "Invalid meeting date/time" });
    }

    let summary = "";
    let description = "";
    let emailRoutePath = "";
    let emailBody: Record<string, unknown> = {};

    const resolvedEcLocation =
      ecLocation ||
      formData.experience_center ||
      payload?.experience_center ||
      payload?.form?.experience_center ||
      "Experience Center";

    if (meetingType === "dqc2_material_selection") {
      summary = `Material Selection - ${customerName}`;
      description = [
        `Material selection meeting at ${resolvedEcLocation}.`,
        meetingMode ? `Mode: ${meetingMode}` : null,
        meetingLink ? `Meeting link: ${meetingLink}` : null,
      ].filter(Boolean).join("\n");
      emailRoutePath = "/api/email/send-dqc2-material-selection-scheduled";
      emailBody = {
        to: customerEmail,
        cc: await getMailLoopCcEmails([actingUser.email, row.designerEmail]),
        subject: buildMailChainSubject(projectId, row.projectName, customerName),
        customerName,
        projectId,
        designerName,
        meetingDate,
        meetingTime,
        meetingMode,
        meetingLink,
        ecLocation: resolvedEcLocation,
        ...(Array.isArray(attachments) && attachments.length ? { attachments } : {}),
      };
    } else if (meetingType === "design_signoff") {
      summary = `Design Sign-Off - ${customerName}`;
      description = [
        `Design sign-off meeting at ${resolvedEcLocation}.`,
        meetingMode ? `Mode: ${meetingMode}` : null,
        meetingLink ? `Meeting link: ${meetingLink}` : null,
      ].filter(Boolean).join("\n");
      emailRoutePath = "/api/email/send-design-signoff-meeting-scheduled";
      emailBody = {
        to: customerEmail,
        cc: await getMailLoopCcEmails([actingUser.email, row.designerEmail]),
        subject: buildMailChainSubject(projectId, row.projectName, customerName),
        customerName,
        projectId,
        designerName,
        meetingDate,
        meetingTime,
        meetingMode,
        meetingLink,
        ecLocation: resolvedEcLocation,
        ...(Array.isArray(attachments) && attachments.length ? { attachments } : {}),
      };
    } else {
      return res.status(400).json({ message: "Unsupported meetingType" });
    }

    try {
      await createGoogleCalendarEventForFirstAvailableUser({
        userIds: [row.assigned_designer_id, actingUser.id],
        summary,
        description,
        startDateTimeIso: eventStart,
        endDateTimeIso: addHoursToIso(eventStart, 1),
        attendees: distinctEmails([customerEmail, row.designerEmail, actingUser.email]),
      });
    } catch (calendarErr) {
      console.error("meeting invite Google event create error (non-fatal)", {
        leadId,
        meetingType,
        error: calendarErr,
      });
    }

    if (customerEmail) {
      void triggerMailRouteWithLog({
        leadId,
        taskName: `Schedule ${meetingType} invite`,
        route: emailRoutePath,
        visibility: "external",
        payload: emailBody,
      });
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("schedule-meeting-invite error", err);
    return res.status(500).json({ message: "Failed to schedule meeting invite" });
  }
});

// Material selection file upload – stores files and returns paths (NO email side-effect)
app.post(
  "/api/leads/:id/material-selection-upload",
  upload.array("files"),
  async (req: Request, res: Response) => {
    const leadId = Number(req.params.id);
    if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user?.role ?? "").toLowerCase();
      const allowed = ["designer", "design_manager", "territorial_design_manager", "admin"];
      if (!allowed.includes(role)) {
        return res.status(403).json({ message: "Not allowed to upload material selection files" });
      }
      const files = (req as any).files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "At least one file is required" });
      }
      const now = new Date();
      const attachments: { filename: string; path: string }[] = [];

      for (const file of files) {
        let s3Url: string | null = null;
        if (process.env.AWS_ACCESS_KEY_ID) {
          s3Url = await uploadLeadFileToS3(leadId, file.path, file.originalname, file.mimetype);
        }
        await pool.query(
          `INSERT INTO lead_uploads
           (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'material_selection', ?)`,
          [leadId, user.id, file.originalname, file.filename, file.path, file.mimetype, file.size, now, s3Url],
        );
        const filePath = s3Url || file.path;
        if (filePath) {
          attachments.push({ filename: file.originalname, path: filePath });
        }
      }

      return res.status(201).json({ ok: true, attachments });
    } catch (err) {
      console.error("material-selection-upload error", err);
      return res.status(500).json({ message: "Failed to upload material selection files" });
    }
  },
);

// List uploads for a lead (designers see only approved; MMT manager/executive and Finance see all with status)
app.get("/api/leads/:id/uploads", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId))
    return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    const role = (user?.role ?? "").toLowerCase();
    const isMmt = role === "mmt_manager" || role === "mmt_executive";
    const seesAllUploadStatuses =
      role === "finance" || role === "admin" || role === "senior_project_manager";
    let onlyApproved = !isMmt && !seesAllUploadStatuses;
    if (user && role === "project_manager") {
      const [lr] = await pool.query(
        "SELECT assigned_project_manager_id as pmId FROM leads WHERE id = ?",
        [leadId],
      );
      const pmId = (lr as any[])[0]?.pmId;
      if (pmId && Number(pmId) === user.id) {
        onlyApproved = false;
      }
    }

    const [rows] = await pool.query(
      onlyApproved
        ? `SELECT id, original_name as originalName, uploaded_at as uploadedAt, status, upload_type as uploadType, s3_url as s3Url
           FROM lead_uploads WHERE lead_id = ? AND status = 'approved' ORDER BY uploaded_at DESC`
        : `SELECT id, original_name as originalName, uploaded_at as uploadedAt, status, upload_type as uploadType, s3_url as s3Url
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

// Download an upload (designers can only download approved uploads; finance/admin can download pending too)
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
    const isFinance = role === "finance" || role === "admin";
    const [rows] = await pool.query(
      `SELECT stored_path as storedPath, original_name as originalName, status, s3_url as s3Url
       FROM lead_uploads WHERE id = ? AND lead_id = ?`,
      [uploadId, leadId],
    );
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ message: "Not found" });
    if (!isMmt && !isFinance && row.status !== "approved")
      return res.status(403).json({ message: "Only approved uploads are available" });
    if (row.s3Url) {
      try {
        const url = new URL(row.s3Url);
        const key = url.pathname.replace(/^\//, "");
        const obj = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
        if (!obj.Body) return res.status(404).json({ message: "Not found" });
        const name = row.originalName || path.basename(key);
        const ext = path.extname(name).toLowerCase();
        const mime: Record<string, string> = { ".pdf": "application/pdf", ".dwg": "application/acad" };
        res.setHeader("Content-Type", mime[ext] || obj.ContentType || "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/"/g, "%22")}"`);
        await pipeS3BodyToResponse(res, obj.Body);
        return;
      } catch (s3Err) {
        console.error("S3 download error", s3Err);
        return res.status(404).json({ message: "File not found" });
      }
    }
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
    const isFinance = role === "finance" || role === "admin";
    const [rows] = await pool.query(
      `SELECT stored_path as storedPath, original_name as originalName, size_bytes as sizeBytes, status FROM lead_uploads WHERE id = ? AND lead_id = ?`,
      [uploadId, leadId],
    );
    const row = (rows as any[])[0];
    if (!row || !fs.existsSync(row.storedPath)) return res.status(404).json({ message: "Not found" });
    if (!isMmt && !isFinance && row.status !== "approved")
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
    const isFinance = role === "finance" || role === "admin";
    const [rows] = await pool.query(
      `SELECT stored_path as storedPath, original_name as originalName, status, s3_url as s3Url FROM lead_uploads WHERE id = ? AND lead_id = ?`,
      [uploadId, leadId],
    );
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ message: "Not found" });
    if (!isMmt && !isFinance && row.status !== "approved")
      return res.status(403).json({ message: "Only approved uploads are available" });
    const isSingleFile = filePath === row.originalName || filePath === path.basename(row.storedPath);
    if (row.s3Url && isSingleFile) {
      try {
        const url = new URL(row.s3Url);
        const key = url.pathname.replace(/^\//, "");
        const getCmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
        const obj = await s3.send(getCmd);
        if (!obj.Body) return res.status(404).json({ message: "Not found" });
        const ext = path.extname(filePath).toLowerCase();
        const mime: Record<string, string> = {
          ".pdf": "application/pdf",
          ".dwg": "application/acad",
          ".jpg": "image/jpeg",
          ".png": "image/png",
        };
        const contentType = mime[ext] || obj.ContentType || "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `inline; filename="${(row.originalName || path.basename(filePath)).replace(/"/g, "%22")}"`);
        res.setHeader("X-Content-Type-Options", "nosniff");
        await pipeS3BodyToResponse(res, obj.Body);
        return;
      } catch (s3Err) {
        console.error("S3 get file error", s3Err);
        return res.status(404).json({ message: "File not found" });
      }
    }
    if (!fs.existsSync(row.storedPath)) return res.status(404).json({ message: "Not found" });
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

/** Shared DB + history + email for DQC 1 (multipart or S3-direct flow). */
async function persistDqc1SubmissionFromMeta(
  leadId: number,
  user: { id: number; name?: string | null; role?: string | null; email?: string | null },
  drawingFiles: { originalname: string; filename: string; path: string; mimetype: string; size: number }[],
  quotationFiles: { originalname: string; filename: string; path: string; mimetype: string; size: number }[],
  drawingS3Urls: (string | null)[],
  quotationS3Urls: (string | null)[],
): Promise<void> {
  const now = new Date();
  for (let i = 0; i < drawingFiles.length; i++) {
    const drawingFile = drawingFiles[i];
    const drawingS3 = drawingS3Urls[i] ?? null;
    await pool.query(
      `INSERT INTO lead_uploads
       (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'dqc_drawing', ?)`,
      [leadId, user.id, drawingFile.originalname, drawingFile.filename, drawingFile.path, drawingFile.mimetype, drawingFile.size, now, drawingS3],
    );
  }
  for (let i = 0; i < quotationFiles.length; i++) {
    const quotationFile = quotationFiles[i];
    const quotationS3 = quotationS3Urls[i] ?? null;
    await pool.query(
      `INSERT INTO lead_uploads
       (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'dqc_quotation', ?)`,
      [leadId, user.id, quotationFile.originalname, quotationFile.filename, quotationFile.path, quotationFile.mimetype, quotationFile.size, now, quotationS3],
    );
  }
  const ev = {
    id: `dqc-submission-${Date.now()}`,
    type: "file_upload",
    taskName: "DQC 1 submission - dwg + quotation",
    milestoneName: "DQC1",
    timestamp: now.toISOString(),
    description: `DQC submission: ${[...drawingFiles.map((f) => f.originalname), ...quotationFiles.map((f) => f.originalname)].join(", ")}`,
    user: { name: user.name ?? "User" },
    details: {
      kind: "dqc_submission",
      drawings: drawingFiles.map((f) => f.originalname),
      quotations: quotationFiles.map((f) => f.originalname),
    },
  };
  await addLeadHistoryEvent(leadId, ev);

  try {
    const [leadRows] = await pool.query(
      "SELECT project_name as projectName, client_email as clientEmail, payload FROM leads WHERE id = ?",
      [leadId],
    );
    const leadRow = (leadRows as any[])[0];
    if (leadRow) {
      let payload: any = {};
      try {
        payload = leadRow.payload ? JSON.parse(leadRow.payload) : {};
      } catch {
        payload = {};
      }

      const customerName =
        payload.customer_name || payload?.form?.customer_name || leadRow.projectName || "Customer";
      const ecName =
        payload.experience_center || payload?.form?.experience_center || leadRow.experienceCenter || "Experience Center";
      const designerName = user.name || "Designer";
      const projectValue = payload.project_value || payload?.form?.project_value || "";

      const [dqcRows] = await pool.query(
        "SELECT email, name FROM users WHERE role IN ('dqc_manager', 'dqe') AND email IS NOT NULL ORDER BY id ASC",
      );
      const dqcUsers = (dqcRows as any[]).filter((u) => u?.email);
      const primaryDqc = dqcUsers[0];

      if (primaryDqc && primaryDqc.email) {
        const to = primaryDqc.email as string;
        const baseCc = await getMailLoopCcEmails([user?.email || null]);
        const ccList = distinctEmails([
          ...baseCc,
          ...dqcUsers.slice(1).map((u) => String(u.email || "")),
        ]);
        const subject = buildMailChainSubject(leadId, leadRow.projectName, customerName);

        void triggerMailRouteWithLog({
          leadId,
          milestoneIndex: 1,
          taskName: "DQC 1 submission - dwg + quotation",
          route: "/api/email/send-dqc1-review-request-internal",
          visibility: "internal",
          payload: {
            to,
            cc: ccList,
            subject,
            customerName,
            ecName,
            designerName,
            projectValue: String(projectValue || ""),
            dqcRepName: primaryDqc.name || "DQC Team",
            ...(drawingS3Urls.some(Boolean) || quotationS3Urls.some(Boolean)
              ? {
                attachments: [
                  ...drawingFiles
                    .map((f, idx) =>
                      drawingS3Urls[idx]
                        ? { filename: f.originalname, path: drawingS3Urls[idx] as string }
                        : null,
                    )
                    .filter((v): v is { filename: string; path: string } => !!v),
                  ...quotationFiles
                    .map((f, idx) =>
                      quotationS3Urls[idx]
                        ? { filename: f.originalname, path: quotationS3Urls[idx] as string }
                        : null,
                    )
                    .filter((v): v is { filename: string; path: string } => !!v),
                ],
              }
              : {}),
          },
        });
      } else {
        console.warn("DQC1 internal email skipped: no DQC recipient with email", {
          leadId,
          customerName,
          ecName,
        });
      }
    }
  } catch (err) {
    console.error("DQC1 review request internal email prepare error (non-fatal)", {
      leadId,
      error: err,
    });
  }
}

/** DQC 2: DB + history + pending_dqc2 row (multipart or S3-direct). */
async function persistDqc2SubmissionFromMeta(
  leadId: number,
  user: { id: number; name?: string | null; role?: string | null; email?: string | null },
  drawingFiles: { originalname: string; filename: string; path: string; mimetype: string; size: number }[],
  quotationFiles: { originalname: string; filename: string; path: string; mimetype: string; size: number }[],
  drawingS3Urls: (string | null)[],
  quotationS3Urls: (string | null)[],
): Promise<void> {
  const now = new Date();
  for (let i = 0; i < drawingFiles.length; i++) {
    const drawingFile = drawingFiles[i];
    const drawingS3 = drawingS3Urls[i] ?? null;
    await pool.query(
      `INSERT INTO lead_uploads
       (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'dqc2_drawing', ?)`,
      [leadId, user.id, drawingFile.originalname, drawingFile.filename, drawingFile.path, drawingFile.mimetype, drawingFile.size, now, drawingS3],
    );
  }
  for (let i = 0; i < quotationFiles.length; i++) {
    const quotationFile = quotationFiles[i];
    const quotationS3 = quotationS3Urls[i] ?? null;
    await pool.query(
      `INSERT INTO lead_uploads
       (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'dqc2_quotation', ?)`,
      [leadId, user.id, quotationFile.originalname, quotationFile.filename, quotationFile.path, quotationFile.mimetype, quotationFile.size, now, quotationS3],
    );
  }
  const ev = {
    id: `dqc2-submission-${Date.now()}`,
    type: "file_upload",
    taskName: "DQC 2 submission",
    milestoneName: "DQC2",
    timestamp: now.toISOString(),
    description: `DQC 2 submission: ${[...drawingFiles.map((f) => f.originalname), ...quotationFiles.map((f) => f.originalname)].join(", ")}`,
    user: { name: user.name ?? "User" },
    details: {
      kind: "dqc2_submission",
      drawings: drawingFiles.map((f) => f.originalname),
      quotations: quotationFiles.map((f) => f.originalname),
    },
  };
  await addLeadHistoryEvent(leadId, ev);
  await pool.query(
    `INSERT INTO lead_dqc_reviews (lead_id, verdict, remarks, created_at, reviewed_by_user_id)
     VALUES (?, ?, ?, ?, NULL)`,
    [leadId, "pending_dqc2", JSON.stringify([]), now],
  );
}

// ----- DQC 1: browser uploads directly to S3 (bypasses Nginx body limit); then small JSON "complete" calls API -----
app.post("/api/leads/:id/dqc-submission/presign", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  if (!process.env.AWS_ACCESS_KEY_ID) {
    return res.status(501).json({ message: "Direct upload not configured", directUpload: false });
  }
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user?.role ?? "").toLowerCase();
    const allowed = ["designer", "design_manager", "territorial_design_manager", "admin"];
    if (!allowed.includes(role)) return res.status(403).json({ message: "Not allowed to submit DQC" });
    const body = req.body as {
      drawingName?: string;
      drawingMime?: string;
      quotationName?: string;
      quotationMime?: string;
      drawings?: { name?: string; mime?: string }[];
      quotations?: { name?: string; mime?: string }[];
    };
    const drawingsInput =
      Array.isArray(body.drawings) && body.drawings.length > 0
        ? body.drawings
        : [{ name: body.drawingName, mime: body.drawingMime }];
    const quotationsInput =
      Array.isArray(body.quotations) && body.quotations.length > 0
        ? body.quotations
        : [{ name: body.quotationName, mime: body.quotationMime }];
    const validDrawings = drawingsInput
      .map((d) => ({ name: (d?.name || "").trim(), mime: (d?.mime || "application/octet-stream").trim() || "application/octet-stream" }))
      .filter((d) => d.name);
    const validQuotations = quotationsInput
      .map((q) => ({ name: (q?.name || "").trim(), mime: (q?.mime || "application/octet-stream").trim() || "application/octet-stream" }))
      .filter((q) => q.name);
    if (validDrawings.length === 0 || validQuotations.length === 0) {
      return res.status(400).json({ message: "At least one drawing and one quotation are required" });
    }
    const ts = Date.now();
    const drawings = await Promise.all(
      validDrawings.map(async (d, idx) => {
        const safe = d.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `lead-uploads/lead-${leadId}-${ts}-${idx}-drawing-${safe}`;
        const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: d.mime });
        return {
          uploadUrl: await getSignedUrl(s3, cmd, { expiresIn: 900 }),
          key,
          contentType: d.mime,
          publicUrl: buildS3PublicUrl(key),
        };
      }),
    );
    const quotations = await Promise.all(
      validQuotations.map(async (q, idx) => {
        const safe = q.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `lead-uploads/lead-${leadId}-${ts}-${idx}-quotation-${safe}`;
        const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: q.mime });
        return {
          uploadUrl: await getSignedUrl(s3, cmd, { expiresIn: 900 }),
          key,
          contentType: q.mime,
          publicUrl: buildS3PublicUrl(key),
        };
      }),
    );
    return res.json({
      drawings,
      quotations,
    });
  } catch (err) {
    console.error("dqc-submission presign error", err);
    return res.status(500).json({ message: "Failed to prepare upload" });
  }
});

app.post("/api/leads/:id/dqc-submission/complete", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  if (!process.env.AWS_ACCESS_KEY_ID) {
    return res.status(501).json({ message: "Direct upload not configured" });
  }
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user?.role ?? "").toLowerCase();
    const allowed = ["designer", "design_manager", "territorial_design_manager", "admin"];
    if (!allowed.includes(role)) return res.status(403).json({ message: "Not allowed to submit DQC" });
    const body = req.body as {
      drawingKey?: string;
      quotationKey?: string;
      drawingName?: string;
      quotationName?: string;
      drawingKeys?: string[];
      quotationKeys?: string[];
      drawingNames?: string[];
      quotationNames?: string[];
    };
    const drawingKeys =
      Array.isArray(body.drawingKeys) && body.drawingKeys.length > 0
        ? body.drawingKeys.map((k) => (k || "").trim()).filter(Boolean)
        : body.drawingKey?.trim()
          ? [body.drawingKey.trim()]
          : [];
    const quotationKeys =
      Array.isArray(body.quotationKeys) && body.quotationKeys.length > 0
        ? body.quotationKeys.map((k) => (k || "").trim()).filter(Boolean)
        : body.quotationKey?.trim()
          ? [body.quotationKey.trim()]
          : [];
    if (drawingKeys.length === 0 || quotationKeys.length === 0) {
      return res.status(400).json({ message: "At least one drawingKey and one quotationKey are required" });
    }
    const prefix = `lead-uploads/lead-${leadId}-`;
    if (drawingKeys.some((k) => !k.startsWith(prefix)) || quotationKeys.some((k) => !k.startsWith(prefix))) {
      return res.status(400).json({ message: "Invalid keys for this lead" });
    }
    const drawingNamesInput =
      Array.isArray(body.drawingNames) && body.drawingNames.length > 0
        ? body.drawingNames
        : body.drawingName
          ? [body.drawingName]
          : [];
    const quotationNamesInput =
      Array.isArray(body.quotationNames) && body.quotationNames.length > 0
        ? body.quotationNames
        : body.quotationName
          ? [body.quotationName]
          : [];
    const drawingFilesMeta: { originalname: string; filename: string; path: string; mimetype: string; size: number }[] = [];
    const quotationFilesMeta: { originalname: string; filename: string; path: string; mimetype: string; size: number }[] = [];
    const drawingS3Urls: (string | null)[] = [];
    const quotationS3Urls: (string | null)[] = [];
    for (let i = 0; i < drawingKeys.length; i++) {
      const key = drawingKeys[i];
      const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      const local = path.join(UPLOADS_DIR, `${Date.now()}-dqc1-d-${i}-${path.basename(key)}`);
      await streamS3ObjectToDisk(key, local);
      drawingFilesMeta.push({
        originalname: ((drawingNamesInput[i] || path.basename(key)) as string).trim(),
        filename: path.basename(local),
        path: local,
        mimetype: head.ContentType || "application/octet-stream",
        size: Number(head.ContentLength || 0),
      });
      drawingS3Urls.push(buildS3PublicUrl(key));
    }
    for (let i = 0; i < quotationKeys.length; i++) {
      const key = quotationKeys[i];
      const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      const local = path.join(UPLOADS_DIR, `${Date.now()}-dqc1-q-${i}-${path.basename(key)}`);
      await streamS3ObjectToDisk(key, local);
      quotationFilesMeta.push({
        originalname: ((quotationNamesInput[i] || path.basename(key)) as string).trim(),
        filename: path.basename(local),
        path: local,
        mimetype: head.ContentType || "application/octet-stream",
        size: Number(head.ContentLength || 0),
      });
      quotationS3Urls.push(buildS3PublicUrl(key));
    }
    await persistDqc1SubmissionFromMeta(
      leadId,
      user,
      drawingFilesMeta,
      quotationFilesMeta,
      drawingS3Urls,
      quotationS3Urls,
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("dqc-submission complete error", err);
    return res.status(500).json({ message: "Failed to finalize DQC submission" });
  }
});

// ----- DQC 2: same S3-direct flow (keys must contain dqc2-drawing / dqc2-quotation) -----
app.post("/api/leads/:id/dqc2-submission/presign", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  if (!process.env.AWS_ACCESS_KEY_ID) {
    return res.status(501).json({ message: "Direct upload not configured", directUpload: false });
  }
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user?.role ?? "").toLowerCase();
    const allowed = ["designer", "design_manager", "territorial_design_manager", "admin"];
    if (!allowed.includes(role)) return res.status(403).json({ message: "Not allowed to submit DQC" });
    const body = req.body as {
      drawingName?: string;
      drawingMime?: string;
      quotationName?: string;
      quotationMime?: string;
      drawings?: { name?: string; mime?: string }[];
      quotations?: { name?: string; mime?: string }[];
    };
    const drawingsInput =
      Array.isArray(body.drawings) && body.drawings.length > 0
        ? body.drawings
        : [{ name: body.drawingName, mime: body.drawingMime }];
    const quotationsInput =
      Array.isArray(body.quotations) && body.quotations.length > 0
        ? body.quotations
        : [{ name: body.quotationName, mime: body.quotationMime }];
    const validDrawings = drawingsInput
      .map((d) => ({ name: (d?.name || "").trim(), mime: (d?.mime || "application/octet-stream").trim() || "application/octet-stream" }))
      .filter((d) => d.name);
    const validQuotations = quotationsInput
      .map((q) => ({ name: (q?.name || "").trim(), mime: (q?.mime || "application/octet-stream").trim() || "application/octet-stream" }))
      .filter((q) => q.name);
    if (validDrawings.length === 0 || validQuotations.length === 0) {
      return res.status(400).json({ message: "At least one drawing and one quotation are required" });
    }
    const ts = Date.now();
    const drawings = await Promise.all(
      validDrawings.map(async (d, idx) => {
        const safe = d.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `lead-uploads/lead-${leadId}-${ts}-${idx}-dqc2-drawing-${safe}`;
        const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: d.mime });
        return {
          uploadUrl: await getSignedUrl(s3, cmd, { expiresIn: 900 }),
          key,
          contentType: d.mime,
          publicUrl: buildS3PublicUrl(key),
        };
      }),
    );
    const quotations = await Promise.all(
      validQuotations.map(async (q, idx) => {
        const safe = q.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `lead-uploads/lead-${leadId}-${ts}-${idx}-dqc2-quotation-${safe}`;
        const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: q.mime });
        return {
          uploadUrl: await getSignedUrl(s3, cmd, { expiresIn: 900 }),
          key,
          contentType: q.mime,
          publicUrl: buildS3PublicUrl(key),
        };
      }),
    );
    return res.json({
      drawings,
      quotations,
    });
  } catch (err) {
    console.error("dqc2-submission presign error", err);
    return res.status(500).json({ message: "Failed to prepare upload" });
  }
});

app.post("/api/leads/:id/dqc2-submission/complete", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  if (!process.env.AWS_ACCESS_KEY_ID) {
    return res.status(501).json({ message: "Direct upload not configured" });
  }
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user?.role ?? "").toLowerCase();
    const allowed = ["designer", "design_manager", "territorial_design_manager", "admin"];
    if (!allowed.includes(role)) return res.status(403).json({ message: "Not allowed to submit DQC" });
    const body = req.body as {
      drawingKey?: string;
      quotationKey?: string;
      drawingName?: string;
      quotationName?: string;
      drawingKeys?: string[];
      quotationKeys?: string[];
      drawingNames?: string[];
      quotationNames?: string[];
    };
    const drawingKeys =
      Array.isArray(body.drawingKeys) && body.drawingKeys.length > 0
        ? body.drawingKeys.map((k) => (k || "").trim()).filter(Boolean)
        : body.drawingKey?.trim()
          ? [body.drawingKey.trim()]
          : [];
    const quotationKeys =
      Array.isArray(body.quotationKeys) && body.quotationKeys.length > 0
        ? body.quotationKeys.map((k) => (k || "").trim()).filter(Boolean)
        : body.quotationKey?.trim()
          ? [body.quotationKey.trim()]
          : [];
    if (drawingKeys.length === 0 || quotationKeys.length === 0) {
      return res.status(400).json({ message: "At least one drawingKey and one quotationKey are required" });
    }
    const prefix = `lead-uploads/lead-${leadId}-`;
    if (drawingKeys.some((k) => !k.startsWith(prefix)) || quotationKeys.some((k) => !k.startsWith(prefix))) {
      return res.status(400).json({ message: "Invalid keys for this lead" });
    }
    const drawingNamesInput =
      Array.isArray(body.drawingNames) && body.drawingNames.length > 0
        ? body.drawingNames
        : body.drawingName
          ? [body.drawingName]
          : [];
    const quotationNamesInput =
      Array.isArray(body.quotationNames) && body.quotationNames.length > 0
        ? body.quotationNames
        : body.quotationName
          ? [body.quotationName]
          : [];
    const drawingFilesMeta: { originalname: string; filename: string; path: string; mimetype: string; size: number }[] = [];
    const quotationFilesMeta: { originalname: string; filename: string; path: string; mimetype: string; size: number }[] = [];
    const drawingS3Urls: (string | null)[] = [];
    const quotationS3Urls: (string | null)[] = [];
    for (let i = 0; i < drawingKeys.length; i++) {
      const key = drawingKeys[i];
      const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      const local = path.join(UPLOADS_DIR, `${Date.now()}-dqc2-d-${i}-${path.basename(key)}`);
      await streamS3ObjectToDisk(key, local);
      drawingFilesMeta.push({
        originalname: ((drawingNamesInput[i] || path.basename(key)) as string).trim(),
        filename: path.basename(local),
        path: local,
        mimetype: head.ContentType || "application/octet-stream",
        size: Number(head.ContentLength || 0),
      });
      drawingS3Urls.push(buildS3PublicUrl(key));
    }
    for (let i = 0; i < quotationKeys.length; i++) {
      const key = quotationKeys[i];
      const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      const local = path.join(UPLOADS_DIR, `${Date.now()}-dqc2-q-${i}-${path.basename(key)}`);
      await streamS3ObjectToDisk(key, local);
      quotationFilesMeta.push({
        originalname: ((quotationNamesInput[i] || path.basename(key)) as string).trim(),
        filename: path.basename(local),
        path: local,
        mimetype: head.ContentType || "application/octet-stream",
        size: Number(head.ContentLength || 0),
      });
      quotationS3Urls.push(buildS3PublicUrl(key));
    }
    await persistDqc2SubmissionFromMeta(
      leadId,
      user,
      drawingFilesMeta,
      quotationFilesMeta,
      drawingS3Urls,
      quotationS3Urls,
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("dqc2-submission complete error", err);
    return res.status(500).json({ message: "Failed to finalize DQC 2 submission" });
  }
});

// DQC Submission: upload drawing + quotation; stored in lead_uploads with upload_type, status approved (shows in Files + DQC approval)
app.post(
  "/api/leads/:id/dqc-submission",
  upload.fields([{ name: "drawing", maxCount: 20 }, { name: "quotation", maxCount: 20 }]),
  async (req: Request, res: Response) => {
    const leadId = Number(req.params.id);
    if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user?.role ?? "").toLowerCase();
      const allowed = ["designer", "design_manager", "territorial_design_manager", "admin"];
      if (!allowed.includes(role)) return res.status(403).json({ message: "Not allowed to submit DQC" });
      const files = (req as any).files as { drawing?: Express.Multer.File[]; quotation?: Express.Multer.File[] };
      const drawingFiles = files?.drawing ?? [];
      const quotationFiles = files?.quotation ?? [];
      if (drawingFiles.length === 0 || quotationFiles.length === 0) {
        return res.status(400).json({ message: "At least one drawing and one quotation file are required" });
      }
      let drawingS3Urls: (string | null)[] = [];
      let quotationS3Urls: (string | null)[] = [];
      if (process.env.AWS_ACCESS_KEY_ID) {
        drawingS3Urls = await Promise.all(
          drawingFiles.map((f) => uploadLeadFileToS3(leadId, f.path, f.originalname, f.mimetype)),
        );
        quotationS3Urls = await Promise.all(
          quotationFiles.map((f) => uploadLeadFileToS3(leadId, f.path, f.originalname, f.mimetype)),
        );
      }
      await persistDqc1SubmissionFromMeta(leadId, user, drawingFiles, quotationFiles, drawingS3Urls, quotationS3Urls);
      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("dqc-submission error", err);
      return res.status(500).json({ message: "Failed to submit DQC files" });
    }
  },
);

// Meeting completed (Minutes of Meeting): upload MOM text + reference files so they appear in Files card
app.post(
  "/api/leads/:id/mom-upload",
  upload.array("files"),
  async (req: Request, res: Response) => {
    const leadId = Number(req.params.id);
    if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user?.role ?? "").toLowerCase();
      const allowed = ["designer", "design_manager", "territorial_design_manager", "admin"];
      if (!allowed.includes(role)) {
        return res.status(403).json({ message: "Not allowed to submit MOM" });
      }

      const files = (req as any).files as Express.Multer.File[] | undefined;
      const minutesRaw = (req.body as any)?.minutes;
      const minutes = typeof minutesRaw === "string" ? minutesRaw.trim() : "";

      if ((!files || files.length === 0) && !minutes) {
        return res.status(400).json({ message: "Minutes or at least one file is required" });
      }

      const now = new Date();

      const attachments: { filename: string; path: string }[] = [];

      // Save reference files
      if (files && files.length > 0) {
        for (const file of files) {
          let s3Url: string | null = null;
          if (process.env.AWS_ACCESS_KEY_ID) {
            s3Url = await uploadLeadFileToS3(leadId, file.path, file.originalname, file.mimetype);
          }
          await pool.query(
            `INSERT INTO lead_uploads
             (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'mom_attachment', ?)`,
            [leadId, user.id, file.originalname, file.filename, file.path, file.mimetype, file.size, now, s3Url],
          );
          attachments.push({
            filename: file.originalname,
            path: s3Url || file.path,
          });
        }
      }

      // Save MOM minutes as a text file entry
      if (minutes) {
        const baseName = `MOM-${now.toISOString().slice(0, 10)}-${Date.now()}.txt`;
        const storedName = baseName;
        const storedPath = path.join(UPLOADS_DIR, storedName);
        await fs.promises.writeFile(storedPath, minutes, "utf8");
        const sizeBytes = Buffer.byteLength(minutes, "utf8");

        let s3UrlText: string | null = null;
        if (process.env.AWS_ACCESS_KEY_ID) {
          s3UrlText = await uploadLeadFileToS3(leadId, storedPath, baseName, "text/plain");
        }

        await pool.query(
          `INSERT INTO lead_uploads
           (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'mom_minutes', ?)`,
          [leadId, user.id, baseName, storedName, storedPath, "text/plain", sizeBytes, now, s3UrlText],
        );
        // No longer adding minutes file to attachments array as per user request
      }

      const attachmentNames = files && files.length > 0 ? files.map((f) => f.originalname) : [];
      const ev = {
        id: `mom-${Date.now()}`,
        type: "mom",
        taskName: "meeting completed",
        milestoneName: "DQC1",
        timestamp: now.toISOString(),
        description: attachmentNames.length
          ? `Minutes of Meeting recorded with attachments: ${attachmentNames.join(", ")}`
          : "Minutes of Meeting recorded",
        user: { name: user.name ?? "User" },
        details: {
          kind: "mom",
          hasMinutes: !!minutes,
          attachments: attachments.map((a) => ({ name: a.filename })),
        },
      };
      await addLeadHistoryEvent(leadId, ev);

      return res.status(201).json({ ok: true, attachments });
    } catch (err) {
      console.error("mom-upload error", err);
      return res.status(500).json({ message: "Failed to save MOM" });
    }
  },
);

// First cut design upload: files from \"First cut design + quotation discussion\" popup
app.post(
  "/api/leads/:id/first-cut-design-upload",
  upload.array("files"),
  async (req: Request, res: Response) => {
    const leadId = Number(req.params.id);
    if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user?.role ?? "").toLowerCase();
      const allowed = ["designer", "design_manager", "territorial_design_manager", "admin"];
      if (!allowed.includes(role)) {
        return res.status(403).json({ message: "Not allowed to upload first cut design" });
      }
      const files = (req as any).files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "At least one file is required" });
      }
      const now = new Date();
      const meetingDateRaw = (req.body as any)?.meetingDate;
      const meetingTimeRaw = (req.body as any)?.meetingTime;
      const meetingModeRaw = (req.body as any)?.meetingMode;
      const meetingLinkRaw = (req.body as any)?.meetingLink;
      const meetingDate = typeof meetingDateRaw === "string" && meetingDateRaw.trim() ? meetingDateRaw.trim() : null;
      const meetingTime = typeof meetingTimeRaw === "string" && meetingTimeRaw.trim() ? meetingTimeRaw.trim() : null;
      const meetingMode = typeof meetingModeRaw === "string" && meetingModeRaw.trim() ? meetingModeRaw.trim() : null;
      const meetingLink = typeof meetingLinkRaw === "string" && meetingLinkRaw.trim() ? meetingLinkRaw.trim() : null;
      const attachments: { filename: string; path: string }[] = [];
      for (const file of files) {
        let s3Url: string | null = null;
        if (process.env.AWS_ACCESS_KEY_ID) {
          s3Url = await uploadLeadFileToS3(
            leadId,
            file.path,
            file.originalname,
            file.mimetype,
          );
        }
        await pool.query(
          `INSERT INTO lead_uploads
           (lead_id, uploader_id, original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_at, status, upload_type, s3_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'first_cut_design', ?)`,
          [
            leadId,
            user.id,
            file.originalname,
            file.filename,
            file.path,
            file.mimetype,
            file.size,
            now,
            s3Url,
          ],
        );
        if (s3Url) {
          attachments.push({
            filename: file.originalname,
            path: s3Url,
          });
        } else if (file.path) {
          attachments.push({
            filename: file.originalname,
            path: file.path,
          });
        }
      }
      const names = files.map((f) => f.originalname).join(", ");
      const ev = {
        id: `first-cut-design-${Date.now()}`,
        type: "file_upload",
        taskName: "First cut design + quotation discussion meeting request",
        milestoneName: "DQC1",
        timestamp: now.toISOString(),
        description: `First cut design upload: ${names}`,
        user: { name: user.name ?? "User" },
        details: { kind: "first_cut_design", files: files.map((f) => ({ name: f.originalname })) },
      };
      await addLeadHistoryEvent(leadId, ev);

      return res.status(201).json({ ok: true, attachments });
    } catch (err) {
      console.error("first-cut-design-upload error", err);
      return res.status(500).json({ message: "Failed to upload first cut design" });
    }
  },
);

// Get latest DQC submission files for this lead (for DQC Manager / DQE to load in Design QC Review and do quantity check)
app.get("/api/leads/:id/dqc-submission-files", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role ?? "").toLowerCase();
    const canAccess =
      role === "dqc_manager" ||
      role === "dqe" ||
      role === "admin" ||
      role === "senior_project_manager" ||
      role === "designer" ||
      role === "design_manager" ||
      role === "territorial_design_manager";
    if (!canAccess) {
      return res.status(403).json({ message: "Only DQC roles or designers can access DQC submission files" });
    }
    const [rows] = await pool.query(
      `SELECT id, original_name as originalName, upload_type as uploadType
       FROM lead_uploads WHERE lead_id = ? AND upload_type IN ('dqc_drawing', 'dqc_quotation') AND status = 'approved'
       ORDER BY id DESC`,
      [leadId],
    );
    const list = (rows as any[]) || [];
    const uploadType = (r: any) => (r.uploadType ?? r.uploadtype ?? "").toString();
    const originalName = (r: any) => (r.originalName ?? r.originalname ?? "") || "";
    const drawingFiles = list
      .filter((r: any) => uploadType(r) === "dqc_drawing")
      .map((r: any) => ({ id: r.id, originalName: originalName(r) }));
    const quotationFiles = list
      .filter((r: any) => uploadType(r) === "dqc_quotation")
      .map((r: any) => ({ id: r.id, originalName: originalName(r) }));
    const drawing = drawingFiles[0];
    const quotation = quotationFiles[0];
    return res.json({
      drawing: drawing ?? null,
      quotation: quotation ?? null,
      drawingFiles,
      quotationFiles,
    });
  } catch (err) {
    console.error("dqc-submission-files error", err);
    return res.status(500).json({ message: "Failed to load DQC submission files" });
  }
});

// DQC 2 Submission: same as DQC 1 – drawing + quotation; stored as dqc2_drawing, dqc2_quotation
app.post(
  "/api/leads/:id/dqc2-submission",
  upload.fields([{ name: "drawing", maxCount: 20 }, { name: "quotation", maxCount: 20 }]),
  async (req: Request, res: Response) => {
    const leadId = Number(req.params.id);
    if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user?.role ?? "").toLowerCase();
      const allowed = ["designer", "design_manager", "territorial_design_manager", "admin"];
      if (!allowed.includes(role)) return res.status(403).json({ message: "Not allowed to submit DQC" });
      const files = (req as any).files as { drawing?: Express.Multer.File[]; quotation?: Express.Multer.File[] };
      const drawingFiles = files?.drawing ?? [];
      const quotationFiles = files?.quotation ?? [];
      if (drawingFiles.length === 0 || quotationFiles.length === 0) {
        return res.status(400).json({ message: "At least one drawing and one quotation file are required" });
      }
      let drawingS3Urls: (string | null)[] = [];
      let quotationS3Urls: (string | null)[] = [];
      if (process.env.AWS_ACCESS_KEY_ID) {
        drawingS3Urls = await Promise.all(
          drawingFiles.map((f) => uploadLeadFileToS3(leadId, f.path, f.originalname, f.mimetype)),
        );
        quotationS3Urls = await Promise.all(
          quotationFiles.map((f) => uploadLeadFileToS3(leadId, f.path, f.originalname, f.mimetype)),
        );
      }
      await persistDqc2SubmissionFromMeta(leadId, user, drawingFiles, quotationFiles, drawingS3Urls, quotationS3Urls);
      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("dqc2-submission error", err);
      return res.status(500).json({ message: "Failed to submit DQC 2 files" });
    }
  },
);

app.get("/api/leads/:id/dqc2-submission-files", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role ?? "").toLowerCase();
    let canAccess =
      role === "dqc_manager" ||
      role === "dqe" ||
      role === "admin" ||
      role === "senior_project_manager" ||
      role === "designer" ||
      role === "design_manager" ||
      role === "territorial_design_manager";
    if (!canAccess && role === "project_manager") {
      const [lr] = await pool.query(
        "SELECT assigned_project_manager_id as pmId FROM leads WHERE id = ?",
        [leadId],
      );
      const pmId = (lr as any[])[0]?.pmId;
      if (pmId && Number(pmId) === user.id) canAccess = true;
    }
    if (!canAccess) {
      return res.status(403).json({ message: "Only DQC roles or designers can access DQC submission files" });
    }
    const [rows] = await pool.query(
      `SELECT id, original_name as originalName, upload_type as uploadType
       FROM lead_uploads WHERE lead_id = ? AND upload_type IN ('dqc2_drawing', 'dqc2_quotation') AND status = 'approved'
       ORDER BY id DESC`,
      [leadId],
    );
    const list = (rows as any[]) || [];
    const uploadType = (r: any) => (r.uploadType ?? r.uploadtype ?? "").toString();
    const originalName = (r: any) => (r.originalName ?? r.originalname ?? "") || "";
    const drawingFiles = list
      .filter((r: any) => uploadType(r) === "dqc2_drawing")
      .map((r: any) => ({ id: r.id, originalName: originalName(r) }));
    const quotationFiles = list
      .filter((r: any) => uploadType(r) === "dqc2_quotation")
      .map((r: any) => ({ id: r.id, originalName: originalName(r) }));
    const drawing = drawingFiles[0];
    const quotation = quotationFiles[0];
    return res.json({
      drawing: drawing ?? null,
      quotation: quotation ?? null,
      drawingFiles,
      quotationFiles,
    });
  } catch (err) {
    console.error("dqc2-submission-files error", err);
    return res.status(500).json({ message: "Failed to load DQC 2 submission files" });
  }
});

// Save DQC review (verdict + remarks). Used when DQE/DQC manager submits; designers then see remarks and mark as solved.
app.post("/api/leads/:id/dqc-review", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role ?? "").toLowerCase();
    if (role !== "dqc_manager" && role !== "dqe")
      return res.status(403).json({ message: "Only DQC Manager or DQE can submit DQC review" });
    const { verdict, remarks } = req.body || {};
    if (!verdict || !Array.isArray(remarks))
      return res.status(400).json({ message: "verdict and remarks array required" });
    await pool.query(
      `INSERT INTO lead_dqc_reviews (lead_id, verdict, remarks, created_at, reviewed_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [leadId, verdict, JSON.stringify(remarks), new Date(), user.id],
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("dqc-review POST error", err);
    return res.status(500).json({ message: "Failed to save DQC review" });
  }
});

// Get latest DQC review for a lead (designers see remarks and resolved state; DQE/manager can also fetch).
app.get("/api/leads/:id/dqc-review", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const [rows] = await pool.query(
      `SELECT id, verdict, remarks, created_at, reviewed_by_user_id
       FROM lead_dqc_reviews WHERE lead_id = ? ORDER BY id DESC LIMIT 1`,
      [leadId],
    );
    const row = (rows as any[])[0];
    if (!row) return res.json(null);
    const remarks = typeof row.remarks === "string" ? JSON.parse(row.remarks) : row.remarks || [];
    const [resRows] = await pool.query(
      `SELECT remark_index FROM lead_dqc_remark_resolutions WHERE dqc_review_id = ?`,
      [row.id],
    );
    const resolvedSet = new Set((resRows as { remark_index: number }[]).map((r) => r.remark_index));
    const remarksWithResolved = remarks.map((r: any, i: number) => ({
      ...r,
      resolved: resolvedSet.has(i),
    }));
    return res.json({
      id: row.id,
      verdict: row.verdict,
      remarks: remarksWithResolved,
      createdAt: row.created_at,
      reviewedByUserId: row.reviewed_by_user_id,
    });
  } catch (err) {
    console.error("dqc-review GET error", err);
    return res.status(500).json({ message: "Failed to load DQC review" });
  }
});

// Designer: mark a DQC remark as solved/done (no commenting – only "this comment is done").
app.post("/api/leads/:id/dqc-review/remarks/:index/resolve", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  const index = Number(req.params.index);
  if (Number.isNaN(leadId) || Number.isNaN(index) || index < 0)
    return res.status(400).json({ message: "Invalid id or remark index" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role ?? "").toLowerCase();
    if (role !== "designer" && role !== "design_manager")
      return res.status(403).json({ message: "Only designers can mark remarks as solved" });
    const [reviewRows] = await pool.query(
      "SELECT id FROM lead_dqc_reviews WHERE lead_id = ? ORDER BY id DESC LIMIT 1",
      [leadId],
    );
    const review = (reviewRows as any[])[0];
    if (!review) return res.status(404).json({ message: "No DQC review found for this lead" });
    await pool.query(
      `INSERT INTO lead_dqc_remark_resolutions (lead_id, dqc_review_id, remark_index, resolved_at, resolved_by_user_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE resolved_at = VALUES(resolved_at), resolved_by_user_id = VALUES(resolved_by_user_id)`,
      [leadId, review.id, index, new Date(), user.id],
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("dqc-review resolve error", err);
    return res.status(500).json({ message: "Failed to mark remark as solved" });
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

// Submit D2 masking request – assigns an MMT executive (same as D1); they will see the lead in D2 queue
app.post("/api/leads/:id/d2-masking-request", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const { maskingExecutiveId, maskingDate, maskingTime } = req.body || {};
    const execId = Number(maskingExecutiveId);
    if (!execId) return res.status(400).json({ message: "maskingExecutiveId is required" });
    await pool.query(
      `INSERT INTO lead_d2_assignments (lead_id, assigned_to_user_id, masking_date, masking_time, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [leadId, execId, maskingDate || null, maskingTime || null, new Date()],
    );
    const ev = {
      id: `d2-masking-${Date.now()}`,
      type: "note",
      taskName: "D2 - masking request raise",
      milestoneName: "D2 SITE MASKING",
      timestamp: new Date().toISOString(),
      description: "D2 masking request submitted.",
      user: { name: user.name ?? "System" },
      details: { kind: "d2_masking_request", maskingDate: maskingDate || null, maskingTime: maskingTime || null },
    };
    await addLeadHistoryEvent(leadId, ev);
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("d2-masking-request error", err);
    return res.status(500).json({ message: "Failed to submit D2 masking request" });
  }
});

// Milestone names and task lists (must match frontend MileStonesArray) for computing current milestone from completions
const MILESTONE_NAMES = [
  "D1 SITE MEASUREMENT",
  "DQC1",
  "10% PAYMENT",
  "D2 SITE MASKING",
  "DQC2",
  "40% PAYMENT",
  "PUSH TO PRODUCTION",
];
const MILESTONE_TASKS: string[][] = [
  ["Group Description", "Mail loop chain 2 initiate", "D1 for MMT request", "D1 files upload"],
  [
    "First cut design + quotation discussion meeting request",
    "meeting completed",
    "DQC 1 submission - dwg + quotation",
    "DQC 1 approval",
  ],
  ["10% payment collection", "10% payment approval"],
  ["D2 - masking request raise", "D2 - files upload"],
  [
    "Material selection meeting + quotation discussion",
    "Material selection meeting completed",
    "DQC 2 submission",
    "DQC 2 approval ",
    "Assign project manager",
    "Project manager approval",
  ],
  ["Design sign off", "meeting completed", "40% collection", "40% payment approval"],
  ["Cx approval for production", "POC mail & Timeline submission "],
];

function getCurrentMilestoneIndex(
  completions: { milestoneIndex: number; taskName: string }[],
): number {
  const completedSet = new Set(
    completions.map((c) => `${c.milestoneIndex}::${c.taskName}`),
  );
  for (let i = 0; i < MILESTONE_TASKS.length; i++) {
    const tasks = MILESTONE_TASKS[i];
    const allDone = tasks.every((t) => completedSet.has(`${i}::${t}`));
    if (!allDone) return i;
  }
  return MILESTONE_TASKS.length - 1;
}

/** Progress within the current milestone: 0–100 (completed tasks in that milestone / total tasks). */
function getCurrentMilestoneProgress(
  completions: { milestoneIndex: number; taskName: string }[],
  milestoneIndex: number,
): number {
  const tasks = MILESTONE_TASKS[milestoneIndex];
  if (!tasks || tasks.length === 0) return 0;
  const completedSet = new Set(
    completions.map((c) => `${c.milestoneIndex}::${c.taskName}`),
  );
  const completed = tasks.filter((t) =>
    completedSet.has(`${milestoneIndex}::${t}`),
  ).length;
  return Math.round((completed / tasks.length) * 100);
}

// Dashboard: list all leads (sales closure submissions); MMT executives only see leads they're assigned to
// Query param type=d2: return leads that have D2 masking assignment (for D2 uploads page); mmt_executive sees only their D2 assignments
app.get("/api/leads/queue", async (req: Request, res: Response) => {
  const now = new Date();
  const queueType = (req.query.type as string) || "d1";
  try {
    await pool.query(
      "UPDATE leads SET is_on_hold = 0, resume_at = NULL, update_at = ? WHERE is_on_hold = 1 AND resume_at IS NOT NULL AND resume_at <= ?",
      [now, now],
    );

    const user = await getUserFromSession(req);
    const role = (user?.role ?? "").toLowerCase();
    const isMmt = role === "mmt_manager" || role === "mmt_executive";

    if (queueType === "d2") {
      if (!isMmt) return res.json([]);
      if (role === "mmt_executive" && user?.id) {
        const [rows] = await pool.query(
          `SELECT l.id, l.pid, l.project_name as projectName, l.project_stage as projectStage,
                  l.contact_no as contactNo, l.client_email as clientEmail,
                  l.is_on_hold as isOnHold, l.resume_at as resumeAt,
                  l.create_at as createAt, l.update_at as updateAt
           FROM leads l
           INNER JOIN lead_d2_assignments a ON a.lead_id = l.id AND a.assigned_to_user_id = ?
           ORDER BY l.id ASC`,
          [user.id],
        );
        const list = (rows as any[]).map((r) => ({ ...r, isOnHold: !!r.isOnHold }));
        return res.json(list);
      }
      const [rows] = await pool.query(
        `SELECT DISTINCT l.id, l.pid, l.project_name as projectName, l.project_stage as projectStage,
                l.contact_no as contactNo, l.client_email as clientEmail,
                l.is_on_hold as isOnHold, l.resume_at as resumeAt,
                l.create_at as createAt, l.update_at as updateAt
         FROM leads l
         INNER JOIN lead_d2_assignments a ON a.lead_id = l.id
         ORDER BY l.id ASC`,
      );
      const list = (rows as any[]).map((r) => ({ ...r, isOnHold: !!r.isOnHold }));
      return res.json(list);
    }

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
      `SELECT l.id, l.pid, l.project_name as projectName, l.project_stage as projectStage,
              l.contact_no as contactNo, l.client_email as clientEmail,
              l.is_on_hold as isOnHold, l.resume_at as resumeAt,
              l.create_at as createAt, l.update_at as updateAt,
              l.assigned_designer_id,
              l.assigned_project_manager_id,
              u.name as designerName,
              pm.name as projectManagerName,
              NULLIF(TRIM(COALESCE(
                JSON_UNQUOTE(
                  JSON_EXTRACT(
                    CASE
                      WHEN l.payload IS NULL OR TRIM(l.payload) = '' OR JSON_VALID(l.payload) = 0 THEN '{}'
                      ELSE l.payload
                    END,
                    '$.experience_center'
                  )
                ),
                JSON_UNQUOTE(
                  JSON_EXTRACT(
                    CASE
                      WHEN l.payload IS NULL OR TRIM(l.payload) = '' OR JSON_VALID(l.payload) = 0 THEN '{}'
                      ELSE l.payload
                    END,
                    '$.form.experience_center'
                  )
                )
              )), '') AS experienceCenter
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_designer_id
       LEFT JOIN users pm ON pm.id = l.assigned_project_manager_id
       ORDER BY l.id ASC`,
    );
    const baseList = (rows as any[]).map((r) => ({
      ...r,
      isOnHold: !!r.isOnHold,
      designerName: r.designerName ?? null,
      projectManagerName: r.projectManagerName ?? null,
      experienceCenter: r.experienceCenter ?? null,
    }));

    // Enrich with current milestone (from task completions) for Design Phase dashboard
    const [completionRows] = await pool.query(
      `SELECT lead_id as leadId, milestone_index as milestoneIndex, task_name as taskName FROM lead_task_completions`,
    );
    const compList = completionRows as {
      leadId: number;
      milestoneIndex: number;
      taskName: string;
    }[];
    const completionsByLead = new Map<
      number,
      { milestoneIndex: number; taskName: string }[]
    >();
    for (const c of compList) {
      const arr = completionsByLead.get(c.leadId) ?? [];
      arr.push({ milestoneIndex: c.milestoneIndex, taskName: c.taskName });
      completionsByLead.set(c.leadId, arr);
    }
    const enrichedList = baseList.map((l: any) => {
      const comps = completionsByLead.get(l.id) ?? [];
      const idx = getCurrentMilestoneIndex(comps);
      const progress = getCurrentMilestoneProgress(comps, idx);
      return {
        ...l,
        currentMilestoneIndex: idx,
        currentMilestoneName: MILESTONE_NAMES[idx] ?? "—",
        currentMilestoneProgress: progress,
      };
    });

    // Visibility rules for designers / design managers
    if (user && role === "designer") {
      const filtered = enrichedList.filter(
        (l: any) =>
          l.assigned_designer_id && l.assigned_designer_id === user.id,
      );
      return res.json(filtered);
    }

    if (user && role === "design_manager") {
      const [dmRows] = await pool.query(
        `SELECT l.id
         FROM leads l
         INNER JOIN users d ON d.id = l.assigned_designer_id
         WHERE d.design_manager_id = ?`,
        [user.id],
      );
      const allowedIds = new Set((dmRows as { id: number }[]).map((r) => r.id));
      const filtered = enrichedList.filter((l: any) =>
        allowedIds.has(l.id),
      );
      return res.json(filtered);
    }

    if (user && role === "project_manager") {
      const filtered = enrichedList.filter(
        (l: any) => l.assigned_project_manager_id && l.assigned_project_manager_id === user.id,
      );
      return res.json(filtered);
    }

    // Admins, TDMs, and others keep full list
    res.json(enrichedList);
  } catch (err) {
    console.error("leads/queue error", err);
    res.status(500).json({ message: "Failed to load leads" });
  }
});

// DQC dashboard: list leads with id, name, stage, dqcStatus, dqc1Pending, dqc2Pending for dqc_manager and dqe
// dqc1Pending = needs DQC 1 approval (has DQC 1 submission, latest verdict not approved)
// dqc2Pending = needs DQC 2 approval (latest verdict is pending_dqc2)
app.get("/api/leads/dqc-queue", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    const role = (user?.role ?? "").toLowerCase();
    if (role !== "dqc_manager" && role !== "dqe") {
      return res.status(403).json({ message: "Only DQC Manager or DQE can access DQC queue" });
    }
    const [leadRows] = await pool.query(
      `SELECT id, project_name as projectName, project_stage as projectStage
       FROM leads ORDER BY id ASC`,
    );
    const leads = leadRows as { id: number; projectName: string; projectStage: string }[];
    const [reviewRows] = await pool.query(
      `SELECT lead_id as leadId, verdict FROM lead_dqc_reviews ORDER BY id DESC`,
    );
    const latestVerdictByLead: Record<number, string> = {};
    for (const row of reviewRows as { leadId: number; verdict: string }[]) {
      if (latestVerdictByLead[row.leadId] === undefined) {
        latestVerdictByLead[row.leadId] = row.verdict;
      }
    }
    const [completionRows] = await pool.query(
      `SELECT lead_id as leadId, milestone_index as milestoneIndex, task_name as taskName
       FROM lead_task_completions`,
    );
    const completions = completionRows as { leadId: number; milestoneIndex: number; taskName: string }[];
    const hasDqc1Submission = (leadId: number) =>
      completions.some(
        (c) =>
          c.leadId === leadId &&
          c.milestoneIndex === 1 &&
          c.taskName === "DQC 1 submission - dwg + quotation",
      );
    const list = leads.map((l) => {
      const verdict = latestVerdictByLead[l.id];
      const dqc2Pending = verdict === "pending_dqc2";
      const dqc1Pending =
        !dqc2Pending &&
        hasDqc1Submission(l.id) &&
        (verdict === undefined || verdict === "rejected" || verdict === "approved_with_changes");
      return {
        id: l.id,
        projectName: l.projectName,
        projectStage: l.projectStage,
        dqcStatus: verdict === "approved" ? "Approved DQC" : "Pending DQC",
        dqc1Pending: !!dqc1Pending,
        dqc2Pending: !!dqc2Pending,
      };
    });
    return res.json(list);
  } catch (err) {
    console.error("dqc-queue error", err);
    return res.status(500).json({ message: "Failed to load DQC queue" });
  }
});

// Sales Managers for Sales Closure form (proxy to Project-ERP)
app.get("/api/sales-managers", async (req: Request, res: Response) => {
  try {
    const data = await fetchFromErpWithRetry("/api/auth/users/SALES_MANAGER");
    res.json(data);
  } catch (err) {
    console.error("sales-managers proxy error", err);
    res.status(500).json({ message: "Failed to load sales managers" });
  }
});

// Sales Admins for Sales Closure form (proxy to Project-ERP)
app.get("/api/sales-admins", async (req: Request, res: Response) => {
  try {
    const data = await fetchFromErpWithRetry("/api/auth/users/SALES_ADMIN");
    res.json(data);
  } catch (err) {
    console.error("sales-admins proxy error", err);
    res.status(500).json({ message: "Failed to load sales admins" });
  }
});

// Designers for Sales Closure form (from users with role designer or design_manager)
app.get("/api/designers", async (req: Request, res: Response) => {
  try {
    const currentUser = await getUserFromSession(req);
    const currentRole = (currentUser?.role || "").toLowerCase();
    let query = `SELECT u.id,
                        u.name,
                        u.role,
                        COALESCE(m.name, '') as leadName
                 FROM users u
                 LEFT JOIN users m ON u.design_manager_id = m.id
                 WHERE u.role IN ('designer', 'design_manager')`;
    const params: number[] = [];
    if (currentRole === "territorial_design_manager" && currentUser) {
      query += ` AND (
        (u.role = 'design_manager' AND u.territorial_design_manager_id = ?)
        OR (u.role = 'designer' AND m.territorial_design_manager_id = ?)
      )`;
      params.push(currentUser.id, currentUser.id);
    }
    query += " ORDER BY u.name ASC";
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("designers error", err);
    res.status(500).json({ message: "Failed to load designers" });
  }
});

// Assignable designers for lead reassignment (admin/TDM/design_manager).
app.get("/api/designers/assignable", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role || "").toLowerCase();
    if (!canAssignLeads(role)) {
      return res.status(403).json({ message: "Only admin, TDM, or design manager can reassign leads" });
    }

    if (role === "design_manager") {
      const [rows] = await pool.query(
        `SELECT id, name, role
         FROM users
         WHERE role = 'design_manager' AND id = ?
         UNION
         SELECT id, name, role
         FROM users
         WHERE role = 'designer' AND design_manager_id = ?
         ORDER BY name ASC`,
        [user.id, user.id],
      );
      return res.json(rows);
    }

    const [rows] = await pool.query(
      `SELECT id, name, role
       FROM users
       WHERE role IN ('designer', 'design_manager')
       ORDER BY name ASC`,
    );
    return res.json(rows);
  } catch (err) {
    console.error("designers/assignable error", err);
    return res.status(500).json({ message: "Failed to load assignable designers" });
  }
});

// Assign a single lead to a designer/design manager.
app.post("/api/leads/:id/assign-designer", async (req: Request, res: Response) => {
  try {
    const leadId = Number(req.params.id);
    if (!leadId) return res.status(400).json({ message: "Invalid lead id" });
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role || "").toLowerCase();
    if (!canAssignLeads(role)) {
      return res.status(403).json({ message: "Only admin, TDM, or design manager can reassign leads" });
    }

    const designerId = Number(req.body?.designerId);
    if (!designerId) return res.status(400).json({ message: "designerId is required" });

    const [leadRows] = await pool.query(
      "SELECT id, assigned_designer_id FROM leads WHERE id = ? LIMIT 1",
      [leadId],
    );
    const lead = (leadRows as any[])[0];
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (role === "design_manager") {
      const [visibilityRows] = await pool.query(
        `SELECT 1
         FROM leads l
         INNER JOIN users d ON d.id = l.assigned_designer_id
         WHERE l.id = ? AND d.design_manager_id = ?`,
        [leadId, user.id],
      );
      if ((visibilityRows as any[]).length === 0) {
        return res.status(403).json({ message: "You can reassign only leads from your team" });
      }
    }

    const [designerRows] = await pool.query(
      "SELECT id, name, role, design_manager_id FROM users WHERE id = ? AND role IN ('designer', 'design_manager') LIMIT 1",
      [designerId],
    );
    const designer = (designerRows as any[])[0];
    if (!designer) return res.status(400).json({ message: "Invalid designer selected" });

    if (role === "design_manager") {
      const allowed =
        (designer.role === "design_manager" && designer.id === user.id) ||
        (designer.role === "designer" && Number(designer.design_manager_id) === Number(user.id));
      if (!allowed) {
        return res.status(403).json({ message: "You can assign only to yourself or your designers" });
      }
    }

    await pool.query("UPDATE leads SET assigned_designer_id = ?, update_at = ? WHERE id = ?", [
      designerId,
      new Date(),
      leadId,
    ]);
    return res.json({
      ok: true,
      leadId,
      assignedDesignerId: designerId,
      designerName: designer.name,
    });
  } catch (err) {
    console.error("assign-designer error", err);
    return res.status(500).json({ message: "Failed to assign lead" });
  }
});

// Bulk assign multiple leads to one designer.
app.post("/api/leads/assign-designer/bulk", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role || "").toLowerCase();
    if (!canAssignLeads(role)) {
      return res.status(403).json({ message: "Only admin, TDM, or design manager can reassign leads" });
    }

    const leadIds = Array.isArray(req.body?.leadIds)
      ? (req.body.leadIds as unknown[])
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v > 0)
      : [];
    const designerId = Number(req.body?.designerId);
    if (leadIds.length === 0) return res.status(400).json({ message: "leadIds are required" });
    if (!designerId) return res.status(400).json({ message: "designerId is required" });

    const [designerRows] = await pool.query(
      "SELECT id, name, role, design_manager_id FROM users WHERE id = ? AND role IN ('designer', 'design_manager') LIMIT 1",
      [designerId],
    );
    const designer = (designerRows as any[])[0];
    if (!designer) return res.status(400).json({ message: "Invalid designer selected" });

    if (role === "design_manager") {
      const allowed =
        (designer.role === "design_manager" && designer.id === user.id) ||
        (designer.role === "designer" && Number(designer.design_manager_id) === Number(user.id));
      if (!allowed) {
        return res.status(403).json({ message: "You can assign only to yourself or your designers" });
      }
    }

    const updatedLeadIds: number[] = [];
    for (const leadId of leadIds) {
      if (role === "design_manager") {
        const [visibilityRows] = await pool.query(
          `SELECT 1
           FROM leads l
           INNER JOIN users d ON d.id = l.assigned_designer_id
           WHERE l.id = ? AND d.design_manager_id = ?`,
          [leadId, user.id],
        );
        if ((visibilityRows as any[]).length === 0) continue;
      }
      await pool.query("UPDATE leads SET assigned_designer_id = ?, update_at = ? WHERE id = ?", [
        designerId,
        new Date(),
        leadId,
      ]);
      updatedLeadIds.push(leadId);
    }

    return res.json({
      ok: true,
      updatedCount: updatedLeadIds.length,
      updatedLeadIds,
      assignedDesignerId: designerId,
      designerName: designer.name,
    });
  } catch (err) {
    console.error("assign-designer bulk error", err);
    return res.status(500).json({ message: "Failed to bulk assign leads" });
  }
});

// Assign project manager on a lead (after DQC 2 approval; same roles as completing "Assign project manager")
app.patch("/api/leads/:id/assign-project-manager", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const pmId = Number((req.body || {}).projectManagerId);
  if (!Number.isFinite(pmId) || pmId < 1) {
    return res.status(400).json({ message: "projectManagerId is required" });
  }
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role || "").toLowerCase();
    if (!canAssignProjectManagerRole(role)) {
      return res.status(403).json({
        message:
          "Only Admin, Territorial Design Manager, Deputy General Manager, or Senior Project Manager can assign a project manager",
      });
    }
    const [urows] = await pool.query("SELECT id, role FROM users WHERE id = ?", [pmId]);
    const target = (urows as any[])[0];
    if (!target || String(target.role || "").toLowerCase() !== "project_manager") {
      return res.status(400).json({ message: "Invalid project manager" });
    }
    await pool.query(
      "UPDATE leads SET assigned_project_manager_id = ?, update_at = ? WHERE id = ?",
      [pmId, new Date(), id],
    );

    // ── Fire internal email to the newly assigned Project Manager ──
    try {
      const [leadRows] = await pool.query(
        `SELECT l.pid, l.project_name as projectName, l.payload, l.assigned_designer_id,
                u.name as designerName,
                pm.name as pmName, pm.email as pmEmail
         FROM leads l
         LEFT JOIN users u ON u.id = l.assigned_designer_id
         LEFT JOIN users pm ON pm.id = ?
         WHERE l.id = ?`,
        [pmId, id],
      );
      const leadRow = (leadRows as any[])[0];
      if (leadRow && leadRow.pmEmail) {
        let lpayload: any = {};
        try {
          lpayload = leadRow.payload ? JSON.parse(leadRow.payload) : {};
        } catch {
          lpayload = {};
        }
        const fd = lpayload?.formData || lpayload?.form_data || lpayload?.form || lpayload || {};
        const customerName =
          fd.customer_name ||
          fd.sales_lead_name ||
          lpayload?.customer_name ||
          lpayload?.form?.customer_name ||
          leadRow.projectName ||
          "Customer";
        const designerName = leadRow.designerName || fd.designer_name || fd.designerName || "Design Team";
        const branch = fd.sales_closure_ec || fd.branch || fd.experience_center || lpayload?.branch || null;
        const projectId = leadRow.pid || `PJ-${id}`;

        const ccList = await getMailLoopCcEmails([user.email || null]);
        void triggerMailRouteWithLog({
          leadId: id,
          milestoneIndex: 4,
          taskName: "Assign project manager",
          route: "/api/email/send-pm-assignment-notification",
          visibility: "internal",
          payload: {
            to: leadRow.pmEmail,
            cc: ccList,
            subject: `You've Been Assigned – ${customerName} Project`,
            pmName: leadRow.pmName || "Project Manager",
            customerName,
            projectName: leadRow.projectName || undefined,
            projectId,
            designerName,
            branchLocation: branch || undefined,
          },
        });
      }
    } catch (mailErr) {
      console.error("PM assignment notification email error (non-fatal)", { leadId: id, error: mailErr });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("assign-project-manager error", err);
    return res.status(500).json({ message: "Failed to assign project manager" });
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
      `SELECT l.id, l.pid, l.project_name as projectName, l.project_stage as projectStage,
              l.contact_no as contactNo, l.client_email as clientEmail,
              l.client_email_alt as alternateClientEmail,
              l.is_on_hold as isOnHold, l.resume_at as resumeAt,
              l.create_at as createAt, l.update_at as updateAt, l.payload,
              l.assigned_designer_id,
              l.assigned_project_manager_id,
              pm.name as projectManagerName,
              d.email as designerEmail,
              CASE WHEN d.role = 'design_manager' THEN d.email ELSE dm.email END as designManagerEmail,
              CASE WHEN d.role = 'design_manager' THEN d.name ELSE dm.name END as designManagerName
       FROM leads l
       LEFT JOIN users pm ON pm.id = l.assigned_project_manager_id
       LEFT JOIN users d ON d.id = l.assigned_designer_id
       LEFT JOIN users dm ON dm.id = d.design_manager_id
       WHERE l.id = ?`,
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

    // Visibility rules for designers / design managers
    if (user && role === "designer") {
      if (!row.assigned_designer_id || row.assigned_designer_id !== user.id) {
        return res.status(404).json({ message: "Lead not found" });
      }
    }

    if (user && role === "design_manager") {
      const [dmCheck] = await pool.query(
        `SELECT 1
         FROM users d
         WHERE d.id = ? AND d.design_manager_id = ?`,
        [row.assigned_designer_id, user.id],
      );
      if ((dmCheck as any[]).length === 0) {
        return res.status(404).json({ message: "Lead not found" });
      }
    }

    if (user && role === "project_manager") {
      if (!row.assigned_project_manager_id || row.assigned_project_manager_id !== user.id) {
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

    let designerName: string | undefined;
    let revision: string | undefined;
    try {
      const payload = row.payload ? JSON.parse(row.payload) : {};
      const formData = payload.formData || payload.form_data || payload || {};
      designerName = formData.designer_name || formData.designerName || undefined;
      revision = formData.revision || (designerName ? "v1.0 (Latest)" : undefined);
    } catch {
      // ignore
    }
    if (!revision) revision = "v1.0 (Latest)";

    const { payload: _p, ...rest } = row;
    return res.json({
      ...rest,
      isOnHold: !!row.isOnHold,
      designerName: designerName || null,
      designerEmail: row.designerEmail ?? null,
      designManagerEmail: row.designManagerEmail ?? null,
      designManagerName: row.designManagerName ?? null,
      revision: revision || "v1.0 (Latest)",
      alternateClientEmail: row.alternateClientEmail ?? null,
      projectManagerName: row.projectManagerName ?? null,
    });
  } catch (err) {
    console.error("lead detail error", err);
    return res.status(500).json({ message: "Failed to load lead" });
  }
});

// Update primary / alternate client email (everyone except designers).
app.patch("/api/leads/:id/client-emails", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  const parseEmailField = (
    v: unknown,
  ): { kind: "omit" } | { kind: "null" } | { kind: "value"; value: string } | { kind: "invalid" } => {
    if (v === undefined) return { kind: "omit" };
    if (v === null || v === "") return { kind: "null" };
    const s = String(v).trim();
    if (!s) return { kind: "null" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { kind: "invalid" };
    return { kind: "value", value: s };
  };

  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role ?? "").toLowerCase();
    if (role === "designer") {
      return res.status(403).json({ message: "Designers cannot update client emails" });
    }

    const [rows] = await pool.query(
      "SELECT id, assigned_designer_id, client_email as clientEmail, client_email_alt as alternateClientEmail FROM leads WHERE id = ?",
      [id],
    );
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ message: "Lead not found" });

    if (role === "mmt_executive" && user.id) {
      const [assignRows] = await pool.query(
        "SELECT 1 FROM lead_d1_assignments WHERE lead_id = ? AND assigned_to_user_id = ?",
        [id, user.id],
      );
      if ((assignRows as any[]).length === 0) {
        const [d2Rows] = await pool.query(
          "SELECT 1 FROM lead_d2_assignments WHERE lead_id = ? AND assigned_to_user_id = ?",
          [id, user.id],
        );
        if ((d2Rows as any[]).length === 0) {
          return res.status(404).json({ message: "Lead not found" });
        }
      }
    }

    if (role === "design_manager") {
      const [dmCheck] = await pool.query(
        `SELECT 1 FROM users d WHERE d.id = ? AND d.design_manager_id = ?`,
        [row.assigned_designer_id, user.id],
      );
      if (!row.assigned_designer_id || (dmCheck as any[]).length === 0) {
        return res.status(404).json({ message: "Lead not found" });
      }
    }

    const body = req.body || {};
    const pPrimary = parseEmailField(body.clientEmail);
    const pAlt = parseEmailField(body.alternateClientEmail);
    if (pPrimary.kind === "invalid" || pAlt.kind === "invalid") {
      return res.status(400).json({ message: "Invalid email format" });
    }
    if (pPrimary.kind === "omit" && pAlt.kind === "omit") {
      return res.status(400).json({ message: "Provide clientEmail and/or alternateClientEmail" });
    }

    const mergedPrimary =
      pPrimary.kind === "omit"
        ? (row.clientEmail ?? null)
        : pPrimary.kind === "null"
          ? null
          : pPrimary.value;
    const mergedAlt =
      pAlt.kind === "omit"
        ? (row.alternateClientEmail ?? null)
        : pAlt.kind === "null"
          ? null
          : pAlt.value;

    await pool.query(
      "UPDATE leads SET client_email = ?, client_email_alt = ?, update_at = ? WHERE id = ?",
      [mergedPrimary, mergedAlt, new Date(), id],
    );

    return res.json({
      clientEmail: mergedPrimary,
      alternateClientEmail: mergedAlt,
    });
  } catch (err) {
    console.error("client-emails patch error", err);
    return res.status(500).json({ message: "Failed to update client emails" });
  }
});

// Involved users for a lead (D1/D2 assignees + uploaders); used for header avatars (profile images)
app.get("/api/leads/:id/involved-users", async (req: Request, res: Response) => {
  const leadId = Number(req.params.id);
  if (Number.isNaN(leadId)) return res.status(400).json({ message: "Invalid id" });
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const [leadRows] = await pool.query("SELECT id FROM leads WHERE id = ?", [leadId]);
    if ((leadRows as any[]).length === 0) return res.status(404).json({ message: "Lead not found" });

    if ((user?.role ?? "").toLowerCase() === "mmt_executive") {
      const [assignRows] = await pool.query(
        "SELECT 1 FROM lead_d1_assignments WHERE lead_id = ? AND assigned_to_user_id = ?",
        [leadId, user.id],
      );
      if ((assignRows as any[]).length === 0) {
        const [d2Rows] = await pool.query(
          "SELECT 1 FROM lead_d2_assignments WHERE lead_id = ? AND assigned_to_user_id = ?",
          [leadId, user.id],
        );
        if ((d2Rows as any[]).length === 0) return res.status(404).json({ message: "Lead not found" });
      }
    }

    const userIds = new Set<number>();
    const [d1] = await pool.query(
      "SELECT assigned_to_user_id FROM lead_d1_assignments WHERE lead_id = ?",
      [leadId],
    );
    (d1 as { assigned_to_user_id: number }[]).forEach((r) =>
      userIds.add(r.assigned_to_user_id),
    );
    const [d2] = await pool.query(
      "SELECT assigned_to_user_id FROM lead_d2_assignments WHERE lead_id = ?",
      [leadId],
    );
    (d2 as { assigned_to_user_id: number }[]).forEach((r) =>
      userIds.add(r.assigned_to_user_id),
    );
    const [up] = await pool.query(
      "SELECT uploader_id FROM lead_uploads WHERE lead_id = ? AND uploader_id IS NOT NULL",
      [leadId],
    );
    (up as { uploader_id: number | null }[]).forEach((r) => {
      if (r.uploader_id) userIds.add(r.uploader_id);
    });

    // Also include core project team roles so DQC manager, DQE, TDM, and design managers appear
    const [coreTeamRows] = await pool.query(
      "SELECT id FROM users WHERE role IN ('dqc_manager', 'dqe', 'territorial_design_manager', 'design_manager')",
    );
    (coreTeamRows as { id: number }[]).forEach((u) => userIds.add(u.id));

    if (userIds.size === 0) return res.json([]);

    const placeholders = Array.from(userIds).map(() => "?").join(",");
    const [userRows] = await pool.query(
      `SELECT id, name, profileImage FROM users WHERE id IN (${placeholders}) ORDER BY name ASC`,
      Array.from(userIds),
    );
    const list = (userRows as { id: number; name: string | null; profileImage: string | null }[]).map((u) => {
      let profileImage = u.profileImage || null;
      if (profileImage && profileImage.startsWith("/") && !profileImage.startsWith("http")) {
        profileImage = `${API_BASE}${profileImage}`;
      }
      return { id: u.id, name: u.name || "", profileImage };
    });
    return res.json(list);
  } catch (err) {
    console.error("involved-users error", err);
    return res.status(500).json({ message: "Failed to load involved users" });
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
      "SELECT id, project_stage as projectStage FROM leads WHERE id = ?",
      [id],
    );
    const lead = (rows as any[])[0];
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    if (String(lead.projectStage ?? "").trim().toLowerCase() === "cancelled") {
      return res.status(400).json({ message: "Cannot put a cancelled project on hold" });
    }

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

// Mark project as cancelled (Admin, TDM, or Deputy General Manager only). Clears hold.
app.post("/api/leads/:id/cancel", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user.role ?? "").toLowerCase();
    const allowed = ["admin", "territorial_design_manager", "deputy_general_manager"];
    if (!allowed.includes(role)) {
      return res.status(403).json({ message: "Only Admin, TDM, or Deputy General Manager can cancel a project" });
    }

    const [rows] = await pool.query(
      "SELECT id, project_stage as projectStage FROM leads WHERE id = ?",
      [id],
    );
    const lead = (rows as any[])[0];
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    const st = String(lead.projectStage ?? "").trim().toLowerCase();
    if (st === "cancelled") {
      return res.json({ success: true, message: "Project is already cancelled", projectStage: "Cancelled" });
    }

    await pool.query(
      "UPDATE leads SET project_stage = 'Cancelled', is_on_hold = 0, resume_at = NULL, update_at = ? WHERE id = ?",
      [new Date(), id],
    );

    res.json({ success: true, message: "Project marked as cancelled", projectStage: "Cancelled" });
  } catch (err) {
    console.error("cancel lead error", err);
    res.status(500).json({ message: "Failed to cancel project" });
  }
});

registerProlanceRoutes(app, getUserFromSession);

// Ensure CORS headers are present on error responses (multer, etc.) so the browser doesn't only show a generic CORS error
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  reflectCorsHeaders(req, res);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: (err as any).message });
  }
  const msg = err instanceof Error ? err.message : "Server error";
  console.error("Express error:", err);
  return res.status(500).json({ message: msg });
});

// ----- Keep process alive on unhandled errors (log instead of exit) -----
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at", promise, "reason:", reason);
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Auth create/register routes: create-mmt-manager, register-mmt-executive, create-tdm, create-admin, create-dqc-manager, create-escalation-manager, create-project-manager, create-senior-project-manager, create-finance, register-dqe, register (TDM designer/design_manager)");
});

server.on("error", (err) => {
  console.error("Server listen error:", err);
  process.exit(1);
});
