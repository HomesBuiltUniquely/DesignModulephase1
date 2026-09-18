"use client";

import React from "react";

interface ProjectItem {
  id: number;
  pid: string;
  projectName: string;
  projectStage: string;
  status: string;
  earnedXp: number;
  onTimeTasks: number;
  delayedTasks: number;
}

interface ProjectsTabProps {
  projects: ProjectItem[];
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({ projects }) => {
  if (!projects || projects.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500">
        <p className="text-sm">No assigned projects found for this designer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {projects.map((proj) => (
        <div
          key={proj.id}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors shadow-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-mono font-semibold text-slate-400 block mb-0.5">
                {proj.pid}
              </span>
              <h5 className="text-sm font-bold text-slate-800 line-clamp-1">{proj.projectName}</h5>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                ★ +{proj.earnedXp.toLocaleString()} XP
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                Stage: {proj.projectStage}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md font-medium ${
                  proj.status === "Completed"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {proj.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-2xs">
              <span className="text-emerald-600 font-medium">{proj.onTimeTasks} On-Time</span>
              {proj.delayedTasks > 0 && (
                <span className="text-rose-600 font-medium">{proj.delayedTasks} Delayed</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
