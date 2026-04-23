import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import type { Pool } from "mysql2/promise";

type SessionUser = { id: number; role: string; email?: string | null; name?: string | null };

function isGoogleCalendarConfigured(): boolean {
  const clientId =
    (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || "").trim();
  const clientSecret =
    (process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "").trim();
  const redirectUri =
    (process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALENDAR_REDIRECT_URI || "").trim();
  return Boolean(
    clientId &&
      clientSecret &&
      redirectUri,
  );
}

function canAccessCalendar(role: string | null | undefined): boolean {
  const r = (role || "").toLowerCase();
  return (
    r === "admin" ||
    r === "territorial_design_manager" ||
    r === "design_manager" ||
    r === "mmt_manager" ||
    r === "designer" ||
    r === "mmt_executive"
  );
}

function getGoogleClientId(): string {
  return (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || "").trim();
}

function getGoogleClientSecret(): string {
  return (process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "").trim();
}

function getGoogleRedirectUri(): string {
  return (process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALENDAR_REDIRECT_URI || "").trim();
}

function getGoogleScope(): string {
  return (process.env.GOOGLE_CALENDAR_SCOPE || "https://www.googleapis.com/auth/calendar.readonly").trim();
}

function getFrontendBase(): string {
  return (process.env.FRONTEND_BASE_URL || "https://design.hubinterior.com").replace(/\/$/, "");
}

function getStateSecret(): string {
  return (
    process.env.GOOGLE_CALENDAR_STATE_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET ||
    "hub-calendar-state"
  ).trim();
}

function signStatePayload(payload: string): string {
  return crypto.createHmac("sha256", getStateSecret()).update(payload).digest("hex");
}

function encodeState(userId: number): string {
  const ts = Date.now();
  const payload = `${userId}.${ts}`;
  const sig = signStatePayload(payload);
  return Buffer.from(`${payload}.${sig}`, "utf8").toString("base64url");
}

function decodeState(rawState: string | null): { ok: boolean; userId?: number; reason?: string } {
  if (!rawState) return { ok: false, reason: "missing state" };
  try {
    const decoded = Buffer.from(rawState, "base64url").toString("utf8");
    const [uidStr, tsStr, sig] = decoded.split(".");
    if (!uidStr || !tsStr || !sig) return { ok: false, reason: "invalid state format" };
    const payload = `${uidStr}.${tsStr}`;
    const expected = signStatePayload(payload);
    if (expected !== sig) return { ok: false, reason: "invalid state signature" };
    const ts = Number(tsStr);
    if (!Number.isFinite(ts) || Date.now() - ts > 15 * 60 * 1000) {
      return { ok: false, reason: "state expired" };
    }
    const userId = Number(uidStr);
    if (!Number.isFinite(userId) || userId <= 0) return { ok: false, reason: "invalid user id" };
    return { ok: true, userId };
  } catch {
    return { ok: false, reason: "invalid state encoding" };
  }
}

function buildGoogleOAuthUrl(userId: number): string {
  const clientId =
    getGoogleClientId();
  const redirectUri =
    getGoogleRedirectUri();
  const scopeValue =
    getGoogleScope();
  const scope = encodeURIComponent(scopeValue);
  const base = "https://accounts.google.com/o/oauth2/v2/auth";
  const state = encodeURIComponent(encodeState(userId));
  return `${base}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&access_type=offline&prompt=consent&scope=${scope}&state=${state}`;
}

function buildFrontendRedirect(status: "success" | "error", message: string): string {
  const base = `${getFrontendBase()}/google-calendar`;
  const params = new URLSearchParams();
  params.set("gc_status", status);
  params.set("gc_message", message);
  return `${base}?${params.toString()}`;
}

async function ensureGoogleCalendarTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS google_calendar_connections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      google_email VARCHAR(255) NULL,
      access_token TEXT NULL,
      refresh_token TEXT NULL,
      token_type VARCHAR(50) NULL,
      scope TEXT NULL,
      expiry_date BIGINT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_google_calendar_user (user_id)
    )
  `);

  // Backward-compatible migration for environments that already had an older table shape.
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME AS columnName
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'google_calendar_connections'`,
  );
  const existing = new Set((cols as any[]).map((c) => String(c.columnName || "").toLowerCase()));
  const required: Array<{ name: string; ddl: string }> = [
    { name: "google_email", ddl: "ADD COLUMN google_email VARCHAR(255) NULL" },
    { name: "access_token", ddl: "ADD COLUMN access_token TEXT NULL" },
    { name: "refresh_token", ddl: "ADD COLUMN refresh_token TEXT NULL" },
    { name: "token_type", ddl: "ADD COLUMN token_type VARCHAR(50) NULL" },
    { name: "scope", ddl: "ADD COLUMN scope TEXT NULL" },
    { name: "expiry_date", ddl: "ADD COLUMN expiry_date BIGINT NULL" },
    {
      name: "created_at",
      ddl: "ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
    {
      name: "updated_at",
      ddl: "ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    },
  ];
  for (const col of required) {
    if (!existing.has(col.name)) {
      await pool.query(`ALTER TABLE google_calendar_connections ${col.ddl}`);
    }
  }
}

async function exchangeCodeForTokens(code: string): Promise<{
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}> {
  const tokenEndpoint = "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams({
    code,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    redirect_uri: getGoogleRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json().catch(() => ({}))) as any;
}

async function fetchGoogleProfile(accessToken: string): Promise<{ email?: string }> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (await res.json().catch(() => ({}))) as any;
}

async function fetchGoogleCalendarEvents(accessToken: string, params: URLSearchParams): Promise<any[]> {
  const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&${params.toString()}`;
  const res = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data?.error?.message || data?.message || "Failed to fetch Google events");
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((ev: any) => ({
    id: String(ev.id || ""),
    summary: String(ev.summary || "Untitled event"),
    description: ev.description || null,
    htmlLink: ev.htmlLink || null,
    status: ev.status || null,
    location: ev.location || null,
    start: ev.start?.dateTime || ev.start?.date || null,
    end: ev.end?.dateTime || ev.end?.date || null,
  }));
}

export function registerGoogleCalendarRoutes(
  app: Express,
  getUserFromSession: (req: Request) => Promise<SessionUser | null>,
  pool: Pool,
): void {
  const PREFIX = "/api/google-calendar";

  const requireUser = async (req: Request, res: Response): Promise<SessionUser | null> => {
    const user = await getUserFromSession(req);
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return null;
    }
    if (!canAccessCalendar(user.role)) {
      res.status(403).json({ message: "You do not have access to HUB Calendar" });
      return null;
    }
    return user;
  };

  // Calendar status for sidebar connect card.
  app.get(`${PREFIX}/status`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    await ensureGoogleCalendarTable(pool);
    const [rows] = await pool.query(
      "SELECT google_email as googleEmail FROM google_calendar_connections WHERE user_id = ? LIMIT 1",
      [user.id],
    );
    const row = (rows as any[])[0] || null;
    return res.json({
      configured: isGoogleCalendarConfigured(),
      connected: Boolean(row?.googleEmail),
      googleEmail: row?.googleEmail || null,
      ownerName: user.name || null,
      ownerEmail: user.email || null,
    });
  });

  // Admin/TDM "all events" and individual "my events" currently return empty arrays until OAuth tokens are wired.
  app.get(`${PREFIX}/all-events`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const role = (user.role || "").toLowerCase();
    const canSeeAll = role === "admin" || role === "territorial_design_manager";
    if (!canSeeAll) {
      return res.status(403).json({ message: "Only admin and TDM can access all events" });
    }
    await ensureGoogleCalendarTable(pool);
    const [rows] = await pool.query(
      "SELECT user_id as userId, google_email as googleEmail, access_token as accessToken FROM google_calendar_connections WHERE access_token IS NOT NULL AND TRIM(access_token) <> ''",
    );
    const params = new URLSearchParams();
    if (req.query.timeMin) params.set("timeMin", String(req.query.timeMin));
    if (req.query.timeMax) params.set("timeMax", String(req.query.timeMax));
    const all: any[] = [];
    for (const r of rows as any[]) {
      try {
        const events = await fetchGoogleCalendarEvents(String(r.accessToken), params);
        all.push(
          ...events.map((ev) => ({
            ...ev,
            ownerName: `User ${r.userId}`,
            ownerEmail: r.googleEmail || null,
            connectedGoogleEmail: r.googleEmail || null,
          })),
        );
      } catch {
        // skip broken connections and continue
      }
    }
    return res.json({ events: all });
  });

  app.get(`${PREFIX}/my-events`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    await ensureGoogleCalendarTable(pool);
    const [rows] = await pool.query(
      "SELECT google_email as googleEmail, access_token as accessToken FROM google_calendar_connections WHERE user_id = ? LIMIT 1",
      [user.id],
    );
    const row = (rows as any[])[0];
    if (!row?.accessToken) return res.json({ events: [] });
    const params = new URLSearchParams();
    if (req.query.timeMin) params.set("timeMin", String(req.query.timeMin));
    if (req.query.timeMax) params.set("timeMax", String(req.query.timeMax));
    const events = await fetchGoogleCalendarEvents(String(row.accessToken), params);
    return res.json({
      events: events.map((ev) => ({
        ...ev,
        ownerName: user.name || null,
        ownerEmail: user.email || null,
        connectedGoogleEmail: row.googleEmail || null,
      })),
    });
  });

  app.get(`${PREFIX}/connect-url`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    if (!isGoogleCalendarConfigured()) {
      return res.status(400).json({
        message: "Google Calendar credentials are missing in backend environment",
      });
    }
    return res.json({ authUrl: buildGoogleOAuthUrl(user.id) });
  });

  app.post(`${PREFIX}/disconnect`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    await ensureGoogleCalendarTable(pool);
    await pool.query("DELETE FROM google_calendar_connections WHERE user_id = ?", [user.id]);
    return res.json({ success: true, message: "HUB Calendar disconnected" });
  });

  // OAuth callback endpoint: exchange code, store tokens, redirect to frontend calendar page.
  app.get(`${PREFIX}/oauth/callback`, async (req: Request, res: Response) => {
    try {
      const code = String(req.query.code || "").trim();
      const stateRaw = String(req.query.state || "").trim();
      if (!code) {
        return res.redirect(buildFrontendRedirect("error", "Google OAuth failed: missing code"));
      }
      const state = decodeState(stateRaw || null);
      if (!state.ok || !state.userId) {
        return res.redirect(buildFrontendRedirect("error", `Google OAuth failed: ${state.reason || "invalid state"}`));
      }

      const tokenData = await exchangeCodeForTokens(code);
      if (!tokenData?.access_token) {
        const reason = tokenData?.error_description || tokenData?.error || "token exchange failed";
        return res.redirect(buildFrontendRedirect("error", `Google OAuth failed: ${reason}`));
      }
      const profile = await fetchGoogleProfile(tokenData.access_token);
      const expiryDate =
        tokenData.expires_in && Number.isFinite(Number(tokenData.expires_in))
          ? Date.now() + Number(tokenData.expires_in) * 1000
          : null;

      await ensureGoogleCalendarTable(pool);
      await pool.query(
        `INSERT INTO google_calendar_connections
          (user_id, google_email, access_token, refresh_token, token_type, scope, expiry_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           google_email = VALUES(google_email),
           access_token = VALUES(access_token),
           refresh_token = COALESCE(NULLIF(VALUES(refresh_token), ''), refresh_token),
           token_type = VALUES(token_type),
           scope = VALUES(scope),
           expiry_date = VALUES(expiry_date),
           updated_at = NOW()`,
        [
          state.userId,
          profile.email || null,
          tokenData.access_token || null,
          tokenData.refresh_token || null,
          tokenData.token_type || null,
          tokenData.scope || getGoogleScope(),
          expiryDate,
        ],
      );

      return res.redirect(buildFrontendRedirect("success", "Google Calendar connected successfully"));
    } catch (err: any) {
      const msg = err?.message || "OAuth callback processing failed";
      return res.redirect(buildFrontendRedirect("error", msg));
    }
  });
}

