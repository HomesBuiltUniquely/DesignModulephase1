# Google service account (neat-drummer-470112-s7)

This project can use a **GCP service account** for server-to-server Google APIs (Sheets, Drive, Gmail with Workspace delegation, etc.).

## Local setup

1. Place the JSON key at:
   `backend/credentials/hub-interior-service-account.json`
2. In `backend/.env`:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=./credentials/hub-interior-service-account.json
   ```
3. The `credentials/` folder is gitignored — never commit the key file.

Service account email: `hub-interior@neat-drummer-470112-s7.iam.gserviceaccount.com`

## Not the same as Google Calendar OAuth

The CRM **Google Calendar** connect flow uses **OAuth user login** (`GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET`). The service account JSON does **not** replace those unless you configure **domain-wide delegation** in Google Workspace Admin.

## Production (EC2 / ECS)

- Copy the JSON to the server outside the repo, e.g. `/home/ec2-user/secrets/hub-interior-service-account.json`
- Set `GOOGLE_APPLICATION_CREDENTIALS` to that absolute path in `env.sh`
- Restrict permissions: `chmod 600`

## Security

If this key file was shared in chat, email, or a public folder, **rotate it** in [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts?project=neat-drummer-470112-s7) → Keys → delete old key → create new key.
