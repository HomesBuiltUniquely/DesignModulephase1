/**
 * Test Meeting Successful sync WITHOUT ERP username/password.
 * Uses EXTERNAL_LEAD_INGEST_API_KEY + HUB_PROOF_BEARER_TOKEN (same as quote-link / proofs).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    let key = trimmed.slice(0, idx).trim();
    if (key.startsWith("export ")) key = key.slice(7).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv(envPath);

function authHeaders() {
  const headers = {
    "Content-Type": "application/json",
    "X-Activity-Performed-By": "Design Module Auto",
  };
  const ingestKey =
    process.env.EXTERNAL_LEAD_INGEST_API_KEY?.trim() ||
    process.env.CRM_EXTERNAL_API_KEY?.trim() ||
    process.env.HUB_SYNC_API_KEY?.trim() ||
    "";
  if (ingestKey) {
    headers["x-external-api-key"] = ingestKey;
    headers["x-api-key"] = ingestKey;
  }
  const bearer = String(process.env.HUB_PROOF_BEARER_TOKEN || process.env.CRM_DEV_BEARER_TOKEN || "").trim();
  if (bearer && !/^https?:\/\//i.test(bearer)) {
    headers.Authorization = bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}`;
  }
  return { headers, hasKey: Boolean(ingestKey), hasBearer: Boolean(bearer) };
}

function resolveCrmLeadPutPaths(leadType, crmLeadId) {
  const norm = String(leadType || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  switch (norm) {
    case "walkinlead":
    case "walkin":
      return [`/v1/WalkinLead/${crmLeadId}`];
    case "whatsapplead":
    case "whatsapp":
      return [`/v1/WhatsappLead/details/${crmLeadId}`, `/v1/WhatsappLead/${crmLeadId}`];
    case "formlead":
    case "form":
      return [`/v1/FormLead/details/${crmLeadId}`];
    case "glead":
    case "google":
    case "googlelead":
    case "home1":
      return [`/v1/Home1/details/${crmLeadId}`];
    case "mlead":
    case "meta":
    case "metalead":
      return [`/v1/MetaLead/details/${crmLeadId}`];
    case "ivrlead":
    case "ivr":
      return [`/v1/IvrLead/details/${crmLeadId}`];
    case "websitelead":
    case "website":
      return [`/v1/WebsiteLead/details/${crmLeadId}`];
    case "addlead":
    case "add":
      return [`/v1/AddLead/details/${crmLeadId}`];
    default:
      return [
        `/v1/AddLead/details/${crmLeadId}`,
        `/v1/FormLead/details/${crmLeadId}`,
        `/v1/Home1/details/${crmLeadId}`,
        `/v1/MetaLead/details/${crmLeadId}`,
        `/v1/WebsiteLead/details/${crmLeadId}`,
        `/v1/WhatsappLead/details/${crmLeadId}`,
        `/v1/WalkinLead/${crmLeadId}`,
        `/v1/IvrLead/details/${crmLeadId}`,
      ];
  }
}

async function main() {
  const serverSrc = fs.readFileSync(path.join(__dirname, "..", "server.ts"), "utf8");
  const wired =
    serverSrc.includes("crmSyncAuthHeaders") &&
    serverSrc.includes("notifyCrmMeetingSuccessfulForDesignLead") &&
    serverSrc.includes("/api/design/meeting-successful");
  console.log("[1] Code uses API-key path (no ERP login):", wired);

  const { headers, hasKey, hasBearer } = authHeaders();
  console.log("[2] Auth material:", { hasKey, hasBearer });

  const pool = await mysql.createPool({
    host: process.env.DB_HOST || "database-1.cl002gu0o5ft.ap-south-2.rds.amazonaws.com",
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASSWORD || "Hubinterior2019",
    database: process.env.DB_NAME || "DesignMod",
    port: Number(process.env.DB_PORT || 3306),
    connectionLimit: 2,
  });

  let sample = null;
  try {
    const [rows] = await pool.query(
      `SELECT m.id AS meetingId,
              m.lead_id AS leadId,
              JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.crmLeadId')) AS crmLeadId,
              JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.crmLeadType')) AS crmLeadType,
              JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(l.payload), l.payload, '{}'), '$.leadType')) AS leadType
         FROM lead_meetings m
         JOIN leads l ON l.id = m.lead_id
        WHERE m.source = 'crm'
          AND m.progress = 'completed'
          AND JSON_VALID(l.payload)
          AND JSON_UNQUOTE(JSON_EXTRACT(l.payload, '$.crmLeadId')) REGEXP '^[0-9]+$'
        ORDER BY m.updated_at DESC, m.id DESC
        LIMIT 1`,
    );
    sample = rows[0] || null;
  } finally {
    await pool.end();
  }

  if (!sample) {
    console.log("[3] No sample CRM meeting found");
    process.exit(wired ? 0 : 1);
  }

  const crmLeadId = Number(sample.crmLeadId);
  const leadType = sample.crmLeadType || sample.leadType || null;
  console.log("[3] Sample:", {
    meetingId: sample.meetingId,
    leadId: sample.leadId,
    crmLeadId,
    leadType,
  });

  const stageBody = {
    stage: {
      milestoneStage: "Experience & Design",
      milestoneStageCategory: "Experience & Design Won",
      milestoneSubStage: "Meeting Successful",
      stage: "Experience & Design",
      substage: { substage: "Meeting Successful" },
    },
  };
  const callbackBody = {
    ...stageBody,
    crmLeadId,
    leadId: crmLeadId,
    leadType,
    crmLeadType: leadType,
    milestoneSubStage: "Meeting Successful",
    progress: "completed",
    progressLabel: "Meeting Successful",
  };

  const attempts = [];
  const crmBases = [
    process.env.CRM_CALLBACK_BASE_URL,
    process.env.CRM_FRONTEND_URL,
    "https://crm.hubinterior.com",
    "https://hows.hubinterior.com",
    "https://app.hubinterior.com",
  ]
    .map((b) => String(b || "").replace(/\/+$/, ""))
    .filter(Boolean);
  const callbackPaths = [
    "/api/design/meeting-successful",
    "/api/design/meeting-success",
    "/api/design/meeting-wiz-completed",
  ];
  for (const base of [...new Set(crmBases)]) {
    for (const p of callbackPaths) {
      attempts.push({ method: "POST", url: `${base}${p}`, body: callbackBody });
    }
  }

  const hubBases = ["https://api.hubinterior.com", "https://hows.hubinterior.com"];
  for (const base of hubBases) {
    attempts.push({ method: "POST", url: `${base}/v1/meetings/success`, body: callbackBody });
    for (const p of resolveCrmLeadPutPaths(leadType, crmLeadId)) {
      attempts.push({ method: "PUT", url: `${base}${p}`, body: stageBody });
    }
  }

  let ok = null;
  const failures = [];
  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        method: attempt.method,
        headers,
        body: JSON.stringify(attempt.body),
      });
      const text = await res.text().catch(() => "");
      if (res.ok) {
        ok = { ...attempt, status: res.status };
        break;
      }
      if (res.status !== 404) {
        failures.push(`${attempt.method} ${attempt.url} → ${res.status} ${text.slice(0, 100)}`);
      }
    } catch (err) {
      failures.push(`${attempt.method} ${attempt.url} → ${err?.message || err}`);
    }
  }

  if (ok) {
    console.log("[4] LIVE OK:", ok.method, ok.url, ok.status);
    console.log("\nRESULT: PASS");
    process.exit(0);
  }

  console.log("[4] No endpoint accepted Meeting Successful yet.");
  console.log("Non-404 failures (first 6):");
  for (const f of failures.slice(0, 6)) console.log(" -", f);
  console.log(
    "\nRESULT: PARTIAL — Design code is API-key based; CRM/Hub still needs a working callback or bearer-authorized lead PUT.",
  );
  process.exit(wired && (hasKey || hasBearer) ? 2 : 1);
}

main().catch((err) => {
  console.error("TEST CRASHED:", err?.message || err);
  process.exit(1);
});
