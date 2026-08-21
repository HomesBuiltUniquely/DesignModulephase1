import type { Pool } from "mysql2/promise";

export type InboxRecipient = {
  user_id: number;
  role: string;
};

type ResolveArgs = {
  leadId: number;
  designerId: number | null;
  pmId: number | null;
  notificationType: string;
  notificationAction: string;
  payload: Record<string, unknown>;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pick(payload: Record<string, unknown>, key: string): string {
  if (payload[key] != null && payload[key] !== "") return String(payload[key]);
  return "";
}

function isDqc2(type: string, payload: Record<string, unknown>): boolean {
  if (type !== "DQC") return false;
  const round = pick(payload, "dqc_round").toUpperCase();
  return round.includes("2") || round.includes("ROUND_2") || round === "DQC2";
}

function isD2Related(type: string, action: string, payload: Record<string, unknown>): boolean {
  const assignmentType = pick(payload, "assignment_type").toUpperCase();
  const mmtScope = pick(payload, "mmt_scope").toUpperCase();
  const kind = pick(payload, "kind").toUpperCase();
  if (type === "ASSIGNMENT" && (action === "PM_ASSIGNED" || assignmentType.includes("PM"))) return true;
  if (type === "MMT") {
    return mmtScope.includes("D2") || mmtScope.includes("MASKING") || kind.includes("D2");
  }
  if (type === "MEETING") {
    const meetingType = pick(payload, "meeting_type").toLowerCase();
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

function add(map: Map<number, string>, userId: number, role: string) {
  if (userId <= 0) return;
  if (!map.has(userId)) map.set(userId, role);
}

/**
 * Decide who gets a copy of this event. Runs once at write time.
 * Same rules as the old bell filter, but we store one row per person in Go.
 */
export async function resolveNotificationRecipients(
  pool: Pool,
  args: ResolveArgs,
): Promise<InboxRecipient[]> {
  const type = (args.notificationType || "").toUpperCase();
  const action = (args.notificationAction || "").toUpperCase();
  const payload = args.payload || {};
  const out = new Map<number, string>();

  const [roleRows] = await pool.query(
    `SELECT id, role FROM users
     WHERE role IN (
       'admin','deputy_general_manager','territorial_design_manager','design_manager',
       'finance','dqc_manager','dqe','mmt_manager','project_manager','senior_project_manager'
     )`,
  );
  const byRole = new Map<string, number[]>();
  for (const r of roleRows as { id: number; role: string }[]) {
    const role = String(r.role || "").toLowerCase();
    const list = byRole.get(role) || [];
    list.push(Number(r.id));
    byRole.set(role, list);
  }
  const allOf = (...roles: string[]) => {
    for (const role of roles) {
      for (const id of byRole.get(role) || []) add(out, id, role);
    }
  };

  let designerId = args.designerId && args.designerId > 0 ? args.designerId : 0;
  let dmId = 0;
  let tdmId = 0;
  let pmId = args.pmId && args.pmId > 0 ? args.pmId : 0;

  if (args.leadId > 0) {
    const [chain] = await pool.query(
      `SELECT l.assigned_designer_id, l.assigned_project_manager_id,
              d.design_manager_id, dm.territorial_design_manager_id
       FROM leads l
       LEFT JOIN users d ON d.id = l.assigned_designer_id
       LEFT JOIN users dm ON dm.id = d.design_manager_id
       WHERE l.id = ? LIMIT 1`,
      [args.leadId],
    );
    const row = (chain as Record<string, unknown>[])[0];
    if (row) {
      if (!designerId) designerId = num(row.assigned_designer_id);
      if (!pmId) pmId = num(row.assigned_project_manager_id);
      dmId = num(row.design_manager_id);
      tdmId = num(row.territorial_design_manager_id);
    }
  } else if (designerId) {
    const [drows] = await pool.query(
      `SELECT d.design_manager_id, dm.territorial_design_manager_id
       FROM users d
       LEFT JOIN users dm ON dm.id = d.design_manager_id
       WHERE d.id = ? LIMIT 1`,
      [designerId],
    );
    const row = (drows as Record<string, unknown>[])[0];
    if (row) {
      dmId = num(row.design_manager_id);
      tdmId = num(row.territorial_design_manager_id);
    }
  }

  const extraTo = num(payload.to_id);
  const mmtManagerId = num(payload.mmt_manager_id);
  const requestedSpmId = num(payload.requested_spm_id);

  if (type === "P2P") {
    const [everyone] = await pool.query(`SELECT id, role FROM users`);
    for (const r of everyone as { id: number; role: string }[]) {
      add(out, Number(r.id), String(r.role || "user"));
    }
    return [...out.entries()].map(([user_id, role]) => ({ user_id, role }));
  }

  // Admin / DGM always get a copy (same as old bell).
  allOf("admin", "deputy_general_manager");

  if (type === "PAYMENT") {
    allOf("finance", "territorial_design_manager");
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
  } else if (type === "DQC") {
    allOf("dqc_manager", "dqe");
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
    allOf("territorial_design_manager");
    if (action !== "REQUESTED" || isDqc2(type, payload)) {
      add(out, pmId, "project_manager");
    }
    if (isDqc2(type, payload)) add(out, pmId, "project_manager");
  } else if (type === "MMT") {
    allOf("mmt_manager");
    add(out, mmtManagerId, "mmt_manager");
    add(out, extraTo, "mmt_executive");
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
    allOf("territorial_design_manager");
    if (isD2Related(type, action, payload)) {
      add(out, pmId, "project_manager");
      add(out, requestedSpmId, "senior_project_manager");
    }
  } else if (type === "ASSIGNMENT") {
    add(out, extraTo, action === "PM_ASSIGNED" ? "project_manager" : "designer");
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
    add(out, tdmId, "territorial_design_manager");
    allOf("territorial_design_manager");
    if (action === "PM_ASSIGNED") add(out, extraTo || pmId, "project_manager");
    if (pick(payload, "assignment_type").toUpperCase().includes("MMT")) {
      allOf("mmt_manager");
      add(out, extraTo, "mmt_executive");
    }
  } else {
    // LEAD, PHASE, MILESTONE, MEETING, QUOTE
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
    add(out, tdmId, "territorial_design_manager");
    if (type === "MILESTONE" || isD2Related(type, action, payload)) {
      add(out, pmId, "project_manager");
    }
  }

  return [...out.entries()].map(([user_id, role]) => ({ user_id, role }));
}
