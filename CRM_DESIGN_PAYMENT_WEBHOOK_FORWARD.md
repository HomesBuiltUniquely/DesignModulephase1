# CRM backend — Design payment webhook forward

**For:** CRM / Easebuzz webhook owners  
**Design host:** Design Module backend (not the Next.js UI)  
**Why:** Easebuzz allows **one** Transaction Webhook URL. It stays on **CRM**. Design creates its own payment links (`merchant_txn` starts with `DES10` / `DES40`). CRM must **forward** those success/fail posts to Design. Do **not** apply Design money onto the CRM token deal.

Design does **not** poll Easebuzz every 15s. Real-time path = this forward.

---

## Do not change

- Easebuzz dashboard webhook URL (keep CRM: `POST /api/easebuzz/webhook`)
- CRM token 10% apply-paid for **non-DES** txns
- Convert / Token dashboard

---

## What CRM must add (small)

In the **existing** Easebuzz webhook handler, **after** you parse `merchant_txn` / `txnid` and `status`:

```text
txn = merchant_txn or txnid

if txn starts with DES10 or DES40 or DES_:
    FORWARD body to Design
    do NOT create CRM booking history
    do NOT update token deal
    return 200 to Easebuzz
else:
    existing CRM token flow
```

Prefix is enough. You do not need a Design DB lookup.

---

## Forward API (Design)

```http
POST {DESIGN_MODULE_BASE_URL}/api/crm/design-payment/easebuzz-webhook
Content-Type: application/json
x-api-key: {EXTERNAL_LEAD_INGEST_API_KEY}
```

Alias (same handler):

```http
POST {DESIGN_MODULE_BASE_URL}/api/hub/design-payment/easebuzz-webhook
```

`x-api-key` must match **any one** of Design `EXTERNAL_LEAD_INGEST_API_KEY`, `HUB_SYNC_API_KEY`, or `DESIGN_PAYMENT_WEBHOOK_KEY` (or local fallback `hi`).

### Body (pass through Easebuzz fields)

Minimum:

```json
{
  "merchant_txn": "DES10LXXXXYYYY",
  "txnid": "DES10LXXXXYYYY",
  "status": "success",
  "amount": "50000.00",
  "easepayid": "EBxxxx",
  "mode": "UPI"
}
```

Failure example:

```json
{
  "merchant_txn": "DES10LXXXXYYYY",
  "status": "failure",
  "error": "User cancelled",
  "error_Message": "User cancelled"
}
```

`status` values Design treats as:

| Easebuzz `status` | Design action |
|-------------------|---------------|
| `success`, `paid` | Auto-approve Design 10% or 40%, history, receipt email |
| `failure`, `failed`, `usercancelled`, `bounced`, `dropped`, `cancelled` | Keep link open, increment fail count, history note |
| pending / other | Ignore (link stays PENDING) |

Always return **200** to Easebuzz even if Design forward fails (log + retry). Easebuzz may pause the webhook on repeated 4xx.

---

## Suggested CRM code (Java)

```java
String txn = firstNonBlank(fields.get("merchant_txn"), fields.get("txnid"));
if (txn != null) {
    String u = txn.trim().toUpperCase();
    if (u.startsWith("DES10") || u.startsWith("DES40") || u.startsWith("DES_")) {
        // fire-and-forget HTTP POST to Design; do not applyPaid on CRM deal
        designPaymentForwardService.forwardEasebuzzWebhook(fields);
        return; // webhook already ACK'd
    }
}
// existing CRM applyPaid / failure count
```

Env on **CRM**:

```env
DESIGN_MODULE_BASE_URL=https://<design-backend-host>
EXTERNAL_LEAD_INGEST_API_KEY=<same key as Design>
```

CRM create-link is **not** required for Design. Design creates EasyCollect links itself with `EASEBUZZ_KEY` / `EASEBUZZ_SALT`.

---

## Responses from Design

| HTTP | Body | Meaning |
|------|------|---------|
| 200 `{ "ok": true, "result": "paid" }` | Apply done (or idempotent) |
| 200 `{ "ok": true, "result": "failure_recorded" }` | Fail counted |
| 200 `{ "ok": true, "ignored": true }` | Not a Design attempt / not final |
| 401 | Bad API key |
| 500 | Retry later |

Duplicate success (`same easepayid`) is **idempotent** — safe to retry.

---

## CRM test checklist

- [ ] CRM token pay still works (txn **not** `DES*`)
- [ ] Create Design 10% link in Design UI → `merchant_txn` like `DES10…`
- [ ] Pay on Easebuzz test → CRM webhook fires → Design history shows **PAID / auto-approved**
- [ ] Fail/cancel pay → Design banner shows failure count, link still copyable
- [ ] Second webhook retry does not double-count
- [ ] Design lead activity: link sent, copy, resend, fail, paid

---

## If CRM cannot forward yet

Design still has a **8-minute retrieve cron** as backup. UI is not 15s polling. Prefer webhook forward for instant Finance Auto + activity.
