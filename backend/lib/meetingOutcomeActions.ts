type HallwayActionItem = {
  id: string;
  name: string;
  detail?: string;
  done: boolean;
  linkUrl?: string;
  statusLabel?: string;
  dueDateLabel?: string;
};
type HallwayActionGroup = {
  id: string;
  title: string;
  count: number;
  urgent?: boolean;
  uncounted?: boolean;
  isWatchlist?: boolean;
  collapsedSummary?: { projectCount: number; oldestDays: number };
  items: HallwayActionItem[];
};
import {
  MEETING_OUTCOME_RECENCY_DAYS,
  HUB_DEFAULT_END_TIME_LABEL,
  meetingEndedForOutcome,
  daysSinceMeetingEnd,
  formatMeetingAgo,
  meetingModeLabel,
} from './meetingOutcomePolicy';

export type MeetingOutcomeRow = {
  id: number;
  leadId: number;
  projectName?: string | null;
  customerName?: string | null;
  meetingDate: string;
  meetingTime?: string | null;
  meetingMode?: string | null;
  meetingType?: string | null;
  meetingStatus?: string | null;
  progress?: string | null;
  startedAt?: string | Date | null;
  endedAt?: string | Date | null;
  branch?: string | null;
  designerId?: number | null;
};

type PoolLike = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

function designFrontendBase(): string {
  return (
    process.env.DESIGN_MODULE_FRONTEND_URL ||
    process.env.NEXT_PUBLIC_DESIGN_MODULE_FRONTEND_URL ||
    'https://design.hubinterior.com'
  ).replace(/\/$/, '');
}

function outcomeDeepLink(meetingId: number, leadId: number): string {
  const base = designFrontendBase();
  return `${base}/meeting-management?meetingId=${meetingId}&leadId=${leadId}`;
}

function reviewDeepLink(): string {
  return `${designFrontendBase()}/meeting-management`;
}

function formatIstSlot(dateIso: string, timeLabel: string | null | undefined): string {
  const d = dateIso.slice(0, 10);
  const t = String(timeLabel || '').trim();
  if (!t || /^time\s*not\s*set$/i.test(t)) {
    return `${d} · Time not set (assumed end ${HUB_DEFAULT_END_TIME_LABEL} IST)`;
  }
  try {
    const stamp = new Date(`${d}T12:00:00+05:30`);
    const day = stamp.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
    });
    return `${day} · ${t}`;
  } catch {
    return `${d} · ${t}`;
  }
}

function mapMeetingItem(row: MeetingOutcomeRow, now: Date): HallwayActionItem {
  const customer = String(row.customerName || row.projectName || 'Customer').trim();
  const days = daysSinceMeetingEnd(row, now);
  const typeLabel = meetingModeLabel(row.meetingMode);
  const slot = formatIstSlot(row.meetingDate, row.meetingTime);
  const mid = Number(row.id);
  const leadId = Number(row.leadId);
  return {
    id: `meet-outcome-${mid}`,
    name: customer,
    detail: `${slot} · ${typeLabel} · ${formatMeetingAgo(days)} · Outcome not recorded`,
    done: false,
    linkUrl: outcomeDeepLink(mid, leadId),
    statusLabel: days > 3 ? 'Overdue' : days > 0 ? 'Due today' : 'Due today',
    dueDateLabel: days > 0 ? `Overdue · ${days}d` : 'Today',
  };
}

function dbPrefix(designDb: string): string {
  const name = String(designDb || '').trim();
  return name ? `${name}.` : '';
}

async function fetchCandidateMeetings(
  pool: PoolLike,
  designDb: string,
  designerIds: number[]
): Promise<MeetingOutcomeRow[]> {
  if (!designerIds.length) return [];
  const prefixes = dbPrefix(designDb);
  const placeholders = designerIds.map(() => '?').join(',');
  const [rows] = (await pool.query(
    `SELECT m.id, m.lead_id AS leadId, l.project_name AS projectName,
            l.project_name AS customerName,
            DATE_FORMAT(m.meeting_date, '%Y-%m-%d') AS meetingDate,
            m.meeting_time AS meetingTime, m.meeting_mode AS meetingMode,
            m.meeting_type AS meetingType, m.meeting_status AS meetingStatus,
            m.progress, m.started_at AS startedAt, m.ended_at AS endedAt,
            m.branch, m.designer_id AS designerId, m.meeting_date AS meetingDateRaw
     FROM ${prefixes}lead_meetings m
     INNER JOIN ${prefixes}leads l ON l.id = m.lead_id
     WHERE m.meeting_status NOT IN ('cancelled')
       AND LOWER(COALESCE(m.progress, '')) IN ('scheduled', 'in_progress')
       AND m.designer_id IN (${placeholders})
       AND m.designer_id IS NOT NULL
       AND m.meeting_date >= DATE_SUB(CURDATE(), INTERVAL 400 DAY)
     ORDER BY m.meeting_date ASC, m.id ASC`,
    designerIds
  )) as [MeetingOutcomeRow[]];
  return Array.isArray(rows) ? rows : [];
}

function splitRecentAndOlder(
  rows: MeetingOutcomeRow[],
  now: Date
): { recent: MeetingOutcomeRow[]; older: MeetingOutcomeRow[] } {
  const seenIds = new Set<number>();
  const ended = rows.filter((r) => {
    if (!meetingEndedForOutcome(r, now)) return false;
    const mid = Number(r.id);
    if (seenIds.has(mid)) return false;
    seenIds.add(mid);
    return true;
  });
  const recent: MeetingOutcomeRow[] = [];
  const older: MeetingOutcomeRow[] = [];
  for (const r of ended) {
    const days = daysSinceMeetingEnd(r, now);
    if (days <= MEETING_OUTCOME_RECENCY_DAYS) recent.push(r);
    else older.push(r);
  }
  recent.sort((a, b) => daysSinceMeetingEnd(b, now) - daysSinceMeetingEnd(a, now));
  older.sort((a, b) => daysSinceMeetingEnd(b, now) - daysSinceMeetingEnd(a, now));
  return { recent, older };
}

/** Designer-owned ended meetings needing outcome (counted + optional older watchlist). */
export async function buildDesignerMeetingOutcomeGroups(
  pool: PoolLike,
  designDb: string,
  designerUserId: number,
  now = new Date()
): Promise<HallwayActionGroup[]> {
  const groups: HallwayActionGroup[] = [];
  const rows = await fetchCandidateMeetings(pool, designDb, [designerUserId]);
  const { recent, older } = splitRecentAndOlder(rows, now);

  if (recent.length) {
    groups.push({
      id: 'meeting-outcomes',
      title: 'Meeting Outcome Needed',
      count: recent.length,
      urgent: recent.some((r) => daysSinceMeetingEnd(r, now) > 3),
      items: recent.map((r) => mapMeetingItem(r, now)),
    });
  }

  if (older.length) {
    const oldestDays = Math.max(...older.map((r) => daysSinceMeetingEnd(r, now)));
    groups.push({
      id: 'meeting-outcomes-older',
      title: 'Older meetings without outcome',
      count: older.length,
      uncounted: true,
      isWatchlist: true,
      collapsedSummary: {
        projectCount: older.length,
        oldestDays,
      },
      items: [
        {
          id: 'meeting-outcomes-older-summary',
          name: `${older.length} older meetings without outcome`,
          detail: `Oldest ${oldestDays} days · review in Meeting Management (not counted in your action total)`,
          done: false,
          linkUrl: reviewDeepLink(),
        },
      ],
    });
  }

  return groups;
}

/** Manager / admin rollup — uncounted watchlist only (no per-meeting list). */
export async function buildManagerMeetingOutcomeRollup(
  pool: PoolLike,
  designDb: string,
  designerIds: number[],
  opts: { groupId: string; titlePrefix: string; branchLabel?: string },
  now = new Date()
): Promise<HallwayActionGroup | null> {
  if (!designerIds.length) return null;
  const rows = await fetchCandidateMeetings(pool, designDb, designerIds);
  const { recent, older } = splitRecentAndOlder(rows, now);
  const total = recent.length + older.length;
  if (!total) return null;

  const oldestDays = [...recent, ...older].reduce(
    (max, r) => Math.max(max, daysSinceMeetingEnd(r, now)),
    0
  );

  const hubNote = opts.branchLabel ? ` · ${opts.branchLabel}` : '';

  return {
    id: opts.groupId,
    title: `${opts.titlePrefix}${hubNote}`,
    count: total,
    uncounted: true,
    isWatchlist: true,
    collapsedSummary: {
      projectCount: total,
      oldestDays,
    },
    items: [
      {
        id: `${opts.groupId}-summary`,
        name:
          recent.length > 0
            ? `${recent.length} meetings in your team have no outcome (last ${MEETING_OUTCOME_RECENCY_DAYS}d)`
            : 'No recent team meetings missing outcomes',
        detail:
          older.length > 0
            ? `${older.length} older without outcome · oldest ${oldestDays} days · team review in Meeting Management`
            : 'Open Meeting Management for your team',
        done: false,
        linkUrl: reviewDeepLink(),
      },
    ],
  };
}

export type MeetingOutcomeAuditRow = {
  designerId: number;
  designerName?: string;
  buckets: Record<'0-3' | '4-14' | '15-30' | '31+', number>;
  total: number;
};

/** Read-only audit helper for dry-run reports (no data mutation). */
export async function resolveTeamDesignerIds(
  pool: PoolLike,
  designDb: string,
  role: string,
  managerUserId: number
): Promise<number[]> {
  const prefixes = dbPrefix(designDb);
  const r = role.trim().toLowerCase();
  if (r === 'design_manager') {
    const [rows] = (await pool.query(
      `SELECT id FROM ${prefixes}users WHERE design_manager_id = ? AND role = 'designer'`,
      [managerUserId]
    )) as [{ id: number }[]];
    return (Array.isArray(rows) ? rows : []).map((row) => Number(row.id)).filter((id) => id > 0);
  }
  if (r === 'territorial_design_manager') {
    const [rows] = (await pool.query(
      `SELECT u.id
         FROM ${prefixes}users u
         LEFT JOIN ${prefixes}users dm ON dm.id = u.design_manager_id
        WHERE u.role IN ('designer','design_manager')
          AND (
            dm.territorial_design_manager_id = ?
            OR (u.role = 'design_manager' AND u.territorial_design_manager_id = ?)
          )`,
      [managerUserId, managerUserId]
    )) as [{ id: number }[]];
    return (Array.isArray(rows) ? rows : []).map((row) => Number(row.id)).filter((id) => id > 0);
  }
  if (r === 'admin' || r === 'deputy_general_manager') {
    const [rows] = (await pool.query(
      `SELECT id FROM ${prefixes}users WHERE role = 'designer'`
    )) as [{ id: number }[]];
    return (Array.isArray(rows) ? rows : []).map((row) => Number(row.id)).filter((id) => id > 0);
  }
  return [];
}

export async function auditMeetingOutcomeBacklog(
  pool: PoolLike,
  designDb: string
): Promise<{ rows: MeetingOutcomeAuditRow[]; grandTotal: number }> {
  const [designers] = (await pool.query(
    `SELECT id, name FROM ${dbPrefix(designDb)}users WHERE role = 'designer'`
  )) as [{ id: number; name: string }[]];
  const list = Array.isArray(designers) ? designers : [];
  const now = new Date();
  const out: MeetingOutcomeAuditRow[] = [];
  let grandTotal = 0;

  for (const d of list) {
    const candidates = await fetchCandidateMeetings(pool, designDb, [Number(d.id)]);
    const ended = candidates.filter((r) => meetingEndedForOutcome(r, now));
    const buckets = { '0-3': 0, '4-14': 0, '15-30': 0, '31+': 0 };
    for (const r of ended) {
      const days = daysSinceMeetingEnd(r, now);
      if (days <= 3) buckets['0-3']++;
      else if (days <= 14) buckets['4-14']++;
      else if (days <= 30) buckets['15-30']++;
      else buckets['31+']++;
    }
    if (ended.length) {
      out.push({
        designerId: Number(d.id),
        designerName: d.name,
        buckets,
        total: ended.length,
      });
      grandTotal += ended.length;
    }
  }

  out.sort((a, b) => b.total - a.total);
  return { rows: out, grandTotal };
}