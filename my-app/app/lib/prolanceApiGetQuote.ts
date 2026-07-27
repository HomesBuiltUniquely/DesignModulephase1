/**
 * Prolance “Get quote” API sequence (token → partner login → quote → full-details merge).
 * Proxied through the Hub API to https://api.prolance.design (see backend `prolanceApi.ts`).
 */

import { mergeQuoteLineItemArrays } from '@/app/quote/quoteLineItems';

export type RunProlanceGetQuoteResult =
    | {
          ok: true;
          effectiveStatus: number;
          quoteBody: unknown;
          redirectQuoteId: number | null;
          quoteProjectId: number;
          /** Partner ID from Prolance login response (optional UI state on lead page). */
          partnerIdFromLogin: number | null;
      }
    | { ok: false; message: string };

function extractNumber(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
    return null;
}

const QUOTE_ID_KEYS = [
    "quoteID",
    "quoteId",
    "quotationId",
    "quotationID",
    "QuotationID",
    "QuoteID",
    "QuoteId",
    "interiorQuoteID",
    "interiorQuoteId",
    "InteriorQuoteID",
] as const;

function readPositiveInt(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v) && v >= 1) return Math.floor(v);
    if (typeof v === "string" && v.trim()) {
        const n = Number(v.trim());
        if (Number.isFinite(n) && n >= 1) return Math.floor(n);
    }
    return null;
}

function pickQuoteIdFromRecord(obj: Record<string, unknown>): number | null {
    for (const k of QUOTE_ID_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        const n = readPositiveInt(obj[k]);
        if (n != null) return n;
    }
    return null;
}

/** Prolance `/Origin/Quotes/:projectId` often returns multiple rows (draft + published). Prefer latest non-draft (same intent as Prolance UI). */
function isLikelyDraftQuoteRow(row: Record<string, unknown>): boolean {
    if (row.isDraft === true) return true;
    const st =
        row.quoteStatus ??
        row.status ??
        row.quotationStatus ??
        row.stage ??
        row.quoteStage ??
        row.quoteState;
    if (typeof st === "string" && /\bdraft\b/i.test(st)) return true;
    return false;
}

function parseTrailingNumericSuffix(quoteNum: unknown): number {
    const s = String(quoteNum ?? "").trim();
    if (!s) return 0;
    const m = s.match(/(\d{1,9})\s*$/);
    return m ? Number(m[1]) : 0;
}

function rowCreatedMs(row: Record<string, unknown>): number {
    const d =
        row.createdOn ??
        row.createdAt ??
        row.createdDate ??
        row.createDate ??
        row.modifiedAt ??
        row.updatedAt;
    if (d == null) return 0;
    const t = new Date(String(d)).getTime();
    return Number.isFinite(t) ? t : 0;
}

function scoreQuoteRowForLatestPreference(row: Record<string, unknown>): number {
    let score = 0;
    if (!isLikelyDraftQuoteRow(row)) score += 1_000_000_000;
    const idPart = readPositiveInt(
        row.quoteID ?? row.quoteId ?? row.quotationId ?? row.quotationID,
    );
    if (idPart != null) score += idPart * 1_000;
    score += parseTrailingNumericSuffix(row.quoteNum ?? row.quoteNo ?? row.quotationNum) * 10;
    score += Math.floor(rowCreatedMs(row) / 86_400_000);
    return score;
}

function pickPreferredQuoteObjectFromList(items: unknown[]): Record<string, unknown> | null {
    const objects = items
        .map((item, i) =>
            item && typeof item === "object" && !Array.isArray(item)
                ? { row: item as Record<string, unknown>, i }
                : null,
        )
        .filter(Boolean) as { row: Record<string, unknown>; i: number }[];
    if (objects.length === 0) return null;
    if (objects.length === 1) return objects[0].row;
    const sorted = [...objects].sort((a, b) => {
        const sb = scoreQuoteRowForLatestPreference(b.row);
        const sa = scoreQuoteRowForLatestPreference(a.row);
        if (sb !== sa) return sb - sa;
        return a.i - b.i;
    });
    return sorted[0].row;
}

function reorderQuoteRowsPreferredFirst(arr: unknown[]): unknown[] {
    const indexed = arr.map((item, i) => ({ item, i }));
    const objects = indexed.filter(
        (x) => x.item && typeof x.item === "object" && !Array.isArray(x.item),
    );
    if (objects.length < 2) return arr;
    const ranked = [...objects].sort((a, b) => {
        const sb = scoreQuoteRowForLatestPreference(b.item as Record<string, unknown>);
        const sa = scoreQuoteRowForLatestPreference(a.item as Record<string, unknown>);
        if (sb !== sa) return sb - sa;
        return a.i - b.i;
    });
    const preferredItems = ranked.map((r) => r.item);
    const rest = indexed
        .filter((x) => !x.item || typeof x.item !== "object" || Array.isArray(x.item))
        .map((x) => x.item);
    return [...preferredItems, ...rest];
}

/** Shallow clone; reorders `data` / `Data` arrays so the preferred quotation is first (merges & UI use `[0]`). */
export function preferLatestProlanceQuotesEnvelope(envelope: unknown): unknown {
    if (!envelope || typeof envelope !== "object") return envelope;
    const root = envelope as Record<string, unknown>;
    let out: Record<string, unknown> | null = null;
    const apply = (key: "data" | "Data") => {
        const arr = (out ?? root)[key];
        if (!Array.isArray(arr) || arr.length < 2) return;
        const nextArr = reorderQuoteRowsPreferredFirst(arr);
        if (nextArr !== arr) {
            if (!out) out = { ...root };
            out[key] = nextArr;
        }
    };
    apply("data");
    apply("Data");
    return out ?? envelope;
}

function extractQuoteIdFromJsonString(s: string): number | null {
    if (!s || s.length > 2_000_000) return null;
    const patterns = [
        /"quoteID"\s*:\s*(\d+)/i,
        /"quoteId"\s*:\s*(\d+)/i,
        /"quotationId"\s*:\s*(\d+)/i,
        /"quotationID"\s*:\s*(\d+)/i,
        /"QuotationID"\s*:\s*(\d+)/i,
    ];
    for (const re of patterns) {
        const m = s.match(re);
        if (m?.[1]) {
            const n = Number(m[1]);
            if (Number.isFinite(n) && n >= 1) return n;
        }
    }
    return null;
}

/** Walk nested objects (max depth) looking only at known quote-id field names. */
function walkObjectsForQuoteId(v: unknown, depth: number): number | null {
    if (depth > 6 || v == null) return null;
    if (typeof v === "object" && !Array.isArray(v)) {
        const n = pickQuoteIdFromRecord(v as Record<string, unknown>);
        if (n != null) return n;
        for (const val of Object.values(v as Record<string, unknown>)) {
            const found = walkObjectsForQuoteId(val, depth + 1);
            if (found != null) return found;
        }
    }
    if (Array.isArray(v)) {
        for (const el of v) {
            const found = walkObjectsForQuoteId(el, depth + 1);
            if (found != null) return found;
        }
    }
    return null;
}

/**
 * Best-effort quote / quotation id from Prolance quote API payloads (shapes vary by tenant/version).
 */
export function extractQuoteIdFromBody(v: unknown): number | null {
    if (typeof v === "string") return extractQuoteIdFromJsonString(v);
    if (!v || typeof v !== "object") return null;
    const root = v as Record<string, unknown>;

    const tryMultiQuoteArray = (arr: unknown[]): number | null => {
        const objectRows = arr.filter((x) => x && typeof x === "object" && !Array.isArray(x));
        if (objectRows.length < 2) return null;
        const preferred = pickPreferredQuoteObjectFromList(arr);
        return preferred ? pickQuoteIdFromRecord(preferred) : null;
    };

    for (const lk of ["data", "Data"] as const) {
        const arr = root[lk];
        if (Array.isArray(arr)) {
            const fromMulti = tryMultiQuoteArray(arr);
            if (fromMulti != null) return fromMulti;
        }
    }

    let n = pickQuoteIdFromRecord(root);
    if (n != null) return n;

    const data = root.data ?? root.Data;
    if (Array.isArray(data)) {
        for (const item of data) {
            if (item && typeof item === "object") {
                n = pickQuoteIdFromRecord(item as Record<string, unknown>);
                if (n != null) return n;
            }
        }
    } else if (data && typeof data === "object") {
        n = pickQuoteIdFromRecord(data as Record<string, unknown>);
        if (n != null) return n;
        const inner = (data as Record<string, unknown>).data;
        if (Array.isArray(inner)) {
            const fromNestedMulti = tryMultiQuoteArray(inner);
            if (fromNestedMulti != null) return fromNestedMulti;
            for (const item of inner) {
                if (item && typeof item === "object") {
                    n = pickQuoteIdFromRecord(item as Record<string, unknown>);
                    if (n != null) return n;
                }
            }
        } else if (inner && typeof inner === "object") {
            n = pickQuoteIdFromRecord(inner as Record<string, unknown>);
            if (n != null) return n;
        }
    }

    n = walkObjectsForQuoteId(root, 0);
    if (n != null) return n;

    try {
        return extractQuoteIdFromJsonString(JSON.stringify(v));
    } catch {
        return null;
    }
}

/**
 * Turn stored Get-quote JSON into a single object the quote UI can read.
 * Handles JSON strings, `[{ ... }]`, and `data` / `Data` envelopes (Prolance varies by endpoint).
 */
export function coerceQuoteBodyForPreview(body: unknown): Record<string, unknown> | null {
    if (body == null) return null;
    let v: unknown = body;
    if (typeof v === "string") {
        const s = v.trim();
        if (!s) return null;
        try {
            v = JSON.parse(s);
        } catch {
            return null;
        }
    }
    if (Array.isArray(v)) {
        const flat = v.flatMap((x) => (Array.isArray(x) ? x : [x]));
        const objects = flat.filter((x) => x != null && typeof x === "object" && !Array.isArray(x)) as Record<
            string,
            unknown
        >[];
        const chosen =
            objects.length >= 2 ? pickPreferredQuoteObjectFromList(flat) : objects[0] ?? null;
        if (chosen == null) return null;
        v = chosen;
    }
    if (typeof v !== "object" || v === null) return null;
    const root = v as Record<string, unknown>;
    const inner = root.data ?? root.Data;
    if (inner != null && typeof inner === "object") {
        if (Array.isArray(inner)) {
            const flat = inner.flatMap((x) => (Array.isArray(x) ? x : [x]));
            const objects = flat.filter((x) => x != null && typeof x === "object" && !Array.isArray(x)) as Record<
                string,
                unknown
            >[];
            const row =
                objects.length >= 2 ? pickPreferredQuoteObjectFromList(flat) : objects[0] ?? null;
            if (row && typeof row === "object") return row as Record<string, unknown>;
            return root;
        }
        return inner as Record<string, unknown>;
    }
    return root;
}

function hasQuotePricingDetails(v: unknown): boolean {
    if (!v || typeof v !== "object") return false;
    const root = v as Record<string, unknown>;
    const first =
        Array.isArray(root.data) && root.data[0] && typeof root.data[0] === "object"
            ? (root.data[0] as Record<string, unknown>)
            : null;
    const obj = first || root;
    const options = obj.quoteOptionsData || root.quoteOptionsData;
    if (Array.isArray(options) && options.length > 0) return true;
    const hasTotals =
        extractNumber(obj.totalPayableAmount ?? root.totalPayableAmount ?? obj.finalTotalPrice ?? root.finalTotalPrice) !=
            null ||
        extractNumber(obj.interiorProjectAmount ?? root.interiorProjectAmount ?? obj.totalPrice ?? root.totalPrice) != null;
    return hasTotals;
}

export async function runProlanceGetQuoteApiFlow(params: {
    appApiBase: string;
    sessionId: string;
    quoteProjectId: number;
}): Promise<RunProlanceGetQuoteResult> {
    const API = params.appApiBase.replace(/\/$/, "");
    const quoteProjectId = params.quoteProjectId;
    if (!Number.isFinite(quoteProjectId) || quoteProjectId < 1) {
        return { ok: false, message: "Invalid Prolance project ID." };
    }

    const appHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.sessionId}`,
    };

    try {
        const ensurePartnerSession = async (forceRefresh: boolean) => {
            const partnerRes = await fetch(`${API}/api/prolance-test/partners/login`, {
                method: "POST",
                headers: appHeaders,
                body: JSON.stringify(forceRefresh ? { forceRefresh: true } : {}),
            });
            const partnerText = await partnerRes.text();
            let partnerBody: Record<string, unknown> | string | null = null;
            try {
                partnerBody = partnerText ? (JSON.parse(partnerText) as Record<string, unknown>) : null;
            } catch {
                partnerBody = partnerText;
            }
            const partnerData0 =
                partnerBody && typeof partnerBody === "object" && Array.isArray(partnerBody.data)
                    ? (partnerBody.data as unknown[])[0]
                    : null;
            const partnerIdRaw =
                partnerData0 && typeof partnerData0 === "object"
                    ? (partnerData0 as Record<string, unknown>).partnerID ??
                      (partnerData0 as Record<string, unknown>).partnerId
                    : partnerBody && typeof partnerBody === "object"
                      ? partnerBody.partnerID ?? partnerBody.partnerId
                      : null;
            const partnerIdFromLogin =
                partnerIdRaw != null && Number.isFinite(Number(partnerIdRaw)) ? Number(partnerIdRaw) : null;
            const originSessionID =
                (partnerData0 &&
                    typeof partnerData0 === "object" &&
                    ((partnerData0 as Record<string, unknown>).sessionID ||
                        (partnerData0 as Record<string, unknown>).sessionId)) ||
                (partnerBody && typeof partnerBody === "object"
                    ? partnerBody.sessionID || partnerBody.sessionId
                    : "") ||
                "";
            let prolanceToken =
                (partnerBody &&
                    typeof partnerBody === "object" &&
                    (partnerBody.access_token || partnerBody.accessToken || partnerBody.token)) ||
                "";

            // Legacy fallback if partner login response has no hub token.
            if (!String(prolanceToken).trim()) {
                const tokenRes = await fetch(`${API}/api/prolance-test/token`, {
                    method: "POST",
                    headers: appHeaders,
                    body: JSON.stringify(forceRefresh ? { forceRefresh: true } : {}),
                });
                const tokenText = await tokenRes.text();
                let tokenBody: Record<string, unknown> | string | null = null;
                try {
                    tokenBody = tokenText ? (JSON.parse(tokenText) as Record<string, unknown>) : null;
                } catch {
                    tokenBody = tokenText;
                }
                prolanceToken =
                    (tokenBody &&
                        typeof tokenBody === "object" &&
                        (tokenBody.access_token || tokenBody.accessToken || tokenBody.token)) ||
                    "";
                if (!tokenRes.ok || !String(prolanceToken).trim()) {
                    const msg =
                        (tokenBody && typeof tokenBody === "object" && (tokenBody.message || tokenBody.error)) ||
                        "Failed to generate Prolance token.";
                    return { ok: false as const, message: String(msg) };
                }
            }

            if (!partnerRes.ok || !String(originSessionID).trim()) {
                const msg =
                    (partnerBody && typeof partnerBody === "object" && (partnerBody.message || partnerBody.error)) ||
                    "Failed to login partner / fetch origin session.";
                return { ok: false as const, message: String(msg) };
            }

            return {
                ok: true as const,
                prolanceToken: String(prolanceToken).trim(),
                originSessionID: String(originSessionID).trim(),
                partnerIdFromLogin,
            };
        };

        let session = await ensurePartnerSession(false);
        if (!session.ok) return { ok: false, message: session.message };

        const fetchQuotes = async (prolanceToken: string, originSessionID: string) => {
            const quoteRes = await fetch(
                `${API}/api/prolance-test/quotes/${encodeURIComponent(String(quoteProjectId))}`,
                {
                    method: "GET",
                    headers: {
                        ...appHeaders,
                        "X-Prolance-Token": prolanceToken,
                        "X-Prolance-Origin-Session": originSessionID,
                    },
                },
            );
            const quoteText = await quoteRes.text();
            let quoteBody: unknown = null;
            try {
                quoteBody = quoteText ? JSON.parse(quoteText) : null;
            } catch {
                quoteBody = quoteText;
            }
            return { quoteRes, quoteBody };
        };

        let { quoteRes, quoteBody } = await fetchQuotes(session.prolanceToken, session.originSessionID);

        // Cached session expired upstream → force re-login once.
        if (quoteRes.status === 401 || quoteRes.status === 403) {
            session = await ensurePartnerSession(true);
            if (!session.ok) return { ok: false, message: session.message };
            ({ quoteRes, quoteBody } = await fetchQuotes(session.prolanceToken, session.originSessionID));
        }

        const prolanceToken = session.prolanceToken;
        const originSessionID = session.originSessionID;
        const partnerIdFromLogin = session.partnerIdFromLogin;

        if (quoteBody && typeof quoteBody === "object") {
            quoteBody = preferLatestProlanceQuotesEnvelope(quoteBody);
        }
        let effectiveStatus = quoteRes.status;
        const coercedForId = coerceQuoteBodyForPreview(quoteBody);
        const quoteIdFromGetQuote =
            extractQuoteIdFromBody(quoteBody) ??
            (coercedForId != null ? extractQuoteIdFromBody(coercedForId) : null);

        if (quoteIdFromGetQuote != null) {
            const fullRes = await fetch(
                `${API}/api/prolance-test/quotes/full-details/${encodeURIComponent(String(quoteIdFromGetQuote))}`,
                {
                    method: "GET",
                    headers: {
                        ...appHeaders,
                        "X-Prolance-Token": String(prolanceToken).trim(),
                        "X-Prolance-Origin-Session": String(originSessionID).trim(),
                    },
                },
            );
            const fullText = await fullRes.text();
            let fullBody: unknown = null;
            try {
                fullBody = fullText ? JSON.parse(fullText) : null;
            } catch {
                fullBody = fullText;
            }
            if (fullRes.ok && fullBody) {
                const rawQuoteData =
                    quoteBody && typeof quoteBody === "object"
                        ? (quoteBody as Record<string, unknown>).data ?? (quoteBody as Record<string, unknown>).Data
                        : null;
                const baseQuoteData =
                    Array.isArray(rawQuoteData) && rawQuoteData[0] && typeof rawQuoteData[0] === "object"
                        ? rawQuoteData[0]
                        : rawQuoteData && typeof rawQuoteData === "object" && !Array.isArray(rawQuoteData)
                          ? rawQuoteData
                          : null;
                const baseQuoteOptionsData =
                    baseQuoteData &&
                    typeof baseQuoteData === "object" &&
                    Array.isArray((baseQuoteData as Record<string, unknown>).quoteOptionsData)
                        ? ((baseQuoteData as Record<string, unknown>).quoteOptionsData as unknown[])
                        : null;
                if (
                    fullBody &&
                    typeof fullBody === "object" &&
                    (fullBody as Record<string, unknown>).data &&
                    typeof (fullBody as Record<string, unknown>).data === "object" &&
                    Array.isArray(baseQuoteOptionsData) &&
                    baseQuoteOptionsData.length > 0
                ) {
                    const baseByOptionKey = new Map<string, Record<string, unknown>>();
                    baseQuoteOptionsData.forEach((item: unknown, idx: number) => {
                        const it = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
                        const optionKey =
                            it && (it.optionID ?? it.optionId ?? it.roomID ?? it.roomId) != null
                                ? String(it.optionID ?? it.optionId ?? it.roomID ?? it.roomId)
                                : `idx-${idx}`;
                        if (it) baseByOptionKey.set(optionKey, it);
                    });
                    const fd = (fullBody as Record<string, unknown>).data as Record<string, unknown>;
                    const fullOptionsData = Array.isArray(fd.quoteOptionsData)
                        ? fd.quoteOptionsData
                        : Array.isArray(fd.optionDetails)
                          ? fd.optionDetails
                          : [];
                    const mergedOptionsData = (fullOptionsData as unknown[]).map((item: unknown, idx: number) => {
                        const it = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
                        const optionKey =
                            it && (it.optionID ?? it.optionId ?? it.roomID ?? it.roomId) != null
                                ? String(it.optionID ?? it.optionId ?? it.roomID ?? it.roomId)
                                : `idx-${idx}`;
                        const baseItem = baseByOptionKey.get(optionKey);
                        if (!baseItem || typeof baseItem !== "object") return item;
                        return {
                            ...it,
                            totalPrice: baseItem.totalPrice ?? it?.totalPrice,
                            totalPriceOld: baseItem.totalPriceOld ?? it?.totalPriceOld,
                            unitsPrice: baseItem.unitsPrice ?? it?.unitsPrice,
                            loftsPrice: baseItem.loftsPrice ?? it?.loftsPrice,
                            servicesPrice: baseItem.servicesPrice ?? it?.servicesPrice,
                            appliancesPrice: baseItem.appliancesPrice ?? it?.appliancesPrice,
                            skirtingsPrice: baseItem.skirtingsPrice ?? it?.skirtingsPrice,
                            worktopsPrice: baseItem.worktopsPrice ?? it?.worktopsPrice,
                            additionalHWPrice: baseItem.additionalHWPrice ?? it?.additionalHWPrice,
                            units: mergeQuoteLineItemArrays(
                                Array.isArray(baseItem.units) ? baseItem.units : [],
                                Array.isArray(it?.units) ? (it.units as unknown[]) : [],
                            ),
                            lofts: mergeQuoteLineItemArrays(
                                Array.isArray(baseItem.lofts) ? baseItem.lofts : [],
                                Array.isArray(it?.lofts) ? (it.lofts as unknown[]) : [],
                            ),
                            services: mergeQuoteLineItemArrays(
                                Array.isArray(baseItem.services) ? baseItem.services : [],
                                Array.isArray(it?.services) ? (it.services as unknown[]) : [],
                            ),
                        };
                    });
                    if (mergedOptionsData.length > 0) {
                        quoteBody = {
                            ...(fullBody as Record<string, unknown>),
                            data: {
                                ...fd,
                                quoteOptionsData: mergedOptionsData,
                            },
                        };
                    } else {
                        quoteBody = fullBody;
                    }
                } else {
                    quoteBody = fullBody;
                }
                effectiveStatus = fullRes.status;
            } else if (!quoteRes.ok && fullRes.ok && fullBody) {
                quoteBody = fullBody;
                effectiveStatus = fullRes.status;
            } else if (!hasQuotePricingDetails(quoteBody) && fullBody) {
                quoteBody = fullBody;
                effectiveStatus = fullRes.status;
            }
        }

        const quoteSucceeded = effectiveStatus >= 200 && effectiveStatus < 300;
        if (!quoteSucceeded) {
            const b = quoteBody && typeof quoteBody === "object" ? (quoteBody as Record<string, unknown>) : null;
            const msg =
                (b && (b.message || b.error)) || `Get quote failed (HTTP ${effectiveStatus}).`;
            return { ok: false, message: String(msg) };
        }

        const redirectQuoteId = extractQuoteIdFromBody(quoteBody) ?? quoteIdFromGetQuote;
        return {
            ok: true,
            effectiveStatus,
            quoteBody,
            redirectQuoteId: redirectQuoteId != null && redirectQuoteId > 0 ? redirectQuoteId : null,
            quoteProjectId,
            partnerIdFromLogin,
        };
    } catch {
        return { ok: false, message: "Failed to trigger Prolance get quote." };
    }
}
