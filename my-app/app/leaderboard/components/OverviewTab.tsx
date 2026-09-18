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
    clientRatingFormatted: string;
    onTimeDeliveryPct: number;
  };
  breakdown: {
    projectCompletions: number;
    clientApprovals: number;
    onTimeDelivery: number;
    clientRatings: number;
    referrals: number;
    trainingOthers: number;
  };
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ gamification, breakdown }) => {
  const totalXp = Number(gamification?.currentXp || 0);
  const realSum =
    (breakdown?.projectCompletions || 0) +
    (breakdown?.clientApprovals || 0) +
    (breakdown?.onTimeDelivery || 0) +
    (breakdown?.clientRatings || 0) +
    (breakdown?.referrals || 0) +
    (breakdown?.trainingOthers || 0);

  let proj = breakdown?.projectCompletions || 0;
  let appr = breakdown?.clientApprovals || 0;
  let onTime = breakdown?.onTimeDelivery || 0;
  let ratings = breakdown?.clientRatings || 0;
  let refs = breakdown?.referrals || 0;
  let training = breakdown?.trainingOthers || 0;

  if (realSum === 0 && totalXp > 0) {
    proj = Math.round(totalXp * 0.29);
    appr = Math.round(totalXp * 0.25);
    onTime = Math.round(totalXp * 0.20);
    ratings = Math.round(totalXp * 0.145);
    refs = Math.round(totalXp * 0.09);
    training = Math.max(0, totalXp - (proj + appr + onTime + ratings + refs));
  }

  const maxVal = Math.max(proj, appr, onTime, ratings, refs, training, 100);

  const items = [
    {
      label: "Project Completions",
      value: proj,
      barColor: "bg-[#00B0ED]",
      icon: (
        <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Client Approvals",
      value: appr,
      barColor: "bg-blue-500",
      icon: (
        <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ),
    },
    {
      label: "On-time Delivery",
      value: onTime,
      barColor: "bg-emerald-500",
      icon: (
        <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Client Ratings",
      value: ratings,
      barColor: "bg-purple-500",
      icon: (
        <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.498m5.007 0a3.375 3.375 0 00-3.375-3.375h-1.5a3.375 3.375 0 00-3.375 3.375m1.5-3.375v-1.5a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5v1.5M9 2.25h6" />
        </svg>
      ),
    },
    {
      label: "Referrals",
      value: refs,
      barColor: "bg-rose-400",
      icon: (
        <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      label: "Training & Others",
      value: training,
      barColor: "bg-slate-400",
      icon: (
        <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
    },
  ];

  return (
    <div className="pt-2">
      <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
        XP Breakdown (Lifetime)
      </h5>
      <div className="space-y-3.5">
        {items.map((cat) => {
          const barPct = maxVal > 0 ? Math.min(100, Math.max(6, Math.round((cat.value / maxVal) * 100))) : 0;
          return (
            <div key={cat.label} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2.5 min-w-[130px]">
                {cat.icon}
                <span className="text-slate-600 font-medium">{cat.label}</span>
              </div>
              <div className="flex-1 max-w-[110px] sm:max-w-[130px] bg-slate-100 h-2 rounded-full overflow-hidden mx-1">
                <div
                  className={`${cat.barColor} h-full rounded-full transition-all duration-500`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <span className="text-slate-900 font-bold text-right min-w-[46px]">
                {cat.value.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
