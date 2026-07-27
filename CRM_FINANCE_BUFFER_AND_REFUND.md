# CRM → Design Module: Buffer Convert + Refund Sync

**For:** CRM / Hub team  
**Design Module host:** deploy Design backend + frontend first; then wire CRM calls below.  
**Auth:** same shared key as existing Booking & Token sync

```http
x-api-key: {EXTERNAL_LEAD_INGEST_API_KEY}
# also accepted: x-external-api-key  OR  Authorization: Bearer {key}
Content-Type: application/json
```

Base URL example (prod): `https://{design-backend-host}`  
Local: `http://localhost:3001`

---

## What Design Module already hosts (no CRM change needed for UI)

| Design route | Who uses it |
|--------------|-------------|
| `/finance/sales-closure` | Finance — approve CRM convert (10%) |
| `/finance/refunds` | Finance — **Pending approval** / **Approved history** for refunds |
| Top nav **Refunds** badge | Pending refund count |

CRM only needs to **call the Hub sync APIs** below. Finance approves inside Design.

---

## 1. Convert to Booking — allow 9.9% buffer

### Endpoints (same handler — either works)

```http
POST /api/hub/crm-lead/convert-booking
POST /api/hub/booking-token/finance-10p-sync
```

### Modes Design accepts

| `bookingApprovalMode` | Meaning |
|-----------------------|---------|
| `FULL_10` | Customer paid full 10% (or more; extra tracked separately) |
| `BUFFER_9_9` | Customer paid ≥ **9.9%** of quote; shortfall still due toward 10% |

If `bookingApprovalMode` is omitted, Design **infers** from amounts vs 9.9% / 10% thresholds.

### Required / recommended body fields

```json
{
  "bookingTokenRecordId": "uuid-or-hub-record-id",
  "leadType": "addlead",
  "leadId": 1860,
  "leadIdentifier": "AL-XXXX",
  "customerName": "Customer Name",
  "quoteAmount": 1000000,
  "tenPercentAmount": 100000,
  "bufferThresholdAmount": 99000,
  "bookingApprovalMode": "BUFFER_9_9",
  "amountReceived": 99000,
  "extraAmountReceived": 0,
  "totalAmountReceived": 99000,
  "remainingAmount": 1000,
  "shortfallAmount": 1000,
  "financeBufferNote": "Booking allowed from 9.9% buffer. ₹1,000 still due toward 10%.",
  "bufferApplied": true,
  "paymentHistory": [
    {
      "id": "pay-1",
      "sequence": 1,
      "amount": 99000,
      "extraAmount": 0,
      "proofs": [
        {
          "id": "proof-1",
          "originalFileName": "receipt.pdf",
          "url": "https://hub-host/.../proof"
        }
      ]
    }
  ],
  "hubProofBaseUrl": "https://hub-host"
}
```

### Rules CRM must follow

1. **Do not block Convert** only because “full 10% not received” if paid ≥ 9.9% and mode is `BUFFER_9_9`.
2. Always send **`bookingTokenRecordId`** (idempotency + finance review callback).
3. Send **`paymentHistory[]`** with proof URLs Design can open.
4. **Shortfall is not a refund** later — only money actually paid is refundable.
5. On success Design puts the lead in **Sales Closure** finance queue for Finance approve/reject (existing flow).

### Success response

```json
{
  "ok": true,
  "designLeadId": 2301,
  "bookingTokenRecordId": "..."
}
```

### Error responses

| Status | Body | Meaning |
|--------|------|---------|
| `400` | `{ "ok": false, "message": "..." }` | Validation (e.g. below 9.9% threshold) |
| `503` | `{ "ok": false, "message": "Database connection lost..." }` | Retry after a few seconds |
| `401` | — | Bad / missing API key |

---

## 2. Cancellation refund — queue for Finance (PENDING)

When CRM Manager **approves cancel** and money must be refunded, Hub/CRM must sync to Design.

### Endpoints (same handler — prefer primary)

```http
POST /api/hub/booking-token/finance-refund-sync
POST /api/hub/crm-lead/refund-booking
```

Use the second path only if the first returns `404`.

### Important behaviour change

| Step | Who | What happens |
|------|-----|----------------|
| 1 | CRM/Hub | Calls refund sync → Design stores refund as **`PENDING`** |
| 2 | Finance (Design UI `/finance/refunds`) | Clicks **Approve** → status **`APPROVED`**, ledger reversal applied |
| 3 | CRM | Treat sync success as “queued for Finance”, **not** “refund finalized” |

Design does **not** wipe 10% milestones until Finance approves.

### Body — full deal cancel (`refundScope: "deal"`)

```json
{
  "bookingTokenRecordId": "uuid-or-hub-record-id",
  "leadType": "addlead",
  "leadId": 1860,
  "leadIdentifier": "AL-XXXX",
  "customerName": "Customer Name",
  "refundScope": "deal",
  "refundAmount": 99000,
  "amountTowardTenRefund": 99000,
  "extraAmountRefund": 0,
  "amountReceived": 99000,
  "extraAmountReceived": 0,
  "totalAmountReceived": 99000,
  "cancellationReason": "Customer cancelled",
  "cancelledAt": "2026-07-25T10:00:00.000Z",
  "cancellationApprovedAt": "2026-07-25T11:00:00.000Z",
  "cancellationApprovedBy": "Manager Name",
  "bookingApprovalMode": "BUFFER_9_9",
  "bufferApplied": true,
  "paymentHistory": [
    {
      "id": "pay-1",
      "amount": 99000,
      "extraAmount": 0,
      "proofs": []
    }
  ]
}
```

### Body — partial payment cancel (`refundScope: "payments"`)

```json
{
  "bookingTokenRecordId": "uuid-or-hub-record-id",
  "leadType": "addlead",
  "leadId": 1860,
  "leadIdentifier": "AL-XXXX",
  "customerName": "Customer Name",
  "refundScope": "payments",
  "cancelledPaymentEntryIds": ["pay-2"],
  "refundAmount": 20000,
  "amountTowardTenRefund": 20000,
  "extraAmountRefund": 0,
  "cancellationReason": "Partial payment reverse",
  "cancellationApprovedBy": "Manager Name",
  "paymentHistory": [
    { "id": "pay-1", "amount": 50000, "extraAmount": 0 },
    { "id": "pay-2", "amount": 20000, "extraAmount": 0 }
  ]
}
```

For `payments` scope:

- `cancelledPaymentEntryIds` is **required**
- Those IDs must exist in `paymentHistory[]`
- Only selected payments are refunded; Design keeps remaining paid toward 10% after Finance approve

### Optional fields

| Field | Notes |
|-------|--------|
| `refundId` | Custom id; otherwise Design generates `ref-{bookingToken…}-{scope}` |
| `eventType` | Free text; stored in history (e.g. `refund_processed`) |

### Success response

```json
{
  "ok": true,
  "refundId": "ref-xxxxxxxx-deal",
  "refundAmount": 99000,
  "designLeadId": 2301,
  "bookingTokenRecordId": "..."
}
```

Idempotent: same `bookingTokenRecordId` + `refundScope` already synced → returns same `refundId` (no duplicate row).

### Error responses

| Status | Body | Meaning |
|--------|------|---------|
| `400` | `{ "message": "..." }` | e.g. missing token, no payments, lead not found |
| `503` | `{ "ok": false, "message": "..." }` | Retry |
| `401` | — | Bad API key |

---

## 3. What CRM should **not** expect from Design yet

- Design does **not** call Hub back when Finance **approves a refund** (only convert approve/reject still uses Hub `finance-review`).
- If CRM UI must show “Finance refund approved”, either:
  - poll / wait for a future Design → Hub webhook, or
  - treat CRM cancel-approved as “refund requested” and keep refund status internal until you add a callback.

**Existing (unchanged) Hub callback for convert finance only:**

```http
POST {HUB_API_BASE_URL}/api/crm/booking-token/internal/finance-review
x-api-key: {shared-key}

{
  "bookingTokenRecordId": "...",
  "paymentHistoryId": "...",
  "status": "APPROVED" | "REJECTED",
  "reviewedBy": "Finance User",
  "reason": null
}
```

---

## 4. CRM checklist before go-live

### Convert / buffer

- [ ] Remove hard gate “must receive full 10%” when buffer path is allowed
- [ ] Send `bookingApprovalMode: "BUFFER_9_9"` (or reliable amounts so Design can infer)
- [ ] Send `remainingAmount` / `shortfallAmount` when buffer applies
- [ ] Keep `FULL_10` path for full payment converts
- [ ] Confirm Design Sales Closure shows the lead after convert

### Refund

- [ ] On Manager Approve Cancel → call `POST /api/hub/booking-token/finance-refund-sync`
- [ ] Fallback to `POST /api/hub/crm-lead/refund-booking` on 404
- [ ] Send `bookingTokenRecordId` + lead identifiers + amounts + `paymentHistory`
- [ ] Use `refundScope: "deal"` for full cancel, `"payments"` + `cancelledPaymentEntryIds` for partial
- [ ] UI copy: “Refund sent to Design Finance” / “Pending Finance approval” — **not** “Refund completed”
- [ ] Confirm Design `/finance/refunds` → **Pending approval** shows the row
- [ ] After Finance Approve in Design → row moves to **Approved history**

### Env (CRM / Hub)

```env
DESIGN_MODULE_BASE_URL=https://{design-backend-host}
# Hub Java often: design.module.base-url=...
# API key must match Design EXTERNAL_LEAD_INGEST_API_KEY / HUB_SYNC_API_KEY
```

---

## 5. Quick curl examples

**Buffer convert**

```bash
curl -sS -X POST "$DESIGN_MODULE_BASE_URL/api/hub/crm-lead/convert-booking" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $HUB_SYNC_API_KEY" \
  -d '{
    "bookingTokenRecordId": "test-token-1",
    "leadType": "addlead",
    "leadId": 1860,
    "leadIdentifier": "AL-TEST",
    "customerName": "Test Customer",
    "quoteAmount": 1000000,
    "tenPercentAmount": 100000,
    "bufferThresholdAmount": 99000,
    "bookingApprovalMode": "BUFFER_9_9",
    "amountReceived": 99000,
    "totalAmountReceived": 99000,
    "remainingAmount": 1000,
    "paymentHistory": [{ "id": "pay-1", "amount": 99000, "extraAmount": 0, "proofs": [] }]
  }'
```

**Refund queue**

```bash
curl -sS -X POST "$DESIGN_MODULE_BASE_URL/api/hub/booking-token/finance-refund-sync" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $HUB_SYNC_API_KEY" \
  -d '{
    "bookingTokenRecordId": "test-token-1",
    "leadType": "addlead",
    "leadId": 1860,
    "leadIdentifier": "AL-TEST",
    "customerName": "Test Customer",
    "refundScope": "deal",
    "refundAmount": 99000,
    "amountTowardTenRefund": 99000,
    "extraAmountRefund": 0,
    "cancellationReason": "Customer cancelled",
    "cancellationApprovedBy": "CRM Manager",
    "paymentHistory": [{ "id": "pay-1", "amount": 99000, "extraAmount": 0 }]
  }'
```

---

## 6. Related Design docs

- Full Booking & Token overview: `CRM_BOOKING_TOKEN_INTEGRATION.md`
- Design finance UI: `/finance`, `/finance/sales-closure`, `/finance/refunds`
