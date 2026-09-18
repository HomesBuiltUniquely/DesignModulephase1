
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

export interface TaskXpRule {
  milestoneIndex: number;
  milestoneName: string;
  taskName: string;
  aliases?: string[];
  slaDays: number | null;
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
    | "d2_masking_date"
    | "material_meeting_completed"
    | "dqc2_submission"
    | "dqc2_approval"
    | "payment_40p_approved"
    | "production_approval"
    | "none";
  classification: "CONFIRMED" | "EXCLUDED";
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
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 2: Mail loop chain 2 initiate | SLA: 1 | XP: 5
  {
    milestoneIndex: 0,
    milestoneName: "D1 SITE MEASUREMENT",
    taskName: "Mail loop chain 2 initiate",
    slaDays: 1,
    baseXp: 5,
    isActive: true,
    baselineType: "group_description_completed",
    classification: "CONFIRMED",
  },
  // Row 3: D1 for MMT request | SLA: 2 | XP: blank
  {
    milestoneIndex: 0,
    milestoneName: "D1 SITE MEASUREMENT",
    taskName: "D1 for MMT request",
    slaDays: 2,
    baseXp: 0,
    isActive: true,
    baselineType: "sales_closure_approval",
    classification: "CONFIRMED",
  },
  // Row 4: D1 files upload | SLA: 1 | XP: blank
  {
    milestoneIndex: 0,
    milestoneName: "D1 SITE MEASUREMENT",
    taskName: "D1 files upload",
    slaDays: 1,
    baseXp: 0,
    isActive: true,
    baselineType: "d1_measurement_date",
    classification: "CONFIRMED",
  },

  // --- Milestone 1: DQC1 ---
  // Row 5: First cut design + quotation discussion meeting request | SLA: 1 | XP: 10
  {
    milestoneIndex: 1,
    milestoneName: "DQC1",
    taskName: "First cut design + quotation discussion meeting request",
    slaDays: 1,
    baseXp: 10,
    isActive: true,
    baselineType: "d1_upload_approval",
    classification: "CONFIRMED",
  },
  // Row 6: meeting completed | SLA: blank | XP: blank
  {
    milestoneIndex: 1,
    milestoneName: "DQC1",
    taskName: "meeting completed",
    slaDays: null,
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
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 10: DQC 1 submission - dwg + quotation | SLA: 2 | XP: 10
  {
    milestoneIndex: 1,
    milestoneName: "DQC1",
    taskName: "DQC 1 submission - dwg + quotation",
    slaDays: 2,
    baseXp: 10,
    isActive: true,
    baselineType: "first_cut_meeting_completed",
    classification: "CONFIRMED",
  },
  // Row 11: DQC 1 approval | SLA: blank | XP: blank
  {
    milestoneIndex: 1,
    milestoneName: "DQC1",
    taskName: "DQC 1 approval",
    slaDays: null,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },

  // --- Milestone 2: 10% PAYMENT ---
  // Row 12: 10% payment collection | SLA: 2 | XP: 10
  {
    milestoneIndex: 2,
    milestoneName: "10% PAYMENT",
    taskName: "10% payment collection",
    slaDays: 2,
    baseXp: 10,
    isActive: true,
    baselineType: "dqc1_approval",
    classification: "CONFIRMED",
  },
  // Row 13: 10% payment approval | SLA: 1 | XP: blank
  {
    milestoneIndex: 2,
    milestoneName: "10% PAYMENT",
    taskName: "10% payment approval",
    slaDays: 1,
    baseXp: 0,
    isActive: true,
    baselineType: "payment_10p_uploaded",
    classification: "CONFIRMED",
  },

  // --- Milestone 3: D2 SITE MASKING ---
  // Row 14: D2 - masking request raise | SLA: 1 | XP: 5
  {
    milestoneIndex: 3,
    milestoneName: "D2 SITE MASKING",
    taskName: "D2 - masking request raise",
    slaDays: 1,
    baseXp: 5,
    isActive: true,
    baselineType: "payment_10p_approved",
    classification: "CONFIRMED",
  },
  // Row 15: D2 - files upload | SLA: blank | XP: 5
  {
    milestoneIndex: 3,
    milestoneName: "D2 SITE MASKING",
    taskName: "D2 - files upload",
    slaDays: null,
    baseXp: 5,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },

  // --- Milestone 4: DQC2 ---
  // Row 16: Material selection meeting + quotation discussion | SLA: 1 | XP: blank
  {
    milestoneIndex: 4,
    milestoneName: "DQC2",
    taskName: "Material selection meeting + quotation discussion",
    slaDays: 1,
    baseXp: 0,
    isActive: true,
    baselineType: "d2_masking_date",
    classification: "CONFIRMED",
  },
  // Row 17: Material selection meeting completed | SLA: blank | XP: blank
  {
    milestoneIndex: 4,
    milestoneName: "DQC2",
    taskName: "Material selection meeting completed",
    slaDays: null,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 18: DQC 2 submission | SLA: blank | XP: blank
  {
    milestoneIndex: 4,
    milestoneName: "DQC2",
    taskName: "DQC 2 submission",
    slaDays: null,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 19: DQC 2 approval | SLA: 1 | XP: 10
  {
    milestoneIndex: 4,
    milestoneName: "DQC2",
    taskName: "DQC 2 approval",
    aliases: ["DQC 2 approval "],
    slaDays: 1,
    baseXp: 10,
    isActive: true,
    baselineType: "dqc2_submission",
    classification: "CONFIRMED",
  },
  // Milestone 4: Project manager approval | SLA: blank | XP: blank
  {
    milestoneIndex: 4,
    milestoneName: "DQC2",
    taskName: "Project manager approval",
    slaDays: null,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },

  // --- Milestone 5: 40% PAYMENT ---
  // Row 20: Design sign off meeting request | SLA: 1 | XP: 5
  {
    milestoneIndex: 5,
    milestoneName: "40% PAYMENT",
    taskName: "Design sign off meeting request",
    aliases: ["Design sign off"],
    slaDays: 1,
    baseXp: 5,
    isActive: true,
    baselineType: "dqc2_approval",
    classification: "CONFIRMED",
  },
  // Row 21: meeting completed & 40% payment request | SLA: blank | XP: 10
  {
    milestoneIndex: 5,
    milestoneName: "40% PAYMENT",
    taskName: "meeting completed & 40% payment request",
    aliases: ["meeting completed", "40% collection"],
    slaDays: null,
    baseXp: 10,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },
  // Row 22: 40% payment approval | SLA: blank | XP: blank
  {
    milestoneIndex: 5,
    milestoneName: "40% PAYMENT",
    taskName: "40% payment approval",
    slaDays: null,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },

  // --- Milestone 6: PUSH TO PRODUCTION ---
  // Row 23: Cx approval for production | SLA: 1 | XP: 5
  {
    milestoneIndex: 6,
    milestoneName: "PUSH TO PRODUCTION",
    taskName: "Cx approval for production",
    slaDays: 1,
    baseXp: 5,
    isActive: true,
    baselineType: "payment_40p_approved",
    classification: "CONFIRMED",
  },
  // Row 24: POC mail to cx | SLA: blank | XP: blank
  {
    milestoneIndex: 6,
    milestoneName: "PUSH TO PRODUCTION",
    taskName: "POC mail to cx",
    aliases: ["POC mail"],
    slaDays: null,
    baseXp: 0,
    isActive: true,
    baselineType: "none",
    classification: "CONFIRMED",
  },

  // --- Milestone 7: KT TRANSFER ---
  // Task 25: Upload KT files | SLA: blank | XP: blank
  {
    milestoneIndex: 7,
    milestoneName: "KT TRANSFER",
    taskName: "Upload KT files",
    slaDays: null,
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

/** Delay penalty rule: 2 XP per day of delay, floored at 0 XP */
export function calculateNetXp(baseXp: number, delayDays: number): { penaltyXp: number; netXp: number } {
  const safeDelay = Math.max(0, Math.floor(delayDays || 0));
  const penaltyXp = safeDelay * 2;
  const netXp = Math.max(0, baseXp - penaltyXp);
  return { penaltyXp, netXp };
}
