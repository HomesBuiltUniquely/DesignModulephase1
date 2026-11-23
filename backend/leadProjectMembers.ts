import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export type ProjectMemberRow = {
  id: number;
  lead_id: number;
  user_id: number;
  project_role: string;
  source: "auto" | "manual";
  added_at_milestone: string | null;
  created_at: Date;
  updated_at: Date;
};

export type FormattedProjectMember = {
  id: number;
  name: string;
  email: string | null;
  profileImage: string | null;
  projectRole: string;
  isManual: boolean;
};

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  designer: "Designer",
  design_manager: "Design Manager",
  territorial_design_manager: "Territory Design Manager",
  admin: "Admin",
  mmt_manager: "MMT Manager",
  mmt_executive: "MMT Executive",
  dqc_manager: "DQC Manager",
  dqe: "DQE",
  finance: "Finance",
  project_manager: "Project Manager",
  manual: "Team Member",
};

export function formatRoleLabel(roleKey: string): string {
  if (!roleKey) return "Team Member";
  return (
    ROLE_DISPLAY_NAMES[roleKey] ||
    roleKey
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

/**
 * Ensure lead_project_members table exists
 */
export async function ensureLeadProjectMembersTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_project_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lead_id INT NOT NULL,
      user_id INT NOT NULL,
      project_role VARCHAR(100) NOT NULL,
      source ENUM('auto', 'manual') NOT NULL DEFAULT 'auto',
      added_at_milestone VARCHAR(100) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_lead_user_role (lead_id, user_id, project_role),
      KEY idx_lead_id (lead_id),
      KEY idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

/**
 * Fetch all members for a lead, grouped by user so each person appears once with combined roles.
 */
export async function getProjectMembersForLead(
  pool: Pool,
  leadId: number,
  apiBase?: string
): Promise<FormattedProjectMember[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.name, u.email, u.profileImage,
            GROUP_CONCAT(DISTINCT pm.project_role ORDER BY pm.id SEPARATOR ', ') AS rawRoles,
            MAX(pm.source = 'manual') AS isManual
     FROM lead_project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.lead_id = ?
     GROUP BY u.id, u.name, u.email, u.profileImage
     ORDER BY MIN(pm.id) ASC`,
    [leadId]
  );

  return rows.map((u) => {
    let profileImage = u.profileImage || null;
    if (profileImage && profileImage.startsWith("/") && !profileImage.startsWith("http") && apiBase) {
      profileImage = `${apiBase}${profileImage}`;
    }

    const rolesList = (u.rawRoles || "")
      .split(",")
      .map((r: string) => formatRoleLabel(r.trim()))
      .filter(Boolean);
    const uniqueRoles = Array.from(new Set(rolesList));
    const projectRole = uniqueRoles.join(" · ") || "Team Member";

    return {
      id: u.id,
      name: u.name || "",
      email: u.email || null,
      profileImage,
      projectRole,
      isManual: Boolean(u.isManual),
    };
  });
}

/**
 * Add or update an auto-managed role for a lead.
 * Idempotent: inserting the same role and user again does nothing.
 */
export async function upsertAutoProjectMember(
  pool: Pool,
  leadId: number,
  userId: number,
  projectRole: string,
  milestone: string
): Promise<void> {
  if (!leadId || !userId || !projectRole) return;
  await pool.query(
    `INSERT INTO lead_project_members (lead_id, user_id, project_role, source, added_at_milestone)
     VALUES (?, ?, ?, 'auto', ?)
     ON DUPLICATE KEY UPDATE
       source = 'auto',
       added_at_milestone = COALESCE(added_at_milestone, VALUES(added_at_milestone)),
       updated_at = NOW()`,
    [leadId, userId, projectRole, milestone]
  );
}

/**
 * Remove an auto-managed role for a lead (e.g. on reassignment).
 * Never touches manual members.
 */
export async function removeAutoProjectRole(
  pool: Pool,
  leadId: number,
  projectRole: string
): Promise<void> {
  if (!leadId || !projectRole) return;
  await pool.query(
    `DELETE FROM lead_project_members
     WHERE lead_id = ? AND project_role = ? AND source = 'auto'`,
    [leadId, projectRole]
  );
}

/**
 * Trigger 1: Project enters 10-20% phase.
 * Adds:
 * 1. Project Designer
 * 2. Designer's Manager
 * 3. Territory Design Manager (TDM)
 * 4. Admin
 */
export async function syncPhaseEntry(pool: Pool, leadId: number): Promise<void> {
  try {
    const [leadRows] = await pool.query<RowDataPacket[]>(
      `SELECT l.id, l.assigned_designer_id,
              d.design_manager_id,
              dm.territorial_design_manager_id
       FROM leads l
       LEFT JOIN users d ON d.id = l.assigned_designer_id
       LEFT JOIN users dm ON dm.id = d.design_manager_id
       WHERE l.id = ?`,
      [leadId]
    );

    const lead = leadRows[0];
    if (!lead) return;

    // 1. Designer
    const designerId = lead.assigned_designer_id ? Number(lead.assigned_designer_id) : null;
    if (designerId) {
      await upsertAutoProjectMember(pool, leadId, designerId, "designer", "10-20% entry");
    }

    // 2. Designer's Manager
    const managerId = lead.design_manager_id ? Number(lead.design_manager_id) : null;
    if (managerId) {
      await upsertAutoProjectMember(pool, leadId, managerId, "design_manager", "10-20% entry");
    }

    // 3. TDM: check manager's territorial_design_manager_id; fallback to designated TDM (Asif H, ID 2)
    let tdmId = lead.territorial_design_manager_id ? Number(lead.territorial_design_manager_id) : null;
    if (!tdmId) {
      const [tdmRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE role = 'territorial_design_manager' ORDER BY id ASC LIMIT 1"
      );
      if (tdmRows[0]) tdmId = tdmRows[0].id;
    }
    if (tdmId) {
      await upsertAutoProjectMember(pool, leadId, tdmId, "territorial_design_manager", "10-20% entry");
    }

    // 4. Admin: primary admin Susmita Mondal (ID 1)
    let adminId: number | null = null;
    const [adminRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE role = 'admin' AND id = 1 LIMIT 1"
    );
    if (adminRows[0]) {
      adminId = adminRows[0].id;
    } else {
      const [anyAdmin] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
      );
      if (anyAdmin[0]) adminId = anyAdmin[0].id;
    }
    if (adminId) {
      await upsertAutoProjectMember(pool, leadId, adminId, "admin", "10-20% entry");
    }
  } catch (err) {
    console.error("[project-members] syncPhaseEntry error (non-fatal)", { leadId, err });
  }
}

/**
 * Trigger 2: D1 for MMT Request is submitted (Milestone 1).
 * Adds the chosen MMT Manager. Replaces old MMT Manager if changed.
 */
export async function syncMmtManager(
  pool: Pool,
  leadId: number,
  mmtManagerId: number
): Promise<void> {
  try {
    if (!leadId || !mmtManagerId) return;
    await removeAutoProjectRole(pool, leadId, "mmt_manager");
    await upsertAutoProjectMember(pool, leadId, mmtManagerId, "mmt_manager", "milestone_1");
  } catch (err) {
    console.error("[project-members] syncMmtManager error (non-fatal)", { leadId, mmtManagerId, err });
  }
}

/**
 * Trigger 3: MMT Manager assigns MMT Executive.
 * Adds the assigned MMT Executive. Replaces old executive if changed.
 */
export async function syncMmtExecutive(
  pool: Pool,
  leadId: number,
  executiveId: number
): Promise<void> {
  try {
    if (!leadId || !executiveId) return;
    await removeAutoProjectRole(pool, leadId, "mmt_executive");
    await upsertAutoProjectMember(pool, leadId, executiveId, "mmt_executive", "milestone_1");
  } catch (err) {
    console.error("[project-members] syncMmtExecutive error (non-fatal)", { leadId, executiveId, err });
  }
}

/**
 * Trigger 4: Milestone 2 (DQC1) becomes active.
 * Adds the DQC Manager (e.g. Pragadeswaran Selvaraj).
 */
export async function syncDqcManager(pool: Pool, leadId: number): Promise<void> {
  try {
    if (!leadId) return;
    // Pragadeswaran Selvaraj (id 6) or primary dqc_manager
    const [dqcRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE role = 'dqc_manager' ORDER BY (id = 6) DESC, id ASC LIMIT 1"
    );
    const dqcManagerId = dqcRows[0]?.id;
    if (dqcManagerId) {
      await upsertAutoProjectMember(pool, leadId, dqcManagerId, "dqc_manager", "milestone_2");
    } else {
      console.warn("[project-members] syncDqcManager: No dqc_manager user found", { leadId });
    }
  } catch (err) {
    console.error("[project-members] syncDqcManager error (non-fatal)", { leadId, err });
  }
}

/**
 * Trigger 5: DQE assigned / recorded.
 * Adds that DQE. Replaces old DQE if changed.
 */
export async function syncDqe(pool: Pool, leadId: number, dqeId: number): Promise<void> {
  try {
    if (!leadId || !dqeId) return;
    await removeAutoProjectRole(pool, leadId, "dqe");
    await upsertAutoProjectMember(pool, leadId, dqeId, "dqe", "milestone_2");
  } catch (err) {
    console.error("[project-members] syncDqe error (non-fatal)", { leadId, dqeId, err });
  }
}

/**
 * Trigger 6: Milestone 3 (10% Payment) becomes active.
 * Adds the Finance person (e.g. Raghu).
 */
export async function syncFinance(pool: Pool, leadId: number): Promise<void> {
  try {
    if (!leadId) return;
    const [finRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE role = 'finance' ORDER BY id ASC LIMIT 1"
    );
    const financeId = finRows[0]?.id;
    if (financeId) {
      await upsertAutoProjectMember(pool, leadId, financeId, "finance", "milestone_3");
    } else {
      console.warn("[project-members] syncFinance: No finance user found", { leadId });
    }
  } catch (err) {
    console.error("[project-members] syncFinance error (non-fatal)", { leadId, err });
  }
}

/**
 * Trigger 7: D2 Masking Request submitted/updated (Milestone 4).
 * Adds the chosen Project Manager. Replaces old Project Manager if changed.
 */
export async function syncProjectManager(
  pool: Pool,
  leadId: number,
  pmId: number
): Promise<void> {
  try {
    if (!leadId || !pmId) return;
    await removeAutoProjectRole(pool, leadId, "project_manager");
    await upsertAutoProjectMember(pool, leadId, pmId, "project_manager", "milestone_4");
  } catch (err) {
    console.error("[project-members] syncProjectManager error (non-fatal)", { leadId, pmId, err });
  }
}

/**
 * Reassignment: Designer changed (Bulk Assign, individual reassignment, KT handover).
 * Replaces old designer and designer's manager with the new ones.
 */
export async function syncDesignerChange(
  pool: Pool,
  leadId: number,
  newDesignerId: number | null
): Promise<void> {
  try {
    if (!leadId) return;
    await removeAutoProjectRole(pool, leadId, "designer");
    await removeAutoProjectRole(pool, leadId, "design_manager");

    if (newDesignerId) {
      await upsertAutoProjectMember(pool, leadId, newDesignerId, "designer", "reassignment");

      const [desRows] = await pool.query<RowDataPacket[]>(
        `SELECT u.design_manager_id, dm.territorial_design_manager_id
         FROM users u
         LEFT JOIN users dm ON dm.id = u.design_manager_id
         WHERE u.id = ?`,
        [newDesignerId]
      );
      const des = desRows[0];
      if (des?.design_manager_id) {
        await upsertAutoProjectMember(
          pool,
          leadId,
          Number(des.design_manager_id),
          "design_manager",
          "reassignment"
        );
      }
      if (des?.territorial_design_manager_id) {
        // Update TDM to match new manager's territory
        await removeAutoProjectRole(pool, leadId, "territorial_design_manager");
        await upsertAutoProjectMember(
          pool,
          leadId,
          Number(des.territorial_design_manager_id),
          "territorial_design_manager",
          "reassignment"
        );
      }
    }
  } catch (err) {
    console.error("[project-members] syncDesignerChange error (non-fatal)", { leadId, newDesignerId, err });
  }
}

/**
 * Manual member add (via "+" button).
 * Stored with source = 'manual'.
 */
export async function addManualMember(
  pool: Pool,
  leadId: number,
  userId: number,
  role = "manual"
): Promise<void> {
  if (!leadId || !userId) return;
  await pool.query(
    `INSERT INTO lead_project_members (lead_id, user_id, project_role, source, added_at_milestone)
     VALUES (?, ?, ?, 'manual', 'manual')
     ON DUPLICATE KEY UPDATE
       source = 'manual',
       updated_at = NOW()`,
    [leadId, userId, role]
  );
}

/**
 * Manual member remove.
 */
export async function removeManualMember(
  pool: Pool,
  leadId: number,
  userId: number
): Promise<void> {
  if (!leadId || !userId) return;
  await pool.query(
    `DELETE FROM lead_project_members
     WHERE lead_id = ? AND user_id = ? AND source = 'manual'`,
    [leadId, userId]
  );
}

/**
 * Lazy hydrate for historical leads: if this lead has zero membership rows and is past
 * Pre 10%, derive auto members from current lead / assignment state (additive upserts only).
 * Manual members are never invented here. Full reconcile (including removals) is the backfill script.
 */
export async function ensureProjectMembersHydrated(pool: Pool, leadId: number): Promise<void> {
  if (!leadId) return;
  try {
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM lead_project_members WHERE lead_id = ?`,
      [leadId],
    );
    if (Number(countRows[0]?.cnt || 0) > 0) return;

    const [leadRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, project_stage AS projectStage, assigned_designer_id AS designerId,
              assigned_project_manager_id AS pmId
       FROM leads WHERE id = ? LIMIT 1`,
      [leadId],
    );
    const lead = leadRows[0];
    if (!lead) return;

    const stage = String(lead.projectStage || "").trim().toLowerCase();
    const isPre10 = stage === "pre 10%" || stage === "pre10%" || stage === "pre-10%";

    const [compRows] = await pool.query<RowDataPacket[]>(
      `SELECT milestone_index AS milestoneIndex, task_name AS taskName
       FROM lead_task_completions WHERE lead_id = ?`,
      [leadId],
    );
    const comps = (compRows || []) as { milestoneIndex?: number; taskName?: string }[];
    const hasPost10Work = comps.some((c) => Number(c.milestoneIndex || 0) > 0);

    if (isPre10 && !hasPost10Work) return;

    await syncPhaseEntry(pool, leadId);

    const [d1Rows] = await pool.query<RowDataPacket[]>(
      `SELECT requested_mmt_manager_id AS mmtManagerId, assigned_to_user_id AS executiveId
       FROM lead_d1_assignments WHERE lead_id = ? ORDER BY id DESC LIMIT 1`,
      [leadId],
    );
    const d1 = d1Rows[0];
    if (d1?.mmtManagerId) await syncMmtManager(pool, leadId, Number(d1.mmtManagerId));
    if (d1?.executiveId) await syncMmtExecutive(pool, leadId, Number(d1.executiveId));

    const [dqcRows] = await pool.query<RowDataPacket[]>(
      `SELECT reviewed_by_user_id AS reviewerId FROM lead_dqc_reviews
       WHERE lead_id = ? ORDER BY id DESC LIMIT 20`,
      [leadId],
    );
    const reachedM2 =
      comps.some(
        (c) => Number(c.milestoneIndex || 0) >= 1 || String(c.taskName || "") === "D1 files upload",
      ) || (dqcRows && dqcRows.length > 0);
    if (reachedM2) {
      await syncDqcManager(pool, leadId);
      for (const rev of dqcRows || []) {
        const reviewerId = rev.reviewerId != null ? Number(rev.reviewerId) : null;
        if (!reviewerId) continue;
        const [uRows] = await pool.query<RowDataPacket[]>(
          `SELECT role FROM users WHERE id = ? LIMIT 1`,
          [reviewerId],
        );
        if (String(uRows[0]?.role || "").toLowerCase() === "dqe") {
          await syncDqe(pool, leadId, reviewerId);
          break;
        }
      }
    }

    const reachedM3 = comps.some(
      (c) => Number(c.milestoneIndex || 0) >= 2 || String(c.taskName || "") === "DQC 1 approval",
    );
    if (reachedM3) await syncFinance(pool, leadId);

    let pmId = lead.pmId != null ? Number(lead.pmId) : null;
    if (!pmId) {
      const [d2Rows] = await pool.query<RowDataPacket[]>(
        `SELECT assigned_to_user_id AS pmId FROM lead_d2_assignments
         WHERE lead_id = ? ORDER BY id DESC LIMIT 1`,
        [leadId],
      );
      if (d2Rows[0]?.pmId) pmId = Number(d2Rows[0].pmId);
    }
    if (pmId) await syncProjectManager(pool, leadId, pmId);
  } catch (err) {
    console.error("[project-members] ensureProjectMembersHydrated error (non-fatal)", { leadId, err });
  }
}

