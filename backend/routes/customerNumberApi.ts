/**
 * Standalone API: customer identifier in the URL path.
 *
 * Example (Postman): GET https://api.hubinterior.com/api/customer/{{customer_Number}}
 * Example (curl):    curl "https://api.hubinterior.com/api/customer/9876543210"
 *
 * Looks up leads where contact_no or pid matches the path segment (trimmed / URL-decoded).
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";

export function registerCustomerNumberRoutes(app: Express, pool: Pool): void {
  app.get("/api/customer/:customerNumber", async (req: Request, res: Response) => {
    const raw = req.params.customerNumber;
    const segment = Array.isArray(raw) ? raw[0] : raw;
    const customerNumber = decodeURIComponent((segment ?? "").trim());
    if (!customerNumber) {
      return res.status(400).json({
        message: "customerNumber is required in the URL path, e.g. /api/customer/9876543210",
      });
    }

    try {
      const [rows] = await pool.query(
        `SELECT id, pid, project_name AS projectName, contact_no AS contactNo, client_email AS clientEmail,
                project_stage AS projectStage, create_at AS createAt, update_at AS updateAt
         FROM leads
         WHERE contact_no = ? OR pid = ?
         ORDER BY update_at DESC
         LIMIT 50`,
        [customerNumber, customerNumber]
      );
      const leads = rows as Record<string, unknown>[];

      return res.json({
        ok: true,
        customerNumber,
        matchCount: leads.length,
        leads,
      });
    } catch (err) {
      console.error("GET /api/customer/:customerNumber error", err);
      return res.status(500).json({ message: "Lookup failed" });
    }
  });
}
