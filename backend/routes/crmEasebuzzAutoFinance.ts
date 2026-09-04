/**
 * CRM Booking & Token — Easebuzz auto-finance (CRM convert path only).
 * Manual Sales Closure, DQC1 10%, and refund flows are unchanged.
 */
import type { Pool } from "mysql2/promise";

export type FinanceHandlingMode = "AUTO_APPROVED" | "MANUAL_QUEUE";
export type FinanceSection = "AUTO_APPROVED" | "MANUAL_QUEUE";

type HubLeadBody = Record<string, unknown>;

type ResolvedBookingFinance = {
  mode: "FULL_10" | "BUFFER_9_9";
  shortfallAmount: number;
  remainingAmount: number;
  bufferApplied: boolean;
  financeBufferNote: string;
  amountToward10: number;
  extraAmountReceived: number;
  totalAmountReceived: number;
  tenPercentAmount: number | null;
};

function pickStr(...values: unknown[]): string {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function pickNum(...values: unknown[]): number | null {
  for (const v of values) {
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function paymentHistoryEntries(body: HubLeadBody): Record<string, unknown>[] {
  const raw = body.paymentHistory ?? body.payment_history;
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && typeof e === "object") as Record<string, unknown>[];
}

function isEasebuzzKind(kind: string): boolean {
  const k = kind.toLowerCase();
  return k.includes("easebuzz") || k === "online" || k === "gateway";
}

/** Single paymentHistory entry is Easebuzz gateway-verified (no manual proof path). */
export function isEasebuzzVerifiedPaymentEntry(entry: Record<string, unknown>): boolean {
  if (asBool(entry.gatewayVerified) || asBool(entry.gateway_verified)) return true;
  if (asBool(entry.easebuzzVerified) || asBool(entry.easebuzz_verified)) return true;
  if (asBool(entry.verified) && isEasebuzzKind(pickStr(entry.paymentKind, entry.payment_kind, entry.source, entry.mode))) {
    return true;
  }

  const kind = pickStr(entry.paymentKind, entry.payment_kind, entry.source, entry.mode);
  const hasTxn =
    Boolean(pickStr(entry.easebuzzTxnId, entry.easebuzz_txn_id, entry.txnId, entry.txn_id, entry.transactionId)) ||
    Boolean(pickStr(entry.gatewayReference, entry.gateway_reference));

  if (isEasebuzzKind(kind) && hasTxn) return true;
  if (isEasebuzzKind(kind) && asBool(entry.autoFinanceEligible)) return true;

  const proofs = Array.isArray(entry.proofs) ? entry.proofs : [];
  if (proofs.length > 0 && !isEasebuzzKind(kind)) return false;
  if (isEasebuzzKind(kind) && proofs.length === 0 && hasTxn) return true;

  return false;
}

/** Manual proof entry (offline / mixed). */
export function isManualProofPaymentEntry(entry: Record<string, unknown>): boolean {
  if (isEasebuzzVerifiedPaymentEntry(entry)) return false;
  const proofs = Array.isArray(entry.proofs) ? entry.proofs : [];
  if (proofs.length > 0) return true;
  const kind = pickStr(entry.paymentKind, entry.payment_kind, entry.source, entry.mode).toLowerCase();
  if (!kind) return false;
  return (
    kind.includes("manual") ||
    kind.includes("offline") ||
    kind.includes("cash") ||
    kind.includes("cheque") ||
    kind.includes("check") ||
    kind.includes("neft") ||
    kind.includes("rtgs") ||
    kind.includes("bank")
  );
}

/**
 * Resolve AUTO_APPROVED vs MANUAL_QUEUE for CRM convert.
 * All collected payments must be Easebuzz-verified; any manual/mixed → MANUAL_QUEUE.
 */
export function resolveFinanceHandlingMode(body: HubLeadBody): FinanceHandlingMode {
  const topGateway = pickStr(body.paymentGateway, body.payment_gateway, body.paymentKind, body.payment_kind).toLowerCase();
  const topVerified = asBool(body.gatewayVerified) || asBool(body.gateway_verified) || asBool(body.easebuzzVerified);

  const history = paymentHistoryEntries(body);
  if (history.length === 0) {
    if (topVerified && isEasebuzzKind(topGateway)) return "AUTO_APPROVED";
    return "MANUAL_QUEUE";
  }

  let hasEasebuzz = false;
  for (const entry of history) {
    const amount = pickNum(entry.amount) ?? 0;
    if (amount <= 0) continue;
    if (isManualProofPaymentEntry(entry)) return "MANUAL_QUEUE";
    if (!isEasebuzzVerifiedPaymentEntry(entry)) return "MANUAL_QUEUE";
    hasEasebuzz = true;
  }

  return hasEasebuzz ? "AUTO_APPROVED" : "MANUAL_QUEUE";
}

export function readCrmFinanceHandlingMode(payload: Record<string, unknown>): FinanceHandlingMode | null {
  const raw = pickStr(payload.crm_finance_handling_mode, payload.financeHandlingMode);
  if (raw === "AUTO_APPROVED" || raw === "MANUAL_QUEUE") return raw;
  if (payload.crm_booking_finance_auto_approved === true || payload.crm_booking_finance_auto_approved === "true") {
    return "AUTO_APPROVED";
  }
  return null;
}

/** Idempotent key stored in lead_hub_booking_sync.payment_payload.financeSyncIdempotentKey */
export function buildFinanceSyncIdempotentKey(
  bookingTokenRecordId: string,
  paymentHistoryId: string | null,
): string {
  return `${bookingTokenRecordId}:${paymentHistoryId || "latest"}`;
}

export function isIdempotentFinanceResync(
  priorPayload: Record<string, unknown>,
  idempotentKey: string,
): boolean {
  const priorKey = pickStr(priorPayload.financeSyncIdempotentKey);
  const priorMode = pickStr(priorPayload.financeHandlingMode);
  return (
    priorKey === idempotentKey &&
    (priorMode === "AUTO_APPROVED" || priorMode === "MANUAL_QUEUE")
  );
}

/** Finance auto/manual metadata merged into lead_hub_booking_sync.payment_payload */
export function mergeFinanceMetaIntoHubPayload(
  body: HubLeadBody,
  finance: {
    mode: "FULL_10" | "BUFFER_9_9";
    bufferApplied: boolean;
    bufferThresholdAmount: number | null;
    remainingAmount: number;
    shortfallAmount: number;
    extraAmountReceived: number;
    totalAmountReceived: number;
    financeBufferNote: string;
    amountToward10: number;
    tenPercentAmount: number | null;
    quoteAmount: number | null;
  },
  financeHandlingMode: FinanceHandlingMode,
  idempotentKey: string,
): Record<string, unknown> {
  const auto = financeHandlingMode === "AUTO_APPROVED";
  return {
    ...body,
    bookingApprovalMode: finance.mode,
    bufferApplied: finance.bufferApplied,
    bufferThresholdAmount: finance.bufferThresholdAmount,
    remainingAmount: finance.remainingAmount,
    shortfallAmount: finance.shortfallAmount,
    extraAmountReceived: finance.extraAmountReceived,
    totalAmountReceived: finance.totalAmountReceived,
    financeBufferNote: finance.financeBufferNote || undefined,
    amountReceived: finance.amountToward10,
    tenPercentAmount: finance.tenPercentAmount,
    quoteAmount: finance.quoteAmount,
    financeHandlingMode,
    financeSection: auto ? "AUTO_APPROVED" : "MANUAL_QUEUE",
    financeSyncMode: finance.mode,
    financeSyncIdempotentKey: idempotentKey,
    financeCcNotified: auto,
    shortfallRecorded: finance.shortfallAmount,
  };
}

export type ConvertBookingFinanceResult = {
  designLeadId: number;
  bookingTokenRecordId: string;
  financeSyncMode: "FULL_10" | "BUFFER_9_9";
  shortfallRecorded: number;
  extraAmountReceived: number;
  financeHandlingMode: FinanceHandlingMode;
  financeSection: FinanceSection;
  projectStage: string;
  financeCcNotified: boolean;
  approvedBy: string | null;
  bufferApplied: boolean;
  remainingAmount: number;
  financeBufferNote: string | null;
  actions: string[];
  idempotentResync?: boolean;
};

export type AutoFinanceDeps = {
  addLeadHistoryEvent: (leadId: number, event: Record<string, unknown>) => Promise<void>;
  notifyHubApproved: (leadId: number, reviewedBy: string) => void;
  notifyLeadEntered1020: (leadId: number, approvedBy: string) => void;
  notifyPaymentApproved: (leadId: number, approvedBy: string, amount: number) => void;
  notifyFinanceCc?: (leadId: number, meta: Record<string, unknown>) => void;
};

/** Apply system auto-approval for verified Easebuzz CRM booking payment. */
export async function applyCrmEasebuzzAutoFinanceApproval(
  pool: Pool,
  leadId: number,
  finance: ResolvedBookingFinance,
  bookingTokenRecordId: string,
  paymentHistoryId: string | null,
  deps: AutoFinanceDeps,
): Promise<void> {
  const now = new Date();
  const approvedBy = "SYSTEM · Easebuzz";

  await pool.query(
    "UPDATE lead_uploads SET status = 'approved' WHERE lead_id = ? AND upload_type = 'hub_payment_proof' AND status = 'pending'",
    [leadId],
  );

  const [lr] = await pool.query("SELECT payload FROM leads WHERE id = ? LIMIT 1", [leadId]);
  const raw = (lr as { payload?: unknown }[])[0]?.payload;
  let payload: Record<string, unknown> = {};
  try {
    payload = raw ? (JSON.parse(String(raw)) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }

  payload.crm_booking_finance_approved = true;
  payload.crm_booking_finance_approved_at = now.toISOString();
  payload.crm_booking_finance_auto_approved = true;
  payload.crm_finance_handling_mode = "AUTO_APPROVED";
  payload.crm_finance_section = "AUTO_APPROVED";
  payload.crm_booking_finance_approved_by = approvedBy;
  payload.crm_finance_cc_notified = true;
  if (finance.bufferApplied) {
    payload.buffer_applied = true;
    payload.shortfall_toward_10_percent = finance.shortfallAmount;
    payload.remaining_for_10_percent = finance.remainingAmount;
  }
  if (payload.quotation_total && !payload.quotation_total_at_sales_closure) {
    payload.quotation_total_at_sales_closure = pickNum(payload.quotation_total);
  }

  await pool.query(
    `UPDATE leads SET project_stage = '10-20%', payload = ?, update_at = ? WHERE id = ?`,
    [JSON.stringify(payload), now, leadId],
  );

  const historyDesc =
    finance.mode === "BUFFER_9_9"
      ? `Easebuzz auto-approved at 9.9% buffer. Shortfall ₹${finance.shortfallAmount.toLocaleString("en-IN")} still tracked toward 10%. Lead moved to 10–20%.`
      : "Easebuzz payment auto-approved by system. Lead moved to 10–20%.";

  await deps.addLeadHistoryEvent(leadId, {
    id: `crm-easebuzz-auto-${Date.now()}`,
    type: "note",
    taskName: "CRM Booking Payment Auto-Approval",
    milestoneName: "Pre 10%",
    timestamp: now.toISOString(),
    description: historyDesc,
    user: { name: approvedBy },
    details: {
      kind: "easebuzz_auto_finance",
      bookingTokenRecordId,
      paymentHistoryId,
      financeSyncMode: finance.mode,
      shortfallAmount: finance.shortfallAmount,
      bufferApplied: finance.bufferApplied,
    },
  });

  deps.notifyHubApproved(leadId, approvedBy);
  deps.notifyLeadEntered1020(leadId, approvedBy);
  deps.notifyPaymentApproved(
    leadId,
    approvedBy,
    Number(finance.totalAmountReceived) || Number(finance.amountToward10) || 0,
  );
  deps.notifyFinanceCc?.(leadId, {
    financeSyncMode: finance.mode,
    bufferApplied: finance.bufferApplied,
    shortfallRecorded: finance.shortfallAmount,
    approvedBy,
  });
}

export function buildConvertFinanceResponse(
  base: {
    designLeadId: number;
    bookingTokenRecordId: string;
    financeSyncMode: "FULL_10" | "BUFFER_9_9";
    shortfallRecorded: number;
    extraAmountReceived: number;
    bufferApplied: boolean;
    remainingAmount: number;
    financeBufferNote: string;
  },
  handlingMode: FinanceHandlingMode,
  opts?: { idempotentResync?: boolean },
): ConvertBookingFinanceResult {
  const auto = handlingMode === "AUTO_APPROVED";
  return {
    ...base,
    financeHandlingMode: handlingMode,
    financeSection: auto ? "AUTO_APPROVED" : "MANUAL_QUEUE",
    projectStage: auto ? "10-20%" : "Pre 10%",
    financeCcNotified: auto,
    approvedBy: auto ? "SYSTEM · Easebuzz" : null,
    financeBufferNote: base.financeBufferNote || null,
    actions: auto ? ["VIEW"] : ["VIEW_PROOFS", "APPROVE", "REJECT"],
    idempotentResync: opts?.idempotentResync,
  };
}
