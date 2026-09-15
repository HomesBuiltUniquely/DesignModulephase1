import type { AuthUser } from "./AuthContext";

export type HandoffPayload = { user: AuthUser; sessionId: string };

function validateHandoff(data: unknown): HandoffPayload | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { user?: AuthUser; sessionId?: string };
  const sessionId = String(d.sessionId || "").trim();
  const user = d.user;
  if (!sessionId.startsWith("sess-")) return null;
  if (!user || typeof user !== "object") return null;
  if (user.id == null || !user.email || !user.role) return null;
  return { user, sessionId };
}

function parseSearchLike(raw: string): HandoffPayload | null {
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const payloadRaw = params.get("payload");
  if (payloadRaw) {
    for (const candidate of [payloadRaw, decodeURIComponent(payloadRaw)]) {
      try {
        const parsed = validateHandoff(JSON.parse(candidate));
        if (parsed) return parsed;
      } catch {
        /* try next */
      }
    }
  }
  const sessionId = params.get("sessionId") || params.get("session");
  const userRaw = params.get("user");
  if (sessionId && userRaw) {
    try {
      return validateHandoff({
        sessionId,
        user: JSON.parse(decodeURIComponent(userRaw)),
      });
    } catch {
      return null;
    }
  }
  return null;
}

/** Read CRM hallway handoff from hash (preferred) or query. */
export function parseHandoffFromLocation(loc: Location): HandoffPayload | null {
  const fromHash = parseSearchLike(loc.hash.replace(/^#/, ""));
  if (fromHash) return fromHash;
  return parseSearchLike(loc.search.replace(/^\?/, ""));
}

export function stripHandoffFromUrl(): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", window.location.pathname);
}
