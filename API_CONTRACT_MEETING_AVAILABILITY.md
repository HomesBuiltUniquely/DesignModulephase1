# API Contract — Meeting Availability (Sales vs Designer)

**Audience:** Java CRM / Appointment backend  
**Consumer:** Design Module (Hub) + Sales Schedule Hub Meeting flow  

Hub rules (product):
- Window: **11:00–19:00**
- Default meeting length: **90 minutes**
- Overlap check against that designer’s appointments (+ leave/blocks if available)
- Only **active** designers
- Prefer return **`email`** with designer so booking does not depend only on Design Module name lookup

---

## A) Sales side (CRM / Schedule Hub Meeting)

Flow: sales picks **date + time first**, then sees **who is free**.

### A1. P0 — NEW — Available designers for a slot

```http
GET /v1/Appointment/available-designers
  ?date=2026-10-15
  &startTime=2026-10-15T15:00:00
  &endTime=2026-10-15T16:30:00
  &durationMinutes=90
  &meetingType=SHOWROOM_VISIT
```

**Response example:**
```json
{
  "date": "2026-10-15",
  "startTime": "2026-10-15T15:00:00",
  "endTime": "2026-10-15T16:30:00",
  "designers": [
    {
      "id": 12,
      "name": "Priya Sharma",
      "email": "priya@company.com",
      "available": true,
      "conflictCount": 0
    },
    {
      "id": 18,
      "name": "Rahul Mehta",
      "email": "rahul@company.com",
      "available": false,
      "conflictCount": 1,
      "conflictReason": "Overlaps existing meeting 14:30–16:00"
    }
  ]
}
```

### A2. P1 — NEW — Day overview for all designers

```http
GET /v1/Appointment/availability-by-date?date=2026-10-15
```

Each designer + free start times that day (or busy blocks).

### A3. Already expected for booking (keep)

| Method | Endpoint | Use |
|--------|----------|-----|
| POST | `/v1/Appointment` | Create meeting |
| PUT | `/v1/Appointment/{id}` | Reschedule |
| DELETE | `/v1/Appointment/{id}` | Cancel |
| GET | `/v1/Appointment/designer/{designerName}` | Designer day timeline |
| GET | `/v1/Appointment/available-slots?date=&designerName=` | Slots for **one** designer |
| GET | `/v1/Appointment/lead/{leadId}/upcoming` | Lead’s meetings |

---

## B) Designer side (own calendar)

Designer sees **their** schedule only (auth-scoped).

### B1. P1 — My appointments (day / range)

```http
GET /v1/Appointment/me?from=2026-10-15&to=2026-10-15
```

### B2. P2 — My free slots

```http
GET /v1/Appointment/me/available-slots?date=2026-10-15
```

### B3. P2 — Block / leave time

```http
POST /v1/Appointment/me/blocks
{
  "date": "2026-10-15",
  "startTime": "...",
  "endTime": "...",
  "reason": "Site visit / leave"
}
```

Sales `available-designers` must respect these blocks.

---

## Priority ask

| Priority | Side | Endpoint | Why |
|----------|------|----------|-----|
| **P0** | Sales | `GET /v1/Appointment/available-designers` | Date/time → free designer list |
| **P1** | Sales | `GET /v1/Appointment/availability-by-date` | Day picker UX |
| **P1** | Designer | `GET /v1/Appointment/me` | Designer calendar |
| **P2** | Designer | `GET /v1/Appointment/me/available-slots` | Designer free slots |
| **P2** | Designer | `POST /v1/Appointment/me/blocks` | Leave / busy blocks |

---

## One-line summary

- **Sales:** “Give me designers free for this date + 90-min slot.”  
- **Designer:** “Give me **my** appointments / free slots for this date (auth-scoped).”

---

## Status in **this** Design Module repo (audit)

Checked against Design Module proxies / usage of Java CRM `/v1/Appointment/*` (as of audit).  
`HAVE` = used or proxied from this repo.  
`MISSING` = not present here — must be built on **Java CRM Appointment API** (then we can proxy).

### Sales / shared Appointment APIs

| Endpoint | Status in this repo | Notes |
|----------|---------------------|--------|
| `POST /v1/Appointment` | **HAVE** | Proxied: `POST /api/appointment` (+ personal booking path) |
| `DELETE /v1/Appointment/{id}` | **HAVE** | Used for cancel (personal / leave sync) |
| `GET /v1/Appointment/designer/{designerName}` | **HAVE** | Proxied: `GET /api/appointment/designer/:designerName` |
| `GET /v1/Appointment/available-slots?date&designerName` | **HAVE** | Proxied: `GET /api/appointment/available-slots` (+ full-day leave overlay) |
| `PUT /v1/Appointment/{id}` | **NOT SEEN** | Listed as existing for CRM; **no Design Module proxy/usage found** — confirm with Java CRM |
| `GET /v1/Appointment/lead/{leadId}/upcoming` | **MISSING** | Not used / not proxied here |
| `GET /v1/Appointment/available-designers` (**P0**) | **HAVE (Design Module)** | Implemented as `GET /api/appointment/available-designers` — rich objects + accurate local date; ERP conflicts + full-day leave. Java CRM `/v1/...` path still optional native mirror. |
| `GET /v1/Appointment/availability-by-date` (**P1**) | **HAVE (Design Module)** | `GET /api/appointment/availability-by-date?date=` |

### Designer-scoped APIs

| Endpoint | Status in this repo | Notes |
|----------|---------------------|--------|
| `GET /v1/Appointment/me` (**P1**) | **HAVE (Design Module)** | `GET /api/appointment/me?from=&to=` (session = current designer) |
| `GET /v1/Appointment/me/available-slots` (**P2**) | **HAVE (Design Module)** | `GET /api/appointment/me/available-slots?date=` |
| `POST /v1/Appointment/me/blocks` (**P2**) | **HAVE (Design Module)** | `POST /api/appointment/me/blocks` (partial busy). Full-day leave: `POST /api/appointment/full-day` |

### Related (already in Design Module, not CRM contract)

- Full-day leave approve/reject/cancel  
- Personal appointment history / badge  
- Offline meeting export: `/v1/Appointment/offline-meeting-scheduled/...`

---

## Bottom line for backend (Java CRM)

| Need | Have today? |
|------|-------------|
| Book / cancel / one-designer slots / designer timeline | **Yes** (consumed by Design Module) |
| **Free designers for a chosen date+time (P0)** | **Yes** — `GET /api/appointment/available-designers` |
| Day overview all designers (P1) | **Yes** — `GET /api/appointment/availability-by-date` |
| Auth-scoped designer calendar `/me` (P1) | **Yes** — `GET /api/appointment/me` |
| Designer `/me/available-slots` + `/me/blocks` (P2) | **Yes** — Design Module paths below |

Java CRM native `/v1/Appointment/...` mirrors are optional; Design Module APIs above are ready for Sales + Designer UX.
