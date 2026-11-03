"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { SideDashboard, SideDashboardStatus } from "../Enums/Enums";

function getInitialBranchFilter(): string {
  if (typeof window === "undefined") return "";
  try {
    const params = new URLSearchParams(window.location.search);
    const b = params.get("branch");
    if (b && ["HBR", "SJR", "JPN"].includes(b.toUpperCase())) {
      return b.toUpperCase();
    }
    const saved = sessionStorage.getItem("design-branch-filter");
    if (saved && ["HBR", "SJR", "JPN"].includes(saved.toUpperCase())) {
      return saved.toUpperCase();
    }
  } catch {}
  return "";
}

function syncBranchToUrlAndStorage(branch: string) {
  if (typeof window === "undefined") return;
  try {
    if (branch) {
      sessionStorage.setItem("design-branch-filter", branch);
    } else {
      sessionStorage.removeItem("design-branch-filter");
    }
    const url = new URL(window.location.href);
    if (branch) {
      url.searchParams.set("branch", branch);
    } else {
      url.searchParams.delete("branch");
    }
    window.history.replaceState(null, "", url.toString());
  } catch {}
}

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
  const [branchFilter, setBranchFilterState] = useState<string>(getInitialBranchFilter);
  const [designerFilter, setDesignerFilter] = useState("");
  const [milestoneFilter, setMilestoneFilter] = useState("");

  const setBranchFilter = useCallback((value: string) => {
    const normalized =
      value && ["HBR", "SJR", "JPN"].includes(value.toUpperCase()) ? value.toUpperCase() : "";
    setBranchFilterState(normalized);
    syncBranchToUrlAndStorage(normalized);
  }, []);

  const clearQueueFilters = useCallback(() => {
    setSearchQuery("");
    setBranchFilterState("");
    syncBranchToUrlAndStorage("");
    setDesignerFilter("");
    setMilestoneFilter("");
  }, []);

  const clearAllWorkspaceFilters = useCallback(() => {
    setPhase(SideDashboard.All_Projects);
    setStatus(SideDashboardStatus.All_Statuses);
    setSearchQuery("");
    setBranchFilterState("");
    syncBranchToUrlAndStorage("");
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
      setBranchFilter,
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
