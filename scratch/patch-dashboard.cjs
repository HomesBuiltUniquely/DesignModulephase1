const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('my-app/app/Components/Dashboard.tsx');
let content = fs.readFileSync(targetPath, 'utf8');
const isCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. Add import: getProjectBranch, toBranchCode
if (!content.includes('getProjectBranch')) {
  content = content.replace(
    'import { getPhaseBucket } from "@/app/lib/leadPhaseBucket";',
    'import { getPhaseBucket } from "@/app/lib/leadPhaseBucket";\nimport { getProjectBranch, toBranchCode } from "@/app/lib/leadBranch";'
  );
}

// 2. Update type AssignableDesigner
content = content.replace(
  `type AssignableDesigner = {
    id: number;
    name: string;
    role: "designer" | "design_manager";
};`,
  `type AssignableDesigner = {
    id: number;
    name: string;
    role: "designer" | "design_manager";
    branch?: string | null;
};`
);

// 3. Update showBranchDesignerFilters -> showBranchFilter, showDesignerFilter, showBranchDesignerFilters
const oldFiltersDef = `    // Branch/designer filters are shown for TDM/DM/admin/etc (not designer/DQC/MMT/finance/SPM).
    const showBranchDesignerFilters =
        !isDesigner && !isDqcUser && !isMmtUser && !isFinanceUser && !isSpmUser && !isOpsUser;`;

const newFiltersDef = `    // Branch dropdown is hidden for Design Managers (since they only manage their own branch/team).
    const showBranchFilter =
        !isDesigner &&
        !isDesignManager &&
        !isDqcUser &&
        !isMmtUser &&
        !isFinanceUser &&
        !isSpmUser &&
        !isOpsUser;
    const showDesignerFilter =
        !isDesigner &&
        !isDqcUser &&
        !isMmtUser &&
        !isFinanceUser &&
        !isSpmUser &&
        !isOpsUser;
    const showBranchDesignerFilters = showBranchFilter || showDesignerFilter;`;

content = content.replace(oldFiltersDef, newFiltersDef);

// 4. Update loadAssignable and loadDesignersFallback
const oldLoadAssignable = `        const loadAssignable = () =>
            fetch(\`\${API}/api/designers/assignable\`, { headers })
                .then(async (res) => {
                    if (!res.ok) return null;
                    const rows = await res.json();
                    return Array.isArray(rows) ? (rows as AssignableDesigner[]) : null;
                })
                .catch(() => null);`;

const newLoadAssignable = `        const loadAssignable = () =>
            fetch(\`\${API}/api/designers/assignable\`, { headers })
                .then(async (res) => {
                    if (!res.ok) return null;
                    const rows = await res.json();
                    if (!Array.isArray(rows)) return null;
                    return rows.map((d: any) => ({
                        id: d.id,
                        name: String(d.name || "").trim(),
                        role: (d.role === "design_manager" ? "design_manager" : "designer") as AssignableDesigner["role"],
                        branch: d.branch ? toBranchCode(d.branch) : null,
                    }));
                })
                .catch(() => null);`;

content = content.replace(oldLoadAssignable, newLoadAssignable);

const oldLoadFallback = `                    return list
                        .filter((d: { id?: number; name?: string; role?: string }) => d?.id != null && d?.name)
                        .map((d: { id: number; name: string; role?: string }) => ({
                            id: d.id,
                            name: String(d.name).trim(),
                            role: (d.role === "design_manager" ? "design_manager" : "designer") as AssignableDesigner["role"],
                        }));`;

const newLoadFallback = `                    return list
                        .filter((d: { id?: number; name?: string; role?: string; branch?: string }) => d?.id != null && d?.name)
                        .map((d: { id: number; name: string; role?: string; branch?: string }) => ({
                            id: d.id,
                            name: String(d.name).trim(),
                            role: (d.role === "design_manager" ? "design_manager" : "designer") as AssignableDesigner["role"],
                            branch: d.branch ? toBranchCode(d.branch) : null,
                        }));`;

content = content.replace(oldLoadFallback, newLoadFallback);

// 5. Update designerFilterOptions, cascading, and queueFilterFiltered
const oldDesignerFilterBlock = `    // Source of truth: users from DB (/api/designers/assignable or /api/designers).
    // Do NOT scrape names from lead payloads — that caused duplicates, phantom CRM names,
    // and missing designers who have no leads in the current queue.
    const designerFilterOptions = useMemo(() => {
        const byId = new Map<number, string>();
        for (const d of assignableDesigners) {
            const name = (d.name || "").trim();
            if (d.id == null || !name) continue;
            if (!byId.has(d.id)) byId.set(d.id, name);
        }

        const options: Array<[string, string]> = [];
        const seenNames = new Set<string>();
        const sorted = [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" }));
        for (const [id, name] of sorted) {
            const key = name.toLowerCase();
            // Same display name under two user ids → show once (filter still matches by name too).
            if (seenNames.has(key)) continue;
            seenNames.add(key);
            options.push([String(id), name]);
        }
        return options;
    }, [assignableDesigners]);

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
            const id = Number(designerFilter);
            const selectedName = Number.isNaN(id)
                ? ""
                : (assignableDesigners.find((d) => d.id === id)?.name || "").trim().toLowerCase();
            if (!Number.isNaN(id)) {
                queueFilterFiltered = queueFilterFiltered.filter((p) => {
                    if (p.assigned_designer_id === id) return true;
                    // Match by display name too (payload-only leads, or another user id with same name)
                    return (
                        !!selectedName &&
                        (p.designerName || "").trim().toLowerCase() === selectedName
                    );
                });
            }
        }
    }`;

const newDesignerFilterBlock = `    const designerBranchMap = useMemo(() => {
        const m = new Map<number, string | null>();
        for (const d of assignableDesigners) {
            if (d.id != null) {
                m.set(d.id, d.branch ? toBranchCode(d.branch) : null);
            }
        }
        return m;
    }, [assignableDesigners]);

    // Cascading: when a branch filter is selected, only show designers of that branch
    const branchFilteredDesigners = useMemo(() => {
        if (!branchFilter) return assignableDesigners;
        const b = branchFilter.trim().toUpperCase();
        return assignableDesigners.filter((d) => toBranchCode(d.branch) === b);
    }, [assignableDesigners, branchFilter]);

    // Source of truth: users from DB (/api/designers/assignable or /api/designers).
    // Do NOT scrape names from lead payloads — that caused duplicates, phantom CRM names,
    // and missing designers who have no leads in the current queue.
    const designerFilterOptions = useMemo(() => {
        const byId = new Map<number, string>();
        for (const d of branchFilteredDesigners) {
            const name = (d.name || "").trim();
            if (d.id == null || !name) continue;
            if (!byId.has(d.id)) byId.set(d.id, name);
        }

        const options: Array<[string, string]> = [];
        const seenNames = new Set<string>();
        const sorted = [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" }));
        for (const [id, name] of sorted) {
            const key = name.toLowerCase();
            // Same display name under two user ids → show once (filter still matches by name too).
            if (seenNames.has(key)) continue;
            seenNames.add(key);
            options.push([String(id), name]);
        }
        return options;
    }, [branchFilteredDesigners]);

    const hasUnassignedInQueue = useMemo(
        () =>
            projects.some((p) => {
                if (p.assigned_designer_id != null) return false;
                if (!branchFilter) return true;
                return getProjectBranch(p, designerBranchMap) === branchFilter.trim().toUpperCase();
            }),
        [projects, branchFilter, designerBranchMap],
    );

    // If branch changes and currently selected designer is no longer in this branch, reset designer filter
    useEffect(() => {
        if (!designerFilter) return;
        if (designerFilter === "__unassigned__") {
            if (!hasUnassignedInQueue) {
                setDesignerFilter("");
            }
            return;
        }
        const id = Number(designerFilter);
        const existsInBranch = branchFilteredDesigners.some((d) => d.id === id);
        if (!existsInBranch) {
            setDesignerFilter("");
        }
    }, [branchFilter, branchFilteredDesigners, designerFilter, hasUnassignedInQueue, setDesignerFilter]);

    let queueFilterFiltered = searchFiltered;
    if (showBranchDesignerFilters) {
        if (showBranchFilter && branchFilter) {
            const b = branchFilter.trim().toUpperCase();
            queueFilterFiltered = queueFilterFiltered.filter(
                (p) => getProjectBranch(p, designerBranchMap) === b,
            );
        }
        if (showDesignerFilter) {
            if (designerFilter === "__unassigned__") {
                queueFilterFiltered = queueFilterFiltered.filter((p) => p.assigned_designer_id == null);
            } else if (designerFilter) {
                const id = Number(designerFilter);
                const selectedName = Number.isNaN(id)
                    ? ""
                    : (assignableDesigners.find((d) => d.id === id)?.name || "").trim().toLowerCase();
                if (!Number.isNaN(id)) {
                    queueFilterFiltered = queueFilterFiltered.filter((p) => {
                        if (p.assigned_designer_id === id) return true;
                        // Match by display name too (payload-only leads, or another user id with same name)
                        return (
                            !!selectedName &&
                            (p.designerName || "").trim().toLowerCase() === selectedName
                        );
                    });
                }
            }
        }
    }`;

content = content.replace(oldDesignerFilterBlock, newDesignerFilterBlock);

// 6. Clear row selection on filter and page changes
const oldQueueKeyEffect = `    const prevQueueFilterKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (prevQueueFilterKeyRef.current === null) {
            prevQueueFilterKeyRef.current = queueFilterKey;
            return;
        }
        if (prevQueueFilterKeyRef.current === queueFilterKey) return;
        prevQueueFilterKeyRef.current = queueFilterKey;
        setPage(1);
    }, [queueFilterKey, setPage]);`;

const newQueueKeyEffect = `    const prevQueueFilterKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (prevQueueFilterKeyRef.current === null) {
            prevQueueFilterKeyRef.current = queueFilterKey;
            return;
        }
        if (prevQueueFilterKeyRef.current === queueFilterKey) return;
        prevQueueFilterKeyRef.current = queueFilterKey;
        setPage(1);
        setSelectedLeadIds([]);
    }, [queueFilterKey, setPage]);

    useEffect(() => {
        setSelectedLeadIds([]);
    }, [page]);`;

content = content.replace(oldQueueKeyEffect, newQueueKeyEffect);

// 7. Update assignSingleLead to update designerBranch and projectBranch immediately
const oldAssignSingle = `            setProjects((prev) =>
                prev.map((p) =>
                    p.id === leadId
                        ? {
                            ...p,
                            assigned_designer_id: Number(designerId),
                            designerName: data?.designerName ?? p.designerName,
                        }
                        : p,
                ),
            );`;

const newAssignSingle = `            const chosenDesigner = assignableDesigners.find((d) => d.id === Number(designerId));
            const newBranch = chosenDesigner?.branch ? toBranchCode(chosenDesigner.branch) : null;
            setProjects((prev) =>
                prev.map((p) =>
                    p.id === leadId
                        ? {
                            ...p,
                            assigned_designer_id: Number(designerId),
                            designerName: data?.designerName ?? chosenDesigner?.name ?? p.designerName,
                            designerBranch: newBranch,
                            projectBranch: newBranch ?? p.fallbackBranch ?? p.experienceCenter ?? null,
                            branch: newBranch ?? p.fallbackBranch ?? p.experienceCenter ?? null,
                        }
                        : p,
                ),
            );`;

content = content.replace(oldAssignSingle, newAssignSingle);

// 8. Update JSX for showBranchFilter and showDesignerFilter
const oldJsxFilter = `                                            {showBranchDesignerFilters && (
                                                <>
                                                    <CustomSelect
                                                        value={branchFilter}
                                                        onChange={(v) => setBranchFilter(v)}
                                                        placeholder="All branches"
                                                        minWidth="9rem"
                                                        buttonClassName={\`rounded-xl px-3 py-2 text-sm \${
                                                            branchFilter
                                                                ? "border border-[#EF0101]/45 bg-[#EF0101]/10 font-semibold"
                                                                : "border border-gray-300 bg-white"
                                                        }\`}
                                                        options={[
                                                            { value: "", label: "All branches" },
                                                            ...BRANCH_OPTIONS.map((b) => ({ value: b, label: b })),
                                                        ]}
                                                    />
                                                    <CustomSelect
                                                        value={designerFilter}
                                                        onChange={(v) => setDesignerFilter(v)}
                                                        placeholder="All designers"
                                                        minWidth="11rem"
                                                        buttonClassName={\`rounded-xl px-3 py-2 text-sm \${
                                                            designerFilter
                                                                ? "border border-[#EF0101]/45 bg-[#EF0101]/10 font-semibold"
                                                                : "border border-gray-300 bg-white"
                                                        }\`}
                                                        options={[
                                                            { value: "", label: "All designers" },
                                                            ...(hasUnassignedInQueue ? [{ value: "__unassigned__", label: "Unassigned" }] : []),
                                                            ...designerFilterOptions.map(([id, name]) => ({ value: String(id), label: name as string })),
                                                        ]}
                                                    />
                                                </>
                                            )}`;

const newJsxFilter = `                                            {showBranchFilter && (
                                                <CustomSelect
                                                    value={branchFilter}
                                                    onChange={(v) => setBranchFilter(v)}
                                                    placeholder="All branches"
                                                    minWidth="9rem"
                                                    buttonClassName={\`rounded-xl px-3 py-2 text-sm \${
                                                        branchFilter
                                                            ? "border border-[#EF0101]/45 bg-[#EF0101]/10 font-semibold"
                                                            : "border border-gray-300 bg-white"
                                                    }\`}
                                                    options={[
                                                        { value: "", label: "All branches" },
                                                        ...BRANCH_OPTIONS.map((b) => ({ value: b, label: b })),
                                                    ]}
                                                />
                                            )}
                                            {showDesignerFilter && (
                                                <CustomSelect
                                                    value={designerFilter}
                                                    onChange={(v) => setDesignerFilter(v)}
                                                    placeholder="All designers"
                                                    minWidth="11rem"
                                                    buttonClassName={\`rounded-xl px-3 py-2 text-sm \${
                                                        designerFilter
                                                            ? "border border-[#EF0101]/45 bg-[#EF0101]/10 font-semibold"
                                                            : "border border-gray-300 bg-white"
                                                    }\`}
                                                    options={[
                                                        { value: "", label: "All designers" },
                                                        ...(hasUnassignedInQueue ? [{ value: "__unassigned__", label: "Unassigned" }] : []),
                                                        ...designerFilterOptions.map(([id, name]) => ({ value: String(id), label: name as string })),
                                                    ]}
                                                />
                                            )}`;

content = content.replace(oldJsxFilter, newJsxFilter);

if (isCrlf) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully patched Dashboard.tsx');
