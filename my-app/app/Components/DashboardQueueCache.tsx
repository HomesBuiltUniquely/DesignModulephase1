"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { LeadshipTypes } from "./Types/Types";

export type DashboardAssignableDesigner = {
  id: number;
  name: string;
  role: "designer" | "design_manager";
};

/** Minimal DQC queue row — kept loose so Dashboard can own the richer type. */
export type DashboardDqcQueueItem = {
  id: number;
  [key: string]: unknown;
};

type DashboardQueueCacheValue = {
  projects: LeadshipTypes[];
  setProjects: Dispatch<SetStateAction<LeadshipTypes[]>>;
  dqcProjects: DashboardDqcQueueItem[];
  setDqcProjects: Dispatch<SetStateAction<DashboardDqcQueueItem[]>>;
  assignableDesigners: DashboardAssignableDesigner[];
  setAssignableDesigners: Dispatch<SetStateAction<DashboardAssignableDesigner[]>>;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  pageSize: number;
  setPageSize: Dispatch<SetStateAction<number>>;
  /** True after first successful queue fetch this session (survives /Leads navigation). */
  queueFetched: boolean;
  setQueueFetched: Dispatch<SetStateAction<boolean>>;
  designersFetched: boolean;
  setDesignersFetched: Dispatch<SetStateAction<boolean>>;
  clearQueueCache: () => void;
};

const DashboardQueueCacheContext = createContext<DashboardQueueCacheValue | null>(null);

export function DashboardQueueCacheProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<LeadshipTypes[]>([]);
  const [dqcProjects, setDqcProjects] = useState<DashboardDqcQueueItem[]>([]);
  const [assignableDesigners, setAssignableDesigners] = useState<DashboardAssignableDesigner[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [queueFetched, setQueueFetched] = useState(false);
  const [designersFetched, setDesignersFetched] = useState(false);

  const clearQueueCache = useCallback(() => {
    setProjects([]);
    setDqcProjects([]);
    setAssignableDesigners([]);
    setPage(1);
    setPageSize(20);
    setQueueFetched(false);
    setDesignersFetched(false);
    try {
      sessionStorage.removeItem("design-dashboard-scroll-y");
      sessionStorage.removeItem("design-dashboard-page");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      projects,
      setProjects,
      dqcProjects,
      setDqcProjects,
      assignableDesigners,
      setAssignableDesigners,
      page,
      setPage,
      pageSize,
      setPageSize,
      queueFetched,
      setQueueFetched,
      designersFetched,
      setDesignersFetched,
      clearQueueCache,
    }),
    [
      projects,
      dqcProjects,
      assignableDesigners,
      page,
      pageSize,
      queueFetched,
      designersFetched,
      clearQueueCache,
    ],
  );

  return (
    <DashboardQueueCacheContext.Provider value={value}>
      {children}
    </DashboardQueueCacheContext.Provider>
  );
}

export function useDashboardQueueCache(): DashboardQueueCacheValue {
  const value = useContext(DashboardQueueCacheContext);
  if (!value) {
    throw new Error("useDashboardQueueCache must be used inside DashboardQueueCacheProvider");
  }
  return value;
}
