'use client';

import { SideDashboard } from "../Enums/Enums";
import { usePathname, useRouter } from "next/navigation";
import { LeadshipTypes } from "./Types/Types";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getApiBase } from "@/app/lib/apiBase";

// Stage column: only Active or Inactive (status)
function getStatusDisplay(stage: string): "Active" | "Inactive" {
    if (!stage) return "Active";
    const s = stage.trim();
    if (s === "Inactive") return "Inactive";
    return "Active";
}

// Phase bucket from project_stage (fallback when milestone not available)
function getStageBucket(stage: string): string {
    if (!stage) return "Pre 10%";
    const s = stage.trim();
    if (s === "Inactive") return "Pre 10%";
    if (s === "Active") return "10-20%";
    if (s === "10-20%") return "10-20%";
    if (s === "20-60%" || s === "20" || s === "20-60") return "20-60%";
    if (["SUBMITTED", "PAYMENT_PENDING", "D1_ACTIVATED", "CONDITIONAL_D1", "Pre 10%"].includes(s)) return "Pre 10%";
    if (s.startsWith("10") && s.includes("20")) return "10-20%";
    if (s.startsWith("20") || s.includes("60")) return "20-60%";
    return "Pre 10%";
}

// Phase bucket from current milestone: 20-60% when 40% payment is done (milestone 5 complete or in PUSH TO PRODUCTION)
function getPhaseFromMilestone(
    milestoneIndex: number | undefined,
    milestoneProgress: number | null | undefined,
): string | null {
    if (milestoneIndex === undefined || milestoneIndex < 0) return null;
    if (milestoneIndex === 0) return "Pre 10%";
    if (milestoneIndex === 6) return "20-60%";
    if (milestoneIndex === 5 && (milestoneProgress ?? 0) >= 100) return "20-60%";
    if (milestoneIndex >= 1 && milestoneIndex <= 5) return "10-20%";
    return null;
}

// Single source for phase bucket: prefer milestone-derived phase, else stage
function getPhaseBucket(p: LeadshipTypes): string {
    const fromMilestone = getPhaseFromMilestone(p.currentMilestoneIndex, p.currentMilestoneProgress);
    const fromStage = getStageBucket(p.projectStage);

    // If milestone says "Pre 10%" but sales closure stage is already 10–20% or 20–60%,
    // trust the stage so new FULL_10% leads appear in the 10–20% bucket.
    if (fromMilestone === "Pre 10%" && fromStage !== "Pre 10%") {
        return fromStage;
    }

    if (fromMilestone !== null) return fromMilestone;
    return fromStage;
}

// Helper to format backend date strings (ISO) to "dd/MM/yyyy h:mm A"
function formatDateTime(value: string): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value; // fallback if parsing fails

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;

    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}

// Progress % for display (from stage bucket)
function getProgressPercent(bucket: string): number {
    if (bucket === "Pre 10%") return 5;
    if (bucket === "10-20%") return 15;
    if (bucket === "20-60%") return 40;
    return 5;
}

// Status pill label and style from stage bucket (fallback when milestone not available)
function getStatusFromBucket(bucket: string): { label: string; className: string } {
    if (bucket === "Pre 10%") return { label: "DELAYED", className: "bg-red-100 text-red-800" };
    if (bucket === "10-20%") return { label: "UNDER QC", className: "bg-purple-100 text-purple-800" };
    if (bucket === "20-60%") return { label: "READY PROD.", className: "bg-green-100 text-green-800" };
    return { label: "PRE 10%", className: "bg-gray-100 text-gray-800" };
}

// Status pill from current milestone (Design Phase table)
function getStatusFromMilestone(
    milestoneIndex: number | undefined,
    milestoneName: string | null | undefined,
): { label: string; className: string } {
    const byIndex: Record<number, { label: string; className: string }> = {
        0: { label: "D1", className: "bg-sky-100 text-sky-800" },
        1: { label: "DQC 1", className: "bg-purple-100 text-purple-800" },
        2: { label: "10% PAYMENT", className: "bg-amber-100 text-amber-800" },
        3: { label: "D2", className: "bg-sky-100 text-sky-800" },
        4: { label: "DQC 2", className: "bg-purple-100 text-purple-800" },
        5: { label: "40% PAYMENT", className: "bg-amber-100 text-amber-800" },
        6: { label: "PUSH TO PROD.", className: "bg-green-100 text-green-800" },
    };
    if (milestoneIndex !== undefined && milestoneIndex >= 0 && byIndex[milestoneIndex])
        return byIndex[milestoneIndex];
    const byName: Record<string, { label: string; className: string }> = {
        "D1 SITE MEASUREMENT": { label: "D1", className: "bg-sky-100 text-sky-800" },
        "DQC1": { label: "DQC 1", className: "bg-purple-100 text-purple-800" },
        "10% PAYMENT": { label: "10% PAYMENT", className: "bg-amber-100 text-amber-800" },
        "D2 SITE MASKING": { label: "D2", className: "bg-sky-100 text-sky-800" },
        "DQC2": { label: "DQC 2", className: "bg-purple-100 text-purple-800" },
        "40% PAYMENT": { label: "40% PAYMENT", className: "bg-amber-100 text-amber-800" },
        "PUSH TO PRODUCTION": { label: "PUSH TO PROD.", className: "bg-green-100 text-green-800" },
    };
    if (milestoneName && byName[milestoneName]) return byName[milestoneName];
    return { label: "—", className: "bg-gray-100 text-gray-600" };
}

// Next action text from bucket (fallback when milestone not available)
function getNextAction(bucket: string): string {
    if (bucket === "Pre 10%") return "Complete D1 submission";
    if (bucket === "10-20%") return "Submit for QC";
    if (bucket === "20-60%") return "Transition to Prod.";
    return "Continue design";
}

// Milestone options for the Filter dropdown (Design Phase table)
const MILESTONE_FILTER_OPTIONS: { value: string; label: string }[] = [
    { value: "", label: "All milestones" },
    { value: "D1 SITE MEASUREMENT", label: "D1 SITE MEASUREMENT" },
    { value: "DQC1", label: "DQC1" },
    { value: "10% PAYMENT", label: "10% PAYMENT" },
    { value: "D2 SITE MASKING", label: "D2 SITE MASKING" },
    { value: "DQC2", label: "DQC2" },
    { value: "40% PAYMENT", label: "40% PAYMENT" },
    { value: "PUSH TO PRODUCTION", label: "PUSH TO PRODUCTION" },
];

// Next action from current milestone (Design Phase table)
function getNextActionFromMilestone(milestoneIndex: number | undefined, milestoneName: string | null | undefined): string {
    if (milestoneIndex !== undefined && milestoneIndex >= 0) {
        const actions: Record<number, string> = {
            0: "Complete D1 tasks",
            1: "Submit for QC",
            2: "Collect 10% payment",
            3: "Raise D2 masking / Upload D2",
            4: "Submit for QC",
            5: "Request 40% payment",
            6: "Cx approval / Push to prod.",
        };
        if (actions[milestoneIndex] !== undefined) return actions[milestoneIndex];
    }
    if (milestoneName) {
        const byName: Record<string, string> = {
            "D1 SITE MEASUREMENT": "Complete D1 tasks",
            "DQC1": "Submit for QC",
            "10% PAYMENT": "Collect 10% payment",
            "D2 SITE MASKING": "Raise D2 masking / Upload D2",
            "DQC2": "Submit for QC",
            "40% PAYMENT": "Request 40% payment",
            "PUSH TO PRODUCTION": "Cx approval / Push to prod.",
        };
        if (byName[milestoneName]) return byName[milestoneName];
    }
    return "Continue design";
}

function getInitials(name: string | null | undefined): string {
    if (!name || !name.trim()) return "—";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

const API = getApiBase();

type DqcQueueItem = {
  id: number;
  projectName: string;
  projectStage: string;
  dqcStatus: "Pending DQC" | "Approved DQC";
  dqc1Pending?: boolean;
  dqc2Pending?: boolean;
};

export default function Dashboard() {
    const pathname = usePathname();
    const { user, sessionId } = useAuth();
    const [projects, setProjects] = useState<LeadshipTypes[]>([]);
    const [dqcProjects, setDqcProjects] = useState<DqcQueueItem[]>([]);
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const targetLeadRef = useRef<number | null>(null);

    const isMmtUser = ["mmt_manager", "mmt_executive"].includes((user?.role || "").toLowerCase());
    const isDqcUser = ["dqc_manager", "dqe"].includes((user?.role || "").toLowerCase());
    const isFinanceUser = (user?.role || "").toLowerCase() === "finance";

    // Finance: limited access – 10% and 40% payment upload/approve only, no full project list
    if (isFinanceUser) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Limited access</h2>
                    <p className="text-gray-600 mb-6">
                        As finance, you can only upload payment screenshots and approve 10% and 40% payments. You do not have access to the full project list or lead details.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <a
                            href="/finance"
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
                        >
                            10% Payment
                        </a>
                        <a
                            href="/finance/40"
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
                        >
                            40% Payment
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // Fetch leads queue (DQC users get dqc-queue; others get queue)
    useEffect(() => {
        let cancelled = false;
        const headers: Record<string, string> = {};
        if (sessionId) headers["Authorization"] = `Bearer ${sessionId}`;
        const url = isDqcUser ? `${API}/api/leads/dqc-queue` : `${API}/api/leads/queue`;
        fetch(url, { headers })
            .then((res) => res.text().then((t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } }))
            .then((data) => {
                if (cancelled) return;
                if (isDqcUser && Array.isArray(data)) setDqcProjects(data);
                else if (!isDqcUser && Array.isArray(data)) setProjects(data);
            })
            .catch(() => {
                if (!cancelled) {
                    if (isDqcUser) setDqcProjects([]);
                    else setProjects([]);
                }
            });
        return () => { cancelled = true; };
    }, [sessionId, isDqcUser]);

    const onUploadClick = (e: React.MouseEvent, leadId: number) => {
        e.stopPropagation();
        targetLeadRef.current = leadId;
        fileInputRef.current?.click();
    };

    const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        const leadId = targetLeadRef.current;
        if (!file || !leadId || !sessionId) return;
        setUploadingId(leadId);
        try {
            const fd = new FormData();
            fd.append("zip", file);
            const res = await fetch(`${API}/api/leads/${leadId}/uploads`, {
                method: "POST",
                headers: { Authorization: `Bearer ${sessionId}` },
                body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Upload failed");
        } catch (err) {
            console.error("Upload error", err);
        } finally {
            setUploadingId(null);
            targetLeadRef.current = null;
        }
    };

    const allTypes = Object.values(SideDashboard);
    const [isDropdownOpen, setIsDropdownOpen] = useState(true);
    const [isSelected, setIsSelected] = useState<string>(allTypes[0]); // "All Projects (10-60%)"
    const [searchQuery, setSearchQuery] = useState("");
    const [milestoneFilter, setMilestoneFilter] = useState<string>("");
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
    const filterDropdownRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const filteredProjects = isSelected === "All Projects (10-60%)"
        ? projects.filter((p) => {
            const phase = getPhaseBucket(p);
            return phase === "10-20%" || phase === "20-60%";
          })
        : projects.filter((p) => getPhaseBucket(p) === isSelected);

    const searchFiltered = searchQuery.trim()
        ? filteredProjects.filter(
            (p) =>
                (p.projectName || "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                (p.pid || "").toLowerCase().includes(searchQuery.trim().toLowerCase()),
          )
        : filteredProjects;

    const milestoneFiltered = milestoneFilter
        ? searchFiltered.filter((p) => (p.currentMilestoneName ?? "") === milestoneFilter)
        : searchFiltered;

    const totalItems = milestoneFiltered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const paginatedProjects = milestoneFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const stats = {
        total: milestoneFiltered.length,
        pre10: milestoneFiltered.filter((p) => getPhaseBucket(p) === "Pre 10%").length,
        bucket1020: milestoneFiltered.filter((p) => getPhaseBucket(p) === "10-20%").length,
        bucket2060: milestoneFiltered.filter((p) => getPhaseBucket(p) === "20-60%").length,
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleSelection = (type: string) => {
        setIsSelected(type);
    }

    const router = useRouter();

    useEffect(() => {
        setPage(1);
    }, [isSelected, searchQuery, milestoneFilter]);

    // Close filter dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
                setFilterDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleRouter = (projectId: number, dqcStage?: "dqc1" | "dqc2") => {
        if (isDqcUser && dqcStage) {
            router.push(`/Leads/${projectId}?view=dqc&stage=${dqcStage}`);
        } else if (isDqcUser) {
            router.push(`/Leads/${projectId}?view=dqc`);
        } else {
            router.push(`/Leads/${projectId}`);
        }
    };

    const renderDqcRow = (row: DqcQueueItem, stage: "dqc1" | "dqc2", label: string) => (
        <div
            key={`${stage}-${row.id}`}
            className={`xl:grid xl:grid-cols-5 xl:gap-4 xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:text-gray-900 xl:cursor-pointer xl:items-center ${(row.id % 2 === 0) ? "bg-gray-50" : "bg-gray-100"}`}
            onClick={() => handleRouter(row.id, stage)}
        >
            <div className="xl:text-lg xl:font-semibold xl:text-center">{row.id}</div>
            <div className="xl:text-lg xl:font-semibold xl:text-left">{row.projectName}</div>
            <div className="xl:text-lg xl:font-semibold xl:text-center">{getStatusDisplay(row.projectStage)}</div>
            <div className="xl:text-center" onClick={(e) => { e.stopPropagation(); handleRouter(row.id, stage); }}>
                <span className="xl:px-4 xl:py-2 xl:rounded-lg xl:bg-blue-600 xl:text-white xl:font-semibold xl:text-sm hover:xl:bg-blue-700 inline-block cursor-pointer">
                    {label}
                </span>
            </div>
            <div className={`xl:text-center xl:font-semibold xl:text-sm ${row.dqcStatus === "Approved DQC" ? "xl:text-green-700" : "xl:text-amber-700"}`}>
                {row.dqcStatus}
            </div>
        </div>
    );

    const renderContent = () => {
        if (isDqcUser) {
            const list = dqcProjects.filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
            const dqc1List = list.filter((row) => row.dqc1Pending);
            const dqc2List = list.filter((row) => row.dqc2Pending);
            return (
                <div className="xl:space-y-8">
                    <div>
                        <h3 className="xl:text-base xl:font-bold xl:mb-3 xl:text-gray-800">DQC 1 Approval</h3>
                        {dqc1List.length === 0 ? (
                            <p className="xl:text-sm xl:text-gray-500 xl:p-4">No leads pending DQC 1 approval.</p>
                        ) : (
                            dqc1List.map((row) => renderDqcRow(row, "dqc1", "DQC 1 Review"))
                        )}
                    </div>
                    <div>
                        <h3 className="xl:text-base xl:font-bold xl:mb-3 xl:text-gray-800">DQC 2 Approval</h3>
                        {dqc2List.length === 0 ? (
                            <p className="xl:text-sm xl:text-gray-500 xl:p-4">No leads pending DQC 2 approval.</p>
                        ) : (
                            dqc2List.map((row) => renderDqcRow(row, "dqc2", "DQC 2 Review"))
                        )}
                    </div>
                </div>
            );
        }
        // Deduplicate by id so React keys are unique (API may return duplicate ids)
        const seen = new Set<number>();
        const list = filteredProjects.filter((p) => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
        });
        if (isMmtUser) {
            return (
                <div>
                    {list.map((arr1) => (
                        <div
                            key={arr1.id}
                            className={`xl:grid xl:grid-cols-4 xl:gap-4 xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md hover:xl:bg-green-100 xl:text-gray-900 xl:cursor-pointer xl:items-center ${(arr1.id % 2 === 0) ? "bg-gray-50" : "bg-gray-100"}`}
                            onClick={() => handleRouter(arr1.id)}
                        >
                            <div className="xl:text-lg xl:font-semibold xl:text-center">{arr1.id}</div>
                            <div className="xl:text-lg xl:font-semibold xl:text-left">{arr1.projectName}</div>
                            <div className="xl:text-lg xl:font-semibold xl:text-center">{getStatusDisplay(arr1.projectStage)}</div>
                            <div className="xl:text-center" onClick={(e) => onUploadClick(e, arr1.id)}>
                                <button
                                    type="button"
                                    disabled={uploadingId === arr1.id}
                                    className="xl:px-4 xl:py-2 xl:rounded-lg xl:bg-green-600 xl:text-white xl:font-semibold xl:text-sm hover:xl:bg-green-700 disabled:xl:opacity-60"
                                >
                                    {uploadingId === arr1.id ? "Uploading…" : "Upload ZIP"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
        // Design Phase Projects layout: stats cards + table + pagination (all from dynamic filtered list)
        const deduped = paginatedProjects.filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-[120px]">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate" title="Total Design">Total</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                        <p className="text-xs text-gray-500 mt-0.5">projects</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-[120px]">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate" title="Waiting Approval">Waiting</p>
                        <p className="text-2xl font-bold text-amber-700 mt-1">0</p>
                        <p className="text-xs text-gray-500 mt-0.5">—</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-[120px]">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Delayed</p>
                        <p className="text-2xl font-bold text-red-700 mt-1">{stats.pre10}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Pre 10%</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-[120px]">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Under QC</p>
                        <p className="text-2xl font-bold text-purple-700 mt-1">{stats.bucket1020}</p>
                        <p className="text-xs text-gray-500 mt-0.5">10-20%</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-[120px]">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ready Prod.</p>
                        <p className="text-2xl font-bold text-green-700 mt-1">{stats.bucket2060}</p>
                        <p className="text-xs text-gray-500 mt-0.5">20-60%</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[920px]">
                            <thead>
                                <tr className="bg-gray-900 text-white text-left text-sm font-semibold">
                                    <th className="py-3 px-5">ID / Project Name</th>
                                    <th className="py-3 px-5">Designer</th>
                                    <th className="py-3 px-5">Milestone</th>
                                    <th className="py-3 px-5">Progress %</th>
                                    <th className="py-3 px-5">Last Update</th>
                                    <th className="py-3 px-5">Next Action</th>
                                    <th className="py-3 px-5">Status</th>
                                    <th className="py-3 px-5">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deduped.map((row) => {
                                    const bucket = getPhaseBucket(row);
                                    const progress =
                                        row.currentMilestoneProgress != null
                                            ? row.currentMilestoneProgress
                                            : getProgressPercent(bucket);
                                    const statusInfo =
                                        row.currentMilestoneIndex != null || row.currentMilestoneName
                                            ? getStatusFromMilestone(row.currentMilestoneIndex, row.currentMilestoneName ?? undefined)
                                            : getStatusFromBucket(bucket);
                                    const designerName = row.designerName ?? "—";
                                    return (
                                        <tr
                                            key={row.id}
                                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                            onClick={() => handleRouter(row.id)}
                                        >
                                            <td className="py-3 px-5">
                                                <div className="font-medium text-gray-900">PJ-{row.pid || row.id}</div>
                                                <div className="text-sm text-gray-600 truncate max-w-[180px]" title={row.projectName}>{row.projectName || "—"}</div>
                                            </td>
                                            <td className="py-3 px-5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-semibold shrink-0">
                                                        {getInitials(designerName)}
                                                    </div>
                                                    <span className="text-sm text-gray-700 truncate max-w-[100px]" title={designerName}>{designerName}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-5 text-sm text-gray-700">{row.currentMilestoneName ?? bucket}</td>
                                            <td className="py-3 px-5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-blue-500 transition-all"
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-600">{progress}%</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-5 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(row.updateAt)}</td>
                                            <td className="py-3 px-5 text-sm text-gray-700">
                                                {row.currentMilestoneIndex != null || row.currentMilestoneName
                                                    ? getNextActionFromMilestone(row.currentMilestoneIndex, row.currentMilestoneName ?? undefined)
                                                    : getNextAction(bucket)}
                                            </td>
                                            <td className="py-3 px-5">
                                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${statusInfo.className}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="py-3 px-5" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRouter(row.id)}
                                                    className="text-sm font-semibold text-blue-600 hover:underline"
                                                >
                                                    View Project
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {totalItems === 0 && (
                        <div className="py-12 text-center text-gray-500 text-sm">No projects match the current filter or search.</div>
                    )}
                    {totalItems > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm">
                            <span className="text-gray-600">
                                Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalItems)} of {totalItems} projects
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                    className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50 hover:bg-gray-50"
                                >
                                    ←
                                </button>
                                <span className="px-2 text-gray-600">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50 hover:bg-gray-50"
                                >
                                    →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div>
            <main className="">
                <div className="xl:grid xl:grid-cols-5 xl:gap-4">
                    <div className=" xl:grid-cols-1 xl:h-screen border-r border-gray-300 xl:pt-4 xl:pl-2">

                    {!isDqcUser && (
                        <>
                    <div 
                        className="xl:flex xl:justify-between xl:items-center mb-2 xl:pr-2 xl:py-4 xl:cursor-pointer"
                        onClick={toggleDropdown}
                    >
                    <div className="xl:text-lg xl:font-semibold xl:pl-2 xl:pt-4">My WorkSpace</div>
                    <div>
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            strokeWidth="1.5" 
                            stroke="currentColor" 
                            className={`size-5 mt-4 font-bold xl:cursor-pointer transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </div>
                    </div>
                    {isDropdownOpen && (
                        <div className="xl:transition-all xl:duration-200">
                            <p className="xl:pl-2 xl:pt-2 xl:pb-1 text-xs font-bold text-gray-500 uppercase tracking-wide">Design Phases</p>
                            {allTypes.map((type, index) => (
                                <div
                                    key={index}
                                    onClick={() => handleSelection(type)}
                                    className={`xl:p-4 xl:border-gray-300 xl:cursor-pointer xl:font-semibold xl:inline-block xl:w-66.25 text-left xl:transition-all xl:duration-200 ${
                                        isSelected === type 
                                            ? 'xl:border-l-4 xl:border-l-green-400 xl:bg-gray-100 xl:text-green-400 xl:font-bold' 
                                            : 'hover:xl:xl:border-l-4 hover:xl:border-l-green-400 hover:xl:bg-gray-100 hover:xl:text-green-400 hover:xl:font-bold hover:xl:scale-105'
                                    }`}
                                >
                                    {type}
                                </div>
                            ))}
                        </div>
                    )}   
                        </>
                    )}
                    {isDqcUser && (
                        <div className="xl:text-lg xl:font-semibold xl:pl-2 xl:pt-4">DQC Queue</div>
                    )}
                    </div>
                    <div className="xl:col-span-4 min-w-0 flex-1 w-full overflow-auto">
                        {!isDqcUser && !isMmtUser ? (
                            <div className="p-4 xl:p-6 space-y-6 max-w-[1600px]">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <h1 className="text-xl xl:text-2xl font-bold text-gray-900">Design Phase Projects</h1>
                                        <p className="text-sm text-gray-500 mt-0.5">Projects between 10% and 60% progress.</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <input
                                            type="search"
                                            placeholder="Search projects..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-48 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        <div className="relative" ref={filterDropdownRef}>
                                            <button
                                                type="button"
                                                onClick={() => setFilterDropdownOpen((o) => !o)}
                                                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
                                            >
                                                <span>Filter</span>
                                                {milestoneFilter ? (
                                                    <span className="text-blue-600 font-semibold truncate max-w-[120px]" title={MILESTONE_FILTER_OPTIONS.find((o) => o.value === milestoneFilter)?.label}>
                                                        {MILESTONE_FILTER_OPTIONS.find((o) => o.value === milestoneFilter)?.label}
                                                    </span>
                                                ) : null}
                                                <span aria-hidden>▾</span>
                                            </button>
                                            {filterDropdownOpen && (
                                                <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] py-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                                    <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-100">By milestone</p>
                                                    {MILESTONE_FILTER_OPTIONS.map((opt) => (
                                                        <button
                                                            key={opt.value || "all"}
                                                            type="button"
                                                            onClick={() => {
                                                                setMilestoneFilter(opt.value);
                                                                setFilterDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${opt.value === milestoneFilter ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"}`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button type="button" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                                            + Add Project
                                        </button>
                                    </div>
                                </div>
                                {renderContent()}
                            </div>
                        ) : (
                            <>
                                <div className={`xl:grid xl:gap-4 xl:min-w-287.5 xl:p-4 xl:m-2 xl:border xl:border-gray-300 xl:rounded-lg xl:shadow-md xl:bg-black xl:text-white xl:text-lg xl:font-bold xl:items-center ${isDqcUser ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
                                    <div className="xl:text-center">ID</div>
                                    <div className="xl:text-left">{isDqcUser ? "Name" : "Project Name"}</div>
                                    <div className="xl:text-center">Stage</div>
                                    {isDqcUser && (
                                        <>
                                            <div className="xl:text-center">Quality Check</div>
                                            <div className="xl:text-center">DQC Status</div>
                                        </>
                                    )}
                                    {!isDqcUser && isMmtUser && <div className="xl:text-center">Upload</div>}
                                </div>
                                {renderContent()}
                            </>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".zip,application/zip,.dwg"
                            className="hidden"
                            onChange={onFileSelected}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
