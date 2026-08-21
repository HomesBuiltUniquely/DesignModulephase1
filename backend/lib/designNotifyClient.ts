/**
 * HTTP client for NotifyProject inbox (fan-out on write).
 */

const NOTIFY_BASE = (process.env.NOTIFY_API_URL || process.env.HUB_NOTIFY_BASE_URL || "http://localhost:8080")
  .trim()
  .replace(/\/+$/, "");
const NOTIFY_ENABLED = process.env.HUB_NOTIFY_ENABLED !== "false";
const NOTIFY_API_KEY = (process.env.HUB_NOTIFY_API_KEY || process.env.HUB_SYNC_API_KEY || "").trim();

export type DesignNotifyPath =
  | "lead/pre-10"
  | "lead/10-20"
  | "milestone"
  | "payment/request"
  | "payment/status"
  | "dqc/request"
  | "dqc/status"
  | "mmt/request"
  | "mmt/assign"
  | "mmt/doc-ready"
  | "meeting"
  | "assign/designer"
  | "assign/pm"
  | "quote"
  | "p2p";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export async function postDesignInboxEvent(
  body: Record<string, unknown>,
  idempotencyKey: string,
): Promise<{ ok: true; raw: unknown } | { ok: false; error: string }> {
  if (!NOTIFY_ENABLED) {
    return { ok: true, raw: { skipped: true, reason: "HUB_NOTIFY_ENABLED=false" } };
  }
  const url = `${NOTIFY_BASE}/v1/design/inbox/events`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  };
  if (NOTIFY_API_KEY) headers["x-external-api-key"] = NOTIFY_API_KEY;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    let json: unknown = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    if (!resp.ok) {
      const errMsg =
        isRecord(json) && typeof json.error === "string"
          ? json.error
          : `NotifyProject ${resp.status}: ${text.slice(0, 200)}`;
      console.error("[design-inbox-failed]", { status: resp.status, errMsg });
      return { ok: false, error: errMsg };
    }
    return { ok: true, raw: json };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[design-inbox-error]", { error: msg });
    return { ok: false, error: msg };
  }
}

export async function fetchDesignInbox(opts: {
  userId: number;
  since?: string;
  limit?: number;
  projectId?: string;
}): Promise<{ ok: true; data: Record<string, unknown>[] } | { ok: false; error: string }> {
  if (!NOTIFY_ENABLED) return { ok: true, data: [] };
  const params = new URLSearchParams();
  params.set("user_id", String(opts.userId));
  if (opts.since) params.set("since", opts.since);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.projectId) params.set("project_id", opts.projectId);
  const result = await getInboxJson(`/v1/design/inbox?${params}`);
  if (!result.ok) return result;
  const data = Array.isArray(result.data) ? result.data : [];
  return { ok: true, data: data as Record<string, unknown>[] };
}

export async function fetchDesignInboxCounts(opts: {
  userId: number;
  since?: string;
}): Promise<{ ok: true; data: { total: number; by_type: Record<string, number> } } | { ok: false; error: string }> {
  if (!NOTIFY_ENABLED) {
    return { ok: true, data: { total: 0, by_type: {} } };
  }
  const params = new URLSearchParams();
  params.set("user_id", String(opts.userId));
  if (opts.since) params.set("since", opts.since);
  const result = await getInboxJson(`/v1/design/inbox/counts?${params}`);
  if (!result.ok) return result;
  const data = isRecord(result.data) ? result.data : {};
  const byType = isRecord(data.by_type) ? (data.by_type as Record<string, number>) : {};
  return {
    ok: true,
    data: {
      total: typeof data.total === "number" ? data.total : 0,
      by_type: byType,
    },
  };
}

export async function fetchDesignInboxItem(opts: {
  userId: number;
  id: number;
}): Promise<{ ok: true; data: Record<string, unknown> | null } | { ok: false; error: string }> {
  if (!NOTIFY_ENABLED) return { ok: true, data: null };
  const result = await getInboxJson(`/v1/design/inbox/${opts.id}?user_id=${opts.userId}`);
  if (!result.ok) return result;
  return { ok: true, data: isRecord(result.data) ? result.data : null };
}

export async function markDesignInboxRead(opts: {
  userId: number;
  id: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!NOTIFY_ENABLED) return { ok: true };
  return postInboxJson(`/v1/design/inbox/${opts.id}/read?user_id=${opts.userId}`);
}

export async function markDesignInboxAllRead(opts: {
  userId: number;
}): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  if (!NOTIFY_ENABLED) return { ok: true, updated: 0 };
  const result = await postInboxJson(`/v1/design/inbox/read-all?user_id=${opts.userId}`);
  if (!result.ok) return result;
  return { ok: true, updated: result.updated ?? 0 };
}

async function postInboxJson(
  path: string,
): Promise<{ ok: true; updated?: number } | { ok: false; error: string }> {
  const url = `${NOTIFY_BASE}${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (NOTIFY_API_KEY) headers["x-external-api-key"] = NOTIFY_API_KEY;
  try {
    const resp = await fetch(url, { method: "POST", headers });
    const text = await resp.text();
    let json: unknown = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    if (!resp.ok) {
      const errMsg =
        isRecord(json) && typeof json.error === "string"
          ? json.error
          : `NotifyProject ${resp.status}: ${text.slice(0, 200)}`;
      return { ok: false, error: errMsg };
    }
    const updated = isRecord(json) && typeof json.updated === "number" ? json.updated : undefined;
    return { ok: true, updated };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function getInboxJson(path: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const url = `${NOTIFY_BASE}${path}`;
  const headers: Record<string, string> = {};
  if (NOTIFY_API_KEY) headers["x-external-api-key"] = NOTIFY_API_KEY;
  try {
    const resp = await fetch(url, { headers });
    const text = await resp.text();
    let json: unknown = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    if (!resp.ok) {
      const errMsg =
        isRecord(json) && typeof json.error === "string"
          ? json.error
          : `NotifyProject ${resp.status}: ${text.slice(0, 200)}`;
      return { ok: false, error: errMsg };
    }
    const data = isRecord(json) ? json.data : undefined;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function notifyPublicWsUrl(): string {
  if (NOTIFY_BASE.startsWith("https://")) return `wss://${NOTIFY_BASE.slice("https://".length)}`;
  if (NOTIFY_BASE.startsWith("http://")) return `ws://${NOTIFY_BASE.slice("http://".length)}`;
  return "ws://localhost:8080";
}

export async function issueDesignInboxWsTicket(
  userId: number,
): Promise<{ ok: true; ticket: string } | { ok: false; error: string }> {
  if (!NOTIFY_ENABLED) return { ok: false, error: "notify disabled" };
  const url = `${NOTIFY_BASE}/v1/design/inbox/ws-ticket`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (NOTIFY_API_KEY) headers["x-external-api-key"] = NOTIFY_API_KEY;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: userId }),
    });
    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok || typeof json.ticket !== "string" || !json.ticket) {
      const errMsg = typeof json.error === "string" ? json.error : `NotifyProject ${resp.status}`;
      return { ok: false, error: errMsg };
    }
    return { ok: true, ticket: json.ticket };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

