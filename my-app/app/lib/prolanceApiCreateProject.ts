import type { LeadshipTypes } from "@/app/Components/Types/Types";

/**
 * Creates a Prolance project through the Hub API, which proxies to
 * PUT https://api.prolance.design/Origin/V2/Projects/Create (see backend `prolanceApi.ts`).
 */

export type CreateProlanceProjectApiResult =
    | { ok: true; createdProjectId: number | null; upstream: unknown }
    | { ok: false; message: string };

function extractString(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

function parseLeadPayload(raw: unknown): Record<string, unknown> | null {
    if (!raw) return null;
    if (typeof raw === "object") return raw as Record<string, unknown>;
    if (typeof raw !== "string") return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function extractProjectId(v: unknown): number | null {
    if (!v || typeof v !== "object") return null;
    const root = v as Record<string, unknown>;
    const direct = root.projectID ?? root.projectId;
    if (typeof direct === "number" && Number.isFinite(direct)) return direct;
    if (typeof direct === "string" && direct.trim() && Number.isFinite(Number(direct))) return Number(direct);
    const arr = root.data;
    if (Array.isArray(arr) && arr[0] && typeof arr[0] === "object") {
        const first = arr[0] as Record<string, unknown>;
        const nested = first.projectID ?? first.projectId;
        if (typeof nested === "number" && Number.isFinite(nested)) return nested;
        if (typeof nested === "string" && nested.trim() && Number.isFinite(Number(nested))) return Number(nested);
    }
    return null;
}

export function buildProlanceCreateProjectBody(project: LeadshipTypes): Record<string, unknown> {
    const rawProj = project as unknown as Record<string, unknown>;
    const payloadObj = parseLeadPayload(rawProj?.payload);
    const formData =
        payloadObj?.formData && typeof payloadObj.formData === "object"
            ? (payloadObj.formData as Record<string, unknown>)
            : null;
    const partnerID =
        Number(rawProj?.partnerID || formData?.partnerID || payloadObj?.partnerID || 23226) || 23226;

    return {
        partnerID,
        pName: extractString(project.projectName) || "Untitled Project",
        customer:
            extractString(rawProj?.customer) ||
            extractString(formData?.customer_name) ||
            extractString(formData?.sales_lead_name) ||
            extractString(project.projectName) ||
            "Customer",
        city:
            extractString(rawProj?.city) || extractString(formData?.city) || "Bengaluru",
        state:
            extractString(rawProj?.state) || extractString(formData?.state) || "Karnataka",
        projectType:
            extractString(rawProj?.projectType) ||
            extractString(formData?.projectType) ||
            "CYO",
    };
}

export async function createProlanceProjectViaApi(params: {
    appApiBase: string;
    sessionId: string;
    project: LeadshipTypes;
}): Promise<CreateProlanceProjectApiResult> {
    const API = params.appApiBase.replace(/\/$/, "");
    const appHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.sessionId}`,
    };

    try {
        const tokenRes = await fetch(`${API}/api/prolance-test/token`, {
            method: "POST",
            headers: appHeaders,
            body: JSON.stringify({}),
        });
        const tokenText = await tokenRes.text();
        let tokenBody: Record<string, unknown> | string | null = null;
        try {
            tokenBody = tokenText ? (JSON.parse(tokenText) as Record<string, unknown>) : null;
        } catch {
            tokenBody = tokenText;
        }
        const prolanceToken =
            (tokenBody &&
                typeof tokenBody === "object" &&
                (tokenBody.access_token || tokenBody.accessToken || tokenBody.token)) ||
            "";
        if (!tokenRes.ok || !String(prolanceToken).trim()) {
            const msg =
                (tokenBody && typeof tokenBody === "object" && (tokenBody.message || tokenBody.error)) ||
                "Failed to generate Prolance token.";
            return { ok: false, message: String(msg) };
        }

        const partnerRes = await fetch(`${API}/api/prolance-test/partners/login`, {
            method: "POST",
            headers: {
                ...appHeaders,
                "X-Prolance-Token": String(prolanceToken).trim(),
            },
            body: JSON.stringify({}),
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
        const originSessionID =
            (partnerData0 &&
                typeof partnerData0 === "object" &&
                ((partnerData0 as Record<string, unknown>).sessionID ||
                    (partnerData0 as Record<string, unknown>).sessionId)) ||
            "";
        const partnerIDFromLogin =
            partnerData0 && typeof partnerData0 === "object"
                ? (partnerData0 as Record<string, unknown>).partnerID ??
                  (partnerData0 as Record<string, unknown>).partnerId
                : null;

        if (!partnerRes.ok || !String(originSessionID).trim()) {
            const msg =
                (partnerBody && typeof partnerBody === "object" && (partnerBody.message || partnerBody.error)) ||
                "Failed to login partner / fetch origin session.";
            return { ok: false, message: String(msg) };
        }

        const payload = buildProlanceCreateProjectBody(params.project);
        if (partnerIDFromLogin != null && Number(partnerIDFromLogin)) {
            payload.partnerID = Number(partnerIDFromLogin);
        }

        const createHeaders: Record<string, string> = {
            ...appHeaders,
            "X-Prolance-Token": String(prolanceToken).trim(),
            "X-Prolance-Origin-Session": String(originSessionID).trim(),
        };
        const res = await fetch(`${API}/api/prolance-test/projects/create`, {
            method: "PUT",
            headers: createHeaders,
            body: JSON.stringify(payload),
        });
        const txt = await res.text();
        let body: unknown = null;
        try {
            body = txt ? JSON.parse(txt) : null;
        } catch {
            body = txt;
        }
        if (!res.ok) {
            const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
            const msg =
                (b && (b.message || b.error)) || `Create project failed (HTTP ${res.status}).`;
            return { ok: false, message: String(msg) };
        }
        const createdProjectId = extractProjectId(body);
        return { ok: true, createdProjectId, upstream: body };
    } catch {
        return { ok: false, message: "Failed to trigger Prolance create project." };
    }
}
