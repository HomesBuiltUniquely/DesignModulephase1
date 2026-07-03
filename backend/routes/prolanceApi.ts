import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";

type SessionUser = { id: number; role: string };
type PartnerCredential = { loginId: string; password: string };

function envTrim(name: string): string {
  return (process.env[name] || "").trim();
}

function baseUrl(): string {
  return (envTrim("PROLANCE_API_BASE_URL") || "https://api.prolance.design").replace(/\/$/, "");
}

function canUseProlance(role: string | null | undefined): boolean {
  const r = (role || "").toLowerCase();
  return (
    r === "admin" ||
    r === "territorial_design_manager" ||
    r === "deputy_general_manager" ||
    r === "design_manager" ||
    r === "designer" ||
    r === "dqc_manager" ||
    r === "dqe"
  );
}

function asString(val: unknown): string | null {
  return typeof val === "string" && val.trim() ? val.trim() : null;
}

function pathSegment(param: string | string[] | undefined): string {
  const raw = Array.isArray(param) ? param[0] : param;
  return encodeURIComponent(String(raw ?? ""));
}

function readToken(req: Request): string | null {
  return asString(req.headers["x-prolance-token"]) || asString(req.body?.token) || asString(envTrim("PROLANCE_TOKEN"));
}

function readOriginSessionId(req: Request): string | null {
  return (
    asString(req.headers["originsessionid"]) ||
    asString(req.headers["x-prolance-origin-session"]) ||
    asString(req.body?.sessionId) ||
    asString(envTrim("PROLANCE_ORIGIN_SESSION_ID"))
  );
}

function readApiKey(req: Request): string | null {
  return asString(req.headers["x-prolance-api-key"]) || asString(envTrim("PROLANCE_API_KEY"));
}

function normalizeUserKey(input: string | null | undefined): string {
  return String(input || "")
    .trim()
    .toLowerCase();
}

function readPartnerCredentialsMap(): Record<string, unknown> {
  const fromJsonEnv = envTrim("PROLANCE_PARTNER_CREDENTIALS_JSON");
  if (fromJsonEnv) {
    try {
      const parsed = JSON.parse(fromJsonEnv) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (err) {
      console.error("Invalid PROLANCE_PARTNER_CREDENTIALS_JSON", err);
    }
  }

  const filePathRaw = envTrim("PROLANCE_PARTNER_CREDENTIALS_FILE");
  if (!filePathRaw) return {};

  try {
    const absPath = path.isAbsolute(filePathRaw)
      ? filePathRaw
      : path.resolve(process.cwd(), filePathRaw);
    if (!fs.existsSync(absPath)) return {};
    const raw = fs.readFileSync(absPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (err) {
    console.error("Failed to read Prolance partner credentials file", err);
  }
  return {};
}

function extractPartnerCredential(value: unknown, defaultLoginId: string): PartnerCredential | null {
  if (typeof value === "string" && value.trim()) {
    return { loginId: defaultLoginId, password: value.trim() };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    const loginId = asString(row.loginId) || asString(row.LoginID) || defaultLoginId;
    const password = asString(row.password) || asString(row.Password);
    if (loginId && password) return { loginId, password };
  }
  return null;
}

function lookupPartnerCredentialInMap(
  credsMap: Record<string, unknown>,
  emailRaw: string | null,
  userId: number,
): PartnerCredential | null {
  const emailNorm = normalizeUserKey(emailRaw);
  const idKey = String(userId);

  if (emailNorm) {
    const direct = extractPartnerCredential(credsMap[emailNorm], emailRaw || emailNorm);
    if (direct) return direct;
    for (const [key, value] of Object.entries(credsMap)) {
      if (normalizeUserKey(key) === emailNorm) {
        const cred = extractPartnerCredential(value, emailRaw || key);
        if (cred) return cred;
      }
    }
  }

  return extractPartnerCredential(credsMap[idKey], emailRaw || emailNorm || idKey);
}

/** Normalize Prolance partner login payloads (array, object, or PascalCase fields). */
function extractPartnerLoginFields(data: unknown): { sessionID: string; partnerID: number } | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;

  const readRow = (row: unknown): { sessionID: string; partnerID: number } | null => {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const sessionRaw =
      r.sessionID ?? r.sessionId ?? r.SessionID ?? r.SessionId ?? r.originSessionID ?? r.originSessionId;
    const partnerRaw = r.partnerID ?? r.partnerId ?? r.PartnerID ?? r.PartnerId;
    const sessionID = asString(sessionRaw);
    const partnerNum =
      typeof partnerRaw === "number"
        ? partnerRaw
        : typeof partnerRaw === "string" && partnerRaw.trim()
          ? Number(partnerRaw)
          : NaN;
    if (!sessionID || !Number.isFinite(partnerNum) || partnerNum < 1) return null;
    return { sessionID, partnerID: partnerNum };
  };

  const dataField = root.data ?? root.Data;
  if (Array.isArray(dataField) && dataField.length > 0) {
    const fromArr = readRow(dataField[0]);
    if (fromArr) return fromArr;
  }
  const fromRoot = readRow(root);
  if (fromRoot) return fromRoot;
  return readRow(dataField);
}

async function resolvePartnerCredentialForUser(pool: Pool, userId: number): Promise<PartnerCredential | null> {
  if (!Number.isFinite(userId) || userId < 1) return null;
  const [rows] = await pool.query(
    "SELECT id, email, prolance_partner_login, prolance_partner_password FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  const userRow = (rows as {
    id?: unknown;
    email?: unknown;
    prolance_partner_login?: unknown;
    prolance_partner_password?: unknown;
  }[])[0];
  const emailRaw = asString(userRow?.email);
  const dbLogin = asString(userRow?.prolance_partner_login);
  const dbPassword = asString(userRow?.prolance_partner_password);
  if (dbPassword) {
    return { loginId: dbLogin || emailRaw || String(userId), password: dbPassword };
  }
  const credsMap = readPartnerCredentialsMap();
  return lookupPartnerCredentialInMap(credsMap, emailRaw, userId);
}

/** Designers must use their own Prolance partner login so projects appear in their Prolance bucket. */
function requiresOwnProlancePartner(role: string | null | undefined): boolean {
  return (role || "").toLowerCase() !== "admin";
}

type PartnerCredSource = "body" | "per_user" | "env_fallback" | "org_shared";

/**
 * Partner login for project create — same sequence as Postman:
 * hubapi token → CRM user's partner LoginAPI → create with that session's partnerID.
 */
async function resolvePartnerLoginForCreate(
  pool: Pool,
  userId: number,
  userRole: string,
): Promise<
  | {
      ok: true;
      token: string;
      apiKey: string;
      originSessionId: string;
      partnerID: number;
      credSource: PartnerCredSource;
      loginId: string;
    }
  | { ok: false; message: string; status: number; credSource?: PartnerCredSource; code?: string }
> {
  return resolvePartnerLoginForUser(pool, userId, undefined, {
    strictPerUser: requiresOwnProlancePartner(userRole),
  });
}

async function resolvePartnerLoginForUser(
  pool: Pool,
  userId: number,
  bodyLogin?: { loginID?: string | null; password?: string | null },
  opts?: { strictPerUser?: boolean },
): Promise<
  | {
      ok: true;
      token: string;
      apiKey: string;
      originSessionId: string;
      partnerID: number;
      credSource: PartnerCredSource;
      loginId: string;
    }
  | { ok: false; message: string; status: number; credSource?: PartnerCredSource; code?: string }
> {
  const apiKey = envTrim("PROLANCE_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      message: "Origin API key is not configured. Set PROLANCE_API_KEY in backend/.env (or env.sh on EC2), then restart the server.",
      status: 500,
    };
  }

  const username = asString(envTrim("PROLANCE_USERNAME"));
  const password = asString(envTrim("PROLANCE_PASSWORD"));
  if (!username || !password) {
    return { ok: false, message: "Prolance API credentials are not configured", status: 500 };
  }

  const tokenResp = await proxiedFetch({
    method: "POST",
    path: "/token",
    asForm: true,
    body: { grant_type: "password", username, password },
  });
  const tokenObj =
    tokenResp.data && typeof tokenResp.data === "object" ? (tokenResp.data as Record<string, unknown>) : {};
  const token =
    asString(tokenObj.access_token) || asString(tokenObj.accessToken) || asString(tokenObj.token);
  if (!token || tokenResp.status >= 400) {
    return { ok: false, message: "Failed to generate Prolance token", status: tokenResp.status || 500 };
  }

  let loginID = bodyLogin?.loginID ?? null;
  let partnerPassword = bodyLogin?.password ?? null;
  let credSource: PartnerCredSource = "body";

  if (!loginID || !partnerPassword) {
    const perUserCred = await resolvePartnerCredentialForUser(pool, userId);
    if (perUserCred) {
      loginID = perUserCred.loginId;
      partnerPassword = perUserCred.password;
      credSource = "per_user";
    }
  }

  if (!loginID || !partnerPassword) {
    if (opts?.strictPerUser) {
      const [userRows] = await pool.query("SELECT email FROM users WHERE id = ? LIMIT 1", [userId]);
      const emailRaw = asString((userRows as { email?: unknown }[])[0]?.email);
      return {
        ok: false,
        code: "PROLANCE_PARTNER_NOT_CONFIGURED",
        message: emailRaw
          ? `Your Prolance partner login is not configured for ${emailRaw}. Ask admin to add your Prolance LoginID and password in PROLANCE_PARTNER_CREDENTIALS_FILE (or on your user profile).`
          : "Your Prolance partner login is not configured. Ask admin to add your Prolance LoginID and password.",
        status: 403,
      };
    }
    loginID = asString(envTrim("PROLANCE_PARTNER_LOGIN_ID"));
    partnerPassword = asString(envTrim("PROLANCE_PARTNER_PASSWORD"));
    credSource = "env_fallback";
  }
  if (!loginID || !partnerPassword) {
    return { ok: false, message: "LoginID/password are required for partner login", status: 400 };
  }

  const partnerResp = await proxiedFetch({
    method: "POST",
    path: "/Origin/Partners/LoginAPI",
    token,
    includeOriginApiHeaders: true,
    apiKey,
    body: { LoginID: loginID, Password: partnerPassword, LoginFrom: 1 },
  });

  if (partnerResp.status >= 400) {
    console.error("[prolance-partner-login]", { userId, credSource, status: partnerResp.status });
    return {
      ok: false,
      message: "Prolance partner login failed",
      status: partnerResp.status,
      credSource,
    };
  }

  const partnerFields = extractPartnerLoginFields(partnerResp.data);
  if (!partnerFields) {
    return {
      ok: false,
      message: "Partner login did not return sessionID/partnerID",
      status: 502,
      credSource,
    };
  }

  console.log("[prolance-partner-login]", {
    userId,
    credSource,
    loginId: maskValue(loginID, 4, 8),
    partnerID: partnerFields.partnerID,
  });

  return {
    ok: true,
    token,
    apiKey,
    originSessionId: partnerFields.sessionID,
    partnerID: partnerFields.partnerID,
    credSource,
    loginId: loginID,
  };
}

function isProlanceAuthDenied(upstream: { status: number; data: unknown }): boolean {
  if (upstream.status === 401 || upstream.status === 403) return true;
  const msg =
    upstream.data && typeof upstream.data === "object"
      ? String((upstream.data as Record<string, unknown>).message || "").toLowerCase()
      : String(upstream.data || "").toLowerCase();
  return msg.includes("authorization") && msg.includes("denied");
}

/** Prolance V2 create requires projectType (e.g. CYO). V1 /Origin/Projects/Create often returns 401. */
function buildProlanceCreateUpstreamBody(body: Record<string, unknown>): Record<string, unknown> {
  const projectType =
    asString(body.projectType) ||
    asString(body.ProjectType) ||
    envTrim("PROLANCE_DEFAULT_PROJECT_TYPE") ||
    "CYO";
  return { ...body, projectType };
}

async function prolanceCreateProjectUpstream(params: {
  token: string;
  originSessionId: string;
  apiKey: string;
  body: Record<string, unknown>;
}): Promise<{ status: number; data: unknown; path: string; attempt: string }> {
  const path = "/Origin/V2/Projects/Create";
  const payload = buildProlanceCreateUpstreamBody(params.body);

  let upstream = await proxiedFetch({
    method: "PUT",
    path,
    token: params.token,
    originSessionId: params.originSessionId,
    includeOriginApiHeaders: true,
    apiKey: params.apiKey,
    body: payload,
  });
  let attempt = "v2-create+bearer";
  if (upstream.status === 401 || isProlanceAuthDenied(upstream)) {
    upstream = await proxiedFetch({
      method: "PUT",
      path,
      token: null,
      originSessionId: params.originSessionId,
      includeOriginApiHeaders: true,
      apiKey: params.apiKey,
      body: payload,
    });
    attempt = "v2-create+sessionOnly";
  }
  return { ...upstream, path, attempt };
}

function extractCreatedProjectId(v: unknown): number | null {
  if (!v || typeof v !== "object") return null;
  const root = v as Record<string, unknown>;
  const direct = root.projectID ?? root.projectId;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  if (typeof direct === "string" && direct.trim() && Number.isFinite(Number(direct))) return Number(direct);
  const arr = root.data;
  if (Array.isArray(arr) && arr[0] && typeof arr[0] === "object") {
    const first = arr[0] as Record<string, unknown>;
    const nested = first.projectID ?? first.projectId;
    if (typeof nested === "number" && Number.isFinite(nested)) return nested;
    if (typeof nested === "string" && nested.trim() && Number.isFinite(Number(nested))) return Number(nested);
  }
  return null;
}

function prolancePartnerWarning(role: string, credSource: PartnerCredSource): string | null {
  if (credSource === "env_fallback" && requiresOwnProlancePartner(role)) {
    return "Project was created under the shared Prolance partner account, not your personal Prolance login.";
  }
  if (credSource === "env_fallback") {
    return "Project was created under the shared Prolance partner account (admin fallback).";
  }
  return null;
}

async function proxiedFetch(params: {
  method: "GET" | "POST" | "PUT";
  path: string;
  token?: string | null;
  originSessionId?: string | null;
  includeOriginApiHeaders?: boolean;
  body?: unknown;
  asForm?: boolean;
  apiKey?: string | null;
}): Promise<{ status: number; data: unknown }> {
  const url = `${baseUrl()}${params.path.startsWith("/") ? params.path : `/${params.path}`}`;
  const target = new URL(url);
  const headers: Record<string, string> = {};
  let body: string | undefined;

  if (params.token) headers.Authorization = `Bearer ${params.token}`;
  if (params.originSessionId) headers.OriginSessionID = params.originSessionId;
  if (params.includeOriginApiHeaders) {
    const apiKey = (params.apiKey || "").trim();
    if (!apiKey) throw new Error("PROLANCE_API_KEY is required");
    headers.OriginAPIKey = apiKey;
    headers.NoEncryption = envTrim("PROLANCE_NO_ENCRYPTION") || "1";
  }

  if (params.body != null) {
    if (params.asForm) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(params.body as Record<string, string>).toString();
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(params.body);
    }
  }

  const timeoutMs = Number(envTrim("PROLANCE_FETCH_TIMEOUT_MS") || 120000);
  const transport = target.protocol === "https:" ? https : http;

  const { status, responseText } = await new Promise<{ status: number; responseText: string }>((resolve, reject) => {
    const req = transport.request(
      target,
      {
        method: params.method,
        headers,
      },
      (resp) => {
        const statusCode = resp.statusCode || 500;
        const chunks: Buffer[] = [];
        resp.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        resp.on("end", () => resolve({ status: statusCode, responseText: Buffer.concat(chunks).toString("utf8") }));
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });

  let data: unknown = responseText;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    // keep text
  }

  return { status, data };
}

function asErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const msg = (err as { message?: unknown }).message;
    const cause = (err as { cause?: unknown }).cause;
    if (cause && typeof cause === "object") {
      const code = (cause as { code?: unknown }).code;
      if (code === "UND_ERR_HEADERS_TIMEOUT") return "Prolance API timeout while waiting for response headers";
      if (code === "ENOTFOUND") return "Prolance API host could not be resolved";
      const causeMsg = (cause as { message?: unknown }).message;
      if (typeof causeMsg === "string" && causeMsg.trim()) return causeMsg;
    }
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "Prolance request failed";
}

function send(res: Response, status: number, data: unknown): void {
  if (typeof data === "string") res.status(status).type("text/plain").send(data);
  else res.status(status).json(data);
}

function extractQuoteIdFromResponse(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;

  const idFromQuoteList = (arr: unknown): string | null => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const objectRows = arr.filter((x) => x && typeof x === "object" && !Array.isArray(x));
    const pickRow =
      objectRows.length >= 2
        ? pickPreferredQuoteObjectFromList(arr)
        : arr[0] && typeof arr[0] === "object"
          ? (arr[0] as Record<string, unknown>)
          : null;
    if (!pickRow) return null;
    const nested = pickRow.quoteID ?? pickRow.quoteId ?? pickRow.quotationId ?? pickRow.quotationID;
    if (typeof nested === "number" && Number.isFinite(nested)) return String(nested);
    if (typeof nested === "string" && nested.trim()) return nested.trim();
    return null;
  };

  const fromList = idFromQuoteList(root.data) ?? idFromQuoteList(root.Data);
  if (fromList) return fromList;

  const direct = root.quoteID ?? root.quoteId ?? root.quotationId ?? root.quotationID;
  if (typeof direct === "number" && Number.isFinite(direct)) return String(direct);
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return null;
}

function hasDetailedQuoteData(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const root = data as Record<string, unknown>;
  const direct = root.quoteOptionsData;
  if (Array.isArray(direct) && direct.length > 0) return true;
  const arr = root.data;
  if (Array.isArray(arr) && arr[0] && typeof arr[0] === "object") {
    const first = arr[0] as Record<string, unknown>;
    if (Array.isArray(first.quoteOptionsData) && first.quoteOptionsData.length > 0) return true;
    if (first.totalPayableAmount != null || first.finalTotalPrice != null || first.totalPrice != null) return true;
  }
  if (root.totalPayableAmount != null || root.finalTotalPrice != null || root.totalPrice != null) return true;
  return false;
}

/** Align with my-app `prolanceApiGetQuote.preferLatestProlanceQuotesEnvelope`: multi-quote payloads list draft/old first. */
function readPositiveIntQuote(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 1) return Math.floor(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  return null;
}

function isLikelyDraftQuoteRow(row: Record<string, unknown>): boolean {
  if (row.isDraft === true) return true;
  const st =
    row.quoteStatus ??
    row.status ??
    row.quotationStatus ??
    row.stage ??
    row.quoteStage ??
    row.quoteState;
  if (typeof st === "string" && /\bdraft\b/i.test(st)) return true;
  return false;
}

function parseTrailingNumericSuffix(quoteNum: unknown): number {
  const s = String(quoteNum ?? "").trim();
  if (!s) return 0;
  const m = s.match(/(\d{1,9})\s*$/);
  return m ? Number(m[1]) : 0;
}

function rowCreatedMs(row: Record<string, unknown>): number {
  const d =
    row.createdOn ??
    row.createdAt ??
    row.createdDate ??
    row.createDate ??
    row.modifiedAt ??
    row.updatedAt;
  if (d == null) return 0;
  const t = new Date(String(d)).getTime();
  return Number.isFinite(t) ? t : 0;
}

function scoreQuoteRowForLatestPreference(row: Record<string, unknown>): number {
  let score = 0;
  if (!isLikelyDraftQuoteRow(row)) score += 1_000_000_000;
  const idPart = readPositiveIntQuote(row.quoteID ?? row.quoteId ?? row.quotationId ?? row.quotationID);
  if (idPart != null) score += idPart * 1_000;
  score += parseTrailingNumericSuffix(row.quoteNum ?? row.quoteNo ?? row.quotationNum) * 10;
  score += Math.floor(rowCreatedMs(row) / 86_400_000);
  return score;
}

function pickPreferredQuoteObjectFromList(items: unknown[]): Record<string, unknown> | null {
  const objects = items
    .map((item, i) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? { row: item as Record<string, unknown>, i }
        : null,
    )
    .filter(Boolean) as { row: Record<string, unknown>; i: number }[];
  if (objects.length === 0) return null;
  if (objects.length === 1) return objects[0].row;
  const sorted = [...objects].sort((a, b) => {
    const sb = scoreQuoteRowForLatestPreference(b.row);
    const sa = scoreQuoteRowForLatestPreference(a.row);
    if (sb !== sa) return sb - sa;
    return a.i - b.i;
  });
  return sorted[0].row;
}

function reorderQuoteRowsPreferredFirst(arr: unknown[]): unknown[] {
  const indexed = arr.map((item, i) => ({ item, i }));
  const objects = indexed.filter(
    (x) => x.item && typeof x.item === "object" && !Array.isArray(x.item),
  );
  if (objects.length < 2) return arr;
  const ranked = [...objects].sort((a, b) => {
    const sb = scoreQuoteRowForLatestPreference(b.item as Record<string, unknown>);
    const sa = scoreQuoteRowForLatestPreference(a.item as Record<string, unknown>);
    if (sb !== sa) return sb - sa;
    return a.i - b.i;
  });
  const preferredItems = ranked.map((r) => r.item);
  const rest = indexed
    .filter((x) => !x.item || typeof x.item !== "object" || Array.isArray(x.item))
    .map((x) => x.item);
  return [...preferredItems, ...rest];
}

function preferLatestProlanceQuotesEnvelope(envelope: unknown): unknown {
  if (!envelope || typeof envelope !== "object") return envelope;
  const root = envelope as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;
  const apply = (key: "data" | "Data") => {
    const arr = (out ?? root)[key];
    if (!Array.isArray(arr) || arr.length < 2) return;
    const nextArr = reorderQuoteRowsPreferredFirst(arr);
    if (nextArr !== arr) {
      if (!out) out = { ...root };
      out[key] = nextArr;
    }
  };
  apply("data");
  apply("Data");
  return out ?? envelope;
}

function maskValue(value: string | null | undefined, visibleStart = 6, visibleEnd = 4): string {
  const raw = String(value || "");
  if (!raw) return "(missing)";
  if (raw.length <= visibleStart + visibleEnd) return "*".repeat(raw.length);
  return `${raw.slice(0, visibleStart)}...${raw.slice(-visibleEnd)}`;
}

function parseFiniteNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asQuoteRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const QUOTE_LINE_PRICE_KEYS = [
  "price",
  "unitPrice",
  "netPrice",
  "finalPrice",
  "discountedPrice",
  "totalPrice",
  "amount",
  "payableAmount",
  "grossPrice",
  "priceAfterDiscount",
  "discountedAmount",
  "netAmount",
  "totalAmount",
  "finalAmount",
  "baseAmount",
] as const;

function extractQuoteLinePrice(o: Record<string, unknown>): number | null {
  for (const key of QUOTE_LINE_PRICE_KEYS) {
    const n = parseFiniteNum(o[key]);
    if (n != null && n > 0) return n;
  }
  return parseFiniteNum(o.price);
}

/** Match Prolance Excel BOQ: show woodWorkPrice when higher than discounted `price`. */
function extractUnitDisplayPrice(o: Record<string, unknown>): number | null {
  const linePrice = extractQuoteLinePrice(o);
  const wood = parseFiniteNum(o.woodWorkPrice);
  const acc = parseFiniteNum(o.accessoriesPrice) ?? 0;
  const hw = parseFiniteNum(o.hardwarePrice) ?? 0;
  const listKeys = ["priceOld", "oldPrice", "listPrice", "basePrice", "unitPriceOld", "grossPrice", "amountOld"];
  let listHint: number | null = null;
  for (const key of listKeys) {
    const n = parseFiniteNum(o[key]);
    if (n != null && n > 0) listHint = listHint == null ? n : Math.max(listHint, n);
  }

  if (wood != null && wood > 0 && linePrice != null && linePrice > 0 && wood > linePrice) {
    return Math.max(wood, listHint ?? 0) || wood;
  }

  if (linePrice != null && linePrice > 0) return linePrice;
  if (listHint != null && listHint > 0) return listHint;
  if (wood != null && wood > 0) return wood + acc + hw;
  return null;
}

function quoteLineMergeKey(o: Record<string, unknown>, idx: number): string {
  const itemId = asString(o.itemID ?? o.itemId);
  if (itemId) return `item-${itemId}`;
  const label = asString(o.label) || "";
  const desc = asString(o.description) || "";
  const dim = asString(o.dimensions) || "";
  const category = asString(o.category) || "";
  if (label || desc || dim) return `${label}|${desc}|${dim}|${category}`;
  return `idx-${idx}`;
}

function mergeQuoteLineItemArrays(a: unknown[], b: unknown[]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  const order: string[] = [];
  const add = (arr: unknown[]) => {
    arr.forEach((item, idx) => {
      const o = asQuoteRecord(item);
      const key = quoteLineMergeKey(o, idx);
      if (!map.has(key)) order.push(key);
      const prev = map.get(key) || {};
      const merged = { ...prev, ...o };
      const display = extractUnitDisplayPrice(merged);
      if (display != null) merged.price = display;
      map.set(key, merged);
    });
  };
  add(Array.isArray(a) ? a : []);
  add(Array.isArray(b) ? b : []);
  return order.map((k) => map.get(k)!).filter(Boolean);
}

function quoteOptionKey(o: Record<string, unknown>, idx: number): string {
  const id = o.optionID ?? o.optionId ?? o.roomID ?? o.roomId;
  return id != null ? String(id) : `idx-${idx}`;
}

function mergeQuoteOptionRow(summary: Record<string, unknown>, detail: Record<string, unknown>): Record<string, unknown> {
  return {
    ...detail,
    ...summary,
    totalPrice: summary.totalPrice ?? detail.totalPrice,
    totalPriceOld: summary.totalPriceOld ?? detail.totalPriceOld,
    unitsPrice: summary.unitsPrice ?? detail.unitsPrice,
    loftsPrice: summary.loftsPrice ?? detail.loftsPrice,
    servicesPrice: summary.servicesPrice ?? detail.servicesPrice,
    appliancesPrice: summary.appliancesPrice ?? detail.appliancesPrice,
    skirtingsPrice: summary.skirtingsPrice ?? detail.skirtingsPrice,
    worktopsPrice: summary.worktopsPrice ?? detail.worktopsPrice,
    additionalHWPrice: summary.additionalHWPrice ?? detail.additionalHWPrice,
    units: mergeQuoteLineItemArrays(
      Array.isArray(summary.units) ? summary.units : [],
      Array.isArray(detail.units) ? detail.units : [],
    ),
    lofts: mergeQuoteLineItemArrays(
      Array.isArray(summary.lofts) ? summary.lofts : [],
      Array.isArray(detail.lofts) ? detail.lofts : [],
    ),
    services: mergeQuoteLineItemArrays(
      Array.isArray(summary.services) ? summary.services : [],
      Array.isArray(detail.services) ? detail.services : [],
    ),
  };
}

function mergeQuoteOptionsData(summaryRows: unknown[], detailRows: unknown[]): Record<string, unknown>[] {
  const detailByKey = new Map<string, Record<string, unknown>>();
  detailRows.forEach((row, idx) => {
    const o = asQuoteRecord(row);
    detailByKey.set(quoteOptionKey(o, idx), o);
  });
  if (summaryRows.length === 0) return detailRows.map((r) => asQuoteRecord(r));
  return summaryRows.map((row, idx) => {
    const summary = asQuoteRecord(row);
    const detail = detailByKey.get(quoteOptionKey(summary, idx));
    if (!detail) return summary;
    return mergeQuoteOptionRow(summary, detail);
  });
}

function applyHubDiscountOverlay(
  live: Record<string, unknown>,
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const overlay: Record<string, unknown> = {};
  const keys = [
    "hubFlatDiscountPct",
    "hubFlatDiscountAmount",
    "hubCategoryDiscountPct",
    "hubCategoryDiscountAmount",
  ] as const;
  for (const k of keys) {
    if (snapshot[k] != null) overlay[k] = snapshot[k];
  }
  const snapData = snapshot.data ?? snapshot.Data;
  const snapRow =
    snapData && typeof snapData === "object" && !Array.isArray(snapData)
      ? (snapData as Record<string, unknown>)
      : Array.isArray(snapData) && snapData[0] && typeof snapData[0] === "object"
        ? (snapData[0] as Record<string, unknown>)
        : null;
  if (snapRow) {
    for (const k of keys) {
      if (overlay[k] == null && snapRow[k] != null) overlay[k] = snapRow[k];
    }
  }
  if (Object.keys(overlay).length === 0) return live;

  const out: Record<string, unknown> = { ...live, ...overlay };
  const data = out.data ?? out.Data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    out.data = { ...(data as Record<string, unknown>), ...overlay };
  } else if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    out.data = [{ ...(data[0] as Record<string, unknown>), ...overlay }, ...data.slice(1)];
  }
  return out;
}

function mergeFullDetailsWithSummaryQuote(
  fullRoot: Record<string, unknown>,
  fullData: Record<string, unknown>,
  matched: Record<string, unknown>,
): Record<string, unknown> {
  const summaryOptionsData = Array.isArray(matched.quoteOptionsData) ? matched.quoteOptionsData : [];
  const fullOptionsData = Array.isArray(fullData.quoteOptionsData)
    ? fullData.quoteOptionsData
    : Array.isArray(fullData.optionDetails)
      ? fullData.optionDetails
      : [];
  const mergedOptionsData = mergeQuoteOptionsData(summaryOptionsData, fullOptionsData);

  return {
    ...fullRoot,
    data: {
      ...fullData,
      totalPrice: matched.totalPrice ?? fullData.totalPrice,
      finalTotalPrice: matched.finalTotalPrice ?? fullData.finalTotalPrice,
      discount: matched.discount ?? fullData.discount,
      quoteNum: matched.quoteNum ?? fullData.quoteNum,
      quoteOptionsData:
        mergedOptionsData.length > 0
          ? mergedOptionsData
          : summaryOptionsData.length > 0
            ? summaryOptionsData
            : fullData.quoteOptionsData ?? fullData.optionDetails,
      optionDetails: mergedOptionsData.length > 0 ? mergedOptionsData : fullData.optionDetails,
    },
  };
}


function normalizeQuotePricingRow(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  let v: unknown = data;
  if (Array.isArray(v)) {
    const flat = v.flatMap((x) => (Array.isArray(x) ? x : [x]));
    const objects = flat.filter((x) => x != null && typeof x === "object" && !Array.isArray(x)) as Record<
      string,
      unknown
    >[];
    const chosen = objects.length >= 2 ? pickPreferredQuoteObjectFromList(flat) : objects[0] ?? null;
    if (chosen == null) return null;
    v = chosen;
  }
  if (typeof v !== "object" || v === null) return null;
  const root = v as Record<string, unknown>;
  const inner = root.data ?? root.Data;
  if (inner != null && typeof inner === "object") {
    if (Array.isArray(inner)) {
      const flat = inner.flatMap((x) => (Array.isArray(x) ? x : [x]));
      const objects = flat.filter((x) => x != null && typeof x === "object" && !Array.isArray(x)) as Record<
        string,
        unknown
      >[];
      const row = objects.length >= 2 ? pickPreferredQuoteObjectFromList(flat) : objects[0] ?? null;
      if (row && typeof row === "object") return row;
      return root;
    }
    return inner as Record<string, unknown>;
  }
  return root;
}

/** Aligns with quote UI total extraction (totalPayableAmount / room sums). */
function extractTotalPayableAmount(data: unknown): number | null {
  const row = normalizeQuotePricingRow(data);
  if (!row) return null;
  const pick = (...keys: string[]): number | null => {
    for (const k of keys) {
      const n = parseFiniteNum(row[k]);
      if (n != null) return n;
    }
    return null;
  };
  const pickedPayable = pick("totalPayableAmount", "finalTotalPrice", "finalPrice");
  const discount = pick("discount", "discountAmount") ?? 0;
  const options = row.quoteOptionsData;
  if (Array.isArray(options) && options.length > 0) {
    let sumRoomTotals = 0;
    for (const opt of options) {
      if (!opt || typeof opt !== "object") continue;
      const o = opt as Record<string, unknown>;
      const rooms = Array.isArray(o.rooms) ? o.rooms : [];
      for (const room of rooms) {
        if (!room || typeof room !== "object") continue;
        const r = room as Record<string, unknown>;
        sumRoomTotals += parseFiniteNum(r.totalPrice) ?? parseFiniteNum(r.totalPriceOld) ?? 0;
      }
    }
    if (sumRoomTotals > 0) {
      const tolerance = Math.max(500, sumRoomTotals * 0.02);
      if (
        pickedPayable != null &&
        pickedPayable >= sumRoomTotals - discount - tolerance &&
        (Math.abs(pickedPayable - sumRoomTotals) <= tolerance || pickedPayable >= sumRoomTotals - discount)
      ) {
        return pickedPayable;
      }
      const fees = pick("designAndManagementFees") ?? 0;
      return sumRoomTotals + fees - discount;
    }
  }
  return (
    pickedPayable ?? pick("interiorProjectAmount", "projectAmount", "subTotal", "totalPrice")
  );
}

type ProlanceServerSession = { token: string; originSessionId: string; apiKey: string };

async function createProlanceServerSession(): Promise<ProlanceServerSession | { error: string; status: number }> {
  const apiKey = envTrim("PROLANCE_API_KEY");
  if (!apiKey) return { error: "Origin API key is not configured", status: 500 };

  const username = asString(envTrim("PROLANCE_USERNAME"));
  const password = asString(envTrim("PROLANCE_PASSWORD"));
  if (!username || !password) return { error: "Prolance API credentials are not configured", status: 500 };

  const tokenResp = await proxiedFetch({
    method: "POST",
    path: "/token",
    asForm: true,
    body: { grant_type: "password", username, password },
  });
  if (tokenResp.status < 200 || tokenResp.status >= 300 || !tokenResp.data || typeof tokenResp.data !== "object") {
    return { error: "Failed to generate Prolance token", status: tokenResp.status || 500 };
  }
  const tokenObj = tokenResp.data as Record<string, unknown>;
  const token =
    asString(tokenObj.access_token) || asString(tokenObj.accessToken) || asString(tokenObj.token);
  if (!token) return { error: "Failed to generate Prolance token", status: 500 };

  const loginID = asString(envTrim("PROLANCE_PARTNER_LOGIN_ID"));
  const partnerPassword = asString(envTrim("PROLANCE_PARTNER_PASSWORD"));
  if (!loginID || !partnerPassword) {
    return { error: "Partner login credentials are not configured", status: 500 };
  }

  const partnerResp = await proxiedFetch({
    method: "POST",
    path: "/Origin/Partners/LoginAPI",
    token,
    includeOriginApiHeaders: true,
    apiKey,
    body: { LoginID: loginID, Password: partnerPassword, LoginFrom: 1 },
  });
  if (partnerResp.status < 200 || partnerResp.status >= 300 || !partnerResp.data || typeof partnerResp.data !== "object") {
    return { error: "Prolance partner login failed", status: partnerResp.status || 500 };
  }
  const partnerRoot = partnerResp.data as Record<string, unknown>;
  const partnerData =
    Array.isArray(partnerRoot.data) && partnerRoot.data[0] && typeof partnerRoot.data[0] === "object"
      ? (partnerRoot.data[0] as Record<string, unknown>)
      : {};
  const originSessionId =
    asString(partnerData.sessionID) ||
    asString(partnerData.sessionId) ||
    asString(partnerData.originSessionID) ||
    asString(partnerData.originSessionId);
  if (!originSessionId) return { error: "Failed to get OriginSessionID from Prolance partner login", status: 500 };

  return { token, originSessionId, apiKey };
}

async function prolanceFetchWithRetry(params: {
  method: "GET" | "POST" | "PUT";
  path: string;
  session: ProlanceServerSession;
  body?: unknown;
}): Promise<{ status: number; data: unknown }> {
  let upstream = await proxiedFetch({
    method: params.method,
    path: params.path,
    token: params.session.token,
    originSessionId: params.session.originSessionId,
    includeOriginApiHeaders: true,
    apiKey: params.session.apiKey,
    body: params.body,
  });
  if (upstream.status === 401) {
    upstream = await proxiedFetch({
      method: params.method,
      path: params.path,
      token: null,
      originSessionId: params.session.originSessionId,
      includeOriginApiHeaders: true,
      apiKey: params.session.apiKey,
      body: params.body,
    });
  }
  return upstream;
}

async function fetchLatestQuoteBodyForProject(
  projectId: number,
  session: ProlanceServerSession,
): Promise<unknown | null> {
  let quotesResp = await prolanceFetchWithRetry({
    method: "GET",
    path: `/Origin/Quotes/${pathSegment(String(projectId))}`,
    session,
  });
  if (quotesResp.status < 200 || quotesResp.status >= 300 || !quotesResp.data) return null;

  let envelope = preferLatestProlanceQuotesEnvelope(quotesResp.data);
  if (hasDetailedQuoteData(envelope)) return envelope;

  const quoteId = extractQuoteIdFromResponse(envelope);
  if (!quoteId) return envelope;

  const fullDetails = await prolanceFetchWithRetry({
    method: "GET",
    path: `/Origin/Quotes/FullDetails/${pathSegment(quoteId)}`,
    session,
  });
  if (fullDetails.status >= 200 && fullDetails.status < 300 && fullDetails.data) {
    return fullDetails.data;
  }
  return envelope;
}

async function fetchQuoteBodyByQuoteId(
  quoteId: number,
  session: ProlanceServerSession,
): Promise<unknown | null> {
  const fullDetails = await prolanceFetchWithRetry({
    method: "GET",
    path: `/Origin/Quotes/FullDetails/${pathSegment(String(quoteId))}`,
    session,
  });
  if (fullDetails.status >= 200 && fullDetails.status < 300 && fullDetails.data) {
    return fullDetails.data;
  }
  return null;
}

export type LeadQuotePaymentSummary = {
  quoteId: number | null;
  quoteNum: string | null;
  totalPayableAmount: number;
  tenPercentAmount: number;
  fortyPercentAmount: number;
};

export function formatQuoteInrAmount(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** Latest quotation total + milestone amounts (10% / 40%) for payment emails and sales closure. */
export async function resolveLeadQuotePaymentSummary(
  pool: Pool,
  leadId: number,
): Promise<LeadQuotePaymentSummary | null> {
  const [leadRows] = await pool.query(
    `SELECT id, prolance_project_id AS prolanceProjectId, prolance_quote_id AS prolanceQuoteId, payload
     FROM leads WHERE id = ? LIMIT 1`,
    [leadId],
  );
  const lead = (leadRows as { prolanceProjectId?: unknown; prolanceQuoteId?: unknown; payload?: unknown }[])[0];
  if (!lead) return null;

  const prolanceProjectId =
    lead.prolanceProjectId != null && Number.isFinite(Number(lead.prolanceProjectId))
      ? Number(lead.prolanceProjectId)
      : null;
  let quoteId =
    lead.prolanceQuoteId != null && Number.isFinite(Number(lead.prolanceQuoteId))
      ? Number(lead.prolanceQuoteId)
      : null;

  let quoteBody: unknown | null = null;

  if (prolanceProjectId != null && prolanceProjectId >= 1) {
    const session = await createProlanceServerSession();
    if (!("error" in session)) {
      quoteBody = await fetchLatestQuoteBodyForProject(prolanceProjectId, session);
      const resolved = extractQuoteIdFromResponse(quoteBody);
      if (resolved) quoteId = Number(resolved);
    }
  } else if (quoteId != null && quoteId >= 1) {
    const session = await createProlanceServerSession();
    if (!("error" in session)) {
      quoteBody = await fetchQuoteBodyByQuoteId(quoteId, session);
    }
  }

  if (quoteBody == null) {
    const [snapRows] = await pool.query(
      `SELECT quote_id AS quoteId, payload_json AS payloadJson
       FROM lead_prolance_quote_snapshots
       WHERE lead_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [leadId],
    );
    const snap = (snapRows as { quoteId?: unknown; payloadJson?: unknown }[])[0];
    if (snap?.quoteId != null && Number.isFinite(Number(snap.quoteId))) {
      quoteId = Number(snap.quoteId);
    }
    if (snap?.payloadJson != null) {
      const raw = String(snap.payloadJson);
      if (raw.length > 0) {
        try {
          quoteBody = JSON.parse(raw) as unknown;
        } catch {
          /* ignore */
        }
      }
    }
  }

  const totalPayableAmount = extractTotalPayableAmount(quoteBody);
  if (totalPayableAmount == null || !Number.isFinite(totalPayableAmount) || totalPayableAmount <= 0) {
    return null;
  }

  const row = normalizeQuotePricingRow(quoteBody);
  const quoteNum =
    row &&
    (asString(row.quoteNum) ||
      asString(row.quoteNo) ||
      asString(row.quotationNum) ||
      asString(row.quoteID) ||
      asString(row.quoteId));

  return {
    quoteId: quoteId != null && quoteId >= 1 ? quoteId : null,
    quoteNum,
    totalPayableAmount,
    tenPercentAmount: Math.round(totalPayableAmount * 0.1),
    fortyPercentAmount: Math.round(totalPayableAmount * 0.4),
  };
}

function parseLeadPayloadAmount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    const n = Number(v);
    return n >= 0 ? n : null;
  }
  return null;
}

function readLeadPayloadRecord(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export type LeadMilestonePaymentBreakdown = LeadQuotePaymentSummary & {
  /** Cumulative paid so far (sales 10% + any design payments). */
  totalPaidCumulative: number;
  totalPaidToward10Percent: number;
  totalPaidToward40Percent: number;
  /** Design 10% milestone = reach 20% cumulative (sales 10% + design 10%). */
  twentyPercentTarget: number;
  /** Design 40% payment milestone = reach 60% cumulative (sales 10% + design 10% + design 40%). */
  sixtyPercentTarget: number;
  previousTenPercentTarget: number | null;
  previousTwentyPercentTarget: number | null;
  previousSixtyPercentTarget: number | null;
  previousFortyPercentTarget: number | null;
  quotationTotalAtLastPayment: number | null;
  /** Collect now at design 10% milestone → 20% of latest quote minus already paid. */
  amountToCollect10: number;
  /** Collect now at 40% payment milestone → 60% of latest quote minus already paid. */
  amountToCollect40: number;
  quoteRevisionTopUp10: number;
  quoteRevisionTopUp40: number;
  remainingAfterTwentyPercent: number;
  /** Balance remaining after 60% cumulative is reached. */
  remainingAfterSixtyPercent: number;
};

function readPaidFromFinanceHistory(payload: Record<string, unknown>): number {
  const raw = payload.finance_submission_history;
  if (!Array.isArray(raw)) return 0;
  let max = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const cum = parseLeadPayloadAmount(o.cumulativeTotal ?? o.cumulative_total);
    if (cum != null && cum > max) max = cum;
  }
  return max;
}

async function readHubBookingAmountReceived(pool: Pool, leadId: number): Promise<number> {
  try {
    const [rows] = await pool.query(
      `SELECT amount_received as amountReceived
       FROM lead_hub_booking_sync WHERE lead_id = ? ORDER BY synced_at DESC LIMIT 1`,
      [leadId],
    );
    const n = parseLeadPayloadAmount((rows as { amountReceived?: unknown }[])[0]?.amountReceived);
    return n != null && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Latest quote + sales/design payments → amounts designers must collect now. */
export async function resolveLeadMilestonePaymentBreakdown(
  pool: Pool,
  leadId: number,
): Promise<LeadMilestonePaymentBreakdown | null> {
  const summary = await resolveLeadQuotePaymentSummary(pool, leadId);
  if (!summary) return null;

  const [leadRows] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [leadId]);
  const payload = readLeadPayloadRecord((leadRows as { payload?: unknown }[])[0]?.payload);
  const nested =
    payload.formData && typeof payload.formData === "object"
      ? (payload.formData as Record<string, unknown>)
      : payload.form_data && typeof payload.form_data === "object"
        ? (payload.form_data as Record<string, unknown>)
        : {};

  const readPaid = (keys: string[]): number => {
    for (const k of keys) {
      const n = parseLeadPayloadAmount(payload[k] ?? nested[k]);
      if (n != null && n > 0) return n;
    }
    return 0;
  };

  const totalPaidCumulative = Math.max(
    readPaid([
      "total_paid_cumulative",
      "total_paid_toward_10_percent",
      "amount_paid",
    ]),
    readPaidFromFinanceHistory(payload),
    await readHubBookingAmountReceived(pool, leadId),
  );
  const totalPaidToward10Percent = totalPaidCumulative;
  const totalPaidToward40Percent = readPaid(["total_paid_toward_40_percent"]);

  const twentyPercentTarget = Math.round(summary.totalPayableAmount * 0.2);
  const sixtyPercentTarget = Math.round(summary.totalPayableAmount * 0.6);

  const previousTenPercentTarget = parseLeadPayloadAmount(
    payload.ten_percent_target ?? nested.ten_percent_target,
  );
  const previousFortyPercentTarget = parseLeadPayloadAmount(
    payload.forty_percent_target ?? nested.forty_percent_target,
  );
  const quotationTotalAtLastPayment = parseLeadPayloadAmount(
    payload.quotation_total ?? nested.quotation_total,
  );
  const previousTwentyPercentTarget =
    quotationTotalAtLastPayment != null && quotationTotalAtLastPayment > 0
      ? Math.round(quotationTotalAtLastPayment * 0.2)
      : previousTenPercentTarget != null && previousTenPercentTarget > 0
        ? Math.round(previousTenPercentTarget * 2)
        : null;
  const previousSixtyPercentTarget =
    quotationTotalAtLastPayment != null && quotationTotalAtLastPayment > 0
      ? Math.round(quotationTotalAtLastPayment * 0.6)
      : parseLeadPayloadAmount(payload.sixty_percent_target ?? nested.sixty_percent_target);
  const previousSixtyFromOldQuote = previousSixtyPercentTarget;

  // Design 10% milestone: sales 10% + design 10% = 20% cumulative of latest quote.
  const amountToCollect10 = Math.max(0, twentyPercentTarget - totalPaidCumulative);
  // 40% payment milestone: collect until 60% cumulative of latest quote.
  const amountToCollect40 = Math.max(0, sixtyPercentTarget - totalPaidCumulative);

  const quoteRevisionTopUp10 =
    previousTwentyPercentTarget != null && previousTwentyPercentTarget > 0
      ? Math.max(0, twentyPercentTarget - previousTwentyPercentTarget)
      : 0;
  const quoteRevisionTopUp40 =
    previousSixtyFromOldQuote != null && previousSixtyFromOldQuote > 0
      ? Math.max(0, sixtyPercentTarget - previousSixtyFromOldQuote)
      : 0;

  return {
    ...summary,
    totalPaidCumulative,
    totalPaidToward10Percent,
    totalPaidToward40Percent,
    twentyPercentTarget,
    sixtyPercentTarget,
    previousTenPercentTarget,
    previousTwentyPercentTarget,
    previousSixtyPercentTarget,
    previousFortyPercentTarget,
    quotationTotalAtLastPayment,
    amountToCollect10,
    amountToCollect40,
    quoteRevisionTopUp10,
    quoteRevisionTopUp40,
    remainingAfterTwentyPercent: Math.max(0, summary.totalPayableAmount - twentyPercentTarget),
    remainingAfterSixtyPercent: Math.max(0, summary.totalPayableAmount - sixtyPercentTarget),
  };
}

export function registerProlanceRoutes(
  app: Express,
  getUserFromSession: (req: Request) => Promise<SessionUser | null>,
  pool: Pool,
): void {
  const TEST_PREFIX = "/api/prolance-test";
  const requireUser = async (req: Request, res: Response): Promise<SessionUser | null> => {
    const user = await getUserFromSession(req);
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return null;
    }
    if (!canUseProlance(user.role)) {
      res.status(403).json({ message: "You do not have access to Prolance integration" });
      return null;
    }
    return user;
  };

  app.get(`${TEST_PREFIX}/status`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const credsMap = readPartnerCredentialsMap();
    const [userRows] = await pool.query("SELECT email FROM users WHERE id = ? LIMIT 1", [user.id]);
    const emailRaw = asString((userRows as { email?: unknown }[])[0]?.email);
    const userEmail = normalizeUserKey(emailRaw);
    const yourCred = lookupPartnerCredentialInMap(credsMap, emailRaw, user.id);
    return res.json({
      baseUrl: baseUrl(),
      hasApiKey: Boolean(envTrim("PROLANCE_API_KEY")),
      hasProlanceUsername: Boolean(envTrim("PROLANCE_USERNAME")),
      hasProlancePassword: Boolean(envTrim("PROLANCE_PASSWORD")),
      hasPartnerCredentialsJson: Boolean(envTrim("PROLANCE_PARTNER_CREDENTIALS_JSON")),
      hasPartnerCredentialsFile: Boolean(envTrim("PROLANCE_PARTNER_CREDENTIALS_FILE")),
      partnerCredentialsKeyCount: Object.keys(credsMap).length,
      partnerCredentialConfiguredForYou: Boolean(yourCred),
      yourEmail: emailRaw || null,
      yourProlanceLoginId: yourCred?.loginId || null,
    });
  });

  // Collection: POST https://api.prolance.design/token
  app.post(`${TEST_PREFIX}/token`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const username = asString(req.body?.username) || asString(envTrim("PROLANCE_USERNAME"));
      const password = asString(req.body?.password) || asString(envTrim("PROLANCE_PASSWORD"));
      if (!username || !password) {
        return res.status(400).json({ message: "username and password are required" });
      }
      const upstream = await proxiedFetch({
        method: "POST",
        path: "/token",
        asForm: true,
        body: { grant_type: "password", username, password },
      });
      return send(res, upstream.status, upstream.data);
    } catch (err) {
      console.error("prolance token error", err);
      return res.status(500).json({ message: asErrorMessage(err) });
    }
  });

  // Collection: POST {{base_url}}/Origin/Partners/LoginAPI
  app.post(`${TEST_PREFIX}/partners/login`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const token = readToken(req);
      const apiKey = readApiKey(req);
      if (!token) return res.status(400).json({ message: "token is required (X-Prolance-Token or body.token)" });
      if (!apiKey) return res.status(400).json({ message: "Origin API key is required (env PROLANCE_API_KEY)" });

      let loginID = asString(req.body?.loginID) || asString(req.body?.LoginID);
      let password = asString(req.body?.password) || asString(req.body?.Password);
      let credSource: "body" | "per_user" | "env_fallback" = "body";

      if (!loginID || !password) {
        const perUserCred = await resolvePartnerCredentialForUser(pool, user.id);
        if (perUserCred) {
          loginID = perUserCred.loginId;
          password = perUserCred.password;
          credSource = "per_user";
        }
      }

      if (!loginID || !password) {
        loginID = asString(envTrim("PROLANCE_PARTNER_LOGIN_ID"));
        password = asString(envTrim("PROLANCE_PARTNER_PASSWORD"));
        credSource = "env_fallback";
      }
      if (!loginID || !password) return res.status(400).json({ message: "LoginID/password are required" });

      console.log("[prolance-partner-login]", {
        userId: user.id,
        credSource,
        loginId: maskValue(loginID, 4, 8),
      });

      const upstream = await proxiedFetch({
        method: "POST",
        path: "/Origin/Partners/LoginAPI",
        token,
        includeOriginApiHeaders: true,
        apiKey,
        body: { LoginID: loginID, Password: password, LoginFrom: 1 },
      });

      if (upstream.status >= 400) {
        console.error("[prolance-partner-login] upstream failed", {
          userId: user.id,
          credSource,
          status: upstream.status,
          upstream: upstream.data,
        });
        return send(res, upstream.status, upstream.data);
      }

      const partnerFields = extractPartnerLoginFields(upstream.data);
      if (!partnerFields) {
        console.error("[prolance-partner-login] missing session/partner in response", {
          userId: user.id,
          credSource,
          upstream: upstream.data,
        });
        return res.status(502).json({
          message:
            "Partner login succeeded but Prolance did not return sessionID/partnerID. Check LoginID/password for this user.",
          credSource,
          upstream: upstream.data,
        });
      }

      const payload =
        upstream.data && typeof upstream.data === "object" && !Array.isArray(upstream.data)
          ? { ...(upstream.data as Record<string, unknown>) }
          : { data: upstream.data };
      return res.status(upstream.status).json({
        ...payload,
        sessionID: partnerFields.sessionID,
        partnerID: partnerFields.partnerID,
        credSource,
      });
    } catch (err) {
      console.error("prolance partners login error", err);
      return res.status(500).json({ message: asErrorMessage(err) });
    }
  });

  // Collection: GET {{base_url}}/Origin/Projects/{{partner_id}}
  app.get(`${TEST_PREFIX}/projects/:partnerId`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const token = readToken(req);
      const originSessionId = readOriginSessionId(req);
      const apiKey = readApiKey(req);
      if (!token) return res.status(400).json({ message: "token is required" });
      if (!originSessionId) return res.status(400).json({ message: "OriginSessionID is required" });
      if (!apiKey) return res.status(400).json({ message: "Origin API key is required" });

      const upstream = await proxiedFetch({
        method: "GET",
        path: `/Origin/Projects/${pathSegment(req.params.partnerId)}`,
        token,
        originSessionId,
        includeOriginApiHeaders: true,
        apiKey,
      });
      return send(res, upstream.status, upstream.data);
    } catch (err) {
      console.error("prolance projects list error", err);
      return res.status(500).json({ message: asErrorMessage(err) });
    }
  });

  /**
   * Create a Prolance project as the logged-in CRM user (per-user partner creds from env/file).
   * partnerID always comes from the partner LoginAPI response for that user (Postman parity).
   */
  app.post(`${TEST_PREFIX}/projects/create-as-user`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const createBody: Record<string, unknown> = {
      pName: asString(body.pName) || "Untitled Project",
      customer: asString(body.customer) || "Customer",
      city: asString(body.city) || "Bengaluru",
      state: asString(body.state) || "Karnataka",
      projectType: asString(body.projectType) || asString(body.ProjectType) || undefined,
    };

    try {
      const login = await resolvePartnerLoginForCreate(pool, user.id, user.role);
      if (!login.ok) {
        return res.status(login.status).json({
          message: login.message,
          code: login.code,
          credSource: login.credSource,
        });
      }

      createBody.partnerID = login.partnerID;

      const upstream = await prolanceCreateProjectUpstream({
        token: login.token,
        originSessionId: login.originSessionId,
        apiKey: login.apiKey,
        body: createBody,
      });

      const warning = prolancePartnerWarning(user.role, login.credSource);
      if (!upstream.status || upstream.status >= 400) {
        console.error("[prolance-create-as-user] failed", {
          userId: user.id,
          loginId: maskValue(login.loginId, 4, 8),
          credSource: login.credSource,
          partnerID: login.partnerID,
          httpStatus: upstream.status,
          attempt: upstream.attempt,
          path: upstream.path,
          requestBody: createBody,
          upstream: upstream.data,
        });
        const payload =
          upstream.data && typeof upstream.data === "object"
            ? { ...(upstream.data as Record<string, unknown>) }
            : { message: "Create project failed" };
        return res.status(upstream.status || 500).json({
          ...payload,
          credSource: login.credSource,
          partnerID: login.partnerID,
          warning,
        });
      }

      const createdProjectId = extractCreatedProjectId(upstream.data);
      return res.status(upstream.status).json({
        ...(upstream.data && typeof upstream.data === "object" ? (upstream.data as Record<string, unknown>) : {}),
        ok: true,
        createdProjectId,
        credSource: login.credSource,
        partnerID: login.partnerID,
        prolanceLoginId: login.loginId,
        warning,
      });
    } catch (err) {
      console.error("prolance create-as-user error", err);
      return res.status(500).json({ message: asErrorMessage(err) });
    }
  });

  // Collection: PUT {{base_url}}/Origin/V2/Projects/Create (V2 + projectType required by Prolance)
  app.put(`${TEST_PREFIX}/projects/create`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const raw =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      const createBody: Record<string, unknown> = {
        pName: asString(raw.pName) || "Untitled Project",
        customer: asString(raw.customer) || "Customer",
        city: asString(raw.city) || "Bengaluru",
        state: asString(raw.state) || "Karnataka",
        projectType: asString(raw.projectType) || asString(raw.ProjectType) || undefined,
      };

      const login = await resolvePartnerLoginForCreate(pool, user.id, user.role);
      if (!login.ok) {
        return res.status(login.status).json({
          message: login.message,
          code: login.code,
          credSource: login.credSource,
          hint: "Partner login failed. Map the CRM user's email in PROLANCE_PARTNER_CREDENTIALS_FILE (same LoginID/password as Postman).",
        });
      }

      createBody.partnerID = login.partnerID;

      const upstream = await prolanceCreateProjectUpstream({
        token: login.token,
        originSessionId: login.originSessionId,
        apiKey: login.apiKey,
        body: createBody,
      });

      const warning = prolancePartnerWarning(user.role, login.credSource);
      if (upstream.status >= 400) {
        console.error("[prolance-create] upstream failed", {
          userId: user.id,
          loginId: maskValue(login.loginId, 4, 8),
          credSource: login.credSource,
          partnerID: login.partnerID,
          httpStatus: upstream.status,
          attempt: upstream.attempt,
          path: upstream.path,
          requestBody: createBody,
          upstream: upstream.data,
        });
      }

      const basePayload =
        upstream.data && typeof upstream.data === "object"
          ? (upstream.data as Record<string, unknown>)
          : { message: upstream.data ?? "Create project failed" };

      if (upstream.status >= 400) {
        return res.status(upstream.status).json({
          ...basePayload,
          credSource: login.credSource,
          partnerID: login.partnerID,
          warning,
        });
      }

      return res.status(upstream.status).json({
        ...basePayload,
        createdProjectId: extractCreatedProjectId(upstream.data),
        credSource: login.credSource,
        partnerID: login.partnerID,
        warning,
      });
    } catch (err) {
      console.error("prolance projects create error", err);
      return res.status(500).json({ message: asErrorMessage(err) });
    }
  });

  async function loadQuoteVersionsForLeadPublic(leadId: number): Promise<Array<{ quoteId: number; createdAt: string }>> {
    const [rows] = await pool.query(
      `SELECT quote_id AS quoteId, created_at AS createdAt
       FROM lead_prolance_quote_versions
       WHERE lead_id = ?
       ORDER BY created_at ASC, id ASC`,
      [leadId],
    );
    const toIso = (d: unknown) =>
      d instanceof Date ? d.toISOString() : typeof d === "string" ? d : new Date().toISOString();
    const list = (rows as { quoteId: unknown; createdAt: unknown }[]).map((r) => ({
      quoteId: Number(r.quoteId),
      createdAt: toIso(r.createdAt),
    }));
    const [lr] = await pool.query(`SELECT prolance_quote_id, update_at FROM leads WHERE id = ? LIMIT 1`, [leadId]);
    const pq = (lr as { prolance_quote_id?: unknown }[])[0]?.prolance_quote_id;
    if (pq != null && Number(pq) > 0 && !list.some((x) => x.quoteId === Number(pq))) {
      const u = (lr as { update_at?: unknown }[])[0]?.update_at;
      list.push({ quoteId: Number(pq), createdAt: toIso(u) });
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return list;
  }

  // Public: quotation revisions for the same lead (customers can open older quote links). No login.
  app.get(`${TEST_PREFIX}/public/quote-revisions/:quoteId`, async (req: Request, res: Response): Promise<void> => {
    const seed = Number(String(req.params.quoteId || "").trim());
    if (!Number.isFinite(seed) || seed < 1) {
      res.status(400).json({ message: "Invalid quoteId" });
      return;
    }
    try {
      let leadId: number | null = null;
      const [v1] = await pool.query(
        `SELECT lead_id AS lid FROM lead_prolance_quote_versions WHERE quote_id = ? LIMIT 1`,
        [seed],
      );
      const lid1 = (v1 as { lid?: unknown }[])[0]?.lid;
      leadId = lid1 != null && Number.isFinite(Number(lid1)) ? Number(lid1) : null;
      if (leadId == null || leadId < 1) {
        const [s1] = await pool.query(`SELECT lead_id AS lid FROM lead_prolance_quote_snapshots WHERE quote_id = ? LIMIT 1`, [
          seed,
        ]);
        const lid2 = (s1 as { lid?: unknown }[])[0]?.lid;
        leadId = lid2 != null && Number.isFinite(Number(lid2)) ? Number(lid2) : null;
      }
      if (leadId == null || leadId < 1) {
        const [l1] = await pool.query(`SELECT id AS lid FROM leads WHERE prolance_quote_id = ? LIMIT 1`, [seed]);
        const lid3 = (l1 as { lid?: unknown }[])[0]?.lid;
        leadId = lid3 != null && Number.isFinite(Number(lid3)) ? Number(lid3) : null;
      }
      if (leadId == null || leadId < 1) {
        res.json({ versions: [{ quoteId: seed, createdAt: new Date().toISOString() }] });
        return;
      }
      const versions = await loadQuoteVersionsForLeadPublic(leadId);
      if (versions.length === 0) {
        res.json({ versions: [{ quoteId: seed, createdAt: new Date().toISOString() }] });
        return;
      }
      res.json({ versions });
    } catch (err) {
      console.error("public quote-revisions error", err);
      res.status(500).json({ message: asErrorMessage(err) });
    }
  });

  // Public share: quote by ID (no app-session auth). Must be registered BEFORE `/quotes/:projectId`
  // or Express will treat "share" as a project id.
  const handlePublicQuoteView = async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = String(req.params.quoteId || "").trim();
      if (!quoteId) {
        res.status(400).json({ message: "quoteId is required" });
        return;
      }

      let snapshotPayload: Record<string, unknown> | null = null;
      const snapshotQid = Number(quoteId);
      if (Number.isFinite(snapshotQid) && snapshotQid > 0) {
        try {
          const [rows] = await pool.query(
            "SELECT payload_json FROM lead_prolance_quote_snapshots WHERE quote_id = ? LIMIT 1",
            [snapshotQid],
          );
          const row = (rows as { payload_json?: unknown }[])[0];
          const raw = row?.payload_json != null ? String(row.payload_json) : "";
          if (raw.length > 0) {
            const parsed = JSON.parse(raw) as unknown;
            if (parsed && typeof parsed === "object") {
              snapshotPayload = parsed as Record<string, unknown>;
            }
          }
        } catch (snapErr) {
          console.error("quote snapshot read error", snapErr);
        }
      }

      const apiKey = readApiKey(req);
      if (!apiKey) {
        if (snapshotPayload) {
          send(res, 200, snapshotPayload);
          return;
        }
        res.status(500).json({ message: "Origin API key is not configured" });
        return;
      }

      const username = asString(envTrim("PROLANCE_USERNAME"));
      const password = asString(envTrim("PROLANCE_PASSWORD"));
      if (!username || !password) {
        if (snapshotPayload) {
          send(res, 200, snapshotPayload);
          return;
        }
        res.status(500).json({ message: "Prolance API credentials are not configured" });
        return;
      }

      let livePayload: Record<string, unknown> | null = null;

      try {
        const tokenResp = await proxiedFetch({
          method: "POST",
          path: "/token",
          asForm: true,
          body: { grant_type: "password", username, password },
        });
        if (tokenResp.status >= 200 && tokenResp.status < 300 && tokenResp.data && typeof tokenResp.data === "object") {
          const tokenObj = tokenResp.data as Record<string, unknown>;
          const token = asString(tokenObj.access_token) || asString(tokenObj.accessToken) || asString(tokenObj.token);
          const loginID = asString(envTrim("PROLANCE_PARTNER_LOGIN_ID"));
          const partnerPassword = asString(envTrim("PROLANCE_PARTNER_PASSWORD"));

          if (token && loginID && partnerPassword) {
            const partnerResp = await proxiedFetch({
              method: "POST",
              path: "/Origin/Partners/LoginAPI",
              token,
              includeOriginApiHeaders: true,
              apiKey,
              body: { LoginID: loginID, Password: partnerPassword, LoginFrom: 1 },
            });
            if (
              partnerResp.status >= 200 &&
              partnerResp.status < 300 &&
              partnerResp.data &&
              typeof partnerResp.data === "object"
            ) {
              const partnerRoot = partnerResp.data as Record<string, unknown>;
              const partnerData =
                Array.isArray(partnerRoot.data) && partnerRoot.data[0] && typeof partnerRoot.data[0] === "object"
                  ? (partnerRoot.data[0] as Record<string, unknown>)
                  : {};
              const originSessionId =
                asString(partnerData.sessionID) ||
                asString(partnerData.sessionId) ||
                asString(partnerData.originSessionID) ||
                asString(partnerData.originSessionId);

              if (originSessionId) {
                let fullDetails = await proxiedFetch({
                  method: "GET",
                  path: `/Origin/Quotes/FullDetails/${pathSegment(quoteId)}`,
                  token,
                  originSessionId,
                  includeOriginApiHeaders: true,
                  apiKey,
                });
                if (fullDetails.status === 401) {
                  fullDetails = await proxiedFetch({
                    method: "GET",
                    path: `/Origin/Quotes/FullDetails/${pathSegment(quoteId)}`,
                    token: null,
                    originSessionId,
                    includeOriginApiHeaders: true,
                    apiKey,
                  });
                }

                if (
                  fullDetails.status >= 200 &&
                  fullDetails.status < 300 &&
                  fullDetails.data &&
                  typeof fullDetails.data === "object"
                ) {
                  const fullRoot = fullDetails.data as Record<string, unknown>;
                  const fullData =
                    fullRoot.data && typeof fullRoot.data === "object"
                      ? (fullRoot.data as Record<string, unknown>)
                      : fullRoot;
                  const projectIdRaw = fullData.projectID ?? fullData.projectId;
                  const projectId =
                    typeof projectIdRaw === "number" && Number.isFinite(projectIdRaw)
                      ? String(projectIdRaw)
                      : asString(projectIdRaw);

                  if (projectId) {
                    let quotesResp = await proxiedFetch({
                      method: "GET",
                      path: `/Origin/Quotes/${pathSegment(projectId)}`,
                      token,
                      originSessionId,
                      includeOriginApiHeaders: true,
                      apiKey,
                    });
                    if (quotesResp.status === 401) {
                      quotesResp = await proxiedFetch({
                        method: "GET",
                        path: `/Origin/Quotes/${pathSegment(projectId)}`,
                        token: null,
                        originSessionId,
                        includeOriginApiHeaders: true,
                        apiKey,
                      });
                    }
                    if (
                      quotesResp.status >= 200 &&
                      quotesResp.status < 300 &&
                      quotesResp.data &&
                      typeof quotesResp.data === "object"
                    ) {
                      const quotesRoot = quotesResp.data as Record<string, unknown>;
                      const quoteList = Array.isArray(quotesRoot.data) ? quotesRoot.data : [];
                      const matchedQuote = quoteList.find((q) => {
                        if (!q || typeof q !== "object") return false;
                        const qo = q as Record<string, unknown>;
                        const qid = qo.quoteID ?? qo.quoteId ?? qo.quotationId ?? qo.quotationID;
                        return String(qid ?? "") === String(quoteId);
                      });
                      if (matchedQuote && typeof matchedQuote === "object") {
                        livePayload = mergeFullDetailsWithSummaryQuote(
                          fullRoot,
                          fullData,
                          matchedQuote as Record<string, unknown>,
                        );
                      } else {
                        livePayload = fullRoot;
                      }
                    } else {
                      livePayload = fullRoot;
                    }
                  } else {
                    livePayload = fullRoot;
                  }
                }
              }
            }
          }
        }
      } catch (liveErr) {
        console.error("live prolance quote fetch error", liveErr);
      }

      if (livePayload) {
        const response =
          snapshotPayload != null ? applyHubDiscountOverlay(livePayload, snapshotPayload) : livePayload;
        res.setHeader("X-Quote-Data-Source", "prolance-live");
        send(res, 200, response);

        // Refresh stored snapshot so older links stay aligned with Prolance BOQ prices.
        if (Number.isFinite(snapshotQid) && snapshotQid > 0) {
          try {
            const [leadRows] = await pool.query(
              "SELECT lead_id AS leadId FROM lead_prolance_quote_snapshots WHERE quote_id = ? LIMIT 1",
              [snapshotQid],
            );
            const leadId = (leadRows as { leadId?: unknown }[])[0]?.leadId;
            if (leadId != null && Number.isFinite(Number(leadId))) {
              await pool.query(
                `INSERT INTO lead_prolance_quote_snapshots (lead_id, quote_id, payload_json, created_at)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), created_at = VALUES(created_at)`,
                [Number(leadId), snapshotQid, JSON.stringify(response), new Date()],
              );
            }
          } catch (snapWriteErr) {
            console.error("quote snapshot refresh error", snapWriteErr);
          }
        }
        return;
      }

      if (snapshotPayload) {
        res.setHeader("X-Quote-Data-Source", "snapshot-fallback");
        send(res, 200, snapshotPayload);
        return;
      }

      res.status(404).json({ message: "Quote not found" });
    } catch (err) {
      console.error("prolance public quote view fetch error", err);
      res.status(500).json({ message: asErrorMessage(err) });
    }
  };

  app.get(`${TEST_PREFIX}/quotes/share/:quoteId`, handlePublicQuoteView);
  app.get(`${TEST_PREFIX}/public/quotes/view/:quoteId`, handlePublicQuoteView);

  // Collection: GET {{base_url}}/Origin/Quotes/{{project_id}}
  app.get(`${TEST_PREFIX}/quotes/:projectId`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const token = readToken(req);
      const originSessionId = readOriginSessionId(req);
      const apiKey = readApiKey(req);
      if (!token) return res.status(400).json({ message: "token is required" });
      if (!originSessionId) return res.status(400).json({ message: "OriginSessionID is required" });
      if (!apiKey) return res.status(400).json({ message: "Origin API key is required" });

      let upstream = await proxiedFetch({
        method: "GET",
        path: `/Origin/Quotes/${pathSegment(req.params.projectId)}`,
        token,
        originSessionId,
        includeOriginApiHeaders: true,
        apiKey,
      });
      if (upstream.status === 401) {
        upstream = await proxiedFetch({
          method: "GET",
          path: `/Origin/Quotes/${pathSegment(req.params.projectId)}`,
          token: null,
          originSessionId,
          includeOriginApiHeaders: true,
          apiKey,
        });
      }
      if (upstream && upstream.status >= 200 && upstream.status < 300 && upstream.data) {
        upstream = { status: upstream.status, data: preferLatestProlanceQuotesEnvelope(upstream.data) };
      }
      if (!upstream || upstream.status < 200 || upstream.status >= 300) {
        if (upstream?.status === 401) {
          const debug = {
            upstreamUrl: `${baseUrl()}/Origin/Quotes/${pathSegment(req.params.projectId)}`,
            projectId: String(req.params.projectId || ""),
            sentHeaders: {
              Authorization: token ? `Bearer ${maskValue(token, 8, 6)}` : "(missing)",
              OriginSessionID: maskValue(originSessionId, 10, 8),
              OriginAPIKey: maskValue(apiKey, 8, 6),
              NoEncryption: envTrim("PROLANCE_NO_ENCRYPTION") || "1",
            },
            retries: ["with_bearer", "without_bearer"],
          };
          if (upstream.data && typeof upstream.data === "object") {
            return res.status(401).json({ ...(upstream.data as Record<string, unknown>), debug });
          }
          return res.status(401).json({ message: "Authorization has been denied for this request.", upstream: upstream.data, debug });
        }
        return send(res, upstream.status, upstream.data);
      }

      // If this response has only quote metadata, auto-hydrate with FullDetails.
      if (!hasDetailedQuoteData(upstream.data)) {
        const quoteId = extractQuoteIdFromResponse(upstream.data);
        if (quoteId) {
          let fullDetails = await proxiedFetch({
            method: "GET",
            path: `/Origin/Quotes/FullDetails/${pathSegment(quoteId)}`,
            token,
            originSessionId,
            includeOriginApiHeaders: true,
            apiKey,
          });
          if (fullDetails.status === 401) {
            fullDetails = await proxiedFetch({
              method: "GET",
              path: `/Origin/Quotes/FullDetails/${pathSegment(quoteId)}`,
              token: null,
              originSessionId,
              includeOriginApiHeaders: true,
              apiKey,
            });
          }
          if (fullDetails.status >= 200 && fullDetails.status < 300) {
            return send(res, fullDetails.status, fullDetails.data);
          }
          if (fullDetails.status === 401) {
            const debug = {
              upstreamUrl: `${baseUrl()}/Origin/Quotes/FullDetails/${pathSegment(quoteId)}`,
              quoteId: String(quoteId),
              sentHeaders: {
                Authorization: token ? `Bearer ${maskValue(token, 8, 6)}` : "(missing)",
                OriginSessionID: maskValue(originSessionId, 10, 8),
                OriginAPIKey: maskValue(apiKey, 8, 6),
                NoEncryption: envTrim("PROLANCE_NO_ENCRYPTION") || "1",
              },
              retries: ["with_bearer", "without_bearer"],
            };
            if (fullDetails.data && typeof fullDetails.data === "object") {
              return res.status(401).json({ ...(fullDetails.data as Record<string, unknown>), debug });
            }
            return res.status(401).json({ message: "Authorization has been denied for this request.", upstream: fullDetails.data, debug });
          }
        }
      }

      return send(res, upstream.status, upstream.data);
    } catch (err) {
      console.error("prolance quotes fetch error", err);
      return res.status(500).json({ message: asErrorMessage(err) });
    }
  });

  // Collection: GET {{base_url}}/Origin/Quotes/FullDetails/{{quote_id}}
  app.get(`${TEST_PREFIX}/quotes/full-details/:quoteId`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const token = readToken(req);
      const originSessionId = readOriginSessionId(req);
      const apiKey = readApiKey(req);
      if (!token) return res.status(400).json({ message: "token is required" });
      if (!originSessionId) return res.status(400).json({ message: "OriginSessionID is required" });
      if (!apiKey) return res.status(400).json({ message: "Origin API key is required" });

      let upstream = await proxiedFetch({
        method: "GET",
        path: `/Origin/Quotes/FullDetails/${pathSegment(req.params.quoteId)}`,
        token,
        originSessionId,
        includeOriginApiHeaders: true,
        apiKey,
      });
      if (upstream.status === 401) {
        upstream = await proxiedFetch({
          method: "GET",
          path: `/Origin/Quotes/FullDetails/${pathSegment(req.params.quoteId)}`,
          token: null,
          originSessionId,
          includeOriginApiHeaders: true,
          apiKey,
        });
      }
      if (upstream.status === 401) {
        const debug = {
          upstreamUrl: `${baseUrl()}/Origin/Quotes/FullDetails/${pathSegment(req.params.quoteId)}`,
          quoteId: String(req.params.quoteId || ""),
          sentHeaders: {
            Authorization: token ? `Bearer ${maskValue(token, 8, 6)}` : "(missing)",
            OriginSessionID: maskValue(originSessionId, 10, 8),
            OriginAPIKey: maskValue(apiKey, 8, 6),
            NoEncryption: envTrim("PROLANCE_NO_ENCRYPTION") || "1",
          },
          retries: ["with_bearer", "without_bearer"],
        };
        if (upstream.data && typeof upstream.data === "object") {
          return res.status(401).json({ ...(upstream.data as Record<string, unknown>), debug });
        }
        return res.status(401).json({ message: "Authorization has been denied for this request.", upstream: upstream.data, debug });
      }
      return send(res, upstream.status, upstream.data);
    } catch (err) {
      console.error("prolance quote full-details fetch error", err);
      return res.status(500).json({ message: asErrorMessage(err) });
    }
  });

  // Sales closure / design module: latest quotation + milestone collection amounts.
  app.get("/api/sales-closure/lead/:leadId/quote-payment-summary", async (req: Request, res: Response) => {
    const leadId = Number(req.params.leadId);
    if (!Number.isFinite(leadId) || leadId < 1) {
      return res.status(400).json({ message: "Invalid leadId" });
    }

    try {
      const [leadRows] = await pool.query(`SELECT payload FROM leads WHERE id = ? LIMIT 1`, [leadId]);
      const lead = (leadRows as { payload?: unknown }[])[0];
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      const breakdown = await resolveLeadMilestonePaymentBreakdown(pool, leadId);
      if (!breakdown) {
        return res.status(404).json({
          message: "No Prolance project or quotation found for this lead yet",
        });
      }

      const remainingFor10Percent = breakdown.amountToCollect10;

      return res.json({
        ok: true,
        leadId,
        quoteId: breakdown.quoteId,
        quoteNum: breakdown.quoteNum,
        totalPayableAmount: breakdown.totalPayableAmount,
        tenPercentAmount: breakdown.tenPercentAmount,
        twentyPercentTarget: breakdown.twentyPercentTarget,
        sixtyPercentTarget: breakdown.sixtyPercentTarget,
        fortyPercentAmount: breakdown.fortyPercentAmount,
        totalPaidCumulative: breakdown.totalPaidCumulative,
        totalPaidToward10Percent: breakdown.totalPaidToward10Percent,
        totalPaidToward40Percent: breakdown.totalPaidToward40Percent,
        previousTenPercentTarget: breakdown.previousTenPercentTarget,
        previousTwentyPercentTarget: breakdown.previousTwentyPercentTarget,
        previousSixtyPercentTarget: breakdown.previousSixtyPercentTarget,
        previousFortyPercentTarget: breakdown.previousFortyPercentTarget,
        quotationTotalAtLastPayment: breakdown.quotationTotalAtLastPayment,
        amountToCollect10: breakdown.amountToCollect10,
        amountToCollect40: breakdown.amountToCollect40,
        quoteRevisionTopUp10: breakdown.quoteRevisionTopUp10,
        quoteRevisionTopUp40: breakdown.quoteRevisionTopUp40,
        remainingAfterTwentyPercent: breakdown.remainingAfterTwentyPercent,
        remainingAfterSixtyPercent: breakdown.remainingAfterSixtyPercent,
        remainingFor10Percent,
      });
    } catch (err) {
      console.error("sales-closure quote-payment-summary error", err);
      return res.status(500).json({ message: asErrorMessage(err) });
    }
  });
}
