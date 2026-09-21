"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BADGE_TIERS_INFO } from "../../constants/xpLevels";
import { BadgeIcon } from "./BadgeIcon";
import { DesignerDetailDrawer } from "./DesignerDetailDrawer";
import { getApiBase, buildAuthHeaders } from "@/app/lib/apiBase";
import { useAuth } from "@/app/auth/AuthContext";
import CustomSelect, { SelectOption } from "@/app/Components/ui/CustomSelect";

export const DesignerLeaderboardView: React.FC = () => {
  const { user } = useAuth();
  const userRole = (user?.role || "").toLowerCase().trim();
  const isAdmin = ["admin", "super_admin", "superadmin"].includes(userRole);
  const isTDM = userRole === "territorial_design_manager" || userRole === "tdm";
  const isDesignManager = userRole === "design_manager";
  const isDesigner = userRole === "designer";

  const [designers, setDesigners] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<"xp" | "projects" | "name" | "rank">("xp");
  const [levelFilter, setLevelFilter] = useState<string>("All Levels");
  const [teamFilter, setTeamFilter] = useState<string>("All Teams");

  const sortOptions: SelectOption[] = [
    { value: "xp", label: "Sort by XP" },
    { value: "projects", label: "Sort by Projects" },
    { value: "name", label: "Sort by Name" },
    { value: "rank", label: "Sort by Rank" },
  ];

  const levelOptions: SelectOption[] = [
    { value: "All Levels", label: "All Levels" },
    { value: "Rookie", label: "Rookie" },
    { value: "Explorer", label: "Explorer" },
    { value: "Creator", label: "Creator" },
    { value: "Specialist", label: "Specialist" },
    { value: "Design Pro", label: "Design Pro" },
    { value: "Design Master", label: "Design Master" },
    { value: "Elite", label: "Elite" },
    { value: "Legend", label: "Legend" },
  ];

  // Drawer state
  const [selectedDesignerId, setSelectedDesignerId] = useState<number | null>(null);
  const [showDrawer, setShowDrawer] = useState<boolean>(false);

  // Selected designer for the XP Levels & Badges showcase:
  // For Designer: will be the single designer record (user.id)
  // For Design Manager / TDM: defaults to first designer in team, changeable via dropdown or row click
  // For Admin: defaults to null ("Overview / Distribution"), changeable to inspect any designer
  const [selectedShowcaseDesignerId, setSelectedShowcaseDesignerId] = useState<number | null>(null);

  const fetchLeaderboard = () => {
    setLoading(true);
    setError(null);

    fetch(`${getApiBase()}/api/xp/leaderboard?sortBy=${sortBy === "projects" ? "projects" : "xp"}`, {
      headers: buildAuthHeaders(),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to fetch leaderboard");
        }
        return res.json();
      })
      .then((json) => {
        const list = json.designers || [];
        setDesigners(list);
        setLoading(false);

        if (list.length > 0) {
          if (isDesigner) {
            setSelectedShowcaseDesignerId(list[0].id);
          } else if (isDesignManager || isTDM) {
            setSelectedShowcaseDesignerId((prev) => (prev ? prev : list[0].id));
          }
        }
      })
      .catch((err) => {
        setError(err.message || "Network error");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const activeShowcaseDesigner = useMemo(() => {
    if (isDesigner) return designers[0] || null;
    if (selectedShowcaseDesignerId) {
      return (
        designers.find((d) => d.id === selectedShowcaseDesignerId) ||
        (isDesignManager || isTDM ? designers[0] : null)
      );
    }
    return null;
  }, [designers, isDesigner, isDesignManager, isTDM, selectedShowcaseDesignerId]);

  // Summary Metrics
  const totalDesigners = designers.length;
  const totalTeamXp = useMemo(
    () => designers.reduce((sum, d) => sum + (Number(d.currentXp) || 0), 0),
    [designers]
  );
  const topLevel = useMemo(() => {
    if (!designers.length) return "Rookie";
    const sorted = [...designers].sort((a, b) => (Number(b.currentXp) || 0) - (Number(a.currentXp) || 0));
    return sorted[0]?.level || "Rookie";
  }, [designers]);
  const avgXp = useMemo(() => {
    return totalDesigners > 0 ? Math.round(totalTeamXp / totalDesigners) : 0;
  }, [totalDesigners, totalTeamXp]);

  const designerCountByLevel = useMemo(() => {
    const map: Record<string, number> = {};
    BADGE_TIERS_INFO.forEach((t) => {
      map[t.name.toLowerCase()] = 0;
    });
    designers.forEach((d) => {
      const lvl = (d.level || "Rookie").toLowerCase();
      map[lvl] = (map[lvl] || 0) + 1;
    });
    return map;
  }, [designers]);

  // Teams / Branches list
  const teams = useMemo(() => {
    const set = new Set<string>();
    designers.forEach((d) => {
      if (d.branch) set.add(d.branch);
    });
    return ["All Teams", ...Array.from(set)];
  }, [designers]);

  const teamOptions: SelectOption[] = useMemo(
    () => teams.map((t) => ({ value: t, label: t })),
    [teams]
  );

  // Filtered & Sorted list
  const filteredDesigners = useMemo(() => {
    let list = [...designers];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.subRole && d.subRole.toLowerCase().includes(q)) ||
          (d.branch && d.branch.toLowerCase().includes(q)),
      );
    }

    // Level filter
    if (levelFilter && levelFilter !== "All Levels") {
      list = list.filter((d) => (d.level || "").toLowerCase() === levelFilter.toLowerCase());
    }

    // Team filter
    if (teamFilter && teamFilter !== "All Teams") {
      list = list.filter((d) => (d.branch || "").toLowerCase() === teamFilter.toLowerCase());
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "projects") return b.projectsCount - a.projectsCount;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "rank") return a.rank - b.rank;
      return b.currentXp - a.currentXp; // default "xp"
    });

    return list;
  }, [designers, search, levelFilter, teamFilter, sortBy]);

  // Drawer authorization guard
  const handleOpenDrawer = (designerId: number) => {
    if (isDesigner && Number(designerId) !== Number(user?.id)) {
      return;
    }
    if (isDesignManager || isTDM) {
      const isInTeam = designers.some((d) => Number(d.id) === Number(designerId));
      if (!isInTeam) return;
    }
    setSelectedDesignerId(designerId);
    setShowDrawer(true);
  };

  const handleSelectShowcase = (designerId: number) => {
    if (isDesigner) return;
    if (isDesignManager || isTDM) {
      const isInTeam = designers.some((d) => Number(d.id) === Number(designerId));
      if (!isInTeam) return;
    }
    setSelectedShowcaseDesignerId(designerId);
  };

  // Render rank crown & number
  const renderRank = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="flex flex-col items-center justify-center">
          <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" />
          </svg>
          <span className="text-amber-800 font-black text-sm leading-none mt-0.5">1</span>
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="flex flex-col items-center justify-center">
          <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" />
          </svg>
          <span className="text-slate-500 font-black text-sm leading-none mt-0.5">2</span>
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="flex flex-col items-center justify-center">
          <svg className="w-5 h-5 text-amber-700" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" />
          </svg>
          <span className="text-amber-800 font-black text-sm leading-none mt-0.5">3</span>
        </div>
      );
    }
    return <span className="font-bold text-sm text-slate-400">#{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0d0e11] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* =================================================================== */}
        {/* HEADER & TOP STAT CARDS (Tailored by Role)                         */}
        {/* =================================================================== */}

        {isAdmin ? (
          /* ADMIN HEADER */
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-serif">
                  Design Team
                </h1>
                <div className="flex items-center gap-1.5 text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>Organization-wide designer XP & performance overview</span>
                </div>
              </div>

              <div className="bg-[#F1F5F9]/80 dark:bg-[#14171e] border border-slate-200/70 dark:border-slate-800 rounded-2xl px-5 py-3 max-w-md flex items-start gap-2.5 shadow-2xs">
                <span className="text-slate-400 font-serif text-2xl leading-none select-none mt-0.5">“</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic">
                  Great design isn't just what it looks like, but the impact it creates.
                </p>
              </div>
            </div>

            {/* 4 Admin Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#F0F7FF] dark:bg-blue-950/25 border border-blue-100/90 dark:border-blue-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#E0EFFF] dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{totalDesigners}</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Designers</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Active across organization</div>
                </div>
              </div>

              <div className="bg-[#F0FDF4] dark:bg-emerald-950/25 border border-emerald-100/90 dark:border-emerald-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#DCFCE7] dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-emerald-500 fill-emerald-500 dark:text-emerald-400 dark:fill-emerald-400" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{totalTeamXp.toLocaleString()} XP</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Total Team XP</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Lifetime cumulative</div>
                </div>
              </div>

              <div className="bg-[#F5F3FF] dark:bg-purple-950/25 border border-purple-100/90 dark:border-purple-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-purple-500 dark:text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{topLevel}</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Top Level</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Current highest level</div>
                </div>
              </div>

              <div className="bg-[#FFFBEB] dark:bg-amber-950/25 border border-amber-100/90 dark:border-amber-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-amber-500 dark:text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 19h4V9H4v10zm6 0h4V3h-4v16zm6 0h4v-6h-4v6z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{avgXp.toLocaleString()} XP</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Average XP</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Per designer</div>
                </div>
              </div>
            </div>
          </div>
        ) : isTDM ? (
          /* TDM (TERRITORIAL DESIGN MANAGER) HEADER */
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-serif">
                  Territory Leaderboard & Progression
                </h1>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  Track XP rankings, milestone completions, and level advancements across your territory
                </p>
              </div>
            </div>

            {/* 4 Territory Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#F0F7FF] dark:bg-blue-950/25 border border-blue-100/90 dark:border-blue-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#E0EFFF] dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{totalDesigners}</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Territory Designers</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">In your assigned territory</div>
                </div>
              </div>

              <div className="bg-[#F0FDF4] dark:bg-emerald-950/25 border border-emerald-100/90 dark:border-emerald-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#DCFCE7] dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-emerald-500 fill-emerald-500 dark:text-emerald-400 dark:fill-emerald-400" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{totalTeamXp.toLocaleString()} XP</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Territory XP</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Combined territory achievement</div>
                </div>
              </div>

              <div className="bg-[#F5F3FF] dark:bg-purple-950/25 border border-purple-100/90 dark:border-purple-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-purple-500 dark:text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{topLevel}</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Highest Level</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Top level in territory</div>
                </div>
              </div>

              <div className="bg-[#FFFBEB] dark:bg-amber-950/25 border border-amber-100/90 dark:border-amber-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-amber-500 dark:text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 19h4V9H4v10zm6 0h4V3h-4v16zm6 0h4v-6h-4v6z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{avgXp.toLocaleString()} XP</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Territory Average</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Average XP per designer</div>
                </div>
              </div>
            </div>
          </div>
        ) : isDesignManager ? (
          /* DESIGN MANAGER HEADER */
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-serif">
                  Team Leaderboard & Progression
                </h1>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  Track XP rankings, milestone completions, and level advancements for your managed team members
                </p>
              </div>
            </div>

            {/* 4 Team Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#F0F7FF] dark:bg-blue-950/25 border border-blue-100/90 dark:border-blue-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#E0EFFF] dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{totalDesigners}</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Team Members</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">In your managed team</div>
                </div>
              </div>

              <div className="bg-[#F0FDF4] dark:bg-emerald-950/25 border border-emerald-100/90 dark:border-emerald-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#DCFCE7] dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-emerald-500 fill-emerald-500 dark:text-emerald-400 dark:fill-emerald-400" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{totalTeamXp.toLocaleString()} XP</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Team XP</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Combined team achievement</div>
                </div>
              </div>

              <div className="bg-[#F5F3FF] dark:bg-purple-950/25 border border-purple-100/90 dark:border-purple-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-purple-500 dark:text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{topLevel}</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Highest Level</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Top level in team</div>
                </div>
              </div>

              <div className="bg-[#FFFBEB] dark:bg-amber-950/25 border border-amber-100/90 dark:border-amber-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-amber-500 dark:text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 19h4V9H4v10zm6 0h4V3h-4v16zm6 0h4v-6h-4v6z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">{avgXp.toLocaleString()} XP</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">Team Average</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Average XP per designer</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* DESIGNER PERSONAL HEADER */
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-serif">
                  My XP & Progression
                </h1>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  Track your personal levels, milestones, and achievements
                </p>
              </div>
            </div>

            {/* Designer Personal Stat Cards */}
            {activeShowcaseDesigner && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Total XP */}
                <div className="bg-[#F0FDF4] dark:bg-emerald-950/25 border border-emerald-100/90 dark:border-emerald-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-[#DCFCE7] dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-emerald-500 fill-emerald-500 dark:text-emerald-400 dark:fill-emerald-400" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total XP</div>
                    <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                      {Number(activeShowcaseDesigner.currentXp).toLocaleString()} XP
                    </div>
                  </div>
                </div>

                {/* 2. Current Level */}
                <div className="bg-[#F5F3FF] dark:bg-purple-950/25 border border-purple-100/90 dark:border-purple-900/40 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                    <BadgeIcon badgeKey={activeShowcaseDesigner.badgeKey} size={36} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Level</div>
                    <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                      {activeShowcaseDesigner.level}
                    </div>
                  </div>
                </div>

                {/* 3. Progress to next level */}
                <div className="bg-[#F0F7FF] dark:bg-blue-950/25 border border-blue-100/90 dark:border-blue-900/40 rounded-2xl p-4.5 flex flex-col justify-center shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Progress to next level</span>
                    <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                      {activeShowcaseDesigner.nextLevelXp
                        ? `${Number(activeShowcaseDesigner.currentXp).toLocaleString()} / ${Number(activeShowcaseDesigner.nextLevelXp).toLocaleString()}`
                        : "Max Level"}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(6, activeShowcaseDesigner.progressPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* XP LEVELS & BADGES SHOWCASE CARD                                    */}
        {/* =================================================================== */}
        <div className="bg-white dark:bg-[#14171e] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
                  {isDesigner
                    ? "My XP Levels & Badges"
                    : isDesignManager
                    ? "Team XP Levels & Badges"
                    : isTDM
                    ? "Territory XP Levels & Badges"
                    : "XP Levels & Badges"}
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5 font-medium">
                  {isDesigner
                    ? "Keep completing milestones to unlock higher levels"
                    : isDesignManager
                    ? "View level progression and unlock status for designers in your team"
                    : isTDM
                    ? "View level progression and unlock status for designers in your territory"
                    : "Complete organization-wide designer level thresholds and progression"}
                </p>
              </div>
            </div>

            {/* Role-specific selector */}
            {(isDesignManager || isTDM) && designers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">Selected Member:</span>
                <CustomSelect
                  value={String(activeShowcaseDesigner?.id || designers[0]?.id)}
                  onChange={(v) => handleSelectShowcase(Number(v))}
                  options={designers.map((d) => ({
                    value: String(d.id),
                    label: `${d.name} (${d.level} · ${Number(d.currentXp).toLocaleString()} XP)`,
                  }))}
                  minWidth="14rem"
                  size="xs"
                  buttonClassName="rounded-2xl border border-slate-200/90 dark:border-slate-800 py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-900/60 bg-white dark:bg-[#14171e]"
                />
              </div>
            )}

            {isAdmin && designers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">Inspect Designer:</span>
                <CustomSelect
                  value={selectedShowcaseDesignerId ? String(selectedShowcaseDesignerId) : "overview"}
                  onChange={(v) => setSelectedShowcaseDesignerId(v === "overview" ? null : Number(v))}
                  options={[
                    { value: "overview", label: "Organization Overview (All Designers)" },
                    ...designers.map((d) => ({
                      value: String(d.id),
                      label: `${d.name} (${d.level} · ${Number(d.currentXp).toLocaleString()} XP)`,
                    })),
                  ]}
                  minWidth="16rem"
                  size="xs"
                  buttonClassName="rounded-2xl border border-slate-200/90 dark:border-slate-800 py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-900/60 bg-white dark:bg-[#14171e]"
                />
              </div>
            )}
          </div>

          {/* Active Designer Progress Banner (Shown when a designer is selected or in Designer mode) */}
          {activeShowcaseDesigner && (
            <div className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0">
                  {activeShowcaseDesigner.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {activeShowcaseDesigner.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                      {activeShowcaseDesigner.level}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Current XP: <strong className="text-slate-700 dark:text-slate-200">{Number(activeShowcaseDesigner.currentXp).toLocaleString()} XP</strong>
                    {activeShowcaseDesigner.branch ? ` · ${activeShowcaseDesigner.branch}` : ""}
                  </span>
                </div>
              </div>

              <div className="flex-1 max-w-md">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {activeShowcaseDesigner.nextLevel
                      ? `Progress to ${activeShowcaseDesigner.nextLevel}`
                      : "Max Level Achieved"}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {activeShowcaseDesigner.nextLevel
                      ? `${Number(activeShowcaseDesigner.currentXp).toLocaleString()} / ${Number(activeShowcaseDesigner.nextLevelXp || 0).toLocaleString()} XP (${activeShowcaseDesigner.progressPct}%)`
                      : "100%"}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(6, activeShowcaseDesigner.progressPct)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 8 Levels & Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-6">
            {BADGE_TIERS_INFO.map((tier) => {
              let isCurrent = false;
              let isUnlocked = false;
              let isLocked = false;

              if (activeShowcaseDesigner) {
                isCurrent = activeShowcaseDesigner.levelNum === tier.levelNum;
                isUnlocked = activeShowcaseDesigner.levelNum > tier.levelNum;
                isLocked = activeShowcaseDesigner.levelNum < tier.levelNum;
              }

              const countAtThisLevel = designerCountByLevel[tier.name.toLowerCase()] || 0;

              return (
                <div
                  key={tier.badgeKey}
                  className={`rounded-2xl p-4 flex flex-col items-center text-center transition-all ${
                    isCurrent
                      ? "bg-[#ECFDF5] dark:bg-emerald-950/30 border-2 border-emerald-400 dark:border-emerald-500 shadow-md ring-1 ring-emerald-300"
                      : isUnlocked
                      ? "bg-white dark:bg-[#12151b] border border-emerald-200/80 dark:border-emerald-900/40 shadow-2xs hover:bg-slate-50/60"
                      : isLocked
                      ? "bg-slate-50/60 dark:bg-[#0c0e12] border border-slate-200/60 dark:border-slate-800/60 opacity-65"
                      : "bg-white dark:bg-[#0f1115] border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/60 dark:hover:bg-slate-900/50"
                  }`}
                >
                  <div className="h-14 flex items-center justify-center relative">
                    <BadgeIcon badgeKey={tier.badgeKey} size={50} isUnlocked={!isLocked} />
                    {isLocked && (
                      <span className="absolute -top-1 -right-1 bg-slate-700 dark:bg-slate-800 text-white text-[10px] px-1 py-0.5 rounded-full shadow-xs">
                        🔒
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-center w-full">
                    <span
                      className={`text-xs font-bold block truncate ${
                        isCurrent
                          ? "text-emerald-900 dark:text-emerald-300"
                          : isUnlocked
                          ? "text-slate-800 dark:text-slate-100"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {isCurrent ? `✦ ${tier.name} ✦` : tier.name}
                    </span>

                    {/* Status Pill */}
                    {activeShowcaseDesigner ? (
                      isCurrent ? (
                        <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#00D084] text-white shadow-2xs">
                          CURRENT
                        </span>
                      ) : isUnlocked ? (
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/40">
                          ✓ UNLOCKED
                        </span>
                      ) : (
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          🔒 LOCKED
                        </span>
                      )
                    ) : (
                      /* Admin Overview: show count of designers at this level */
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40">
                        {countAtThisLevel} {countAtThisLevel === 1 ? "Designer" : "Designers"}
                      </span>
                    )}

                    {/* Exact confirmed XP threshold */}
                    <span
                      className={`text-xs font-semibold block mt-1.5 ${
                        isCurrent
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-400 dark:text-slate-500 font-medium"
                      }`}
                    >
                      {tier.maxXp != null
                        ? `${tier.minXp.toLocaleString()} - ${tier.maxXp.toLocaleString()}`
                        : `${tier.minXp.toLocaleString()}+`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =================================================================== */}
        {/* LEADERBOARD TABLE CONTROLS (Omitted for Designer)                  */}
        {/* =================================================================== */}
        {!isDesigner && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 max-w-sm">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={
                  isDesignManager
                    ? "Search managed designers..."
                    : isTDM
                    ? "Search territory designers..."
                    : "Search designers..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm bg-white dark:bg-[#0f1115] border border-slate-200/90 dark:border-slate-800 rounded-2xl placeholder-slate-400 dark:placeholder-slate-500 text-slate-700 dark:text-slate-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-medium"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Sort by */}
              <CustomSelect
                value={sortBy}
                onChange={(v) => setSortBy(v as any)}
                options={sortOptions}
                minWidth="10.5rem"
                size="xs"
                buttonClassName="rounded-2xl border border-slate-200/90 dark:border-slate-800 py-2.5 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-900/60 bg-white dark:bg-[#14171e]"
              />

              {/* All Levels */}
              <CustomSelect
                value={levelFilter}
                onChange={(v) => setLevelFilter(v)}
                options={levelOptions}
                minWidth="8.5rem"
                size="xs"
                buttonClassName="rounded-2xl border border-slate-200/90 dark:border-slate-800 py-2.5 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-900/60 bg-white dark:bg-[#14171e]"
              />

              {/* All Teams (Only shown if multiple team branches exist) */}
              {teams.length > 2 && (
                <CustomSelect
                  value={teamFilter}
                  onChange={(v) => setTeamFilter(v)}
                  options={teamOptions}
                  minWidth="8.5rem"
                  size="xs"
                  buttonClassName="rounded-2xl border border-slate-200/90 dark:border-slate-800 py-2.5 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-900/60 bg-white dark:bg-[#14171e]"
                />
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* LEADERBOARD TABLE CARD                                              */}
        {/* =================================================================== */}
        <div className="bg-white dark:bg-[#14171e] border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-sm text-rose-600 font-semibold mb-3">{error}</p>
              <button
                onClick={fetchLeaderboard}
                className="px-4 py-2 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : filteredDesigners.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm font-medium">
                {isDesignManager
                  ? "No designers are currently assigned to your team."
                  : isTDM
                  ? "No designers are currently assigned to your territory."
                  : isDesigner
                  ? "No personal XP data found."
                  : "No designers matched your search."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-6 w-16 text-center">#</th>
                    <th className="py-4 px-6">DESIGNER</th>
                    <th className="py-4 px-6">LEVEL</th>
                    <th className="py-4 px-6">XP</th>
                    <th className="py-4 px-6 min-w-[200px]">PROGRESS</th>
                    <th className="py-4 px-6 text-center">PROJECTS</th>
                    <th className="py-4 px-6 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/80">
                  {filteredDesigners.map((designer) => {
                    const isRank1 = designer.rank === 1;
                    const isSelected = activeShowcaseDesigner?.id === designer.id;

                    return (
                      <tr
                        key={designer.id}
                        onClick={() => handleSelectShowcase(designer.id)}
                        className={`transition-colors cursor-pointer ${
                          isSelected && !isDesigner
                            ? "bg-blue-50/40 dark:bg-blue-950/20"
                            : isRank1
                            ? "bg-[#FFFDF3] dark:bg-amber-950/15 hover:bg-[#FFFBEB] dark:hover:bg-amber-950/25"
                            : "bg-white dark:bg-[#14171e] hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        {/* Rank # */}
                        <td className="py-4 px-6 text-center">
                          {renderRank(designer.rank)}
                        </td>

                        {/* Designer */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3.5">
                            <div className="relative shrink-0">
                              <div className="w-11 h-11 rounded-full bg-[#E0E7FF]/70 dark:bg-indigo-950/60 text-slate-700 dark:text-indigo-300 font-bold text-sm flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                                {designer.profileImage ? (
                                  <img
                                    src={designer.profileImage}
                                    alt={designer.name}
                                    className="w-full h-full object-cover rounded-full"
                                  />
                                ) : (
                                  designer.name.charAt(0).toUpperCase()
                                )}
                              </div>
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                            </div>
                            <div>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrawer(designer.id);
                                }}
                                className={`font-bold text-sm block hover:underline ${
                                  isRank1 ? "text-[#0070F3] dark:text-sky-400" : "text-slate-900 dark:text-slate-100"
                                }`}
                              >
                                {designer.name}
                              </span>
                              <span className="text-xs text-slate-400 dark:text-slate-500 font-normal mt-0.5 block">
                                {designer.subRole || "Interior Designer"}
                                {designer.branch ? ` · ${designer.branch}` : ""}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Level */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2.5">
                            <BadgeIcon badgeKey={designer.badgeKey} size={32} />
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                              {designer.level}
                            </span>
                          </div>
                        </td>

                        {/* XP */}
                        <td className="py-4 px-6 font-bold text-sm text-slate-900 dark:text-white">
                          {Number(designer.currentXp).toLocaleString()}
                        </td>

                        {/* Progress */}
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            <div className="w-40 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(6, designer.progressPct)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium block">
                              {designer.nextLevel
                                ? `${designer.xpToNextLevel.toLocaleString()} XP to ${designer.nextLevel}`
                                : "Max Level"}
                            </span>
                          </div>
                        </td>

                        {/* Projects */}
                        <td className="py-4 px-6 text-center font-bold text-sm text-slate-900 dark:text-white">
                          {designer.projectsCount}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrawer(designer.id);
                            }}
                            className="px-4 py-1.5 bg-white dark:bg-[#1e232d] border border-slate-200/90 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Profile Drawer */}
      {showDrawer && selectedDesignerId && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShowDrawer(false)}
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white dark:bg-[#14171e] shadow-2xl overflow-y-auto">
              <DesignerDetailDrawer
                designerId={selectedDesignerId}
                apiBaseUrl={getApiBase()}
                onClose={() => setShowDrawer(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
