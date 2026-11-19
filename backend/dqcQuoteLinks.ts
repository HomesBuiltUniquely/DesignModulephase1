/**
 * Per-round DQC quotation locks (DQC1 / DQC2).
 * Live popup uses customer-shared quote only; after submit the lock is frozen per round.
 */
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export type DqcQuoteRound = "dqc1" | "dqc2";
export type DqcQuoteSource = "customer_shared" | "locked_dqc1" | "locked_dqc2" | "none";

export type DqcQuoteLockRow = {
  leadId: number;
  round: DqcQuoteRound;
  quoteId: number;
  versionNumber: number | null;
  quotationLink: string;
  lockedAt: Date | null;
  updatedAt: Date | null;
  lockedByUserId: number | null;
};

export type DqcQuoteResolveResult = {
  quoteId: number;
  versionNumber: number | null;
  customerQuoteUrl: string;
  source: Exclude<DqcQuoteSource, "none">;
} | null;

export async function ensureLeadDqcSubmissionQuotesTable(
  pool: Pool | PoolConnection,
): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_dqc_submission_quotes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lead_id INT NOT NULL,
      round ENUM('dqc1', 'dqc2') NOT NULL,
      quote_id INT NOT NULL,
      version_number INT NULL,
      quotation_link VARCHAR(1024) NOT NULL,
      locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      locked_by_user_id INT NULL,
      UNIQUE KEY uk_lead_dqc_round (lead_id, round),
      KEY idx_dqc_quote_lead (lead_id),
      KEY idx_dqc_quote_id (quote_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

export function parseVersionFromQuoteLink(link: string | null | undefined): number | null {
  if (!link || typeof link !== "string") return null;
  try {
    const u = new URL(link.trim());
    const v = Number(u.searchParams.get("version"));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    const m = /[?&]version=(\d+)/i.exec(link);
    if (!m) return null;
    const v = Number(m[1]);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
}

export function buildCustomerQuoteUrl(
  frontendBase: string,
  quoteId: number,
  versionNumber: number | null,
): string {
  const base = frontendBase.replace(/\/$/, "");
  const versionQuery =
    versionNumber != null && versionNumber > 0
      ? `?version=${encodeURIComponent(String(versionNumber))}`
      : "";
  return `${base}/quote/${encodeURIComponent(String(quoteId))}${versionQuery}`;
}

export async function getDqcQuoteLock(
  pool: Pool,
  leadId: number,
  round: DqcQuoteRound,
): Promise<DqcQuoteLockRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT lead_id AS leadId, round, quote_id AS quoteId, version_number AS versionNumber,
            quotation_link AS quotationLink, locked_at AS lockedAt, updated_at AS updatedAt,
            locked_by_user_id AS lockedByUserId
     FROM lead_dqc_submission_quotes
     WHERE lead_id = ? AND round = ?
     LIMIT 1`,
    [leadId, round],
  );
  const row = rows[0];
  if (!row) return null;
  const quoteId = Number(row.quoteId);
  const link = String(row.quotationLink || "").trim();
  if (!Number.isFinite(quoteId) || quoteId < 1 || !link) return null;
  const version =
    row.versionNumber != null && Number(row.versionNumber) > 0
      ? Number(row.versionNumber)
      : parseVersionFromQuoteLink(link);
  return {
    leadId: Number(row.leadId),
    round: row.round === "dqc2" ? "dqc2" : "dqc1",
    quoteId,
    versionNumber: version,
    quotationLink: link,
    lockedAt: row.lockedAt ? new Date(row.lockedAt) : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    lockedByUserId:
      row.lockedByUserId != null && Number(row.lockedByUserId) > 0
        ? Number(row.lockedByUserId)
        : null,
  };
}

export async function upsertDqcQuoteLock(
  pool: Pool,
  args: {
    leadId: number;
    round: DqcQuoteRound;
    quoteId: number;
    versionNumber: number | null;
    quotationLink: string;
    lockedByUserId?: number | null;
  },
): Promise<void> {
  const link = args.quotationLink.trim();
  if (!args.leadId || !args.quoteId || !link) return;
  const version =
    args.versionNumber != null && args.versionNumber > 0
      ? args.versionNumber
      : parseVersionFromQuoteLink(link);
  await pool.query(
    `INSERT INTO lead_dqc_submission_quotes
       (lead_id, round, quote_id, version_number, quotation_link, locked_by_user_id, locked_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       quote_id = VALUES(quote_id),
       version_number = VALUES(version_number),
       quotation_link = VALUES(quotation_link),
       locked_by_user_id = VALUES(locked_by_user_id),
       locked_at = NOW(),
       updated_at = NOW()`,
    [
      args.leadId,
      args.round,
      args.quoteId,
      version,
      link,
      args.lockedByUserId != null && args.lockedByUserId > 0 ? args.lockedByUserId : null,
    ],
  );
}

/** History fallback: latest submission event for this round with a quotation link. */
export async function loadDqcQuoteFromHistory(
  pool: Pool,
  leadId: number,
  round: DqcQuoteRound,
): Promise<DqcQuoteResolveResult> {
  const kind = round === "dqc2" ? "dqc2_submission" : "dqc_submission";
  try {
    const [histRows] = await pool.query<RowDataPacket[]>(
      `SELECT event FROM lead_history WHERE lead_id = ? ORDER BY created_at DESC LIMIT 120`,
      [leadId],
    );
    for (const row of histRows || []) {
      let ev: any = row?.event;
      if (typeof ev === "string") {
        try {
          ev = JSON.parse(ev);
        } catch {
          continue;
        }
      }
      const details = ev?.details;
      if (!details || details.kind !== kind) continue;
      const link =
        typeof details.quotationLink === "string" && details.quotationLink.trim()
          ? details.quotationLink.trim()
          : null;
      const qid =
        details.quoteId != null && Number.isFinite(Number(details.quoteId)) && Number(details.quoteId) > 0
          ? Number(details.quoteId)
          : null;
      if (!link && !qid) continue;
      const version =
        details.versionNumber != null && Number(details.versionNumber) > 0
          ? Number(details.versionNumber)
          : parseVersionFromQuoteLink(link);
      if (!qid || !link) continue;
      return {
        quoteId: qid,
        versionNumber: version,
        customerQuoteUrl: link,
        source: round === "dqc2" ? "locked_dqc2" : "locked_dqc1",
      };
    }
  } catch (err) {
    console.warn("[dqc-quote] history lookup failed (non-fatal)", { leadId, round, err });
  }
  return null;
}

export type CustomerShareLoader = (leadId: number) => Promise<{
  quoteId: number;
  versionNumber: number;
} | null>;

/**
 * live  → customer-shared quote only (never CRM).
 * locked → table lock, then history for that round only (never CRM / latest).
 */
export async function resolveDqcQuoteLinkForLead(
  pool: Pool,
  leadId: number,
  round: DqcQuoteRound,
  mode: "live" | "locked",
  opts: {
    frontendBase: string;
    loadCustomerShared: CustomerShareLoader;
  },
): Promise<DqcQuoteResolveResult> {
  if (mode === "locked") {
    const lock = await getDqcQuoteLock(pool, leadId, round);
    if (lock) {
      return {
        quoteId: lock.quoteId,
        versionNumber: lock.versionNumber,
        customerQuoteUrl: lock.quotationLink,
        source: round === "dqc2" ? "locked_dqc2" : "locked_dqc1",
      };
    }
    return loadDqcQuoteFromHistory(pool, leadId, round);
  }

  // live
  const customer = await opts.loadCustomerShared(leadId);
  if (!customer) return null;
  const url = buildCustomerQuoteUrl(opts.frontendBase, customer.quoteId, customer.versionNumber);
  return {
    quoteId: customer.quoteId,
    versionNumber: customer.versionNumber > 0 ? customer.versionNumber : null,
    customerQuoteUrl: url,
    source: "customer_shared",
  };
}
