# CRM Booking & Token → Design Module Integration

**Repo:** `DesignModulephase1`  
**Status:** Implemented on `main`  
**Related systems:** CRM frontend (3000), Hub / Project-ERP (8081), Design backend (3001), Design frontend (3002)

---

## 1. Goal

Support a **second path** into Design Module for leads from **CRM Booking & Token**, without breaking the manual **Sales Closure form** flow.

| Step | Manual path (unchanged) | CRM path (implemented) |
|------|-------------------------|-------------------------|
| Meeting scheduled | Sales Closure form in Design | Auto: lead at **Pre 10%** via Hub upsert |
| Pay 10% + proofs | Form + finance upload | CRM Token tab only (Hub stores proofs) |
| Convert to Booking | Form resubmit | Auto: **Sales Closure finance queue** with payment history |
| Finance approve | `approve-sales-closure` | `approve-10p-payment` + Hub webhook → CRM Finance Approved |

---

## 2. End-to-end flow

```text
CRM: Meeting Scheduled
  └─► POST /api/hub/crm-lead/upsert          (Design backend, x-api-key)
        └─► Lead in Design at Pre 10%

CRM: Pay 10% + upload proofs (Token tab)
  └─► Stored in Hub only — NO finance handoff yet

CRM: Convert to Booking
  └─► Hub convert API
  └─► POST /api/hub/crm-lead/convert-booking (Design backend)
        └─► lead_hub_booking_sync row
        └─► task: "10% payment collection" complete
        └─► Appears in Sales Closure Finance queue (/finance/sales-closure)

Design: Finance Approve / Reject (Sales Closure UI)
  └─► POST /api/leads/:id/approve-10p-payment  (CRM rows)
  └─► POST /api/leads/:id/reject-10p-payment   (CRM rows)
        └─► Hub callback: POST {HUB}/api/crm/booking-token/internal/finance-review
              └─► CRM deal shows Finance Approved / Rejected
        └─► Lead moves to 10–20% on approve
```

**Callers (already built in CRM / Hub — Design only receives):**

| System | Env | Calls Design |
|--------|-----|--------------|
| CRM Next BFF | `DESIGN_MODULE_BASE_URL=http://localhost:3001` | Proxies to `/api/hub/crm-lead/*` |
| Hub Java | `design.module.base-url=http://localhost:3001` | Same paths on Convert |

Shared header: `x-api-key: {EXTERNAL_LEAD_INGEST_API_KEY}` (also accepts `x-external-api-key` or `Authorization: Bearer`).

---

## 3. Local ports & environment

| Service | Port | Notes |
|---------|------|-------|
| CRM frontend | **3000** | `DESIGN_MODULE_BASE_URL=http://localhost:3001` |
| Design backend | **3001** | See `.env` below |
| Design frontend | **3002** | `NEXT_PUBLIC_API_URL=http://localhost:3001` |
| Hub backend | **8081** | `DESIGN_MODULE_BASE_URL=http://localhost:3001` |

**Design backend `.env`:**

```env
EXTERNAL_LEAD_INGEST_API_KEY=hi
HUB_SYNC_API_KEY=hi
HUB_API_BASE_URL=http://localhost:8081
FRONTEND_BASE_URL=http://localhost:3002
```

Use the **same API key** on CRM, Hub, and Design. Default dev fallback in code is `hi` when env vars are empty.

CORS allows `http://localhost:3002` and `http://127.0.0.1:3002` for the Design frontend.

---

## 4. Backend implementation

### 4.1 File structure

```text
backend/routes/crmHubBookingRoutes.ts   ← Hub sync + finance queue APIs (~950 lines)
backend/server.ts                       ← register routes + approve/reject Hub callback
backend/.env.example                    ← HUB_* and EXTERNAL_LEAD_INGEST_API_KEY
```

Registered in `server.ts`:

```typescript
import { registerCrmHubBookingRoutes, notifyHubFinanceReview, ... } from "./routes/crmHubBookingRoutes";

registerCrmHubBookingRoutes(app, { pool, getUserFromSession, addLeadHistoryEvent });
```

Also wired in `server.ts`:

- `POST /api/leads/:id/approve-10p-payment` — sets `project_stage = '10-20%'`, approves `hub_payment_proof` uploads, calls Hub `finance-review` when `lead_hub_booking_sync` exists
- `POST /api/leads/:id/reject-10p-payment` — rejects proofs, calls Hub `finance-review` with `REJECTED`

### 4.2 Database table

Created on startup (idempotent):

```sql
CREATE TABLE IF NOT EXISTS lead_hub_booking_sync (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT NOT NULL,
  booking_token_record_id VARCHAR(64) NOT NULL,
  payment_history_id VARCHAR(36) NULL,
  crm_lead_type VARCHAR(32) NOT NULL,
  crm_lead_id BIGINT NOT NULL,
  amount_received DECIMAL(14,2) NULL,
  ten_percent_amount DECIMAL(14,2) NULL,
  payment_payload MEDIUMTEXT NULL,
  synced_at DATETIME NOT NULL,
  UNIQUE KEY uq_booking_token (booking_token_record_id),
  KEY idx_lead (lead_id)
);
```

`payment_payload` stores the full JSON from Hub/CRM (`paymentHistory[]`, proofs, amounts).

### 4.3 Hub APIs (API key auth)

#### `POST /api/hub/crm-lead/upsert`

**When:** CRM meeting scheduled (Pre 10% intake).

**Body (minimum):**

```json
{
  "leadType": "addlead",
  "leadId": 1860,
  "leadIdentifier": "AL-GWRJW0YBRT",
  "projectName": "Customer Name",
  "contactNo": "9876543210",
  "clientEmail": "a@b.com",
  "designerName": "Designer Name",
  "appointmentDate": "2026-06-30",
  "appointmentSlot": "6:00 PM - 8:00 PM"
}
```

**Lead payload convention** (`leads.payload`):

```json
{
  "source": "crm_hub",
  "intakePath": "crm_booking_token",
  "crmLeadType": "addlead",
  "crmLeadId": 1860,
  "fetchedData": {
    "externalReferenceId": "AL-GWRJW0YBRT",
    "customer_name": "...",
    "co_no": "...",
    "email": "..."
  }
}
```

**Response:** `{ "ok": true, "designLeadId": 2301, "created": true|false }`

Idempotent: matches existing lead before insert (see §6).

---

#### `POST /api/hub/crm-lead/convert-booking`  
#### `POST /api/hub/booking-token/finance-10p-sync`

Same handler (alias).

**When:** CRM **Convert to Booking** (full 10% paid).

**Body (required):** `bookingTokenRecordId`, `leadType`, `leadId`, `leadIdentifier`, `paymentHistory[]`, `hubProofBaseUrl`, amounts, etc.

**On success:**

1. Resolve/create Design lead (no duplicate if match exists).
2. Upsert `lead_hub_booking_sync`.
3. Replace `lead_uploads` with `upload_type = 'hub_payment_proof'` (Hub URLs).
4. Mark **10% payment collection** complete; clear prior **10% payment approval**.
5. Activity history: `hub_payment_sync`.

**Response:** `{ "ok": true, "designLeadId": 2301, "bookingTokenRecordId": "..." }`

---

### 4.4 Finance queue APIs

#### Primary UI: Sales Closure queue

**`GET /api/leads/finance-sales-closure-queue?status=pending|approved`**

Existing manual Sales Closure rows **plus** CRM hub rows merged in.

CRM rows include:

- `paymentSource: "crm_hub"`
- `submittedAt` from `lead_hub_booking_sync.synced_at` (CRM date)
- `paymentSubmissions[]` built from `paymentHistory[]`
- `crmRef`, `bookingTokenRecordId`

**`GET /api/leads/finance-sales-closure/:leadId`**

Returns CRM payment detail when `lead_hub_booking_sync` exists; otherwise manual Sales Closure detail.

#### Alternate / dedicated CRM queue API

**`GET /api/sales-closure/finance-queue?tab=pending|approved`**

Session auth (finance/admin). Used by optional page `/SalesClosure/Finance`.

**`GET /api/sales-closure/finance-queue/:leadId/payment-history`**

Parsed `paymentHistory[]` with proof URLs.

#### Manual DQC1 queue (CRM excluded)

**`GET /api/leads/finance-10p-queue`**

Manual path only (DQC 1 approval → 10% upload). **CRM leads do not appear here.**

---

### 4.5 Hub finance-review callback

On approve/reject for leads with `lead_hub_booking_sync`:

```http
POST {HUB_API_BASE_URL}/api/crm/booking-token/internal/finance-review
Content-Type: application/json
x-api-key: {EXTERNAL_LEAD_INGEST_API_KEY}

{
  "bookingTokenRecordId": "...",
  "paymentHistoryId": "...",
  "status": "APPROVED",
  "reviewedBy": "Finance User",
  "reason": null
}
```

---

## 5. Frontend

| Route | Purpose | API |
|-------|---------|-----|
| **`/finance/sales-closure`** | **CRM + manual Sales Closure finance queue** | `finance-sales-closure-queue` |
| `/finance` | Manual 10% Payment (DQC1 path) — **unchanged UI** | `finance-10p-queue` |
| `/SalesClosure/Finance` | Optional dedicated CRM queue UI | `sales-closure/finance-queue` |
| `/finance/40` | 40% payment | unchanged |

**CRM rows in Sales Closure UI:**

- **CRM** badge on customer name
- **Submitted** date from CRM sync
- **Approve** → `POST /api/leads/:id/approve-10p-payment`
- **Reject** → `POST /api/leads/:id/reject-10p-payment`
- **History** → payment installments + Hub proof links

**Login:** finance role → `/finance` (10% Payment page; link to Sales Closure in header).

---

## 6. Lead matching rules

Priority when resolving design lead from Hub body:

1. `payload.crmLeadType` + `payload.crmLeadId`
2. `payload.fetchedData.externalReferenceId` === `leadIdentifier` (or `pid`)
3. Fuzzy match on external ref containing `leadType#leadId`
4. `designLeadId` from body **only if** CRM refs match

Do **not** trust Prolance `hubLeadId` alone if it is not Design `leads.id`.

---

## 7. What was NOT changed

- `POST /api/sales-closure` — manual Sales Closure form
- Manual finance uploads (`payment_10p` on `/finance`)
- `POST /api/leads/:id/approve-sales-closure` — manual Sales Closure approve
- CRM / Hub Booking Token UI (other repos)

---

## 8. Testing checklist

- [ ] `POST /api/hub/crm-lead/upsert` → lead at **Pre 10%** in Design dashboard
- [ ] Upsert twice → same `designLeadId`, no duplicate
- [ ] Pay 10% in CRM Token tab → **not** in finance queue yet
- [ ] `POST /api/hub/crm-lead/convert-booking` → row in **`/finance/sales-closure`** pending tab with **CRM** badge and sync date
- [ ] History shows installments + proof links (Hub URLs)
- [ ] Approve → lead **10–20%**, CRM deal Finance Approved
- [ ] Reject → Hub webhook `REJECTED`
- [ ] Manual Sales Closure still works on same queue (manual rows without CRM badge)
- [ ] `/finance` still shows DQC1 manual leads only
- [ ] Wrong API key → 401

**Start servers:**

```bash
# Backend
cd backend && npm run dev          # → http://localhost:3001

# Frontend
cd my-app && npm run dev -- -p 3002   # → http://127.0.0.1:3002
```

**Manual retry (deal already converted in CRM):**

```http
POST http://localhost:3000/api/crm/design-module/crm-lead/convert-booking
Content-Type: application/json
Cookie: <crm session>

{ "recordId": "<booking-token-record-uuid>" }
```

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot POST /api/hub/crm-lead/convert-booking` | Old backend running | Restart Design backend on **3001** |
| Convert OK in CRM but no Sales Closure row | Design sync failed | Check backend log; retry convert-booking |
| 401 Invalid API key | Key mismatch | Same `EXTERNAL_LEAD_INGEST_API_KEY` on CRM, Hub, Design |
| Lead Pre 10% but not in finance | Convert never ran | Call convert-booking manually |
| CRM lead on `/finance` instead of Sales Closure | Wrong queue | CRM belongs on **`/finance/sales-closure`** |
| Login `Failed to fetch` | CORS / backend down | Backend on 3001; CORS includes port **3002** |
| Wrong lead linked | Bad matching | Match by `leadIdentifier` / `crmLeadType`+`crmLeadId` first |
| Payment screenshot broken / empty modal | Direct Hub URL or Hub rejects `x-api-key` on proof endpoint | Use Design proxy (§11); Hub must accept `x-api-key` on proof content route |

---

## 10. Implementation file list

```text
backend/routes/crmHubBookingRoutes.ts          NEW — Hub sync, queues, matching
backend/server.ts                              register routes, approve/reject + Hub callback
backend/.env.example                           HUB_API_BASE_URL, API keys
my-app/app/finance/sales-closure/page.tsx      CRM badge, approve/reject, proof proxy View
my-app/app/finance/page.tsx                    Manual 10% UI (unchanged)
my-app/app/SalesClosure/Finance/page.tsx       Optional alternate CRM queue UI
my-app/app/login/page.tsx                      Finance → /finance
CRM_BOOKING_TOKEN_INTEGRATION.md               This document
```

**Reference (caller side — CrmInceneration repo):**

- `my-app/lib/design-module-hub-sync.ts`
- `my-app/app/api/crm/design-module/crm-lead/upsert/route.ts`
- `my-app/app/api/crm/design-module/crm-lead/convert-booking/route.ts`

---

## 11. Payment proof screenshots (Sales Closure UI)

### Why `<img src="http://hub:8081/...">` breaks

CRM payment proofs live on **Hub** (e.g. `GET /v1/booking-token/deals/{recordId}/payment-proofs/{proofId}/content`).

That endpoint requires auth. The browser **cannot** send `x-api-key` (or `Authorization`) on an `<img>` tag, so direct Hub URLs return **401/403** → broken image in `/finance/sales-closure`.

### Design Module fix (implemented on Design side)

1. **Proxy API** — Design backend fetches from Hub with server-side credentials (Finance session required on proxy):
   ```
   GET /api/leads/:leadId/hub-payment-proofs/:uploadId/content
   ```
2. **Sales Closure UI** loads proof via this proxy (`fetch` + blob URL), not a direct Hub URL.

After backend restart, refresh `/finance/sales-closure` and click **View** again.

### CRM convert payload (already sent by `design-module-hub-sync.ts`)

| Field | Required | CRM status |
|-------|----------|------------|
| `hubProofBaseUrl` | Hub base URL Design backend can reach (e.g. `http://localhost:8081`) | Sent |
| `paymentHistory[].proofs[]` | Each proof: | Sent |
| → `id` | Proof UUID (stored in Design DB) | Sent |
| → `contentPath` | `/v1/booking-token/deals/{recordId}/payment-proofs/{proofId}/content` | Sent |
| → `originalFileName` | e.g. `receipt.jpg` | Sent |
| → `mimeType` | e.g. `image/jpeg` | Sent |

Shared env (CRM, Hub, Design):

```env
EXTERNAL_LEAD_INGEST_API_KEY=hi
HUB_API_BASE_URL=http://localhost:8081
```

### Hub auth (why View shows 401 until configured)

Design proxy tries `x-api-key` first, then `HUB_PROOF_BEARER_TOKEN` as `Authorization: Bearer …`.

**Today:** Hub proof download (`GET /v1/booking-token/deals/{recordId}/payment-proofs/{proofId}/content`) does **not** accept `x-api-key` alone. It expects the **CRM session token** (not a JWT):

```
token_{userId}_{timestamp}
```

Example: `token_1_1719491234567`

Until Hub accepts `x-api-key` on that route (Option B below), set the token in **Design backend only**.

#### Option A — `backend/.env` (Design Module, port 3001)

```env
HUB_API_BASE_URL=http://localhost:8081
EXTERNAL_LEAD_INGEST_API_KEY=hi
HUB_PROOF_BEARER_TOKEN=token_1_1719491234567
```

**Do not** put this in `my-app/.env` (frontend).

**How to get the token**

1. Log into **CRM** (`http://localhost:3000/login`) as **SUPER_ADMIN**, **ADMIN**, or **SALES_ADMIN** — not a sales executive.
2. DevTools → Application → Local Storage → `crm_token`  
   **or** Network → any Hub API call → copy the value after `Bearer ` (without the `Bearer ` prefix).

**Quick test before restarting Design backend:**

```bash
curl -H "Authorization: Bearer token_1_1719491234567" \
  "http://localhost:8081/v1/booking-token/deals/{recordId}/payment-proofs/{proofId}/content" \
  -o test.jpg
```

- **401/403** → wrong token or non-admin user  
- **200 + file** → set same token in `HUB_PROOF_BEARER_TOKEN`, restart backend, click **View** again

#### Option B — permanent fix (Hub team)

Hub should accept `x-api-key: hi` on  
`GET /v1/booking-token/deals/{recordId}/payment-proofs/{proofId}/content`  
(same key as finance webhook / Design sync). Then `HUB_PROOF_BEARER_TOKEN` is not needed.

Design proxy also tries the CRM API path variant (`/api/crm/booking-token/deals/...`) when the v1 URL fails.

### If still broken after restart

1. Re-run **Convert to Booking** in CRM, or click **Refresh proofs from CRM sync** in Sales Closure UI  
2. Check Design backend log for `[crm-hub] Hub proof fetch failed` — shows exact Hub URL  
3. If curl works but **View** still fails, share the new log line (may be missing proof row in Design DB)

---

## 12. Related docs

- `CRM_QUOTE_INTEGRATION.md` — Hub quote links by external lead ID (separate feature)
- `JAVA_CRM_MSG91_WHATSAPP_DIRECT.md` — MSG91 webhook (separate from Booking & Token)
