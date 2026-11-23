# Lead project members (`lead_project_members`)

Normalized membership table (not a JSON column on `leads`). One row per `(lead_id, user_id, project_role)`.

## Why a table

- Query “projects for user X” via `user_id` index  
- Unique constraint + auto vs manual (`source`)  
- Partial add/remove without rewriting the lead row  
- Join to `users` for name / avatar  

## Historical leads

Creating the table does **not** copy history. Two paths fill old projects:

1. **Lazy hydrate (runtime)** — first `GET /involved-users` or `GET /project-members` on an empty lead past Pre 10% runs `ensureProjectMembersHydrated` (additive upserts from current designer / D1–D2 / DQC / finance / PM).  
2. **Bulk backfill (ops)** — reconciles all leads (can also remove stale auto rows; preserves `source = manual`).

```bash
cd backend
# Dry-run (default)
npm run backfill:project-members

# Apply
npm run backfill:project-members:apply
```

Requires `DB_*` in `backend/.env`.

## Ongoing sync

Hooks in `leadProjectMembers.ts` (wired from `server.ts`): phase entry, MMT manager/executive, DQC manager/DQE, finance, PM, designer reassignment.

## Manual members

`POST/DELETE /api/leads/:id/project-members` — only `source = manual` rows are removable from the UI.
