const mysql = require('mysql2/promise');
const path = require('path');

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "database-1.cl002gu0o5ft.ap-south-2.rds.amazonaws.com",
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASSWORD || "Hubinterior2019",
    database: process.env.DB_NAME || "DesignMod",
    port: Number(process.env.DB_PORT || 3306),
  });

  console.log("Connected to database. Querying leads and completions...");

  // Query the exact same query as /api/leads/queue
  const [rows] = await pool.query(
    `SELECT l.id, l.pid, l.project_name as projectName, l.project_stage as projectStage,
            l.contact_no as contactNo, l.client_email as clientEmail,
            l.is_on_hold as isOnHold, l.resume_at as resumeAt,
            l.create_at as createAt, l.update_at as updateAt,
            l.prolance_project_id as prolanceProjectId,
            l.prolance_quote_id as prolanceQuoteId,
            l.assigned_designer_id,
            l.assigned_project_manager_id,
            COALESCE(u.name, 
              NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(
                CASE WHEN l.payload IS NULL OR TRIM(l.payload) = '' OR JSON_VALID(l.payload) = 0 THEN '{}' ELSE l.payload END,
                '$.formData.designer_name'
              ))), ''),
              NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(
                CASE WHEN l.payload IS NULL OR TRIM(l.payload) = '' OR JSON_VALID(l.payload) = 0 THEN '{}' ELSE l.payload END,
                '$.designer_name'
              ))), ''),
              NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(
                CASE WHEN l.payload IS NULL OR TRIM(l.payload) = '' OR JSON_VALID(l.payload) = 0 THEN '{}' ELSE l.payload END,
                '$.designerName'
              ))), '')
            ) as designerName,
            COALESCE(NULLIF(TRIM(u.branch), ''), NULLIF(TRIM(dm.branch), '')) AS designerBranchRaw,
            u.branch AS uBranchRaw,
            dm.branch AS dmBranchRaw,
            u.role AS designerRole,
            dm.name AS dmName,
            pm.name as projectManagerName,
            NULLIF(TRIM(COALESCE(
              JSON_UNQUOTE(
                JSON_EXTRACT(
                  CASE
                    WHEN l.payload IS NULL OR TRIM(l.payload) = '' OR JSON_VALID(l.payload) = 0 THEN '{}'
                    ELSE l.payload
                  END,
                  '$.experience_center'
                )
              ),
              JSON_UNQUOTE(
                JSON_EXTRACT(
                  CASE
                    WHEN l.payload IS NULL OR TRIM(l.payload) = '' OR JSON_VALID(l.payload) = 0 THEN '{}'
                    ELSE l.payload
                  END,
                  '$.form.experience_center'
                )
              )
            )), '') AS experienceCenter,
            l.payload AS leadPayloadRaw
     FROM leads l
     LEFT JOIN users u ON u.id = l.assigned_designer_id
     LEFT JOIN users dm ON dm.id = u.design_manager_id
     LEFT JOIN users pm ON pm.id = l.assigned_project_manager_id
     ORDER BY l.id ASC`
  );

  // Load assignable designers (for designerBranchMap)
  const [desRows] = await pool.query(
    `SELECT u.id, u.name, u.role, u.sub_role AS subRole,
            COALESCE(NULLIF(TRIM(u.branch), ''), NULLIF(TRIM(dm.branch), '')) as branchRaw
     FROM users u
     LEFT JOIN users dm ON dm.id = u.design_manager_id
     WHERE u.role IN ('designer', 'design_manager')`
  );

  function toBranchCode(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (!s) return '';
    if (s.includes('HBR')) return 'HBR';
    if (s.includes('JPN') || s.includes('JP NAGAR')) return 'JPN';
    if (s.includes('SJR') || s.includes('SARJAPUR')) return 'SJR';
    return s.slice(0, 3);
  }

  const designerBranchMap = new Map();
  for (const d of desRows) {
    designerBranchMap.set(d.id, toBranchCode(d.branchRaw) || null);
  }

  // Task completions for phase bucket
  const [completionRows] = await pool.query(
    `SELECT lead_id as leadId, milestone_index as milestoneIndex, task_name as taskName, completed_at as completedAt FROM lead_task_completions`
  );

  const compsByLead = new Map();
  for (const c of completionRows) {
    if (!compsByLead.has(c.leadId)) compsByLead.set(c.leadId, []);
    compsByLead.get(c.leadId).push(c);
  }

  function getCurrentMilestoneIndex(comps) {
    if (!comps || comps.length === 0) return 0;
    // Task 7 completion means KT TRANSFER is done
    const isDone = (taskName) => comps.some((c) => c.taskName === taskName);
    if (!isDone("Upload KT files")) return 0;
    if (!isDone("Complete site measurement / Upload D1")) return 1;
    if (!isDone("DQC 1 approval")) return 2;
    if (!isDone("10% payment approval")) return 3;
    if (!isDone("Complete site masking / Upload D2")) return 4;
    if (!isDone("DQC 2 approval")) return 5;
    if (!isDone("40% payment approval")) return 6;
    if (!isDone("Customer Sign-off & Push to Prod.")) return 7;
    return 8; // In Execution
  }

  function getPhaseBucket(lead, comps) {
    // If cancelled
    const stage = String(lead.projectStage || '').trim();
    if (/^cancelled$/i.test(stage)) return "Cancelled";
    
    const idx = getCurrentMilestoneIndex(comps);
    if (idx === 0) return "Pre 10%";
    if (idx >= 1 && idx <= 3) return "10-20%";
    if (idx >= 4 && idx <= 6) return "20-60%";
    if (idx >= 7) return "IN EXECUTION";
    return "Pre 10%";
  }

  function getProjectBranch(lead) {
    if (lead.assigned_designer_id != null && designerBranchMap.has(lead.assigned_designer_id)) {
      const b = designerBranchMap.get(lead.assigned_designer_id);
      if (b) return b;
    }
    const desBranch = toBranchCode(lead.designerBranchRaw);
    if (lead.assigned_designer_id && desBranch) return desBranch;
    if (desBranch) return desBranch;
    const ownBranch = toBranchCode(lead.experienceCenter);
    return ownBranch || null;
  }

  // Count by phase bucket
  const phaseCounts = {
    "Pre 10%": { all: 0, HBR: 0, SJR: 0, JPN: 0, none: [], list: [] },
    "10-20%": { all: 0, HBR: 0, SJR: 0, JPN: 0, none: [], list: [] },
    "20-60%": { all: 0, HBR: 0, SJR: 0, JPN: 0, none: [], list: [] },
    "IN EXECUTION": { all: 0, HBR: 0, SJR: 0, JPN: 0, none: [], list: [] },
    "All Projects (10-60%)": { all: 0, HBR: 0, SJR: 0, JPN: 0, none: [], list: [] },
    "All Leads Total": { all: 0, HBR: 0, SJR: 0, JPN: 0, none: [], list: [] }
  };

  for (const r of rows) {
    const stage = String(r.projectStage || '').trim();
    const isCancelled = /^cancelled$/i.test(stage);
    if (isCancelled) continue; // default tab excludes cancelled

    const comps = compsByLead.get(r.id) || [];
    // Auto-complete KT transfer rule
    let effectiveComps = comps;
    if (comps.length > 0 && !comps.some((c) => c.milestoneIndex === 7)) {
      effectiveComps = [...comps, { milestoneIndex: 7, taskName: "Upload KT files" }];
    }

    const bucket = getPhaseBucket(r, effectiveComps);
    const branch = getProjectBranch(r);

    const record = {
      id: r.id,
      pid: r.pid,
      projectName: r.projectName,
      designerId: r.assigned_designer_id,
      designerName: r.designerName,
      designerBranchRaw: r.designerBranchRaw,
      uBranchRaw: r.uBranchRaw,
      dmBranchRaw: r.dmBranchRaw,
      designerRole: r.designerRole,
      dmName: r.dmName,
      experienceCenter: r.experienceCenter,
      resolvedBranch: branch,
      bucket
    };

    // Overall
    phaseCounts["All Leads Total"].all++;
    if (branch === "HBR") phaseCounts["All Leads Total"].HBR++;
    else if (branch === "SJR") phaseCounts["All Leads Total"].SJR++;
    else if (branch === "JPN") phaseCounts["All Leads Total"].JPN++;
    else phaseCounts["All Leads Total"].none.push(record);

    if (bucket === "Pre 10%") {
      phaseCounts["Pre 10%"].all++;
      if (branch === "HBR") phaseCounts["Pre 10%"].HBR++;
      else if (branch === "SJR") phaseCounts["Pre 10%"].SJR++;
      else if (branch === "JPN") phaseCounts["Pre 10%"].JPN++;
      else phaseCounts["Pre 10%"].none.push(record);
    } else if (bucket === "10-20%") {
      phaseCounts["10-20%"].all++;
      if (branch === "HBR") phaseCounts["10-20%"].HBR++;
      else if (branch === "SJR") phaseCounts["10-20%"].SJR++;
      else if (branch === "JPN") phaseCounts["10-20%"].JPN++;
      else phaseCounts["10-20%"].none.push(record);

      phaseCounts["All Projects (10-60%)"].all++;
      if (branch === "HBR") phaseCounts["All Projects (10-60%)"].HBR++;
      else if (branch === "SJR") phaseCounts["All Projects (10-60%)"].SJR++;
      else if (branch === "JPN") phaseCounts["All Projects (10-60%)"].JPN++;
      else phaseCounts["All Projects (10-60%)"].none.push(record);
    } else if (bucket === "20-60%") {
      phaseCounts["20-60%"].all++;
      if (branch === "HBR") phaseCounts["20-60%"].HBR++;
      else if (branch === "SJR") phaseCounts["20-60%"].SJR++;
      else if (branch === "JPN") phaseCounts["20-60%"].JPN++;
      else phaseCounts["20-60%"].none.push(record);

      phaseCounts["All Projects (10-60%)"].all++;
      if (branch === "HBR") phaseCounts["All Projects (10-60%)"].HBR++;
      else if (branch === "SJR") phaseCounts["All Projects (10-60%)"].SJR++;
      else if (branch === "JPN") phaseCounts["All Projects (10-60%)"].JPN++;
      else phaseCounts["All Projects (10-60%)"].none.push(record);
    } else if (bucket === "IN EXECUTION") {
      phaseCounts["IN EXECUTION"].all++;
      if (branch === "HBR") phaseCounts["IN EXECUTION"].HBR++;
      else if (branch === "SJR") phaseCounts["IN EXECUTION"].SJR++;
      else if (branch === "JPN") phaseCounts["IN EXECUTION"].JPN++;
      else phaseCounts["IN EXECUTION"].none.push(record);
    }
  }

  for (const [phase, data] of Object.entries(phaseCounts)) {
    console.log(`\n=== Phase: ${phase} ===`);
    console.log(`All branches: ${data.all}`);
    console.log(`HBR: ${data.HBR}, SJR: ${data.SJR}, JPN: ${data.JPN}`);
    console.log(`Sum of branches: ${data.HBR + data.SJR + data.JPN}`);
    console.log(`Difference (missing from branches): ${data.all - (data.HBR + data.SJR + data.JPN)}`);
    console.log(`Count in none array: ${data.none.length}`);
  }

  // Find which phase has All = 118 or diff = 23
  let targetPhase = null;
  for (const [phase, data] of Object.entries(phaseCounts)) {
    if (data.all === 118 || (data.all - (data.HBR + data.SJR + data.JPN)) === 23) {
      targetPhase = phase;
      console.log(`\n>>> MATCH FOUND for 118 or 23: Phase "${phase}"! <<<`);
    }
  }

  if (targetPhase) {
    console.log(`\nDetailed breakdown of missing projects in "${targetPhase}":`);
    console.table(phaseCounts[targetPhase].none.map(p => ({
      id: p.id,
      pid: p.pid,
      projectName: p.projectName,
      designerId: p.designerId,
      designerName: p.designerName,
      designerBranchRaw: p.designerBranchRaw,
      uBranchRaw: p.uBranchRaw,
      dmBranchRaw: p.dmBranchRaw,
      experienceCenter: p.experienceCenter
    })));
  }

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});

