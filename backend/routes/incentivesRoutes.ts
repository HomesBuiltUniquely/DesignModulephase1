import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import {
  resolveLeadMilestonePaymentBreakdown,
  resolveLeadQuotePaymentSummary,
  extractTotalPayableAmount,
} from "./prolanceApi";

type SessionUser = { id: number; name?: string; role?: string; email?: string; branch?: string | null };

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

function toIsoDateTime(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "string" && v.trim()) {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return null;
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

export const SUB_ROLE_MONTHLY_TARGETS: Record<string, number> = {
  INTERN: 25_00_000,
  JID: 25_00_000,
  ID: 30_00_000,
  SID: 35_00_000,
  PD: 38_00_000,
};

const SUB_ROLE_ALIASES: Record<string, string> = {
  INTERN: "INTERN",
  JID: "JID",
  JUNIORINTERIORDESIGNER: "JID",
  JUNIORDESIGNER: "JID",
  JRDESIGNER: "JID",
  ID: "ID",
  INTERIORDESIGNER: "ID",
  SID: "SID",
  SENIORINTERIORDESIGNER: "SID",
  SENIORDESIGNER: "SID",
  PD: "PD",
  PRINCIPALDESIGNER: "PD",
  PRINCIPALINTERIORDESIGNER: "PD",
};

export function normalizeIncentiveSubRole(raw?: string | null): string | null {
  const key = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!key) return null;
  return SUB_ROLE_ALIASES[key] || null;
}

export function getMonthlyTargetForSubRole(raw?: string | null): number {
  const code = normalizeIncentiveSubRole(raw) || "ID";
  return SUB_ROLE_MONTHLY_TARGETS[code] || 30_00_000;
}

export function getFortnightTargetForSubRole(raw?: string | null): number {
  return Math.round(getMonthlyTargetForSubRole(raw) / 2);
}

const SLAB_TIERS = [
  { targetPct: 100, incentivePct: 1.0 },
  { targetPct: 90, incentivePct: 0.75 },
  { targetPct: 80, incentivePct: 0.45 },
  { targetPct: 60, incentivePct: 0.35 },
  { targetPct: 40, incentivePct: 0.25 },
];

function pickSlabPct(achievementPct: number): number {
  for (const tier of SLAB_TIERS) {
    if (achievementPct >= tier.targetPct) return tier.targetPct;
  }
  return 0;
}

function multiplierForSlab(slabPct: number): number {
  const tier = SLAB_TIERS.find((t) => t.targetPct === slabPct);
  return tier ? tier.incentivePct : 0;
}

function getMonthCycleInfo(monthIndex: number): {
  cycleDays: number;
  cycleLabel: string;
  startIso: string;
  endIso: string;
  daysRemaining: number;
  isCurrent: boolean;
} {
  const m = Math.max(0, Math.floor(monthIndex));
  const year = FORTNIGHT_EPOCH_YEAR + Math.floor(m / 12);
  const monthIdx = m % 12;
  const days = daysInMonth(year, monthIdx);
  const startIso = isoFromYmd(year, monthIdx, 1);
  const endIso = isoFromYmd(year, monthIdx, days);

  const nowIst = getIstYmd();
  const currentMonthIdx = (nowIst.year - FORTNIGHT_EPOCH_YEAR) * 12 + nowIst.month;
  const isCurrent = m === currentMonthIdx;
  const daysRemaining = isCurrent ? Math.max(0, days - nowIst.day) : 0;

  const dStart = new Date(Date.UTC(year, monthIdx, 1));
  const dEnd = new Date(Date.UTC(year, monthIdx, days));
  const fmtOptions: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" };
  const labelStart = dStart.toLocaleDateString("en-IN", fmtOptions);
  const labelEnd = dEnd.toLocaleDateString("en-IN", fmtOptions);
  const cycleLabel = `${labelStart} – ${labelEnd}`;

  return {
    cycleDays: days,
    cycleLabel,
    startIso,
    endIso,
    daysRemaining,
    isCurrent,
  };
}

async function fetchDesignerFortnightData(
  pool: Pool,
  designerId: number,
  cycleIndex: number,
) {
  const { startIso, endIso } = cycleRange(cycleIndex);
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
    return { meetingsCompleted: 0, meetings: [], deals: [] };
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
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const meetings: Array<{
    leadId: number;
    customerName: string;
    projectName: string | null;
    completedAt: string;
    meetingDate: string | null;
    startedAt: string | null;
    durationFormatted: string | null;
  }> = [];

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
    const meta =
      ev?.meta && typeof ev.meta === "object" && !Array.isArray(ev.meta)
        ? (ev.meta as Record<string, unknown>)
        : {};
    const completedAt =
      toIsoDateTime(ev?.timestamp) ||
      toIsoDateTime(meta.completedAt) ||
      toIsoDateTime(row.createdAt);
    const iso = completedAt ? completedAt.slice(0, 10) : toDateIso(row.createdAt);
    if (!inRange(iso, startIso, endIso) || !completedAt) continue;
    const lead = leadById.get(Number(row.leadId));
    const payload = parsePayload(lead?.payload);
    meetings.push({
      leadId: Number(row.leadId),
      customerName: customerNameFrom(payload, lead?.projectName ?? null),
      projectName: lead?.projectName ?? null,
      completedAt,
      meetingDate: asStr(meta.meetingDate) || iso,
      startedAt: toIsoDateTime(meta.startedAt),
      durationFormatted: asStr(meta.durationFormatted) || null,
    });
  }

  // Deduplicate meetings
  const dedupedMeetingsMap = new Map<string, (typeof meetings)[number]>();
  for (const m of meetings) {
    const normName = (m.customerName || "").trim().toLowerCase();
    const dedupKey =
      m.leadId > 0
        ? `lead_${m.leadId}`
        : normName && normName !== "customer"
          ? `name_${normName}`
          : `m_${m.completedAt}`;

    const existing = dedupedMeetingsMap.get(dedupKey);
    if (!existing || m.completedAt > existing.completedAt) {
      dedupedMeetingsMap.set(dedupKey, m);
    }
  }

  const sortedCandidates = Array.from(dedupedMeetingsMap.values()).sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt),
  );
  const uniqueMeetings: typeof meetings = [];
  const seenNames = new Set<string>();
  for (const m of sortedCandidates) {
    const normName = (m.customerName || "").trim().toLowerCase();
    if (normName && normName !== "customer") {
      if (seenNames.has(normName)) continue;
      seenNames.add(normName);
    }
    uniqueMeetings.push(m);
  }
  uniqueMeetings.sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const meetingsCompleted = uniqueMeetings.length;

  const deals: Array<{
    id: string;
    customerName: string;
    quotationAtFinanceApproval: number;
    quotationAtPart2?: number;
    quotationCurrent: number;
    salesTenPercentCollected: number;
    salesTenPercentFinanceApproved: boolean;
    cumulativeCollectedTowardDesign10: number;
    designTenPercentFinanceApproved: boolean;
    cumulativeCollectedTowardFortyPercent: number;
    fortyPercentFinanceApproved: boolean;
    creditPart1InCycle: boolean;
    creditPart2InCycle: boolean;
    creditPart3InCycle: boolean;
    activityDate: string;
    closureTime: "SAME DAY" | "48 HOURS" | "72 HOURS+";
  }> = [];

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
      // non-fatal
    }

    const tenTarget =
      asNum(payload.ten_percent_target) ||
      asNum(form.ten_percent_target) ||
      (breakdownTotal ? Math.round(breakdownTotal * 0.1) : null);

    const firstQuoteTotal = await resolveFirstQuoteTotal(pool, lead.id, payload);
    const quoteCurrent = pickQuote(payload, breakdownTotal, tenTarget);
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

  return {
    meetingsCompleted,
    meetings: uniqueMeetings,
    deals,
  };
}

function computeDesignerFortnightMetrics(
  subRole: string | null,
  deals: Array<{
    quotationAtFinanceApproval: number;
    quotationAtPart2?: number;
    quotationCurrent: number;
    salesTenPercentFinanceApproved: boolean;
    designTenPercentFinanceApproved: boolean;
    fortyPercentFinanceApproved: boolean;
    creditPart1InCycle: boolean;
    creditPart2InCycle: boolean;
    creditPart3InCycle: boolean;
    closureTime: "SAME DAY" | "48 HOURS" | "72 HOURS+";
  }>,
  meetingsCompleted: number,
) {
  const target = getFortnightTargetForSubRole(subRole);
  let grossWeightedRevenue = 0;
  let sameDayClosures = 0;
  let fortyEightHourClosures = 0;

  for (const d of deals) {
    if (!d.creditPart1InCycle && !d.creditPart2InCycle && !d.creditPart3InCycle) continue;

    const q1 = d.quotationAtFinanceApproval;
    const q2 = d.quotationAtPart2 || d.quotationCurrent;
    const qCur = d.quotationCurrent;

    let dealGross = 0;
    if (d.creditPart1InCycle && d.salesTenPercentFinanceApproved) {
      dealGross += Math.round((q1 * 50) / 100);
    }
    if (d.creditPart2InCycle && d.designTenPercentFinanceApproved) {
      dealGross += Math.round((q2 * 25) / 100);
    }
    if (d.creditPart3InCycle && d.fortyPercentFinanceApproved) {
      if (qCur >= q1) {
        dealGross += Math.round((q1 * 25) / 100) + (qCur - q1);
      } else {
        dealGross += Math.round((qCur * 25) / 100);
      }
    }

    let downsaleDeduction = 0;
    if (qCur < q1) {
      const downsaleAmount = q1 - qCur;
      downsaleDeduction = Math.round((downsaleAmount * 50) / 100);
    }
    const netWeighted = Math.max(0, dealGross - downsaleDeduction);
    grossWeightedRevenue += netWeighted;

    if (d.closureTime === "SAME DAY") sameDayClosures++;
    else if (d.closureTime === "48 HOURS") fortyEightHourClosures++;
  }

  const revenueAchieved = grossWeightedRevenue;
  const achievementPct = target > 0 ? Math.round((revenueAchieved / target) * 1000) / 10 : 0;
  const currentSlabPct = pickSlabPct(achievementPct);
  const multiplier = multiplierForSlab(currentSlabPct);

  const meetingsRequired = 3;
  const meetingsEligible = meetingsCompleted >= meetingsRequired;
  const potentialIncentive = Math.round((revenueAchieved * multiplier) / 100);
  const incentiveEarned = meetingsEligible ? potentialIncentive : 0;
  const sameDayBonus = sameDayClosures * 750;
  const fortyEightHourBonus = fortyEightHourClosures * 375;
  const onSpotBonus = meetingsEligible ? sameDayBonus + fortyEightHourBonus : 0;

  return {
    target,
    revenueAchieved,
    achievementPct,
    currentSlabPct,
    incentiveEarned,
    onSpotBonus,
    meetingsCompleted,
    meetingsRequired,
    meetingsEligible,
  };
}

export const BRANCH_TARGET_CODES = ["HBR", "SJR", "JPN"] as const;
export type BranchTargetCode = (typeof BRANCH_TARGET_CODES)[number];
/** ₹1.5 crore. The per-branch floor starts here and never decreases. */
export const INITIAL_BRANCH_MINIMUM_INR = 15_000_000;

export function isBranchTargetCode(code: string): code is BranchTargetCode {
  return (BRANCH_TARGET_CODES as readonly string[]).includes(code);
}

/** Highest of the stored floor and any candidate. Lower candidates are ignored. */
export function nextStoredMinimum(storedMinimum: number, ...amounts: number[]): number {
  let next = Number.isFinite(storedMinimum) ? storedMinimum : INITIAL_BRANCH_MINIMUM_INR;
  for (const amount of amounts) {
    if (Number.isFinite(amount) && amount > next) next = amount;
  }
  return next;
}

export function applicableBranchTarget(storedMinimum: number, achievement: number): number {
  const stored = Number.isFinite(storedMinimum) ? storedMinimum : INITIAL_BRANCH_MINIMUM_INR;
  const achieved = Number.isFinite(achievement) && achievement > 0 ? achievement : 0;
  return Math.max(stored, achieved);
}

export type BranchFloors = Record<BranchTargetCode, number>;

export function initialBranchFloors(): BranchFloors {
  return {
    HBR: INITIAL_BRANCH_MINIMUM_INR,
    SJR: INITIAL_BRANCH_MINIMUM_INR,
    JPN: INITIAL_BRANCH_MINIMUM_INR,
  };
}

/** Raise one branch only. Other branches keep their own floors. */
export function raiseBranchFloor(
  floors: BranchFloors,
  branchCode: BranchTargetCode,
  ...amounts: number[]
): BranchFloors {
  return {
    ...floors,
    [branchCode]: nextStoredMinimum(floors[branchCode], ...amounts),
  };
}

export type BranchTargetDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 403; message: string };

/**
 * Admin may raise any of the three branches.
 * A TDM may raise a branch only when that design manager's territorial_design_manager_id is the TDM.
 */
export function authorizeBranchTargetWrite(input: {
  role: string | null | undefined;
  viewerId: number;
  managerTerritorialDesignManagerId: number | null;
  branchCode: string;
}): BranchTargetDecision {
  const role = (input.role || "").toLowerCase();
  if (role !== "admin" && role !== "territorial_design_manager") {
    return { allowed: false, status: 403, message: "Forbidden" };
  }
  if (role === "territorial_design_manager") {
    const ownerId =
      input.managerTerritorialDesignManagerId == null
        ? null
        : Number(input.managerTerritorialDesignManagerId);
    if (ownerId == null || ownerId !== Number(input.viewerId)) {
      return {
        allowed: false,
        status: 403,
        message: "You can only set targets for design managers in your territory",
      };
    }
  }
  if (!isBranchTargetCode(input.branchCode)) {
    return {
      allowed: false,
      status: 400,
      message: "Branch target applies to HBR, Sarjapur, and JP Nagar only",
    };
  }
  return { allowed: true };
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

      const raw = await fetchDesignerFortnightData(pool, designerId, cycleIndex);

      return res.json({
        designer: { id: designer.id, name: designer.name, role: designer.role, subRole: designer.subRole || null },
        cycleIndex,
        startIso,
        endIso,
        meetingsCompleted: raw.meetingsCompleted,
        meetings: raw.meetings,
        deals: raw.deals,
      });
    } catch (err) {
      console.error("[GET /api/incentives/designer/:id] error", err);
      return res.status(500).json({ message: "Failed to load incentives" });
    }
  });

  function toBranchCode(raw?: string | null): string {
    const s = String(raw || "").trim().toUpperCase();
    if (!s) return "";
    if (s.includes("HBR")) return "HBR";
    if (s.includes("JPN") || s.includes("JP NAGAR")) return "JPN";
    if (s.includes("SJR") || s.includes("SARJAPUR")) return "SJR";
    return s.slice(0, 3);
  }

  async function resolveActiveTeams(): Promise<
    Array<{
      code: string;
      name: string;
      label: string;
      managerId: number;
      managerName: string;
    }>
  > {
    const [teamRows] = await pool.query(
      `SELECT m.id AS managerId,
              m.name AS managerName,
              COALESCE(
                NULLIF(TRIM(m.branch), ''),
                (SELECT branch FROM users WHERE design_manager_id = m.id AND branch IS NOT NULL AND TRIM(branch) != '' LIMIT 1)
              ) AS branchCode
       FROM users m
       WHERE m.role = 'design_manager'
       ORDER BY COALESCE(
         NULLIF(TRIM(m.branch), ''),
         (SELECT branch FROM users WHERE design_manager_id = m.id AND branch IS NOT NULL AND TRIM(branch) != '' LIMIT 1)
       ) ASC,
       m.name ASC`
    );

    return (teamRows as any[])
      .map((r) => {
        const code = toBranchCode(r.branchCode);
        const managerName = String(r.managerName || "").trim();
        return {
          code: code || "GEN",
          name: managerName,
          label: code ? `${managerName} (${code})` : managerName,
          managerId: Number(r.managerId),
          managerName,
        };
      })
      .sort((a, b) => {
        if (a.code !== b.code) return a.code.localeCompare(b.code);
        return a.managerName.localeCompare(b.managerName);
      });
  }

  app.get("/api/incentives/teams", async (req: Request, res: Response) => {
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

      const allTeams = await resolveActiveTeams();

      if (role === "design_manager") {
        // Design managers only see their own team (matched by user.id)
        const myTeam = allTeams.filter((t) => t.managerId === user.id);
        return res.json({ teams: myTeam });
      }

      let managerTeams = allTeams;
      if (role === "territorial_design_manager") {
        const [allowedRows] = await pool.query(
          `SELECT id FROM users WHERE role = 'design_manager' AND territorial_design_manager_id = ?`,
          [user.id],
        );
        const allowedIds = new Set(
          (allowedRows as { id: number }[]).map((row) => Number(row.id)),
        );
        managerTeams = allTeams.filter((t) => allowedIds.has(t.managerId));
      }

      // Admin / TDM / DGM:
      // "All Branches" is the FIRST option in the dropdown, followed by manager teams, and "Unassigned"
      const [unassignedRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM users WHERE role = 'designer' AND (design_manager_id IS NULL OR design_manager_id = 0)`
      );
      const unassignedCount = Number((unassignedRows as any[])[0]?.cnt || 0);

      const teamsList = [
        {
          code: "ALL",
          name: "All Branches",
          label: "All Branches",
          managerId: -1,
          managerName: "All Branches",
        },
        ...managerTeams,
      ];

      if (unassignedCount > 0) {
        teamsList.push({
          code: "UNASSIGNED",
          name: "Unassigned",
          label: "Unassigned",
          managerId: 0,
          managerName: "Unassigned",
        });
      }

      return res.json({ teams: teamsList });
    } catch (err) {
      console.error("[GET /api/incentives/teams] error", err);
      return res.status(500).json({ message: "Failed to load teams" });
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

      const isDM = role === "design_manager";
      const isAdminOrTdm =
        role === "admin" ||
        role === "territorial_design_manager" ||
        role === "deputy_general_manager";

      const period = Number(req.query.period) === 30 ? 30 : 15;

      const reqManagerIdRaw = req.query.managerId as string | undefined;
      const reqManagerId =
        reqManagerIdRaw !== undefined &&
        reqManagerIdRaw !== null &&
        reqManagerIdRaw.trim() !== "" &&
        !isNaN(Number(reqManagerIdRaw))
          ? Number(reqManagerIdRaw)
          : null;

      // Reject unauthorized requests for 30-day mode or All Branches
      if (isDM) {
        if (period === 30 || reqManagerId === -1 || (reqManagerId !== null && reqManagerId !== user.id)) {
          return res.status(403).json({ message: "Forbidden: Access restricted to authorized managers" });
        }
      }

      let cycleIndex = getCurrentCycleIndex();
      if (req.query.cycleIndex != null && String(req.query.cycleIndex).trim() !== "") {
        const ci = Number(req.query.cycleIndex);
        if (Number.isFinite(ci) && ci >= 0) cycleIndex = ci;
      }

      let monthIndex = Math.floor(cycleIndex / 2);
      if (req.query.monthIndex != null && String(req.query.monthIndex).trim() !== "") {
        const mi = Number(req.query.monthIndex);
        if (Number.isFinite(mi) && mi >= 0) monthIndex = mi;
      }

      const allTeams = await resolveActiveTeams();

      // Resolve target team
      let targetTeam: {
        code: string;
        name: string;
        label: string;
        managerId: number;
        managerName: string;
      } | null = null;

      if (isDM) {
        targetTeam = allTeams.find((t) => t.managerId === user.id) || null;
        if (!targetTeam) {
          const code = toBranchCode(user.branch) || "GEN";
          const managerName = String(user.name || "Manager").trim();
          targetTeam = {
            code,
            name: managerName,
            label: code ? `${managerName} (${code})` : managerName,
            managerId: user.id,
            managerName,
          };
        }
      } else {
        // Admin / TDM / DGM: default to All Branches (managerId: -1) if no selection given
        const effectiveManagerId = reqManagerId !== null ? reqManagerId : -1;

        if (effectiveManagerId === -1) {
          targetTeam = {
            code: "ALL",
            name: "All Branches",
            label: "All Branches",
            managerId: -1,
            managerName: "All Branches",
          };
        } else if (effectiveManagerId === 0) {
          targetTeam = {
            code: "UNASSIGNED",
            name: "Unassigned",
            label: "Unassigned",
            managerId: 0,
            managerName: "Unassigned",
          };
        } else {
          targetTeam = allTeams.find((t) => t.managerId === effectiveManagerId) || null;
        }

        const reqTeamCode = (req.query.team as string | undefined)?.trim()?.toUpperCase();
        if (!targetTeam && reqTeamCode) {
          if (reqTeamCode === "ALL") {
            targetTeam = {
              code: "ALL",
              name: "All Branches",
              label: "All Branches",
              managerId: -1,
              managerName: "All Branches",
            };
          } else {
            targetTeam = allTeams.find((t) => t.code === reqTeamCode) || null;
          }
        }

        if (!targetTeam) {
          targetTeam = {
            code: "ALL",
            name: "All Branches",
            label: "All Branches",
            managerId: -1,
            managerName: "All Branches",
          };
        }
      }

      // Query designers to evaluate (always role='designer' only, never design managers)
      let designerRows: Array<{
        id: number;
        name: string;
        role: string;
        subRole: string | null;
        branch: string;
        managerId: number | null;
        managerName: string;
      }> = [];

      if (targetTeam.managerId === -1) {
        // All Branches: query all designers across the system with their manager info
        const [rows] = await pool.query(
          `SELECT u.id, u.name, u.role, u.sub_role AS subRole,
                  COALESCE(NULLIF(TRIM(u.branch), ''), NULLIF(TRIM(dm.branch), ''), 'GEN') AS branch,
                  u.design_manager_id AS managerId,
                  COALESCE(dm.name, 'Unassigned') AS managerName
           FROM users u
           LEFT JOIN users dm ON dm.id = u.design_manager_id
           WHERE u.role = 'designer'
           ORDER BY u.name ASC`
        );
        designerRows = rows as typeof designerRows;
      } else if (targetTeam.managerId === 0) {
        // Unassigned
        const [rows] = await pool.query(
          `SELECT u.id, u.name, u.role, u.sub_role AS subRole,
                  COALESCE(NULLIF(TRIM(u.branch), ''), 'GEN') AS branch,
                  0 AS managerId,
                  'Unassigned' AS managerName
           FROM users u
           WHERE u.role = 'designer' AND (u.design_manager_id IS NULL OR u.design_manager_id = 0)
           ORDER BY u.name ASC`
        );
        designerRows = rows as typeof designerRows;
      } else {
        // Single manager's team
        const [rows] = await pool.query(
          `SELECT u.id, u.name, u.role, u.sub_role AS subRole,
                  COALESCE(NULLIF(TRIM(u.branch), ''), NULLIF(TRIM(dm.branch), ''), 'GEN') AS branch,
                  u.design_manager_id AS managerId,
                  dm.name AS managerName
           FROM users u
           LEFT JOIN users dm ON dm.id = u.design_manager_id
           WHERE u.role = 'designer' AND u.design_manager_id = ?
           ORDER BY u.name ASC`,
          [targetTeam.managerId]
        );
        designerRows = rows as typeof designerRows;
      }

      // Compute metrics server-side for each designer in parallel
      const computedRows = await Promise.all(
        designerRows.map(async (d) => {
          const branchCode = toBranchCode(d.branch) || "GEN";
          const managerName = d.managerName || "Unassigned";

          if (period === 15) {
            const raw = await fetchDesignerFortnightData(pool, d.id, cycleIndex);
            const m = computeDesignerFortnightMetrics(d.subRole, raw.deals, raw.meetingsCompleted);
            return {
              designerId: d.id,
              designerName: d.name,
              role: d.role,
              subRole: d.subRole || null,
              branch: branchCode,
              managerId: d.managerId || null,
              managerName,
              totalTarget: m.target,
              revenueAchieved: m.revenueAchieved,
              achievementPct: m.achievementPct,
              meetingsCompleted: m.meetingsCompleted,
              meetingsRequired: m.meetingsRequired,
              meetingsEligible: m.meetingsEligible,
              meetingsGateNote: m.meetingsEligible ? "Eligible" : "Locked",
              currentSlabPct: m.currentSlabPct,
              slabDisplay: m.currentSlabPct > 0 ? `${m.currentSlabPct}%` : "—",
              incentiveEarned: m.incentiveEarned,
              onSpotBonus: m.onSpotBonus,
            };
          } else {
            // 30-day mode: fortnight 1 + fortnight 2
            const c1 = monthIndex * 2;
            const c2 = monthIndex * 2 + 1;
            const [raw1, raw2] = await Promise.all([
              fetchDesignerFortnightData(pool, d.id, c1),
              fetchDesignerFortnightData(pool, d.id, c2),
            ]);
            const m1 = computeDesignerFortnightMetrics(d.subRole, raw1.deals, raw1.meetingsCompleted);
            const m2 = computeDesignerFortnightMetrics(d.subRole, raw2.deals, raw2.meetingsCompleted);

            const totalTarget = m1.target + m2.target; // exactly 2x fortnight target
            const revenueAchieved = m1.revenueAchieved + m2.revenueAchieved;
            const achievementPct = totalTarget > 0 ? Math.round((revenueAchieved / totalTarget) * 1000) / 10 : 0;
            const meetingsCompleted = m1.meetingsCompleted + m2.meetingsCompleted;
            const meetingsRequired = 6;
            const meetingsEligible = m1.meetingsEligible && m2.meetingsEligible;
            const incentiveEarned = m1.incentiveEarned + m2.incentiveEarned;
            const onSpotBonus = m1.onSpotBonus + m2.onSpotBonus;

            const meetingsGateNote =
              m1.meetingsEligible && m2.meetingsEligible
                ? "Passed (2/2)"
                : m1.meetingsEligible || m2.meetingsEligible
                  ? "1 of 2 fortnights"
                  : "Locked (0/2)";

            const slabDisplay = `${m1.currentSlabPct > 0 ? m1.currentSlabPct + "%" : "—"} / ${m2.currentSlabPct > 0 ? m2.currentSlabPct + "%" : "—"}`;

            return {
              designerId: d.id,
              designerName: d.name,
              role: d.role,
              subRole: d.subRole || null,
              branch: branchCode,
              managerId: d.managerId || null,
              managerName,
              totalTarget,
              revenueAchieved,
              achievementPct,
              meetingsCompleted,
              meetingsRequired,
              meetingsEligible,
              meetingsGateNote,
              currentSlabPct: m1.currentSlabPct || m2.currentSlabPct || 0,
              slabDisplay,
              incentiveEarned,
              onSpotBonus,
            };
          }
        })
      );

      // Sort rows by incentive earned desc, then revenue desc
      computedRows.sort((a, b) => b.incentiveEarned - a.incentiveEarned || b.revenueAchieved - a.revenueAchieved);

      // Compute Team Breakdown table rows (only for All Branches view)
      let teamBreakdown: Array<{
        teamKey: string;
        teamLabel: string;
        managerId: number;
        branch: string;
        designerCount: number;
        combinedTarget: number;
        revenue: number;
        achievementPct: number;
        totalIncentives: number;
      }> | undefined = undefined;

      if (targetTeam.managerId === -1) {
        const breakdownMap = new Map<string, {
          teamKey: string;
          teamLabel: string;
          managerId: number;
          branch: string;
          designerCount: number;
          combinedTarget: number;
          revenue: number;
          achievementPct: number;
          totalIncentives: number;
        }>();

        for (const t of allTeams) {
          breakdownMap.set(String(t.managerId), {
            teamKey: String(t.managerId),
            teamLabel: t.label,
            managerId: t.managerId,
            branch: t.code,
            designerCount: 0,
            combinedTarget: 0,
            revenue: 0,
            achievementPct: 0,
            totalIncentives: 0,
          });
        }
        breakdownMap.set("0", {
          teamKey: "0",
          teamLabel: "Unassigned",
          managerId: 0,
          branch: "—",
          designerCount: 0,
          combinedTarget: 0,
          revenue: 0,
          achievementPct: 0,
          totalIncentives: 0,
        });

        for (const r of computedRows) {
          const mId = r.managerId && r.managerId > 0 ? String(r.managerId) : "0";
          const entry = breakdownMap.get(mId);
          if (entry) {
            entry.designerCount++;
            entry.combinedTarget += r.totalTarget;
            entry.revenue += r.revenueAchieved;
            entry.totalIncentives += r.incentiveEarned;
          }
        }

        teamBreakdown = Array.from(breakdownMap.values())
          .filter((e) => e.designerCount > 0)
          .map((e) => ({
            ...e,
            achievementPct: e.combinedTarget > 0 ? Math.round((e.revenue / e.combinedTarget) * 1000) / 10 : 0,
          }));
      }

      // Compute summary metrics across all returned rows
      const totalTarget = computedRows.reduce((s, r) => s + r.totalTarget, 0);
      const revenueAchieved = computedRows.reduce((s, r) => s + r.revenueAchieved, 0);
      const incentiveEarned = computedRows.reduce((s, r) => s + r.incentiveEarned, 0);
      const onSpotBonus = computedRows.reduce((s, r) => s + r.onSpotBonus, 0);
      const achievementPct = totalTarget > 0 ? Math.round((revenueAchieved / totalTarget) * 1000) / 10 : 0;
      const meetingsGatePassedCount = computedRows.filter((r) => r.meetingsEligible).length;

      const summary = {
        memberCount: computedRows.length,
        totalTarget,
        revenueAchieved,
        achievementPct,
        meetingsGatePassedCount,
        incentiveEarned,
        onSpotBonus,
      };

      // Construct cycle info
      let cycleInfo: {
        cycleDays: number;
        cycleLabel: string;
        startIso: string;
        endIso: string;
        daysRemaining: number;
        isCurrent: boolean;
      };

      if (period === 30) {
        cycleInfo = getMonthCycleInfo(monthIndex);
      } else {
        const { startIso, endIso } = cycleRange(cycleIndex);
        const days = 15;
        const nowIst = getIstYmd();
        const currentCycle = getCurrentCycleIndex();
        const isCurrent = cycleIndex === currentCycle;
        const daysRemaining = isCurrent ? Math.max(0, days - nowIst.day) : 0;
        const dStart = new Date(`${startIso}T00:00:00Z`);
        const dEnd = new Date(`${endIso}T00:00:00Z`);
        const fmtOptions: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" };
        const cycleLabel = `${dStart.toLocaleDateString("en-IN", fmtOptions)} – ${dEnd.toLocaleDateString("en-IN", fmtOptions)}`;
        cycleInfo = {
          cycleDays: days,
          cycleLabel,
          startIso,
          endIso,
          daysRemaining,
          isCurrent,
        };
      }

      return res.json({
        period,
        cycleIndex,
        monthIndex,
        cycle: cycleInfo,
        team: targetTeam,
        summary,
        teamBreakdown,
        rows: computedRows,
        members: designerRows,
      });
    } catch (err) {
      console.error("[GET /api/incentives/team] error", err);
      return res.status(500).json({ message: "Failed to load team incentives" });
    }
  });

  let branchTargetTableReady: Promise<void> | null = null;
  function ensureBranchTargetTable(): Promise<void> {
    if (!branchTargetTableReady) {
      branchTargetTableReady = (async () => {
        await pool.query(
          `CREATE TABLE IF NOT EXISTS branch_design_manager_targets (
             branch_code VARCHAR(8) NOT NULL PRIMARY KEY,
             minimum_target_inr DECIMAL(18,2) NOT NULL,
             updated_by INT NULL,
             updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
           )`,
        );
        await pool.query(
          `INSERT IGNORE INTO branch_design_manager_targets (branch_code, minimum_target_inr)
           VALUES ('HBR', ?), ('SJR', ?), ('JPN', ?)`,
          [INITIAL_BRANCH_MINIMUM_INR, INITIAL_BRANCH_MINIMUM_INR, INITIAL_BRANCH_MINIMUM_INR],
        );
      })().catch((err) => {
        branchTargetTableReady = null;
        throw err;
      });
    }
    return branchTargetTableReady;
  }

  async function sumDesignerFortnightTotals(
    managerIds: number[],
    cycleIndex: number,
  ): Promise<{ totalTarget: number; revenueAchieved: number }> {
    if (managerIds.length === 0) return { totalTarget: 0, revenueAchieved: 0 };
    const [rows] = await pool.query(
      `SELECT id, sub_role AS subRole
       FROM users
       WHERE role = 'designer' AND design_manager_id IN (?)`,
      [managerIds],
    );
    const designers = rows as { id: number; subRole: string | null }[];
    const parts = await Promise.all(
      designers.map(async (designer) => {
        const raw = await fetchDesignerFortnightData(pool, designer.id, cycleIndex);
        const metrics = computeDesignerFortnightMetrics(
          designer.subRole,
          raw.deals,
          raw.meetingsCompleted,
        );
        return { totalTarget: metrics.target, revenueAchieved: metrics.revenueAchieved };
      }),
    );
    return parts.reduce(
      (sum, part) => ({
        totalTarget: sum.totalTarget + part.totalTarget,
        revenueAchieved: sum.revenueAchieved + part.revenueAchieved,
      }),
      { totalTarget: 0, revenueAchieved: 0 },
    );
  }

  async function sumBranchAchievement(managerId: number, cycleIndex: number): Promise<number> {
    const totals = await sumDesignerFortnightTotals([managerId], cycleIndex);
    return totals.revenueAchieved;
  }

  /**
   * Persist a higher floor in one row update. GREATEST reads the current value under InnoDB's row lock,
   * so overlapping requests cannot write a lower minimum.
   */
  async function raiseStoredBranchMinimum(
    branchCode: BranchTargetCode,
    candidate: number,
    updatedBy: number,
  ): Promise<number> {
    await pool.query(
      `UPDATE branch_design_manager_targets
       SET updated_by = IF(? > minimum_target_inr, ?, updated_by),
           minimum_target_inr = GREATEST(minimum_target_inr, ?)
       WHERE branch_code = ?`,
      [candidate, updatedBy, candidate, branchCode],
    );
    const [rows] = await pool.query(
      `SELECT minimum_target_inr AS minimumTarget
       FROM branch_design_manager_targets
       WHERE branch_code = ?
       LIMIT 1`,
      [branchCode],
    );
    const stored = Number((rows as { minimumTarget: number | string }[])[0]?.minimumTarget);
    return Number.isFinite(stored) ? stored : INITIAL_BRANCH_MINIMUM_INR;
  }

  async function resolveBranchTargetRequest(
    req: Request,
    res: Response,
    submitted: number | null,
  ): Promise<void> {
    const user = await getUserFromSession(req);
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const managerId = Number(req.method === "GET" ? req.query.managerId : (req.body || {}).managerId);
    if (!Number.isFinite(managerId) || managerId <= 0) {
      res.status(400).json({ message: "Select a branch design manager" });
      return;
    }

    const cycleRaw = req.method === "GET" ? req.query.cycleIndex : (req.body || {}).cycleIndex;
    const cycleIndex =
      cycleRaw != null && String(cycleRaw).trim() !== "" ? Number(cycleRaw) : getCurrentCycleIndex();
    if (!Number.isFinite(cycleIndex) || cycleIndex < 0) {
      res.status(400).json({ message: "Invalid cycleIndex" });
      return;
    }

    const [managerRows] = await pool.query(
      `SELECT m.id,
              m.branch,
              m.territorial_design_manager_id AS territorialDesignManagerId,
              COALESCE(
                NULLIF(TRIM(m.branch), ''),
                (SELECT branch FROM users WHERE design_manager_id = m.id AND branch IS NOT NULL AND TRIM(branch) != '' LIMIT 1)
              ) AS resolvedBranch
       FROM users m
       WHERE m.id = ? AND m.role = 'design_manager'
       LIMIT 1`,
      [managerId],
    );
    const manager = (managerRows as {
      id: number;
      branch: string | null;
      territorialDesignManagerId: number | null;
      resolvedBranch: string | null;
    }[])[0];
    if (!manager) {
      res.status(404).json({ message: "Design manager not found" });
      return;
    }

    const branchCode = toBranchCode(manager.resolvedBranch || manager.branch);
    const decision = authorizeBranchTargetWrite({
      role: user.role,
      viewerId: user.id,
      managerTerritorialDesignManagerId:
        manager.territorialDesignManagerId == null ? null : Number(manager.territorialDesignManagerId),
      branchCode,
    });
    if (!decision.allowed) {
      res.status(decision.status).json({ message: decision.message });
      return;
    }
    if (!isBranchTargetCode(branchCode)) {
      res.status(400).json({ message: "Branch target applies to HBR, Sarjapur, and JP Nagar only" });
      return;
    }

    await ensureBranchTargetTable();
    const achievement = await sumBranchAchievement(managerId, cycleIndex);
    const candidate =
      submitted == null ? achievement : nextStoredMinimum(INITIAL_BRANCH_MINIMUM_INR, achievement, submitted);
    const storedMinimum = await raiseStoredBranchMinimum(branchCode, candidate, user.id);
    const applicableTarget = applicableBranchTarget(storedMinimum, achievement);
    res.json({ branchCode, storedMinimum, achievement, applicableTarget });
  }

  app.get("/api/incentives/tdm-totals", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      if ((user.role || "").toLowerCase() !== "territorial_design_manager") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const cycleRaw = req.query.cycleIndex;
      const cycleIndex =
        cycleRaw != null && String(cycleRaw).trim() !== "" ? Number(cycleRaw) : getCurrentCycleIndex();
      if (!Number.isFinite(cycleIndex) || cycleIndex < 0) {
        return res.status(400).json({ message: "Invalid cycleIndex" });
      }
      const [managerRows] = await pool.query(
        `SELECT id FROM users
         WHERE role = 'design_manager' AND territorial_design_manager_id = ?`,
        [user.id],
      );
      const managerIds = (managerRows as { id: number }[]).map((row) => Number(row.id));
      const totals = await sumDesignerFortnightTotals(managerIds, cycleIndex);
      return res.json(totals);
    } catch (err) {
      console.error("[GET /api/incentives/tdm-totals] error", err);
      return res.status(500).json({ message: "Failed to load combined targets" });
    }
  });

  app.get("/api/incentives/branch-target", async (req: Request, res: Response) => {
    try {
      await resolveBranchTargetRequest(req, res, null);
    } catch (err) {
      console.error("[GET /api/incentives/branch-target] error", err);
      if (!res.headersSent) res.status(500).json({ message: "Failed to load branch target" });
    }
  });

  app.put("/api/incentives/branch-target", async (req: Request, res: Response) => {
    try {
      const submitted = Number((req.body || {}).minimumTarget);
      if (!Number.isFinite(submitted) || submitted < 0) {
        return res.status(400).json({ message: "Invalid minimum target" });
      }
      await resolveBranchTargetRequest(req, res, submitted);
    } catch (err) {
      console.error("[PUT /api/incentives/branch-target] error", err);
      if (!res.headersSent) res.status(500).json({ message: "Failed to update branch target" });
    }
  });
}
