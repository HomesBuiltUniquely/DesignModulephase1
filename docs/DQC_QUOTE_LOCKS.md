# DQC per-round quotation locks

## Rules

| When | Source of “Open quotation” |
|------|----------------------------|
| DQC1 / DQC2 popup (before submit) | Current **Share to customer** only (never Pre-10 CRM share) |
| After DQC1 submit | Frozen in `lead_dqc_submission_quotes` (`round=dqc1`) |
| After DQC2 submit | Frozen separately (`round=dqc2`) — does not change DQC1 |
| Resubmit after rejection | Overwrites that round’s lock |

## API

```
GET /api/leads/:id/dqc-quote-link?round=dqc1|dqc2&mode=live|locked
```

- `mode=live` → customer-shared quote  
- `mode=locked` → table lock, then history for that round  

Submit still uses `/dqc-submission/complete` (or dqc2); backend re-resolves **canonical customer share** for link-only submits.

## Backfill

```bash
cd backend
node scripts/backfill-dqc-quote-locks.cjs          # dry-run
node scripts/backfill-dqc-quote-locks.cjs --apply  # write
```

Requires `DB_*` in `backend/.env`.

## QA

1. Lead with CRM v5 + customer share v7 → DQC1 popup shows **v7**.  
2. Submit DQC1 → reviewer / `dqc-submission-files` shows **v7**.  
3. Customer share v9 → DQC1 files still **v7**; DQC2 popup shows **v9**.  
4. Submit DQC2 → DQC2 files **v9**; DQC1 still **v7**.  
5. No customer share → popup blocked with clear message.
