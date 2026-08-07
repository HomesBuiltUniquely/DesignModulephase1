/** Designer incentives — ₹15L per calendar fortnight (1–15 / 16–month end); ₹30L per month. */

export type IncentiveSlab = {
  targetPct: number;
  revenue: number;
  incentivePct: number;
  potentialEarned: number;
};

/** Collection milestone % of quotation (sales 10% / design 10%). */
export const COLLECTION_MILESTONE_PCT = 10;
/** Design 40% payment milestone (cumulative target with prior 10%+10% = 60%). */
export const COLLECTION_FORTY_PERCENT_PCT = 40;

/**
 * Weighted credit toward incentive revenue when a collection stage clears.
 */
export const WEIGHTED_CREDIT_PCT = {
  /** Part 1: finance-approved first 10% (pre-D1) → 50% of quotation at that time */
  preD1Finance10: 50,
  /**
   * Part 2: post-DQC1 design 10% finance-approved → 25% of the *current* quotation
   * (same for upsale or downsale).
   */
  postDqc1Design10: 25,
  /**
   * Part 3: finance-approved 40% payment:
   * - Upsale (current ≥ Part 1): 25% of Part 1 quote + full upsale (current − Part 1)
   * - Downsale (current < Part 1): 25% of the *current* quotation
   */
  part3FortyPercent: 25,
} as const;

/** When current quote is below Part 1, deduct this % of the downsale from gross weighted */
export const DOWNSALE_DEDUCTION_PCT = 50;

export type IncentiveWeightStageId =
  | "pre_d1_finance_10"
  | "post_dqc1_design_10"
  | "part3_forty_percent";

export type WeightedStageCredit = {
  stageId: IncentiveWeightStageId;
  label: string;
  /** Quotation used for this stage's % weight base */
  quotationValue: number;
  /** Milestone collection amount required (10% or 40% of applicable quote) */
  collectionRequired: number;
  /** Extra collection needed when quote revised upward (Part 2 / Part 3 top-ups) */
  revisionTopUp: number;
  /** Upsale added into weighted credit (Part 3): current quote − Part 1 quote */
  upsaleAmount: number;
  collectionReceived: number;
  /** Payment request raised / amount received (may still await finance) */
  requestRaised: boolean;
  /** Finance has approved this milestone payment */
  financeApproved: boolean;
  /** Stage counts toward weighted revenue only when financeApproved */
  cleared: boolean;
  weightPct: number;
  weightedAmount: number;
};

export type DealLedgerRow = {
  id: string;
  customerName: string;
  initials: string;
  /** Current / latest quotation value */
  dealValue: number;
  /** Quotation when finance approved the first 10% (pre-D1) */
  quotationAtFinanceApproval: number;
  /** Quotation when finance approved the post-DQC1 design 10% */
  quotationAtPart2?: number;
  closureTime: "SAME DAY" | "48 HOURS" | "72 HOURS+";
  /** Sum of unlocked weight % (e.g. 50, or 75 if Parts 1+2 cleared) */
  contributionPct: number;
  /** Weighted credit from Parts 1–3 before downsale adjustment */
  grossWeightedRevenue: number;
  /** Part 1 quote − current quote when quote fell (0 if upsale / unchanged) */
  downsaleAmount: number;
  /** 50% of downsale deducted from gross weighted */
  downsaleDeduction: number;
  /** Net weighted toward incentive target (after downsale deduction) */
  weightedRevenue: number;
  stages: WeightedStageCredit[];
  incentive: number;
  /** ISO date YYYY-MM-DD within the selected fortnight */
  activityDate: string;
};

export type IncentiveCycleInfo = {
  /** Fixed target for every designer each cycle */
  totalTarget: number;
  cycleDays: number;
  cycleIndex: number;
  cycleStart: string;
  cycleEnd: string;
  /** YYYY-MM-DD (UTC) */
  startIso: string;
  /** YYYY-MM-DD (UTC) inclusive end */
  endIso: string;
  daysElapsed: number;
  daysRemaining: number;
  cycleLabel: string;
  isCurrent: boolean;
};

export type FortnightOption = {
  cycleIndex: number;
  label: string;
  startIso: string;
  endIso: string;
  isCurrent: boolean;
};

export type DayActivitySummary = {
  dateIso: string;
  dateLabel: string;
  dealCount: number;
  revenue: number;
  incentive: number;
  sameDayClosures: number;
  fortyEightHourClosures: number;
  deals: DealLedgerRow[];
};

export type WeightedRevenueBreakdown = {
  /** Part 1 — pre-D1 finance 10% collections */
  preD1Weighted: number;
  /** Part 2 — post-DQC1 design 10% collections */
  postDqc1Weighted: number;
  /** Part 3 — 40% payment + upsale */
  part3Weighted: number;
  /** Sum of per-deal gross weighted (Parts 1–3) before downsale */
  totalGrossWeighted: number;
  /** Total downsale deductions (50% of quote drop vs Part 1) */
  totalDownsaleDeduction: number;
  /** Net weighted after downsale deductions */
  totalWeighted: number;
  dealsWithPart1: number;
  dealsWithPart2: number;
  dealsWithPart3: number;
  dealsWithDownsale: number;
};

export type DesignerIncentivesData = {
  designerId: number;
  designerName: string;
  totalTarget: number;
  /** Weighted revenue (not raw collection) toward the ₹15L fortnight target */
  revenueAchieved: number;
  revenueDeltaPct: number;
  achievementPct: number;
  incentiveEarned: number;
  /** Calculated incentive before meeting eligibility gate */
  potentialIncentiveEarned: number;
  onSpotBonus: number;
  amountToNextSlab: number;
  currentSlabPct: number;
  eligibleSlabPct: number;
  incentiveMultiplierPct: number;
  slabs: IncentiveSlab[];
  sameDayClosures: number;
  sameDayBonus: number;
  fortyEightHourClosures: number;
  fortyEightHourBonus: number;
  /** Completed meetings in this fortnight */
  meetingsCompleted: number;
  /** Minimum meetings required to unlock incentives */
  meetingsRequired: number;
  meetingsEligible: boolean;
  weightedBreakdown: WeightedRevenueBreakdown;
  deals: DealLedgerRow[];
  cycle: IncentiveCycleInfo;
};

export type TeamIncentiveRow = {
  designerId: number;
  designerName: string;
  role: string;
  totalTarget: number;
  revenueAchieved: number;
  achievementPct: number;
  incentiveEarned: number;
  onSpotBonus: number;
  currentSlabPct: number;
  meetingsCompleted: number;
  meetingsRequired: number;
  meetingsEligible: boolean;
};

export type TeamIncentivesSummary = {
  memberCount: number;
  totalTarget: number;
  revenueAchieved: number;
  achievementPct: number;
  incentiveEarned: number;
  onSpotBonus: number;
  rows: TeamIncentiveRow[];
  cycle: IncentiveCycleInfo;
};

export type IncentiveMember = {
  id: number;
  name: string;
  role: string;
};

/** Per-designer target for each calendar fortnight (1–15 or 16–month end) */
export const INCENTIVE_CYCLE_TARGET = 15_00_000;
/** Monthly target = 2 fortnights */
export const INCENTIVE_MONTHLY_TARGET = 30_00_000;
/** Typical first-half length; second half is 13–16 days depending on the month */
export const INCENTIVE_CYCLE_DAYS = 15;
/** Designers must complete at least this many meetings in the fortnight to unlock incentives */
export const MIN_MEETINGS_PER_FORTNIGHT = 3;

/** Calendar fortnights start from Jan 2026 H1 (1–15) as cycleIndex 0. */
const FORTNIGHT_EPOCH_YEAR = 2026;

const SLAB_DEFS: { targetPct: number; incentivePct: number }[] = [
  { targetPct: 40, incentivePct: 0.25 },
  { targetPct: 60, incentivePct: 0.35 },
  { targetPct: 80, incentivePct: 0.45 },
  { targetPct: 90, incentivePct: 0.75 },
  { targetPct: 100, incentivePct: 1.0 },
];

function buildSlabsForTarget(totalTarget: number): IncentiveSlab[] {
  return SLAB_DEFS.map((s) => {
    const revenue = Math.round((totalTarget * s.targetPct) / 100);
    return {
      targetPct: s.targetPct,
      revenue,
      incentivePct: s.incentivePct,
      potentialEarned: Math.round((revenue * s.incentivePct) / 100),
    };
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function getIstYmd(date: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function isoFromYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fortnightBounds(
  year: number,
  monthIndex: number,
  half: 0 | 1,
): { startDay: number; endDay: number } {
  if (half === 0) return { startDay: 1, endDay: 15 };
  return { startDay: 16, endDay: daysInMonth(year, monthIndex) };
}

function cycleIndexFromYmd(year: number, monthIndex: number, day: number): number {
  const monthsSinceEpoch = (year - FORTNIGHT_EPOCH_YEAR) * 12 + monthIndex;
  const half = day <= 15 ? 0 : 1;
  return Math.max(0, monthsSinceEpoch * 2 + half);
}

function ymdFromCycleIndex(cycleIndex: number): {
  year: number;
  monthIndex: number;
  half: 0 | 1;
  startDay: number;
  endDay: number;
} {
  const idx = Math.max(0, Math.floor(cycleIndex));
  const monthsSinceEpoch = Math.floor(idx / 2);
  const half = (idx % 2) as 0 | 1;
  const year = FORTNIGHT_EPOCH_YEAR + Math.floor(monthsSinceEpoch / 12);
  const monthIndex = monthsSinceEpoch % 12;
  const { startDay, endDay } = fortnightBounds(year, monthIndex, half);
  return { year, monthIndex, half, startDay, endDay };
}

function fmtIn(ms: number): string {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function toIsoUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function msFromIsoDay(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`);
}

export function getCurrentCycleIndex(now: Date = new Date()): number {
  const { year, month, day } = getIstYmd(now);
  return cycleIndexFromYmd(year, month, day);
}

export function getIncentiveCycleByIndex(
  cycleIndex: number,
  now: Date = new Date(),
): IncentiveCycleInfo {
  const { year, monthIndex, startDay, endDay } = ymdFromCycleIndex(cycleIndex);
  const startIso = isoFromYmd(year, monthIndex, startDay);
  const endIso = isoFromYmd(year, monthIndex, endDay);
  const cycleDays = endDay - startDay + 1;
  const startMs = msFromIsoDay(startIso);
  const endMs = msFromIsoDay(endIso);
  const currentIndex = getCurrentCycleIndex(now);
  const isCurrent = cycleIndex === currentIndex;
  const today = getIstYmd(now);
  const todayIso = isoFromYmd(today.year, today.month, today.day);
  const todayMs = msFromIsoDay(todayIso);

  let daysElapsed = 0;
  let daysRemaining = 0;
  if (isCurrent) {
    daysElapsed = Math.min(cycleDays, Math.floor((todayMs - startMs) / DAY_MS) + 1);
    daysRemaining = Math.max(0, Math.floor((endMs - todayMs) / DAY_MS) + 1);
  } else if (cycleIndex < currentIndex) {
    daysElapsed = cycleDays;
    daysRemaining = 0;
  } else {
    daysElapsed = 0;
    daysRemaining = cycleDays;
  }

  return {
    totalTarget: INCENTIVE_CYCLE_TARGET,
    cycleDays,
    cycleIndex: Math.max(0, Math.floor(cycleIndex)),
    cycleStart: fmtIn(startMs),
    cycleEnd: fmtIn(endMs),
    startIso,
    endIso,
    daysElapsed,
    daysRemaining,
    cycleLabel: `${fmtIn(startMs)} – ${fmtIn(endMs)}`,
    isCurrent,
  };
}

export function getIncentiveCycleInfo(now: Date = new Date()): IncentiveCycleInfo {
  return getIncentiveCycleByIndex(getCurrentCycleIndex(now), now);
}

/** Recent fortnights for the filter dropdown (newest first). */
export function listFortnightOptions(
  count = 8,
  now: Date = new Date(),
): FortnightOption[] {
  const current = getCurrentCycleIndex(now);
  const options: FortnightOption[] = [];
  for (let i = 0; i < count; i++) {
    const cycleIndex = current - i;
    if (cycleIndex < 0) break;
    const c = getIncentiveCycleByIndex(cycleIndex, now);
    const halfLabel = Number(c.startIso.slice(8, 10)) <= 15 ? "1–15" : "16–end";
    options.push({
      cycleIndex: c.cycleIndex,
      label: c.isCurrent ? `Current · ${halfLabel} · ${c.cycleLabel}` : `${halfLabel} · ${c.cycleLabel}`,
      startIso: c.startIso,
      endIso: c.endIso,
      isCurrent: c.isCurrent,
    });
  }
  return options;
}

export function listDatesInCycle(cycle: IncentiveCycleInfo): string[] {
  const start = msFromIsoDay(cycle.startIso);
  const end = msFromIsoDay(cycle.endIso);
  const dates: string[] = [];
  for (let t = start; t <= end; t += DAY_MS) {
    dates.push(toIsoUtcDay(t));
  }
  return dates;
}

export function filterDealsByDate(
  deals: DealLedgerRow[],
  dateIso: string | null | undefined,
): DealLedgerRow[] {
  if (!dateIso) return deals;
  return deals.filter((d) => d.activityDate === dateIso);
}

export function buildDayActivitySummary(
  deals: DealLedgerRow[],
  dateIso: string,
): DayActivitySummary {
  const dayDeals = filterDealsByDate(deals, dateIso);
  const revenue = dayDeals.reduce((s, d) => s + d.weightedRevenue, 0);
  const incentive = dayDeals.reduce((s, d) => s + d.incentive, 0);
  return {
    dateIso,
    dateLabel: fmtIn(Date.parse(`${dateIso}T00:00:00.000Z`)),
    dealCount: dayDeals.length,
    revenue,
    incentive,
    sameDayClosures: dayDeals.filter((d) => d.closureTime === "SAME DAY").length,
    fortyEightHourClosures: dayDeals.filter((d) => d.closureTime === "48 HOURS").length,
    deals: dayDeals,
  };
}

/**
 * Weighted incentive revenue from collection milestones.
 *
 * Part 1 (pre-D1): finance approves first 10% → credit 50% of that quotation.
 * Part 2 (post-DQC1): design 10% of current quote finance-approved
 *   → credit 25% of the current quotation (upsale or downsale).
 * Part 3 (40% payment):
 *   - Upsale: 25% of Part 1 quotation + full upsale (current − Part 1).
 *     Example: Part 1 = 10L, now 14L → 2.5L + 4L = 6.5L.
 *   - Downsale: 25% of the *current* quotation.
 *     Example: Part 1 = 10L, Part 2 at 8L → +2L; Part 3 at 6L → +1.5L.
 * Downsale deduction (after Parts 1–3): if final quote is below Part 1
 *   (e.g. 10L → 6L = 4L downsale), deduct 50% of that downsale (2L) from gross weighted.
 */
export function computeDownsaleAdjustment(
  quotationAtFinanceApproval: number,
  quotationCurrent: number,
  grossWeighted: number,
): { downsaleAmount: number; downsaleDeduction: number; netWeighted: number } {
  const quoteAtApproval = Math.max(0, quotationAtFinanceApproval);
  const quoteCurrent = Math.max(0, quotationCurrent);
  const downsaleAmount = Math.max(0, quoteAtApproval - quoteCurrent);
  const downsaleDeduction =
    downsaleAmount > 0
      ? Math.round((downsaleAmount * DOWNSALE_DEDUCTION_PCT) / 100)
      : 0;
  const netWeighted = Math.max(0, grossWeighted - downsaleDeduction);
  return { downsaleAmount, downsaleDeduction, netWeighted };
}

export function computeWeightedStages(input: {
  quotationAtFinanceApproval: number;
  quotationAtPart2?: number;
  quotationCurrent: number;
  /** Amount collected toward the first (sales) 10% */
  salesTenPercentCollected: number;
  /** Finance has approved the first (sales) 10% payment */
  salesTenPercentFinanceApproved: boolean;
  /**
   * Cumulative paid / requested toward sales 10% + design 10% (20% of current quote),
   * including revision top-up. Amount alone is not enough for Part 2 credit.
   */
  cumulativeCollectedTowardDesign10: number;
  /**
   * Finance has approved the post-DQC1 design 10% payment request
   * (including any quote-revision top-up). Required for Part 2 weighted credit.
   */
  designTenPercentFinanceApproved: boolean;
  /**
   * Cumulative paid / requested toward 60% of current quote
   * (sales 10% + design 10% + design 40%).
   */
  cumulativeCollectedTowardFortyPercent: number;
  /** Finance has approved the 40% payment collection request */
  fortyPercentFinanceApproved: boolean;
}): WeightedStageCredit[] {
  const quoteAtApproval = Math.max(0, input.quotationAtFinanceApproval);
  const quoteCurrent = Math.max(0, input.quotationCurrent);
  const quoteAtPart2 = input.quotationAtPart2 != null && input.quotationAtPart2 > 0 ? input.quotationAtPart2 : quoteCurrent;
  
  const salesTenRequired = Math.round((quoteAtApproval * COLLECTION_MILESTONE_PCT) / 100);
  const designTenOfPart2 = Math.round((quoteAtPart2 * COLLECTION_MILESTONE_PCT) / 100);
  const priorTenOfOld = Math.round((quoteAtApproval * COLLECTION_MILESTONE_PCT) / 100);
  const revisionTopUp = Math.max(0, designTenOfPart2 - priorTenOfOld);
  
  // Design 10% milestone: 20% cumulative of Part 2 quote
  const twentyPercentOfPart2 = Math.round((quoteAtPart2 * 20) / 100);
  
  // 40% payment milestone: 60% cumulative of current quote
  const sixtyPercentOfCurrent = Math.round((quoteCurrent * 60) / 100);
  const fortyPercentOfCurrent = Math.round(
    (quoteCurrent * COLLECTION_FORTY_PERCENT_PCT) / 100,
  );
  const upsaleAmount = Math.max(0, quoteCurrent - quoteAtApproval);
  const downsaleAmount = Math.max(0, quoteAtApproval - quoteCurrent);
  const isDownsale = downsaleAmount > 0;

  // New drop threshold checks:
  const part2Drop = quoteAtApproval - quoteAtPart2;
  const part2DropPct = quoteAtApproval > 0 ? part2Drop / quoteAtApproval : 0;

  const part3Drop = quoteAtPart2 - quoteCurrent;
  const part3DropPct = quoteAtPart2 > 0 ? part3Drop / quoteAtPart2 : 0;

  // Base quotations for weighted calculations based on the 20% rule:
  const part2BaseQuote = part2DropPct >= 0.20 ? quoteAtPart2 : quoteAtApproval;
  const part3BaseQuote = part3DropPct >= 0.20 ? quoteCurrent : quoteAtPart2;

  const part1AmountMet = salesTenRequired > 0 && input.salesTenPercentCollected >= salesTenRequired;
  const part1Cleared = part1AmountMet && input.salesTenPercentFinanceApproved;

  const part2AmountMet =
    part1Cleared &&
    twentyPercentOfPart2 > 0 &&
    input.cumulativeCollectedTowardDesign10 >= twentyPercentOfPart2;
  const part2RequestRaised = part2AmountMet;
  const part2Cleared = part2RequestRaised && input.designTenPercentFinanceApproved;

  const part3AmountMet =
    part2Cleared &&
    sixtyPercentOfCurrent > 0 &&
    input.cumulativeCollectedTowardFortyPercent >= sixtyPercentOfCurrent;
  const part3RequestRaised = part3AmountMet;
  const part3Cleared = part3RequestRaised && input.fortyPercentFinanceApproved;

  const part1Weighted = part1Cleared
    ? Math.round((quoteAtApproval * WEIGHTED_CREDIT_PCT.preD1Finance10) / 100)
    : 0;
  // Part 2: 25% of part2BaseQuote
  const part2Weighted = part2Cleared
    ? Math.round((part2BaseQuote * WEIGHTED_CREDIT_PCT.postDqc1Design10) / 100)
    : 0;
  // Part 3: upsale → 25% of Part 1 + full upsale; downsale → 25% of part3BaseQuote
  const part3Weighted = part3Cleared
    ? (quoteCurrent < quoteAtApproval) // Net downsale vs Part 1
      ? Math.round((part3BaseQuote * WEIGHTED_CREDIT_PCT.part3FortyPercent) / 100)
      : Math.round((quoteAtApproval * WEIGHTED_CREDIT_PCT.part3FortyPercent) / 100) +
        upsaleAmount
    : 0;

  return [
    {
      stageId: "pre_d1_finance_10",
      label: "Part 1 · Pre-D1 finance 10%",
      quotationValue: quoteAtApproval,
      collectionRequired: salesTenRequired,
      revisionTopUp: 0,
      upsaleAmount: 0,
      collectionReceived: Math.min(input.salesTenPercentCollected, salesTenRequired),
      requestRaised: part1AmountMet,
      financeApproved: input.salesTenPercentFinanceApproved && part1AmountMet,
      cleared: part1Cleared,
      weightPct: WEIGHTED_CREDIT_PCT.preD1Finance10,
      weightedAmount: part1Weighted,
    },
    {
      stageId: "post_dqc1_design_10",
      label: "Part 2 · Post-DQC1 design 10%",
      quotationValue: part2BaseQuote,
      collectionRequired: designTenOfPart2,
      revisionTopUp,
      upsaleAmount: 0,
      collectionReceived: Math.max(
        0,
        Math.min(
          input.cumulativeCollectedTowardDesign10 - (part1Cleared ? salesTenRequired : 0),
          designTenOfPart2 + revisionTopUp,
        ),
      ),
      requestRaised: part2RequestRaised,
      financeApproved: part2Cleared,
      cleared: part2Cleared,
      weightPct: WEIGHTED_CREDIT_PCT.postDqc1Design10,
      weightedAmount: part2Weighted,
    },
    {
      stageId: "part3_forty_percent",
      label: isDownsale ? "Part 3 · 40% payment (downsale)" : "Part 3 · 40% payment + upsale",
      quotationValue: (quoteCurrent < quoteAtApproval) ? part3BaseQuote : quoteAtApproval,
      collectionRequired: fortyPercentOfCurrent,
      revisionTopUp: Math.max(
        0,
        sixtyPercentOfCurrent - Math.round((quoteAtApproval * 60) / 100),
      ),
      upsaleAmount,
      collectionReceived: Math.max(
        0,
        Math.min(
          input.cumulativeCollectedTowardFortyPercent -
            (part2Cleared ? twentyPercentOfPart2 : 0),
          fortyPercentOfCurrent,
        ),
      ),
      requestRaised: part3RequestRaised,
      financeApproved: part3Cleared,
      cleared: part3Cleared,
      weightPct: WEIGHTED_CREDIT_PCT.part3FortyPercent,
      weightedAmount: part3Weighted,
    },
  ];
}

export function summarizeWeightedBreakdown(deals: DealLedgerRow[]): WeightedRevenueBreakdown {
  let preD1Weighted = 0;
  let postDqc1Weighted = 0;
  let part3Weighted = 0;
  let totalGrossWeighted = 0;
  let totalDownsaleDeduction = 0;
  let dealsWithPart1 = 0;
  let dealsWithPart2 = 0;
  let dealsWithPart3 = 0;
  let dealsWithDownsale = 0;
  for (const d of deals) {
    totalGrossWeighted += d.grossWeightedRevenue;
    totalDownsaleDeduction += d.downsaleDeduction;
    if (d.downsaleAmount > 0) dealsWithDownsale += 1;
    for (const s of d.stages) {
      if (s.stageId === "pre_d1_finance_10" && s.cleared) {
        preD1Weighted += s.weightedAmount;
        dealsWithPart1 += 1;
      }
      if (s.stageId === "post_dqc1_design_10" && s.cleared) {
        postDqc1Weighted += s.weightedAmount;
        dealsWithPart2 += 1;
      }
      if (s.stageId === "part3_forty_percent" && s.cleared) {
        part3Weighted += s.weightedAmount;
        dealsWithPart3 += 1;
      }
    }
  }
  const totalWeighted = deals.reduce((s, d) => s + d.weightedRevenue, 0);
  return {
    preD1Weighted,
    postDqc1Weighted,
    part3Weighted,
    totalGrossWeighted,
    totalDownsaleDeduction,
    totalWeighted,
    dealsWithPart1,
    dealsWithPart2,
    dealsWithPart3,
    dealsWithDownsale,
  };
}

const DEMO_CUSTOMERS = [
  "Juned Shaikh",
  "Priya Nair",
  "Rahul Mehta",
  "Ananya Krishnan",
  "Vikram Singh",
  "Sneha Reddy",
  "Arjun Patel",
  "Meera Iyer",
] as const;

function hashSeed(id: number): number {
  let x = (id * 2654435761) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export type IncentiveDealInput = {
  id: string;
  customerName: string;
  quotationAtFinanceApproval: number;
  quotationAtPart2?: number;
  quotationCurrent: number;
  salesTenPercentCollected: number;
  salesTenPercentFinanceApproved: boolean;
  cumulativeCollectedTowardDesign10: number;
  designTenPercentFinanceApproved: boolean;
  cumulativeCollectedTowardFortyPercent: number;
  fortyPercentFinanceApproved: boolean;
  /** Which stages unlocked inside this fortnight (credit only these). */
  creditPart1InCycle: boolean;
  creditPart2InCycle: boolean;
  creditPart3InCycle: boolean;
  activityDate: string;
  closureTime?: DealLedgerRow["closureTime"];
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

function pickSlab(achievementPct: number): number {
  if (achievementPct >= 100) return 100;
  if (achievementPct >= 90) return 90;
  if (achievementPct >= 80) return 80;
  if (achievementPct >= 60) return 60;
  if (achievementPct >= 40) return 40;
  return 0;
}

function multiplierForSlab(slab: number): number {
  if (slab <= 0) return 0;
  return SLAB_DEFS.find((s) => s.targetPct === slab)?.incentivePct ?? 0;
}

/**
 * Build designer incentives from real (or demo) deal inputs for a fortnight.
 * Only stages flagged `creditPart*InCycle` contribute weighted revenue this cycle.
 */
export function buildIncentivesFromDealInputs(
  member: IncentiveMember,
  cycle: IncentiveCycleInfo,
  dealInputs: IncentiveDealInput[],
  meetingsCompleted: number,
  options?: { revenueDeltaPct?: number },
): DesignerIncentivesData {
  const totalTarget = cycle.totalTarget;
  const slabs = buildSlabsForTarget(totalTarget);
  const meetingsRequired = MIN_MEETINGS_PER_FORTNIGHT;

  const deals: DealLedgerRow[] = dealInputs
    .filter((d) => d.creditPart1InCycle || d.creditPart2InCycle || d.creditPart3InCycle)
    .map((d) => {
      const stagesRaw = computeWeightedStages({
        quotationAtFinanceApproval: d.quotationAtFinanceApproval,
        quotationAtPart2: d.quotationAtPart2,
        quotationCurrent: d.quotationCurrent,
        salesTenPercentCollected: d.salesTenPercentCollected,
        salesTenPercentFinanceApproved: d.salesTenPercentFinanceApproved,
        cumulativeCollectedTowardDesign10: d.cumulativeCollectedTowardDesign10,
        designTenPercentFinanceApproved: d.designTenPercentFinanceApproved,
        cumulativeCollectedTowardFortyPercent: d.cumulativeCollectedTowardFortyPercent,
        fortyPercentFinanceApproved: d.fortyPercentFinanceApproved,
      });
      const stages = stagesRaw.map((s) => {
        const creditThisCycle =
          (s.stageId === "pre_d1_finance_10" && d.creditPart1InCycle) ||
          (s.stageId === "post_dqc1_design_10" && d.creditPart2InCycle) ||
          (s.stageId === "part3_forty_percent" && d.creditPart3InCycle);
        if (creditThisCycle && s.cleared) return s;
        return {
          ...s,
          cleared: false,
          weightedAmount: 0,
        };
      });
      const grossWeightedRevenue = stages.reduce((sum, st) => sum + st.weightedAmount, 0);
      const { downsaleAmount, downsaleDeduction, netWeighted } = computeDownsaleAdjustment(
        d.quotationAtFinanceApproval,
        d.quotationCurrent,
        grossWeightedRevenue,
      );
      const contributionPct = stages.reduce((sum, st) => sum + (st.cleared ? st.weightPct : 0), 0);
      return {
        id: d.id,
        customerName: d.customerName,
        initials: initialsFromName(d.customerName),
        dealValue: d.quotationCurrent,
        quotationAtFinanceApproval: d.quotationAtFinanceApproval,
        quotationAtPart2: d.quotationAtPart2,
        closureTime: d.closureTime || "48 HOURS",
        contributionPct,
        grossWeightedRevenue,
        downsaleAmount,
        downsaleDeduction,
        weightedRevenue: netWeighted,
        stages,
        incentive: 0,
        activityDate: d.activityDate,
      };
    })
    .sort((a, b) => a.activityDate.localeCompare(b.activityDate));

  const weightedBreakdown = summarizeWeightedBreakdown(deals);
  const revenueAchieved = weightedBreakdown.totalWeighted;
  const achievementPct =
    totalTarget > 0 ? Math.round((revenueAchieved / totalTarget) * 1000) / 10 : 0;
  const currentSlabPct = pickSlab(achievementPct);
  const incentiveMultiplierPct = multiplierForSlab(currentSlabPct);

  const dealsWithIncentive = deals.map((row) => ({
    ...row,
    incentive: Math.round((row.weightedRevenue * incentiveMultiplierPct) / 100),
  }));

  const potentialIncentiveEarned = Math.round((revenueAchieved * incentiveMultiplierPct) / 100);
  const meetingsEligible = meetingsCompleted >= meetingsRequired;
  const incentiveEarned = meetingsEligible ? potentialIncentiveEarned : 0;
  const sameDayClosures = dealsWithIncentive.filter((row) => row.closureTime === "SAME DAY").length;
  const fortyEightHourClosures = dealsWithIncentive.filter(
    (row) => row.closureTime === "48 HOURS",
  ).length;
  const sameDayBonus = sameDayClosures * 750;
  const fortyEightHourBonus = fortyEightHourClosures * 375;
  const onSpotBonus = meetingsEligible ? sameDayBonus + fortyEightHourBonus : 0;
  const nextSlab =
    slabs.find((s) => s.targetPct > currentSlabPct)?.revenue ??
    (currentSlabPct <= 0 ? slabs[0]?.revenue ?? totalTarget : totalTarget);
  const amountToNextSlab = Math.max(0, nextSlab - revenueAchieved);

  const finalDeals = meetingsEligible
    ? dealsWithIncentive
    : dealsWithIncentive.map((row) => ({ ...row, incentive: 0 }));

  return {
    designerId: member.id,
    designerName: member.name,
    totalTarget,
    revenueAchieved,
    revenueDeltaPct: options?.revenueDeltaPct ?? 0,
    achievementPct,
    incentiveEarned,
    potentialIncentiveEarned,
    onSpotBonus,
    amountToNextSlab,
    currentSlabPct,
    eligibleSlabPct: currentSlabPct,
    incentiveMultiplierPct,
    slabs,
    sameDayClosures,
    sameDayBonus: meetingsEligible ? sameDayBonus : 0,
    fortyEightHourClosures,
    fortyEightHourBonus: meetingsEligible ? fortyEightHourBonus : 0,
    meetingsCompleted,
    meetingsRequired,
    meetingsEligible,
    weightedBreakdown,
    deals: finalDeals,
    cycle,
  };
}

/**
 * Deterministic demo incentives for a selected calendar fortnight.
 * Target is ₹15L per fortnight (₹30L/month); progress is driven by weighted collection milestones
 * (Parts 1–3) until a real API exists.
 */
export function buildDemoIncentivesForDesigner(
  member: IncentiveMember,
  cycleIndexOrNow: number | Date = new Date(),
  now: Date = new Date(),
): DesignerIncentivesData {
  const cycleIndex =
    typeof cycleIndexOrNow === "number"
      ? cycleIndexOrNow
      : getCurrentCycleIndex(cycleIndexOrNow);
  const asOf = typeof cycleIndexOrNow === "number" ? now : cycleIndexOrNow;
  const cycle = getIncentiveCycleByIndex(cycleIndex, asOf);
  const totalTarget = cycle.totalTarget;
  const slabs = buildSlabsForTarget(totalTarget);
  const seed = hashSeed((member.id || 1) * 31 + cycle.cycleIndex * 17);

  const cycleDates = listDatesInCycle(cycle);
  const daysForDeals = cycle.isCurrent
    ? cycleDates.slice(0, Math.max(1, cycle.daysElapsed))
    : cycleDates;
  const dealCount = Math.min(daysForDeals.length, 4 + (seed % 5));

  const deals: DealLedgerRow[] = Array.from({ length: dealCount }, (_, i) => {
    const customerName = DEMO_CUSTOMERS[(seed + i) % DEMO_CUSTOMERS.length];
    const quotationAtFinanceApproval = 8_00_000 + ((seed + i * 97) % 7) * 1_00_000;
    // Quote revision: upsale, flat, or downsale (e.g. 10L → 8L → 6L)
    const quoteRoll = (seed + i * 11) % 7;
    const quotationCurrent =
      quoteRoll <= 1
        ? quotationAtFinanceApproval + (1 + (seed % 3)) * 1_00_000
        : quoteRoll <= 3
          ? quotationAtFinanceApproval
          : quotationAtFinanceApproval - (1 + (quoteRoll % 3)) * 1_00_000;
    // 0 neither, 1 P1, 2 P2 pending, 3 P2 approved, 4 P3 pending, 5 P3 approved
    const stageRoll = (seed + i * 5) % 8;
    const stageProgress =
      stageRoll <= 1 ? 0 : stageRoll <= 3 ? 1 : stageRoll === 4 ? 2 : stageRoll === 5 ? 3 : stageRoll === 6 ? 4 : 5;
    const salesTenRequired = Math.round((quotationAtFinanceApproval * COLLECTION_MILESTONE_PCT) / 100);
    const twentyPctCurrent = Math.round((quotationCurrent * 20) / 100);
    const sixtyPctCurrent = Math.round((quotationCurrent * 60) / 100);
    const salesTenPercentCollected = stageProgress >= 1 ? salesTenRequired : Math.round(salesTenRequired * 0.4);
    const salesTenPercentFinanceApproved = stageProgress >= 1;
    const cumulativeCollectedTowardDesign10 =
      stageProgress >= 2
        ? twentyPctCurrent
        : stageProgress >= 1
          ? salesTenRequired
          : salesTenPercentCollected;
    const designTenPercentFinanceApproved = stageProgress >= 3;
    const cumulativeCollectedTowardFortyPercent =
      stageProgress >= 4
        ? sixtyPctCurrent
        : stageProgress >= 3
          ? twentyPctCurrent
          : cumulativeCollectedTowardDesign10;
    const fortyPercentFinanceApproved = stageProgress >= 5;
    const stages = computeWeightedStages({
      quotationAtFinanceApproval,
      quotationCurrent,
      salesTenPercentCollected,
      salesTenPercentFinanceApproved,
      cumulativeCollectedTowardDesign10,
      designTenPercentFinanceApproved,
      cumulativeCollectedTowardFortyPercent,
      fortyPercentFinanceApproved,
    });
    const grossWeightedRevenue = stages.reduce((s, st) => s + st.weightedAmount, 0);
    const { downsaleAmount, downsaleDeduction, netWeighted } = computeDownsaleAdjustment(
      quotationAtFinanceApproval,
      quotationCurrent,
      grossWeightedRevenue,
    );
    const contributionPct = stages.reduce((s, st) => s + (st.cleared ? st.weightPct : 0), 0);
    const closureRoll = (seed + i * 3) % 3;
    const closureTime: DealLedgerRow["closureTime"] =
      closureRoll === 0 ? "SAME DAY" : closureRoll === 1 ? "48 HOURS" : "72 HOURS+";
    const activityDate = daysForDeals[(seed + i * 5) % daysForDeals.length];
    return {
      id: `${member.id}-${cycle.cycleIndex}-${i + 1}`,
      customerName,
      initials: initialsFromName(customerName),
      dealValue: quotationCurrent,
      quotationAtFinanceApproval,
      closureTime,
      contributionPct,
      grossWeightedRevenue,
      downsaleAmount,
      downsaleDeduction,
      weightedRevenue: netWeighted,
      stages,
      incentive: 0, // filled after slab multiplier known
      activityDate,
    };
  }).sort((a, b) => a.activityDate.localeCompare(b.activityDate));

  const weightedBreakdown = summarizeWeightedBreakdown(deals);
  const revenueAchieved = weightedBreakdown.totalWeighted;
  const achievementPct =
    totalTarget > 0 ? Math.round((revenueAchieved / totalTarget) * 1000) / 10 : 0;
  const currentSlabPct = pickSlab(achievementPct);
  const incentiveMultiplierPct = multiplierForSlab(currentSlabPct);

  const dealsWithIncentive = deals.map((d) => {
    const dealIncentiveBase = Math.round((d.weightedRevenue * incentiveMultiplierPct) / 100);
    return { ...d, incentive: dealIncentiveBase };
  });

  const potentialIncentiveEarned = Math.round((revenueAchieved * incentiveMultiplierPct) / 100);
  // Demo meeting count: varies by designer/cycle; some fall short of the 3-meeting gate
  const meetingsRequired = MIN_MEETINGS_PER_FORTNIGHT;
  const meetingsCompleted =
    seed % 6 === 0 ? 0 : seed % 6 === 1 ? 1 : seed % 6 === 2 ? 2 : 3 + (seed % 3);
  const meetingsEligible = meetingsCompleted >= meetingsRequired;
  const incentiveEarned = meetingsEligible ? potentialIncentiveEarned : 0;
  const sameDayClosures = dealsWithIncentive.filter((d) => d.closureTime === "SAME DAY").length;
  const fortyEightHourClosures = dealsWithIncentive.filter((d) => d.closureTime === "48 HOURS").length;
  const sameDayBonus = sameDayClosures * 750;
  const fortyEightHourBonus = fortyEightHourClosures * 375;
  const onSpotBonus = meetingsEligible ? sameDayBonus + fortyEightHourBonus : 0;
  const nextSlab =
    slabs.find((s) => s.targetPct > currentSlabPct)?.revenue ??
    (currentSlabPct <= 0 ? slabs[0]?.revenue ?? totalTarget : totalTarget);
  const amountToNextSlab = Math.max(0, nextSlab - revenueAchieved);

  const finalDeals = meetingsEligible
    ? dealsWithIncentive
    : dealsWithIncentive.map((d) => ({ ...d, incentive: 0 }));

  return {
    designerId: member.id,
    designerName: member.name,
    totalTarget,
    revenueAchieved,
    revenueDeltaPct: 4 + (seed % 12),
    achievementPct,
    incentiveEarned,
    potentialIncentiveEarned,
    onSpotBonus,
    amountToNextSlab,
    currentSlabPct,
    eligibleSlabPct: currentSlabPct,
    incentiveMultiplierPct,
    slabs,
    sameDayClosures,
    sameDayBonus: meetingsEligible ? sameDayBonus : 0,
    fortyEightHourClosures,
    fortyEightHourBonus: meetingsEligible ? fortyEightHourBonus : 0,
    meetingsCompleted,
    meetingsRequired,
    meetingsEligible,
    weightedBreakdown,
    deals: finalDeals,
    cycle,
  };
}

export function buildTeamIncentivesSummary(
  members: IncentiveMember[],
  cycleIndexOrNow: number | Date = new Date(),
  now: Date = new Date(),
): TeamIncentivesSummary {
  const cycleIndex =
    typeof cycleIndexOrNow === "number"
      ? cycleIndexOrNow
      : getCurrentCycleIndex(cycleIndexOrNow);
  const asOf = typeof cycleIndexOrNow === "number" ? now : cycleIndexOrNow;
  const cycle = getIncentiveCycleByIndex(cycleIndex, asOf);
  const designers = members.filter(
    (m) =>
      (m.role || "").toLowerCase() === "designer" ||
      (m.role || "").toLowerCase() === "design_manager",
  );
  const rows: TeamIncentiveRow[] = designers.map((m) => {
    const d = buildDemoIncentivesForDesigner(m, cycleIndex, asOf);
    return {
      designerId: m.id,
      designerName: m.name,
      role: m.role,
      totalTarget: d.totalTarget,
      revenueAchieved: d.revenueAchieved,
      achievementPct: d.achievementPct,
      incentiveEarned: d.incentiveEarned,
      onSpotBonus: d.onSpotBonus,
      currentSlabPct: d.currentSlabPct,
      meetingsCompleted: d.meetingsCompleted,
      meetingsRequired: d.meetingsRequired,
      meetingsEligible: d.meetingsEligible,
    };
  });
  const totalTarget = rows.reduce((s, r) => s + r.totalTarget, 0);
  const revenueAchieved = rows.reduce((s, r) => s + r.revenueAchieved, 0);
  const incentiveEarned = rows.reduce((s, r) => s + r.incentiveEarned, 0);
  const onSpotBonus = rows.reduce((s, r) => s + r.onSpotBonus, 0);
  const achievementPct =
    totalTarget > 0 ? Math.round((revenueAchieved / totalTarget) * 1000) / 10 : 0;
  return {
    memberCount: rows.length,
    totalTarget,
    revenueAchieved,
    achievementPct,
    incentiveEarned,
    onSpotBonus,
    rows: rows.sort((a, b) => b.incentiveEarned - a.incentiveEarned),
    cycle,
  };
}

export const DEMO_DESIGNER_INCENTIVES = buildDemoIncentivesForDesigner({
  id: 1,
  name: "Designer",
  role: "designer",
});

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatInrCompact(amount: number): string {
  return `₹ ${amount.toLocaleString("en-IN")}`;
}

export function canManageTeamIncentives(role: string | undefined | null): boolean {
  const r = (role || "").toLowerCase();
  return (
    r === "design_manager" ||
    r === "territorial_design_manager" ||
    r === "deputy_general_manager" ||
    r === "admin"
  );
}
