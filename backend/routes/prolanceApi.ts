import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";

type SessionUser = { id: number; role: string };

type LeadRow = {
  id: number;
  projectName: string | null;
  payload: string | null;
};

type TenantConfig = {
  apiBaseUrl?: string;
  apiKey?: string;
  staticToken?: string;
  username?: string;
  password?: string;
  partnerLoginId?: string;
  partnerPassword?: string;
  projectUrlTemplate?: string;
  appBaseUrl?: string;
  noEncryption?: string;
};

function envTrim(name: string): string {
  return (process.env[name] || "").trim();
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTenantConfigMap(): Record<string, TenantConfig> {
  const raw = envTrim("PROLANCE_TENANT_CONFIG_JSON");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, TenantConfig>;
    if (!parsed || typeof parsed !== "object") return {};
    const result: Record<string, TenantConfig> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v === "object") result[slugify(k)] = v;
    }
    return result;
  } catch {
    return {};
  }
}

function resolveTenantConfig(customerSlug: string | null): TenantConfig {
  const map = getTenantConfigMap();
  const key = slugify(customerSlug || "");
  const defaultKey = slugify(envTrim("PROLANCE_DEFAULT_CUSTOMER_SLUG"));
  const mapKeys = Object.keys(map);
  const inferredSingleKey = mapKeys.length === 1 ? mapKeys[0] : "";
  const selectedKey = key && map[key] ? key : defaultKey && map[defaultKey] ? defaultKey : inferredSingleKey;
  const fromMap = selectedKey ? map[selectedKey] || {} : {};
  const apiBaseUrl =
    fromMap.apiBaseUrl ||
    envTrim("PROLANCE_API_BASE_URL") ||
    envTrim("PROLANCE_BASE_URL") ||
    (selectedKey ? `https://prolance-api.${selectedKey}.com` : "");
  return {
    apiBaseUrl,
    apiKey: fromMap.apiKey || envTrim("PROLANCE_API_KEY") || envTrim("PROLANCE_ORIGIN_API_KEY"),
    staticToken: fromMap.staticToken || envTrim("PROLANCE_STATIC_TOKEN"),
    username: fromMap.username || envTrim("PROLANCE_USERNAME"),
    password: fromMap.password || envTrim("PROLANCE_PASSWORD"),
    partnerLoginId: fromMap.partnerLoginId || envTrim("PROLANCE_PARTNER_LOGIN_ID"),
    partnerPassword: fromMap.partnerPassword || envTrim("PROLANCE_PARTNER_PASSWORD"),
    projectUrlTemplate: fromMap.projectUrlTemplate || envTrim("PROLANCE_PROJECT_URL_TEMPLATE"),
    appBaseUrl: fromMap.appBaseUrl || envTrim("PROLANCE_APP_BASE_URL"),
    noEncryption: fromMap.noEncryption || envTrim("PROLANCE_NO_ENCRYPTION") || "1",
  };
}

function getApiBaseUrl(cfg: TenantConfig): string {
  return stripTrailingSlash(cfg.apiBaseUrl || "");
}

function getTokenBaseUrl(cfg: TenantConfig): string {
  const base = getApiBaseUrl(cfg);
  return stripTrailingSlash(base.replace(/\/Origin\/?$/i, ""));
}

function getOriginBaseUrl(cfg: TenantConfig): string {
  const base = getApiBaseUrl(cfg);
  if (/\/Origin$/i.test(base)) return base;
  return `${base}/Origin`;
}

function prolanceUrl(base: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function prolanceRequest(params: {
  method: "GET" | "POST" | "PUT";
  baseUrl: string;
  path: string;
  token?: string | null;
  originSessionId?: string | null;
  includeOriginHeaders?: boolean;
  apiKey?: string | null;
  noEncryption?: string | null;
  body?: unknown;
  asFormUrlEncoded?: boolean;
}): Promise<{ status: number; data: unknown }> {
  if (!params.baseUrl) throw new Error("Prolance base URL is not configured");
  const url = prolanceUrl(params.baseUrl, params.path);

  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (params.token) headers.Authorization = `Bearer ${params.token}`;
  if (params.originSessionId) headers.OriginSessionID = params.originSessionId;
  if (params.includeOriginHeaders) {
    const apiKey = (params.apiKey || "").trim();
    if (!apiKey) throw new Error("PROLANCE_API_KEY is not configured");
    headers.OriginAPIKey = apiKey;
    headers.NoEncryption = (params.noEncryption || "").trim() || "1";
  }

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

function readProlanceForwardHeaders(req: Request, cfg: TenantConfig): { token: string | null; originSessionId: string | null } {
  const token =
    (typeof req.headers["x-prolance-token"] === "string" && req.headers["x-prolance-token"].trim()) ||
    (cfg.staticToken || "").trim() ||
    null;
  const originSessionId =
    (typeof req.headers["x-prolance-origin-session"] === "string" && req.headers["x-prolance-origin-session"].trim()) ||
    envTrim("PROLANCE_ORIGIN_SESSION_ID") ||
    null;
  return { token, originSessionId };
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

function sendUpstream(res: Response, status: number, data: unknown): void {
  if (typeof data === "string") {
    res.status(status).type("text/plain").send(data);
  } else {
    res.status(status).json(data);
  }
}

function pathSegment(param: string | string[] | undefined): string {
  const raw = Array.isArray(param) ? param[0] : param;
  return encodeURIComponent(String(raw ?? ""));
}

function parseLeadPayload(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function getLead(pool: Pool, leadId: number): Promise<LeadRow | null> {
  const [rows] = await pool.query(
    "SELECT id, project_name as projectName, payload FROM leads WHERE id = ? LIMIT 1",
    [leadId],
  );
  const row = (rows as LeadRow[])[0];
  return row || null;
}

async function saveLeadPayload(pool: Pool, leadId: number, payload: Record<string, unknown>): Promise<void> {
  await pool.query("UPDATE leads SET payload = ?, update_at = ? WHERE id = ?", [JSON.stringify(payload), new Date(), leadId]);
}

function extractArrayData(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const arr = (data as { data?: unknown }).data;
    if (Array.isArray(arr)) return arr;
  }
  return [];
}

function extractPartnerAndSession(data: unknown): { partnerId: number | null; sessionId: string | null } {
  const arr = extractArrayData(data);
  const first = (arr[0] ?? {}) as Record<string, unknown>;
  const partnerRaw = first.partnerID ?? first.partnerId ?? first.PartnerID;
  const partnerId = Number(partnerRaw);
  const sessionRaw = first.sessionID ?? first.sessionId ?? first.SessionID;
  return {
    partnerId: Number.isFinite(partnerId) ? partnerId : null,
    sessionId: typeof sessionRaw === "string" && sessionRaw.trim() ? sessionRaw.trim() : null,
  };
}

function buildProjectOpenUrl(cfg: TenantConfig, projectId: number | null, partnerId: number | null): string {
  const template = cfg.projectUrlTemplate || "";
  if (template) {
    return template
      .replace(/\{projectId\}/g, String(projectId ?? ""))
      .replace(/\{partnerId\}/g, String(partnerId ?? ""));
  }
  const fallback = cfg.appBaseUrl || "https://prolance.design";
  const base = stripTrailingSlash(fallback);
  if (projectId != null && partnerId != null) return `${base}/projects/${projectId}`;
  if (projectId != null) return `${base}/projects/${projectId}`;
  return base;
}

function readProlanceNode(payload: Record<string, unknown>): Record<string, unknown> {
  const p = payload.prolance;
  return p && typeof p === "object" ? ({ ...(p as Record<string, unknown>) }) : {};
}

async function ensureAccessTokenForTenant(req: Request, cfg: TenantConfig): Promise<string> {
  const direct = readProlanceForwardHeaders(req, cfg).token;
  if (direct) return direct;

  const username = (cfg.username || "").trim();
  const password = (cfg.password || "").trim();
  if (!username || !password) {
    throw new Error("Missing token and PROLANCE_USERNAME/PROLANCE_PASSWORD are not configured");
  }

  const tokenResp = await prolanceRequest({
    method: "POST",
    baseUrl: getTokenBaseUrl(cfg),
    path: "/token",
    body: {
      grant_type: "password",
      username,
      password,
    },
    asFormUrlEncoded: true,
  });

  if (tokenResp.status < 200 || tokenResp.status >= 300) {
    throw new Error(`Token request failed with status ${tokenResp.status}`);
  }
  if (!tokenResp.data || typeof tokenResp.data !== "object") {
    throw new Error("Token response format invalid");
  }
  const token = (tokenResp.data as Record<string, unknown>).access_token;
  if (typeof token !== "string" || !token.trim()) throw new Error("Token missing in response");
  return token.trim();
}

function inferCustomerSlug(payload: Record<string, unknown>, lead?: LeadRow | null): string | null {
  const prolance = readProlanceNode(payload);
  const fromProlance = typeof prolance.customerSlug === "string" ? prolance.customerSlug : "";
  if (fromProlance.trim()) return slugify(fromProlance);

  const direct = payload.customerSlug;
  if (typeof direct === "string" && direct.trim()) return slugify(direct);

  const form = (payload.formData || payload.form || payload) as Record<string, unknown>;
  const customer = form.customer_name || form.customerName || form.client_name || form.clientName;
  if (typeof customer === "string" && customer.trim()) return slugify(customer);
  const exp = form.experience_center || form.experienceCenter;
  if (typeof exp === "string" && exp.trim()) return slugify(exp);
  if (lead?.projectName && lead.projectName.trim()) return slugify(lead.projectName);
  return null;
}

function buildProjectCreatePayload(lead: LeadRow, leadPayload: Record<string, unknown>): Record<string, unknown> {
  const form = (leadPayload.formData || leadPayload.form || leadPayload) as Record<string, unknown>;
  const customerName =
    String(form.customer_name || form.customerName || form.client_name || form.clientName || lead.projectName || `CRM Lead ${lead.id}`);
  const city = String(form.city || form.customer_city || form.site_city || "Bengaluru");
  const state = String(form.state || form.customer_state || form.site_state || "Karnataka");
  return {
    pName: lead.projectName || `CRM Lead ${lead.id}`,
    customer: customerName,
    city,
    state,
  };
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isAccessDeniedResponse(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const message = (data as Record<string, unknown>).message;
  return normalizeText(message) === "access denied";
}

function findProjectIdFromList(
  listResp: unknown,
  expectedProjectName: string,
  expectedCustomer: string,
): number | null {
  const rows = extractArrayData(listResp);
  if (!rows.length) return null;
  const pName = normalizeText(expectedProjectName);
  const customer = normalizeText(expectedCustomer);

  let fallbackByName: number | null = null;
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const rowProjectId = Number(row.projectID ?? row.projectId ?? row.id);
    if (!Number.isFinite(rowProjectId)) continue;
    const rowPName = normalizeText(row.pName ?? row.projectName);
    const rowCustomer = normalizeText(row.customer ?? row.clientName);

    if (rowPName && rowPName === pName && rowCustomer && rowCustomer === customer) return rowProjectId;
    if (rowPName && rowPName === pName && fallbackByName == null) fallbackByName = rowProjectId;
  }
  return fallbackByName;
}

export function registerProlanceRoutes(
  app: Express,
  pool: Pool,
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
    const customerSlug =
      (typeof req.query.customerSlug === "string" && slugify(req.query.customerSlug)) ||
      (typeof req.headers["x-prolance-customer"] === "string" && slugify(req.headers["x-prolance-customer"])) ||
      null;
    const cfg = resolveTenantConfig(customerSlug);
    res.json({
      customerSlug,
      configured: Boolean(getApiBaseUrl(cfg)),
      hasApiKey: Boolean(cfg.apiKey),
      hasStaticToken: Boolean(cfg.staticToken),
      hasTokenCredentials: Boolean(cfg.username && cfg.password),
      hasPartnerCredentials: Boolean(cfg.partnerLoginId && cfg.partnerPassword),
    });
  });

  app.post("/api/prolance/token", async (req: Request, res: Response) => {
    const user = await requireProlanceUser(req, res);
    if (!user) return;
    try {
      const customerSlug =
        (typeof req.body?.customerSlug === "string" && slugify(req.body.customerSlug)) ||
        (typeof req.headers["x-prolance-customer"] === "string" && slugify(req.headers["x-prolance-customer"])) ||
        null;
      const cfg = resolveTenantConfig(customerSlug);
      const username = (req.body?.username as string) || (cfg.username || "");
      const password = (req.body?.password as string) || (cfg.password || "");
      if (!username || !password) {
        return res.status(400).json({ message: "username and password are required to generate a token" });
      }
      const { status, data } = await prolanceRequest({
        method: "POST",
        baseUrl: getTokenBaseUrl(cfg),
        path: "/token",
        body: { grant_type: "password", username, password },
        asFormUrlEncoded: true,
      });
      sendUpstream(res, status, data);
    } catch (err) {
      console.error("prolance token error", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Prolance token request failed" });
    }
  });

  app.post("/api/prolance/open/:leadId", async (req: Request, res: Response) => {
    const user = await requireProlanceUser(req, res);
    if (!user) return;

    const leadId = Number(req.params.leadId);
    if (!leadId) return res.status(400).json({ message: "Invalid lead id" });

    try {
      const lead = await getLead(pool, leadId);
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      const payload = parseLeadPayload(lead.payload);
      const prolance = readProlanceNode(payload);
      const requestedSlug =
        (typeof req.body?.customerSlug === "string" && slugify(req.body.customerSlug)) ||
        (typeof req.headers["x-prolance-customer"] === "string" && slugify(req.headers["x-prolance-customer"])) ||
        null;
      const customerSlug = requestedSlug || inferCustomerSlug(payload, lead);
      const cfg = resolveTenantConfig(customerSlug);
      const token = await ensureAccessTokenForTenant(req, cfg);

      let partnerId = Number(prolance.partnerId ?? NaN);
      let originSessionId = typeof prolance.sessionId === "string" ? prolance.sessionId : null;

      if (!Number.isFinite(partnerId) || !originSessionId) {
        const loginID = (req.body?.loginID as string) || (cfg.partnerLoginId || "");
        const password = (req.body?.password as string) || (cfg.partnerPassword || "");
        if (!loginID || !password) {
          return res.status(400).json({
            message:
              "Partner credentials missing. Provide loginID/password in request body or set PROLANCE_PARTNER_LOGIN_ID and PROLANCE_PARTNER_PASSWORD.",
          });
        }

        const loginResp = await prolanceRequest({
          method: "POST",
          baseUrl: getOriginBaseUrl(cfg),
          path: "/Partners/Login",
          token,
          includeOriginHeaders: true,
          apiKey: cfg.apiKey || null,
          noEncryption: cfg.noEncryption || "1",
          body: { LoginID: loginID, Password: password, LoginFrom: 1 },
        });

        if (loginResp.status < 200 || loginResp.status >= 300) {
          return sendUpstream(res, loginResp.status, loginResp.data);
        }

        const extracted = extractPartnerAndSession(loginResp.data);
        partnerId = extracted.partnerId ?? partnerId;
        originSessionId = extracted.sessionId ?? originSessionId;
      }

      if (!Number.isFinite(partnerId) || !originSessionId) {
        return res.status(400).json({ message: "Could not resolve partnerId/sessionId from Prolance login" });
      }

      let projectId = Number(prolance.projectId ?? NaN);
      if (!Number.isFinite(projectId)) {
        const createPayload =
          (req.body?.projectPayload && typeof req.body.projectPayload === "object" ? req.body.projectPayload : null) ||
          buildProjectCreatePayload(lead, payload);
        const createBody = {
          partnerID: partnerId,
          ...(createPayload as Record<string, unknown>),
        };

        const createResp = await prolanceRequest({
          method: "PUT",
          baseUrl: getOriginBaseUrl(cfg),
          path: "/PROJECTS/CREATE",
          token,
          originSessionId,
          includeOriginHeaders: true,
          apiKey: cfg.apiKey || null,
          noEncryption: cfg.noEncryption || "1",
          body: createBody,
        });

        if (createResp.status >= 200 && createResp.status < 300) {
          const createDataArr = extractArrayData(createResp.data);
          const first = (createDataArr[0] ?? createResp.data ?? {}) as Record<string, unknown>;
          const candidate = Number(first.projectID ?? first.projectId ?? first.id ?? first.ProjectID);
          if (!Number.isFinite(candidate)) {
            return res.status(500).json({ message: "Project created but project id not returned by Prolance" });
          }
          projectId = candidate;
        } else if (isAccessDeniedResponse(createResp.data)) {
          // Fallback: if create is not allowed for this API key, try finding existing project.
          const listResp = await prolanceRequest({
            method: "GET",
            baseUrl: getOriginBaseUrl(cfg),
            path: `/PROJECTS/${encodeURIComponent(String(partnerId))}`,
            token,
            originSessionId,
            includeOriginHeaders: true,
            apiKey: cfg.apiKey || null,
            noEncryption: cfg.noEncryption || "1",
          });
          if (listResp.status < 200 || listResp.status >= 300) {
            return sendUpstream(res, listResp.status, listResp.data);
          }
          const matched = findProjectIdFromList(
            listResp.data,
            String((createBody as Record<string, unknown>).pName || lead.projectName || ""),
            String((createBody as Record<string, unknown>).customer || ""),
          );
          if (!Number.isFinite(matched || NaN)) {
            return res.status(403).json({
              message:
                "Access denied for project create, and no matching existing project found in partner project list.",
            });
          }
          projectId = Number(matched);
        } else {
          return sendUpstream(res, createResp.status, createResp.data);
        }
      }

      const openUrl = buildProjectOpenUrl(cfg, projectId, partnerId);

      const nextProlance = {
        ...prolance,
        customerSlug,
        partnerId,
        projectId,
        sessionId: originSessionId,
        openUrl,
        tokenRefreshedAt: new Date().toISOString(),
      };
      const nextPayload = { ...payload, prolance: nextProlance };
      await saveLeadPayload(pool, leadId, nextPayload);

      return res.json({
        status: true,
        leadId,
        partnerId,
        projectId,
        sessionId: originSessionId,
        openUrl,
      });
    } catch (err) {
      console.error("prolance open error", err);
      return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to open Prolance project" });
    }
  });

  app.post("/api/prolance/sync-quote/:leadId", async (req: Request, res: Response) => {
    const user = await requireProlanceUser(req, res);
    if (!user) return;

    const leadId = Number(req.params.leadId);
    if (!leadId) return res.status(400).json({ message: "Invalid lead id" });

    try {
      const lead = await getLead(pool, leadId);
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      const payload = parseLeadPayload(lead.payload);
      const prolance = readProlanceNode(payload);
      const customerSlug =
        (typeof req.body?.customerSlug === "string" && slugify(req.body.customerSlug)) ||
        inferCustomerSlug(payload, lead);
      const cfg = resolveTenantConfig(customerSlug);
      const token = await ensureAccessTokenForTenant(req, cfg);
      const originSessionId =
        (typeof req.body?.sessionId === "string" && req.body.sessionId.trim()) ||
        (typeof prolance.sessionId === "string" ? prolance.sessionId : null) ||
        readProlanceForwardHeaders(req, cfg).originSessionId;
      const projectId = Number(prolance.projectId ?? req.body?.projectId ?? NaN);
      if (!Number.isFinite(projectId)) {
        return res.status(400).json({ message: "No Prolance project id linked to this lead" });
      }

      const quoteResp = await prolanceRequest({
        method: "GET",
        baseUrl: getOriginBaseUrl(cfg),
        path: `/ROOMS/QUOTES/${encodeURIComponent(String(projectId))}`,
        token,
        originSessionId,
        includeOriginHeaders: true,
        apiKey: cfg.apiKey || null,
        noEncryption: cfg.noEncryption || "1",
      });
      if (quoteResp.status < 200 || quoteResp.status >= 300) {
        return sendUpstream(res, quoteResp.status, quoteResp.data);
      }

      let boqData: unknown = null;
      const optionIdFromBody = Number(req.body?.optionId ?? NaN);
      const optionIdFromPayload = Number((prolance as any).optionId ?? NaN);
      const optionId = Number.isFinite(optionIdFromBody) ? optionIdFromBody : optionIdFromPayload;
      if (Number.isFinite(optionId)) {
        const boqResp = await prolanceRequest({
          method: "GET",
          baseUrl: getOriginBaseUrl(cfg),
          path: `/ROOMS/OPTIONS/MODULESBOQ/${encodeURIComponent(String(optionId))}`,
          token,
          originSessionId,
          includeOriginHeaders: true,
          apiKey: cfg.apiKey || null,
          noEncryption: cfg.noEncryption || "1",
        });
        if (boqResp.status >= 200 && boqResp.status < 300) boqData = boqResp.data;
      }

      const quoteSnapshot = {
        syncedAt: new Date().toISOString(),
        projectId,
        optionId: Number.isFinite(optionId) ? optionId : null,
        quotes: quoteResp.data,
        boq: boqData,
      };

      const nextPayload = {
        ...payload,
        prolance: {
          ...prolance,
          projectId,
          sessionId: originSessionId,
          quoteSnapshot,
        },
      };
      await saveLeadPayload(pool, leadId, nextPayload);

      return res.json({ status: true, leadId, quoteSnapshot });
    } catch (err) {
      console.error("prolance sync quote error", err);
      return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to sync Prolance quote" });
    }
  });

  // Manual proxy: update existing project in Prolance (PUT /Origin/PROJECTS/UPDATE)
  app.put("/api/prolance/projects/update", async (req: Request, res: Response) => {
    const user = await requireProlanceUser(req, res);
    if (!user) return;

    try {
      const customerSlug =
        (typeof req.body?.customerSlug === "string" && slugify(req.body.customerSlug)) ||
        (typeof req.headers["x-prolance-customer"] === "string" && slugify(req.headers["x-prolance-customer"])) ||
        null;
      const cfg = resolveTenantConfig(customerSlug);
      const token = await ensureAccessTokenForTenant(req, cfg);
      const originSessionId =
        (typeof req.body?.sessionId === "string" && req.body.sessionId.trim()) ||
        readProlanceForwardHeaders(req, cfg).originSessionId;

      const body = req.body?.project && typeof req.body.project === "object" ? req.body.project : req.body;
      const projectId = Number((body as Record<string, unknown>)?.projectID ?? (body as Record<string, unknown>)?.projectId);
      if (!Number.isFinite(projectId)) {
        return res.status(400).json({ message: "projectID is required in payload for PROJECTS/UPDATE" });
      }

      const upstream = await prolanceRequest({
        method: "PUT",
        baseUrl: getOriginBaseUrl(cfg),
        path: "/PROJECTS/UPDATE",
        token,
        originSessionId,
        includeOriginHeaders: true,
        apiKey: cfg.apiKey || null,
        noEncryption: cfg.noEncryption || "1",
        body,
      });
      return sendUpstream(res, upstream.status, upstream.data);
    } catch (err) {
      console.error("prolance projects update error", err);
      return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to update Prolance project" });
    }
  });

  app.get("/api/prolance/quote/:leadId", async (req: Request, res: Response) => {
    const user = await requireProlanceUser(req, res);
    if (!user) return;

    const leadId = Number(req.params.leadId);
    if (!leadId) return res.status(400).json({ message: "Invalid lead id" });

    try {
      const lead = await getLead(pool, leadId);
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      const payload = parseLeadPayload(lead.payload);
      const prolance = readProlanceNode(payload);
      return res.json({
        status: true,
        leadId,
        partnerId: prolance.partnerId ?? null,
        projectId: prolance.projectId ?? null,
        sessionId: prolance.sessionId ?? null,
        openUrl: prolance.openUrl ?? null,
        quoteSnapshot: prolance.quoteSnapshot ?? null,
      });
    } catch (err) {
      console.error("prolance quote read error", err);
      return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to read Prolance quote" });
    }
  });
}
