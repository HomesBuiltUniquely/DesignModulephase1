"use client";

import React from "react";
import { BadgeIcon } from "./BadgeIcon";

interface AchievementItem {
  id: string;
  title: string;
  badgeKey: string;
  minXp: number;
  levelNum: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
}

interface AchievementsTabProps {
  achievements: AchievementItem[];
}

export const AchievementsTab: React.FC<AchievementsTabProps> = ({ achievements }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {achievements.map((ach) => {
        const unlockedDateStr = ach.unlockedAt
          ? new Date(ach.unlockedAt).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : null;

        return (
          <div
            key={ach.id}
            className={`border rounded-xl p-3.5 flex flex-col items-center text-center transition-all ${
              ach.isUnlocked
                ? "bg-white border-slate-200 shadow-xs hover:border-slate-300"
                : "bg-slate-50/70 border-slate-200/60 opacity-60"
            }`}
          >
            <div className="relative mb-2">
              <BadgeIcon badgeKey={ach.badgeKey} size={48} isUnlocked={ach.isUnlocked} />
              {!ach.isUnlocked && (
                <div className="absolute -top-1 -right-1 bg-slate-700 text-white p-0.5 rounded-full text-2xs">
                  🔒
                </div>
              )}
            </div>

            <h6 className="text-xs font-bold text-slate-800">{ach.title}</h6>
            <span className="text-2xs text-slate-500 mt-0.5 font-medium">
              {ach.minXp.toLocaleString()} XP
            </span>

            <div className="mt-2 text-2xs">
              {ach.isUnlocked ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                  ✓ Unlocked {unlockedDateStr ? `(${unlockedDateStr})` : ""}
                </span>
              ) : (
                <span className="text-slate-400 font-medium">Locked</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
