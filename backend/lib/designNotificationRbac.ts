import mysql from "mysql2/promise";

type Pool = ReturnType<typeof mysql.createPool>;

export type NotificationUser = {
  id: number;
  role?: string | null;
};

export type NotificationRow = {
  id: number;
  project_id: string;
  lead_id: number | null;
  lead_name: string;
  designer_id: number | null;
  notification_type: string;
  notification_action: string;
  payload: Record<string, unknown>;
  created_at: string;
  go_response_raw?: unknown;
};

const GLOBAL_OPS_TYPES = new Set(["PAYMENT", "DQC", "MMT"]);

function pickField(payload: Record<string, unknown>, key: string): string {
  if (payload[key] != null && payload[key] !== "") return String(payload[key]);
  const req = payload._request as Record<string, unknown> | undefined;
  if (req && req[key] != null && req[key] !== "") return String(req[key]);
  const nested = req?.payload as Record<string, unknown> | undefined;
  if (nested && nested[key] != null && nested[key] !== "") return String(nested[key]);
  return "";
}

/** DQC2 upload / review — PM needs these after they are assigned. */
function isDqc2Notification(row: NotificationRow, payload: Record<string, unknown>): boolean {
  if ((row.notification_type || "").toUpperCase() !== "DQC") return false;
  const round = pickField(payload, "dqc_round").toUpperCase();
  return round.includes("2") || round.includes("ROUND_2") || round === "DQC2";
}

/** D2 masking / post-PM MMT-style events. */
function isD2RelatedNotification(row: NotificationRow, payload: Record<string, unknown>): boolean {
  const type = (row.notification_type || "").toUpperCase();
  const action = (row.notification_action || "").toUpperCase();
  const assignmentType = pickField(payload, "assignment_type").toUpperCase();
  const mmtScope = pickField(payload, "mmt_scope").toUpperCase();
  const kind = pickField(payload, "kind").toUpperCase();

  if (type === "ASSIGNMENT" && (action === "PM_ASSIGNED" || assignmentType.includes("PM"))) {
    return true;
  }
  if (type === "MMT") {
    return (
      mmtScope.includes("D2") ||
      mmtScope.includes("MASKING") ||
      kind.includes("D2")
    );
  }
  if (type === "ASSIGNMENT" && (assignmentType.includes("MMT") || assignmentType.includes("D2"))) {
    return mmtScope.includes("D2") || kind.includes("D2") || assignmentType.includes("D2");
  }
  if (type === "MEETING") {
    const meetingType = pickField(payload, "meeting_type").toLowerCase();
    return (
      meetingType.includes("sign") ||
      meetingType.includes("dqc2") ||
      meetingType.includes("sign-off") ||
      meetingType.includes("signoff") ||
      meetingType.includes("design sign")
    );
  }
  return false;
}

/**
 * PM / SPM only see post-assign workflow items on their leads
 * (DQC2 upload/status, D2 masking/MMT, PM assign, sign-off meetings) — not all lead noise.
 */
function isPmRelevantNotification(row: NotificationRow, payload: Record<string, unknown>): boolean {
  const type = (row.notification_type || "").toUpperCase();
  if (type === "P2P") return true;
  if (isDqc2Notification(row, payload)) return true;
  return isD2RelatedNotification(row, payload);
}

async function loadTeamDesignerIds(pool: Pool, userId: number, role: string): Promise<Set<number>> {
  const ids = new Set<number>();
  if (role === "design_manager") {
    const [rows] = await pool.query(
      `SELECT id FROM users WHERE role = 'designer' AND design_manager_id = ?`,
      [userId],
    );
    for (const r of rows as { id: number }[]) ids.add(Number(r.id));
    // DM can also be assigned as designer on a lead
    ids.add(userId);
  } else if (role === "territorial_design_manager") {
    // Parentheses required — AND binds tighter than OR
    const [rows] = await pool.query(
      `SELECT u.id
       FROM users u
       LEFT JOIN users dm ON dm.id = u.design_manager_id
       WHERE (
           (u.role = 'design_manager' AND u.territorial_design_manager_id = ?)
           OR (u.role = 'designer' AND dm.territorial_design_manager_id = ?)
         )`,
      [userId, userId],
    );
    for (const r of rows as { id: number }[]) ids.add(Number(r.id));
    ids.add(userId);
  }
  return ids;
}

/**
 * Resolve effective designer_id for a notification:
 * use row.designer_id, else look up leads.assigned_designer_id via lead_id.
 */
async function resolveDesignerIdsForRows(
  pool: Pool,
  rows: NotificationRow[],
): Promise<Map<number, number>> {
  const leadIds = [
    ...new Set(
      rows
        .filter((r) => (r.designer_id == null || r.designer_id === 0) && r.lead_id != null)
        .map((r) => Number(r.lead_id)),
    ),
  ];
  const map = new Map<number, number>();
  if (leadIds.length === 0) return map;
  const [lr] = await pool.query(
    `SELECT id, assigned_designer_id FROM leads WHERE id IN (?) AND assigned_designer_id IS NOT NULL`,
    [leadIds],
  );
  for (const r of lr as { id: number; assigned_designer_id: number }[]) {
    map.set(Number(r.id), Number(r.assigned_designer_id));
  }
  return map;
}

function effectiveDesignerId(row: NotificationRow, leadDesignerMap: Map<number, number>): number | null {
  if (row.designer_id != null && Number(row.designer_id) > 0) return Number(row.designer_id);
  if (row.lead_id != null && leadDesignerMap.has(Number(row.lead_id))) {
    return leadDesignerMap.get(Number(row.lead_id)) ?? null;
  }
  return null;
}

export async function filterNotificationsForUserBatch(
  pool: Pool,
  user: NotificationUser,
  rows: NotificationRow[],
): Promise<NotificationRow[]> {
  const role = (user.role || "").toLowerCase();
  if (role === "admin" || role === "deputy_general_manager") return rows;

  let pmLeadIds = new Set<number>();
  if (role === "project_manager" || role === "senior_project_manager") {
    const [pmRows] = await pool.query(
      `SELECT id FROM leads WHERE assigned_project_manager_id = ?`,
      [user.id],
    );
    pmLeadIds = new Set((pmRows as { id: number }[]).map((r) => Number(r.id)));
  }

  // SPM also sees D2 masking requests raised to them (before PM is assigned)
  let spmD2LeadIds = new Set<number>();
  if (role === "senior_project_manager") {
    const [d2Rows] = await pool.query(
      `SELECT lead_id FROM lead_d2_assignments WHERE requested_spm_id = ?`,
      [user.id],
    );
    spmD2LeadIds = new Set((d2Rows as { lead_id: number }[]).map((r) => Number(r.lead_id)));
  }

  const teamDesignerIds = await loadTeamDesignerIds(pool, user.id, role);
  const leadDesignerMap = await resolveDesignerIdsForRows(pool, rows);

  return rows.filter((row) => {
    const type = (row.notification_type || "").toUpperCase();
    const payload = row.payload || {};
    const assignmentType = pickField(payload, "assignment_type").toUpperCase();
    const designerId = effectiveDesignerId(row, leadDesignerMap);

    // P2P → everyone
    if (type === "P2P") return true;

    if (role === "finance") return type === "PAYMENT";
    if (role === "dqc_manager" || role === "dqe") return type === "DQC";
    if (role === "mmt_manager") {
      return type === "MMT" || (type === "ASSIGNMENT" && assignmentType.includes("MMT"));
    }
    if (role === "mmt_executive") {
      const toId = Number(pickField(payload, "to_id") || payload.to_id);
      return toId === user.id || Number(pickField(payload, "mmt_manager_id")) === user.id;
    }
    if (role === "project_manager" || role === "senior_project_manager") {
      const toId = Number(pickField(payload, "to_id"));
      const action = (row.notification_action || "").toUpperCase();
      // Always allow "you were assigned as PM"
      if (
        type === "ASSIGNMENT" &&
        (action === "PM_ASSIGNED" || assignmentType.includes("PM")) &&
        toId === user.id
      ) {
        return true;
      }
      const onLead =
        row.lead_id != null &&
        (pmLeadIds.has(Number(row.lead_id)) || spmD2LeadIds.has(Number(row.lead_id)));
      if (!onLead) return false;
      return isPmRelevantNotification(row, payload);
    }
    if (role === "designer") {
      return designerId != null && designerId === user.id;
    }
    if (role === "design_manager") {
      // Team designer's notification (meeting, lead, assignment, etc.)
      return designerId != null && teamDesignerIds.has(designerId);
    }
    if (role === "territorial_design_manager") {
      // Ops types: all territory-wide. Rest: team tree only.
      if (GLOBAL_OPS_TYPES.has(type)) return true;
      return designerId != null && teamDesignerIds.has(designerId);
    }
    return false;
  });
}
