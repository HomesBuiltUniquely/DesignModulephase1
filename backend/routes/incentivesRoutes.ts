import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import {
  resolveLeadMilestonePaymentBreakdown,
  resolveLeadQuotePaymentSummary,
  extractTotalPayableAmount,
} from "./prolanceApi";

type SessionUser = { id: number; name?: string; role?: string; email?: string };

const FORTNIGHT_EPOCH_YEAR = 2026;

const MEETING_WIZ_COMPLETED_TASK = "Meeting wizard session completed";

/** Only Meeting Wizard "Meeting Completed" clicks count toward the fortnight meeting gate. */
const MEETING_TASKS = [MEETING_WIZ_COMPLETED_TASK] as const;

function getIstYmd(date: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function isoFromYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fortnightBounds(
  year: number,
  monthIndex: number,
  half: 0 | 1,
): { startDay: number; endDay: number } {
  if (half === 0) return { startDay: 1, endDay: 15 };
  return { startDay: 16, endDay: daysInMonth(year, monthIndex) };
}

function cycleIndexFromYmd(year: number, monthIndex: number, day: number): number {
  const monthsSinceEpoch = (year - FORTNIGHT_EPOCH_YEAR) * 12 + monthIndex;
  const half = day <= 15 ? 0 : 1;
  return Math.max(0, monthsSinceEpoch * 2 + half);
}

function cycleRange(cycleIndex: number): { startIso: string; endIso: string } {
  const idx = Math.max(0, Math.floor(cycleIndex));
  const monthsSinceEpoch = Math.floor(idx / 2);
  const half = (idx % 2) as 0 | 1;
  const year = FORTNIGHT_EPOCH_YEAR + Math.floor(monthsSinceEpoch / 12);
  const monthIndex = monthsSinceEpoch % 12;
  const { startDay, endDay } = fortnightBounds(year, monthIndex, half);
  return {
    startIso: isoFromYmd(year, monthIndex, startDay),
    endIso: isoFromYmd(year, monthIndex, endDay),
  };
}

function getCurrentCycleIndex(now = new Date()): number {
  const { year, month, day } = getIstYmd(now);
  return cycleIndexFromYmd(year, month, day);
}

function toIsoUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
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

async function resolveFirstQuoteTotal(
  pool: Pool,
  leadId: number,
  payload: Record<string, unknown>,
): Promise<number | null> {
  // 1. Check if we already have a frozen value in the payload
  const frozen = asNum(payload.quotation_total_at_sales_closure);
  if (frozen && frozen > 0) return frozen;

  // 2. Check lead_hub_booking_sync for CRM-originated leads
  try {
    const [syncRows] = await pool.query(
      `SELECT payment_payload, ten_percent_amount FROM lead_hub_booking_sync WHERE lead_id = ? LIMIT 1`,
      [leadId]
    );
    const sync = (syncRows as any[])[0];
    if (sync) {
      let paymentPayload: Record<string, unknown> = {};
      if (sync.payment_payload) {
        try {
          paymentPayload = typeof sync.payment_payload === "string"
            ? JSON.parse(sync.payment_payload)
            : sync.payment_payload;
        } catch {
          // ignore
        }
      }
      const quoteVal =
        asNum(paymentPayload.quoteAmount) ||
        asNum(paymentPayload.quote_amount) ||
        asNum(paymentPayload.quotationTotal) ||
        asNum(paymentPayload.quotation_total);
      if (quoteVal && quoteVal > 0) return quoteVal;

      const tenPct = asNum(sync.ten_percent_amount);
      if (tenPct && tenPct > 0) return Math.round(tenPct * 10);
    }
  } catch (err) {
    console.error("resolveFirstQuoteTotal sync check error", err);
  }

  // 3. Check oldest Prolance quote version / snapshot
  try {
    const [verRows] = await pool.query(
      `SELECT quote_id FROM lead_prolance_quote_versions
       WHERE lead_id = ?
       ORDER BY created_at ASC, id ASC
       LIMIT 1`,
      [leadId]
    );
    const firstVer = (verRows as any[])[0];
    if (firstVer?.quote_id) {
      const [snapRows] = await pool.query(
        `SELECT payload_json FROM lead_prolance_quote_snapshots
         WHERE quote_id = ? LIMIT 1`,
        [firstVer.quote_id]
      );
      const snap = (snapRows as any[])[0];
      if (snap?.payload_json) {
        try {
          const quoteBody = JSON.parse(snap.payload_json);
          const total = extractTotalPayableAmount(quoteBody);
          if (total && total > 0) return total;
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.error("resolveFirstQuoteTotal versions check error", err);
  }

  // 4. Check oldest snapshot directly (if version records are missing)
  try {
    const [snapRows] = await pool.query(
      `SELECT payload_json FROM lead_prolance_quote_snapshots
       WHERE lead_id = ?
       ORDER BY created_at ASC, id ASC
       LIMIT 1`,
      [leadId]
    );
    const snap = (snapRows as any[])[0];
    if (snap?.payload_json) {
      try {
        const quoteBody = JSON.parse(snap.payload_json);
        const total = extractTotalPayableAmount(quoteBody);
        if (total && total > 0) return total;
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error("resolveFirstQuoteTotal oldest snapshot error", err);
  }

  // 5. Fallback: If we have form or payload quotation_total
  const form = formDataOf(payload);
  const payloadQuote =
    asNum(payload.quotation_total) ||
    asNum(form.quotation_total) ||
    asNum(payload.total_quotation) ||
    asNum(form.total_quotation);
  if (payloadQuote && payloadQuote > 0) return payloadQuote;

  const tenTarget =
    asNum(payload.ten_percent_target) ||
    asNum(form.ten_percent_target);
  if (tenTarget && tenTarget > 0) return Math.round(tenTarget * 10);

  return null;
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
        `SELECT id, name, role, sub_role AS subRole FROM users WHERE id = ? LIMIT 1`,
        [designerId],
      );
      const designer = (designerRows as { id: number; name: string; role: string; subRole: string | null }[])[0];
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

      // Meeting gate: count only Meeting Wizard "Meeting Completed" history events in-cycle.
      const [histRows] = await pool.query(
        `SELECT lead_id AS leadId, event, created_at AS createdAt
         FROM lead_history
         WHERE lead_id IN (${placeholders})
         ORDER BY created_at DESC`,
        leadIds,
      );
      let meetingsCompleted = 0;
      for (const row of histRows as { leadId: number; event: unknown; createdAt: Date | string }[]) {
        let ev: Record<string, unknown> | null = null;
        if (row.event && typeof row.event === "object") {
          ev = row.event as Record<string, unknown>;
        } else if (typeof row.event === "string" && row.event.trim()) {
          try {
            ev = JSON.parse(row.event) as Record<string, unknown>;
          } catch {
            ev = null;
          }
        }
        const taskName = asStr(ev?.taskName);
        if (!MEETING_TASKS.includes(taskName as (typeof MEETING_TASKS)[number])) continue;
        const iso =
          toDateIso(ev?.timestamp) ||
          toDateIso((ev?.meta as Record<string, unknown> | undefined)?.completedAt) ||
          toDateIso(row.createdAt);
        if (inRange(iso, startIso, endIso)) meetingsCompleted += 1;
      }

      const deals: Array<Record<string, unknown>> = [];

      for (const lead of leads) {
        const payload = parsePayload(lead.payload);
        const form = formDataOf(payload);

        const salesApproved =
          asBool(payload.sales_closure_finance_approved) ||
          asBool(payload.crm_booking_finance_approved);
        const salesApprovedAt =
          toDateIso(payload.sales_closure_finance_approved_at) ||
          toDateIso(payload.crm_booking_finance_approved_at) ||
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

        const firstQuoteTotal = await resolveFirstQuoteTotal(pool, lead.id, payload);
        const quoteCurrent = pickQuote(payload, breakdownTotal, tenTarget);
        // Freeze Part 1 quote from first quote total when available; else current.
        const quoteAtPart1 = firstQuoteTotal || quoteCurrent;

        let twentyTarget = asNum(payload.twenty_percent_target) || asNum(form.twenty_percent_target);
        if (!twentyTarget && breakdownTotal) {
           twentyTarget = Math.round(breakdownTotal * 0.2);
        }
        const quoteAtPart2 = twentyTarget ? Math.round(twentyTarget * 5) : quoteCurrent;

        if (quoteCurrent <= 0 && quoteAtPart1 <= 0) continue;

        const q1 = quoteAtPart1 > 0 ? quoteAtPart1 : quoteCurrent;
        const qCur = quoteCurrent > 0 ? quoteCurrent : quoteAtPart1;
        const q2 = quoteAtPart2 > 0 ? quoteAtPart2 : qCur;
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
          quotationAtPart2: q2,
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
        designer: { id: designer.id, name: designer.name, role: designer.role, subRole: designer.subRole || null },
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

      let designers: { id: number; name: string; role: string; subRole: string | null }[] = [];
      if (role === "design_manager") {
        const [rows] = await pool.query(
          `SELECT id, name, role, sub_role AS subRole FROM users
           WHERE role = 'design_manager' AND id = ?
           UNION
           SELECT id, name, role, sub_role AS subRole FROM users
           WHERE role = 'designer' AND design_manager_id = ?
           ORDER BY name ASC`,
          [user.id, user.id],
        );
        designers = rows as typeof designers;
      } else {
        const [rows] = await pool.query(
          `SELECT id, name, role, sub_role AS subRole FROM users
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
