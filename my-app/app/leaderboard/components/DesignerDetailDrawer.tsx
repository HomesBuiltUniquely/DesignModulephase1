"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BadgeIcon } from "./BadgeIcon";
import { OverviewTab } from "./OverviewTab";
import { ProjectsTab } from "./ProjectsTab";
import { AchievementsTab } from "./AchievementsTab";
import { ActivityTab } from "./ActivityTab";
import { getApiBase, buildAuthHeaders } from "@/app/lib/apiBase";

interface DesignerDetailDrawerProps {
  designerId: number | null;
  onClose?: () => void;
  apiBaseUrl?: string;
  isLoggedInUser?: boolean;
}

export const DesignerDetailDrawer: React.FC<DesignerDetailDrawerProps> = ({
  designerId,
  onClose,
  apiBaseUrl,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "achievements" | "activity">("overview");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!designerId) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const base = apiBaseUrl || getApiBase();

    fetch(`${base}/api/xp/designer/${designerId}`, {
      headers: buildAuthHeaders(null, {
        "Content-Type": "application/json",
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || "Failed to load designer details");
        }
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load designer");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [designerId, apiBaseUrl]);

  if (!designerId) return null;

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-slate-100 animate-pulse rounded w-32" />
            <div className="h-3 bg-slate-100 animate-pulse rounded w-24" />
          </div>
        </div>
        <div className="h-36 bg-slate-100 animate-pulse rounded-2xl" />
        <div className="h-8 bg-slate-100 animate-pulse rounded" />
        <div className="h-40 bg-slate-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center py-10">
        <p className="text-xs text-rose-600 font-semibold mb-3">{error || "No designer data"}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-slate-100 rounded-lg text-slate-700 font-medium hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  const { designer, gamification, breakdown, projects, achievements, activity } = data;
  const ratingFormatted =
    gamification?.clientRatingFormatted && gamification.clientRatingFormatted !== "N/A"
      ? gamification.clientRatingFormatted
      : "4.8";

  return (
    <div className="bg-white dark:bg-[#14171e] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs relative">
      {/* Close button (top right) */}
      {onClose && (
        <button
          onClick={onClose}
          title="Close panel"
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          ✕
        </button>
      )}

      {/* Profile Header */}
      <div className="flex items-center gap-3.5 pr-8">
        <div className="relative shrink-0">
          <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xl border border-slate-100 dark:border-slate-700 shadow-2xs">
            {designer?.profileImage ? (
              <img
                src={designer.profileImage}
                alt={designer.name}
                className="w-full h-full object-cover"
              />
            ) : (
              (designer?.name || "D").charAt(0).toUpperCase()
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {designer?.name}
            </h3>
            <span
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"
              title="Online"
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-400 font-medium truncate mt-0.5">
            {designer?.designation || "Senior Designer"}
            {designer?.branch ? ` • ${designer.branch}` : ""}
          </p>
        </div>
      </div>

      {/* Main Level & XP Card (Sky Blue) */}
      <div className="bg-[#F0F7FF] dark:bg-sky-950/25 border border-sky-100 dark:border-sky-900/40 rounded-2xl p-4 mt-5 mb-5 shadow-2xs">
        {/* Upper section */}
        <div className="flex items-center gap-3.5">
          <div className="shrink-0">
            <BadgeIcon badgeKey={gamification?.badgeKey} size={64} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {gamification?.level}
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-base font-black text-slate-900 dark:text-white">
                {(gamification?.currentXp || 0).toLocaleString()} XP
              </span>
              <span className="text-2xs font-semibold text-slate-400 dark:text-slate-400">
                Lv. {gamification?.levelNum || 1}
              </span>
            </div>
            <div className="w-full bg-slate-200/80 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden my-1.5">
              <div
                className="bg-[#00B0ED] h-full rounded-full transition-all duration-500"
                style={{ width: `${gamification?.progressPct || 0}%` }}
              />
            </div>
            <span className="text-2xs text-slate-500 dark:text-slate-400 font-medium block truncate">
              {gamification?.nextLevel
                ? `${(gamification?.xpToNextLevel || 0).toLocaleString()} XP to ${gamification.nextLevel}`
                : "Max Level Achieved"}
            </span>
          </div>
        </div>

        {/* Lower section (3 columns stats) */}
        <div className="grid grid-cols-3 divide-x divide-sky-200/60 dark:divide-sky-900/40 pt-3 mt-3 border-t border-sky-200/60 dark:border-sky-900/40 text-center">
          <div className="px-1">
            <span className="text-sm font-black text-slate-900 dark:text-white block">
              {gamification?.projectsCount || 0}
            </span>
            <span className="text-2xs text-slate-400 dark:text-slate-400 font-medium block mt-0.5">
              Projects
            </span>
          </div>
          <div className="px-1">
            <span className="text-sm font-black text-slate-900 dark:text-white flex items-center justify-center gap-1">
              {ratingFormatted} <span className="text-amber-400 text-xs">★</span>
            </span>
            <span className="text-2xs text-slate-400 dark:text-slate-400 font-medium block mt-0.5">
              Client Rating
            </span>
          </div>
          <div className="px-1">
            <span className="text-sm font-black text-slate-900 dark:text-white block">
              {gamification?.onTimeDeliveryPct || 100}%
            </span>
            <span className="text-2xs text-slate-400 dark:text-slate-400 font-medium block mt-0.5">
              On-time Delivery
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-5 text-xs font-semibold">
        {[
          { id: "overview", label: "Overview" },
          { id: "projects", label: `Projects (${projects?.length || 0})` },
          { id: "achievements", label: "Achievements" },
          { id: "activity", label: "Activity" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "border-b-2 border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium border-b-2 border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Body */}
      <div className="min-h-[220px]">
        {activeTab === "overview" && (
          <OverviewTab gamification={gamification} breakdown={breakdown} />
        )}
        {activeTab === "projects" && <ProjectsTab projects={projects} />}
        {activeTab === "achievements" && <AchievementsTab achievements={achievements} />}
        {activeTab === "activity" && <ActivityTab activity={activity} />}
      </div>

      {/* Bottom Link */}
      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
        <Link
          href="/profile"
          className="w-full border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors shadow-2xs bg-white dark:bg-[#14171e]"
        >
          <span>View Full Profile</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
};
