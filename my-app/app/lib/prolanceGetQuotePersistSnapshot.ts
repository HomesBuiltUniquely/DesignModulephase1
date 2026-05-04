/**
 * Shared “after Get quote API” steps used by the lead workspace (10–20%) and Pre 10% dashboard.
 */

/** Cross-tab handoff for `/quote/preview` (Dashboard opens a new tab — sessionStorage is per-tab and would be empty there). */
export const POST_GET_QUOTE_PREVIEW_STORAGE_KEY = "hub:postGetQuotePreview:v1";

export type PostGetQuotePreviewPayload = {
    leadId: number;
    quoteBody: unknown;
    effectiveStatus: number;
    resolvedPid: number;
    partnerIdFromLogin: number | null;
};

export function storePostGetQuotePreview(payload: PostGetQuotePreviewPayload): boolean {
    try {
        // JSON.stringify drops `undefined` keys — quoteBody would vanish and preview would always fail.
        const toStore = {
            leadId: payload.leadId,
            quoteBody: payload.quoteBody === undefined ? null : payload.quoteBody,
            effectiveStatus: payload.effectiveStatus,
            resolvedPid: payload.resolvedPid,
            partnerIdFromLogin: payload.partnerIdFromLogin,
        };
        localStorage.setItem(POST_GET_QUOTE_PREVIEW_STORAGE_KEY, JSON.stringify(toStore));
        return true;
    } catch {
        return false;
    }
}

export function clearPostGetQuotePreview(): void {
    try {
        localStorage.removeItem(POST_GET_QUOTE_PREVIEW_STORAGE_KEY);
        sessionStorage.removeItem(POST_GET_QUOTE_PREVIEW_STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

/** Read handoff payload (prefers localStorage for cross-tab; falls back to legacy sessionStorage). */
export function readPostGetQuotePreviewRaw(): string | null {
    try {
        return (
            localStorage.getItem(POST_GET_QUOTE_PREVIEW_STORAGE_KEY) ??
            sessionStorage.getItem(POST_GET_QUOTE_PREVIEW_STORAGE_KEY)
        );
    } catch {
        return null;
    }
}

export async function persistProlanceQuoteIdsAndSnapshot(options: {
    appApiBase: string;
    sessionId: string;
    leadId: number;
    prolanceQuoteId: number;
    quoteBody: unknown;
}): Promise<boolean> {
    const API = options.appApiBase.replace(/\/$/, "");
    const res = await fetch(`${API}/api/leads/${options.leadId}/prolance-ids`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.sessionId}`,
        },
        body: JSON.stringify({ prolanceQuoteId: options.prolanceQuoteId }),
    });
    if (!res.ok) return false;
    if (options.quoteBody && typeof options.quoteBody === "object") {
        try {
            await fetch(`${API}/api/leads/${options.leadId}/prolance-quote-snapshots`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${options.sessionId}`,
                },
                body: JSON.stringify({ quoteId: options.prolanceQuoteId, payload: options.quoteBody }),
            });
        } catch {
            /* snapshot is best-effort; quote page can fall back to live Prolance */
        }
    }
    return true;
}

export function openInternalQuoteInNewTab(quoteId: number, leadId: number): void {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    const leadQs = `&leadId=${encodeURIComponent(String(leadId))}`;
    window.open(
        `${origin}/quote/${encodeURIComponent(String(quoteId))}?internal=1${leadQs}`,
        "_blank",
        "noopener,noreferrer",
    );
}
