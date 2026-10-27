"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { SideDashboard, SideDashboardStatus } from "../Enums/Enums";

type WorkspaceFiltersValue = {
  phase: string;
  status: string;
  setPhase: (phase: string) => void;
  setStatus: (status: string) => void;
};

const WorkspaceFilterContext = createContext<WorkspaceFiltersValue | null>(null);

export function WorkspaceFilterProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<string>(SideDashboard.All_Projects);
  const [status, setStatus] = useState<string>(SideDashboardStatus.All_Statuses);
  const value = useMemo(
    () => ({ phase, status, setPhase, setStatus }),
    [phase, status],
  );
  return (
    <WorkspaceFilterContext.Provider value={value}>{children}</WorkspaceFilterContext.Provider>
  );
}

export function useWorkspaceFilters(): WorkspaceFiltersValue {
  const value = useContext(WorkspaceFilterContext);
  if (!value) {
    throw new Error("useWorkspaceFilters must be used inside WorkspaceFilterProvider");
  }
  return value;
}
