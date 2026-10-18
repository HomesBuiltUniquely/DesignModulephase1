const PROD_API_BASE = "https://api.hubinterior.com";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Avoid `/api/crm` + `/api/auth/login` → `/api/crm/api/auth/login`. */
function normalizeApiBase(raw: string): string {
  let base = stripTrailingSlash(raw.trim());
  if (!base) return "";
  if (base.startsWith("/") && !base.startsWith("//")) {
    return "";
  }
  try {
    const withProto = base.includes("://") ? base : `https://${base}`;
    const u = new URL(withProto);
    const host = u.hostname.toLowerCase();
    // Vercel frontend has no Express /api/auth/login — that 502s or hits CRM twice.
    if (host === "design.hubinterior.com" || host.startsWith("www.design.")) {
      return PROD_API_BASE;
    }
    u.pathname = u.pathname.replace(/\/+$/, "").replace(/\/api\/crm$/i, "").replace(/\/api$/i, "");
    if (u.pathname === "/") u.pathname = "";
    return stripTrailingSlash(`${u.origin}${u.pathname}`);
  } catch {
    return stripTrailingSlash(base.replace(/\/api\/crm$/i, "").replace(/\/api$/i, ""));
  }
}

/**
 * Backend API base URL. Set NEXT_PUBLIC_API_URL in production (e.g. in AWS).
 * Defaults to local backend for development.
 */
export const getApiBase = (): string => {
  const fromEnv =
    typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL
      ? normalizeApiBase(String(process.env.NEXT_PUBLIC_API_URL))
      : "";
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "design.hubinterior.com" || host.endsWith(".hubinterior.com")) {
      return PROD_API_BASE;
    }
  }
  return "http://localhost:3001";
};

export const apiUrl = (path: string): string => {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/api") && p.startsWith("/api/")) {
    return `${base}${p.slice(4)}`;
  }
  return `${base}${p}`;
};

export const buildAuthHeaders = (
  sessionId?: string | null,
  headers: Record<string, string> = {},
): Record<string, string> => {
  const merged: Record<string, string> = { ...headers };
  const token = sessionId || getStoredSessionId();
  if (token) {
    merged.Authorization = `Bearer ${token}`;
  }
  return merged;
};

export const getStoredSessionId = (): string => {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("design_module_auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.sessionId) return String(parsed.sessionId);
    }
  } catch {}
  return localStorage.getItem("sessionId") || "";
};
