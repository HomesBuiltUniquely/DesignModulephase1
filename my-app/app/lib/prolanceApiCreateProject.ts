import type { LeadshipTypes } from "@/app/Components/Types/Types";

/**
 * Creates a Prolance project through the Hub API, which proxies to
 * PUT https://api.prolance.design/Origin/V2/Projects/Create (see backend `prolanceApi.ts`).
 */

export type CreateProlanceProjectApiResult =
    | { ok: true; createdProjectId: number | null; upstream: unknown; warning?: string | null }
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

function formatProlanceCreateError(b: Record<string, unknown> | null, status: number): string {
    if (b?.code === "PROLANCE_PARTNER_NOT_CONFIGURED") {
        return String(
            b.message ||
                "Your Prolance partner login is not configured. Contact admin to add your Prolance LoginID and password.",
        );
    }
    const missing = b?.missing ? ` (${String(b.missing)} missing)` : "";
    const credHint =
        b?.credSource === "env_fallback"
            ? " Project may have been created under the admin Prolance account."
            : "";
    return String(
        (b && (b.message || b.error)) || `Create project failed (HTTP ${status})${missing}.${credHint}`,
    );
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
    const body: Record<string, unknown> = {
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
            extractString(formData?.booking_type) ||
            "CYO",
    };
    return body;
}

export type ProlanceProjectFormFields = {
    pName: string;
    customer: string;
    city: string;
    state: string;
};

export async function createProlanceProjectFromForm(params: {
    appApiBase: string;
    sessionId: string;
    fields: ProlanceProjectFormFields;
}): Promise<CreateProlanceProjectApiResult> {
    const API = params.appApiBase.replace(/\/$/, "");
    const appHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.sessionId}`,
    };
    try {
        const res = await fetch(`${API}/api/prolance-test/projects/create-as-user`, {
            method: "POST",
            headers: appHeaders,
            body: JSON.stringify({
                pName: params.fields.pName.trim(),
                customer: params.fields.customer.trim(),
                city: params.fields.city.trim() || "Bengaluru",
                state: params.fields.state.trim() || "Karnataka",
                projectType: "CYO",
            }),
        });
        const txt = await res.text();
        let body: unknown = null;
        try {
            body = txt ? JSON.parse(txt) : null;
        } catch {
            body = txt;
        }
        const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
        if (!res.ok) {
            const msg = formatProlanceCreateError(b, res.status);
            return { ok: false, message: msg };
        }
        const createdProjectId =
            (b?.createdProjectId != null && Number.isFinite(Number(b.createdProjectId))
                ? Number(b.createdProjectId)
                : null) ?? extractProjectId(body);
        const warning =
            typeof b?.warning === "string" && b.warning.trim() ? b.warning.trim() : null;
        return { ok: true, createdProjectId, upstream: body, warning };
    } catch {
        return { ok: false, message: "Failed to create Prolance project." };
    }
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
        const payload = buildProlanceCreateProjectBody(params.project);
        const res = await fetch(`${API}/api/prolance-test/projects/create-as-user`, {
            method: "POST",
            headers: appHeaders,
            body: JSON.stringify(payload),
        });
        const txt = await res.text();
        let body: unknown = null;
        try {
            body = txt ? JSON.parse(txt) : null;
        } catch {
            body = txt;
        }
        const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
        if (!res.ok) {
            const msg = formatProlanceCreateError(b, res.status);
            return { ok: false, message: msg };
        }
        const createdProjectId =
            (b?.createdProjectId != null && Number.isFinite(Number(b.createdProjectId))
                ? Number(b.createdProjectId)
                : null) ?? extractProjectId(body);
        const warning =
            typeof b?.warning === "string" && b.warning.trim() ? b.warning.trim() : null;
        return { ok: true, createdProjectId, upstream: body, warning };
    } catch {
        return { ok: false, message: "Failed to trigger Prolance create project." };
    }
}
