
export interface BadgeTier {
  levelNum: number;
  badgeKey: string;
  name: string;
  minXp: number;
  maxXp: number | null; // null for highest level (Legend)
}

export const BADGE_TIERS: BadgeTier[] = [
  { levelNum: 1, badgeKey: "rookie", name: "Rookie", minXp: 0, maxXp: 499 },
  { levelNum: 2, badgeKey: "explorer", name: "Explorer", minXp: 500, maxXp: 1499 },
  { levelNum: 3, badgeKey: "creator", name: "Creator", minXp: 1500, maxXp: 3499 },
  { levelNum: 4, badgeKey: "specialist", name: "Specialist", minXp: 3500, maxXp: 6999 },
  { levelNum: 5, badgeKey: "design_pro", name: "Design Pro", minXp: 7000, maxXp: 14999 },
  { levelNum: 6, badgeKey: "design_master", name: "Design Master", minXp: 15000, maxXp: 29999 },
  { levelNum: 7, badgeKey: "elite", name: "Elite", minXp: 30000, maxXp: 59999 },
  { levelNum: 8, badgeKey: "legend", name: "Legend", minXp: 60000, maxXp: null },
];

export function getBadgeForXp(xp: number): BadgeTier {
  const safeXp = Math.max(0, xp || 0);
  for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
    if (safeXp >= BADGE_TIERS[i].minXp) {
      return BADGE_TIERS[i];
    }
  }
  return BADGE_TIERS[0];
}

export function getNextBadge(currentLevelNum: number): BadgeTier | null {
  return BADGE_TIERS.find((b) => b.levelNum === currentLevelNum + 1) || null;
}

export type PropertyConfigKey = "1BHK" | "2BHK" | "3BHK" | "4BHK" | "5BHK";

const CONFIG_ALIASES: Record<string, PropertyConfigKey> = {
  "1BHK": "1BHK",
  "1 BHK": "1BHK",
  "2BHK": "2BHK",
  "2 BHK": "2BHK",
  "3BHK": "3BHK",
  "3 BHK": "3BHK",
  "3 BHk": "3BHK",
  "4BHK": "4BHK",
  "4 BHK": "4BHK",
  "4BHk": "4BHK",
  "4BHK & MORE": "4BHK",
  "4BHK & more": "4BHK",
  "5BHK": "5BHK",
  "5 BHK": "5BHK",
  "5BHK OR VILLA": "5BHK",
  "5BHK OR VILL": "5BHK",
  "VILLA": "5BHK",
  "VILL": "5BHK",
};

export function normalizePropertyConfig(raw: string | null | undefined): PropertyConfigKey {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "2BHK";

  const upper = trimmed.toUpperCase().replace(/\s+/g, " ");
  if (CONFIG_ALIASES[upper]) return CONFIG_ALIASES[upper];

  const compact = upper.replace(/\s+/g, "");
  if (CONFIG_ALIASES[compact]) return CONFIG_ALIASES[compact];

  const bhkMatch = upper.match(/([1-5])\s*BHK/);
  if (bhkMatch) {
    const key = `${bhkMatch[1]}BHK` as PropertyConfigKey;
    if (["1BHK", "2BHK", "3BHK", "4BHK", "5BHK"].includes(key)) return key;
  }

  if (upper.includes("VILLA") || upper.includes("VILL")) return "5BHK";
  if (upper.includes("4")) return "4BHK";

  return "2BHK";
}

export interface TaskXpRule {
  milestoneIndex: number;
  milestoneName: string;
  taskName: string;
  aliases?: string[];
  slaDays: number | null;
  slaHours?: number | Record<PropertyConfigKey, number> | null;
  baseXp: number;
  isActive: boolean;
  baselineType:
    | "sales_closure_approval"
    | "group_description_completed"
    | "d1_measurement_date"
    | "d1_upload_approval"
    | "first_cut_meeting_completed"
    | "dqc1_approval"
    | "payment_10p_uploaded"
    | "payment_10p_approved"
    | "d2_masking_raise_completed"
    | "d2_masking_date"
    | "material_meeting_completed"
    | "dqc2_submission"
    | "dqc2_approval"
    | "design_sign_off_completed"
    | "payment_40p_approved"
    | "production_approval"
    | "none";
  classification: "CONFIRMED" | "EXCLUDED";
}

export function getTaskSlaHours(rule: TaskXpRule, configRaw?: string | null): number | null {
  const config = normalizePropertyConfig(configRaw);
  if (typeof rule.slaHours === "number") {
    return rule.slaHours;
  }
  if (rule.slaHours && typeof rule.slaHours === "object") {
    return (rule.slaHours as Record<PropertyConfigKey, number>)[config] ?? (rule.slaHours as Record<PropertyConfigKey, number>)["2BHK"] ?? 24;
  }
  if (rule.slaDays != null && rule.slaDays > 0) {
    return rule.slaDays * 24;
  }
  return null;
}

export const TASK_XP_RULES: TaskXpRule[] = [
  // --- Milestone 0: D1 SITE MEASUREMENT ---
  // Row 1: Group description update | SLA: blank | XP: blank
  {
    milestoneIndex: 0,
    milestoneName: "D1 SITE MEASUREMENT",
    taskName: "Group description update",
    aliases: ["Group Description"],
    slaDays: null,
    slaHours: 12,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 2: Mail loop chain 2 initiate | SLA: 12h | XP: 5
  {
    milestoneIndex: 0,
    milestoneName: "D1 SITE MEASUREMENT",
    taskName: "Mail loop chain 2 initiate",
    aliases: [
      "Mail loop chain initiated",
      "Mail loop chain 2 initiated",
      "Mail loop chain initiate",
      "Mail loop chain",
    ],
    slaDays: 0.5,
    slaHours: 12,
    baseXp: 5,
    isActive: true,
    baselineType: "group_description_completed",
    classification: "CONFIRMED",
  },
  // Row 3: D1 for MMT request | SLA: 48h | XP: blank
  {
    milestoneIndex: 0,
    milestoneName: "D1 SITE MEASUREMENT",
    taskName: "D1 for MMT request",
    slaDays: 2,
    slaHours: 48,
    baseXp: 0,
    isActive: true,
    baselineType: "sales_closure_approval",
    classification: "CONFIRMED",
  },
  // Row 4: D1 files upload | SLA: config | XP: blank
  {
    milestoneIndex: 0,
    milestoneName: "D1 SITE MEASUREMENT",
    taskName: "D1 files upload",
    slaDays: 1,
    slaHours: { "1BHK": 24, "2BHK": 24, "3BHK": 48, "4BHK": 72, "5BHK": 96 },
    baseXp: 0,
    isActive: true,
    baselineType: "d1_measurement_date",
    classification: "CONFIRMED",
  },

  // --- Milestone 1: DQC1 ---
  // Row 5: First cut design + quotation discussion meeting request | SLA: config | XP: 10
  {
    milestoneIndex: 1,
    milestoneName: "DQC1",
    taskName: "First cut design + quotation discussion meeting request",
    slaDays: 2,
    slaHours: { "1BHK": 24, "2BHK": 48, "3BHK": 48, "4BHK": 48, "5BHK": 72 },
    baseXp: 10,
    isActive: true,
    baselineType: "d1_upload_approval",
    classification: "CONFIRMED",
  },
  // Row 6: meeting completed | SLA: 48h | XP: blank
  {
    milestoneIndex: 1,
    milestoneName: "DQC1",
    taskName: "meeting completed",
    slaDays: 2,
    slaHours: 48,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 7: ADD more meetings + MOM'S | SLA: blank | XP: blank
  {
    milestoneIndex: 1,
    milestoneName: "DQC1",
    taskName: "ADD more meetings + MOM'S",
    slaDays: null,
    slaHours: null,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 8: Design finalisation meeting request | SLA: blank | XP: blank
  {
    milestoneIndex: 1,
    milestoneName: "DQC1",
    taskName: "Design finalisation meeting request",
    slaDays: null,
    slaHours: null,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 9: meeting completed (post design finalisation) | SLA: blank | XP: blank
  {
    milestoneIndex: 1,
    milestoneName: "DQC1",
    taskName: "meeting completed (post design finalisation)",
    aliases: ["meeting completed"],
    slaDays: null,
    slaHours: null,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 10: DQC 1 submission - dwg + quotation | SLA: config | XP: 10
  {
    milestoneIndex: 1,
    milestoneName: "DQC1",
    taskName: "DQC 1 submission - dwg + quotation",
    slaDays: 3,
    slaHours: { "1BHK": 48, "2BHK": 72, "3BHK": 96, "4BHK": 120, "5BHK": 120 },
    baseXp: 10,
    isActive: true,
    baselineType: "first_cut_meeting_completed",
    classification: "CONFIRMED",
  },
  // Row 11: DQC 1 approval | SLA: 24h | XP: blank
  {
    milestoneIndex: 1,
    milestoneName: "DQC1",
    taskName: "DQC 1 approval",
    slaDays: 1,
    slaHours: 24,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },

  // --- Milestone 2: 10% PAYMENT ---
  // Row 12: 10% payment collection | SLA: config | XP: 10
  {
    milestoneIndex: 2,
    milestoneName: "10% PAYMENT",
    taskName: "10% payment collection",
    slaDays: 2,
    slaHours: { "1BHK": 48, "2BHK": 48, "3BHK": 48, "4BHK": 48, "5BHK": 72 },
    baseXp: 10,
    isActive: true,
    baselineType: "dqc1_approval",
    classification: "CONFIRMED",
  },
  // Row 13: 10% payment approval | SLA: 24h | XP: blank
  {
    milestoneIndex: 2,
    milestoneName: "10% PAYMENT",
    taskName: "10% payment approval",
    slaDays: 1,
    slaHours: 24,
    baseXp: 0,
    isActive: true,
    baselineType: "payment_10p_uploaded",
    classification: "CONFIRMED",
  },

  // --- Milestone 3: D2 SITE MASKING ---
  // Row 14: D2 - masking request raise | SLA: config | XP: 5
  {
    milestoneIndex: 3,
    milestoneName: "D2 SITE MASKING",
    taskName: "D2 - masking request raise",
    slaDays: 2,
    slaHours: { "1BHK": 24, "2BHK": 48, "3BHK": 48, "4BHK": 72, "5BHK": 72 },
    baseXp: 5,
    isActive: true,
    baselineType: "payment_10p_approved",
    classification: "CONFIRMED",
  },
  // Row 15: D2 - files upload | SLA: 12h | XP: 5
  {
    milestoneIndex: 3,
    milestoneName: "D2 SITE MASKING",
    taskName: "D2 - files upload",
    slaDays: 0.5,
    slaHours: 12,
    baseXp: 5,
    isActive: true,
    baselineType: "d2_masking_raise_completed",
    classification: "CONFIRMED",
  },

  // --- Milestone 4: DQC2 ---
  // Row 16: Material selection meeting + quotation discussion | SLA: 12h | XP: blank
  {
    milestoneIndex: 4,
    milestoneName: "DQC2",
    taskName: "Material selection meeting + quotation discussion",
    slaDays: 0.5,
    slaHours: 12,
    baseXp: 0,
    isActive: true,
    baselineType: "d2_masking_date",
    classification: "CONFIRMED",
  },
  // Row 17: Material selection meeting completed | SLA: 24h | XP: blank
  {
    milestoneIndex: 4,
    milestoneName: "DQC2",
    taskName: "Material selection meeting completed",
    slaDays: 1,
    slaHours: 24,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 18: DQC 2 submission | SLA: config | XP: blank
  {
    milestoneIndex: 4,
    milestoneName: "DQC2",
    taskName: "DQC 2 submission",
    slaDays: 2,
    slaHours: { "1BHK": 24, "2BHK": 48, "3BHK": 48, "4BHK": 48, "5BHK": 72 },
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 19: DQC 2 approval | SLA: config | XP: 10
  {
    milestoneIndex: 4,
    milestoneName: "DQC2",
    taskName: "DQC 2 approval",
    aliases: ["DQC 2 approval "],
    slaDays: 2,
    slaHours: { "1BHK": 24, "2BHK": 48, "3BHK": 48, "4BHK": 48, "5BHK": 72 },
    baseXp: 10,
    isActive: true,
    baselineType: "dqc2_submission",
    classification: "CONFIRMED",
  },
  // Milestone 4: Project manager approval | SLA: 24h | XP: blank
  {
    milestoneIndex: 4,
    milestoneName: "DQC2",
    taskName: "Project manager approval",
    slaDays: 1,
    slaHours: 24,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },

  // --- Milestone 5: 40% PAYMENT ---
  // Row 20: Design sign off meeting request | SLA: config | XP: 5
  {
    milestoneIndex: 5,
    milestoneName: "40% PAYMENT",
    taskName: "Design sign off meeting request",
    aliases: ["Design sign off"],
    slaDays: 1,
    slaHours: { "1BHK": 24, "2BHK": 24, "3BHK": 48, "4BHK": 48, "5BHK": 72 },
    baseXp: 5,
    isActive: true,
    baselineType: "dqc2_approval",
    classification: "CONFIRMED",
  },
  // Row 21: meeting completed & 40% payment request | SLA: 24h | XP: 10
  {
    milestoneIndex: 5,
    milestoneName: "40% PAYMENT",
    taskName: "meeting completed & 40% payment request",
    aliases: ["meeting completed", "40% collection"],
    slaDays: 1,
    slaHours: 24,
    baseXp: 10,
    isActive: true,
    baselineType: "design_sign_off_completed",
    classification: "CONFIRMED",
  },
  // Row 22: 40% payment approval | SLA: 8h | XP: blank
  {
    milestoneIndex: 5,
    milestoneName: "40% PAYMENT",
    taskName: "40% payment approval",
    slaDays: 0.33,
    slaHours: 8,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },

  // --- Milestone 6: PUSH TO PRODUCTION ---
  // Row 23: Cx approval for production | SLA: 8h | XP: 5
  {
    milestoneIndex: 6,
    milestoneName: "PUSH TO PRODUCTION",
    taskName: "Cx approval for production",
    slaDays: 0.33,
    slaHours: 8,
    baseXp: 5,
    isActive: true,
    baselineType: "payment_40p_approved",
    classification: "CONFIRMED",
  },
  // Row 24: POC mail to cx | SLA: 24h | XP: blank
  {
    milestoneIndex: 6,
    milestoneName: "PUSH TO PRODUCTION",
    taskName: "POC mail to cx",
    aliases: ["POC mail"],
    slaDays: 1,
    slaHours: 24,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },

  // --- Milestone 7: KT TRANSFER ---
  // Task 25: Upload KT files | SLA: 24h | XP: blank
  {
    milestoneIndex: 7,
    milestoneName: "KT TRANSFER",
    taskName: "Upload KT files",
    slaDays: 1,
    slaHours: 24,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "EXCLUDED",
  },
];

export function findTaskRule(milestoneIndex: number, taskName: string): TaskXpRule | undefined {
  const norm = (taskName || "").trim().toLowerCase();
  return TASK_XP_RULES.find((r) => {
    if (r.milestoneIndex !== milestoneIndex) return false;
    if (r.taskName.trim().toLowerCase() === norm) return true;
    if (r.aliases && r.aliases.some((a) => a.trim().toLowerCase() === norm)) return true;
    return false;
  });
}

/** Commercial Rules */
export const COMMERCIAL_XP_RULES = {
  newSale: {
    xpPerLakh: 10,
    isActive: true,
  },
  upsell: {
    xpPerLakh: 20,
    isActive: true,
  },
  furniture: {
    xpPerProduct: 10,
    isActive: false, // DEFERRED
  },
};

/**
 * Dynamic on-time XP rule:
 * - If on-time (not delayed): award full baseXp (netXp = baseXp, penaltyXp = 0)
 * - If overdue (delayed): forfeit on-time XP (netXp = 0, penaltyXp = baseXp)
 */
export function calculateNetXp(
  baseXp: number,
  isDelayedOrDelayDays: boolean | number,
  delayDaysParam?: number,
): { penaltyXp: number; netXp: number } {
  let isDelayed = false;
  if (typeof isDelayedOrDelayDays === "boolean") {
    isDelayed = isDelayedOrDelayDays || (delayDaysParam != null && delayDaysParam > 0);
  } else if (typeof isDelayedOrDelayDays === "number") {
    isDelayed = isDelayedOrDelayDays > 0;
  }
  if (isDelayed) {
    return { penaltyXp: baseXp, netXp: 0 };
  }
  return { penaltyXp: 0, netXp: baseXp };
}

export interface WorkflowStepRule {
  stepKey: string;
  stepName: string;
  aliases?: string[];
  stepAllowedDays?: number;
}

export interface WorkflowXpRule {
  workflowId: string;
  milestoneIndex: number;
  milestoneName: string;
  workflowName: string;
  totalAllowedDays: number;
  rewardXp: number;
  steps: WorkflowStepRule[];
}

export const WORKFLOW_XP_RULES: WorkflowXpRule[] = [
  // 1. D1 Site Measurement (Milestone 0) - 4 days total - +5 XP
  {
    workflowId: "workflow_0_d1",
    milestoneIndex: 0,
    milestoneName: "D1 SITE MEASUREMENT",
    workflowName: "D1 Site Measurement",
    totalAllowedDays: 4,
    rewardXp: 5,
    steps: [
      {
        stepKey: "group_description",
        stepName: "Group description",
        aliases: ["Group description update", "Group Description"],
        stepAllowedDays: 0.5,
      },
      {
        stepKey: "mail_loop_chain",
        stepName: "Mail loop chain 2",
        aliases: [
          "Mail loop chain 2 initiate",
          "Mail loop chain initiated",
          "Mail loop chain 2 initiated",
          "Mail loop chain initiate",
          "Mail loop chain",
        ],
        stepAllowedDays: 0.5,
      },
      {
        stepKey: "mmt_request",
        stepName: "MMT request",
        aliases: ["D1 for MMT request", "MMT request"],
        stepAllowedDays: 2,
      },
      {
        stepKey: "d1_upload",
        stepName: "D1 upload",
        aliases: ["D1 files upload", "D1 upload"],
        stepAllowedDays: 1,
      },
    ],
  },
  // 2. DQC 1 (Milestone 1) - 3 days total - +20 XP
  {
    workflowId: "workflow_1_dqc1",
    milestoneIndex: 1,
    milestoneName: "DQC1",
    workflowName: "DQC 1",
    totalAllowedDays: 3,
    rewardXp: 20,
    steps: [
      {
        stepKey: "meeting_request",
        stepName: "Meeting request",
        aliases: [
          "First cut design + quotation discussion meeting request",
          "Meeting request",
          "First cut design",
        ],
        stepAllowedDays: 1,
      },
      {
        stepKey: "submission",
        stepName: "Submission",
        aliases: [
          "DQC 1 submission - dwg + quotation",
          "DQC 1 submission",
          "Submission",
        ],
        stepAllowedDays: 2,
      },
    ],
  },
  // 3. 10% Payment (Milestone 2) - 3 days total - +10 XP
  {
    workflowId: "workflow_2_payment_10p",
    milestoneIndex: 2,
    milestoneName: "10% PAYMENT",
    workflowName: "10% Payment",
    totalAllowedDays: 3,
    rewardXp: 10,
    steps: [
      {
        stepKey: "collection",
        stepName: "Collection",
        aliases: ["10% payment collection", "Collection"],
        stepAllowedDays: 2,
      },
      {
        stepKey: "approval",
        stepName: "Approval",
        aliases: ["10% payment approval", "Approval"],
        stepAllowedDays: 1,
      },
    ],
  },
  // 4. D2 Site Masking (Milestone 3) - 2 days total - +10 XP
  {
    workflowId: "workflow_3_d2",
    milestoneIndex: 3,
    milestoneName: "D2 SITE MASKING",
    workflowName: "D2 Site Masking",
    totalAllowedDays: 2,
    rewardXp: 10,
    steps: [
      {
        stepKey: "masking_raise",
        stepName: "Masking raise",
        aliases: ["D2 - masking request raise", "Masking raise"],
        stepAllowedDays: 1,
      },
      {
        stepKey: "files_upload",
        stepName: "Files upload",
        aliases: ["D2 - files upload", "Files upload"],
        stepAllowedDays: 1,
      },
    ],
  },
  // 5. DQC 2 (Milestone 4) - 2 days total - +10 XP
  {
    workflowId: "workflow_4_dqc2",
    milestoneIndex: 4,
    milestoneName: "DQC2",
    workflowName: "DQC 2",
    totalAllowedDays: 2,
    rewardXp: 10,
    steps: [
      {
        stepKey: "material_selection",
        stepName: "Material selection",
        aliases: [
          "Material selection meeting + quotation discussion",
          "Material selection meeting completed",
          "Material selection",
        ],
        stepAllowedDays: 1,
      },
      {
        stepKey: "submission",
        stepName: "Submission",
        aliases: ["DQC 2 submission", "Submission"],
        stepAllowedDays: 0.5,
      },
      {
        stepKey: "approval",
        stepName: "Approval",
        aliases: ["DQC 2 approval ", "DQC 2 approval", "Approval"],
        stepAllowedDays: 0.5,
      },
    ],
  },
  // 6. 40% Payment (Milestone 5) - 1 day total - +15 XP
  {
    workflowId: "workflow_5_payment_40p",
    milestoneIndex: 5,
    milestoneName: "40% PAYMENT",
    workflowName: "40% Payment",
    totalAllowedDays: 1,
    rewardXp: 15,
    steps: [
      {
        stepKey: "sign_off_request",
        stepName: "Sign off request",
        aliases: [
          "Design sign off",
          "Design sign off meeting request",
          "Sign off request",
        ],
        stepAllowedDays: 0.33,
      },
      {
        stepKey: "meeting_and_collection",
        stepName: "Meeting & collection",
        aliases: [
          "meeting completed",
          "40% collection",
          "meeting completed & 40% payment request",
          "Meeting & collection",
        ],
        stepAllowedDays: 0.33,
      },
      {
        stepKey: "approval",
        stepName: "Approval",
        aliases: ["40% payment approval", "Approval"],
        stepAllowedDays: 0.34,
      },
    ],
  },
  // 7. Push to Production (Milestone 6) - 2 days total - +5 XP
  {
    workflowId: "workflow_6_production",
    milestoneIndex: 6,
    milestoneName: "PUSH TO PRODUCTION",
    workflowName: "Push to Production",
    totalAllowedDays: 2,
    rewardXp: 5,
    steps: [
      {
        stepKey: "cx_approval",
        stepName: "Cx approval",
        aliases: ["Cx approval for production", "Cx approval"],
        stepAllowedDays: 1,
      },
      {
        stepKey: "poc_mail",
        stepName: "POC mail",
        aliases: ["POC mail", "POC mail to cx"],
        stepAllowedDays: 1,
      },
    ],
  },
];

export function findWorkflowRule(milestoneIndex: number): WorkflowXpRule | undefined {
  return WORKFLOW_XP_RULES.find((w) => w.milestoneIndex === milestoneIndex);
}

export function matchWorkflowStep(step: WorkflowStepRule, completedTaskName: string): boolean {
  const norm = (completedTaskName || "").trim().toLowerCase();
  if (step.stepName.trim().toLowerCase() === norm) return true;
  if (step.aliases && step.aliases.some((a) => a.trim().toLowerCase() === norm)) {
    return true;
  }
  return false;
}

/**
 * Total Maximum Designer Workflow XP across all 7 workflows = 65 XP
 */
export const TOTAL_POSSIBLE_WORKFLOW_XP = WORKFLOW_XP_RULES.reduce((sum, w) => sum + w.rewardXp, 0);

/**
 * Overdue Penalty rule for workflows:
 * If the complete workflow finishes after the total allowed time:
 * - The base on-time XP (+5, +10, etc.) is NOT awarded.
 * - Instead, apply: delay penalty = overdueDays * 2 = negative points.
 * - Net XP = -penalty_xp.
 */
export function calculateWorkflowNetXp(
  baseXp: number,
  isDelayed: boolean,
  overdueDays: number,
): { base_xp: number; penalty_xp: number; net_xp: number } {
  if (isDelayed && overdueDays > 0) {
    const penalty_xp = overdueDays * 2;
    return {
      base_xp: 0,
      penalty_xp,
      net_xp: -penalty_xp,
    };
  }
  return {
    base_xp: baseXp,
    penalty_xp: 0,
    net_xp: baseXp,
  };
}
