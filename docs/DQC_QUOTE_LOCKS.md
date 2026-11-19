# DQC per-round quotation locks

## Rules

| When | Source of “Open quotation” |
|------|----------------------------|
| DQC1 / DQC2 popup (before submit) | **Share to customer** first; if none, **CRM-selected** Pre-10 quote |
| After DQC1 submit | Frozen in `lead_dqc_submission_quotes` (`round=dqc1`) |
| After DQC2 submit | Frozen separately (`round=dqc2`) — does not change DQC1 |
| Resubmit after rejection | Overwrites that round’s lock |

## API

```
GET /api/leads/:id/dqc-quote-link?round=dqc1|dqc2&mode=live|locked
```

- `mode=live` → customer-shared, else CRM-selected (`source`: `customer_shared` | `crm_shared`)
- `mode=locked` → table lock, then history for that round

Submit still uses `/dqc-submission/complete` (or dqc2); backend re-resolves the same live preference for link-only submits.

## Backfill

```bash
cd backend
node scripts/backfill-dqc-quote-locks.cjs          # dry-run
node scripts/backfill-dqc-quote-locks.cjs --apply  # write
```

Requires `DB_*` in `backend/.env`.

## QA

1. Lead with CRM v5 + customer share v7 → DQC1 popup shows **v7** (`customer_shared`).
2. Lead with CRM v5 only → DQC popup shows **v5** (`crm_shared`); Submit enabled.
3. Submit DQC1 → reviewer / `dqc-submission-files` shows the locked version.
4. Customer share v9 → DQC1 files still frozen; DQC2 popup shows **v9**.
5. Submit DQC2 → DQC2 files **v9**; DQC1 still frozen.
6. No customer share and no CRM share → popup blocked with clear message.
