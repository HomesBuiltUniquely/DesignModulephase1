'use client';

import { SideDashboard, SideDashboardStatus } from "../Enums/Enums";
import { usePathname, useRouter } from "next/navigation";
import { LeadshipTypes } from "./Types/Types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getApiBase } from "@/app/lib/apiBase";
import { BRANCH_OPTIONS } from "../constants/branches";
import { getPhaseBucket } from "@/app/lib/leadPhaseBucket";
import { createProlanceProjectViaApi } from "@/app/lib/prolanceApiCreateProject";
import { runProlanceGetQuoteApiFlow } from "@/app/lib/prolanceApiGetQuote";
import {
    openInternalQuoteInNewTab,
    persistProlanceQuoteIdsAndSnapshot,
    storePostGetQuotePreview,
} from "@/app/lib/prolanceGetQuotePersistSnapshot";
import { openProlanceBrowserForProjectId } from "@/app/lib/prolanceLinks";
import { Pre10LeadViewModal } from "./Pre10LeadViewModal";
import { AddProjectModal } from "./AddProjectModal";

// Stage column: Active / Inactive (sales) / Cancelled (TDM admin DGM)
function getStatusDisplay(stage: string): "Active" | "Inactive" | "Cancelled" {
    if (!stage) return "Active";
    const s = stage.trim();
    if (/^cancelled$/i.test(s)) return "Cancelled";
    if (s === "Inactive") return "Inactive";
    return "Active";
}

function isCancelledLead(p: LeadshipTypes): boolean {
    return getStatusDisplay(p.projectStage) === "Cancelled";
}

function passesWorkspaceStatusFilter(p: LeadshipTypes, statusTab: string): boolean {
    if (statusTab === SideDashboardStatus.All_Statuses) return true;
    if (statusTab === SideDashboardStatus.On_Hold) return !!p.isOnHold;
    if (statusTab === SideDashboardStatus.Active) {
        return !p.isOnHold && getStatusDisplay(p.projectStage) === "Active";
    }
    if (statusTab === SideDashboardStatus.Cancelled) {
        return isCancelledLead(p);
    }
    return true;
}

// Helper to format backend date strings (ISO) to "dd/MM/yyyy h:mm A"
function formatLeadTimeSlot(row: LeadshipTypes): string {
    const date = row.appointmentDate?.trim() || "";
    let slot = row.appointmentSlot?.trim() || "";
    if (slot.startsWith("{") || slot.startsWith("[")) {
        try {
            const parsed = JSON.parse(slot) as Record<string, unknown>;
            slot =
                String(parsed.label ?? parsed.name ?? parsed.slot ?? parsed.time ?? parsed.start ?? "").trim() ||
                slot;
        } catch {
            // keep raw slot string
        }
    }
    // Prefer appointment_slot text (e.g. "5:00 PM - 7:00 PM"); append date when present.
    if (slot && date) return `${slot} (${date})`;
    if (slot) return slot;
    if (date) return date;
    return "—";
}

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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** Page numbers with ellipsis (e.g. 1 2 3 4 5 … 106). */
function getPaginationRange(current: number, total: number): (number | "ellipsis")[] {
    if (total <= 1) return [1];
    if (total <= 9) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    const delta = 2;
    const range: number[] = [];
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
            range.push(i);
        }
    }
    const out: (number | "ellipsis")[] = [];
    let prev: number | undefined;
    for (const i of range) {
        if (prev !== undefined && i - prev > 1) {
            out.push("ellipsis");
        }
        out.push(i);
        prev = i;
    }
    return out;
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

type AssignableDesigner = {
    id: number;
    name: string;
    role: "designer" | "design_manager";
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
    const isDesigner = (user?.role || "").toLowerCase() === "designer";
    const isDqcUser = ["dqc_manager", "dqe"].includes((user?.role || "").toLowerCase());
    const isFinanceUser = (user?.role || "").toLowerCase() === "finance";
    const isAdmin = (user?.role || "").toLowerCase() === "admin";
    const canImportLeads =
        isAdmin ||
        (user?.role || "").toLowerCase() === "territorial_design_manager" ||
        (user?.role || "").toLowerCase() === "deputy_general_manager" ||
        (user?.role || "").toLowerCase() === "design_manager";

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
                            href="/finance/sales-closure"
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
                        >
                            Sales Closure
                        </a>
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
                if (isDqcUser && Array.isArray(data)) setDqcProjects([...data].sort((a, b) => b.id - a.id));
                else if (!isDqcUser && Array.isArray(data)) setProjects([...data].sort((a, b) => b.id - a.id));
            })
            .catch(() => {
                if (!cancelled) {
                    if (isDqcUser) setDqcProjects([]);
                    else setProjects([]);
                }
            });
        return () => { cancelled = true; };
    }, [sessionId, isDqcUser]);

    useEffect(() => {
        if ((!canImportLeads && !isAdmin) || !sessionId) return;
        fetch(`${API}/api/designers/assignable`, {
            headers: { Authorization: `Bearer ${sessionId}` },
        })
            .then((res) => res.json())
            .then((rows: AssignableDesigner[]) => {
                if (Array.isArray(rows)) setAssignableDesigners(rows);
            })
            .catch(() => setAssignableDesigners([]));
    }, [canImportLeads, isAdmin, sessionId]);

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
    const allStatusTypes = Object.values(SideDashboardStatus);
    const [isDropdownOpen, setIsDropdownOpen] = useState(true);
    const [designPhasesOpen, setDesignPhasesOpen] = useState(true);
    const [projectStatusOpen, setProjectStatusOpen] = useState(true);
    const [isSelected, setIsSelected] = useState<string>(allTypes[0]); // "All Projects (10-60%)"
    const [statusSelected, setStatusSelected] = useState<string>(allStatusTypes[0]);
    const [searchQuery, setSearchQuery] = useState("");
    const [milestoneFilter, setMilestoneFilter] = useState<string>("");
    /** Branch (experience center); only applied for non-designers on the design queue */
    const [branchFilter, setBranchFilter] = useState<string>("");
    /** "" = all, "__unassigned__", or designer user id */
    const [designerFilter, setDesignerFilter] = useState<string>("");
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
    const filterDropdownRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [showImportPanel, setShowImportPanel] = useState(false);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [previewToken, setPreviewToken] = useState<string | null>(null);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [excelRowCount, setExcelRowCount] = useState(0);
    const [targetFields, setTargetFields] = useState<Array<{ key: string; label: string; required: boolean }>>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [importDesignerId, setImportDesignerId] = useState<number | "">("");
    const [previewLoading, setPreviewLoading] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const [assignableDesigners, setAssignableDesigners] = useState<AssignableDesigner[]>([]);
    const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
    const [bulkDesignerId, setBulkDesignerId] = useState<number | "">("");
    const [bulkAssignLoading, setBulkAssignLoading] = useState(false);
    const [bulkAssignMessage, setBulkAssignMessage] = useState<string | null>(null);
    const [singleAssignByLead, setSingleAssignByLead] = useState<Record<number, number | "">>({});
    const [singleAssignLoadingLeadId, setSingleAssignLoadingLeadId] = useState<number | null>(null);
    /** Pre 10% “Prolance” row: API create in flight for this lead id */
    const [prolanceCreateLeadId, setProlanceCreateLeadId] = useState<number | null>(null);
    /** Pre 10% / mixed Pre 10 row: Get quote API in flight for this lead id */
    const [getQuoteLeadId, setGetQuoteLeadId] = useState<number | null>(null);
    /** Lead shown in View popup (Pre 10%, 10–20%, 20–60%) */
    const [viewLead, setViewLead] = useState<LeadshipTypes | null>(null);
    const [showFinancePopup, setShowFinancePopup] = useState(false);
    const [showAddProjectModal, setShowAddProjectModal] = useState(false);

    const phaseFilteredProjects =
        statusSelected === SideDashboardStatus.Cancelled
            ? projects.filter(isCancelledLead)
            : isSelected === "All Projects (10-60%)"
              ? projects.filter((p) => {
                    if (isCancelledLead(p)) return false;
                    const phase = getPhaseBucket(p);
                    return phase === "10-20%" || phase === "20-60%";
                })
              : projects.filter((p) => !isCancelledLead(p) && getPhaseBucket(p) === isSelected);

    const filteredProjects = phaseFilteredProjects.filter((p) =>
        passesWorkspaceStatusFilter(p, statusSelected),
    );

    const searchFiltered = searchQuery.trim()
        ? filteredProjects.filter(
            (p) =>
                (p.projectName || "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                (p.pid || "").toLowerCase().includes(searchQuery.trim().toLowerCase()),
          )
        : filteredProjects;

    const showBranchDesignerFilters =
        !isDesigner && !isDqcUser && !isMmtUser && !isFinanceUser;

    const designerFilterOptions = useMemo(() => {
        const idMap = new Map<number, string>(); // id -> name
        const nameMap = new Map<string, string>(); // lowercaseName -> originalName

        for (const p of projects) {
            const id = p.assigned_designer_id;
            const name = (p.designerName || "").trim();
            if (!name) continue;

            if (id != null) {
                if (!idMap.has(id)) idMap.set(id, name);
            } else {
                const lower = name.toLowerCase();
                if (!nameMap.has(lower)) nameMap.set(lower, name);
            }
        }

        const options: Array<[string, string]> = [];
        const seenNames = new Set<string>();

        // Prefer real user IDs for designers in the system
        for (const [id, name] of idMap.entries()) {
            options.push([String(id), name]);
            seenNames.add(name.toLowerCase());
        }

        // Add designers found by name (from CRM intake) who aren't yet matched to a system user
        for (const [lower, name] of nameMap.entries()) {
            if (!seenNames.has(lower)) {
                options.push([`name:${name}`, name]);
            }
        }

        return options.sort((a, b) => a[1].localeCompare(b[1]));
    }, [projects]);

    const hasUnassignedInQueue = useMemo(
        () => projects.some((p) => p.assigned_designer_id == null),
        [projects],
    );

    let queueFilterFiltered = searchFiltered;
    if (showBranchDesignerFilters) {
        if (branchFilter) {
            const b = branchFilter.trim().toUpperCase();
            queueFilterFiltered = queueFilterFiltered.filter(
                (p) => (p.experienceCenter || "").trim().toUpperCase() === b,
            );
        }
        if (designerFilter === "__unassigned__") {
            queueFilterFiltered = queueFilterFiltered.filter((p) => p.assigned_designer_id == null);
        } else if (designerFilter) {
            if (designerFilter.startsWith("name:")) {
                const nameToMatch = designerFilter.replace("name:", "").toLowerCase();
                queueFilterFiltered = queueFilterFiltered.filter(
                    (p) => (p.designerName || "").trim().toLowerCase() === nameToMatch,
                );
            } else {
                const id = Number(designerFilter);
                if (!Number.isNaN(id)) {
                    queueFilterFiltered = queueFilterFiltered.filter((p) => p.assigned_designer_id === id);
                }
            }
        }
    }

    const milestoneFiltered = milestoneFilter
        ? queueFilterFiltered.filter((p) => (p.currentMilestoneName ?? "") === milestoneFilter)
        : queueFilterFiltered;

    const totalItems = milestoneFiltered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const paginatedProjects = milestoneFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
    };

    const handleStatusSelection = (status: string) => {
        setStatusSelected(status);
    };

    const router = useRouter();

    useEffect(() => {
        setPage(1);
    }, [isSelected, statusSelected, searchQuery, milestoneFilter, branchFilter, designerFilter, pageSize]);

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

    const handleRouter = (rowOrId: LeadshipTypes | number, dqcStage?: "dqc1" | "dqc2") => {
        const id = typeof rowOrId === "number" ? rowOrId : rowOrId.id;
        const leadRow =
            typeof rowOrId === "number" ? projects.find((p) => p.id === rowOrId) ?? null : rowOrId;
        if (leadRow && getPhaseBucket(leadRow) === "Pre 10%") {
            return;
        }
        if (leadRow && (leadRow as any).financeApprovedRaw === "false") {
            setShowFinancePopup(true);
            return;
        }
        if (isDqcUser && dqcStage) {
            router.push(`/Leads/${id}?view=dqc&stage=${dqcStage}`);
        } else if (isDqcUser) {
            router.push(`/Leads/${id}?view=dqc`);
        } else {
            router.push(`/Leads/${id}`);
        }
    };

    const runGetQuoteForDashboardLead = async (row: LeadshipTypes) => {
        /** Always call Prolance for Get quote. A saved `prolanceQuoteId` can be an older revision (e.g. draft 67556) while the project has a newer quotation (e.g. ₹43,557). */
        const pid = row.prolanceProjectId != null ? Number(row.prolanceProjectId) : NaN;
        if (!Number.isFinite(pid) || pid < 1) {
            window.alert(
                "Add a Prolance project ID on this lead (use Prolance on this row or lead settings), then run Get quote again.",
            );
            return;
        }
        if (!sessionId) {
            window.alert("Please sign in to run Get quote.");
            return;
        }
        setGetQuoteLeadId(row.id);
        setBulkAssignMessage(null);
        try {
            const result = await runProlanceGetQuoteApiFlow({
                appApiBase: API,
                sessionId,
                quoteProjectId: pid,
            });
            if (!result.ok) {
                setBulkAssignMessage(result.message);
                return;
            }
            const { quoteBody, redirectQuoteId, quoteProjectId: resolvedPid, partnerIdFromLogin } = result;
            if (redirectQuoteId != null) {
                const patchOk = await persistProlanceQuoteIdsAndSnapshot({
                    appApiBase: API,
                    sessionId,
                    leadId: row.id,
                    prolanceQuoteId: redirectQuoteId,
                    quoteBody,
                });
                if (!patchOk) {
                    setBulkAssignMessage(
                        `Get quote succeeded (quote ${redirectQuoteId}) but saving on the lead failed. Open the quote from the link if needed.`,
                    );
                } else {
                    setBulkAssignMessage(`Get quote saved for HUB-${row.pid ?? row.id} (quote ${redirectQuoteId}).`);
                }
                openInternalQuoteInNewTab(redirectQuoteId, row.id);
            } else {
                if (quoteBody == null) {
                    setBulkAssignMessage(
                        "Get quote finished but returned no quotation JSON. Check the Prolance project and try again.",
                    );
                    await refreshQueue();
                    return;
                }
                const stored = storePostGetQuotePreview({
                    leadId: row.id,
                    quoteBody,
                    effectiveStatus: result.effectiveStatus,
                    resolvedPid: resolvedPid,
                    partnerIdFromLogin: partnerIdFromLogin ?? null,
                });
                if (stored) {
                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                    const qs = new URLSearchParams({
                        internal: "1",
                        leadId: String(row.id),
                    });
                    window.open(
                        `${origin}/quote/preview?${qs.toString()}`,
                        "_blank",
                        "noopener,noreferrer",
                    );
                    setBulkAssignMessage("Opening full quotation in a new tab (customer link, versions, discount).");
                } else {
                    setBulkAssignMessage(
                        "Get quote returned a large response; open this lead from the dashboard after it moves past Pre 10%, or run Get Quote again from the lead workspace.",
                    );
                }
            }
            await refreshQueue();
        } catch (err) {
            setBulkAssignMessage(err instanceof Error ? err.message : "Get quote failed");
        } finally {
            setGetQuoteLeadId(null);
        }
    };

    const toggleLeadSelection = (leadId: number) => {
        setSelectedLeadIds((prev) =>
            prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
        );
    };

    const toggleSelectAllVisible = (visibleLeadIds: number[]) => {
        const allSelected = visibleLeadIds.length > 0 && visibleLeadIds.every((id) => selectedLeadIds.includes(id));
        if (allSelected) {
            setSelectedLeadIds((prev) => prev.filter((id) => !visibleLeadIds.includes(id)));
        } else {
            setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...visibleLeadIds])));
        }
    };

    const refreshQueue = async () => {
        const headers: Record<string, string> = {};
        if (sessionId) headers.Authorization = `Bearer ${sessionId}`;
        const res = await fetch(`${API}/api/leads/queue`, { headers });
        const data = await res.json().catch(() => null);
        if (res.ok && Array.isArray(data)) setProjects([...data].sort((a, b) => b.id - a.id));
    };

    const handlePre10ProlanceRowClick = async (row: LeadshipTypes) => {
        const pid = row.prolanceProjectId != null ? Number(row.prolanceProjectId) : NaN;
        const hasProject = Number.isFinite(pid) && pid >= 1;
        if (hasProject) {
            openProlanceBrowserForProjectId(pid);
            return;
        }
        if (!sessionId) {
            window.alert("Please sign in to create a Prolance project.");
            return;
        }
        setProlanceCreateLeadId(row.id);
        setBulkAssignMessage(null);
        try {
            const result = await createProlanceProjectViaApi({ appApiBase: API, sessionId, project: row });
            if (!result.ok) {
                setBulkAssignMessage(result.message);
                return;
            }
            const warnSuffix = result.warning ? ` ${result.warning}` : "";
            const createdProjectId = result.createdProjectId;
            if (createdProjectId != null) {
                const res = await fetch(`${API}/api/leads/${row.id}/prolance-ids`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${sessionId}`,
                    },
                    body: JSON.stringify({ prolanceProjectId: createdProjectId }),
                });
                if (!res.ok) {
                    setBulkAssignMessage(
                        `Prolance project created (ID ${createdProjectId}) but saving on the lead failed. Save the ID in lead settings if needed.${warnSuffix}`,
                    );
                } else {
                    setBulkAssignMessage(
                        `Prolance project created (ID ${createdProjectId}) and saved on HUB-${row.pid ?? row.id}.${warnSuffix}`,
                    );
                }
            } else {
                setBulkAssignMessage(
                    `Prolance create returned OK; if no ID was parsed, link the project ID on the lead.${warnSuffix}`,
                );
            }
            await refreshQueue();
        } catch (err) {
            setBulkAssignMessage(err instanceof Error ? err.message : "Prolance create failed");
        } finally {
            setProlanceCreateLeadId(null);
        }
    };

    const handleAddProjectClick = () => {
        if (!sessionId) {
            window.alert("Please sign in to create a project.");
            return;
        }
        setShowAddProjectModal(true);
    };

    const handleAddProjectFormSuccess = async (message: string) => {
        setIsSelected(SideDashboard.Pre_10);
        setBulkAssignMessage(message);
        await refreshQueue();
    };

    const assignSingleLead = async (leadId: number) => {
        const designerId = singleAssignByLead[leadId];
        if (!designerId || !sessionId) return;
        setSingleAssignLoadingLeadId(leadId);
        setBulkAssignMessage(null);
        try {
            const res = await fetch(`${API}/api/leads/${leadId}/assign-designer`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${sessionId}`,
                },
                body: JSON.stringify({ designerId }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Failed to assign lead");
            setProjects((prev) =>
                prev.map((p) =>
                    p.id === leadId
                        ? {
                            ...p,
                            assigned_designer_id: Number(designerId),
                            designerName: data?.designerName ?? p.designerName,
                        }
                        : p,
                ),
            );
            setBulkAssignMessage(`Lead ${leadId} assigned to ${data?.designerName || "selected designer"}.`);
        } catch (err) {
            setBulkAssignMessage(err instanceof Error ? err.message : "Failed to assign lead");
        } finally {
            setSingleAssignLoadingLeadId(null);
        }
    };

    const assignBulkLeads = async () => {
        if (!sessionId) return;
        if (!bulkDesignerId) {
            setBulkAssignMessage("Please select a designer for bulk assignment.");
            return;
        }
        if (selectedLeadIds.length === 0) {
            setBulkAssignMessage("Please select at least one lead.");
            return;
        }
        setBulkAssignLoading(true);
        setBulkAssignMessage(null);
        try {
            const res = await fetch(`${API}/api/leads/assign-designer/bulk`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${sessionId}`,
                },
                body: JSON.stringify({ leadIds: selectedLeadIds, designerId: bulkDesignerId }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Bulk assign failed");
            await refreshQueue();
            setSelectedLeadIds([]);
            setBulkAssignMessage(
                `Bulk assignment complete: ${data?.updatedCount ?? 0} lead(s) assigned to ${data?.designerName || "selected designer"}.`,
            );
        } catch (err) {
            setBulkAssignMessage(err instanceof Error ? err.message : "Bulk assign failed");
        } finally {
            setBulkAssignLoading(false);
        }
    };

    const runExcelPreview = async () => {
        if (!excelFile) {
            setImportMessage("Please choose an Excel file first.");
            return;
        }
        if (!sessionId) {
            setImportMessage("Please login again.");
            return;
        }
        setPreviewLoading(true);
        setImportMessage(null);
        try {
            const fd = new FormData();
            fd.append("file", excelFile);
            const res = await fetch(`${API}/api/leads/import-excel/preview`, {
                method: "POST",
                headers: { Authorization: `Bearer ${sessionId}` },
                body: fd,
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Failed to preview Excel file");
            setPreviewToken(String(data.token));
            setExcelHeaders(Array.isArray(data.headers) ? data.headers : []);
            setExcelRowCount(Number(data.rowCount || 0));
            const tf = Array.isArray(data.targetFields) ? data.targetFields : [];
            setTargetFields(tf);
            const nextMappings: Record<string, string> = {};
            tf.forEach((f: { key: string; label: string }) => {
                const auto = (data.headers || []).find(
                    (h: string) =>
                        h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") ===
                        f.label.toLowerCase().replace(/[^a-z0-9]+/g, ""),
                );
                nextMappings[f.key] = auto || "";
            });
            setMappings(nextMappings);
            setImportMessage(`Preview loaded: ${Number(data.rowCount || 0)} rows found.`);
        } catch (err: unknown) {
            setImportMessage(err instanceof Error ? err.message : "Preview failed");
        } finally {
            setPreviewLoading(false);
        }
    };

    const runExcelImport = async () => {
        if (!previewToken) {
            setImportMessage("Preview first, then import.");
            return;
        }
        if (!importDesignerId) {
            setImportMessage("Please select a designer from DB for imported leads.");
            return;
        }
        if (!sessionId) {
            setImportMessage("Please login again.");
            return;
        }
        if (!mappings.projectName) {
            setImportMessage("Please map Project Name field before importing.");
            return;
        }
        setImportLoading(true);
        setImportMessage(null);
        try {
            const res = await fetch(`${API}/api/leads/import-excel/commit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${sessionId}`,
                },
                body: JSON.stringify({ token: previewToken, mappings, defaultDesignerId: importDesignerId }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Import failed");
            setImportMessage(`Import complete. Imported ${data.imported}/${data.totalRows}. Failed: ${data.failed}.`);
            setPreviewToken(null);
            setExcelFile(null);
            // Refresh dashboard queue after successful import.
            const headers: Record<string, string> = {};
            if (sessionId) headers["Authorization"] = `Bearer ${sessionId}`;
            const qRes = await fetch(`${API}/api/leads/queue`, { headers });
            const qData = await qRes.json().catch(() => null);
            if (qRes.ok && Array.isArray(qData)) setProjects([...qData].sort((a, b) => b.id - a.id));
        } catch (err: unknown) {
            setImportMessage(err instanceof Error ? err.message : "Import failed");
        } finally {
            setImportLoading(false);
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
                            onClick={() => handleRouter(arr1)}
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
        const pre10TabActive = isSelected === SideDashboard.Pre_10;
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
                        {pre10TabActive ? (
                            <table className="w-full min-w-[760px]">
                                <thead>
                                    <tr className="bg-gray-900 text-white text-left text-sm font-semibold">
                                        {canImportLeads && (
                                            <th className="py-3 px-3">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        deduped.length > 0 &&
                                                        deduped.every((row) => selectedLeadIds.includes(row.id))
                                                    }
                                                    onChange={() => toggleSelectAllVisible(deduped.map((d) => d.id))}
                                                />
                                            </th>
                                        )}
                                        <th className="py-3 px-5">ID / Project Name</th>
                                        <th className="py-3 px-5">Time slot</th>
                                        {isAdmin && <th className="py-3 px-5">Assignee</th>}
                                        <th className="py-3 px-5">View</th>
                                        <th className="py-3 px-5">Create project</th>
                                        <th className="py-3 px-5">Get quote</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deduped.map((row) => {
                                        const designerNameTrim = row.designerName?.trim() || null;
                                        const designerLabel = designerNameTrim ?? "Unassigned";
                                        const pmName = row.projectManagerName?.trim() || null;
                                        const pid = row.prolanceProjectId != null ? Number(row.prolanceProjectId) : NaN;
                                        const hasProject = Number.isFinite(pid) && pid >= 1;
                                        const prolanceRowBusy = prolanceCreateLeadId === row.id;
                                        const getQuoteRowBusy = getQuoteLeadId === row.id;
                                        const timeSlotLabel = formatLeadTimeSlot(row);
                                        return (
                                            <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                {canImportLeads && (
                                                    <td className="py-3 px-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLeadIds.includes(row.id)}
                                                            onChange={() => toggleLeadSelection(row.id)}
                                                        />
                                                    </td>
                                                )}
                                                <td className="py-3 px-5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-medium text-gray-900">HUB-{row.pid || row.id}</div>
                                                        {row.financeApprovedRaw === "false" && (
                                                            <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 ring-1 ring-inset ring-red-600/10 whitespace-nowrap">
                                                                Not Approved
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-gray-600 truncate max-w-[200px]" title={row.projectName}>
                                                        {row.projectName || "—"}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-5 text-sm text-gray-700 whitespace-nowrap" title={timeSlotLabel}>
                                                    {timeSlotLabel}
                                                </td>
                                                {isAdmin && (
                                                    <td className="py-3 px-5 min-w-[200px]">
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    {designerNameTrim ? (
                                                                        <div
                                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800 shadow-sm"
                                                                            title={designerNameTrim}
                                                                        >
                                                                            {getInitials(designerNameTrim)}
                                                                        </div>
                                                                    ) : null}
                                                                    {pmName ? (
                                                                        <div
                                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800 shadow-sm"
                                                                            title={`PM: ${pmName}`}
                                                                        >
                                                                            {getInitials(pmName)}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                <span
                                                                    className="max-w-[120px] truncate text-xs text-gray-600"
                                                                    title={designerLabel}
                                                                >
                                                                    {designerLabel}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <select
                                                                    id={`pre10-assign-${row.id}`}
                                                                    value={singleAssignByLead[row.id] ?? row.assigned_designer_id ?? ""}
                                                                    onChange={(e) =>
                                                                        setSingleAssignByLead((prev) => ({
                                                                            ...prev,
                                                                            [row.id]: e.target.value ? Number(e.target.value) : "",
                                                                        }))
                                                                    }
                                                                    className="max-w-[140px] rounded border border-gray-300 px-2 py-1 text-xs"
                                                                >
                                                                    <option value="">Designer…</option>
                                                                    {assignableDesigners.map((d) => (
                                                                        <option key={d.id} value={d.id}>
                                                                            {d.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => assignSingleLead(row.id)}
                                                                    disabled={singleAssignLoadingLeadId === row.id}
                                                                    className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                                                >
                                                                    {singleAssignLoadingLeadId === row.id ? "…" : "Assign"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="py-3 px-5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewLead(row)}
                                                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                                <td className="py-3 px-5">
                                                    <button
                                                        type="button"
                                                        disabled={!sessionId || prolanceRowBusy}
                                                        onClick={() => void handlePre10ProlanceRowClick(row)}
                                                        title={
                                                            hasProject
                                                                ? "Open this project in Prolance (browser)"
                                                                : "Create Prolance project via Hub API and save ID on this lead"
                                                        }
                                                        className="rounded-lg border border-teal-600 bg-white px-3 py-2 text-xs font-semibold text-teal-800 shadow-sm hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {prolanceRowBusy
                                                            ? "Creating…"
                                                            : hasProject
                                                              ? "Open Prolance"
                                                              : "Create project"}
                                                    </button>
                                                </td>
                                                <td className="py-3 px-5">
                                                    <button
                                                        type="button"
                                                        disabled={!sessionId || getQuoteRowBusy}
                                                        onClick={() => void runGetQuoteForDashboardLead(row)}
                                                        className="w-full min-w-[7rem] rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                                    >
                                                        {getQuoteRowBusy ? "Working…" : "Get quote"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full min-w-[920px]">
                                <thead>
                                    <tr className="bg-gray-900 text-left text-sm font-semibold text-white">
                                        {canImportLeads && (
                                            <th className="px-3 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        deduped.length > 0 &&
                                                        deduped.every((row) => selectedLeadIds.includes(row.id))
                                                    }
                                                    onChange={() => toggleSelectAllVisible(deduped.map((d) => d.id))}
                                                />
                                            </th>
                                        )}
                                        <th className="px-5 py-3">ID / Project Name</th>
                                        <th className="px-5 py-3">Designer</th>
                                        <th className="px-5 py-3">Milestone</th>
                                        <th className="px-5 py-3">Progress %</th>
                                        <th className="px-5 py-3">Last Update</th>
                                        <th className="px-5 py-3">Next Action</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deduped.map((row) => {
                                        const bucket = getPhaseBucket(row);
                                        const isPre10 = bucket === "Pre 10%";
                                        const progress = isPre10
                                            ? 0
                                            : row.currentMilestoneProgress != null
                                              ? row.currentMilestoneProgress
                                              : getProgressPercent(bucket);
                                        const statusInfo = isPre10
                                            ? { label: "Pre 10", className: "bg-gray-100 text-gray-700" }
                                            : row.currentMilestoneIndex != null || row.currentMilestoneName
                                              ? getStatusFromMilestone(row.currentMilestoneIndex, row.currentMilestoneName ?? undefined)
                                              : getStatusFromBucket(bucket);
                                        const designerName = row.designerName ?? "—";
                                        return (
                                            <tr
                                                key={row.id}
                                                className={`border-b border-gray-100 hover:bg-gray-50 ${isPre10 ? "" : "cursor-pointer"}`}
                                                onClick={isPre10 ? undefined : () => handleRouter(row)}
                                            >
                                                {canImportLeads && (
                                                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLeadIds.includes(row.id)}
                                                            onChange={() => toggleLeadSelection(row.id)}
                                                        />
                                                    </td>
                                                )}
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-medium text-gray-900">HUB-{row.pid || row.id}</div>
                                                        {row.financeApprovedRaw === "false" && (
                                                            <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 ring-1 ring-inset ring-red-600/10 whitespace-nowrap">
                                                                Not Approved
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-gray-600 truncate max-w-[180px]" title={row.projectName}>
                                                        {row.projectName || "—"}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800">
                                                            {getInitials(designerName)}
                                                        </div>
                                                        <span className="max-w-[100px] truncate text-sm text-gray-700" title={designerName}>
                                                            {designerName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-sm text-gray-700">
                                                    {isPre10 ? "—" : row.currentMilestoneName ?? bucket}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {isPre10 ? (
                                                        <span className="text-sm text-gray-400">—</span>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                                                                <div
                                                                    className="h-full rounded-full bg-blue-500 transition-all"
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-medium text-gray-600">{progress}%</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                                                    {formatDateTime(row.updateAt)}
                                                </td>
                                                <td className="px-5 py-3 text-sm text-gray-700">
                                                    {isPre10
                                                        ? "—"
                                                        : row.currentMilestoneIndex != null || row.currentMilestoneName
                                                          ? getNextActionFromMilestone(
                                                                row.currentMilestoneIndex,
                                                                row.currentMilestoneName ?? undefined,
                                                            )
                                                          : getNextAction(bucket)}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span
                                                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusInfo.className}`}
                                                    >
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {isPre10 ? (
                                                            <button
                                                                type="button"
                                                                disabled={!sessionId || getQuoteLeadId === row.id}
                                                                onClick={() => void runGetQuoteForDashboardLead(row)}
                                                                className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {getQuoteLeadId === row.id ? "Working…" : "Get quote"}
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setViewLead(row)}
                                                                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                                                                >
                                                                    View
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRouter(row)}
                                                                    className="text-sm font-semibold text-blue-600 hover:underline"
                                                                >
                                                                    View Project
                                                                </button>
                                                                {canImportLeads && (
                                                                    <>
                                                                        <select
                                                                            value={singleAssignByLead[row.id] ?? row.assigned_designer_id ?? ""}
                                                                            onChange={(e) =>
                                                                                setSingleAssignByLead((prev) => ({
                                                                                    ...prev,
                                                                                    [row.id]: e.target.value ? Number(e.target.value) : "",
                                                                                }))
                                                                            }
                                                                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                                                                        >
                                                                            <option value="">Assign designer</option>
                                                                            {assignableDesigners.map((d) => (
                                                                                <option key={d.id} value={d.id}>
                                                                                    {d.name}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => assignSingleLead(row.id)}
                                                                            disabled={singleAssignLoadingLeadId === row.id}
                                                                            className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
                                                                        >
                                                                            {singleAssignLoadingLeadId === row.id ? "..." : "Assign"}
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                    {totalItems === 0 && (
                        <div className="py-12 text-center text-gray-500 text-sm">No projects match the current filter or search.</div>
                    )}
                    {totalItems > 0 && (
                        <div className="flex flex-col gap-3 px-4 py-3 border-t border-gray-200 bg-white text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                            <span className="text-gray-600 shrink-0">
                                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems}{" "}
                                projects
                            </span>
                            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        aria-label="Previous page"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage <= 1}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                            <path
                                                fillRule="evenodd"
                                                d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                    {getPaginationRange(currentPage, totalPages).map((item, idx) =>
                                        item === "ellipsis" ? (
                                            <span key={`ellipsis-${idx}`} className="px-1.5 text-gray-400 select-none">
                                                …
                                            </span>
                                        ) : (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => setPage(item)}
                                                className={`min-h-9 min-w-9 rounded-lg px-2 text-sm font-medium transition-colors ${
                                                    item === currentPage
                                                        ? "border-2 border-violet-500 bg-violet-50 text-violet-800 shadow-sm"
                                                        : "border border-transparent text-gray-600 hover:bg-gray-100"
                                                }`}
                                            >
                                                {item}
                                            </button>
                                        ),
                                    )}
                                    <button
                                        type="button"
                                        aria-label="Next page"
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage >= totalPages}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                            <path
                                                fillRule="evenodd"
                                                d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                </div>
                                <label className="inline-flex items-center gap-2 text-gray-700">
                                    <span className="sr-only">Leads per page</span>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => setPageSize(Number(e.target.value))}
                                        className="cursor-pointer rounded-lg border-2 border-violet-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                    >
                                        {PAGE_SIZE_OPTIONS.map((n) => (
                                            <option key={n} value={n}>
                                                {n} / page
                                            </option>
                                        ))}
                                    </select>
                                </label>
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
                    <button
                        type="button"
                        id="workspace-sidebar-trigger"
                        aria-expanded={isDropdownOpen}
                        aria-controls="workspace-sidebar-panel"
                        className="flex w-full items-center justify-between gap-2 mb-1 rounded-lg py-3 pl-2 pr-2 text-left cursor-pointer hover:bg-gray-100 transition-colors xl:mb-2 xl:py-4 xl:pr-2"
                        onClick={toggleDropdown}
                    >
                        <span className="text-base font-semibold text-gray-900 xl:text-lg xl:pl-2 xl:pt-0">My WorkSpace</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className={`size-5 shrink-0 text-gray-700 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                            aria-hidden
                        >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </button>
                    {isDropdownOpen && (
                        <div id="workspace-sidebar-panel" className="transition-all duration-200 space-y-1">
                            <button
                                type="button"
                                aria-expanded={designPhasesOpen}
                                aria-controls="workspace-design-phases"
                                className="flex w-full items-center justify-between gap-2 rounded-lg py-2 pl-2 pr-2 text-left cursor-pointer hover:bg-gray-100 transition-colors xl:pl-2"
                                onClick={() => setDesignPhasesOpen((o) => !o)}
                            >
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Design Phases</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className={`size-4 shrink-0 text-gray-600 transition-transform duration-200 ${designPhasesOpen ? 'rotate-180' : ''}`}
                                    aria-hidden
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                            </button>
                            {designPhasesOpen && (
                                <div id="workspace-design-phases" role="region" aria-label="Design phases">
                                    {allTypes.map((type, index) => (
                                        <div
                                            key={index}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => handleSelection(type)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    handleSelection(type);
                                                }
                                            }}
                                            className={`p-3 cursor-pointer font-semibold text-left w-full transition-all duration-200 xl:p-4 xl:inline-block xl:w-66.25 ${
                                                isSelected === type
                                                    ? 'border-l-4 border-l-green-400 bg-gray-100 text-green-600 font-bold xl:border-gray-300 xl:text-green-400'
                                                    : 'border-l-4 border-l-transparent hover:border-l-green-400 hover:bg-gray-100 hover:text-green-600 xl:hover:scale-105'
                                            }`}
                                        >
                                            {type}
                    </div>
                                    ))}
                    </div>
                            )}
                            <button
                                type="button"
                                aria-expanded={projectStatusOpen}
                                aria-controls="workspace-project-status"
                                className="flex w-full items-center justify-between gap-2 rounded-lg py-2 pl-2 pr-2 text-left cursor-pointer hover:bg-gray-100 transition-colors mt-2 xl:pl-2"
                                onClick={() => setProjectStatusOpen((o) => !o)}
                            >
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Project status</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className={`size-4 shrink-0 text-gray-600 transition-transform duration-200 ${projectStatusOpen ? 'rotate-180' : ''}`}
                                    aria-hidden
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                            </button>
                            {projectStatusOpen && (
                                <div id="workspace-project-status" role="region" aria-label="Project status">
                                    {allStatusTypes.map((status, index) => (
                                        <div
                                            key={`status-${index}`}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => handleStatusSelection(status)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    handleStatusSelection(status);
                                                }
                                            }}
                                            className={`p-3 cursor-pointer font-semibold text-left w-full transition-all duration-200 xl:p-4 xl:inline-block xl:w-66.25 ${
                                                statusSelected === status
                                                    ? 'border-l-4 border-l-green-400 bg-gray-100 text-green-600 font-bold xl:text-green-400'
                                                    : 'border-l-4 border-l-transparent hover:border-l-green-400 hover:bg-gray-100 hover:text-green-600 xl:hover:scale-105'
                                            }`}
                                        >
                                            {status}
                                        </div>
                                    ))}
                                </div>
                            )}
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
                                        {showBranchDesignerFilters && (
                                            <>
                                                <select
                                                    value={branchFilter}
                                                    onChange={(e) => setBranchFilter(e.target.value)}
                                                    aria-label="Filter by branch"
                                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 min-w-[7rem] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                >
                                                    <option value="">All branches</option>
                                                    {BRANCH_OPTIONS.map((b) => (
                                                        <option key={b} value={b}>
                                                            {b}
                        </option>
                    ))}   
                                                </select>
                                                <select
                                                    value={designerFilter}
                                                    onChange={(e) => setDesignerFilter(e.target.value)}
                                                    aria-label="Filter by designer"
                                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 min-w-[10rem] max-w-[14rem] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                >
                                                    <option value="">All designers</option>
                                                    {hasUnassignedInQueue && (
                                                        <option value="__unassigned__">Unassigned</option>
                                                    )}
                                                    {designerFilterOptions.map(([id, name]) => (
                                                        <option key={id} value={String(id)}>
                                                            {name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </>
                                        )}
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
                                        <button
                                            type="button"
                                            disabled={!sessionId}
                                            onClick={handleAddProjectClick}
                                            title="Fill a form to create a Prolance project and add it to Pre 10%"
                                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            + Add Project
                                        </button>
                                        {canImportLeads && (
                                            <button
                                                type="button"
                                                onClick={() => setShowImportPanel((v) => !v)}
                                                className="px-4 py-2 rounded-lg border border-indigo-300 text-indigo-700 text-sm font-medium hover:bg-indigo-50"
                                            >
                                                {showImportPanel ? "Close Import" : "Import Excel"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {canImportLeads && showImportPanel && (
                                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
                                        <p className="text-sm font-semibold text-indigo-900">Import Leads from Excel</p>
                                        <p className="mt-1 text-xs text-indigo-700">
                                            Upload Excel, map headers to lead fields, then import.
                                        </p>
                                        <div className="mt-3 flex flex-wrap items-center gap-3">
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls,.csv"
                                                onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
                                                className="text-sm"
                                            />
                                            <select
                                                value={importDesignerId}
                                                onChange={(e) => setImportDesignerId(e.target.value ? Number(e.target.value) : "")}
                                                className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs text-indigo-900"
                                            >
                                                <option value="">Select designer from DB</option>
                                                {assignableDesigners.map((d) => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.name} ({d.role.replace("_", " ")})
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={runExcelPreview}
                                                disabled={previewLoading || !excelFile}
                                                className="rounded-md border border-indigo-500 px-3 py-1.5 text-xs font-semibold text-indigo-700 disabled:opacity-50"
                                            >
                                                {previewLoading ? "Loading Preview..." : "Preview Headers"}
                                            </button>
                                        </div>
                                        {previewToken && (
                                            <div className="mt-4">
                                                <p className="mb-2 text-xs text-gray-600">Rows found: {excelRowCount}</p>
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                    {targetFields.map((f) => (
                                                        <label key={f.key} className="block">
                                                            <span className="mb-1 block text-xs font-medium text-gray-700">
                                                                {f.label} {f.required ? <span className="text-red-500">*</span> : null}
                                                            </span>
                                                            <select
                                                                value={mappings[f.key] || ""}
                                                                onChange={(e) =>
                                                                    setMappings((prev) => ({ ...prev, [f.key]: e.target.value }))
                                                                }
                                                                className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 outline-none focus:border-indigo-500"
                                                            >
                                                                <option value="">-- Not mapped --</option>
                                                                {excelHeaders.map((h) => (
                                                                    <option key={h} value={h}>
                                                                        {h}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={runExcelImport}
                                                    disabled={importLoading}
                                                    className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                                >
                                                    {importLoading ? "Importing..." : "Import Leads"}
                                                </button>
                                            </div>
                                        )}
                                        {importMessage && (
                                            <p className="mt-3 text-xs text-gray-700">{importMessage}</p>
                                        )}
                    </div>
                                )}
                                {canImportLeads && (
                                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 space-y-3">
                                        <p className="text-sm font-semibold text-emerald-900">Lead Reassignment</p>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <select
                                                value={bulkDesignerId}
                                                onChange={(e) => setBulkDesignerId(e.target.value ? Number(e.target.value) : "")}
                                                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm min-w-[240px]"
                                            >
                                                <option value="">Select designer for bulk assign</option>
                                                {assignableDesigners.map((d) => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.name} ({d.role.replace("_", " ")})
                        </option>
                    ))}   
                                            </select>
                                            <button
                                                type="button"
                                                onClick={assignBulkLeads}
                                                disabled={bulkAssignLoading}
                                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                                            >
                                                {bulkAssignLoading ? "Assigning..." : `Bulk Assign (${selectedLeadIds.length})`}
                                            </button>
                                        </div>
                                        {bulkAssignMessage && (
                                            <p className="text-xs text-emerald-800">{bulkAssignMessage}</p>
                                        )}
                                    </div>
                                )}
                                {bulkAssignMessage && !canImportLeads && (
                                    <p
                                        className={`rounded-lg border px-4 py-2 text-sm ${
                                            bulkAssignMessage.toLowerCase().includes("fail") ||
                                            bulkAssignMessage.toLowerCase().includes("error")
                                                ? "border-red-200 bg-red-50 text-red-800"
                                                : "border-teal-200 bg-teal-50 text-teal-900"
                                        }`}
                                        role="status"
                                    >
                                        {bulkAssignMessage}
                                    </p>
                                )}
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
                        {showFinancePopup && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 relative">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Finance Approval Pending</h3>
                                    <p className="text-gray-600 mb-6">
                                        The finance team has not approved the payment for this lead yet. You cannot open it until it is approved.
                                    </p>
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => setShowFinancePopup(false)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                        >
                                            Okay
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            {viewLead ? (
                <Pre10LeadViewModal
                    lead={viewLead}
                    timeSlotLabel={formatLeadTimeSlot(viewLead)}
                    onClose={() => setViewLead(null)}
                />
            ) : null}
            {showAddProjectModal && sessionId ? (
                <AddProjectModal
                    open={showAddProjectModal}
                    appApiBase={API}
                    sessionId={sessionId}
                    onClose={() => setShowAddProjectModal(false)}
                    onSuccess={handleAddProjectFormSuccess}
                />
            ) : null}
        </div>
    );
    }
