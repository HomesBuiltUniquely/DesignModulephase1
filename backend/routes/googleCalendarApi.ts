import type { Express, Request, Response } from "express";

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

function buildGoogleOAuthUrl(): string {
  const clientId =
    (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || "").trim();
  const redirectUri =
    (process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALENDAR_REDIRECT_URI || "").trim();
  const scopeValue =
    (process.env.GOOGLE_CALENDAR_SCOPE || "https://www.googleapis.com/auth/calendar.readonly").trim();
  const scope = encodeURIComponent(scopeValue);
  const base = "https://accounts.google.com/o/oauth2/v2/auth";
  const state = encodeURIComponent("hub-calendar");
  return `${base}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&access_type=offline&prompt=consent&scope=${scope}&state=${state}`;
}

export function registerGoogleCalendarRoutes(
  app: Express,
  getUserFromSession: (req: Request) => Promise<SessionUser | null>,
): void {
  const PREFIX = "/api/google-calendar/oauth/callback";

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
    return res.json({
      configured: isGoogleCalendarConfigured(),
      connected: false,
      googleEmail: null,
      ownerName: user.name || null,
      ownerEmail: user.email || null,
    });
  });

  // Admin/TDM "all events" and individual "my events" currently return empty arrays until OAuth tokens are wired.
  app.get(`${PREFIX}/all-events`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    return res.json({ events: [] });
  });

  app.get(`${PREFIX}/my-events`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    return res.json({ events: [] });
  });

  app.get(`${PREFIX}/connect-url`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    if (!isGoogleCalendarConfigured()) {
      return res.status(400).json({
        message: "Google Calendar credentials are missing in backend environment",
      });
    }
    return res.json({ authUrl: buildGoogleOAuthUrl() });
  });

  app.post(`${PREFIX}/disconnect`, async (req: Request, res: Response) => {
    const user = await requireUser(req, res);
    if (!user) return;
    return res.json({ success: true, message: "HUB Calendar disconnected" });
  });
}

