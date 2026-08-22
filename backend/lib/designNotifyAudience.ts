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

function isMmtAssignment(action: string, payload: Record<string, unknown>): boolean {
  const assignmentType = pick(payload, "assignment_type").toUpperCase();
  const kind = pick(payload, "kind").toUpperCase();
  return (
    assignmentType.includes("MMT") ||
    kind.includes("MMT") ||
    kind.includes("D1_MMT") ||
    action === "ASSIGNED"
  );
}

function isD2Related(type: string, action: string, payload: Record<string, unknown>): boolean {
  const mmtScope = pick(payload, "mmt_scope").toUpperCase();
  const kind = pick(payload, "kind").toUpperCase();
  const milestoneName = pick(payload, "milestone_name").toUpperCase();
  const milestoneIndex = Number(payload.milestone_index ?? payload.milestoneIndex);
  if (type === "MMT") {
    return mmtScope.includes("D2") || mmtScope.includes("MASKING") || kind.includes("D2");
  }
  if (type === "MILESTONE") {
    return milestoneIndex === 3 || milestoneName.includes("D2");
  }
  if (type === "MEETING") {
    const meetingType = pick(payload, "meeting_type").toLowerCase();
    return (
      meetingType.includes("sign") ||
      meetingType.includes("dqc2") ||
      meetingType.includes("d2") ||
      meetingType.includes("masking") ||
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
  let pmId = args.pmId && args.pmId > 0 ? args.pmId : 0;

  if (args.leadId > 0) {
    const [chain] = await pool.query(
      `SELECT l.assigned_designer_id, l.assigned_project_manager_id,
              d.design_manager_id
       FROM leads l
       LEFT JOIN users d ON d.id = l.assigned_designer_id
       WHERE l.id = ? LIMIT 1`,
      [args.leadId],
    );
    const row = (chain as Record<string, unknown>[])[0];
    if (row) {
      if (!designerId) designerId = num(row.assigned_designer_id);
      if (!pmId) pmId = num(row.assigned_project_manager_id);
      dmId = num(row.design_manager_id);
    }
  } else if (designerId) {
    const [drows] = await pool.query(
      `SELECT d.design_manager_id
       FROM users d
       WHERE d.id = ? LIMIT 1`,
      [designerId],
    );
    const row = (drows as Record<string, unknown>[])[0];
    if (row) dmId = num(row.design_manager_id);
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

  const addAdmins = () => allOf("admin", "deputy_general_manager");
  const addAllTdms = () => allOf("territorial_design_manager");
  const addPmAndSpm = () => {
    add(out, pmId, "project_manager");
    allOf("senior_project_manager");
  };

  if (type === "PM") {
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
    addAdmins();
    addAllTdms();
    addPmAndSpm();
  } else if (type === "PAYMENT") {
    allOf("finance");
    addAdmins();
    addAllTdms();
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
  } else if (type === "DQC") {
    allOf("dqc_manager", "dqe");
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
    addAllTdms();
    if (isDqc2(type, payload)) {
      addAdmins();
      addPmAndSpm();
    }
  } else if (type === "MMT") {
    allOf("mmt_manager");
    add(out, mmtManagerId, "mmt_manager");
    add(out, extraTo, "mmt_executive");
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
    if (isD2Related(type, action, payload)) {
      addPmAndSpm();
      add(out, requestedSpmId, "senior_project_manager");
    }
  } else if (type === "ASSIGNMENT") {
    add(out, extraTo, action === "PM_ASSIGNED" ? "project_manager" : "designer");
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
    if (isMmtAssignment(action, payload)) {
      allOf("mmt_manager");
      add(out, extraTo, "mmt_executive");
    } else {
      addAdmins();
      addAllTdms();
      if (action === "PM_ASSIGNED") {
        add(out, extraTo || pmId, "project_manager");
        addPmAndSpm();
      }
    }
  } else if (type === "MILESTONE") {
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
    addAllTdms();
    if (isD2Related(type, action, payload)) addPmAndSpm();
  } else if (type === "LEAD" || type === "PHASE" || type === "QUOTE") {
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
    addAdmins();
    addAllTdms();
  } else {
    add(out, designerId, "designer");
    add(out, dmId, "design_manager");
    if (isD2Related(type, action, payload)) addPmAndSpm();
  }

  return [...out.entries()].map(([user_id, role]) => ({ user_id, role }));
}
