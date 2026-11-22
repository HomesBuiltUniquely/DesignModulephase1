/**
 * Backfill script for lead_project_members.
 * Rebuilds the auto-managed project member list for all leads based on current state.
 *
 * SAFETY FIRST:
 * Runs in DRY-RUN mode by default.
 * To apply changes, explicitly run:
 *   npm run backfill:project-members -- --apply
 *   # or: node backend/scripts/backfill-project-members.cjs --apply
 *
 * Requires backend/.env with DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (and DB_PORT if needed).
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

loadEnvFile();

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isDryRun = !isApply;

(async () => {
  console.log('='.repeat(70));
  console.log(`LEAD PROJECT MEMBERS BACKFILL (${isDryRun ? 'DRY RUN - NO CHANGES' : 'LIVE RUN - APPLYING'})`);
  console.log('='.repeat(70));

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  if (!host || !user || !password || !database) {
    console.error('Missing DB_HOST / DB_USER / DB_PASSWORD / DB_NAME. Set them in backend/.env');
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
    // 1. Ensure table exists
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

    // 2. Load reference user mappings
    const [allUsers] = await pool.query(
      `SELECT id, name, role, email, design_manager_id, territorial_design_manager_id
       FROM users`
    );
    const userMap = new Map();
    allUsers.forEach((u) => userMap.set(u.id, u));

    // Resolve designated singletons
    const designatedTdm = allUsers.find((u) => u.role === 'territorial_design_manager' && u.id === 2)
      || allUsers.find((u) => u.role === 'territorial_design_manager');
    const designatedAdmin = allUsers.find((u) => u.role === 'admin' && u.id === 1)
      || allUsers.find((u) => u.role === 'admin');
    const designatedDqcMgr = allUsers.find((u) => u.role === 'dqc_manager' && u.id === 6)
      || allUsers.find((u) => u.role === 'dqc_manager');
    const designatedFinance = allUsers.find((u) => u.role === 'finance' && u.id === 18)
      || allUsers.find((u) => u.role === 'finance');

    // 3. Fetch all leads
    const [leads] = await pool.query(
      `SELECT id, pid, project_name, project_stage, assigned_designer_id, assigned_project_manager_id, payload
       FROM leads
       ORDER BY id ASC`
    );

    // 4. Fetch all completions, D1/D2 assignments, DQC reviews, and current members
    const [completions] = await pool.query(
      `SELECT lead_id, milestone_index, task_name FROM lead_task_completions`
    );
    const compsByLead = new Map();
    completions.forEach((c) => {
      if (!compsByLead.has(c.lead_id)) compsByLead.set(c.lead_id, []);
      compsByLead.get(c.lead_id).push(c);
    });

    const [d1Rows] = await pool.query(
      `SELECT lead_id, requested_mmt_manager_id, assigned_to_user_id
       FROM lead_d1_assignments
       ORDER BY id DESC`
    );
    const d1ByLead = new Map();
    d1Rows.forEach((r) => {
      if (!d1ByLead.has(r.lead_id)) d1ByLead.set(r.lead_id, r);
    });

    const [d2Rows] = await pool.query(
      `SELECT lead_id, assigned_to_user_id
       FROM lead_d2_assignments
       ORDER BY id DESC`
    );
    const d2ByLead = new Map();
    d2Rows.forEach((r) => {
      if (!d2ByLead.has(r.lead_id)) d2ByLead.set(r.lead_id, r);
    });

    const [dqcReviews] = await pool.query(
      `SELECT lead_id, verdict, reviewed_by_user_id
       FROM lead_dqc_reviews
       ORDER BY id DESC`
    );
    const dqcByLead = new Map();
    dqcReviews.forEach((r) => {
      if (!dqcByLead.has(r.lead_id)) dqcByLead.set(r.lead_id, []);
      dqcByLead.get(r.lead_id).push(r);
    });

    const [existingMembers] = await pool.query(
      `SELECT id, lead_id, user_id, project_role, source, added_at_milestone
       FROM lead_project_members`
    );
    const membersByLead = new Map();
    existingMembers.forEach((m) => {
      if (!membersByLead.has(m.lead_id)) membersByLead.set(m.lead_id, []);
      membersByLead.get(m.lead_id).push(m);
    });

    // Statistics
    let totalScanned = leads.length;
    let pre10Skipped = 0;
    let processed10Plus = 0;
    let leadsWithChanges = 0;
    let totalRowsToAdd = 0;
    let totalRowsToRemove = 0;
    let manualMembersPreserved = 0;

    for (const lead of leads) {
      const stage = (lead.project_stage || '').trim().toLowerCase();
      const isPre10 = stage === 'pre 10%' || stage === 'pre10%' || stage === 'pre-10%';
      const leadComps = compsByLead.get(lead.id) || [];
      const hasAnyPost10Work = leadComps.some((c) => c.milestone_index > 0);

      // If purely Pre 10% with no milestone progression beyond Pre 10%, skip auto members
      if (isPre10 && !hasAnyPost10Work) {
        pre10Skipped++;
        continue;
      }

      processed10Plus++;

      // Expected auto members map: key = `${userId}:${role}` -> { userId, role, milestone, userName }
      const expectedAuto = new Map();

      // (1) 10-20% Phase Entry: Designer, Manager, TDM, Admin
      const desId = lead.assigned_designer_id ? Number(lead.assigned_designer_id) : null;
      if (desId && userMap.has(desId)) {
        const desUser = userMap.get(desId);
        expectedAuto.set(`${desId}:designer`, {
          userId: desId,
          role: 'designer',
          milestone: '10-20% entry',
          userName: desUser.name,
        });

        const mgrId = desUser.design_manager_id ? Number(desUser.design_manager_id) : null;
        if (mgrId && userMap.has(mgrId)) {
          expectedAuto.set(`${mgrId}:design_manager`, {
            userId: mgrId,
            role: 'design_manager',
            milestone: '10-20% entry',
            userName: userMap.get(mgrId).name,
          });
        }

        const tdmId = desUser.territorial_design_manager_id
          ? Number(desUser.territorial_design_manager_id)
          : (designatedTdm ? designatedTdm.id : null);
        if (tdmId && userMap.has(tdmId)) {
          expectedAuto.set(`${tdmId}:territorial_design_manager`, {
            userId: tdmId,
            role: 'territorial_design_manager',
            milestone: '10-20% entry',
            userName: userMap.get(tdmId).name,
          });
        }
      } else {
        // Fallback TDM if no designer
        if (designatedTdm) {
          expectedAuto.set(`${designatedTdm.id}:territorial_design_manager`, {
            userId: designatedTdm.id,
            role: 'territorial_design_manager',
            milestone: '10-20% entry',
            userName: designatedTdm.name,
          });
        }
      }

      if (designatedAdmin) {
        expectedAuto.set(`${designatedAdmin.id}:admin`, {
          userId: designatedAdmin.id,
          role: 'admin',
          milestone: '10-20% entry',
          userName: designatedAdmin.name,
        });
      }

      // (2) Milestone 1: MMT Manager & MMT Executive
      const d1 = d1ByLead.get(lead.id);
      if (d1) {
        if (d1.requested_mmt_manager_id && userMap.has(Number(d1.requested_mmt_manager_id))) {
          const mgrUser = userMap.get(Number(d1.requested_mmt_manager_id));
          expectedAuto.set(`${mgrUser.id}:mmt_manager`, {
            userId: mgrUser.id,
            role: 'mmt_manager',
            milestone: 'milestone_1',
            userName: mgrUser.name,
          });
        }
        if (d1.assigned_to_user_id && userMap.has(Number(d1.assigned_to_user_id))) {
          const execUser = userMap.get(Number(d1.assigned_to_user_id));
          expectedAuto.set(`${execUser.id}:mmt_executive`, {
            userId: execUser.id,
            role: 'mmt_executive',
            milestone: 'milestone_1',
            userName: execUser.name,
          });
        }
      }

      // (3) Milestone 2 (DQC1): DQC Manager & DQE
      // Active if milestone 0 is completed (D1 files upload / mail loop etc) or any M1+ task completed
      const reachedM2 = leadComps.some(
        (c) => c.milestone_index >= 1 || c.task_name === 'D1 files upload'
      ) || (dqcByLead.get(lead.id) && dqcByLead.get(lead.id).length > 0);

      if (reachedM2 && designatedDqcMgr) {
        expectedAuto.set(`${designatedDqcMgr.id}:dqc_manager`, {
          userId: designatedDqcMgr.id,
          role: 'dqc_manager',
          milestone: 'milestone_2',
          userName: designatedDqcMgr.name,
        });

        // DQE from reviews
        const reviews = dqcByLead.get(lead.id) || [];
        for (const rev of reviews) {
          if (rev.reviewed_by_user_id && userMap.has(Number(rev.reviewed_by_user_id))) {
            const reviewer = userMap.get(Number(rev.reviewed_by_user_id));
            if (reviewer.role === 'dqe') {
              expectedAuto.set(`${reviewer.id}:dqe`, {
                userId: reviewer.id,
                role: 'dqe',
                milestone: 'milestone_2',
                userName: reviewer.name,
              });
              break;
            }
          }
        }
      }

      // (4) Milestone 3 (10% Payment): Finance
      // Active if DQC 1 approval completed or any M2+ completions exist
      const reachedM3 = leadComps.some(
        (c) => c.milestone_index >= 2 || c.task_name === 'DQC 1 approval'
      );
      if (reachedM3 && designatedFinance) {
        expectedAuto.set(`${designatedFinance.id}:finance`, {
          userId: designatedFinance.id,
          role: 'finance',
          milestone: 'milestone_3',
          userName: designatedFinance.name,
        });
      }

      // (5) Milestone 4 (D2 Masking): Project Manager
      let pmId = lead.assigned_project_manager_id
        ? Number(lead.assigned_project_manager_id)
        : null;
      if (!pmId) {
        const d2 = d2ByLead.get(lead.id);
        if (d2 && d2.assigned_to_user_id) {
          pmId = Number(d2.assigned_to_user_id);
        }
      }
      if (pmId && userMap.has(pmId)) {
        const pmUser = userMap.get(pmId);
        expectedAuto.set(`${pmId}:project_manager`, {
          userId: pmId,
          role: 'project_manager',
          milestone: 'milestone_4',
          userName: pmUser.name,
        });
      }

      // Compare with current lead_project_members
      const currentList = membersByLead.get(lead.id) || [];
      const currentAuto = new Map();
      for (const m of currentList) {
        if (m.source === 'manual') {
          manualMembersPreserved++;
        } else {
          currentAuto.set(`${m.user_id}:${m.project_role}`, m);
        }
      }

      const toAdd = [];
      for (const [key, val] of expectedAuto.entries()) {
        if (!currentAuto.has(key)) {
          toAdd.push(val);
        }
      }

      const toRemove = [];
      for (const [key, val] of currentAuto.entries()) {
        if (!expectedAuto.has(key)) {
          toRemove.push(val);
        }
      }

      if (toAdd.length > 0 || toRemove.length > 0) {
        leadsWithChanges++;
        totalRowsToAdd += toAdd.length;
        totalRowsToRemove += toRemove.length;

        const pidLabel = lead.pid ? `PID: ${lead.pid}` : `ID: ${lead.id}`;
        console.log(`\nProject [${pidLabel}] "${lead.project_name || 'Untitled'}" (Stage: ${lead.project_stage || 'N/A'}):`);
        if (toAdd.length > 0) {
          console.log(`  + ADD (${toAdd.length}): ` + toAdd.map((a) => `${a.userName} [${a.role}]`).join(', '));
        }
        if (toRemove.length > 0) {
          console.log(`  - REMOVE (${toRemove.length}): ` + toRemove.map((r) => `User#${r.user_id} [${r.project_role}]`).join(', '));
        }

        // Apply if live run
        if (isApply) {
          for (const rem of toRemove) {
            await pool.query(
              `DELETE FROM lead_project_members WHERE id = ?`,
              [rem.id]
            );
          }
          for (const add of toAdd) {
            await pool.query(
              `INSERT INTO lead_project_members (lead_id, user_id, project_role, source, added_at_milestone)
               VALUES (?, ?, ?, 'auto', ?)
               ON DUPLICATE KEY UPDATE updated_at = NOW()`,
              [lead.id, add.userId, add.role, add.milestone]
            );
          }
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('BACKFILL SUMMARY:');
    console.log('='.repeat(70));
    console.log(`Total projects scanned:         ${totalScanned}`);
    console.log(`Pre 10% projects skipped:       ${pre10Skipped}`);
    console.log(`Projects evaluated (10-20%+):   ${processed10Plus}`);
    console.log(`Projects with proposed changes: ${leadsWithChanges}`);
    console.log(`Total rows to insert:           ${totalRowsToAdd}`);
    console.log(`Total rows to remove:           ${totalRowsToRemove}`);
    console.log(`Manual members preserved:       ${manualMembersPreserved}`);
    console.log('='.repeat(70));

    if (isDryRun) {
      console.log('DRY-RUN COMPLETE: NO changes were written to the database.');
      console.log('To apply these changes, run with: node backend/scripts/backfill-project-members.cjs --apply');
    } else {
      console.log('LIVE RUN COMPLETE: All changes have been applied to lead_project_members.');
    }
  } catch (err) {
    console.error('Backfill script error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

