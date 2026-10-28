import type { Pool } from "mysql2/promise";

export type LeadHoldPeriod = {
  startedAt: string;
  endedAt: string | null;
};

let tableReady: Promise<void> | null = null;

export function ensureLeadHoldPeriodsTable(pool: Pool): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lead_hold_periods (
          id INT AUTO_INCREMENT PRIMARY KEY,
          lead_id INT NOT NULL,
          started_at DATETIME NOT NULL,
          ended_at DATETIME NULL,
          INDEX idx_lead_hold_periods_lead (lead_id, ended_at)
        )
      `);
      await pool.query(`
        INSERT INTO lead_hold_periods (lead_id, started_at)
        SELECT l.id, COALESCE(l.update_at, UTC_TIMESTAMP())
        FROM leads l
        LEFT JOIN lead_hold_periods p ON p.lead_id = l.id AND p.ended_at IS NULL
        WHERE l.is_on_hold = 1 AND p.id IS NULL
      `);
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function holdOverlapMs(
  periods: LeadHoldPeriod[],
  fromMs: number,
  toMs: number,
): number {
  if (!periods.length || !(toMs > fromMs)) return 0;
  let total = 0;
  for (const period of periods) {
    const start = Date.parse(period.startedAt);
    if (!Number.isFinite(start)) continue;
    const rawEnd = period.endedAt ? Date.parse(period.endedAt) : toMs;
    const end = Number.isFinite(rawEnd) ? rawEnd : toMs;
    const overlapStart = Math.max(start, fromMs);
    const overlapEnd = Math.min(end, toMs);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total;
}

function mapRows(rows: { startedAt?: Date | string | null; endedAt?: Date | string | null }[]): LeadHoldPeriod[] {
  return rows.flatMap((row) => {
    const startedAt = toIso(row.startedAt);
    if (!startedAt) return [];
    return [{ startedAt, endedAt: toIso(row.endedAt) }];
  });
}

export async function listLeadHoldPeriods(pool: Pool, leadId: number): Promise<LeadHoldPeriod[]> {
  await ensureLeadHoldPeriodsTable(pool);
  const [rows] = await pool.query(
    `SELECT started_at AS startedAt, ended_at AS endedAt
     FROM lead_hold_periods
     WHERE lead_id = ?
     ORDER BY started_at ASC, id ASC`,
    [leadId],
  );
  return mapRows(rows as { startedAt?: Date | string | null; endedAt?: Date | string | null }[]);
}

export async function listLeadHoldPeriodsByLeadIds(
  pool: Pool,
  leadIds: number[],
): Promise<Map<number, LeadHoldPeriod[]>> {
  const grouped = new Map<number, LeadHoldPeriod[]>();
  const ids = leadIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return grouped;
  await ensureLeadHoldPeriodsTable(pool);
  const [rows] = await pool.query(
    `SELECT lead_id AS leadId, started_at AS startedAt, ended_at AS endedAt
     FROM lead_hold_periods
     WHERE lead_id IN (${ids.map(() => "?").join(",")})
     ORDER BY started_at ASC, id ASC`,
    ids,
  );
  for (const row of rows as { leadId: number; startedAt?: Date | string | null; endedAt?: Date | string | null }[]) {
    const startedAt = toIso(row.startedAt);
    if (!startedAt) continue;
    const list = grouped.get(row.leadId) ?? [];
    list.push({ startedAt, endedAt: toIso(row.endedAt) });
    grouped.set(row.leadId, list);
  }
  return grouped;
}

/** Opens a hold window. A second call while one is already open does not reset the start time. */
export async function startLeadHold(pool: Pool, leadId: number, at = new Date()): Promise<void> {
  await ensureLeadHoldPeriodsTable(pool);
  const [open] = await pool.query(
    "SELECT id FROM lead_hold_periods WHERE lead_id = ? AND ended_at IS NULL LIMIT 1",
    [leadId],
  );
  if ((open as unknown[]).length > 0) return;
  await pool.query(
    "INSERT INTO lead_hold_periods (lead_id, started_at, ended_at) VALUES (?, ?, NULL)",
    [leadId, at],
  );
}

export async function endLeadHold(pool: Pool, leadId: number, at = new Date()): Promise<void> {
  await ensureLeadHoldPeriodsTable(pool);
  await pool.query(
    "UPDATE lead_hold_periods SET ended_at = ? WHERE lead_id = ? AND ended_at IS NULL",
    [at, leadId],
  );
}

/** Close hold windows for projects whose resume date has arrived. */
export async function endDueHolds(pool: Pool, at = new Date()): Promise<void> {
  await ensureLeadHoldPeriodsTable(pool);
  await pool.query(
    `UPDATE lead_hold_periods p
     JOIN leads l ON l.id = p.lead_id
     SET p.ended_at = ?
     WHERE p.ended_at IS NULL
       AND l.is_on_hold = 1
       AND l.resume_at IS NOT NULL
       AND l.resume_at <= ?`,
    [at, at],
  );
}
