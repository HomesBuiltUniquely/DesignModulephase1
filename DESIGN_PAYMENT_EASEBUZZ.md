# Design Module Easebuzz (no 15s poll)

**Links:** created in Design (`EASEBUZZ_KEY` / `EASEBUZZ_SALT`).  
**Webhook:** stays on **CRM**. CRM forwards `DES10*` / `DES40*` txns to Design.  
**CRM UI:** not used.

```text
Design creates link (DES10… / DES40…)
Customer pays
Easebuzz → CRM webhook
CRM: if DES* → POST Design /api/crm/design-payment/easebuzz-webhook
Design: auto-approve + activity history + receipt email
Backup: retrieve cron every 8 min
```

See **[CRM_DESIGN_PAYMENT_WEBHOOK_FORWARD.md](./CRM_DESIGN_PAYMENT_WEBHOOK_FORWARD.md)** for CRM backend work.

## Design `.env`

```env
EASEBUZZ_KEY=
EASEBUZZ_SALT=
EASEBUZZ_ENV=test
EXTERNAL_LEAD_INGEST_API_KEY=hi
DESIGN_PAYMENT_WEBHOOK_KEY=hi
```

## Activity history events

| Kind | When |
|------|------|
| `DESIGN_PAYMENT_LINK_SENT` | Email link created |
| `DESIGN_PAYMENT_LINK_COPIED` | Copy |
| `DESIGN_PAYMENT_LINK_RESENT` | Resend email |
| `DESIGN_PAYMENT_LINK_EDITED` | New amount |
| `DESIGN_PAYMENT_LINK_CANCELLED` | Cancel |
| `DESIGN_PAYMENT_SWITCH_OFFLINE` | Switch to proof |
| `DESIGN_PAYMENT_FAILED` | Customer pay fail |
| `DESIGN_PAYMENT_PAID` | Success auto-approve |
