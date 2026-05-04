import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import http from "node:http";
import https from "node:https";

type SessionUser = { id: number; role: string };

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
    return res.json({
      baseUrl: baseUrl(),
      hasApiKey: Boolean(readApiKey(req)),
      hasToken: Boolean(readToken(req)),
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

      const loginID = asString(req.body?.loginID) || asString(req.body?.LoginID) || asString(envTrim("PROLANCE_PARTNER_LOGIN_ID"));
      const password = asString(req.body?.password) || asString(req.body?.Password) || asString(envTrim("PROLANCE_PARTNER_PASSWORD"));
      if (!loginID || !password) return res.status(400).json({ message: "LoginID/password are required" });

      const upstream = await proxiedFetch({
        method: "POST",
        path: "/Origin/Partners/LoginAPI",
        token,
        includeOriginApiHeaders: true,
        apiKey,
        body: { LoginID: loginID, Password: password, LoginFrom: 1 },
      });
      return send(res, upstream.status, upstream.data);
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

  // Collection: PUT {{base_url}}/Origin/V2/Projects/Create
  app.put(`${TEST_PREFIX}/projects/create`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const token = readToken(req);
      const originSessionId = readOriginSessionId(req);
      const apiKey = readApiKey(req);
      const upstreamPath = "/Origin/V2/Projects/Create";
      if (!token) return res.status(400).json({ message: "token is required" });
      if (!originSessionId) return res.status(400).json({ message: "OriginSessionID is required" });
      if (!apiKey) return res.status(400).json({ message: "Origin API key is required" });

      let upstream = await proxiedFetch({
        method: "PUT",
        path: upstreamPath,
        token,
        originSessionId,
        includeOriginApiHeaders: true,
        apiKey,
        body: req.body,
      });
      if (upstream.status === 401) {
        // Some Prolance tenants authorize create by OriginSessionID + OriginAPIKey only.
        // Retry once without bearer token while preserving other required headers.
        upstream = await proxiedFetch({
          method: "PUT",
          path: upstreamPath,
          token: null,
          originSessionId,
          includeOriginApiHeaders: true,
          apiKey,
          body: req.body,
        });
      }
      if (upstream.status === 401) {
        const debug = {
          upstreamUrl: `${baseUrl()}${upstreamPath}`,
          sentHeaders: {
            Authorization: token ? `Bearer ${maskValue(token, 8, 6)}` : "(missing)",
            OriginSessionID: maskValue(originSessionId, 10, 8),
            OriginAPIKey: maskValue(apiKey, 8, 6),
            NoEncryption: envTrim("PROLANCE_NO_ENCRYPTION") || "1",
            "Content-Type": "application/json",
          },
          requestBody: req.body,
        };
        if (upstream.data && typeof upstream.data === "object") {
          return res.status(401).json({ ...(upstream.data as Record<string, unknown>), debug });
        }
        return res.status(401).json({ message: "Unauthorized access", upstream: upstream.data, debug });
      }
      return send(res, upstream.status, upstream.data);
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
              send(res, 200, parsed);
              return;
            }
          }
        } catch (snapErr) {
          console.error("quote snapshot read error", snapErr);
        }
      }

      const apiKey = readApiKey(req);
      if (!apiKey) {
        res.status(500).json({ message: "Origin API key is not configured" });
        return;
      }

      const username = asString(envTrim("PROLANCE_USERNAME"));
      const password = asString(envTrim("PROLANCE_PASSWORD"));
      if (!username || !password) {
        res.status(500).json({ message: "Prolance API credentials are not configured" });
        return;
      }

      const tokenResp = await proxiedFetch({
        method: "POST",
        path: "/token",
        asForm: true,
        body: { grant_type: "password", username, password },
      });
      if (tokenResp.status < 200 || tokenResp.status >= 300 || !tokenResp.data || typeof tokenResp.data !== "object") {
        send(res, tokenResp.status, tokenResp.data);
        return;
      }
      const tokenObj = tokenResp.data as Record<string, unknown>;
      const token = asString(tokenObj.access_token) || asString(tokenObj.accessToken) || asString(tokenObj.token);
      if (!token) {
        res.status(500).json({ message: "Failed to generate Prolance token" });
        return;
      }

      const loginID = asString(envTrim("PROLANCE_PARTNER_LOGIN_ID"));
      const partnerPassword = asString(envTrim("PROLANCE_PARTNER_PASSWORD"));
      if (!loginID || !partnerPassword) {
        res.status(500).json({ message: "Partner login credentials are not configured" });
        return;
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
        send(res, partnerResp.status, partnerResp.data);
        return;
      }
      const partnerRoot = partnerResp.data as Record<string, unknown>;
      const partnerData = Array.isArray(partnerRoot.data) && partnerRoot.data[0] && typeof partnerRoot.data[0] === "object"
        ? (partnerRoot.data[0] as Record<string, unknown>)
        : {};
      const originSessionId =
        asString(partnerData.sessionID) ||
        asString(partnerData.sessionId) ||
        asString(partnerData.originSessionID) ||
        asString(partnerData.originSessionId);
      if (!originSessionId) {
        res.status(500).json({ message: "Failed to get OriginSessionID from Prolance partner login" });
        return;
      }

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
      if (fullDetails.status < 200 || fullDetails.status >= 300 || !fullDetails.data || typeof fullDetails.data !== "object") {
        send(res, fullDetails.status, fullDetails.data);
        return;
      }

      const fullRoot = fullDetails.data as Record<string, unknown>;
      const fullData = (fullRoot.data && typeof fullRoot.data === "object")
        ? (fullRoot.data as Record<string, unknown>)
        : fullRoot;
      const projectIdRaw = fullData.projectID ?? fullData.projectId;
      const projectId = typeof projectIdRaw === "number" && Number.isFinite(projectIdRaw)
        ? String(projectIdRaw)
        : asString(projectIdRaw);

      if (!projectId) {
        send(res, 200, fullDetails.data);
        return;
      }

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
      if (quotesResp.status < 200 || quotesResp.status >= 300 || !quotesResp.data || typeof quotesResp.data !== "object") {
        send(res, 200, fullDetails.data);
        return;
      }

      const quotesRoot = quotesResp.data as Record<string, unknown>;
      const quoteList = Array.isArray(quotesRoot.data) ? quotesRoot.data : [];
      const matchedQuote = quoteList.find((q) => {
        if (!q || typeof q !== "object") return false;
        const qo = q as Record<string, unknown>;
        const qid = qo.quoteID ?? qo.quoteId ?? qo.quotationId ?? qo.quotationID;
        return String(qid ?? "") === String(quoteId);
      });
      if (!matchedQuote || typeof matchedQuote !== "object") {
        send(res, 200, fullDetails.data);
        return;
      }

      const matched = matchedQuote as Record<string, unknown>;
      const summaryOptionsData = Array.isArray(matched.quoteOptionsData) ? matched.quoteOptionsData : [];

      const merged = {
        ...fullRoot,
        data: {
          ...fullData,
          totalPrice: matched.totalPrice ?? fullData.totalPrice,
          finalTotalPrice: matched.finalTotalPrice ?? fullData.finalTotalPrice,
          discount: matched.discount ?? fullData.discount,
          quoteNum: matched.quoteNum ?? fullData.quoteNum,
          quoteOptionsData: summaryOptionsData.length > 0 ? summaryOptionsData : (fullData.quoteOptionsData ?? fullData.optionDetails),
        },
      };
      send(res, 200, merged);
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
}
