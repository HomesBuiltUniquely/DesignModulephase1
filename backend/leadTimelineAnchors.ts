import type { Pool } from "mysql2/promise";

export type LeadTimelineAnchors = {
  entered1020At: string | null;
  d1MmtRequestSentAt: string | null;
};

function parsePayloadObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Resolve when the lead first entered the 10–20% intake phase. */
export function resolveEntered1020At(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.entered_1020_at,
    payload.sales_closure_finance_approved_at,
    payload.crm_booking_finance_approved_at,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

/** Persist `entered_1020_at` on first transition to 10–20% (idempotent). */
export function stampEntered1020At(payload: Record<string, unknown>): Record<string, unknown> {
  if (!payload.entered_1020_at) {
    payload.entered_1020_at = resolveEntered1020At(payload) ?? new Date().toISOString();
  }
  return payload;
}

export function buildTimelineAnchorsFromPayloadAndD1(
  payloadRaw: unknown,
  d1SentAt: Date | string | null | undefined,
): LeadTimelineAnchors {
  const payload = parsePayloadObject(payloadRaw);
  return {
    entered1020At: resolveEntered1020At(payload),
    d1MmtRequestSentAt: d1SentAt ? new Date(d1SentAt).toISOString() : null,
  };
}

export async function fetchLeadTimelineAnchors(
  pool: Pool,
  leadId: number,
  payloadRaw: unknown,
): Promise<LeadTimelineAnchors> {
  const [d1Rows] = await pool.query(
    "SELECT MIN(created_at) as sentAt FROM lead_d1_assignments WHERE lead_id = ?",
    [leadId],
  );
  const sentAt = (d1Rows as { sentAt?: Date | string | null }[])[0]?.sentAt;
  return buildTimelineAnchorsFromPayloadAndD1(payloadRaw, sentAt);
}
