import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import {
  fetchDesignInbox,
  fetchDesignInboxCounts,
  fetchDesignInboxItem,
  issueDesignInboxWsTicket,
  markDesignInboxAllRead,
  markDesignInboxRead,
  notifyPublicWsUrl,
} from "../lib/designNotifyClient";

type SessionUser = {
  id: number;
  name?: string;
  role?: string;
} | null;

type RouteDeps = {
  pool: Pool;
  getUserFromSession: (req: Request) => Promise<SessionUser>;
};

function toItem(row: Record<string, unknown>) {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: Number(row.id),
    project_id: String(row.project_id || ""),
    lead_id: row.lead_id != null ? Number(row.lead_id) : null,
    lead_name: String(row.lead_name || ""),
    designer_id: row.designer_id != null ? Number(row.designer_id) : null,
    notification_type: String(row.notification_type || ""),
    notification_action: String(row.notification_action || ""),
    payload,
    created_at: String(row.created_at || ""),
    read_at: row.read_at != null && row.read_at !== "" ? String(row.read_at) : null,
    go_response: null,
    response: payload,
    request: null,
  };
}

export function registerDesignNotificationRoutes(app: Express, deps: RouteDeps): void {
  const { getUserFromSession } = deps;

  app.get("/api/design/notifications", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const result = await fetchDesignInbox({
        userId: user.id,
        since: String(req.query.since || "").trim() || undefined,
        limit: Math.min(Math.max(Number(req.query.limit) || 50, 1), 200),
        projectId: String(req.query.project_id || "").trim() || undefined,
      });
      if (!result.ok) {
        console.error("design inbox list error", result.error);
        return res.status(502).json({ message: "Failed to load notifications" });
      }
      return res.json({ data: result.data.map(toItem) });
    } catch (err) {
      console.error("design notifications list error", err);
      return res.status(500).json({ message: "Failed to load notifications" });
    }
  });

  app.get("/api/design/notifications/counts", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const result = await fetchDesignInboxCounts({
        userId: user.id,
        since: String(req.query.since || "").trim() || undefined,
      });
      if (!result.ok) {
        console.error("design inbox counts error", result.error);
        return res.status(502).json({ message: "Failed to load notification counts" });
      }
      return res.json({ data: result.data });
    } catch (err) {
      console.error("design notifications counts error", err);
      return res.status(500).json({ message: "Failed to load notification counts" });
    }
  });

  app.get("/api/design/notifications/ws-ticket", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const result = await issueDesignInboxWsTicket(user.id);
      if (!result.ok) {
        console.error("design inbox ws-ticket error", result.error);
        return res.status(502).json({ message: "Failed to open live notifications" });
      }
      return res.json({
        data: {
          ticket: result.ticket,
          ws_url: `${notifyPublicWsUrl()}/v1/design/inbox/ws?ticket=${encodeURIComponent(result.ticket)}`,
        },
      });
    } catch (err) {
      console.error("design notifications ws-ticket error", err);
      return res.status(500).json({ message: "Failed to open live notifications" });
    }
  });

  app.post("/api/design/notifications/read-all", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const result = await markDesignInboxAllRead({ userId: user.id });
      if (!result.ok) {
        console.error("design inbox read-all error", result.error);
        return res.status(502).json({ message: "Failed to mark notifications read" });
      }
      return res.json({ ok: true, updated: result.updated });
    } catch (err) {
      console.error("design notifications read-all error", err);
      return res.status(500).json({ message: "Failed to mark notifications read" });
    }
  });

  app.post("/api/design/notifications/:notificationId/read", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const notificationId = Number(req.params.notificationId);
      if (!notificationId) return res.status(400).json({ message: "Invalid notification id" });
      const result = await markDesignInboxRead({ userId: user.id, id: notificationId });
      if (!result.ok) {
        if (/not found/i.test(result.error)) {
          return res.status(404).json({ message: "Notification not found" });
        }
        console.error("design inbox mark-read error", result.error);
        return res.status(502).json({ message: "Failed to mark notification read" });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error("design notification mark-read error", err);
      return res.status(500).json({ message: "Failed to mark notification read" });
    }
  });

  app.get("/api/design/notifications/:notificationId", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const notificationId = Number(req.params.notificationId);
      if (!notificationId) return res.status(400).json({ message: "Invalid notification id" });

      const result = await fetchDesignInboxItem({ userId: user.id, id: notificationId });
      if (!result.ok) {
        if (/not found/i.test(result.error)) {
          return res.status(404).json({ message: "Notification not found" });
        }
        console.error("design inbox detail error", result.error);
        return res.status(502).json({ message: "Failed to load notification" });
      }
      if (!result.data) return res.status(404).json({ message: "Notification not found" });
      return res.json({ data: toItem(result.data) });
    } catch (err) {
      console.error("design notification detail error", err);
      return res.status(500).json({ message: "Failed to load notification" });
    }
  });
}
