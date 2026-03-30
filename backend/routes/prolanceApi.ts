/**
 * Authenticated proxy to Prolance / Origin HTTP APIs.
 *
 * Set PROLANCE_BASE_URL to the API root (e.g. https://host/Origin — no trailing slash).
 * Optional: PROLANCE_ORIGIN_SESSION_ID (default OriginSessionID on upstream requests).
 * Optional: PROLANCE_CLIENT_ID / PROLANCE_CLIENT_SECRET for POST /api/prolance/token.
 *
 * Forward Prolance bearer + session from the client:
 *   X-Prolance-Token, X-Prolance-Origin-Session
 */
import type { Express, Request, Response } from "express";

type SessionUser = { id: number; role: string };

function getProlanceBaseUrl(): string {
  return (process.env.PROLANCE_BASE_URL || "").replace(/\/$/, "");
}

function prolanceUrl(path: string, query?: Record<string, string>): string {
  const base = getProlanceBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  let url = `${base}${p}`;
  if (query && Object.keys(query).length) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") sp.set(k, v);
    }
    const q = sp.toString();
    if (q) url += `?${q}`;
  }
  return url;
}

async function prolanceRequest(params: {
  method: "GET" | "POST" | "PUT";
  path: string;
  query?: Record<string, string>;
  token?: string | null;
  originSessionId?: string | null;
  body?: unknown;
  asFormUrlEncoded?: boolean;
}): Promise<{ status: number; data: unknown }> {
  if (!getProlanceBaseUrl()) throw new Error("PROLANCE_BASE_URL is not configured");
  const url = params.query ? prolanceUrl(params.path, params.query) : prolanceUrl(params.path);

  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (params.token) headers.Authorization = `Bearer ${params.token}`;
  if (params.originSessionId) headers.OriginSessionID = params.originSessionId;
  if (params.body != null) {
    if (params.asFormUrlEncoded) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(params.body as Record<string, string>).toString();
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(params.body);
    }
  }

  const resp = await fetch(url, { method: params.method, headers, body });
  const text = await resp.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // keep raw text
  }
  return { status: resp.status, data };
}

function readProlanceForwardHeaders(req: Request): { token: string | null; originSessionId: string | null } {
  const token =
    (typeof req.headers["x-prolance-token"] === "string" && req.headers["x-prolance-token"].trim()) || null;
  const originSessionId =
    (typeof req.headers["x-prolance-origin-session"] === "string" && req.headers["x-prolance-origin-session"].trim()) ||
    process.env.PROLANCE_ORIGIN_SESSION_ID?.trim() ||
    null;
  return { token, originSessionId };
}

function canUseProlance(role: string | null | undefined): boolean {
  const r = (role || "").toLowerCase();
  return (
    r === "admin" ||
    r === "territorial_design_manager" ||
    r === "design_manager" ||
    r === "designer" ||
    r === "dqc_manager" ||
    r === "dqe"
  );
}

function sendUpstream(res: Response, status: number, data: unknown): void {
  if (typeof data === "string") {
    res.status(status).type("text/plain").send(data);
  } else {
    res.status(status).json(data);
  }
}

/** Express `req.params` values may be `string | string[]` depending on typings. */
function pathSegment(param: string | string[] | undefined): string {
  const raw = Array.isArray(param) ? param[0] : param;
  return encodeURIComponent(String(raw ?? ""));
}

export function registerProlanceRoutes(
  app: Express,
  getUserFromSession: (req: Request) => Promise<SessionUser | null>,
): void {
  const requireProlanceUser = async (req: Request, res: Response): Promise<SessionUser | null> => {
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

  app.get("/api/prolance/status", async (req: Request, res: Response) => {
    const user = await requireProlanceUser(req, res);
    if (!user) return;
    const configured = Boolean(getProlanceBaseUrl());
    res.json({
      configured,
      hasClientCredentials: Boolean(process.env.PROLANCE_CLIENT_ID && process.env.PROLANCE_CLIENT_SECRET),
    });
  });

  app.post("/api/prolance/token", async (req: Request, res: Response) => {
    const user = await requireProlanceUser(req, res);
    if (!user) return;
    try {
      const clientId = (req.body?.clientId as string) || process.env.PROLANCE_CLIENT_ID || "";
      const clientSecret = (req.body?.clientSecret as string) || process.env.PROLANCE_CLIENT_SECRET || "";
      if (!clientId || !clientSecret) {
        return res.status(400).json({
          message:
            "Set PROLANCE_CLIENT_ID and PROLANCE_CLIENT_SECRET on the server, or pass clientId and clientSecret in the body.",
        });
      }
      const { status, data } = await prolanceRequest({
        method: "POST",
        path: "/token",
        body: {
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        },
        asFormUrlEncoded: true,
      });
      sendUpstream(res, status, data);
    } catch (err) {
      console.error("prolance token error", err);
      const msg = err instanceof Error ? err.message : "Prolance token request failed";
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/prolance/partners/login", async (req: Request, res: Response) => {
    const user = await requireProlanceUser(req, res);
    if (!user) return;
    const { token, originSessionId } = readProlanceForwardHeaders(req);
    if (!token) {
      return res.status(400).json({
        message: "Missing X-Prolance-Token. Call POST /api/prolance/token first and send the access token in this header.",
      });
    }
    const loginID = req.body?.loginID ?? req.body?.LoginID;
    const password = req.body?.password ?? req.body?.Password;
    if (!loginID || !password) {
      return res.status(400).json({ message: "loginID and password are required (JSON body)." });
    }
    try {
      const { status, data } = await prolanceRequest({
        method: "POST",
        path: "/Partners/Login",
        token,
        originSessionId,
        body: { LoginID: loginID, Password: password },
      });
      sendUpstream(res, status, data);
    } catch (err) {
      console.error("prolance partners login error", err);
      const msg = err instanceof Error ? err.message : "Prolance login failed";
      res.status(500).json({ message: msg });
    }
  });

  const requireProlanceToken = (req: Request, res: Response) => {
    const { token, originSessionId } = readProlanceForwardHeaders(req);
    if (!token) {
      res.status(400).json({
        message: "Missing X-Prolance-Token (Prolance OAuth or partner access token).",
      });
      return null;
    }
    return { token, originSessionId };
  };

  app.get("/api/prolance/projects/:partnerId", async (req: Request, res: Response) => {
    const u = await requireProlanceUser(req, res);
    if (!u) return;
    const auth = requireProlanceToken(req, res);
    if (!auth) return;
    const partnerId = pathSegment(req.params.partnerId);
    try {
      const { status, data } = await prolanceRequest({
        method: "GET",
        path: `/Projects/${partnerId}`,
        token: auth.token,
        originSessionId: auth.originSessionId,
      });
      sendUpstream(res, status, data);
    } catch (err) {
      console.error("prolance projects list error", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Prolance request failed" });
    }
  });

  app.post("/api/prolance/projects", async (req: Request, res: Response) => {
    const u = await requireProlanceUser(req, res);
    if (!u) return;
    const auth = requireProlanceToken(req, res);
    if (!auth) return;
    try {
      const { status, data } = await prolanceRequest({
        method: "POST",
        path: "/Projects",
        token: auth.token,
        originSessionId: auth.originSessionId,
        body: req.body,
      });
      sendUpstream(res, status, data);
    } catch (err) {
      console.error("prolance create project error", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Prolance request failed" });
    }
  });

  app.get("/api/prolance/rooms/quotes/:projectId", async (req: Request, res: Response) => {
    const u = await requireProlanceUser(req, res);
    if (!u) return;
    const auth = requireProlanceToken(req, res);
    if (!auth) return;
    const projectId = pathSegment(req.params.projectId);
    try {
      const { status, data } = await prolanceRequest({
        method: "GET",
        path: `/ROOMS/QUOTES/${projectId}`,
        token: auth.token,
        originSessionId: auth.originSessionId,
      });
      sendUpstream(res, status, data);
    } catch (err) {
      console.error("prolance rooms quotes error", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Prolance request failed" });
    }
  });

  const optionSubPath = async (
    req: Request,
    res: Response,
    suffix: string,
    logLabel: string,
  ): Promise<void> => {
    const u = await requireProlanceUser(req, res);
    if (!u) return;
    const auth = requireProlanceToken(req, res);
    if (!auth) return;
    const optionId = pathSegment(req.params.optionId);
    try {
      const { status, data } = await prolanceRequest({
        method: "GET",
        path: `/ROOMS/OPTIONS/${optionId}/${suffix}`,
        token: auth.token,
        originSessionId: auth.originSessionId,
      });
      sendUpstream(res, status, data);
    } catch (err) {
      console.error(`prolance ${logLabel} error`, err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Prolance request failed" });
    }
  };

  app.get("/api/prolance/rooms/options/:optionId/hardware", async (req, res) => {
    await optionSubPath(req, res, "HARDWARE", "hardware");
  });
  app.get("/api/prolance/rooms/options/:optionId/services", async (req, res) => {
    await optionSubPath(req, res, "SERVICES", "services");
  });
  app.get("/api/prolance/rooms/options/:optionId/skirtings", async (req, res) => {
    await optionSubPath(req, res, "SKIRTINGS", "skirtings");
  });
  app.get("/api/prolance/rooms/options/:optionId/worktops", async (req, res) => {
    await optionSubPath(req, res, "WORKTOPS", "worktops");
  });
  app.get("/api/prolance/rooms/options/:optionId/appliances", async (req, res) => {
    await optionSubPath(req, res, "APPLIANCES", "appliances");
  });

  app.get("/api/prolance/rooms/options/modules-boq/:optionId", async (req: Request, res: Response) => {
    const u = await requireProlanceUser(req, res);
    if (!u) return;
    const auth = requireProlanceToken(req, res);
    if (!auth) return;
    const optionId = pathSegment(req.params.optionId);
    try {
      const { status, data } = await prolanceRequest({
        method: "GET",
        path: `/ROOMS/OPTIONS/MODULESBOQ/${optionId}`,
        token: auth.token,
        originSessionId: auth.originSessionId,
      });
      sendUpstream(res, status, data);
    } catch (err) {
      console.error("prolance modules boq error", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Prolance request failed" });
    }
  });
}
