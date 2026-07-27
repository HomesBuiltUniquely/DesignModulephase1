import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import {
  resolveLeadMilestonePaymentBreakdown,
  resolveLeadQuotePaymentSummary,
} from "./prolanceApi";

type SessionUser = { id: number; name?: string; role?: string; email?: string };

const INCENTIVE_CYCLE_DAYS = 15;
const CYCLE_EPOCH_UTC = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

const MEETING_TASKS = [
  "First cut design + quotation discussion meeting request",
  "Material selection meeting + quotation discussion",
  "Design sign off",
] as const;

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function toIsoUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function cycleRange(cycleIndex: number): { startIso: string; endIso: string } {
  const idx = Math.max(0, Math.floor(cycleIndex));
  const cycleMs = INCENTIVE_CYCLE_DAYS * DAY_MS;
  const start = CYCLE_EPOCH_UTC + idx * cycleMs;
  const end = start + cycleMs - DAY_MS;
  return { startIso: toIsoUtcDay(start), endIso: toIsoUtcDay(end) };
}

function getCurrentCycleIndex(now = new Date()): number {
  const nowUtc = startOfUtcDay(now.getTime());
  const elapsed = Math.max(0, nowUtc - CYCLE_EPOCH_UTC);
  return Math.floor(elapsed / (INCENTIVE_CYCLE_DAYS * DAY_MS));
}

function parsePayload(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function asStr(v: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function toDateIso(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return toIsoUtcDay(v.getTime());
  if (typeof v === "string" && v.trim()) {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return toIsoUtcDay(t);
  }
  return null;
}

function inRange(iso: string | null | undefined, startIso: string, endIso: string): boolean {
  if (!iso) return false;
  return iso >= startIso && iso <= endIso;
}

function formDataOf(payload: Record<string, unknown>): Record<string, unknown> {
  const fd = payload.formData || payload.form_data || payload.form;
  return fd && typeof fd === "object" ? (fd as Record<string, unknown>) : {};
}

function customerNameFrom(payload: Record<string, unknown>, projectName: string | null): string {
  const form = formDataOf(payload);
  return (
    asStr(form.customer_name) ||
    asStr(form.sales_lead_name) ||
    asStr(payload.customer_name) ||
    asStr(projectName) ||
    "Customer"
  );
}

function pickQuote(
  payload: Record<string, unknown>,
  breakdownTotal: number | null,
  tenTarget: number | null,
): number {
  const form = formDataOf(payload);
  const fromPayload =
    asNum(payload.quotation_total) ||
    asNum(form.quotation_total) ||
    asNum(payload.total_quotation) ||
    asNum(form.total_quotation);
  if (breakdownTotal && breakdownTotal > 0) return breakdownTotal;
  if (fromPayload && fromPayload > 0) return fromPayload;
  if (tenTarget && tenTarget > 0) return Math.round(tenTarget * 10);
  return 0;
}

export function registerIncentivesRoutes(
  app: Express,
  deps: {
    pool: Pool;
    getUserFromSession: (req: Request) => Promise<SessionUser | null>;
  },
): void {
  const { pool, getUserFromSession } = deps;

  const canViewDesigner = async (
    viewer: SessionUser,
    designerId: number,
  ): Promise<boolean> => {
    const role = (viewer.role || "").toLowerCase();
    if (viewer.id === designerId) return true;
    if (role === "admin" || role === "deputy_general_manager" || role === "territorial_design_manager") {
      return true;
    }
    if (role === "design_manager") {
      const [rows] = await pool.query(
        `SELECT id FROM users
         WHERE id = ? AND (id = ? OR design_manager_id = ?)
         LIMIT 1`,
        [designerId, viewer.id, viewer.id],
      );
      return (rows as { id: number }[]).length > 0;
    }
    return false;
  };

  app.get("/api/incentives/designer/:designerId", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const designerId = Number(req.params.designerId);
      if (!Number.isFinite(designerId) || designerId <= 0) {
        return res.status(400).json({ message: "Invalid designer id" });
      }
      if (!(await canViewDesigner(user, designerId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const cycleIndexRaw = req.query.cycleIndex;
      const cycleIndex =
        cycleIndexRaw != null && String(cycleIndexRaw).trim() !== ""
          ? Number(cycleIndexRaw)
          : getCurrentCycleIndex();
      if (!Number.isFinite(cycleIndex) || cycleIndex < 0) {
        return res.status(400).json({ message: "Invalid cycleIndex" });
      }
      const { startIso, endIso } = cycleRange(cycleIndex);

      const [designerRows] = await pool.query(
        `SELECT id, name, role FROM users WHERE id = ? LIMIT 1`,
        [designerId],
      );
      const designer = (designerRows as { id: number; name: string; role: string }[])[0];
      if (!designer) return res.status(404).json({ message: "Designer not found" });

      const [leadRows] = await pool.query(
        `SELECT id, project_name AS projectName, payload, create_at AS createAt, update_at AS updateAt
         FROM leads
         WHERE assigned_designer_id = ?`,
        [designerId],
      );
      const leads = leadRows as {
        id: number;
        projectName: string | null;
        payload: unknown;
        createAt: Date | string | null;
        updateAt: Date | string | null;
      }[];

      if (leads.length === 0) {
        return res.json({
          designer: { id: designer.id, name: designer.name, role: designer.role },
          cycleIndex,
          startIso,
          endIso,
          meetingsCompleted: 0,
          deals: [],
        });
      }

      const leadIds = leads.map((l) => l.id);
      const placeholders = leadIds.map(() => "?").join(",");
      const [compRows] = await pool.query(
        `SELECT lead_id AS leadId, milestone_index AS milestoneIndex, task_name AS taskName,
                completed_at AS completedAt
         FROM lead_task_completions
         WHERE lead_id IN (${placeholders})`,
        leadIds,
      );
      const completions = compRows as {
        leadId: number;
        milestoneIndex: number;
        taskName: string;
        completedAt: Date | string;
      }[];

      const compsByLead = new Map<number, typeof completions>();
      for (const c of completions) {
        const list = compsByLead.get(c.leadId) || [];
        list.push(c);
        compsByLead.set(c.leadId, list);
      }

      const findComp = (leadId: number, taskName: string) =>
        (compsByLead.get(leadId) || []).find((c) => c.taskName === taskName);

      let meetingsCompleted = 0;
      for (const c of completions) {
        if (!MEETING_TASKS.includes(c.taskName as (typeof MEETING_TASKS)[number])) continue;
        const iso = toDateIso(c.completedAt);
        if (inRange(iso, startIso, endIso)) meetingsCompleted += 1;
      }

      const deals: Array<Record<string, unknown>> = [];

      for (const lead of leads) {
        const payload = parsePayload(lead.payload);
        const form = formDataOf(payload);

        const salesApproved = asBool(payload.sales_closure_finance_approved);
        const salesApprovedAt =
          toDateIso(payload.sales_closure_finance_approved_at) ||
          toDateIso(payload.sales_closure_submitted_at);

        const tenComp = findComp(lead.id, "10% payment approval");
        const tenApprovedAt = toDateIso(tenComp?.completedAt);
        const fortyComp = findComp(lead.id, "40% payment approval");
        const fortyApprovedAt =
          toDateIso(fortyComp?.completedAt) ||
          (asBool(payload.forty_percent_payment_met) ? toDateIso(lead.updateAt) : null);
        const dqc1Comp = findComp(lead.id, "DQC 1 approval");
        const hasDqc1 = Boolean(dqc1Comp);

        const tenPercentMet = asBool(payload.ten_percent_payment_met) || Boolean(tenComp);
        const designTenMet =
          asBool(payload.design_ten_percent_payment_met) ||
          (Boolean(tenComp) && hasDqc1) ||
          (Boolean(tenComp) && salesApproved);
        const fortyMet = asBool(payload.forty_percent_payment_met) || Boolean(fortyComp);

        // Later milestones imply earlier ones for weighted prerequisites.
        const part3Lifetime = fortyMet;
        const part2Lifetime = designTenMet || part3Lifetime;
        const part1Lifetime =
          salesApproved ||
          tenPercentMet ||
          Boolean(tenComp) ||
          part2Lifetime;

        const creditPart1InCycle =
          part1Lifetime &&
          (inRange(salesApprovedAt, startIso, endIso) ||
            (!salesApproved && inRange(tenApprovedAt, startIso, endIso)));
        const creditPart2InCycle = part2Lifetime && inRange(tenApprovedAt, startIso, endIso);
        const creditPart3InCycle =
          part3Lifetime && inRange(fortyApprovedAt, startIso, endIso);

        const p1Credit = creditPart1InCycle;
        const p2Credit = creditPart2InCycle;
        const p3Credit = creditPart3InCycle;

        if (!p1Credit && !p2Credit && !p3Credit) continue;

        let breakdownTotal: number | null = null;
        let paidCumulative = 0;
        try {
          const breakdown = await resolveLeadMilestonePaymentBreakdown(pool, lead.id);
          if (breakdown) {
            breakdownTotal = breakdown.totalPayableAmount;
            paidCumulative = breakdown.totalPaidCumulative || 0;
          } else {
            const summary = await resolveLeadQuotePaymentSummary(pool, lead.id);
            if (summary) breakdownTotal = summary.totalPayableAmount;
          }
        } catch {
          // non-fatal — fall back to payload
        }

        const tenTarget =
          asNum(payload.ten_percent_target) ||
          asNum(form.ten_percent_target) ||
          (breakdownTotal ? Math.round(breakdownTotal * 0.1) : null);

        const quoteCurrent = pickQuote(payload, breakdownTotal, tenTarget);
        // Freeze Part 1 quote from ten% target when available; else current.
        const quoteAtPart1 =
          (tenTarget && tenTarget > 0 ? Math.round(tenTarget * 10) : 0) ||
          asNum(payload.quotation_total_at_sales_closure) ||
          quoteCurrent;

        if (quoteCurrent <= 0 && quoteAtPart1 <= 0) continue;

        const q1 = quoteAtPart1 > 0 ? quoteAtPart1 : quoteCurrent;
        const qCur = quoteCurrent > 0 ? quoteCurrent : quoteAtPart1;
        const salesTenRequired = Math.round((q1 * 10) / 100);
        const twentyCurrent = Math.round((qCur * 20) / 100);
        const sixtyCurrent = Math.round((qCur * 60) / 100);

        const paid =
          paidCumulative ||
          asNum(payload.total_paid_cumulative) ||
          asNum(payload.total_paid_toward_10_percent) ||
          asNum(payload.amount_paid) ||
          0;

        const activityDate =
          (p3Credit && fortyApprovedAt) ||
          (p2Credit && tenApprovedAt) ||
          (p1Credit && (salesApprovedAt || tenApprovedAt)) ||
          toDateIso(lead.updateAt) ||
          startIso;

        deals.push({
          id: String(lead.id),
          customerName: customerNameFrom(payload, lead.projectName),
          quotationAtFinanceApproval: q1,
          quotationCurrent: qCur,
          salesTenPercentCollected: part1Lifetime
            ? Math.max(paid, salesTenRequired)
            : Math.min(paid, salesTenRequired),
          salesTenPercentFinanceApproved: part1Lifetime,
          cumulativeCollectedTowardDesign10: part2Lifetime
            ? Math.max(paid, twentyCurrent)
            : Math.min(paid, twentyCurrent),
          designTenPercentFinanceApproved: part2Lifetime,
          cumulativeCollectedTowardFortyPercent: part3Lifetime
            ? Math.max(paid, sixtyCurrent)
            : Math.min(paid, sixtyCurrent),
          fortyPercentFinanceApproved: part3Lifetime,
          creditPart1InCycle: p1Credit,
          creditPart2InCycle: p2Credit,
          creditPart3InCycle: p3Credit,
          activityDate,
          closureTime: "48 HOURS",
        });
      }

      return res.json({
        designer: { id: designer.id, name: designer.name, role: designer.role },
        cycleIndex,
        startIso,
        endIso,
        meetingsCompleted,
        deals,
      });
    } catch (err) {
      console.error("[GET /api/incentives/designer/:id] error", err);
      return res.status(500).json({ message: "Failed to load incentives" });
    }
  });

  app.get("/api/incentives/team", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const role = (user.role || "").toLowerCase();
      const allowed =
        role === "design_manager" ||
        role === "territorial_design_manager" ||
        role === "deputy_general_manager" ||
        role === "admin";
      if (!allowed) return res.status(403).json({ message: "Forbidden" });

      const cycleIndexRaw = req.query.cycleIndex;
      const cycleIndex =
        cycleIndexRaw != null && String(cycleIndexRaw).trim() !== ""
          ? Number(cycleIndexRaw)
          : getCurrentCycleIndex();

      let designers: { id: number; name: string; role: string }[] = [];
      if (role === "design_manager") {
        const [rows] = await pool.query(
          `SELECT id, name, role FROM users
           WHERE role = 'design_manager' AND id = ?
           UNION
           SELECT id, name, role FROM users
           WHERE role = 'designer' AND design_manager_id = ?
           ORDER BY name ASC`,
          [user.id, user.id],
        );
        designers = rows as typeof designers;
      } else {
        const [rows] = await pool.query(
          `SELECT id, name, role FROM users
           WHERE role IN ('designer', 'design_manager')
           ORDER BY name ASC`,
        );
        designers = rows as typeof designers;
      }

      return res.json({
        cycleIndex,
        members: designers,
      });
    } catch (err) {
      console.error("[GET /api/incentives/team] error", err);
      return res.status(500).json({ message: "Failed to load team incentives members" });
    }
  });
}
