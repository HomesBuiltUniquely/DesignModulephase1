/** Designer incentives — ₹30L target per 15-day cycle (resets automatically). */

export type IncentiveSlab = {
  targetPct: number;
  revenue: number;
  incentivePct: number;
  potentialEarned: number;
};

export type DealLedgerRow = {
  id: string;
  customerName: string;
  initials: string;
  dealValue: number;
  closureTime: "SAME DAY" | "48 HOURS" | "72 HOURS+";
  contributionPct: number;
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

export type DesignerIncentivesData = {
  designerId: number;
  designerName: string;
  totalTarget: number;
  revenueAchieved: number;
  revenueDeltaPct: number;
  achievementPct: number;
  incentiveEarned: number;
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

/** Per-designer target for each 15-day cycle */
export const INCENTIVE_CYCLE_TARGET = 30_00_000;
export const INCENTIVE_CYCLE_DAYS = 15;

/** Anchor so cycles are consistent across users (IST-friendly UTC midnight of 1 Jan 2026). */
const CYCLE_EPOCH_UTC = Date.UTC(2026, 0, 1);

const SLAB_DEFS: { targetPct: number; incentivePct: number }[] = [
  { targetPct: 40, incentivePct: 0.25 },
  { targetPct: 50, incentivePct: 0.45 },
  { targetPct: 60, incentivePct: 0.55 },
  { targetPct: 80, incentivePct: 0.75 },
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

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function fmtIn(ms: number): string {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function toIsoUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function getCurrentCycleIndex(now: Date = new Date()): number {
  const cycleMs = INCENTIVE_CYCLE_DAYS * DAY_MS;
  const nowUtc = startOfUtcDay(now.getTime());
  const elapsed = Math.max(0, nowUtc - CYCLE_EPOCH_UTC);
  return Math.floor(elapsed / cycleMs);
}

export function getIncentiveCycleByIndex(
  cycleIndex: number,
  now: Date = new Date(),
): IncentiveCycleInfo {
  const idx = Math.max(0, Math.floor(cycleIndex));
  const cycleMs = INCENTIVE_CYCLE_DAYS * DAY_MS;
  const cycleStartMs = CYCLE_EPOCH_UTC + idx * cycleMs;
  const cycleEndMs = cycleStartMs + cycleMs;
  const nowUtc = startOfUtcDay(now.getTime());
  const currentIndex = getCurrentCycleIndex(now);
  const isCurrent = idx === currentIndex;
  const daysElapsed = isCurrent
    ? Math.min(INCENTIVE_CYCLE_DAYS, Math.floor((nowUtc - cycleStartMs) / DAY_MS) + 1)
    : idx < currentIndex
      ? INCENTIVE_CYCLE_DAYS
      : 0;
  const daysRemaining = isCurrent
    ? Math.max(0, Math.ceil((cycleEndMs - now.getTime()) / DAY_MS))
    : idx > currentIndex
      ? INCENTIVE_CYCLE_DAYS
      : 0;
  return {
    totalTarget: INCENTIVE_CYCLE_TARGET,
    cycleDays: INCENTIVE_CYCLE_DAYS,
    cycleIndex: idx,
    cycleStart: fmtIn(cycleStartMs),
    cycleEnd: fmtIn(cycleEndMs - DAY_MS),
    startIso: toIsoUtcDay(cycleStartMs),
    endIso: toIsoUtcDay(cycleEndMs - DAY_MS),
    daysElapsed,
    daysRemaining,
    cycleLabel: `${fmtIn(cycleStartMs)} – ${fmtIn(cycleEndMs - DAY_MS)}`,
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
    options.push({
      cycleIndex: c.cycleIndex,
      label: c.isCurrent ? `Current · ${c.cycleLabel}` : c.cycleLabel,
      startIso: c.startIso,
      endIso: c.endIso,
      isCurrent: c.isCurrent,
    });
  }
  return options;
}

export function listDatesInCycle(cycle: IncentiveCycleInfo): string[] {
  const start = Date.parse(`${cycle.startIso}T00:00:00.000Z`);
  const dates: string[] = [];
  for (let i = 0; i < INCENTIVE_CYCLE_DAYS; i++) {
    dates.push(toIsoUtcDay(start + i * DAY_MS));
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
  const revenue = dayDeals.reduce((s, d) => s + d.dealValue, 0);
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

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

function pickSlab(achievementPct: number): number {
  if (achievementPct >= 100) return 100;
  if (achievementPct >= 80) return 80;
  if (achievementPct >= 60) return 60;
  if (achievementPct >= 50) return 50;
  if (achievementPct >= 40) return 40;
  return 40;
}

function multiplierForSlab(slab: number): number {
  return SLAB_DEFS.find((s) => s.targetPct === slab)?.incentivePct ?? 0.25;
}

/**
 * Deterministic demo incentives for a selected 15-day cycle.
 * Target is always ₹30L; progress varies by designer + cycle until a real API exists.
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
  // Progress scales with days elapsed so a fresh cycle starts low and grows
  const progressCap = Math.min(95, 18 + cycle.daysElapsed * 4.5 + (seed % 20));
  const achievementPct = Math.round(progressCap * 10) / 10;
  const revenueAchieved = Math.round((totalTarget * achievementPct) / 100);
  const currentSlabPct = pickSlab(achievementPct);
  const incentiveMultiplierPct = multiplierForSlab(currentSlabPct);
  const incentiveEarned = Math.round((revenueAchieved * incentiveMultiplierPct) / 100);
  const sameDayClosures = 1 + (seed % 5);
  const fortyEightHourClosures = 1 + ((seed >> 3) % 4);
  const sameDayBonus = sameDayClosures * 750;
  const fortyEightHourBonus = fortyEightHourClosures * 375;
  const onSpotBonus = sameDayBonus + fortyEightHourBonus;
  const nextSlab =
    slabs.find((s) => s.targetPct > currentSlabPct)?.revenue ?? totalTarget;
  const amountToNextSlab = Math.max(0, nextSlab - revenueAchieved);
  const cycleDates = listDatesInCycle(cycle);
  const daysForDeals = cycle.isCurrent
    ? cycleDates.slice(0, Math.max(1, cycle.daysElapsed))
    : cycleDates;
  const dealCount = Math.min(daysForDeals.length, 4 + (seed % 5));
  const deals: DealLedgerRow[] = Array.from({ length: dealCount }, (_, i) => {
    const customerName = DEMO_CUSTOMERS[(seed + i) % DEMO_CUSTOMERS.length];
    const dealValue = 1_50_000 + ((seed + i * 97) % 6) * 75_000;
    const closureRoll = (seed + i * 3) % 3;
    const closureTime: DealLedgerRow["closureTime"] =
      closureRoll === 0 ? "SAME DAY" : closureRoll === 1 ? "48 HOURS" : "72 HOURS+";
    const contributionPct = 40 + ((seed + i * 11) % 50);
    const incentive = Math.round((dealValue * incentiveMultiplierPct * contributionPct) / 10000);
    const activityDate = daysForDeals[(seed + i * 5) % daysForDeals.length];
    return {
      id: `${member.id}-${cycle.cycleIndex}-${i + 1}`,
      customerName,
      initials: initialsFromName(customerName),
      dealValue,
      closureTime,
      contributionPct,
      incentive,
      activityDate,
    };
  }).sort((a, b) => a.activityDate.localeCompare(b.activityDate));

  return {
    designerId: member.id,
    designerName: member.name,
    totalTarget,
    revenueAchieved,
    revenueDeltaPct: 4 + (seed % 12),
    achievementPct,
    incentiveEarned,
    onSpotBonus,
    amountToNextSlab,
    currentSlabPct,
    eligibleSlabPct: currentSlabPct,
    incentiveMultiplierPct,
    slabs,
    sameDayClosures,
    sameDayBonus,
    fortyEightHourClosures,
    fortyEightHourBonus,
    deals,
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
