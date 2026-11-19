/**
 * Backfill lead_dqc_submission_quotes from lead_history submission events.
 * Takes the most recent dqc_submission / dqc2_submission event with a quotationLink per lead.
 *
 * Dry-run by default:
 *   node backend/scripts/backfill-dqc-quote-locks.cjs
 * Apply:
 *   node backend/scripts/backfill-dqc-quote-locks.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const backendDir = path.join(__dirname, '..');
const mysql = require(path.join(backendDir, 'node_modules/mysql2/promise'));

function loadEnvFile() {
  const envPath = path.join(backendDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) return;
    let key = trimmed.slice(0, idx).trim();
    if (key.startsWith('export ')) key = key.slice(7).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  });
}

function parseVersionFromLink(link) {
  if (!link) return null;
  const m = /[?&]version=(\d+)/i.exec(String(link));
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

loadEnvFile();
const isApply = process.argv.includes('--apply');

(async () => {
  console.log('='.repeat(70));
  console.log(`DQC QUOTE LOCKS BACKFILL (${isApply ? 'LIVE' : 'DRY RUN'})`);
  console.log('='.repeat(70));

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  if (!host || !user || !password || !database) {
    console.error('Missing DB_* in backend/.env');
    process.exit(2);
  }

  const pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port: Number(process.env.DB_PORT || 3306),
    ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
  });

  try {
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

    const [histRows] = await pool.query(
      `SELECT lead_id AS leadId, event, created_at AS createdAt
       FROM lead_history
       ORDER BY created_at DESC, id DESC`,
    );

    /** @type {Map<string, { leadId: number, round: string, quoteId: number, versionNumber: number|null, quotationLink: string }>} */
    const latestByKey = new Map();

    for (const row of histRows || []) {
      let ev = row.event;
      if (typeof ev === 'string') {
        try {
          ev = JSON.parse(ev);
        } catch {
          continue;
        }
      }
      const details = ev?.details;
      if (!details) continue;
      const kind = details.kind;
      const round = kind === 'dqc_submission' ? 'dqc1' : kind === 'dqc2_submission' ? 'dqc2' : null;
      if (!round) continue;
      const leadId = Number(row.leadId);
      if (!leadId) continue;
      const key = `${leadId}:${round}`;
      if (latestByKey.has(key)) continue; // already have most recent

      const link =
        typeof details.quotationLink === 'string' && details.quotationLink.trim()
          ? details.quotationLink.trim()
          : null;
      const quoteId =
        details.quoteId != null && Number(details.quoteId) > 0 ? Number(details.quoteId) : null;
      if (!link || !quoteId) continue;
      const version =
        details.versionNumber != null && Number(details.versionNumber) > 0
          ? Number(details.versionNumber)
          : parseVersionFromLink(link);
      latestByKey.set(key, {
        leadId,
        round,
        quoteId,
        versionNumber: version,
        quotationLink: link,
      });
    }

    let toInsert = 0;
    let skippedExisting = 0;

    for (const item of latestByKey.values()) {
      const [existing] = await pool.query(
        `SELECT id FROM lead_dqc_submission_quotes WHERE lead_id = ? AND round = ? LIMIT 1`,
        [item.leadId, item.round],
      );
      if ((existing || []).length > 0) {
        skippedExisting++;
        continue;
      }
      toInsert++;
      console.log(
        `+ lead ${item.leadId} ${item.round}: quote #${item.quoteId}` +
          (item.versionNumber ? ` v${item.versionNumber}` : '') +
          ` → ${item.quotationLink}`,
      );
      if (isApply) {
        await pool.query(
          `INSERT INTO lead_dqc_submission_quotes
             (lead_id, round, quote_id, version_number, quotation_link, locked_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             quote_id = VALUES(quote_id),
             version_number = VALUES(version_number),
             quotation_link = VALUES(quotation_link),
             updated_at = NOW()`,
          [item.leadId, item.round, item.quoteId, item.versionNumber, item.quotationLink],
        );
      }
    }

    console.log('='.repeat(70));
    console.log(`History candidates: ${latestByKey.size}`);
    console.log(`Would insert / inserted: ${toInsert}`);
    console.log(`Already had lock row: ${skippedExisting}`);
    if (!isApply) {
      console.log('DRY RUN — re-run with --apply to write.');
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
