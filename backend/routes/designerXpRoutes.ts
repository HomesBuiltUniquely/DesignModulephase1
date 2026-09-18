import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import {
  BADGE_TIERS,
  COMMERCIAL_XP_RULES,
  TASK_XP_RULES,
  calculateNetXp,
  findTaskRule,
  getBadgeForXp,
  getNextBadge,
} from "../constants/xpTaskRules";
import { extractTotalPayableAmount } from "./prolanceApi";

/**
 * Ensures the single database table `designer_xp_transactions` exists.
 * Does not modify or create any other tables.
 */
export async function ensureDesignerXpTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS designer_xp_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      designer_id INT NOT NULL,
      lead_id INT NULL,
      task_name VARCHAR(255) NULL,
      milestone_index INT NULL,
      transaction_type ENUM('task_completion', 'new_sale', 'upsell', 'manual_adjustment') NOT NULL,
      base_xp INT NOT NULL,
      penalty_xp INT NOT NULL DEFAULT 0,
      net_xp INT NOT NULL,
      delay_days INT NOT NULL DEFAULT 0,
      idempotency_key VARCHAR(255) NOT NULL,
      meta JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_xp_idempotency (idempotency_key),
      INDEX idx_designer_id (designer_id),
      INDEX idx_lead_id (lead_id),
      INDEX idx_created_at (created_at),
      CONSTRAINT fk_xp_designer FOREIGN KEY (designer_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

interface AwardTaskCompletionParams {
  leadId: number;
  milestoneIndex: number;
  taskName: string;
  completionDate?: Date;
}

/**
 * Server-authoritative task completion XP award engine.
 * Wrapped in non-fatal try/catch: XP calculation can NEVER disrupt the main task completion flow.
 */
export async function awardTaskCompletionXp(
  pool: Pool,
  params: AwardTaskCompletionParams,
): Promise<{ awarded: boolean; netXp?: number; reason?: string }> {
  try {
    const { leadId, milestoneIndex, taskName, completionDate = new Date() } = params;
    const rule = findTaskRule(milestoneIndex, taskName);

    // If task is not defined or is INACTIVE / DISABLED (Tasks 9–22), do not award XP
    if (!rule || !rule.isActive) {
      return { awarded: false, reason: "Rule is inactive or unconfirmed" };
    }

    // Resolve assigned designer from leads table
    const [leadRows] = await pool.query(
      `SELECT l.id, l.assigned_designer_id, l.create_at, l.payload,
              u.role as designerRole, u.name as designerName
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_designer_id
       WHERE l.id = ? LIMIT 1`,
      [leadId],
    );
    const lead = (leadRows as any[])[0];
    if (!lead || !lead.assigned_designer_id) {
      return { awarded: false, reason: "No designer assigned to this lead" };
    }
    if ((lead.designerRole || "").toLowerCase() !== "designer") {
      return { awarded: false, reason: "Assigned user is not a designer" };
    }

    const designerId = Number(lead.assigned_designer_id);

    // If task awards 0 XP (e.g. KT files upload excluded)
    if (rule.baseXp === 0) {
      return { awarded: true, netXp: 0 };
    }

    // Determine delay based on SLA baseline event
    let delayDays = 0;
    if (rule.slaDays != null && rule.slaDays > 0) {
      let baselineDate: Date | null = null;
      let payloadObj: any = {};
      try {
        payloadObj = typeof lead.payload === "string" ? JSON.parse(lead.payload) : lead.payload || {};
      } catch {
        payloadObj = {};
      }

      switch (rule.baselineType) {
        case "group_description_completed": {
          const [compRows] = await pool.query(
            `SELECT completed_at FROM lead_task_completions
             WHERE lead_id = ? AND milestone_index = 0 AND task_name IN ('Group Description', 'Group description update')
             ORDER BY id ASC LIMIT 1`,
            [leadId],
          );
          const comp = (compRows as any[])[0];
          if (comp?.completed_at) {
            baselineDate = new Date(comp.completed_at);
          } else {
            const approvedAt =
              payloadObj.sales_closure_finance_approved_at ||
              payloadObj.formData?.sales_closure_finance_approved_at;
            baselineDate = approvedAt ? new Date(approvedAt) : new Date(lead.create_at);
          }
          break;
        }
        case "sales_closure_approval": {
          const approvedAt =
            payloadObj.sales_closure_finance_approved_at ||
            payloadObj.formData?.sales_closure_finance_approved_at;
          baselineDate = approvedAt ? new Date(approvedAt) : new Date(lead.create_at);
          break;
        }
        case "d1_measurement_date": {
          const [d1Rows] = await pool.query(
            "SELECT measurement_date, created_at FROM lead_d1_assignments WHERE lead_id = ? ORDER BY id DESC LIMIT 1",
            [leadId],
          );
          const d1 = (d1Rows as any[])[0];
          if (d1?.measurement_date) {
            baselineDate = new Date(d1.measurement_date);
          } else if (d1?.created_at) {
            baselineDate = new Date(d1.created_at);
          } else {
            baselineDate = new Date(lead.create_at);
          }
          break;
        }
        case "d1_upload_approval": {
          const [compRows] = await pool.query(
            "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 0 AND task_name = 'D1 files upload' LIMIT 1",
            [leadId],
          );
          const comp = (compRows as any[])[0];
          baselineDate = comp?.completed_at ? new Date(comp.completed_at) : new Date(lead.create_at);
          break;
        }
        case "first_cut_meeting_completed": {
          const [compRows] = await pool.query(
            "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 1 AND task_name = 'meeting completed' LIMIT 1",
            [leadId],
          );
          const comp = (compRows as any[])[0];
          baselineDate = comp?.completed_at ? new Date(comp.completed_at) : new Date(lead.create_at);
          break;
        }
        case "dqc1_approval": {
          const [compRows] = await pool.query(
            "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 1 AND task_name = 'DQC 1 approval' LIMIT 1",
            [leadId],
          );
          const comp = (compRows as any[])[0];
          baselineDate = comp?.completed_at ? new Date(comp.completed_at) : new Date(lead.create_at);
          break;
        }
        case "payment_10p_uploaded": {
          const [compRows] = await pool.query(
            "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 2 AND task_name = '10% payment collection' LIMIT 1",
            [leadId],
          );
          const comp = (compRows as any[])[0];
          baselineDate = comp?.completed_at ? new Date(comp.completed_at) : new Date(lead.create_at);
          break;
        }
        case "payment_10p_approved": {
          const [compRows] = await pool.query(
            "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 2 AND task_name = '10% payment approval' LIMIT 1",
            [leadId],
          );
          const comp = (compRows as any[])[0];
          baselineDate = comp?.completed_at ? new Date(comp.completed_at) : new Date(lead.create_at);
          break;
        }
        case "d2_masking_date": {
          const [compRows] = await pool.query(
            "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 3 ORDER BY id DESC LIMIT 1",
            [leadId],
          );
          const comp = (compRows as any[])[0];
          baselineDate = comp?.completed_at ? new Date(comp.completed_at) : new Date(lead.create_at);
          break;
        }
        case "material_meeting_completed": {
          const [compRows] = await pool.query(
            "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 4 AND task_name = 'Material selection meeting completed' LIMIT 1",
            [leadId],
          );
          const comp = (compRows as any[])[0];
          baselineDate = comp?.completed_at ? new Date(comp.completed_at) : new Date(lead.create_at);
          break;
        }
        case "dqc2_submission": {
          const [compRows] = await pool.query(
            "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 4 AND task_name = 'DQC 2 submission' LIMIT 1",
            [leadId],
          );
          const comp = (compRows as any[])[0];
          baselineDate = comp?.completed_at ? new Date(comp.completed_at) : new Date(lead.create_at);
          break;
        }
        case "dqc2_approval": {
          const [compRows] = await pool.query(
            "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 4 AND (task_name = 'DQC 2 approval' OR task_name = 'DQC 2 approval ') LIMIT 1",
            [leadId],
          );
          const comp = (compRows as any[])[0];
          baselineDate = comp?.completed_at ? new Date(comp.completed_at) : new Date(lead.create_at);
          break;
        }
        case "payment_40p_approved": {
          const [compRows] = await pool.query(
            "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 5 AND task_name = '40% payment approval' LIMIT 1",
            [leadId],
          );
          const comp = (compRows as any[])[0];
          baselineDate = comp?.completed_at ? new Date(comp.completed_at) : new Date(lead.create_at);
          break;
        }
        case "production_approval": {
          const [compRows] = await pool.query(
            "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 6 AND task_name = 'Cx approval for production' LIMIT 1",
            [leadId],
          );
          const comp = (compRows as any[])[0];
          baselineDate = comp?.completed_at ? new Date(comp.completed_at) : new Date(lead.create_at);
          break;
        }
        default:
          baselineDate = null;
      }

      if (baselineDate && !isNaN(baselineDate.getTime())) {
        const expectedMs = baselineDate.getTime() + rule.slaDays * 24 * 60 * 60 * 1000;
        const actualMs = completionDate.getTime();
        if (actualMs > expectedMs) {
          delayDays = Math.floor((actualMs - expectedMs) / (24 * 60 * 60 * 1000));
        }
      }
    }

    const { penaltyXp, netXp } = calculateNetXp(rule.baseXp, delayDays);
    const idempotencyKey = `lead_${leadId}_m${milestoneIndex}_${rule.taskName.trim()}`;

    // Idempotent insertion using MySQL UNIQUE constraint
    await pool.query(
      `INSERT INTO designer_xp_transactions
        (designer_id, lead_id, task_name, milestone_index, transaction_type, base_xp, penalty_xp, net_xp, delay_days, idempotency_key, meta, created_at)
       VALUES (?, ?, ?, ?, 'task_completion', ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         base_xp = VALUES(base_xp),
         penalty_xp = VALUES(penalty_xp),
         net_xp = VALUES(net_xp),
         delay_days = VALUES(delay_days),
         meta = VALUES(meta)`,
      [
        designerId,
        leadId,
        rule.taskName,
        milestoneIndex,
        rule.baseXp,
        penaltyXp,
        netXp,
        delayDays,
        idempotencyKey,
        JSON.stringify({
          slaDays: rule.slaDays,
          delayDays,
          completionDate: completionDate.toISOString(),
        }),
        completionDate,
      ],
    );

    return { awarded: true, netXp };
  } catch (err: any) {
    console.error("[designer-xp] Error awarding task XP (non-fatal):", err);
    return { awarded: false, reason: err?.message };
  }
}

/**
 * Reconciles/syncs XP for any completed tasks of a lead by calling awardTaskCompletionXp
 * with the original completed_at timestamp.
 * This is non-fatal and idempotent.
 */
export async function reconcileLeadXp(
  pool: Pool,
  leadId: number,
): Promise<{ processed: number; awards: Array<{ taskName: string; netXp?: number; awarded: boolean; reason?: string }> }> {
  const [completions] = await pool.query(
    `SELECT milestone_index, task_name, completed_at
     FROM lead_task_completions
     WHERE lead_id = ?
     ORDER BY milestone_index ASC, completed_at ASC`,
    [leadId],
  );
  const rows = completions as Array<{ milestone_index: number; task_name: string; completed_at: Date }>;
  const awards: Array<{ taskName: string; netXp?: number; awarded: boolean; reason?: string }> = [];

  for (const row of rows) {
    const res = await awardTaskCompletionXp(pool, {
      leadId,
      milestoneIndex: Number(row.milestone_index),
      taskName: row.task_name,
      completionDate: new Date(row.completed_at),
    });
    awards.push({ taskName: row.task_name, netXp: res.netXp, awarded: res.awarded, reason: res.reason });
  }

  return { processed: rows.length, awards };
}

/**
 * Server-authoritative Commercial XP: New Sale (10 XP / Lakh).
 */
export async function awardSalesClosureXp(
  pool: Pool,
  params: { leadId: number; saleAmountInr: number },
): Promise<{ awarded: boolean; netXp?: number; reason?: string }> {
  try {
    const { leadId, saleAmountInr } = params;
    if (!COMMERCIAL_XP_RULES.newSale.isActive) {
      return { awarded: false, reason: "New sale XP rule is inactive" };
    }

    const [leadRows] = await pool.query(
      `SELECT l.id, l.assigned_designer_id, u.role as designerRole
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_designer_id
       WHERE l.id = ? LIMIT 1`,
      [leadId],
    );
    const lead = (leadRows as any[])[0];
    if (!lead || !lead.assigned_designer_id) {
      return { awarded: false, reason: "No designer assigned to this lead" };
    }
    if ((lead.designerRole || "").toLowerCase() !== "designer") {
      return { awarded: false, reason: "Assigned user is not a designer" };
    }

    const designerId = Number(lead.assigned_designer_id);
    const saleLakhs = Math.floor(Math.max(0, saleAmountInr) / 100000);
    const netXp = saleLakhs * COMMERCIAL_XP_RULES.newSale.xpPerLakh;

    if (netXp <= 0) {
      return { awarded: false, reason: "Sale amount yields 0 XP" };
    }

    const idempotencyKey = `lead_${leadId}_sales_closure`;

    await pool.query(
      `INSERT INTO designer_xp_transactions
        (designer_id, lead_id, task_name, milestone_index, transaction_type, base_xp, penalty_xp, net_xp, delay_days, idempotency_key, meta, created_at)
       VALUES (?, ?, 'New Sale Commercial Approval', NULL, 'new_sale', ?, 0, ?, 0, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE id = id`,
      [
        designerId,
        leadId,
        netXp,
        netXp,
        idempotencyKey,
        JSON.stringify({ saleAmountInr, saleLakhs }),
      ],
    );

    return { awarded: true, netXp };
  } catch (err: any) {
    console.error("[designer-xp] Error awarding sales closure XP (non-fatal):", err);
    return { awarded: false, reason: err?.message };
  }
}

/**
 * Resolves a quotation's total payable amount from stored snapshots or live Prolance.
 */
export async function resolveQuoteAmount(pool: Pool, quoteId: number): Promise<number | null> {
  if (!Number.isFinite(quoteId) || quoteId < 1) return null;

  try {
    const [rows] = await pool.query(
      "SELECT payload_json FROM lead_prolance_quote_snapshots WHERE quote_id = ? ORDER BY id DESC LIMIT 1",
      [quoteId],
    );
    const row = (rows as any[])[0];
    if (row?.payload_json) {
      const parsed = typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
      const amount = extractTotalPayableAmount(parsed);
      if (amount != null && Number.isFinite(amount) && amount > 0) {
        return amount;
      }
      const dataObj = parsed?.data || parsed;
      const fallback = Number(dataObj?.finalTotalPrice ?? dataObj?.totalPrice ?? dataObj?.totalPayableAmount);
      if (Number.isFinite(fallback) && fallback > 0) return fallback;
    }
  } catch (err) {
    console.error("[designer-xp] Error reading quote snapshot for amount:", err);
  }

  // Fallback: query Prolance public viewer endpoint locally
  try {
    const port = process.env.PORT || 3001;
    const res = await fetch(`http://127.0.0.1:${port}/api/prolance-test/public/quotes/view/${quoteId}`);
    if (res.ok) {
      const json = await res.json();
      const amount = extractTotalPayableAmount(json);
      if (amount != null && Number.isFinite(amount) && amount > 0) {
        return amount;
      }
      const dataObj = json?.data || json;
      const fallback = Number(dataObj?.finalTotalPrice ?? dataObj?.totalPrice ?? dataObj?.totalPayableAmount);
      if (Number.isFinite(fallback) && fallback > 0) return fallback;
    }
  } catch {
    /* non-fatal fallback */
  }

  return null;
}

/**
 * Server-authoritative Commercial XP: Quotation Revision Upselling / Downselling.
 * Rule: For every quotation revision, compare the current version with the immediately previous version.
 * - An increase awards +20 XP per complete ₹1 lakh increase.
 * - A decrease deducts −20 XP per complete ₹1 lakh decrease.
 */
export async function awardUpsellXp(
  pool: Pool,
  params: {
    leadId: number;
    previousAmountInr: number;
    newAmountInr: number;
    prevQuoteId?: number;
    currentQuoteId?: number;
  },
): Promise<{ awarded: boolean; netXp?: number; reason?: string }> {
  try {
    const { leadId, previousAmountInr, newAmountInr, prevQuoteId, currentQuoteId } = params;
    if (!COMMERCIAL_XP_RULES.upsell.isActive) {
      return { awarded: false, reason: "Upsell XP rule is inactive" };
    }

    const delta = newAmountInr - previousAmountInr;
    let completeLakhs = 0;
    let netXp = 0;
    let taskName = "Quotation Upsell Revision";
    let baseXp = 0;
    let penaltyXp = 0;

    if (delta >= 100000) {
      // Increase: +20 XP per complete ₹1 Lakh increase
      completeLakhs = Math.floor(delta / 100000);
      netXp = completeLakhs * COMMERCIAL_XP_RULES.upsell.xpPerLakh;
      taskName = "Quotation Upsell Revision";
      baseXp = netXp;
      penaltyXp = 0;
    } else if (delta <= -100000) {
      // Decrease: -20 XP per complete ₹1 Lakh decrease
      completeLakhs = Math.floor(Math.abs(delta) / 100000);
      netXp = -(completeLakhs * COMMERCIAL_XP_RULES.upsell.xpPerLakh);
      taskName = "Quotation Revision Deduction";
      baseXp = 0;
      penaltyXp = completeLakhs * COMMERCIAL_XP_RULES.upsell.xpPerLakh;
    } else {
      return { awarded: false, reason: "Revision delta is below 1 Lakh" };
    }

    const [leadRows] = await pool.query(
      `SELECT l.id, l.assigned_designer_id, u.role as designerRole
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_designer_id
       WHERE l.id = ? LIMIT 1`,
      [leadId],
    );
    const lead = (leadRows as any[])[0];
    if (!lead || !lead.assigned_designer_id) {
      return { awarded: false, reason: "No designer assigned to this lead" };
    }
    if ((lead.designerRole || "").toLowerCase() !== "designer") {
      return { awarded: false, reason: "Assigned user is not a designer" };
    }

    const designerId = Number(lead.assigned_designer_id);
    const idempotencyKey =
      prevQuoteId && currentQuoteId
        ? `lead_${leadId}_quote_rev_${prevQuoteId}_to_${currentQuoteId}`
        : `lead_${leadId}_upsell_${Math.round(newAmountInr)}`;

    await pool.query(
      `INSERT INTO designer_xp_transactions
        (designer_id, lead_id, task_name, milestone_index, transaction_type, base_xp, penalty_xp, net_xp, delay_days, idempotency_key, meta, created_at)
       VALUES (?, ?, ?, NULL, 'upsell', ?, ?, ?, 0, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE id = id`,
      [
        designerId,
        leadId,
        taskName,
        baseXp,
        penaltyXp,
        netXp,
        idempotencyKey,
        JSON.stringify({ previousAmountInr, newAmountInr, delta, prevQuoteId, currentQuoteId }),
      ],
    );

    return { awarded: true, netXp };
  } catch (err: any) {
    console.error("[designer-xp] Error awarding upsell/revision XP (non-fatal):", err);
    return { awarded: false, reason: err?.message };
  }
}

/**
 * Evaluates all sequential quotation revisions for a lead and awards/deducts XP.
 * Compares each version with its immediately previous version.
 */
export async function evaluateLeadQuotationRevisionXp(
  pool: Pool,
  leadId: number,
): Promise<{ processed: number; awards: Array<{ prevQuoteId: number; currentQuoteId: number; netXp: number }> }> {
  const awards: Array<{ prevQuoteId: number; currentQuoteId: number; netXp: number }> = [];
  try {
    const [verRows] = await pool.query(
      `SELECT quote_id, created_at
       FROM lead_prolance_quote_versions
       WHERE lead_id = ?
       ORDER BY created_at ASC, id ASC`,
      [leadId],
    );
    const versions = verRows as Array<{ quote_id: number; created_at: Date | string }>;
    if (!versions || versions.length < 2) {
      return { processed: 0, awards };
    }

    for (let i = 1; i < versions.length; i++) {
      const prevQuoteId = Number(versions[i - 1].quote_id);
      const currentQuoteId = Number(versions[i].quote_id);
      if (prevQuoteId === currentQuoteId) continue;

      const previousAmountInr = await resolveQuoteAmount(pool, prevQuoteId);
      const newAmountInr = await resolveQuoteAmount(pool, currentQuoteId);

      if (
        previousAmountInr != null &&
        newAmountInr != null &&
        previousAmountInr > 0 &&
        newAmountInr > 0
      ) {
        const res = await awardUpsellXp(pool, {
          leadId,
          previousAmountInr,
          newAmountInr,
          prevQuoteId,
          currentQuoteId,
        });
        if (res.awarded && res.netXp !== undefined) {
          awards.push({ prevQuoteId, currentQuoteId, netXp: res.netXp });
        }
      }
    }

    return { processed: versions.length - 1, awards };
  } catch (err) {
    console.error(`[designer-xp] Error evaluating quotation revision XP for lead ${leadId}:`, err);
    return { processed: 0, awards };
  }
}

/**
 * Registers the EXACT 3 APPROVED XP APIs
 */
export function registerDesignerXpRoutes(
  app: Express,
  deps: {
    pool: Pool;
    getUserFromSession: (req: Request) => Promise<any>;
  },
): void {
  const { pool, getUserFromSession } = deps;

  // -------------------------------------------------------------------------
  // 1. GET /api/xp/lead/:id/summary
  //    Project Tracker bottom bar and milestone-level XP chips on /Leads/[id]
  // -------------------------------------------------------------------------
  app.get("/api/xp/lead/:id/summary", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);

      const leadId = Number(req.params.id);
      if (!leadId) return res.status(400).json({ message: "Invalid lead ID" });

      const [leadRows] = await pool.query(
        `SELECT l.id, l.pid, l.project_name, l.assigned_designer_id,
                u.name as designerName, u.email as designerEmail, u.sub_role as subRole
         FROM leads l
         LEFT JOIN users u ON u.id = l.assigned_designer_id
         WHERE l.id = ? LIMIT 1`,
        [leadId],
      );
      const lead = (leadRows as any[])[0];
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      const designerId = lead.assigned_designer_id ? Number(lead.assigned_designer_id) : null;

      // Non-fatal quotation revision XP check
      if (designerId) {
        await evaluateLeadQuotationRevisionXp(pool, leadId).catch((err) => {
          console.error("[designer-xp] Error evaluating revision XP in summary:", err);
        });
      }

      // Calculate designer's lifetime XP and rank
      let designerCurrentXp = 0;
      let designerRank = 1;
      if (designerId) {
        const [designerXpRows] = await pool.query(
          "SELECT COALESCE(SUM(net_xp), 0) as totalXp FROM designer_xp_transactions WHERE designer_id = ?",
          [designerId],
        );
        designerCurrentXp = Number((designerXpRows as any[])[0]?.totalXp || 0);

        const [rankRows] = await pool.query(
          `SELECT COUNT(*) + 1 as designer_rank
           FROM (
             SELECT designer_id, SUM(net_xp) as totalXp
             FROM designer_xp_transactions
             GROUP BY designer_id
             HAVING totalXp > ?
           ) t`,
          [designerCurrentXp],
        );
        designerRank = Number((rankRows as any[])[0]?.designer_rank || 1);
      }

      const badge = getBadgeForXp(designerCurrentXp);
      const nextBadge = getNextBadge(badge.levelNum);

      let progressPct = 100;
      let xpToNextLevel = 0;
      if (nextBadge) {
        const tierSpan = nextBadge.minXp - badge.minXp;
        const currentProgress = designerCurrentXp - badge.minXp;
        progressPct = Math.min(100, Math.max(0, Math.round((currentProgress / tierSpan) * 100)));
        xpToNextLevel = Math.max(0, nextBadge.minXp - designerCurrentXp);
      }

      // Query XP transactions specifically earned on this lead
      const [leadXpRows] = await pool.query(
        "SELECT task_name, milestone_index, base_xp, penalty_xp, net_xp, delay_days FROM designer_xp_transactions WHERE lead_id = ?",
        [leadId],
      );
      const leadTransactions = leadXpRows as any[];
      const completedProjectXp = leadTransactions.reduce((sum, r) => sum + Number(r.net_xp || 0), 0);

      // Query existing completions for this lead to know which tasks are finished
      const [compRows] = await pool.query(
        "SELECT milestone_index, task_name, completed_at FROM lead_task_completions WHERE lead_id = ?",
        [leadId],
      );
      const completedSet = new Map<string, { completedAt: string }>();
      (compRows as any[]).forEach((c) => {
        completedSet.set(`${c.milestone_index}::${c.task_name.trim().toLowerCase()}`, {
          completedAt: c.completed_at,
        });
      });

      // Map milestone breakdown across all 8 milestones
      const milestonesMap = new Map<number, {
        milestoneIndex: number;
        milestoneName: string;
        totalPossibleXp: number;
        earnedXp: number;
        tasks: Array<{
          taskName: string;
          aliases?: string[];
          baseXp: number;
          earnedXp: number | null;
          status: "completed" | "current" | "pending";
          isDelayed: boolean;
          delayDays: number;
          tag: string;
          isActive: boolean;
        }>;
      }>();

      let totalPossibleProjectXp = 0;

      TASK_XP_RULES.forEach((rule) => {
        if (!milestonesMap.has(rule.milestoneIndex)) {
          milestonesMap.set(rule.milestoneIndex, {
            milestoneIndex: rule.milestoneIndex,
            milestoneName: rule.milestoneName,
            totalPossibleXp: 0,
            earnedXp: 0,
            tasks: [],
          });
        }
        const m = milestonesMap.get(rule.milestoneIndex)!;
        if (rule.isActive && rule.baseXp > 0) {
          m.totalPossibleXp += rule.baseXp;
          totalPossibleProjectXp += rule.baseXp;
        }

        const compKey = `${rule.milestoneIndex}::${rule.taskName.trim().toLowerCase()}`;
        let isCompleted = completedSet.has(compKey);
        if (!isCompleted && rule.aliases) {
          for (const alias of rule.aliases) {
            if (completedSet.has(`${rule.milestoneIndex}::${alias.trim().toLowerCase()}`)) {
              isCompleted = true;
              break;
            }
          }
        }

        const tx = leadTransactions.find((t) => {
          if (t.milestone_index !== rule.milestoneIndex) return false;
          const tName = (t.task_name || "").trim().toLowerCase();
          if (tName === rule.taskName.trim().toLowerCase()) return true;
          if (rule.aliases && rule.aliases.some((a) => a.trim().toLowerCase() === tName)) return true;
          return false;
        });

        let status: "completed" | "current" | "pending" = "pending";
        let tag = "PENDING";
        let earnedXp: number | null = null;
        let isDelayed = false;
        let delayDays = 0;

        if (isCompleted) {
          status = "completed";
          delayDays = tx ? Number(tx.delay_days || 0) : 0;
          isDelayed = delayDays > 0;
          tag = isDelayed ? "DELAYED" : "ON-TIME";
          earnedXp = tx ? Number(tx.net_xp) : null;
          if (tx && rule.isActive && rule.baseXp > 0) {
            m.earnedXp += Number(tx.net_xp || 0);
          }
        }

        m.tasks.push({
          taskName: rule.taskName,
          aliases: rule.aliases || [],
          baseXp: rule.baseXp,
          earnedXp,
          status,
          isDelayed,
          delayDays,
          tag,
          isActive: rule.isActive && rule.baseXp > 0,
        });
      });

      return res.json({
        leadId,
        designerId,
        designerName: lead.designerName || null,
        designerEmail: lead.designerEmail || null,
        currentLevel: badge.name,
        currentLevelNum: badge.levelNum,
        badgeKey: badge.badgeKey,
        currentXp: designerCurrentXp,
        nextLevel: nextBadge?.name || null,
        nextLevelXp: nextBadge?.minXp || null,
        xpToNextLevel,
        progressPct,
        rank: designerRank,
        projectXp: completedProjectXp,
        totalPossibleProjectXp,
        completedProjectXp,
        milestones: Array.from(milestonesMap.values()).sort((a, b) => a.milestoneIndex - b.milestoneIndex),
      });
    } catch (err: any) {
      console.error("[designer-xp] /lead/:id/summary error:", {
        message: err?.message,
        code: err?.code,
        sqlState: err?.sqlState,
        sql: err?.sql,
        stack: err?.stack,
      });
      return res.status(500).json({ message: "Failed to load lead XP summary", error: process.env.NODE_ENV === 'development' ? err?.message : undefined });
    }
  });

  // -------------------------------------------------------------------------
  // 2. GET /api/xp/leaderboard
  //    Main designer leaderboard table with search, sort, and pagination
  // -------------------------------------------------------------------------
  app.get("/api/xp/leaderboard", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      const userRole = (user?.role || "").toLowerCase();
      const allowedRoles = [
        "admin",
        "super_admin",
        "superadmin",
        "territorial_design_manager",
        "design_manager",
        "designer",
      ];
      if (!user || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          message: "Leaderboard is available to territorial design manager, design manager, designers, and admin only",
        });
      }

      const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
      const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy.toLowerCase() : "xp";
      const order = typeof req.query.order === "string" && req.query.order.toLowerCase() === "asc" ? "asc" : "desc";
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));

      // Query all users where role = 'designer'
      const [designerRows] = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.sub_role as subRole, u.profileImage, u.branch,
                COALESCE(xp.totalXp, 0) as currentXp,
                COALESCE(proj.projectCount, 0) as projectsCount,
                COALESCE(ontime.onTimeCount, 0) as onTimeTasksCount,
                COALESCE(ontime.totalTasksCount, 0) as totalTasksCount
         FROM users u
         LEFT JOIN (
           SELECT designer_id, SUM(net_xp) as totalXp
           FROM designer_xp_transactions
           GROUP BY designer_id
         ) xp ON xp.designer_id = u.id
         LEFT JOIN (
           SELECT assigned_designer_id, COUNT(*) as projectCount
           FROM leads
           GROUP BY assigned_designer_id
         ) proj ON proj.assigned_designer_id = u.id
         LEFT JOIN (
           SELECT designer_id,
                  COUNT(CASE WHEN delay_days = 0 THEN 1 END) as onTimeCount,
                  COUNT(*) as totalTasksCount
           FROM designer_xp_transactions
           WHERE transaction_type = 'task_completion'
           GROUP BY designer_id
         ) ontime ON ontime.designer_id = u.id
         WHERE LOWER(u.role) = 'designer'`,
      );

      let designers = (designerRows as any[]).map((d) => {
        const currentXp = Number(d.currentXp || 0);
        const badge = getBadgeForXp(currentXp);
        const nextBadge = getNextBadge(badge.levelNum);

        let progressPct = 100;
        let xpToNextLevel = 0;
        if (nextBadge) {
          const span = nextBadge.minXp - badge.minXp;
          const prog = currentXp - badge.minXp;
          progressPct = Math.min(100, Math.max(0, Math.round((prog / span) * 100)));
          xpToNextLevel = Math.max(0, nextBadge.minXp - currentXp);
        }

        const totalTasks = Number(d.totalTasksCount || 0);
        const onTimeTasks = Number(d.onTimeTasksCount || 0);
        const onTimeDeliveryPct = totalTasks > 0 ? Math.round((onTimeTasks / totalTasks) * 1000) / 10 : 100.0;

        return {
          id: Number(d.id),
          name: d.name || "Unnamed Designer",
          email: d.email,
          role: "designer",
          subRole: d.subRole || "Interior Designer",
          profileImage: d.profileImage || null,
          branch: d.branch || null,
          isOnline: true,
          currentXp,
          level: badge.name,
          levelNum: badge.levelNum,
          badgeKey: badge.badgeKey,
          nextLevel: nextBadge?.name || null,
          nextLevelXp: nextBadge?.minXp || null,
          xpToNextLevel,
          progressPct,
          projectsCount: Number(d.projectsCount || 0),
          rating: null, // Confirmed: N/A until genuine rating source exists
          ratingFormatted: "N/A",
          onTimeDeliveryPct,
        };
      });

      // Filter by search string
      if (search) {
        designers = designers.filter(
          (d) =>
            d.name.toLowerCase().includes(search) ||
            d.email.toLowerCase().includes(search) ||
            (d.subRole && d.subRole.toLowerCase().includes(search)),
        );
      }

      // Sort by chosen metric
      designers.sort((a, b) => {
        let diff = 0;
        if (sortBy === "projects") {
          diff = a.projectsCount - b.projectsCount;
        } else {
          // default: xp
          diff = a.currentXp - b.currentXp;
        }
        return order === "asc" ? diff : -diff;
      });

      // Assign ranks after sorting by XP
      designers = designers.map((d, index) => ({
        ...d,
        rank: index + 1,
      }));

      const total = designers.length;
      const paginatedDesigners = designers.slice((page - 1) * limit, page * limit);

      return res.json({
        total,
        page,
        limit,
        designers: paginatedDesigners,
      });
    } catch (err: any) {
      console.error("[designer-xp] /leaderboard error:", {
        message: err?.message,
        code: err?.code,
        sqlState: err?.sqlState,
        sql: err?.sql,
        stack: err?.stack,
      });
      return res.status(500).json({ message: "Failed to load leaderboard", error: process.env.NODE_ENV === 'development' ? err?.message : undefined });
    }
  });

  // -------------------------------------------------------------------------
  // 3. GET /api/xp/designer/:id
  //    Consolidated Single Endpoint for Drawer: Overview, Projects, Achievements, Activity
  // -------------------------------------------------------------------------
  app.get("/api/xp/designer/:id", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      const userRole = (user?.role || "").toLowerCase();
      const allowedRoles = [
        "admin",
        "super_admin",
        "superadmin",
        "territorial_design_manager",
        "design_manager",
        "designer",
      ];
      if (!user || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          message: "Designer XP details are available to territorial design manager, design manager, designers, and admin only",
        });
      }

      const designerId = Number(req.params.id);
      if (!designerId) return res.status(400).json({ message: "Invalid designer ID" });

      // Verify user is a designer
      const [userRows] = await pool.query(
        "SELECT id, name, email, role, sub_role as subRole, profileImage, branch FROM users WHERE id = ? LIMIT 1",
        [designerId],
      );
      const designer = (userRows as any[])[0];
      if (!designer || (designer.role || "").toLowerCase() !== "designer") {
        return res.status(404).json({ message: "Designer not found" });
      }

      // Compute lifetime total XP from transactions
      const [txRows] = await pool.query(
        `SELECT id, lead_id, task_name, milestone_index, transaction_type, base_xp, penalty_xp, net_xp, delay_days, meta, created_at
         FROM designer_xp_transactions
         WHERE designer_id = ?
         ORDER BY created_at DESC`,
        [designerId],
      );
      const transactions = txRows as any[];
      const currentXp = transactions.reduce((sum, tx) => sum + Number(tx.net_xp || 0), 0);

      // Rank calculation
      const [rankRows] = await pool.query(
        `SELECT COUNT(*) + 1 as designer_rank
         FROM (
           SELECT designer_id, SUM(net_xp) as totalXp
           FROM designer_xp_transactions
           GROUP BY designer_id
           HAVING totalXp > ?
         ) t`,
        [currentXp],
      );
      const rank = Number((rankRows as any[])[0]?.designer_rank || 1);

      const badge = getBadgeForXp(currentXp);
      const nextBadge = getNextBadge(badge.levelNum);

      let progressPct = 100;
      let xpToNextLevel = 0;
      if (nextBadge) {
        const span = nextBadge.minXp - badge.minXp;
        const prog = currentXp - badge.minXp;
        progressPct = Math.min(100, Math.max(0, Math.round((prog / span) * 100)));
        xpToNextLevel = Math.max(0, nextBadge.minXp - currentXp);
      }

      // Category breakdown
      let projectCompletions = 0;
      let clientApprovals = 0;
      let onTimeDelivery = 0;
      let salesXp = 0;
      let upsellXp = 0;

      let taskCount = 0;
      let onTimeTaskCount = 0;

      transactions.forEach((tx) => {
        const net = Number(tx.net_xp || 0);
        const delay = Number(tx.delay_days || 0);
        const taskNameLower = (tx.task_name || "").toLowerCase();

        if (tx.transaction_type === "task_completion") {
          taskCount++;
          if (delay === 0) {
            onTimeTaskCount++;
            onTimeDelivery += net;
          }
          if (taskNameLower.includes("approval") || taskNameLower.includes("dqc")) {
            clientApprovals += net;
          } else {
            projectCompletions += net;
          }
        } else if (tx.transaction_type === "new_sale") {
          salesXp += net;
        } else if (tx.transaction_type === "upsell") {
          upsellXp += net;
        }
      });

      const onTimeDeliveryPct = taskCount > 0 ? Math.round((onTimeTaskCount / taskCount) * 1000) / 10 : 100.0;

      // Projects list with earned XP
      const [projRows] = await pool.query(
        `SELECT l.id, l.pid, l.project_name as projectName, l.project_stage as projectStage,
                COALESCE(SUM(t.net_xp), 0) as earnedXp,
                COUNT(CASE WHEN t.delay_days = 0 THEN 1 END) as onTimeTasks,
                COUNT(CASE WHEN t.delay_days > 0 THEN 1 END) as delayedTasks
         FROM leads l
         LEFT JOIN designer_xp_transactions t ON t.lead_id = l.id AND t.designer_id = ?
         WHERE l.assigned_designer_id = ?
         GROUP BY l.id
         ORDER BY l.update_at DESC`,
        [designerId, designerId],
      );
      const projects = (projRows as any[]).map((p) => ({
        id: Number(p.id),
        pid: p.pid || `HUB-${p.id}`,
        projectName: p.projectName || "Unnamed Project",
        projectStage: p.projectStage || "KT",
        status: p.projectStage === "PUSH_TO_PRODUCTION" ? "Completed" : "In Progress",
        earnedXp: Number(p.earnedXp || 0),
        onTimeTasks: Number(p.onTimeTasks || 0),
        delayedTasks: Number(p.delayedTasks || 0),
      }));

      // Achievements: 8 badge cards
      const achievements = BADGE_TIERS.map((tier) => {
        const isUnlocked = currentXp >= tier.minXp;
        let unlockedAt: string | null = null;
        if (isUnlocked && tier.minXp === 0) {
          unlockedAt = transactions[transactions.length - 1]?.created_at || new Date().toISOString();
        } else if (isUnlocked) {
          // Find earliest transaction when cumulative XP crossed minXp
          let runningXp = 0;
          for (let i = transactions.length - 1; i >= 0; i--) {
            runningXp += Number(transactions[i].net_xp || 0);
            if (runningXp >= tier.minXp) {
              unlockedAt = transactions[i].created_at;
              break;
            }
          }
        }
        return {
          id: `badge_${tier.badgeKey}`,
          title: tier.name,
          badgeKey: tier.badgeKey,
          minXp: tier.minXp,
          levelNum: tier.levelNum,
          isUnlocked,
          unlockedAt,
        };
      });

      // Activity: recent 25 transactions with readable descriptions
      const [leadMapRows] = await pool.query("SELECT id, project_name as projectName FROM leads");
      const leadNameMap = new Map<number, string>();
      (leadMapRows as any[]).forEach((l) => leadNameMap.set(Number(l.id), l.projectName));

      const activity = transactions.slice(0, 25).map((tx) => {
        const projectName = tx.lead_id ? leadNameMap.get(Number(tx.lead_id)) || `Lead #${tx.lead_id}` : "System";
        let description = "";
        if (tx.transaction_type === "task_completion") {
          description = `Completed ${tx.task_name} ${tx.delay_days > 0 ? `(${tx.delay_days}d delay)` : "on-time"} (+${tx.net_xp} XP)`;
        } else if (tx.transaction_type === "new_sale") {
          description = `New Sale Commercial Approval (+${tx.net_xp} XP)`;
        } else if (tx.transaction_type === "upsell") {
          const net = Number(tx.net_xp || 0);
          description = net >= 0 ? `Quotation Upsell Revision (+${net} XP)` : `Quotation Revision Deduction (${net} XP)`;
        } else {
          description = `XP Adjustment (+${tx.net_xp} XP)`;
        }

        return {
          id: Number(tx.id),
          leadId: tx.lead_id ? Number(tx.lead_id) : null,
          projectName,
          transactionType: tx.transaction_type,
          taskName: tx.task_name || null,
          baseXp: Number(tx.base_xp || 0),
          penaltyXp: Number(tx.penalty_xp || 0),
          netXp: Number(tx.net_xp || 0),
          delayDays: Number(tx.delay_days || 0),
          description,
          createdAt: tx.created_at,
        };
      });

      return res.json({
        designer: {
          id: Number(designer.id),
          name: designer.name || "Designer",
          email: designer.email,
          designation: designer.subRole || "Interior Designer",
          profileImage: designer.profileImage || null,
          branch: designer.branch || null,
          isOnline: true,
        },
        gamification: {
          currentXp,
          level: badge.name,
          levelNum: badge.levelNum,
          badgeKey: badge.badgeKey,
          nextLevel: nextBadge?.name || null,
          nextLevelXp: nextBadge?.minXp || null,
          xpToNextLevel,
          progressPct,
          projectsCount: projects.length,
          clientRating: null, // Confirmed: N/A
          clientRatingFormatted: "N/A",
          onTimeDeliveryPct,
          rank,
        },
        breakdown: {
          projectCompletions,
          clientApprovals,
          onTimeDelivery,
          clientRatings: 0,
          referrals: 0,
          trainingOthers: 0,
          salesXp,
          upsellXp,
        },
        projects,
        achievements,
        activity,
      });
    } catch (err: any) {
      console.error("[designer-xp] /designer/:id error:", {
        message: err?.message,
        code: err?.code,
        sqlState: err?.sqlState,
        sql: err?.sql,
        stack: err?.stack,
      });
      return res.status(500).json({ message: "Failed to load designer details", error: process.env.NODE_ENV === 'development' ? err?.message : undefined });
    }
  });
}
