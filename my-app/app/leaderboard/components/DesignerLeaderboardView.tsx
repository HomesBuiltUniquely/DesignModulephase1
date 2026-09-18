"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BADGE_TIERS_INFO } from "../../constants/xpLevels";
import { DesignerDetailDrawer } from "./DesignerDetailDrawer";
import { getApiBase, buildAuthHeaders } from "@/app/lib/apiBase";
import { useAuth } from "@/app/auth/AuthContext";
import CustomSelect, { SelectOption } from "@/app/Components/ui/CustomSelect";

export const DesignerLeaderboardView: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = [
    "admin",
    "super_admin",
    "superadmin",
  ].includes((user?.role || "").toLowerCase());

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

  // Admin Summary Metrics
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

  const currentUserLevel = useMemo(() => {
    const currentDesigner = designers.find((d) => d.id === user?.id);
    return (currentDesigner?.level || topLevel || "Rookie").toLowerCase();
  }, [designers, user?.id, topLevel]);

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
        setDesigners(json.designers || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Network error");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

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
    return <span className="font-bold text-sm text-slate-400">{rank}</span>;
  };

  // Render bottom badge icon (Rookie = green 4-leaf clover, locked = silver shields)
  const renderBadgeShowcaseIcon = (badgeKey: string, isCurrent: boolean) => {
    if (badgeKey === "rookie") {
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12">
          {/* 4-leaf clover / sprout in bright green */}
          <path d="M50 50 C40 28 20 38 30 54 C40 64 50 50 50 50 Z" fill="#10B981" />
          <path d="M50 50 C60 28 80 38 70 54 C60 64 50 50 50 50 Z" fill="#059669" />
          <path d="M50 50 C40 72 20 62 30 46 C40 36 50 50 50 50 Z" fill="#059669" />
          <path d="M50 50 C60 72 80 62 70 46 C60 36 50 50 50 50 Z" fill="#10B981" />
          <path d="M50 50 Q49 76 52 86" stroke="#047857" strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
      );
    }

    if (badgeKey === "explorer") {
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12">
          <path d="M50 8 L82 22 L78 62 L50 92 L22 62 L18 22 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="3" />
          <circle cx="50" cy="50" r="18" fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="3 3" />
          <polygon points="50,28 54,48 50,50 46,48" fill="#94A3B8" />
          <polygon points="50,72 54,52 50,50 46,52" fill="#CBD5E1" />
          <polygon points="72,50 52,54 50,50 52,46" fill="#94A3B8" />
          <polygon points="28,50 48,54 50,50 48,46" fill="#CBD5E1" />
          <circle cx="50" cy="50" r="3" fill="#64748B" />
        </svg>
      );
    }

    if (badgeKey === "creator") {
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12">
          <path d="M50 8 L82 22 L78 62 L50 92 L22 62 L18 22 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="3" />
          <g transform="rotate(45 50 50)">
            <rect x="45" y="24" width="10" height="52" rx="2" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="1.5" />
            <line x1="45" y1="36" x2="51" y2="36" stroke="#94A3B8" strokeWidth="1.5" />
            <line x1="45" y1="48" x2="51" y2="48" stroke="#94A3B8" strokeWidth="1.5" />
            <line x1="45" y1="60" x2="51" y2="60" stroke="#94A3B8" strokeWidth="1.5" />
          </g>
          <g transform="rotate(-45 50 50)">
            <rect x="46" y="26" width="8" height="42" rx="2" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
            <polygon points="45,68 55,68 50,80" fill="#94A3B8" />
          </g>
        </svg>
      );
    }

    if (badgeKey === "specialist") {
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12">
          <path d="M50 8 L82 22 L78 62 L50 92 L22 62 L18 22 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="3" />
          <polygon points="50,26 72,44 64,74 36,74 28,44" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
          <polygon points="50,34 64,48 58,68 42,68 36,48" fill="#F1F5F9" />
        </svg>
      );
    }

    if (badgeKey === "design_pro") {
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12">
          <path d="M50 8 L82 22 L78 62 L50 92 L22 62 L18 22 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="3" />
          <path d="M30 66 L28 42 L40 50 L50 34 L60 50 L72 42 L70 66 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
          <circle cx="50" cy="34" r="2.5" fill="#94A3B8" />
          <circle cx="28" cy="42" r="2.5" fill="#94A3B8" />
          <circle cx="72" cy="42" r="2.5" fill="#94A3B8" />
        </svg>
      );
    }

    if (badgeKey === "design_master") {
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12">
          <path d="M50 8 L82 22 L78 62 L50 92 L22 62 L18 22 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="3" />
          <path d="M32 68 V46 C32 36 68 36 68 46 V68 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
          <path d="M42 68 V52 C42 48 58 48 58 52 V68 Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.5" />
        </svg>
      );
    }

    if (badgeKey === "elite") {
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12">
          <path d="M50 8 L82 22 L78 62 L50 92 L22 62 L18 22 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="3" />
          <circle cx="50" cy="50" r="18" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
          <polygon points="50,36 54,46 64,46 56,53 59,63 50,57 41,63 44,53 36,46 46,46" fill="#94A3B8" />
        </svg>
      );
    }

    // Legend
    return (
      <svg viewBox="0 0 100 100" className="w-12 h-12">
        <path d="M50 8 L82 22 L78 62 L50 92 L22 62 L18 22 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="3" />
        <path d="M36 40 C36 28 64 28 64 40 V54 C64 64 50 72 50 72 C50 72 36 64 36 54 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
        <line x1="50" y1="32" x2="50" y2="58" stroke="#94A3B8" strokeWidth="2.5" />
        <line x1="42" y1="46" x2="58" y2="46" stroke="#94A3B8" strokeWidth="2.5" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Leaderboard Summary Header & 4 Stat Cards (Admin Only) */}
        {isAdmin && (
          <div className="space-y-4">
            {/* Header Title + Quote */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-serif">
                  Design Team
                </h1>
                <div className="flex items-center gap-1.5 text-xs md:text-sm text-slate-500 mt-1 font-medium">
                  <svg
                    className="w-4 h-4 text-slate-500 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  <span>Creative minds building beautiful homes</span>
                </div>
              </div>

              {/* Inspirational Quote */}
              <div className="bg-[#F1F5F9]/80 border border-slate-200/70 rounded-2xl px-5 py-3 max-w-md flex items-start gap-2.5 shadow-2xs">
                <span className="text-slate-400 font-serif text-2xl leading-none select-none mt-0.5">“</span>
                <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
                  Great design isn't just what it looks like, but the impact it creates.
                </p>
              </div>
            </div>

            {/* 4 Summary Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Designers */}
              <div className="bg-[#F0F7FF] border border-blue-100/90 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#E0EFFF] flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                    {totalDesigners}
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-0.5">Designers</div>
                  <div className="text-[11px] text-slate-400 font-medium">Active in the team</div>
                </div>
              </div>

              {/* 2. Total Team XP */}
              <div className="bg-[#F0FDF4] border border-emerald-100/90 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#DCFCE7] flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-emerald-500 fill-emerald-500" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                    {totalTeamXp.toLocaleString()} XP
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-0.5">Total Team XP</div>
                  <div className="text-[11px] text-slate-400 font-medium">Lifetime</div>
                </div>
              </div>

              {/* 3. Top Level */}
              <div className="bg-[#F5F3FF] border border-purple-100/90 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                    {topLevel}
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-0.5">Top Level</div>
                  <div className="text-[11px] text-slate-400 font-medium">Current highest level</div>
                </div>
              </div>

              {/* 4. Average XP */}
              <div className="bg-[#FFFBEB] border border-amber-100/90 rounded-2xl p-4.5 flex items-center gap-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 19h4V9H4v10zm6 0h4V3h-4v16zm6 0h4v-6h-4v6z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                    {avgXp.toLocaleString()} XP
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-0.5">Average XP</div>
                  <div className="text-[11px] text-slate-400 font-medium">Per designer</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header for non-admin design roles (TDM, Design Manager, Designer) */}
        {!isAdmin && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-serif">
                Designer Leaderboard
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">
                Track XP rankings, levels, and milestone accomplishments
              </p>
            </div>
          </div>
        )}

        {/* XP Levels & Badges Showcase Card (Positioned before the designer table) */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">
                XP Levels & Badges
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Keep completing milestones to unlock higher levels
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-6">
            {BADGE_TIERS_INFO.map((tier) => {
              const isCurrent =
                tier.name.toLowerCase() === currentUserLevel ||
                (currentUserLevel === "rookie" && tier.levelNum === 1);

              return (
                <div
                  key={tier.badgeKey}
                  className={`rounded-2xl p-4 flex flex-col items-center text-center transition-all ${
                    isCurrent
                      ? "bg-[#ECFDF5] border border-emerald-300 shadow-2xs"
                      : "bg-white border border-slate-100 hover:bg-slate-50/60"
                  }`}
                >
                  <div className="h-14 flex items-center justify-center">
                    {renderBadgeShowcaseIcon(tier.badgeKey, isCurrent)}
                  </div>

                  <div className="mt-2 text-center w-full">
                    <span
                      className={`text-xs font-bold block truncate ${
                        isCurrent ? "text-emerald-900" : "text-slate-700"
                      }`}
                    >
                      {isCurrent ? `✦ ${tier.name} ✦` : tier.name}
                    </span>

                    {isCurrent && (
                      <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#00D084] text-white shadow-2xs">
                        CURRENT
                      </span>
                    )}

                    <span
                      className={`text-xs font-semibold block mt-1.5 ${
                        isCurrent ? "text-emerald-600" : "text-slate-400 font-medium"
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

        {/* Top Controls Row */}
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
              placeholder="Search designers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm bg-white border border-slate-200/90 rounded-2xl placeholder-slate-400 text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-medium"
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
              buttonClassName="rounded-2xl border border-slate-200/90 py-2.5 px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            />

            {/* All Levels */}
            <CustomSelect
              value={levelFilter}
              onChange={(v) => setLevelFilter(v)}
              options={levelOptions}
              minWidth="8.5rem"
              size="xs"
              buttonClassName="rounded-2xl border border-slate-200/90 py-2.5 px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            />

            {/* All Teams */}
            <CustomSelect
              value={teamFilter}
              onChange={(v) => setTeamFilter(v)}
              options={teamOptions}
              minWidth="8.5rem"
              size="xs"
              buttonClassName="rounded-2xl border border-slate-200/90 py-2.5 px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            />
          </div>
        </div>

        {/* Leaderboard Table Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-sm text-rose-600 font-semibold mb-3">{error}</p>
              <button
                onClick={fetchLeaderboard}
                className="px-4 py-2 text-xs bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : filteredDesigners.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <p className="text-sm font-medium">No designers matched your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-6 w-16 text-center">#</th>
                    <th className="py-4 px-6">DESIGNER</th>
                    <th className="py-4 px-6">LEVEL</th>
                    <th className="py-4 px-6">XP</th>
                    <th className="py-4 px-6 min-w-[200px]">PROGRESS</th>
                    <th className="py-4 px-6 text-center">PROJECTS</th>
                    <th className="py-4 px-6">RATING</th>
                    <th className="py-4 px-6 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {filteredDesigners.map((designer) => {
                    const isRank1 = designer.rank === 1;

                    return (
                      <tr
                        key={designer.id}
                        className={`transition-colors ${
                          isRank1 ? "bg-[#FFFDF3] hover:bg-[#FFFBEB]" : "bg-white hover:bg-slate-50/60"
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
                              <div className="w-11 h-11 rounded-full bg-[#E0E7FF]/70 text-slate-700 font-bold text-sm flex items-center justify-center">
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
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                            </div>
                            <div>
                              <span
                                onClick={() => {
                                  setSelectedDesignerId(designer.id);
                                  setShowDrawer(true);
                                }}
                                className={`font-bold text-sm block cursor-pointer hover:underline ${
                                  isRank1 ? "text-[#0070F3]" : "text-slate-900"
                                }`}
                              >
                                {designer.name}
                              </span>
                              <span className="text-xs text-slate-400 font-normal mt-0.5 block">
                                {designer.subRole || "Interior Designer"}
                                {designer.branch ? ` · ${designer.branch}` : ""}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Level */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2.5">
                            {/* Dark circular medallion with sprout */}
                            <div className="w-8 h-8 rounded-full bg-[#181C1A] border border-slate-800 flex items-center justify-center shrink-0 shadow-xs">
                              <svg viewBox="0 0 100 100" className="w-4 h-4">
                                <path d="M50 75 Q49.5 58 50 43" stroke="#22C55E" strokeWidth="6" fill="none" strokeLinecap="round" />
                                <path d="M50 54 C38 44 26 50 30 62 C36 67 48 60 50 54 Z" fill="#4ADE80" />
                                <path d="M50 46 C62 36 74 42 70 54 C64 59 52 52 50 46 Z" fill="#22C55E" />
                              </svg>
                            </div>
                            <span className="font-bold text-sm text-slate-800">
                              {designer.level}
                            </span>
                          </div>
                        </td>

                        {/* XP */}
                        <td className="py-4 px-6 font-bold text-sm text-slate-900">
                          {designer.currentXp.toLocaleString()}
                        </td>

                        {/* Progress */}
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            <div className="w-40 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(6, designer.progressPct)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 font-medium block">
                              {designer.nextLevel
                                ? `${designer.xpToNextLevel.toLocaleString()} XP to ${designer.nextLevel}`
                                : "Max Level"}
                            </span>
                          </div>
                        </td>

                        {/* Projects */}
                        <td className="py-4 px-6 text-center font-bold text-sm text-slate-900">
                          {designer.projectsCount}
                        </td>

                        {/* Rating */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-xs text-slate-500">
                            <span className="text-amber-400 text-sm">★</span> {designer.ratingFormatted || "N/A"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => {
                              setSelectedDesignerId(designer.id);
                              setShowDrawer(true);
                            }}
                            className="px-4 py-1.5 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
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
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
            onClick={() => setShowDrawer(false)}
          />

          {/* Slide-over panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl overflow-y-auto">
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
