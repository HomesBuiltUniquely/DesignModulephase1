# CRM Quote Integration — Pre-10 selected version only

Copy this into the CRM module. Designers now pick **one** quotation version with **Select for CRM**. CRM must show that version only. Do not list, link, or fetch other Design Module revisions.

## Auth

Every CRM quote call needs the shared ingest key:

- Header: `x-external-api-key: <EXTERNAL_LEAD_INGEST_API_KEY>`
- or `Authorization: Bearer <EXTERNAL_LEAD_INGEST_API_KEY>`

Base URL (prod): `https://api.hubinterior.com`

## 1) Resolve the CRM quote for a lead

**GET** `/api/crm/quotes/internal-link/:externalLeadId`

Alias: `/api/new-crm/quotes/internal-link/by-lead/:externalLeadId`

`externalLeadId` is CRM pid / Hub `leads.pid` / `payload.externalReferenceId`.

### Not selected yet (HTTP 200)

```json
{
  "ok": true,
  "selectedForCrm": false,
  "externalLeadId": "CRM-1234",
  "leadId": 36,
  "quoteId": null,
  "crmSharedQuoteId": null,
  "crmSharedVersionNumber": null,
  "internalQuoteUrl": null,
  "customerQuoteUrl": null,
  "message": "Designer has not selected a quote version for CRM yet"
}
```

CRM UI: show waiting copy. **Do not** fall back to the latest quote.

### Selected (HTTP 200)

```json
{
  "ok": true,
  "selectedForCrm": true,
  "externalLeadId": "CRM-1234",
  "leadId": 36,
  "quoteId": 67558,
  "crmSharedQuoteId": 67558,
  "crmSharedVersionNumber": 2,
  "internalQuoteUrl": "https://app.hubinterior.com/quote/67558?internal=1&leadId=36&audience=crm",
  "customerQuoteUrl": "https://app.hubinterior.com/quote/67558"
}
```

Use **only** `internalQuoteUrl` as returned. It includes `audience=crm` so Hub hides other versions. Do not build `/quote/:id?internal=1` yourself from a random quote id.

## 2) Fetch the selected quote payload (no other versions)

**GET** `/api/crm/quotes/selected/:externalLeadId`

Returns `rawSnapshot`, discount, and the same `links.internalQuoteUrl`.

HTTP 404 if nothing is selected:

```json
{
  "ok": false,
  "selectedForCrm": false,
  "message": "Designer has not selected a quote version for CRM yet"
}
```

**GET** `/api/crm/leads/:leadId/quotes/:quoteId` — same payload, but **404** if `:quoteId` is not the selected CRM version.

## 3) CRM implementation rules

1. Call `GET /api/crm/quotes/internal-link/:externalLeadId` (or `/selected`) when sales opens quotation.
2. If `selectedForCrm !== true`, show: *Waiting for designer to select a quote version for CRM.* Stop. Do not scrape Design Module revision history.
3. If selected, open `internalQuoteUrl` **or** render `rawSnapshot` from `/selected`. Never request other quote ids.
4. Keep `quoteId` / `crmSharedVersionNumber` only as cache of the **selected** version. Refresh from Hub; the designer can change the selection.
5. Pre-10 quotes have **no customer share**. Do not send `customerQuoteUrl` to the client until the lead is post-10% and a customer version is shared.

## Node example

```js
async function getCrmQuote(externalLeadId) {
  const res = await fetch(
    `https://api.hubinterior.com/api/crm/quotes/internal-link/${encodeURIComponent(externalLeadId)}`,
    { headers: { "x-external-api-key": process.env.EXTERNAL_LEAD_INGEST_API_KEY } },
  );
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message || `Hub quote link failed (${res.status})`);
  if (!body.selectedForCrm) {
    return { ready: false, message: body.message };
  }
  return {
    ready: true,
    leadId: body.leadId,
    quoteId: body.quoteId,
    versionNumber: body.crmSharedVersionNumber,
    openUrl: body.internalQuoteUrl,
  };
}
```

## Errors

- `400` — missing/invalid id
- `401` — bad API key
- `404` — lead not found, or this quote id is not the CRM-selected version
- `503` — Hub key not configured
- `500` — server error
