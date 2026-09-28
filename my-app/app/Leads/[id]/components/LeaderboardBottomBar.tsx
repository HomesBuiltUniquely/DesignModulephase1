"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeIcon } from "../../../leaderboard/components/BadgeIcon";
import { getApiBase, buildAuthHeaders, getStoredSessionId } from "@/app/lib/apiBase";

interface LeaderboardBottomBarProps {
  leadId: string | number;
  sessionId?: string | null;
}

export const LeaderboardBottomBar: React.FC<LeaderboardBottomBarProps> = ({ leadId, sessionId }) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId) {
      setLoading(false);
      return;
    }

    const token = sessionId || getStoredSessionId();
    if (!token) {
      setData(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const headers = buildAuthHeaders(token);
    const url = `${getApiBase()}/api/xp/lead/${leadId}/summary`;

    fetch(url, { headers, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          // Optional UI — 401/403/404 are expected for some roles/leads
          setData(null);
          return;
        }
        const json = await res.json().catch(() => null);
        setData(json);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [leadId, sessionId]);

  if (loading || !data || !data.designerId) {
    return null;
  }

  const currentXp = Number(data.currentXp || 0);
  const nextLevelXp = Number(data.nextLevelXp || 30000);
  const progressPct = Number(data.progressPct || 0);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-6 py-3 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Designer Badge & Level Progression */}
        <div className="flex items-center gap-4 min-w-[280px]">
          <div className="shrink-0">
            <BadgeIcon badgeKey={data.badgeKey} size={40} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 text-xs mb-1">
              <span className="font-bold text-slate-800 truncate">{data.currentLevel}</span>
              <span className="font-semibold text-slate-400 text-2xs">
                {currentXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center/Right Stats */}
        <div className="flex items-center gap-6 sm:gap-10 text-xs">
          {/* Project XP */}
          <div className="flex items-center gap-2.5">
            <span className="text-amber-500 text-lg">★</span>
            <div>
              <span className="font-extrabold text-slate-900 block text-sm">
                {(data.projectXp || 0).toLocaleString()} XP
              </span>
              <span className="text-2xs text-slate-400 font-medium">Project XP</span>
            </div>
          </div>

          {/* Your Rank */}
          <div className="flex items-center gap-2.5">
            <span className="text-blue-500 text-lg">📊</span>
            <div>
              <span className="font-extrabold text-slate-900 block text-sm">
                #{data.rank || 1}
              </span>
              <span className="text-2xs text-slate-400 font-medium">Your Rank</span>
            </div>
          </div>

          {/* Current Level */}
          <div className="hidden sm:flex items-center gap-2.5">
            <span className="text-amber-500 text-lg">🏆</span>
            <div>
              <span className="font-extrabold text-slate-900 block text-sm">
                {data.currentLevel}
              </span>
              <span className="text-2xs text-slate-400 font-medium">Current Level</span>
            </div>
          </div>

          {/* View Leaderboard Button */}
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs transition-colors shrink-0 border border-blue-200/60"
          >
            <span>View Leaderboard</span>
            <span className="text-sm">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
