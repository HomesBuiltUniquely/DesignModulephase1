/**
 * Prolance Origin (browser) URLs — optional open when a project ID already exists.
 * Project **creation** uses the Hub API → https://api.prolance.design (see `prolanceApiCreateProject.ts`).
 * Set NEXT_PUBLIC_PROLANCE_ORIGIN if the Origin SPA host differs (no trailing slash).
 */

export function prolanceOriginBase(): string {
    const raw =
        typeof process !== "undefined" && process.env.NEXT_PUBLIC_PROLANCE_ORIGIN
            ? String(process.env.NEXT_PUBLIC_PROLANCE_ORIGIN).trim()
            : "";
    return raw.replace(/\/$/, "") || "https://www.prolance.design";
}

export function prolanceProjectOverviewUrl(projectId: number): string {
    return `${prolanceOriginBase()}/projects/${projectId}`;
}

export function prolanceProjectQuotationUrl(projectId: number): string {
    return `${prolanceOriginBase()}/projects/${projectId}/quotation`;
}

/** Open Prolance Origin project overview in a new tab (only when a valid project ID exists). */
export function openProlanceBrowserForProjectId(prolanceProjectId: number | null | undefined): void {
    const pid = prolanceProjectId != null ? Number(prolanceProjectId) : NaN;
    if (!Number.isFinite(pid) || pid < 1) return;
    window.open(prolanceProjectOverviewUrl(pid), "_blank", "noopener,noreferrer");
}
