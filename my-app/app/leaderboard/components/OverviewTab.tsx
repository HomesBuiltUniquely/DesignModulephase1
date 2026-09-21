"use client";

import React from "react";

interface OverviewTabProps {
  gamification: {
    currentXp: number;
    level: string;
    levelNum: number;
    badgeKey: string;
    nextLevel: string | null;
    nextLevelXp: number | null;
    xpToNextLevel: number;
    progressPct: number;
    projectsCount: number;
  };
  breakdown?: any;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ gamification }) => {
  const currentXp = Number(gamification?.currentXp || 0);
  const nextLevelXp = Number(gamification?.nextLevelXp || 0);
  const progressPct = Number(gamification?.progressPct || 0);
  const xpToNextLevel = Number(gamification?.xpToNextLevel || 0);
  const nextLevel = gamification?.nextLevel;

  return (
    <div className="pt-2 space-y-4">
      {/* Total XP & Level Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800">
          <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Total XP Points
          </span>
          <span className="text-lg font-black text-slate-900 dark:text-white block mt-1">
            {currentXp.toLocaleString()} XP
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800">
          <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Current Level
          </span>
          <span className="text-lg font-black text-slate-900 dark:text-white block mt-1">
            {gamification?.level || "Rookie"}
          </span>
          <span className="text-2xs text-slate-400 dark:text-slate-500 block mt-0.5">
            Level {gamification?.levelNum || 1} of 8
          </span>
        </div>
      </div>

      {/* Level Progression */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {nextLevel ? `Progress to ${nextLevel}` : "Max Level Achieved"}
          </span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
            {nextLevel ? `${currentXp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP` : "100%"}
          </span>
        </div>

        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(6, progressPct)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-2xs text-slate-400 dark:text-slate-500 pt-0.5">
          <span>{nextLevel ? `${progressPct}% complete` : "Completed all tiers"}</span>
          <span>{nextLevel ? `${xpToNextLevel.toLocaleString()} XP remaining` : "Highest level"}</span>
        </div>
      </div>

      {/* Projects metric */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Assigned Projects
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
            Total client projects assigned
          </span>
        </div>
        <span className="text-xl font-black text-slate-900 dark:text-white">
          {gamification?.projectsCount || 0}
        </span>
      </div>
    </div>
  );
};
