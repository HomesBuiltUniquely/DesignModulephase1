/**
 * Design Module talks to Easebuzz directly for payment success.
 * Easebuzz dashboard allows only ONE Transaction Webhook URL (merchant-level).
 * Official fallback: POST /transaction/v2/retrieve (hash = key|txnid|salt).
 * This path does not need CRM/Hub to be up.
 */
import { createHash } from "node:crypto";

function envTrim(key: string, fallback = ""): string {
  const v = String(process.env[key] ?? fallback).trim();
  return v;
}

export function easebuzzConfigured(): boolean {
  return Boolean(envTrim("EASEBUZZ_KEY") && envTrim("EASEBUZZ_SALT"));
}

export function easebuzzIsProd(): boolean {
  return envTrim("EASEBUZZ_ENV", "test").toLowerCase() === "prod";
}

function sha512(value: string): string {
  return createHash("sha512").update(value, "utf8").digest("hex");
}

function retrieveUrl(): string {
  return easebuzzIsProd()
    ? "https://dashboard.easebuzz.in/transaction/v2/retrieve"
    : "https://testdashboard.easebuzz.in/transaction/v2/retrieve";
}

function pickText(obj: Record<string, unknown> | null, ...keys: string[]): string {
  if (!obj) return "";
  for (const k of keys) {
    const v = obj[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

export type EasebuzzRetrieveResult = {
  success: boolean;
  status: string;
  paymentId: string;
  mode: string;
  amount: number | null;
  raw: string;
};

function parseDataNode(root: Record<string, unknown>): Record<string, unknown> {
  const msg = root.msg ?? root.data ?? root;
  if (Array.isArray(msg) && msg.length > 0 && msg[0] && typeof msg[0] === "object") {
    return msg[0] as Record<string, unknown>;
  }
  if (msg && typeof msg === "object" && !Array.isArray(msg)) {
    return msg as Record<string, unknown>;
  }
  return root;
}

/** Official Easebuzz Transaction API — confirm PAID without webhook. */
export async function retrieveEasebuzzTxn(merchantTxn: string): Promise<EasebuzzRetrieveResult> {
  const key = envTrim("EASEBUZZ_KEY");
  const salt = envTrim("EASEBUZZ_SALT");
  const txn = merchantTxn.trim();
  if (!key || !salt || !txn) {
    return { success: false, status: "", paymentId: "", mode: "", amount: null, raw: "not configured" };
  }
  const hash = sha512(`${key}|${txn}|${salt}`);
  const body = new URLSearchParams({ key, txnid: txn, hash });
  try {
    const res = await fetch(retrieveUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const raw = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    const data = parseDataNode(parsed);
    const status = pickText(data, "status", "txn_status");
    const paymentId = pickText(data, "easepayid", "easebuzz_id", "txnid");
    const mode = pickText(data, "mode", "payment_source", "card_type");
    const amountRaw = pickText(data, "amount", "net_amount_debit");
    const amount = amountRaw && Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : null;
    const success = status.toLowerCase() === "success" || status.toLowerCase() === "paid";
    return { success, status, paymentId, mode, amount, raw };
  } catch (err) {
    return {
      success: false,
      status: "",
      paymentId: "",
      mode: "",
      amount: null,
      raw: err instanceof Error ? err.message : "retrieve failed",
    };
  }
}
