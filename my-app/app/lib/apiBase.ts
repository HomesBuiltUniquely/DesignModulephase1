/**
 * Backend API base URL. Set NEXT_PUBLIC_API_URL in production (e.g. in AWS).
 * Defaults to local backend for development.
 */
export const getApiBase = (): string => {
  const fromEnv =
    typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL
      ? String(process.env.NEXT_PUBLIC_API_URL).replace(/\/$/, "")
      : "";
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "design.hubinterior.com" || host.endsWith(".hubinterior.com")) {
      return "https://api.hubinterior.com";
    }
  }
  return "http://localhost:3001";
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
