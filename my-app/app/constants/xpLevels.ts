export interface BadgeTierInfo {
  levelNum: number;
  badgeKey: string;
  name: string;
  minXp: number;
  maxXp: number | null;
  color: string;
  bgGradient: string;
  borderColor: string;
  tagline: string;
}

export const BADGE_TIERS_INFO: BadgeTierInfo[] = [
  {
    levelNum: 1,
    badgeKey: "rookie",
    name: "Rookie",
    minXp: 0,
    maxXp: 499,
    color: "#16A34A",
    bgGradient: "from-emerald-500/20 to-green-600/10",
    borderColor: "border-emerald-500/40",
    tagline: "Starting the journey",
  },
  {
    levelNum: 2,
    badgeKey: "explorer",
    name: "Explorer",
    minXp: 500,
    maxXp: 1499,
    color: "#0284C7",
    bgGradient: "from-sky-500/20 to-blue-600/10",
    borderColor: "border-sky-500/40",
    tagline: "Exploring workflows & clients",
  },
  {
    levelNum: 3,
    badgeKey: "creator",
    name: "Creator",
    minXp: 1500,
    maxXp: 3499,
    color: "#D97706",
    bgGradient: "from-amber-600/20 to-orange-700/10",
    borderColor: "border-amber-600/40",
    tagline: "Crafting beautiful spaces",
  },
  {
    levelNum: 4,
    badgeKey: "specialist",
    name: "Specialist",
    minXp: 3500,
    maxXp: 6999,
    color: "#64748B",
    bgGradient: "from-slate-400/20 to-slate-600/10",
    borderColor: "border-slate-400/40",
    tagline: "Refined precision & technical mastery",
  },
  {
    levelNum: 5,
    badgeKey: "design_pro",
    name: "Design Pro",
    minXp: 7000,
    maxXp: 14999,
    color: "#EAB308",
    bgGradient: "from-yellow-500/20 to-amber-600/10",
    borderColor: "border-yellow-500/40",
    tagline: "High-performance project lead",
  },
  {
    levelNum: 6,
    badgeKey: "design_master",
    name: "Design Master",
    minXp: 15000,
    maxXp: 29999,
    color: "#9333EA",
    bgGradient: "from-purple-600/20 to-indigo-700/10",
    borderColor: "border-purple-500/40",
    tagline: "Benchmark excellence & consistency",
  },
  {
    levelNum: 7,
    badgeKey: "elite",
    name: "Elite",
    minXp: 30000,
    maxXp: 59999,
    color: "#2563EB",
    bgGradient: "from-blue-600/20 to-cyan-700/10",
    borderColor: "border-blue-500/40",
    tagline: "Top-tier design leadership",
  },
  {
    levelNum: 8,
    badgeKey: "legend",
    name: "Legend",
    minXp: 60000,
    maxXp: null,
    color: "#F59E0B",
    bgGradient: "from-amber-500/30 to-yellow-600/20",
    borderColor: "border-amber-400",
    tagline: "Hall of fame industry visionary",
  },
];

export function getBadgeInfo(badgeKeyOrXp: string | number): BadgeTierInfo {
  if (typeof badgeKeyOrXp === "number") {
    const safeXp = Math.max(0, badgeKeyOrXp);
    for (let i = BADGE_TIERS_INFO.length - 1; i >= 0; i--) {
      if (safeXp >= BADGE_TIERS_INFO[i].minXp) {
        return BADGE_TIERS_INFO[i];
      }
    }
    return BADGE_TIERS_INFO[0];
  }
  const match = BADGE_TIERS_INFO.find((b) => b.badgeKey.toLowerCase() === String(badgeKeyOrXp).toLowerCase());
  return match || BADGE_TIERS_INFO[0];
}

export function getTierColor(badgeKey?: string): { barColor: string; textColor: string; dotColor: string } {
  switch ((badgeKey || "rookie").toLowerCase()) {
    case "legend":
      return { barColor: "bg-amber-400", textColor: "text-amber-600", dotColor: "bg-amber-400" };
    case "elite":
      return { barColor: "bg-[#00B0ED]", textColor: "text-teal-600", dotColor: "bg-[#00B0ED]" };
    case "design_master":
      return { barColor: "bg-purple-500", textColor: "text-purple-600", dotColor: "bg-purple-400" };
    case "design_pro":
      return { barColor: "bg-amber-500", textColor: "text-amber-600", dotColor: "bg-amber-400" };
    case "specialist":
      return { barColor: "bg-slate-500", textColor: "text-slate-600", dotColor: "bg-slate-400" };
    case "creator":
      return { barColor: "bg-orange-500", textColor: "text-orange-600", dotColor: "bg-orange-400" };
    case "explorer":
      return { barColor: "bg-sky-500", textColor: "text-sky-600", dotColor: "bg-sky-400" };
    case "rookie":
    default:
      return { barColor: "bg-emerald-500", textColor: "text-emerald-600", dotColor: "bg-emerald-400" };
  }
}
