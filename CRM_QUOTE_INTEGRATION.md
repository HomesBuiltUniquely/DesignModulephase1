# CRM Quote Link Integration Guide

This guide explains how the CRM can fetch quote links from Hub using `externalLeadId`.

## API endpoint

- **Method:** `GET`
- **URL:** `/api/crm/quotes/internal-link/:externalLeadId`
- **Example:** `https://api.hubinterior.com/api/crm/quotes/internal-link/CRM-1234`

## Authentication

Use either:

- `x-external-api-key: <EXTERNAL_LEAD_INGEST_API_KEY>`
- or `Authorization: Bearer <EXTERNAL_LEAD_INGEST_API_KEY>`

The key must match Hub backend env var:

- `EXTERNAL_LEAD_INGEST_API_KEY`

## What the API does

Given `externalLeadId`, Hub:

1. Finds the lead by:
   - `leads.pid = externalLeadId`, or
   - `payload.externalReferenceId = externalLeadId`
2. Resolves `quoteId` by:
   - `leads.prolance_quote_id` first
   - fallback to latest snapshot in `lead_prolance_quote_snapshots`
3. Returns internal + customer quote links.

## Success response

```json
{
  "ok": true,
  "externalLeadId": "CRM-1234",
  "leadId": 36,
  "quoteId": 67558,
  "internalQuoteUrl": "https://app.hubinterior.com/quote/67558?internal=1&leadId=36",
  "customerQuoteUrl": "https://app.hubinterior.com/quote/67558"
}
```

## Error responses

- `400` - missing/invalid `externalLeadId`
- `401` - invalid API key
- `404` - lead not found or no quote exists yet
- `503` - Hub external API key not configured
- `500` - unexpected server error

## CRM implementation steps

1. Store `externalLeadId` for each CRM lead.
2. Call this endpoint when sales opens quote actions in CRM.
3. Use:
   - `internalQuoteUrl` for internal team access/edit flow.
   - `customerQuoteUrl` to share with customer.
4. Cache `quoteId` in CRM if needed for faster future lookups.

## Node.js example (CRM backend)

```js
async function getHubQuoteLinks(externalLeadId) {
  const res = await fetch(
    `https://api.hubinterior.com/api/crm/quotes/internal-link/${encodeURIComponent(externalLeadId)}`,
    {
      method: "GET",
      headers: {
        "x-external-api-key": process.env.EXTERNAL_LEAD_INGEST_API_KEY,
      },
    }
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.message || `Hub quote link fetch failed (${res.status})`);
  }
  return body;
}
```

## Postman quick test

1. Method: `GET`
2. URL: `https://api.hubinterior.com/api/crm/quotes/internal-link/<externalLeadId>`
3. Header: `x-external-api-key: <your-key>`
4. Send and verify `internalQuoteUrl` + `customerQuoteUrl` in response.

