"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { SideDashboard, SideDashboardStatus } from "../Enums/Enums";

type WorkspaceFiltersValue = {
  phase: string;
  status: string;
  setPhase: (phase: string) => void;
  setStatus: (status: string) => void;
  /** Dashboard queue toolbar — survives /Leads navigation until Clear, logout, or full reload. */
  searchQuery: string;
  branchFilter: string;
  designerFilter: string;
  milestoneFilter: string;
  setSearchQuery: (value: string) => void;
  setBranchFilter: (value: string) => void;
  setDesignerFilter: (value: string) => void;
  setMilestoneFilter: (value: string) => void;
  hasQueueFilters: boolean;
  clearQueueFilters: () => void;
  clearAllWorkspaceFilters: () => void;
};

const WorkspaceFilterContext = createContext<WorkspaceFiltersValue | null>(null);

export function WorkspaceFilterProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<string>(SideDashboard.All_Projects);
  const [status, setStatus] = useState<string>(SideDashboardStatus.All_Statuses);
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [designerFilter, setDesignerFilter] = useState("");
  const [milestoneFilter, setMilestoneFilter] = useState("");

  const clearQueueFilters = useCallback(() => {
    setSearchQuery("");
    setBranchFilter("");
    setDesignerFilter("");
    setMilestoneFilter("");
  }, []);

  const clearAllWorkspaceFilters = useCallback(() => {
    setPhase(SideDashboard.All_Projects);
    setStatus(SideDashboardStatus.All_Statuses);
    setSearchQuery("");
    setBranchFilter("");
    setDesignerFilter("");
    setMilestoneFilter("");
  }, []);

  const hasQueueFilters = Boolean(
    searchQuery.trim() || branchFilter || designerFilter || milestoneFilter,
  );

  const value = useMemo(
    () => ({
      phase,
      status,
      setPhase,
      setStatus,
      searchQuery,
      branchFilter,
      designerFilter,
      milestoneFilter,
      setSearchQuery,
      setBranchFilter,
      setDesignerFilter,
      setMilestoneFilter,
      hasQueueFilters,
      clearQueueFilters,
      clearAllWorkspaceFilters,
    }),
    [
      phase,
      status,
      searchQuery,
      branchFilter,
      designerFilter,
      milestoneFilter,
      hasQueueFilters,
      clearQueueFilters,
      clearAllWorkspaceFilters,
    ],
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
