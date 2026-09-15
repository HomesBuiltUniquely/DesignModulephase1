# CRM Hallway → Designer Login (Design Module)

**For:** Antigravity AI (CRM frontend / hallway)  
**Related repo:** Design Module (`DesignModulephase1`) — already has the login API  
**Status:** Spec only — hallway + chooser live in **CRM**, not in Design Module

---

## Prompt for Antigravity (copy this)

You are implementing CRM hallway login.

Context:
- Hallway is a **public employee wall**. Anyone can open it **without login**. Do not put a login wall on hallway content.
- Left side has a **Login** bar. Clicking it opens the login page.
- Login page has **two choices**: **CRM Sales** or **Designers**.
- **CRM Sales** → existing CRM login (email/password against CRM). Stay in CRM after success.
- **Designers** → do **not** use CRM auth. Call **Design Module** `POST /api/auth/login`, then land the user **already logged in** on the Design Module frontend.

Do not break hallway public access. Do not send designer credentials to CRM auth. Follow the rest of this file exactly.

---

## 0. 404 after login — fix this first

The Design UI host is **`https://design.hubinterior.com`** (spelling: **design**, not `desgin`).

| CRM redirect | Result |
|--------------|--------|
| `https://desgin.hubinterior.com` | **404** — wrong host (typo) |
| `https://api.hubinterior.com` | **404** — that is the API, not the app |
| `https://design.hubinterior.com/auth/accept` (before this deploy) | **404** — page did not exist yet |
| `https://design.hubinterior.com` | Home; if not logged in, app sends user to `/login` |
| `https://design.hubinterior.com/login` | Login page (always exists) |
| `https://design.hubinterior.com/auth/accept#payload=...` | Direct login handoff (**after** Design frontend deploy) |
| `https://design.hubinterior.com/login#payload=...` | Same handoff on the login page (**after** Design frontend deploy) |

**CRM must redirect to the frontend, with `/login` or `/auth/accept`, and https:**

```text
https://design.hubinterior.com/login
```

or, after Design Module is deployed with `/auth/accept`:

```text
https://design.hubinterior.com/auth/accept#payload=<url-encoded-json>
```

CRM env:

```env
DESIGN_MODULE_BASE_URL=https://api.hubinterior.com
DESIGN_MODULE_FRONTEND_URL=https://design.hubinterior.com
```

Do not set `DESIGN_MODULE_FRONTEND_URL=https://desgin.hubinterior.com`.
Do not set it to `https://api.hubinterior.com`.

---

## 1. Goal

Office hallway TV / kiosk stays public. Staff who need a product click **Login** on the left, pick their product, and enter the right app.

| Choice | Auth system | After success |
|--------|-------------|---------------|
| **CRM Sales** | Existing CRM login | CRM dashboard (current behaviour) |
| **Designers** | Design Module `POST /api/auth/login` | Design Module UI, session already set |

Designers include all Design Module roles (designer, design_manager, TDM, DQC, MMT, finance, admin, project_manager, …). One Design login covers all of them.

---

## 2. User flow

```text
Anyone opens CRM Hallway
  │  (no login required — employee board stays public)
  │
  ├─ browse hallway content
  │
  └─ click LEFT SIDE "Login" bar
        │
        ▼
   Login page (chooser)
        │
        ├─ [ CRM Sales ] ──► CRM email + password
        │                      POST existing CRM /api/auth (unchanged)
        │                      store crm_token as today
        │                      redirect CRM home
        │
        └─ [ Designers ] ──► Design email + password (@hubinterior.com)
                               POST Design Module /api/auth/login
                               receive { user, sessionId }
                               hand off session to Design frontend
                               user lands logged in on Design Module
```

### Screen sequence

1. **Hallway** — public. Left rail has a Login control. No auth modal blocking the board.
2. **Chooser** — two large options: “CRM Sales” and “Designers”. Back link returns to hallway.
3. **Credentials** — email + password. Label the product so the user knows which app they are entering.
4. **Success**
   - Sales → CRM.
   - Designers → Design Module dashboard (or role home). They must **not** see Design’s `/login` again unless credentials failed.

---

## 3. Why a handoff is required

Design Module session is **not** a cookie on the CRM domain.

- API: `POST {DESIGN_API}/api/auth/login` → `{ user, sessionId }`
- Frontend stores: `localStorage["design_module_auth"] = JSON.stringify({ user, sessionId })`
- Later API calls: `Authorization: Bearer {sessionId}`

CRM origin **cannot** write `localStorage` on `design.hubinterior.com`. After a successful Design login from CRM, you **must** open the Design frontend and let **that origin** write `design_module_auth`.

Do **not** keep designer `sessionId` in CRM `localStorage` as the live session. CRM `crm_token` is a different system.

---

## 4. Systems and URLs

| System | Local | Production (typical) |
|--------|-------|----------------------|
| CRM frontend (hallway lives here) | `http://localhost:3000` | CRM host |
| Design **backend** (login API) | `http://localhost:3001` | `https://api.hubinterior.com` |
| Design **frontend** (app after login) | `http://localhost:3002` | `https://design.hubinterior.com` |

CRM env (add if missing):

```env
# Design Module backend (login API)
DESIGN_MODULE_BASE_URL=http://localhost:3001

# Design Module Next.js UI (where the user lands)
DESIGN_MODULE_FRONTEND_URL=http://localhost:3002
```

Production example:

```env
DESIGN_MODULE_BASE_URL=https://api.hubinterior.com
DESIGN_MODULE_FRONTEND_URL=https://design.hubinterior.com
```

Same `DESIGN_MODULE_BASE_URL` pattern as booking/token integration. Do not point login at the Design **frontend** origin.

---

## 5. Design Module login API (already live)

No API-key. This is a user login, not Hub ingest.

### 5.1 Login

```http
POST {DESIGN_MODULE_BASE_URL}/api/auth/login
Content-Type: application/json
```

```json
{
  "email": "designer@hubinterior.com",
  "password": "plain-text-password"
}
```

**200**

```json
{
  "user": {
    "id": 12,
    "email": "designer@hubinterior.com",
    "name": "Jane Designer",
    "role": "designer",
    "profileImage": null,
    "phone": "",
    "branch": "Bangalore",
    "subRole": null
  },
  "sessionId": "sess-1710000000000-abc123"
}
```

`role` examples: `admin`, `territorial_design_manager`, `deputy_general_manager`, `design_manager`, `designer`, `dqc_manager`, `dqe`, `mmt_manager`, `mmt_executive`, `finance`, `project_manager`, `senior_project_manager`, `escalation_manager`.

**400** `{ "message": "Email and password are required" }`  
**401** `{ "message": "Invalid credentials" }`  
**500** `{ "message": "Login failed" }`

### 5.2 Me / logout (Design app uses these after handoff)

```http
GET {DESIGN_MODULE_BASE_URL}/api/auth/me
Authorization: Bearer {sessionId}
```

```http
POST {DESIGN_MODULE_BASE_URL}/api/auth/logout
Authorization: Bearer {sessionId}
```

### 5.3 How Design frontend stores the session

Key: `design_module_auth`

```json
{
  "user": { "...same user object..." },
  "sessionId": "sess-..."
}
```

All authenticated Design fetches use `Authorization: Bearer {sessionId}`.

---

## 6. What to build (CRM)

### 6.1 Hallway

- Keep hallway **public**.
- Left side: Login bar / button. Click → login page (chooser), not a full-app auth redirect that hides hallway.

### 6.2 Chooser page

Two options only:

1. **CRM Sales** — existing CRM login form / route.
2. **Designers** — Design login form (can share layout; different submit handler).

Suggested copy:

- CRM Sales: “Sales CRM — leads, booking, token”
- Designers: “Design Module — designers, TDM, DQC, finance”

### 6.3 Designer submit (required)

**Do not call Design login from the browser on the CRM origin** if CORS blocks it. Proxy through CRM Next BFF (same pattern as `DESIGN_MODULE_BASE_URL` for booking).

**CRM BFF**

```http
POST /api/design-module/auth/login
Content-Type: application/json

{ "email": "...", "password": "..." }
```

BFF server-side:

```http
POST {DESIGN_MODULE_BASE_URL}/api/auth/login
Content-Type: application/json

{ "email": "...", "password": "..." }
```

Return Design’s JSON and status code as-is (`200` / `400` / `401` / `500`). Do not map designer users into CRM users.

### 6.4 Session handoff (required)

After BFF returns `{ user, sessionId }`:

1. Redirect the browser to Design frontend **accept** route (fragment, not query — fragment is not sent to servers/logs):

```text
{DESIGN_MODULE_FRONTEND_URL}/auth/accept#payload=<url-encoded-json>
```

Production (correct spelling):

```text
https://design.hubinterior.com/auth/accept#payload=<url-encoded-json>
```

Fallback that already exists on Design:

```text
https://design.hubinterior.com/login#payload=<url-encoded-json>
```

Payload JSON:

```json
{
  "user": { "...from login response..." },
  "sessionId": "sess-..."
}
```

2. Design frontend `/auth/accept` (see §7) writes `localStorage.design_module_auth` and redirects by role.

If Design `/auth/accept` is **not** deployed yet, fallback only:

```text
{DESIGN_MODULE_FRONTEND_URL}/login
```

User then logs in again on Design. Prefer accept-route so “login direct on Design Module” is true.

**Do not** put `sessionId` in query string (`?sessionId=`). Use the hash fragment.

**Do not** POST passwords to Design frontend. Only the backend login API receives passwords.

---

## 7. What to build (Design Module) — small

Add a client page that accepts the hallway handoff.

**Route:** `/auth/accept`  
**File (suggested):** `my-app/app/auth/accept/page.tsx`

On load:

1. Read `window.location.hash` (`#payload=...`).
2. `JSON.parse(decodeURIComponent(...))`.
3. Validate `sessionId` is a non-empty string starting with `sess-`, and `user` has `id`, `email`, `role`.
4. Optional: `GET {API}/api/auth/me` with `Authorization: Bearer {sessionId}`. If not 200, show error and link to `/login`.
5. `localStorage.setItem("design_module_auth", JSON.stringify({ user, sessionId }))`.
6. `history.replaceState` to strip the hash.
7. Redirect by role (same as `my-app/app/login/page.tsx`):

| Role | Redirect |
|------|----------|
| `admin` | `/admin` |
| `territorial_design_manager`, `deputy_general_manager` | `/tdm/register` |
| `dqc_manager` | `/dqc-manager/register` |
| `mmt_manager` | `/mmt-manager/register` |
| `finance` | `/finance` |
| everyone else | `/` |

Invalid / missing payload → `/login`.

CORS: Design backend already allows `http://localhost:3000`. If CRM production origin is not in that list, add it via `ALLOWED_ORIGINS` or `CORS_ORIGINS` on Design backend. BFF proxy avoids browser CORS for the login POST itself; CORS still matters if Design `/auth/accept` calls `/api/auth/me` from the Design origin (already allowed).

---

## 8. Sequence (happy path)

```text
User                    CRM UI              CRM BFF                 Design API              Design UI
 │                        │                    │                       │                      │
 │  open hallway          │                    │                       │                      │
 │───────────────────────►│                    │                       │                      │
 │  (public, no auth)     │                    │                       │                      │
 │                        │                    │                       │                      │
 │  click Login (left)    │                    │                       │                      │
 │───────────────────────►│                    │                       │                      │
 │  chooser page          │                    │                       │                      │
 │◄───────────────────────│                    │                       │                      │
 │                        │                    │                       │                      │
 │  pick Designers        │                    │                       │                      │
 │  email + password      │                    │                       │                      │
 │───────────────────────►│                    │                       │                      │
 │                        │  POST /api/design-module/auth/login        │                      │
 │                        │───────────────────►│                       │                      │
 │                        │                    │  POST /api/auth/login │                      │
 │                        │                    │──────────────────────►│                      │
 │                        │                    │  { user, sessionId }  │                      │
 │                        │                    │◄──────────────────────│                      │
 │                        │  { user, sessionId }                       │                      │
 │                        │◄───────────────────│                       │                      │
 │  302/redirect to Design /auth/accept#payload=...                    │                      │
 │────────────────────────────────────────────────────────────────────────────────────────────►│
 │                        │                    │                       │   write localStorage │
 │                        │                    │                       │   GET /api/auth/me   │
 │                        │                    │                       │──────────────────────►│
 │                        │                    │                       │◄──────────────────────│
 │                        │                    │                       │   redirect / or role │
 │  Design Module home (logged in)             │                       │                      │
 │◄────────────────────────────────────────────────────────────────────────────────────────────│
```

CRM Sales path never touches this sequence.

---

## 9. Errors

| Case | UI |
|------|----|
| Empty email/password | Inline validation; do not call API |
| 401 Invalid credentials | “Invalid email or password” on the Designers form. Stay on CRM login page. |
| 500 / network | “Design Module is unreachable. Try again.” |
| Handoff payload missing/invalid | Design `/auth/accept` → `/login` |
| `/api/auth/me` fails after handoff | Clear storage, `/login` |

Never create a CRM session on designer 401. Never create a Design session on CRM sales 401.

---

## 10. Security

- Hallway stays public; login is opt-in from the left bar.
- Designer password only goes CRM browser → CRM BFF → Design `POST /api/auth/login`. Not to Hub, not to CRM user table.
- Handoff uses URL **hash**, not query.
- Accept page must replace history so the hash is not left in the address bar.
- `sessionId` is a bearer secret. Do not log it.
- HTTPS in production.
- Optional later: one-time handoff code (`POST /api/auth/handoff`) instead of putting `sessionId` in the hash. Hash is enough for v1.

---

## 11. What not to do

- Do not require login to **view** hallway.
- Do not reuse CRM `crm_token` as Design `sessionId`.
- Do not call Hub `/api/auth/signin` for designers.
- Do not use `EXTERNAL_LEAD_INGEST_API_KEY` / `x-api-key` on user login.
- Do not iframe Design `/login` unless product explicitly wants it; redirect + accept is the intended path.
- Do not change Design `POST /api/auth/login` request/response shape.

---

## 12. Acceptance checklist

Hallway

- [ ] Hallway opens with no session / no token.
- [ ] Left Login bar is visible on hallway.
- [ ] Login does not replace hallway as the default landing for anonymous staff viewing the board.

Chooser

- [ ] Two options: CRM Sales, Designers.
- [ ] Sales path = existing CRM login, unchanged.
- [ ] Designers path does not hit CRM user auth.

Designer login

- [ ] BFF `POST /api/design-module/auth/login` proxies to Design `POST /api/auth/login`.
- [ ] Wrong password stays on CRM chooser/form with 401 message.
- [ ] Right password redirects to `{DESIGN_MODULE_FRONTEND_URL}/auth/accept#payload=...`.
- [ ] Design UI writes `design_module_auth` and opens the role home (not `/login`).
- [ ] Refresh on Design still logged in (localStorage + `/api/auth/me`).
- [ ] Design logout still works (`POST /api/auth/logout` + clear `design_module_auth`).

---

## 13. Local test

1. CRM `http://localhost:3000` — hallway public, Login on the left.
2. Design API `http://localhost:3001`, Design UI `http://localhost:3002`.
3. CRM `.env`: `DESIGN_MODULE_BASE_URL` + `DESIGN_MODULE_FRONTEND_URL`.
4. Pick **Designers**, use a real Design user (`users` table on Design DB).
5. Confirm Network: CRM BFF → `3001/api/auth/login` → 200 `{ user, sessionId }`.
6. Confirm browser origin is Design frontend and Application → Local Storage → `design_module_auth`.
7. Pick **CRM Sales** and confirm CRM still logs in as before.

---

## 14. File map for implementers

| Side | Work |
|------|------|
| CRM | Hallway left Login bar → chooser page |
| CRM | Designers form + BFF proxy `POST /api/design-module/auth/login` |
| CRM | Redirect to Design `/auth/accept#payload=` |
| Design | `my-app/app/auth/accept/page.tsx` (if not present) |
| Design | Login API already exists: `backend/server.ts` `POST /api/auth/login` |
| Design | Session storage already exists: `my-app/app/auth/AuthContext.tsx` key `design_module_auth` |

---

## 15. Role home (Design) — reference

Copied from current Design login page so hallway handoff matches:

```ts
if (role === "admin") → /admin
else if (role === "territorial_design_manager" || role === "deputy_general_manager") → /tdm/register
else if (role === "dqc_manager") → /dqc-manager/register
else if (role === "mmt_manager") → /mmt-manager/register
else if (role === "finance") → /finance
else → /
```
