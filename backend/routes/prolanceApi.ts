import type { Express, Request, Response } from "express";
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

function maskValue(value: string | null | undefined, visibleStart = 6, visibleEnd = 4): string {
  const raw = String(value || "");
  if (!raw) return "(missing)";
  if (raw.length <= visibleStart + visibleEnd) return "*".repeat(raw.length);
  return `${raw.slice(0, visibleStart)}...${raw.slice(-visibleEnd)}`;
}

export function registerProlanceRoutes(
  app: Express,
  getUserFromSession: (req: Request) => Promise<SessionUser | null>,
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

      const upstream = await proxiedFetch({
        method: "GET",
        path: `/Origin/Quotes/${pathSegment(req.params.projectId)}`,
        token,
        originSessionId,
        includeOriginApiHeaders: true,
        apiKey,
      });
      return send(res, upstream.status, upstream.data);
    } catch (err) {
      console.error("prolance quotes fetch error", err);
      return res.status(500).json({ message: asErrorMessage(err) });
    }
  });
}
