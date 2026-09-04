# Design Module — Easebuzz Auto-Finance API Spec

**Scope:** CRM Booking & Token convert/sync only. Manual Sales Closure form, DQC1 10%, and refund flows are unchanged.

---

## BUFFER_9_9 auto-approve rule

Easebuzz verified **≥9.9%** uses the **same auto path as FULL_10**:

| Outcome | FULL_10 | BUFFER_9_9 |
|---------|---------|------------|
| `financeHandlingMode` | `AUTO_APPROVED` | `AUTO_APPROVED` |
| `projectStage` after convert | `10-20%` | `10-20%` |
| `approvedBy` | `SYSTEM · Easebuzz` | `SYSTEM · Easebuzz` |
| Finance UI section | `AUTO_APPROVED` (read-only) | `AUTO_APPROVED` (read-only) |
| Manual approve/reject | Not allowed | Not allowed |
| Shortfall tracking | None | **Yes** — `shortfallRecorded`, `remainingAmount`, `bufferApplied: true` |

---

## Inbound APIs (CRM → Design)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/hub/crm-lead/convert-booking` | Primary convert + 10% sync |
| `POST /api/hub/booking-token/finance-10p-sync` | Alias (same handler) |

Auth: `x-api-key: {EXTERNAL_LEAD_INGEST_API_KEY}`

---

## Auto vs manual decision

- **AUTO_APPROVED:** All `paymentHistory[]` entries are Easebuzz gateway-verified (`gatewayVerified`, `easebuzzTxnId`, etc.)
- **MANUAL_QUEUE:** Offline proofs, mixed manual, or unverified payments

---

## Success response fields

```json
{
  "ok": true,
  "financeHandlingMode": "AUTO_APPROVED",
  "financeSection": "AUTO_APPROVED",
  "financeSyncMode": "FULL_10",
  "projectStage": "10-20%",
  "financeCcNotified": true,
  "approvedBy": "SYSTEM · Easebuzz",
  "bufferApplied": false,
  "shortfallRecorded": 0,
  "actions": ["VIEW"]
}
```

Manual path:

```json
{
  "financeHandlingMode": "MANUAL_QUEUE",
  "financeSection": "MANUAL_QUEUE",
  "projectStage": "Pre 10%",
  "approvedBy": null,
  "actions": ["VIEW_PROOFS", "APPROVE", "REJECT"]
}
```

---

## Finance UI APIs

| Endpoint | Section |
|----------|---------|
| `GET /api/sales-closure/finance-10p-queue?section=MANUAL_QUEUE` | Pending manual CRM rows |
| `GET /api/sales-closure/finance-10p-queue?section=AUTO_APPROVED` | Easebuzz auto-approved (read-only) |

Manual approve/reject: `POST /api/leads/:id/approve-10p-payment` / `reject-10p-payment` — blocked for auto-approved rows.

---

## Storage (existing tables only)

### `lead_hub_booking_sync.payment_payload` (JSON)

| Field | Purpose |
|-------|---------|
| `financeHandlingMode` | `AUTO_APPROVED` / `MANUAL_QUEUE` |
| `financeSection` | Finance UI section |
| `financeSyncMode` | `FULL_10` / `BUFFER_9_9` |
| `financeSyncIdempotentKey` | `{bookingTokenRecordId}:{paymentHistoryId}` |
| `financeCcNotified` | CC sent on auto path |
| `shortfallRecorded` | Buffer shortfall ₹ |

### `leads.payload` (JSON)

| Field | Purpose |
|-------|---------|
| `crm_finance_handling_mode` | `AUTO_APPROVED` / `MANUAL_QUEUE` |
| `crm_finance_section` | Same as section |
| `crm_booking_finance_auto_approved` | `true` on Easebuzz auto |
| `crm_booking_finance_approved_by` | `SYSTEM · Easebuzz` or finance user |
| `crm_finance_cc_notified` | CC flag |
| `crm_booking_finance_approved` | Finance approved |
| `crm_booking_finance_approved_at` | Timestamp |

### `leads.project_stage`

`Pre 10%` (manual) or `10-20%` (auto-approved)

---

## Non-goals (unchanged)

- Manual Sales Closure form
- Design DQC1 `/finance` queue
- Refund sync and approval
- `POST /api/hub/crm-lead/upsert`
