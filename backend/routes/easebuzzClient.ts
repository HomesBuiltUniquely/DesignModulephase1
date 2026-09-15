/**
 * Design Module talks to Easebuzz directly (create link + retrieve).
 * Merchant webhook stays on CRM; Design does not host it.
 */
import { createHash } from "node:crypto";

function envTrim(key: string, fallback = ""): string {
  return String(process.env[key] ?? fallback).trim();
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

function n(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/** Easebuzz EasyCollect expects a 10-digit mobile. Keep last 10 digits if +91 / spaces. */
function normalizePhone(phone: string): string {
  const digits = n(phone).replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits || "0000000000";
}

function scaleAmount(amount: number): string {
  return Number(amount).toFixed(2);
}

function createUrl(): string {
  return easebuzzIsProd()
    ? "https://dashboard.easebuzz.in/easycollect/v1/create"
    : "https://testdashboard.easebuzz.in/easycollect/v1/create";
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

function parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function firstText(root: Record<string, unknown>, ...keys: string[]): string {
  const data = root.data;
  const nested =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  return pickText(root, ...keys) || pickText(nested, ...keys);
}

function isApiSuccess(root: Record<string, unknown>): boolean {
  const st = pickText(root, "status", "success").toLowerCase();
  return st === "success" || st === "true" || st === "1" || root.success === true;
}

export type EasebuzzCreateResult = {
  ok: boolean;
  paymentUrl: string;
  easebuzzId: string;
  error?: string;
};

export type EasebuzzRetrieveResult = {
  success: boolean;
  failure: boolean;
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

export function isGatewaySuccess(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "success" || s === "paid";
}

export function isGatewayFailure(status: string): boolean {
  const s = status.trim().toLowerCase();
  return (
    s === "failure" ||
    s === "failed" ||
    s === "usercancelled" ||
    s === "user_cancelled" ||
    s === "bounced" ||
    s === "dropped" ||
    s === "cancelled" ||
    s === "canceled"
  );
}

/** merchant_txn prefix so CRM can route Design txns without looking up CRM deals. */
export function isDesignMerchantTxn(txn: string): boolean {
  const t = txn.trim().toUpperCase();
  return t.startsWith("DES10") || t.startsWith("DES40") || t.startsWith("DES_");
}

export function newDesignMerchantTxn(bucket: "DESIGN_10" | "DESIGN_40"): string {
  const prefix = bucket === "DESIGN_40" ? "DES40" : "DES10";
  const rand = Math.random().toString(16).slice(2, 10).toUpperCase();
  const t = Date.now().toString(36).toUpperCase();
  return `${prefix}${t}${rand}`.slice(0, 32);
}

export async function createEasebuzzPaymentLink(args: {
  merchantTxn: string;
  name: string;
  email: string;
  phone: string;
  amount: number;
  message: string;
  udf1?: string;
  udf2?: string;
}): Promise<EasebuzzCreateResult> {
  const key = envTrim("EASEBUZZ_KEY");
  const salt = envTrim("EASEBUZZ_SALT");
  if (!key || !salt) {
    return { ok: false, paymentUrl: "", easebuzzId: "", error: "Easebuzz is not configured. Set EASEBUZZ_KEY and EASEBUZZ_SALT." };
  }
  const amountStr = scaleAmount(args.amount);
  const udf1 = n(args.udf1);
  const udf2 = n(args.udf2);
  const name = n(args.name) || "Customer";
  const email = n(args.email);
  const phone = normalizePhone(args.phone);
  const message = n(args.message);
  const hash = sha512(
    [key, args.merchantTxn, name, email, phone, amountStr, udf1, udf2, "", "", "", message, salt].join("|"),
  );
  const payload: Record<string, unknown> = {
    key,
    merchant_txn: args.merchantTxn,
    name,
    email,
    phone,
    amount: amountStr,
    message,
    hash,
  };
  if (udf1) payload.udf1 = udf1;
  if (udf2) payload.udf2 = udf2;
  const sub = envTrim("EASEBUZZ_SUB_MERCHANT_ID");
  if (sub) payload.sub_merchant_id = sub;
  const ttlHours = Math.max(1, Number(envTrim("EASEBUZZ_LINK_TTL_HOURS", "24")) || 24);
  const expiry = new Date(Date.now() + ttlHours * 3600 * 1000);
  const dd = String(expiry.getDate()).padStart(2, "0");
  const mm = String(expiry.getMonth() + 1).padStart(2, "0");
  payload.expiry_date = `${dd}-${mm}-${expiry.getFullYear()}`;

  try {
    const res = await fetch(createUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    const root = parseJson(raw);
    const url = firstText(root, "payment_url", "payment_link", "pay_hash_url", "url", "short_url");
    const id = firstText(root, "id", "easebuzz_id");
    if (!isApiSuccess(root) || !url) {
      const err = firstText(root, "msg", "error", "message") || `Easebuzz create-link failed (HTTP ${res.status}).`;
      return { ok: false, paymentUrl: "", easebuzzId: "", error: err };
    }
    return { ok: true, paymentUrl: url, easebuzzId: id };
  } catch (e) {
    return {
      ok: false,
      paymentUrl: "",
      easebuzzId: "",
      error: e instanceof Error ? e.message : "Easebuzz create-link failed.",
    };
  }
}

export async function deactivateEasebuzzPaymentLink(args: {
  merchantTxn: string;
  name: string;
  email: string;
  phone: string;
  amount: number;
  message: string;
  udf1?: string;
  udf2?: string;
}): Promise<boolean> {
  const key = envTrim("EASEBUZZ_KEY");
  const salt = envTrim("EASEBUZZ_SALT");
  if (!key || !salt || !args.merchantTxn) return false;
  const amountStr = scaleAmount(args.amount);
  const udf1 = n(args.udf1);
  const udf2 = n(args.udf2);
  const name = n(args.name) || "Customer";
  const email = n(args.email) || "noreply@hubinterior.com";
  const phone = normalizePhone(args.phone);
  const message = n(args.message);
  const hash = sha512(
    [key, args.merchantTxn, name, email, phone, amountStr, udf1, udf2, "", "", "", message, salt].join("|"),
  );
  const payload: Record<string, unknown> = {
    key,
    merchant_txn: args.merchantTxn,
    name,
    email,
    phone,
    amount: amountStr,
    message,
    update: true,
    active: false,
    hash,
  };
  if (udf1) payload.udf1 = udf1;
  if (udf2) payload.udf2 = udf2;
  try {
    const res = await fetch(createUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const root = parseJson(await res.text());
    return isApiSuccess(root);
  } catch {
    return false;
  }
}

export async function retrieveEasebuzzTxn(merchantTxn: string): Promise<EasebuzzRetrieveResult> {
  const key = envTrim("EASEBUZZ_KEY");
  const salt = envTrim("EASEBUZZ_SALT");
  const txn = merchantTxn.trim();
  const empty: EasebuzzRetrieveResult = {
    success: false,
    failure: false,
    status: "",
    paymentId: "",
    mode: "",
    amount: null,
    raw: "not configured",
  };
  if (!key || !salt || !txn) return empty;
  const hash = sha512(`${key}|${txn}|${salt}`);
  try {
    const res = await fetch(retrieveUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ key, txnid: txn, hash }),
    });
    const raw = await res.text();
    const data = parseDataNode(parseJson(raw));
    const status = pickText(data, "status", "txn_status");
    const paymentId = pickText(data, "easepayid", "easebuzz_id", "txnid");
    const mode = pickText(data, "mode", "payment_source", "card_type");
    const amountRaw = pickText(data, "amount", "net_amount_debit");
    const amount = amountRaw && Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : null;
    return {
      success: isGatewaySuccess(status),
      failure: isGatewayFailure(status),
      status,
      paymentId,
      mode,
      amount,
      raw,
    };
  } catch (err) {
    return {
      ...empty,
      raw: err instanceof Error ? err.message : "retrieve failed",
    };
  }
}
