"use client";

import React from "react";

interface ActivityItem {
  id: number;
  leadId: number | null;
  projectName: string;
  transactionType: string;
  taskName: string | null;
  baseXp: number;
  penaltyXp: number;
  netXp: number;
  delayDays: number;
  description: string;
  createdAt: string;
}

interface ActivityTabProps {
  activity: ActivityItem[];
}

export const ActivityTab: React.FC<ActivityTabProps> = ({ activity }) => {
  if (!activity || activity.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500">
        <p className="text-sm">No recent XP activity recorded for this designer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activity.map((act) => {
        const dateStr = new Date(act.createdAt).toLocaleString("en-IN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div
            key={act.id}
            className="bg-white border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 transition-colors shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                  {act.projectName}
                </span>
                <p className="text-xs font-medium text-slate-800 leading-snug">
                  {act.description}
                </p>
                <span className="text-2xs text-slate-400 mt-1.5 block">{dateStr}</span>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                    act.netXp > 0
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  +{act.netXp} XP
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
