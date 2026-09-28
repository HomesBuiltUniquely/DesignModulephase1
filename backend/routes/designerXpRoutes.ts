import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import {
  BADGE_TIERS,
  COMMERCIAL_XP_RULES,
  TASK_XP_RULES,
  WORKFLOW_XP_RULES,
  findWorkflowRule,
  matchWorkflowStep,
  TOTAL_POSSIBLE_WORKFLOW_XP,
  calculateWorkflowNetXp,
  calculateNetXp,
  findTaskRule,
  getBadgeForXp,
  getNextBadge,
  getTaskSlaHours,
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
      transaction_type ENUM('task_completion', 'workflow_completion', 'new_sale', 'upsell', 'manual_adjustment') NOT NULL,
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

export interface AwardWorkflowParams {
  leadId: number;
  milestoneIndex: number;
  forceDate?: Date;
}

/**
 * Server-authoritative workflow completion XP award engine.
 * STRICT BUSINESS RULES:
 * 1. XP is for DESIGNER performance only.
 * 2. XP is awarded ONLY AFTER THE COMPLETE WORKFLOW IS COMPLETED.
 * 3. Never award XP for partial or individual steps.
 * 4. Total workflow allowed days:
 *    - Milestone 0 (D1 Site Measurement): 4 days -> +5 XP
 *    - Milestone 1 (DQC 1): 3 days -> +10 XP
 *    - Milestone 2 (10% Payment): 3 days -> +10 XP
 *    - Milestone 3 (D2 Site Masking): 2 days -> +10 XP
 *    - Milestone 4 (DQC 2): 2 days -> +10 XP
 *    - Milestone 5 (40% Payment): 1 day -> +15 XP
 *    - Milestone 6 (Push to Production): 2 days -> +5 XP
 *    Total Possible = 65 XP.
 * 5. Overdue penalty: If complete workflow finishes after allowed time:
 *    - On-time base XP is NOT awarded.
 *    - Delay penalty = overdueDays * 2 = negative points.
 *    - Net XP = -penalty.
 * 6. Idempotency: Unique key `lead_${leadId}_workflow_m${milestoneIndex}` guarantees exactly once award.
 */
export async function evaluateAndAwardWorkflowXp(
  pool: Pool,
  params: AwardWorkflowParams,
): Promise<{
  completed: boolean;
  awarded: boolean;
  netXp?: number;
  baseXp?: number;
  penaltyXp?: number;
  isDelayed?: boolean;
  overdueDays?: number;
  reason?: string;
}> {
  try {
    const { leadId, milestoneIndex, forceDate } = params;
    const workflow = findWorkflowRule(milestoneIndex);
    if (!workflow) {
      return { completed: false, awarded: false, reason: `No workflow rule for milestone index ${milestoneIndex}` };
    }

    // 1. Resolve assigned designer from leads table
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
      return { completed: false, awarded: false, reason: "No designer assigned to this lead" };
    }
    if ((lead.designerRole || "").toLowerCase() !== "designer") {
      return { completed: false, awarded: false, reason: "Assigned user is not a designer" };
    }

    const designerId = Number(lead.assigned_designer_id);

    // 2. Query completed tasks for this lead in this milestone
    const [compRows] = await pool.query(
      `SELECT task_name, completed_at
       FROM lead_task_completions
       WHERE lead_id = ? AND milestone_index = ?`,
      [leadId, milestoneIndex],
    );
    const completedTasks = compRows as Array<{ task_name: string; completed_at: Date | string }>;

    // 3. Verify ALL required workflow steps are completed
    const stepCompletionTimes: number[] = [];
    for (const step of workflow.steps) {
      const match = completedTasks.find((c) => matchWorkflowStep(step, c.task_name));
      if (!match || !match.completed_at) {
        // INCOMPLETE WORKFLOW:
        // Do NOT award XP.
        // Clean up any premature or legacy transactions for this workflow/milestone on this lead
        await pool.query(
          `DELETE FROM designer_xp_transactions
           WHERE lead_id = ? AND milestone_index = ? AND transaction_type IN ('workflow_completion', 'task_completion')`,
          [leadId, milestoneIndex],
        );
        return {
          completed: false,
          awarded: false,
          netXp: 0,
          reason: `Workflow incomplete: missing step '${step.stepName}'`,
        };
      }
      stepCompletionTimes.push(new Date(match.completed_at).getTime());
    }

    // ALL steps are completed!
    const workflowCompletedAt = forceDate || new Date(Math.max(...stepCompletionTimes));

    // 4. Determine workflow start time
    let payloadObj: any = {};
    try {
      payloadObj = typeof lead.payload === "string" ? JSON.parse(lead.payload) : lead.payload || {};
    } catch {
      payloadObj = {};
    }

    let workflowStartTime: Date | null = null;
    if (milestoneIndex === 0) {
      // Milestone 0 start: check KT transfer upload or 10-20% entry / sales closure approval
      const [m7Rows] = await pool.query(
        "SELECT completed_at FROM lead_task_completions WHERE lead_id = ? AND milestone_index = 7 AND task_name = 'Upload KT files' LIMIT 1",
        [leadId],
      );
      const m7 = (m7Rows as any[])[0];
      if (m7?.completed_at) {
        workflowStartTime = new Date(m7.completed_at);
      } else {
        const enteredAt =
          payloadObj.entered_1020_at ||
          payloadObj.sales_closure_finance_approved_at ||
          lead.create_at;
        workflowStartTime = enteredAt ? new Date(enteredAt) : new Date(lead.create_at);
      }
    } else {
      // For milestone N (1..6), start anchor is the completion of previous milestone!
      const prevMilestoneIndex = milestoneIndex === 1 ? 0 : milestoneIndex - 1;
      const [prevComps] = await pool.query(
        `SELECT completed_at FROM lead_task_completions
         WHERE lead_id = ? AND milestone_index = ?
         ORDER BY completed_at DESC LIMIT 1`,
        [leadId, prevMilestoneIndex],
      );
      const prev = (prevComps as any[])[0];
      if (prev?.completed_at) {
        workflowStartTime = new Date(prev.completed_at);
      } else {
        // Fallback: earliest task completion in this milestone
        workflowStartTime = new Date(Math.min(...stepCompletionTimes));
      }
    }

    if (!workflowStartTime || isNaN(workflowStartTime.getTime())) {
      workflowStartTime = new Date(Math.min(...stepCompletionTimes));
    }

    // 5. Calculate elapsed time vs total allowed time
    const startMs = workflowStartTime.getTime();
    const endMs = workflowCompletedAt.getTime();
    const elapsedMs = Math.max(0, endMs - startMs);
    const allowedMs = workflow.totalAllowedDays * 24 * 60 * 60 * 1000;

    let isDelayed = false;
    let overdueDays = 0;

    if (elapsedMs > allowedMs) {
      isDelayed = true;
      const diffMs = elapsedMs - allowedMs;
      overdueDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    }

    // 6. Calculate Net XP:
    // If on-time: base_xp = rewardXp, penalty_xp = 0, net_xp = rewardXp
    // If overdue: base_xp = 0, penalty_xp = overdueDays * 2, net_xp = -penalty_xp
    const { base_xp, penalty_xp, net_xp } = calculateWorkflowNetXp(
      workflow.rewardXp,
      isDelayed,
      overdueDays,
    );

    const idempotencyKey = `lead_${leadId}_workflow_m${milestoneIndex}`;

    // Clean up any legacy task_completion transactions for this milestone
    await pool.query(
      `DELETE FROM designer_xp_transactions
       WHERE lead_id = ? AND milestone_index = ? AND transaction_type = 'task_completion'`,
      [leadId, milestoneIndex],
    );

    // 7. Idempotent insertion using MySQL UNIQUE KEY (idempotency_key)
    await pool.query(
      `INSERT INTO designer_xp_transactions
        (designer_id, lead_id, task_name, milestone_index, transaction_type, base_xp, penalty_xp, net_xp, delay_days, idempotency_key, meta, created_at)
       VALUES (?, ?, ?, ?, 'workflow_completion', ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         designer_id = VALUES(designer_id),
         task_name = VALUES(task_name),
         milestone_index = VALUES(milestone_index),
         transaction_type = VALUES(transaction_type),
         base_xp = VALUES(base_xp),
         penalty_xp = VALUES(penalty_xp),
         net_xp = VALUES(net_xp),
         delay_days = VALUES(delay_days),
         meta = VALUES(meta),
         created_at = VALUES(created_at)`,
      [
        designerId,
        leadId,
        workflow.workflowName,
        milestoneIndex,
        base_xp,
        penalty_xp,
        net_xp,
        overdueDays,
        idempotencyKey,
        JSON.stringify({
          workflowId: workflow.workflowId,
          totalAllowedDays: workflow.totalAllowedDays,
          elapsedDays: Number((elapsedMs / (24 * 60 * 60 * 1000)).toFixed(2)),
          overdueDays,
          isDelayed,
          startTime: workflowStartTime.toISOString(),
          completionTime: workflowCompletedAt.toISOString(),
        }),
        workflowCompletedAt,
      ],
    );

    return {
      completed: true,
      awarded: true,
      netXp: net_xp,
      baseXp: base_xp,
      penaltyXp: penalty_xp,
      isDelayed,
      overdueDays,
    };
  } catch (err: any) {
    console.error("[designer-xp] Error evaluating workflow XP (non-fatal):", err);
    return { completed: false, awarded: false, reason: err?.message };
  }
}

interface AwardTaskCompletionParams {
  leadId: number;
  milestoneIndex: number;
  taskName: string;
  completionDate?: Date;
}

/**
 * Server-authoritative task completion hook.
 * When any task completes, evaluate the workflow for that milestone.
 * Wrapped in non-fatal try/catch: XP calculation can NEVER disrupt the main task completion flow.
 */
export async function awardTaskCompletionXp(
  pool: Pool,
  params: AwardTaskCompletionParams,
): Promise<{ awarded: boolean; netXp?: number; reason?: string }> {
  try {
    const { leadId, milestoneIndex } = params;
    const res = await evaluateAndAwardWorkflowXp(pool, { leadId, milestoneIndex });
    return {
      awarded: res.awarded,
      netXp: res.netXp,
      reason: res.reason,
    };
  } catch (err: any) {
    console.error("[designer-xp] Error in awardTaskCompletionXp (non-fatal):", err);
    return { awarded: false, reason: err?.message };
  }
}

/**
 * Reconciles/syncs XP for all workflows of a lead.
 * 1. Purges any legacy task_completion rows.
 * 2. Evaluates all 7 workflows.
 * This is non-fatal and idempotent.
 */
export async function reconcileLeadXp(
  pool: Pool,
  leadId: number,
): Promise<{
  processed: number;
  awards: Array<{ milestoneIndex: number; workflowName: string; netXp?: number; awarded: boolean; reason?: string }>;
}> {
  // 1. Purge legacy task_completion transactions
  await pool.query(
    "DELETE FROM designer_xp_transactions WHERE lead_id = ? AND transaction_type = 'task_completion'",
    [leadId],
  );

  // 2. Evaluate all 7 workflows (milestones 0 through 6)
  const awards: Array<{ milestoneIndex: number; workflowName: string; netXp?: number; awarded: boolean; reason?: string }> = [];
  for (const wf of WORKFLOW_XP_RULES) {
    const res = await evaluateAndAwardWorkflowXp(pool, {
      leadId,
      milestoneIndex: wf.milestoneIndex,
    });
    awards.push({
      milestoneIndex: wf.milestoneIndex,
      workflowName: wf.workflowName,
      netXp: res.netXp,
      awarded: res.awarded,
      reason: res.reason,
    });
  }

  return { processed: WORKFLOW_XP_RULES.length, awards };
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

const ADMIN_ROLES = ["admin", "super_admin", "superadmin"];

function isRoleAdmin(role?: string | null): boolean {
  return ADMIN_ROLES.includes((role || "").toLowerCase().trim());
}

function isRoleTDM(role?: string | null): boolean {
  const r = (role || "").toLowerCase().trim();
  return r === "territorial_design_manager" || r === "tdm";
}

function isRoleDesignManager(role?: string | null): boolean {
  return (role || "").toLowerCase().trim() === "design_manager";
}

function isRoleDesigner(role?: string | null): boolean {
  return (role || "").toLowerCase().trim() === "designer";
}

async function canViewDesignerXp(
  viewer: { id: number; role?: string | null },
  targetDesignerId: number,
  pool: Pool,
): Promise<boolean> {
  const viewerRole = viewer.role;
  if (isRoleAdmin(viewerRole)) {
    return true;
  }
  if (isRoleDesigner(viewerRole)) {
    return Number(viewer.id) === Number(targetDesignerId);
  }
  if (isRoleDesignManager(viewerRole)) {
    const [dmRows] = await pool.query(
      "SELECT 1 FROM users WHERE id = ? AND design_manager_id = ? LIMIT 1",
      [targetDesignerId, viewer.id],
    );
    return (dmRows as any[]).length > 0;
  }
  if (isRoleTDM(viewerRole)) {
    const [tdmRows] = await pool.query(
      `SELECT 1 FROM users u
       LEFT JOIN users dm ON dm.id = u.design_manager_id
       WHERE u.id = ? AND (u.territorial_design_manager_id = ? OR dm.territorial_design_manager_id = ?)
       LIMIT 1`,
      [targetDesignerId, viewer.id, viewer.id],
    );
    return (tdmRows as any[]).length > 0;
  }
  return false;
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
      if (!user) {
        return res.status(401).json({ message: "Unauthorized: Active session required" });
      }

      const userRole = (user.role || "").toLowerCase().trim();
      if (!isRoleAdmin(userRole) && !isRoleTDM(userRole) && !isRoleDesignManager(userRole) && !isRoleDesigner(userRole)) {
        return res.status(403).json({
          message: "Forbidden: XP summary is available to Admin, Territorial Design Manager, Design Manager, and Designer only",
        });
      }

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

      // Scope validation
      if (isRoleDesigner(userRole)) {
        if (!designerId || designerId !== Number(user.id)) {
          return res.status(403).json({
            message: "Forbidden: Designers can only access XP summary for leads assigned to them",
          });
        }
      } else if (isRoleDesignManager(userRole)) {
        if (!designerId) {
          return res.status(403).json({
            message: "Forbidden: Lead has no assigned designer in your team",
          });
        }
        const [dmCheck] = await pool.query(
          "SELECT 1 FROM users WHERE id = ? AND design_manager_id = ? LIMIT 1",
          [designerId, user.id],
        );
        if ((dmCheck as any[]).length === 0) {
          return res.status(403).json({
            message: "Forbidden: Lead's designer is not in your managed team",
          });
        }
      } else if (isRoleTDM(userRole)) {
        if (!designerId) {
          return res.status(403).json({
            message: "Forbidden: Lead has no assigned designer in your territory",
          });
        }
        const [tdmCheck] = await pool.query(
          `SELECT 1 FROM users u
           LEFT JOIN users dm ON dm.id = u.design_manager_id
           WHERE u.id = ? AND (u.territorial_design_manager_id = ? OR dm.territorial_design_manager_id = ?)
           LIMIT 1`,
          [designerId, user.id, user.id],
        );
        if ((tdmCheck as any[]).length === 0) {
          return res.status(403).json({
            message: "Forbidden: Lead's designer is not in your territory team",
          });
        }
      }

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

      // Map milestone breakdown across all 8 milestones (0 to 7)
      const milestonesMap = new Map<number, {
        milestoneIndex: number;
        milestoneName: string;
        workflowName: string;
        totalPossibleXp: number;
        baseXp?: number;
        penaltyXp?: number;
        earnedXp: number | null;
        netXp?: number | null;
        finalXp?: number | null;
        workflowStatus?: string;
        completionState?: string;
        isWorkflowCompleted: boolean;
        isDelayed: boolean;
        delayDays: number;
        overdueDays?: number;
        allowedDurationDays?: number;
        actualDurationDays?: number | null;
        overdueDurationDays?: number;
        workflowStartTimestamp?: string | null;
        workflowCompletionTimestamp?: string | null;
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

      // 1. Initialize Milestone 7: KT TRANSFER (Excluded from designer XP)
      milestonesMap.set(7, {
        milestoneIndex: 7,
        milestoneName: "KT TRANSFER",
        workflowName: "KT Transfer",
        totalPossibleXp: 0,
        earnedXp: 0,
        isWorkflowCompleted: completedSet.has("7::upload kt files"),
        isDelayed: false,
        delayDays: 0,
        tasks: [
          {
            taskName: "Upload KT files",
            aliases: [],
            baseXp: 0,
            earnedXp: null,
            status: completedSet.has("7::upload kt files") ? "completed" : "pending",
            isDelayed: false,
            delayDays: 0,
            tag: completedSet.has("7::upload kt files") ? "ON-TIME" : "PENDING",
            isActive: false,
          },
        ],
      });

      // 2. Map all 7 Designer Workflows (Milestones 0 to 6)
      WORKFLOW_XP_RULES.forEach((wf) => {
        const tx = leadTransactions.find(
          (t) => t.milestone_index === wf.milestoneIndex && t.transaction_type === "workflow_completion",
        );

        let allStepsCompleted = true;
        const taskDetails = wf.steps.map((step) => {
          let isCompleted = completedSet.has(`${wf.milestoneIndex}::${step.stepName.trim().toLowerCase()}`);
          if (!isCompleted && step.aliases) {
            for (const alias of step.aliases) {
              if (completedSet.has(`${wf.milestoneIndex}::${alias.trim().toLowerCase()}`)) {
                isCompleted = true;
                break;
              }
            }
          }
          if (!isCompleted) {
            allStepsCompleted = false;
          }

          let tag = "PENDING";
          let status: "completed" | "current" | "pending" = "pending";
          if (isCompleted) {
            status = "completed";
            tag = "ON-TIME";
          }

          return {
            taskName: step.stepName,
            aliases: step.aliases || [],
            baseXp: 0,
            earnedXp: null,
            status,
            isDelayed: false,
            delayDays: 0,
            tag,
            isActive: false,
          };
        });

        let earnedXp: number | null = null;
        let isDelayed = false;
        let delayDays = 0;

        if (tx) {
          earnedXp = Number(tx.net_xp);
          delayDays = Number(tx.delay_days || 0);
          isDelayed = delayDays > 0 || (Number(tx.net_xp) <= 0 && Number(tx.penalty_xp) > 0);
          if (isDelayed) {
            taskDetails.forEach((t) => {
              if (t.status === "completed") {
                t.isDelayed = true;
                t.tag = "OVERDUE";
              }
            });
          }
        }

        let metaObj: any = null;
        if (tx && tx.meta) {
          try {
            metaObj = typeof tx.meta === "string" ? JSON.parse(tx.meta) : tx.meta;
          } catch {}
        }

        const workflowStatus = tx
          ? (isDelayed ? "OVERDUE" : "ON-TIME")
          : "IN_PROGRESS";
        const completionState = tx ? "COMPLETED" : "INCOMPLETE";

        milestonesMap.set(wf.milestoneIndex, {
          milestoneIndex: wf.milestoneIndex,
          milestoneName: wf.milestoneName,
          workflowName: wf.workflowName,
          totalPossibleXp: wf.rewardXp,
          baseXp: tx ? Number(tx.base_xp || 0) : (allStepsCompleted ? (isDelayed ? 0 : wf.rewardXp) : 0),
          penaltyXp: tx ? Number(tx.penalty_xp || 0) : 0,
          earnedXp,
          netXp: earnedXp,
          finalXp: earnedXp,
          workflowStatus,
          completionState,
          isWorkflowCompleted: Boolean(tx),
          isDelayed,
          delayDays,
          overdueDays: delayDays,
          allowedDurationDays: wf.totalAllowedDays,
          actualDurationDays: metaObj?.elapsedDays ?? null,
          overdueDurationDays: metaObj?.overdueDurationMs ? Number((metaObj.overdueDurationMs / 86400000).toFixed(2)) : (delayDays > 0 ? delayDays : 0),
          workflowStartTimestamp: metaObj?.startTime || null,
          workflowCompletionTimestamp: metaObj?.completionTime || (tx ? new Date(tx.created_at).toISOString() : null),
          tasks: taskDetails,
        });
      });

      const totalPossibleProjectXp = TOTAL_POSSIBLE_WORKFLOW_XP; // Strictly 75
      
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
      if (!user) {
        return res.status(401).json({ message: "Unauthorized: Active session required" });
      }

      const userRole = (user?.role || "").toLowerCase().trim();
      if (!isRoleAdmin(userRole) && !isRoleTDM(userRole) && !isRoleDesignManager(userRole) && !isRoleDesigner(userRole)) {
        return res.status(403).json({
          message: "Forbidden: Leaderboard is available to Admin, Territorial Design Manager, Design Manager, and Designer only",
        });
      }

      const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
      const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy.toLowerCase() : "xp";
      const order = typeof req.query.order === "string" && req.query.order.toLowerCase() === "asc" ? "asc" : "desc";
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));

      // Org-wide rank calculation so designers and managers have real rankings
      const [allXpRows] = await pool.query(
        `SELECT u.id, COALESCE(xp.totalXp, 0) as currentXp
         FROM users u
         LEFT JOIN (
           SELECT designer_id, SUM(net_xp) as totalXp
           FROM designer_xp_transactions
           GROUP BY designer_id
         ) xp ON xp.designer_id = u.id
         WHERE LOWER(u.role) = 'designer'`,
      );
      const allDesignersSorted = (allXpRows as any[])
        .map((r) => ({
          id: Number(r.id),
          currentXp: Number(r.currentXp || 0),
        }))
        .sort((a, b) => b.currentXp - a.currentXp);

      const overallRankMap = new Map<number, number>();
      allDesignersSorted.forEach((d, idx) => {
        overallRankMap.set(d.id, idx + 1);
      });

      // Role-based scoping:
      // Admin: all designers
      // TDM: designers where designer or their DM has territorial_design_manager_id = user.id
      // Design Manager: only designers where design_manager_id = user.id
      // Designer: only self (u.id = user.id)
      let filterClause = "WHERE LOWER(u.role) = 'designer'";
      const queryParams: any[] = [];

      if (isRoleTDM(userRole)) {
        filterClause += " AND (u.territorial_design_manager_id = ? OR dm.territorial_design_manager_id = ?)";
        queryParams.push(user.id, user.id);
      } else if (isRoleDesignManager(userRole)) {
        filterClause += " AND u.design_manager_id = ?";
        queryParams.push(user.id);
      } else if (isRoleDesigner(userRole)) {
        filterClause += " AND u.id = ?";
        queryParams.push(user.id);
      }

      // Query scoped designers
      const [designerRows] = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.sub_role as subRole, u.profileImage, u.branch,
                COALESCE(xp.totalXp, 0) as currentXp,
                COALESCE(proj.projectCount, 0) as projectsCount,
                COALESCE(ontime.onTimeCount, 0) as onTimeTasksCount,
                COALESCE(ontime.totalTasksCount, 0) as totalTasksCount
         FROM users u
         LEFT JOIN users dm ON dm.id = u.design_manager_id
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
         ${filterClause}`,
        queryParams,
      );

      let designers = (designerRows as any[]).map((d) => {
        const designerId = Number(d.id);
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
          id: designerId,
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
          orgRank: overallRankMap.get(designerId) || 1,
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

      // Assign ranks:
      // Designer: org-wide rank
      // Admin / TDM / DM: rank in current table view
      designers = designers.map((d, index) => ({
        ...d,
        rank: isRoleDesigner(userRole) ? d.orgRank : index + 1,
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
      if (!user) {
        return res.status(401).json({ message: "Unauthorized: Active session required" });
      }

      const userRole = (user?.role || "").toLowerCase().trim();
      if (!isRoleAdmin(userRole) && !isRoleTDM(userRole) && !isRoleDesignManager(userRole) && !isRoleDesigner(userRole)) {
        return res.status(403).json({
          message: "Forbidden: Designer XP details are available to Admin, Territorial Design Manager, Design Manager, and Designer only",
        });
      }

      const designerId = Number(req.params.id);
      if (!designerId) return res.status(400).json({ message: "Invalid designer ID" });

      const allowed = await canViewDesignerXp(user, designerId, pool);
      if (!allowed) {
        return res.status(403).json({
          message: isRoleDesigner(userRole)
            ? "Forbidden: Designers can only view their own XP details"
            : "Forbidden: You do not have permission to view this designer's details",
        });
      }

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
