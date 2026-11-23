/**
 * Hallway Home Feed — server-scoped Today + My Actions for Design portal consumers.
 * Deploy copy to: DesignModulephase1/backend/routes/hallwayFeedRoutes.ts
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import { listLeadMeetings, kolkataParts } from "../leadMeetings";
import { buildDesignerMeetingOutcomeGroups, buildManagerMeetingOutcomeRollup, resolveTeamDesignerIds } from "../lib/meetingOutcomeActions";

type SessionUser = { id: number; email: string; name: string; role: string };

type HallwayFeedDeps = {
  pool: Pool;
  getUserFromSession: (req: Request) => Promise<SessionUser | null>;
};

function normRole(role: string | null | undefined): string {
  return String(role || "").trim().toLowerCase();
}

function todayYmd(): string {
  return kolkataParts().date;
}

function canAccessMeetingBoard(role: string): boolean {
  const r = normRole(role);
  return (
    r === "admin" ||
    r === "deputy_general_manager" ||
    r === "designer" ||
    r === "design_manager" ||
    r === "territorial_design_manager"
  );
}

function allowedScopes(role: string): Set<"my" | "team" | "all"> {
  const r = normRole(role);
  if (r === "designer" || r === "dqe" || r === "mmt_executive") {
    return new Set(["my"]);
  }
  if (r === "design_manager" || r === "project_manager") {
    return new Set(["team"]);
  }
  if (
    r === "dqc_manager" ||
    r === "mmt_manager" ||
    r === "operation_manager" ||
    r === "senior_project_manager" ||
    r === "escalation_manager"
  ) {
    return new Set(["team", "all"]);
  }
  if (r === "admin" || r === "deputy_general_manager" || r === "territorial_design_manager" || r === "finance") {
    return new Set(["all"]);
  }
  if (r.includes("sales_manager")) {
    return new Set(["team"]);
  }
  if (r.includes("sales")) {
    return new Set(["my"]);
  }
  return new Set(["all"]);
}

function parseScope(req: Request, role: string): "my" | "team" | "all" {
  const raw = String(req.query.scope || "my").toLowerCase();
  const requested = raw === "team" || raw === "all" ? raw : "my";
  const allowed = allowedScopes(role);
  if (allowed.has(requested)) return requested;
  return [...allowed][0] ?? "my";
}

async function meetingDesignerIds(
  pool: Pool,
  user: SessionUser,
  scope: "my" | "team" | "all",
): Promise<{ all: boolean; designerIds: number[] }> {
  const role = normRole(user.role);

  if (scope === "all" && (role === "admin" || role === "deputy_general_manager")) {
    return { all: true, designerIds: [] };
  }

  if (role === "admin" || role === "deputy_general_manager") {
    const [rows] = await pool.query(`SELECT id FROM users WHERE role = 'designer'`);
    const designerIds = (rows as { id: number }[]).map((r) => Number(r.id)).filter((id) => id > 0);
    return { all: false, designerIds };
  }

  if (role === "territorial_design_manager") {
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id
         FROM users u
         LEFT JOIN users dm ON dm.id = u.design_manager_id
        WHERE u.role IN ('designer','design_manager')
          AND (
            u.id = ?
            OR (u.role = 'design_manager' AND u.territorial_design_manager_id = ?)
            OR (u.role = 'designer' AND dm.territorial_design_manager_id = ?)
          )`,
      [user.id, user.id, user.id],
    );
    const designerIds = (rows as { id: number }[]).map((r) => Number(r.id));
    return { all: false, designerIds };
  }

  if (role === "design_manager") {
    const [rows] = await pool.query(
      `SELECT id FROM users WHERE id = ? OR (role = 'designer' AND design_manager_id = ?)`,
      [user.id, user.id],
    );
    const designerIds = (rows as { id: number }[]).map((r) => Number(r.id));
    return { all: false, designerIds };
  }

  if (role === "designer") {
    return { all: false, designerIds: [user.id] };
  }

  return { all: false, designerIds: [] };
}

function meetingTypeLabel(meetingMode: string | null | undefined, meetingType: string | null | undefined): string {
  const mode = String(meetingMode || "").toLowerCase();
  const type = String(meetingType || "").toLowerCase();
  if (mode === "online" || /virtual|online|meet/i.test(type)) return "Virtual meeting";
  return "Showroom visit";
}

function stageChip(meetingType: string | null | undefined): string | undefined {
  const t = String(meetingType || "").toLowerCase();
  if (t.includes("pre_10") || t.includes("pre 10") || t === "pre_10") return "Pre 10%";
  return undefined;
}

function formatDisplayTime(raw: string | null | undefined): { display: string; sortKey: number } {
  const text = String(raw || "").trim();
  if (!text || /^time\s*not\s*set$/i.test(text)) {
    return { display: "Time not set", sortKey: Number.MAX_SAFE_INTEGER };
  }
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (/pm/i.test(text) && h < 12) h += 12;
    if (/am/i.test(text) && h === 12) h = 0;
    return { display: text, sortKey: h * 60 + m };
  }
  return { display: text, sortKey: Number.MAX_SAFE_INTEGER - 1 };
}

type HallwayTodayEvent = {
  id: string;
  time: string;
  title: string;
  location?: string;
  isLink?: boolean;
  linkUrl?: string | null;
  category?: string;
  startAt?: string;
  clientName?: string | null;
  leadId?: number | null;
  salesName?: string | null;
  crmPersonName?: string | null;
  designerName?: string | null;
  meetingType?: string | null;
  stageTag?: string | null;
};

export function registerHallwayFeedRoutes(app: Express, deps: HallwayFeedDeps): void {
  const { pool, getUserFromSession } = deps;
  const DESIGN_FRONTEND = (process.env.DESIGN_FRONTEND_URL || "https://design.hubinterior.com").replace(/\/$/, "");

  const handleToday = async (req: Request, res: Response) => {
    const ref = `HBF-${Date.now().toString(36)}`;
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ ok: false, message: "Unauthorized", referenceId: ref });

      const role = normRole(user.role);
      const scope = parseScope(req, role);
      if (!allowedScopes(role).has(scope)) {
        return res.status(403).json({ ok: false, message: "Scope not allowed for your role", referenceId: ref });
      }

      const dateYmd = todayYmd();
      type Sortable = HallwayTodayEvent & { _sortKey: number; _meetId: number; status?: string };
      const sortable: Sortable[] = [];

      if (canAccessMeetingBoard(role) || role.includes("sales")) {
        const vis = await meetingDesignerIds(pool, user, scope);
        const meetings = await listLeadMeetings(
          pool,
          vis.all ? undefined : { designerIds: vis.designerIds.length ? vis.designerIds : [-1] },
        );

        for (const m of meetings as Record<string, unknown>[]) {
          const mDate = String(m.meetingDate || "").slice(0, 10);
          if (mDate !== dateYmd) continue;
          if (String(m.meetingStatus || "").toLowerCase() === "cancelled") continue;

          // If user is sales, only show meetings where they are the sales owner
          if (role.includes("sales")) {
            const userTokens = String(user.name || "").toLowerCase().trim().split(/\s+/);
            const mSales = String(m.salesName || "").toLowerCase().trim();
            const matchesSales = userTokens.some((tok) => tok.length > 2 && mSales.includes(tok));
            if (!matchesSales) continue;
          }

          const timeInfo = formatDisplayTime(String(m.meetingTime || m.meetingTimeLabel || ""));
          const customer = String(m.customerName || m.projectName || "Customer").trim();
          const sales = String(m.salesName || "").trim();
          const designer = String(m.designerName || "").trim();
          const leadIdNum = Number(m.leadId) || null;

          sortable.push({
            id: `d-meet-${m.id}`,
            time: timeInfo.display,
            title: customer,
            location: String(m.branchName || "").trim() || undefined,
            isLink: Boolean(leadIdNum),
            linkUrl: leadIdNum ? `${DESIGN_FRONTEND}/leads/${leadIdNum}` : null,
            category: "meeting",
            startAt: `${dateYmd}T12:00:00.000Z`,
            clientName: customer,
            leadId: leadIdNum,
            salesName: sales || null,
            crmPersonName: sales || null,
            designerName: designer || null,
            meetingType: meetingTypeLabel(String(m.meetingMode), String(m.meetingType)),
            stageTag: stageChip(String(m.meetingType)) || "Pre 10%",
            status: String(m.progressLabel || m.meetingStatus || "Scheduled"),
            _sortKey: timeInfo.sortKey,
            _meetId: Number(m.id) || 0,
          });
        }
      }

      if (role === "mmt_executive" && scope === "my") {
        const [rows] = await pool.query(
          `SELECT a.id, a.lead_id AS leadId, l.project_name AS projectName,
                  a.measurement_time AS measurementTime
             FROM lead_d1_assignments a
             INNER JOIN leads l ON l.id = a.lead_id
            WHERE a.assigned_to_user_id = ?
              AND DATE(a.measurement_date) = CURDATE()
              AND a.status <> 'cancelled'`,
          [user.id],
        );
        for (const r of rows as Record<string, unknown>[]) {
          const timeInfo = formatDisplayTime(String(r.measurementTime || ""));
          sortable.push({
            id: `d-d1-${r.id}`,
            time: timeInfo.display,
            title: String(r.projectName || "Site measurement"),
            isLink: true,
            linkUrl: `${DESIGN_FRONTEND}/leads/${r.leadId}`,
            category: "meeting",
            startAt: `${dateYmd}T12:00:00.000Z`,
            clientName: String(r.projectName || ""),
            leadId: Number(r.leadId),
            meetingType: "Site Measurement (D1)",
            _sortKey: timeInfo.sortKey,
            _meetId: Number(r.id) || 0,
          });
        }
      }

      sortable.sort((a, b) => {
        if (a._sortKey !== b._sortKey) return a._sortKey - b._sortKey;
        return a._meetId - b._meetId;
      });
      const events: HallwayTodayEvent[] = sortable.map(({ _sortKey, _meetId, ...ev }) => ev);

      return res.json({
        ok: true,
        dayBasis: `Design Module · IST ${dateYmd} · scope=${scope}`,
        date: dateYmd,
        scoped: true,
        hubTotal: events.length,
        companyTotal: events.length,
        events,
        referenceId: ref,
      });
    } catch (err) {
      console.error("[hallway/today]", ref, err);
      return res.status(503).json({
        ok: false,
        message: "Today's schedule is temporarily unavailable.",
        referenceId: ref,
        events: [],
      });
    }
  };

  app.get("/api/hallway/today", handleToday);
  app.get("/hallway/today", handleToday);

  const handleActions = async (req: Request, res: Response) => {
    const ref = `HBA-${Date.now().toString(36)}`;
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ ok: false, message: "Unauthorized", referenceId: ref });

      const role = normRole(user.role);
      const scope = parseScope(req, role);
      if (!allowedScopes(role).has(scope)) {
        return res.status(403).json({ ok: false, message: "Scope not allowed for your role", referenceId: ref });
      }

      const groups: {
        id: string;
        title: string;
        count: number;
        urgent?: boolean;
        items: { id: string; name: string; detail?: string; done: boolean; linkUrl?: string; statusLabel?: string; dueDateLabel?: string }[]; uncounted?: boolean; isWatchlist?: boolean;
      }[] = [];

      const pushGroup = (
        id: string,
        title: string,
        rows: { id?: number; leadId?: number; projectName?: string; detail?: string }[],
        urgent = false,
      ) => {
        if (!rows.length) return;
        groups.push({
          id,
          title,
          count: rows.length,
          urgent,
          items: rows.slice(0, 40).map((r) => ({
            id: String(r.id ?? r.leadId),
            name: String(r.projectName || `Lead ${r.leadId}`),
            detail: r.detail,
            done: false,
            linkUrl: r.leadId ? `${DESIGN_FRONTEND}/leads/${r.leadId}` : DESIGN_FRONTEND,
          })),
        });
      };

// Milestone definitions & tasks
const MILESTONE_NAMES = [
  'D1 SITE MEASUREMENT',
  'DQC1',
  '10% PAYMENT',
  'D2 SITE MASKING',
  'DQC2',
  '40% PAYMENT',
  'PUSH TO PRODUCTION',
  'KT TRANSFER',
];

const MILESTONE_TASKS: string[][] = [
  ['Mail loop chain 2 initiate', 'D1 for MMT request', 'D1 files upload'],
  [
    'First cut design + quotation discussion meeting request',
    'meeting completed',
    'DQC 1 submission - dwg + quotation',
    'DQC 1 approval',
  ],
  ['10% payment collection', '10% payment approval'],
  ['D2 - masking request raise', 'D2 - files upload'],
  [
    'Material selection meeting + quotation discussion',
    'Material selection meeting completed',
    'DQC 2 submission',
    'DQC 2 approval ',
    'Project manager approval',
  ],
  ['Design sign off', 'meeting completed', '40% collection', '40% payment approval'],
  ['Cx approval for production', 'POC mail'],
  ['Upload KT files'],
];

const EXTERNAL_TASKS = new Set([
  '0::D1 files upload',
  '1::DQC 1 approval',
  '2::10% payment approval',
  '3::D2 - files upload',
  '4::DQC 2 approval ',
  '4::Project manager approval',
  '5::40% payment approval',
]);

const MILESTONE_WORKFLOW_ORDER = [7, 0, 1, 2, 3, 4, 5, 6];

function getCurrentMilestoneIndex(
  completions: Array<{ milestoneIndex: number; taskName: string }>
): number {
  const completedSet = new Set(completions.map((c) => `${c.milestoneIndex}::${c.taskName}`));
  for (const i of MILESTONE_WORKFLOW_ORDER) {
    if (i === 7) continue;
    const tasks = MILESTONE_TASKS[i];
    const allDone = tasks?.every((t) => completedSet.has(`${i}::${t}`));
    if (!allDone) return i;
  }
  return 6;
}

function isProjectFullyCompleted(
  completions: Array<{ milestoneIndex: number; taskName: string }>
): boolean {
  return [0, 1, 2, 3, 4, 5, 6].every((mIdx) => {
    const tasks = MILESTONE_TASKS[mIdx];
    const doneSet = new Set(
      completions.filter((c) => c.milestoneIndex === mIdx).map((c) => c.taskName)
    );
    return tasks.every((t) => doneSet.has(t));
  });
}

const TASK_SLA_HOURS: Record<string, number> = {
  '0::Mail loop chain 2 initiate': 12,
  '0::D1 for MMT request': 48,
  '0::D1 files upload': 24,
  '1::First cut design + quotation discussion meeting request': 48,
  '1::meeting completed': 48,
  '1::DQC 1 submission - dwg + quotation': 72,
  '1::DQC 1 approval': 24,
  '2::10% payment collection': 48,
  '2::10% payment approval': 24,
  '3::D2 - masking request raise': 48,
  '3::D2 - files upload': 12,
  '4::Material selection meeting + quotation discussion': 12,
  '4::Material selection meeting completed': 24,
  '4::DQC 2 submission': 48,
  '4::DQC 2 approval ': 24,
  '4::Project manager approval': 24,
  '5::Design sign off': 48,
  '5::meeting completed': 24,
  '5::40% collection': 48,
  '5::40% payment approval': 24,
  '6::Cx approval for production': 24,
  '6::POC mail': 24,
  '7::Upload KT files': 12,
};

function formatTaskDue(dueAt: Date, now: Date = new Date()) {
  const dueMs = dueAt.getTime();
  const nowMs = now.getTime();
  const isOverdue = nowMs > dueMs;

  const dueParts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dueAt);

  const nowParts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const getVal = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value;
  const isToday =
    getVal(dueParts, 'year') === getVal(nowParts, 'year') &&
    getVal(dueParts, 'month') === getVal(nowParts, 'month') &&
    getVal(dueParts, 'day') === getVal(nowParts, 'day');

  if (isOverdue) {
    const diffDays = Math.max(1, Math.floor((nowMs - dueMs) / (24 * 60 * 60 * 1000)));
    return {
      isOverdue: true,
      overdueByDays: diffDays,
      dueText: `Overdue · ${diffDays}d`,
      statusLabel: 'Overdue' as const,
      state: 'overdue' as const,
    };
  }

  if (isToday) {
    return {
      isOverdue: false,
      overdueByDays: 0,
      dueText: 'Due today',
      statusLabel: 'Due today' as const,
      state: 'due_today' as const,
    };
  }

  const dateStr = dueAt.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
  });
  return {
    isOverdue: false,
    overdueByDays: 0,
    dueText: `Due ${dateStr}`,
    statusLabel: undefined,
    state: 'in_progress' as const,
  };
}

      // 1. Designer Actions: Live Project Tracker Milestone Tasks & Meeting Outcomes
      if (role === "designer" && user.id) {
        // Fetch active design phase leads
        const [leads] = await pool.query(
          `SELECT l.id, l.pid, l.project_name AS projectName, l.project_stage AS projectStage,
                  l.is_on_hold AS isOnHold, l.resume_at AS resumeAt, l.create_at AS createAt
           FROM leads l
           WHERE l.assigned_designer_id = ?
             AND l.project_stage IN ('10-20%', '20-60%', 'Active')`,
          [user.id],
        );

        const trackerItems: any[] = [];
        const now = new Date();

        for (const l of (leads as any[]) || []) {
          if (String(l.projectStage || '').trim().toLowerCase() === 'cancelled') continue;
          let isOnHold = Boolean(l.isOnHold);
          const resumeDate = l.resumeAt ? new Date(l.resumeAt) : null;
          if (isOnHold && resumeDate && resumeDate <= now) {
            isOnHold = false;
          }
          if (isOnHold) continue;

          const [compRows] = await pool.query(
            `SELECT milestone_index AS milestoneIndex, task_name AS taskName, completed_at AS completedAt
             FROM lead_task_completions WHERE lead_id = ?`,
            [l.id],
          );
          const completions: Array<{ milestoneIndex: number; taskName: string; completedAt?: string }> =
            Array.isArray(compRows) ? compRows as any : [];

          if (isProjectFullyCompleted(completions)) continue;

          const activeMilestone = getCurrentMilestoneIndex(completions);
          const tasks = MILESTONE_TASKS[activeMilestone] || [];
          const completedSet = new Set(completions.map((c) => `${c.milestoneIndex}::${c.taskName}`));

          let anchorDate = l.createAt ? new Date(l.createAt) : now;
          if (activeMilestone > 0) {
            const prevMilestoneComps = completions.filter(
              (c) => c.milestoneIndex === activeMilestone - 1 && c.completedAt,
            );
            if (prevMilestoneComps.length > 0) {
              prevMilestoneComps.sort(
                (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
              );
              anchorDate = new Date(prevMilestoneComps[0].completedAt!);
            }
          }

          const hubPid = l.pid ? (String(l.pid).startsWith('HUB') ? String(l.pid) : `HUB-${l.id}`) : `HUB-${l.id}`;
          const customer = String(l.projectName || 'Customer').trim();
          const milestoneName = MILESTONE_NAMES[activeMilestone] || `Milestone ${activeMilestone}`;

          for (let tIdx = 0; tIdx < tasks.length; tIdx++) {
            const taskTitle = tasks[tIdx];
            const taskKey = `${activeMilestone}::${taskTitle}`;
            if (completedSet.has(taskKey) || EXTERNAL_TASKS.has(taskKey)) continue;

            const slaHours = TASK_SLA_HOURS[taskKey] || 48;
            const dueAt = new Date(anchorDate.getTime() + slaHours * 3600 * 1000);
            const dueInfo = formatTaskDue(dueAt, now);

            trackerItems.push({
              id: `tracker-${l.id}-${activeMilestone}-${tIdx}`,
              name: `${taskTitle} · ${hubPid} (${customer})`,
              detail: `${milestoneName} · ${dueInfo.dueText}`,
              done: false,
              linkUrl: `${DESIGN_FRONTEND}/Leads/${l.id}`,
              dueDateLabel: dueInfo.dueText,
              statusLabel: dueInfo.statusLabel,
              projectId: hubPid,
              customerName: customer,
              milestoneName,
              taskTitle,
              dueAt: dueAt.toISOString(),
              isOverdue: dueInfo.isOverdue,
              overdueByDays: dueInfo.overdueByDays,
              state: dueInfo.state,
            });
          }
        }

        if (trackerItems.length > 0) {
          trackerItems.sort((a, b) => {
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;
            if (a.isOverdue && b.isOverdue) {
              if (b.overdueByDays !== a.overdueByDays) return b.overdueByDays - a.overdueByDays;
            }
            return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
          });
          groups.push({
            id: 'tracker-tasks',
            title: 'Milestone Tasks',
            count: trackerItems.length,
            urgent: trackerItems.some((it) => it.isOverdue),
            items: trackerItems,
          });
        }

        const outcomeGroups = await buildDesignerMeetingOutcomeGroups(pool, "", user.id, now);
        for (const og of outcomeGroups) {
          groups.push({
            id: og.id,
            title: og.title,
            count: og.count,
            urgent: og.urgent,
            uncounted: og.uncounted,
            isWatchlist: og.isWatchlist,
            items: og.items,
          });
        }
      }

      // 2. Manager and Admin Scopes: Exception-only & Rollup
      if (
        role === "territorial_design_manager" ||
        role === "design_manager" ||
        role === "admin" ||
        role === "deputy_general_manager"
      ) {
        let designerIds: number[] = [];
        if (role === "territorial_design_manager") {
          const [dRows] = await pool.query(
            `SELECT u.id
             FROM users u
             JOIN users dm ON dm.id = u.design_manager_id
             WHERE dm.territorial_design_manager_id = ? AND u.role = 'designer'`,
            [user.id],
          );
          designerIds = Array.isArray(dRows) ? (dRows as any[]).map((r) => Number(r.id)).filter((id) => id > 0) : [];
        } else if (role === "design_manager") {
          const [dRows] = await pool.query(
            `SELECT u.id FROM users u WHERE u.design_manager_id = ? AND u.role = 'designer'`,
            [user.id],
          );
          designerIds = Array.isArray(dRows) ? (dRows as any[]).map((r) => Number(r.id)).filter((id) => id > 0) : [];
        } else {
          const [dRows] = await pool.query(`SELECT u.id FROM users u WHERE u.role = 'designer'`);
          designerIds = Array.isArray(dRows) ? (dRows as any[]).map((r) => Number(r.id)).filter((id) => id > 0) : [];
        }

        if (designerIds.length > 0 && user.id) {
          const now = new Date();
          const rollup = await buildManagerMeetingOutcomeRollup(
            pool,
            "",
            designerIds,
            role === "admin" || role === "deputy_general_manager"
              ? { groupId: "meeting-outcomes-hub-watchlist", titlePrefix: "Hub meetings missing outcome" }
              : { groupId: "meeting-outcomes-team-watchlist", titlePrefix: "Team meetings missing outcome" },
            now,
          );
          if (rollup) {
            groups.push({
              id: rollup.id,
              title: rollup.title,
              count: rollup.count,
              urgent: rollup.urgent,
              uncounted: rollup.uncounted,
              isWatchlist: rollup.isWatchlist,
              items: rollup.items,
            });
          }
        }
        const minOverdue = role === "admin" || role === "deputy_general_manager" ? 5 : 2;
        if (designerIds.length > 0) {
          // Holds ending soon
          const [endingSoon] = await pool.query(
            `SELECT l.id, l.pid, l.project_name AS projectName, u.name AS designerName,
                    DATE_FORMAT(l.resume_at, '%d %b') AS resumeDateLabel
             FROM leads l
             JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.assigned_designer_id IN (${designerIds.join(',')})
               AND l.is_on_hold = 1
               AND DATE(l.resume_at) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 DAY)
             ORDER BY l.resume_at ASC LIMIT 20`,
          );
          if (Array.isArray(endingSoon) && endingSoon.length > 0) {
            groups.push({
              id: 'holds-resuming-soon',
              title: 'Holds Ending Soon (Today/Tomorrow)',
              count: endingSoon.length,
              urgent: false,
              items: (endingSoon as any[]).map((r) => ({
                id: `hold-end-${r.id}`,
                name: `${r.pid || `HUB-${r.id}`} · ${r.projectName}`,
                detail: `Hold ends ${r.resumeDateLabel} · Designer: ${r.designerName}`,
                done: false,
                linkUrl: `${DESIGN_FRONTEND}/Leads/${r.id}`,
              })),
            });
          }

          // Extended holds (>30 days)
          const [longHolds] = await pool.query(
            `SELECT l.id, l.pid, l.project_name AS projectName, u.name AS designerName,
                    l.resume_at AS resumeAt,
                    DATEDIFF(COALESCE(l.resume_at, CURDATE()), l.update_at) AS holdDuration
             FROM leads l
             JOIN users u ON u.id = l.assigned_designer_id
             WHERE l.assigned_designer_id IN (${designerIds.join(',')})
               AND l.is_on_hold = 1
               AND (l.resume_at IS NULL OR DATEDIFF(l.resume_at, l.update_at) > 30)
             ORDER BY holdDuration DESC LIMIT 20`,
          );
          if (Array.isArray(longHolds) && longHolds.length > 0) {
            groups.push({
              id: 'extended-holds',
              title: 'Extended / Indefinite Holds (>30d)',
              count: longHolds.length,
              urgent: false,
              items: (longHolds as any[]).map((r) => ({
                id: `long-hold-${r.id}`,
                name: `${r.pid || `HUB-${r.id}`} · ${r.projectName}`,
                detail: r.resumeAt
                  ? `Hold duration: ${r.holdDuration} days · Designer: ${r.designerName}`
                  : `No resume date set · Designer: ${r.designerName}`,
                done: false,
                linkUrl: `${DESIGN_FRONTEND}/Leads/${r.id}`,
              })),
            });
          }
        }

        // Branch rollup for Admin
        if (role === "admin" || role === "deputy_general_manager") {
          const [branchStats] = await pool.query(
            `SELECT COALESCE(dm.branch, 'Unassigned') AS branch,
                    dm.name AS managerName,
                    COUNT(DISTINCT l.id) AS totalProjects,
                    SUM(CASE WHEN l.is_on_hold = 0 THEN 1 ELSE 0 END) AS activeCount,
                    SUM(CASE WHEN l.is_on_hold = 1 THEN 1 ELSE 0 END) AS onHoldCount
             FROM leads l
             JOIN users u ON u.id = l.assigned_designer_id
             LEFT JOIN users dm ON dm.id = u.design_manager_id
             WHERE l.project_stage IN ('10-20%', '20-60%', 'Active')
             GROUP BY dm.branch, dm.name
             ORDER BY activeCount DESC`,
          );
          if (Array.isArray(branchStats) && branchStats.length > 0) {
            groups.push({
              id: 'branch-rollup',
              title: 'Design Team Rollup',
              count: branchStats.length,
              urgent: false,
              items: (branchStats as any[]).map((b, idx) => ({
                id: `branch-stat-${idx}`,
                name: `${b.branch} · ${b.managerName || 'General'}`,
                detail: `${b.activeCount} active projects · ${b.onHoldCount} on hold (${b.totalProjects} total)`,
                done: false,
                linkUrl: `${DESIGN_FRONTEND}/dashboard`,
              })),
            });
          }
        }
      }

      // 2. DQC Queue
      if (role === "dqc_manager" || role === "dqe" || role === "admin" || role === "deputy_general_manager") {
        const [dqcRows] = await pool.query(
          `SELECT r.id, r.lead_id AS leadId, l.project_name AS projectName,
                  'Needs DQC Review' AS detail
             FROM lead_dqc_reviews r
             JOIN leads l ON l.id = r.lead_id
            WHERE r.verdict IS NULL OR r.verdict = 'pending'
            ORDER BY r.created_at ASC
            LIMIT 30`,
        ).catch(() => [[]]);
        pushGroup("dqc-pending", "DQC Reviews Awaiting Verdict", (dqcRows as any[]) || [], true);
      }

      // 3. MMT Queue
      if (role === "mmt_manager" || role === "admin" || role === "deputy_general_manager") {
        let sql = `
          SELECT a.id, a.lead_id AS leadId, l.project_name AS projectName,
                 'Awaiting executive assignment' AS detail
            FROM lead_d1_assignments a
            INNER JOIN leads l ON l.id = a.lead_id
           WHERE a.status = 'awaiting_manager' AND a.assigned_to_user_id IS NULL`;
        const params: number[] = [];
        if (role === "mmt_manager") {
          sql += " AND a.requested_mmt_manager_id = ?";
          params.push(user.id);
        }
        sql += " ORDER BY a.created_at ASC LIMIT 30";
        const [pending] = await pool.query(sql, params);
        pushGroup("d1-requests", "D1 Pending Requests", pending as Record<string, unknown>[], true);
      }

      if (role === "mmt_executive" && user.id) {
        const [rows] = await pool.query(
          `SELECT l.id, l.id AS leadId, l.project_name AS projectName,
                  'Site measurement assigned' AS detail
             FROM leads l
            INNER JOIN lead_d1_assignments a ON a.lead_id = l.id AND a.assigned_to_user_id = ?
            WHERE a.status NOT IN ('completed', 'cancelled')
            ORDER BY l.id DESC LIMIT 30`,
          [user.id],
        );
        pushGroup("d1-assignments", "My D1 Assignments", rows as Record<string, unknown>[], true);
      }

      // 4. Finance Queue
      if (role === "finance" || (role === "admin" && scope === "all")) {
        const [rows] = await pool.query(
          `SELECT u.id, u.lead_id AS leadId, l.project_name AS projectName,
                  CONCAT('Payment · ', u.upload_type) AS detail
             FROM lead_uploads u
             INNER JOIN leads l ON l.id = u.lead_id
            WHERE u.status = 'pending'
              AND u.upload_type IN ('payment_10p', 'payment_40p')
            LIMIT 30`,
        );
        pushGroup("finance-payments", "Payment Approvals", rows as Record<string, unknown>[], true);
      }

      // 5. Project Manager Queue
      if (role === "project_manager" && user.id) {
        const [rows] = await pool.query(
          `SELECT l.id, l.id AS leadId, l.project_name AS projectName
             FROM leads l
            WHERE l.assigned_project_manager_id = ?
            ORDER BY l.update_at DESC LIMIT 30`,
          [user.id],
        );
        pushGroup("pm-queue", "PM Assigned Queue", rows as Record<string, unknown>[], true);
      }

      return res.json({
        ok: true,
        dayBasis: groups.length ? `Design Module · scope=${scope}` : "No pending actions for your role",
        scoped: true,
        actions: groups,
        referenceId: ref,
      });
    } catch (err) {
      console.error("[hallway/actions]", ref, err);
      return res.status(503).json({
        ok: false,
        message: "My Actions is temporarily unavailable.",
        referenceId: ref,
        scoped: true,
        actions: [],
      });
    }
  };

  app.get("/api/hallway/actions", handleActions);
  app.get("/api/hallway/my-actions", handleActions);
  app.get("/hallway/my-actions", handleActions);
  app.get("/hallway/actions", handleActions);
}