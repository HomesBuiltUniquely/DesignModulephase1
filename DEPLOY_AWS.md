# Deploying the Design Module to AWS

This guide walks you through deploying the **Design Module** application (Next.js frontend + Express backend + MySQL + S3) on AWS.

---

## Architecture overview

| Component | Technology | AWS service (recommended) |
|-----------|------------|---------------------------|
| **Frontend** | Next.js 16 | AWS Amplify **or** EC2 |
| **Backend API** | Node.js (Express) | EC2 **or** Elastic Beanstalk |
| **Database** | MySQL | Amazon RDS for MySQL |
| **File storage** | S3 (profile images, lead uploads) | Amazon S3 (already used in app) |

Common deployment patterns:

1. **Amplify + EC2 + RDS + S3** – Frontend on Amplify (managed), API on a single EC2, DB on RDS.
2. **EC2 only (monolith)** – One EC2 runs both Next.js and the Express API; RDS for MySQL, S3 for files.
3. **Docker on EC2 (or ECS)** – API and frontend run in containers via Docker Compose; same RDS and S3 (see **Part 5A**).

Below we describe **Option 1** (Amplify + EC2 + RDS), then a **single-EC2** variant, and **Docker-based production**.

---

## Prerequisites

- AWS account with permissions to create EC2, RDS, S3, Amplify (or EC2 only).
- Domain (optional). You can use Amplify/EC2 public URLs for testing.
- Local setup: Node 18+, npm/yarn, MySQL (for initial DB export if you migrate data).

---

## Part 1: Database (Amazon RDS for MySQL)

### 1.1 Create RDS instance

1. In **AWS Console** → **RDS** → **Create database**.
2. Choose **MySQL 8.x**, **Free tier** (or your preferred tier).
3. Settings:
   - **DB instance identifier**: e.g. `design-module-db`
   - **Master username**: e.g. `admin`
   - **Master password**: set a strong password and store it securely.
4. **Instance configuration**: Free tier (e.g. `db.t3.micro`) if available.
5. **Storage**: 20 GB gp3 is fine to start.
6. **Connectivity**:  
   - **VPC**: Default or a dedicated VPC.  
   - **Public access**: **Yes** (so your EC2 or laptop can connect; lock down security groups).  
   - **VPC security group**: Create new, e.g. `rds-design-module`.
7. **Database name**: `DesignMod` (to match your app’s `DB_NAME`).
8. Create the database. Wait until status is **Available**.

### 1.2 Allow access to RDS

- Open the **RDS** security group **Inbound** rules.
- Add rule: **MySQL/Aurora (3306)**, Source = EC2 security group (or your IP for initial setup).  
  Later, set Source to the EC2 instance’s security group so only the API server can connect.

### 1.3 Get RDS endpoint

- In RDS → **Databases** → your DB → **Connectivity & security**.
- Copy the **Endpoint** (e.g. `design-module-db.xxxxxx.ap-south-1.rds.amazonaws.com`).  
  You will use this as `DB_HOST` for the backend.

---

## Part 2: S3 bucket

You already use S3 in the app. For production:

1. **S3** → **Create bucket** (or reuse existing).
2. **Bucket name**: e.g. `design-module-uploads-<account-id>` (globally unique).
3. **Region**: Same as RDS/EC2 (e.g. `ap-south-1`).
4. Block public access as you prefer; the app uses the AWS SDK with credentials (backend proxies or pre-signed URLs), so public read is not required for the API.
5. Create an **IAM user** (or use an existing one) with programmatic access and a policy that allows:
   - `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on this bucket (and prefix if you use one).
6. Save **Access Key ID** and **Secret Access Key** for the backend env (e.g. EC2 or Elastic Beanstalk).

---

## Part 3: Backend API on EC2

### 3.1 Launch EC2

1. **EC2** → **Launch instance**.
2. **Name**: e.g. `design-module-api`.
3. **AMI**: Amazon Linux 2023 or Ubuntu 22.04.
4. **Instance type**: e.g. `t3.small` (or `t3.micro` for testing).
5. **Key pair**: Create or select one; download the `.pem` for SSH.
6. **Network**: Default VPC, **Auto-assign public IP** = Enable.
7. **Security group**: Create one, e.g. `api-sg`, with:
   - **Inbound**: SSH (22) from your IP; **Custom TCP 3001** from 0.0.0.0/0 (or restrict to Amplify/CloudFront IPs later).
8. Launch.

### 3.2 Install Node.js and run the backend

SSH into the instance (replace with your key and host):

```bash
ssh -i your-key.pem ec2-user@<EC2-PUBLIC-IP>
```

Install Node 20 (example for Amazon Linux 2023):

```bash
sudo dnf install -y nodejs npm
# or: curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo dnf install -y nodejs
node -v   # v20.x
```

Clone your repo (or copy files via scp/rsync):

```bash
git clone https://github.com/HomesBuiltUniquely/DesignModulephase1.git app && cd app/backend
# or: scp -r ./backend ec2-user@<EC2-IP>:~/app/
```

Install dependencies and build (if you use a build step):

```bash
cd ~/app/backend
npm ci
# If you compile TypeScript to JS (see below):
# npx tsc && node server.js
# Otherwise run with ts-node:
npm install -g ts-node
```

Create a `.env` (or set environment variables) for the backend:

```bash
# DB (use your RDS endpoint)
DB_HOST=design-module-db.xxxxxx.ap-south-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=<your-rds-password>
DB_NAME=DesignMod
DB_PORT=3306

# S3
AWS_ACCESS_KEY_ID=<your-iam-access-key>
AWS_SECRET_ACCESS_KEY=<your-iam-secret-key>
AWS_REGION=ap-south-1
S3_BUCKET_NAME=design-module-uploads-<account-id>

# API base URL (public URL of this API; frontend will call it)
API_BASE_URL=https://api.yourdomain.com
# Or for testing: http://<EC2-PUBLIC-IP>:3001
```

Run the backend (development-style with ts-node; for production see 3.3):

```bash
PORT=3001 ts-node server.ts
# Or: node server.js if you added a build step
```

Test from your machine:

```bash
curl http://<EC2-PUBLIC-IP>:3001/api/health
# or whatever health route you have
```

### 3.3 Run backend as a service (production)

Use **systemd** so the API restarts on reboot:

```bash
sudo nano /etc/systemd/system/design-module-api.service
```

Contents (adjust paths and user):

```ini
[Unit]
Description=Design Module API
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/app/backend
Environment=NODE_ENV=production
Environment=PORT=3001
# Load env file if you created one:
EnvironmentFile=/home/ec2-user/app/backend/.env
ExecStart=/usr/bin/node server.js
# Or if using ts-node: ExecStart=/usr/bin/npx ts-node server.ts
Restart=always

[Install]
WantedBy=multi-user.target
```

If you use TypeScript without a build step, install ts-node and run:

```bash
ExecStart=/usr/bin/npx ts-node server.ts
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable design-module-api
sudo systemctl start design-module-api
sudo systemctl status design-module-api
```

### 3.4 (Optional) Build TypeScript for production

In `backend/package.json` add:

```json
"scripts": {
  "build": "tsc",
  "start:prod": "node server.js"
}
```

In `backend/tsconfig.json` add:

```json
"outDir": "dist"
```

Then run `npm run build` and use `node dist/server.js` (adjust path if your entry is `server.ts` → `dist/server.js`). Point `WorkingDirectory` and `ExecStart` to the built file.

---

## Part 4: Frontend (Next.js) on AWS Amplify

### 4.1 Prepare the repo

- Ensure the app uses the **API base URL** from the environment (see below).
- In the project root you have:
  - `my-app/` – Next.js app
  - `backend/` – Express API (not deployed to Amplify)

### 4.2 Connect Amplify to your repo

1. **AWS Amplify** → **New app** → **Host web app**.
2. Connect **GitHub** (or GitLab/Bitbucket), select repo and branch.
3. **Build settings**: Amplify detects Next.js. If not, use:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd my-app && npm ci
    build:
      commands:
        - cd my-app && npm run build
  artifacts:
    baseDirectory: my-app/.next
    files:
      - '**/*'
  cache:
    paths:
      - my-app/node_modules/**/*
  customHeaders:
    - pattern: '**'
      headers:
        - key: Cache-Control
          value: no-cache
```

For **Next.js**, Amplify usually uses a default that outputs to `.next` and runs the app. If your root is `my-app`, set **Root directory** to `my-app` in the Amplify console.

### 4.3 Environment variables in Amplify

In Amplify → **App settings** → **Environment variables**, add:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` or `http://<EC2-PUBLIC-IP>:3001` |

Redeploy after changing env vars.

### 4.4 Frontend API base URL (already in code)

The app uses `getApiBase()` from `@/app/lib/apiBase`, which reads `process.env.NEXT_PUBLIC_API_URL` and falls back to `http://localhost:3001`. So you only need to set **NEXT_PUBLIC_API_URL** in Amplify to the public URL of your backend (e.g. `https://api.yourdomain.com`).

---

## Part 5: Single EC2 (frontend + backend on one machine)

This section walks you through running **both** the Next.js frontend and the Express backend on a **single EC2** instance, then optionally putting **Nginx** in front for HTTPS.

**Prerequisites:** RDS (MySQL) and S3 are already created (Parts 1 and 2). You have an EC2 instance (e.g. Amazon Linux 2023 or Ubuntu) with a key pair for SSH.

---

### 5.1 SSH and install dependencies

From your laptop: `ssh -i your-key.pem ec2-user@<EC2-PUBLIC-IP>`

On **Amazon Linux 2023**: `sudo dnf install -y nodejs npm git` then `sudo dnf groupinstall -y "Development Tools"` and `sudo dnf install -y python3 python3-devel`.

On **Ubuntu 22.04**: `sudo apt update && sudo apt install -y nodejs npm git build-essential python3`

---

### 5.2 Clone the repo

```bash
cd ~
git clone https://github.com/HomesBuiltUniquely/DesignModulephase1.git app
cd app
```

---

### 5.3 Backend: env vars and run

Create `~/app/backend/.env` with your real values:

```env
DB_HOST=your-rds-endpoint.ap-south-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=your-rds-password
DB_NAME=DesignMod
DB_PORT=3306
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
S3_BUCKET_NAME=your-bucket
API_BASE_URL=http://<EC2-PUBLIC-IP>:3001
```

Then:

```bash
cd ~/app/backend
npm ci
export $(grep -v '^#' .env | xargs)
nohup env $(grep -v '^#' .env | xargs | tr '\n' ' ') npx ts-node server.ts > api.log 2>&1 &
```

Check: `curl http://localhost:3001/api/health` should return `{"ok":true}`.

---

### 5.4 Frontend: build and run

Replace `<EC2-PUBLIC-IP>` with your EC2 public IP.

```bash
cd ~/app/my-app
npm ci
npm run build
NEXT_PUBLIC_API_URL=http://<EC2-PUBLIC-IP>:3001 nohup npm start > next.log 2>&1 &
```

---

### 5.5 Open the app

In EC2 Security Group allow **inbound** ports **3000** and **3001** from `0.0.0.0/0` (or your IP). Then open **http://\<EC2-PUBLIC-IP\>:3000** in the browser.

---

### 5.6 (Optional) Nginx + HTTPS

1. Point a domain (e.g. `app.yourdomain.com`) to your EC2 public IP (DNS A record).
2. Install: `sudo dnf install -y nginx certbot python3-certbot-nginx` then `sudo systemctl enable nginx && sudo systemctl start nginx`.
3. Create `/etc/nginx/conf.d/design-module.conf`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Run `sudo nginx -t && sudo systemctl reload nginx`.
4. HTTPS: `sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com`
5. Rebuild frontend: `cd ~/app/my-app`, `pkill -f "next start"`, then `NEXT_PUBLIC_API_URL=https://yourdomain.com npm run build` and `NEXT_PUBLIC_API_URL=https://yourdomain.com nohup npm start > next.log 2>&1 &`
6. Security group: allow **80** and **443**; you can remove public access to 3000/3001.

---

### 5.7 Redeploy after code changes

```bash
cd ~/app && git pull origin main
cd ~/app/backend && npm ci && export $(grep -v '^#' .env | xargs) && pkill -f "ts-node server.ts"
nohup env $(grep -v '^#' .env | xargs | tr '\n' ' ') npx ts-node server.ts > api.log 2>&1 &
cd ~/app/my-app && npm ci && npm run build && pkill -f "next start"
NEXT_PUBLIC_API_URL=http://<EC2-PUBLIC-IP>:3001 nohup npm start > next.log 2>&1 &
```

---

**Removed legacy short version; use sections 5.1–5.7 above.**

---

## Part 5A: Docker-based production deployment

You can run the app in production using **Docker** and **Docker Compose**: same RDS and S3 as above, with the API and Next.js frontend in containers. This gives you consistent builds, easy restarts, and a simple path to **ECS** or **Kubernetes** later.

### 5A.1 What’s included

- **`backend/Dockerfile`** – Builds TypeScript to JS and runs the Express API (port 3001).
- **`my-app/Dockerfile`** – Builds Next.js and runs `next start` (port 3000).
- **`docker-compose.yml`** (repo root) – Runs API + frontend; DB and S3 stay external (RDS + S3).

Database and file storage are **not** in Docker: use **RDS for MySQL** and **S3** as in Parts 1 and 2. The containers only need the same env vars (DB_*, AWS_*, API_BASE_URL, etc.).

### 5A.2 Build and run locally (with RDS/S3)

From the **repo root**:

```bash
# 1. Env vars for API (DB, S3, API_BASE_URL). Create backend/.env or export:
export DB_HOST=<your-rds-endpoint>
export DB_USER=admin
export DB_PASSWORD=<password>
export DB_NAME=DesignMod
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=ap-south-1
export S3_BUCKET_NAME=your-bucket
export API_BASE_URL=http://localhost:3001

# 2. Frontend must know the API URL (browser calls it)
export NEXT_PUBLIC_API_URL=http://localhost:3001

# 3. Build and start
docker compose up -d --build
```

- Frontend: **http://localhost:3000**
- API: **http://localhost:3001**

Uploaded files are stored in a Docker volume `api_uploads` (or in S3 if configured). For production you should rely on S3; the volume is only for local/testing.

### 5A.3 Run on EC2 with Docker

1. **Launch EC2** (same as Part 3): Amazon Linux 2023 or Ubuntu, open 22 (SSH) and 80/443 (or 3000/3001 for testing).
2. **Install Docker and Docker Compose** (e.g. on Amazon Linux 2023):

   ```bash
   sudo yum install -y docker
   sudo systemctl start docker && sudo systemctl enable docker
   sudo usermod -aG docker ec2-user
   # Log out and back in, then:
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Clone repo** and set env (same as 5A.2). Use the **public** API URL the browser will use:

   ```bash
   git clone <your-repo> app && cd app
   export DB_HOST=<RDS-endpoint>
   export DB_USER=admin
   export DB_PASSWORD=<password>
   export DB_NAME=DesignMod
   export AWS_ACCESS_KEY_ID=...
   export AWS_SECRET_ACCESS_KEY=...
   export AWS_REGION=ap-south-1
   export S3_BUCKET_NAME=...
   export API_BASE_URL=http://<EC2-PUBLIC-IP>:3001
   export NEXT_PUBLIC_API_URL=http://<EC2-PUBLIC-IP>:3001
   docker compose up -d --build
   ```

4. Open **http://\<EC2-PUBLIC-IP\>:3000**. For production, put **Nginx** (or a load balancer) in front and use HTTPS; set `API_BASE_URL` and `NEXT_PUBLIC_API_URL` to the public HTTPS URL (e.g. `https://api.yourdomain.com` and `https://yourdomain.com` or same host with `/api` proxied).

### 5A.4 (Optional) Push images to ECR and run on ECS

1. **Create ECR repositories** (e.g. `design-module-api`, `design-module-frontend`).
2. **Build and push** (replace `<account-id>` and region):

   ```bash
   aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-south-1.amazonaws.com
   docker build -t design-module-api ./backend
   docker tag design-module-api:latest <account-id>.dkr.ecr.ap-south-1.amazonaws.com/design-module-api:latest
   docker push <account-id>.dkr.ecr.ap-south-1.amazonaws.com/design-module-api:latest
   # Same for my-app → design-module-frontend
   ```

3. **Create ECS cluster**, task definitions (Fargate or EC2), and services. Point tasks to RDS (security group + env vars) and give tasks an IAM role for S3. Set `NEXT_PUBLIC_API_URL` at **build time** for the frontend image (e.g. in CI when building the image).

### 5A.5 Quick reference (Docker)

| Item | Notes |
|------|--------|
| **Backend image** | `backend/Dockerfile` – compiles TS, runs `node dist/server.js` |
| **Frontend image** | `my-app/Dockerfile` – `next build` then `next start`; set `NEXT_PUBLIC_API_URL` at build |
| **Compose** | `docker compose up -d --build`; DB and S3 via env (RDS + S3) |
| **EC2** | Install Docker + Compose, set env, run `docker compose up -d` |
| **ECS** | Build/push to ECR; run tasks with same env; use ALB for HTTPS |

---

## Part 6: Initialize the database

Your backend uses `initDb()` to create tables. Options:

1. **Let the app create tables** – On first run, the backend creates tables if they don’t exist. Ensure the RDS user has CREATE/ALTER rights.
2. **Export/import from local** – If you already have data:
   ```bash
   mysqldump -u root -p DesignMod > design_mod.sql
   mysql -h <RDS-ENDPOINT> -u admin -p DesignMod < design_mod.sql
   ```

Then start the API; it will use the same schema.

---

## Part 7: Security checklist

- **RDS**: Restrict security group to only the EC2 (or VPN) that runs the API. Avoid public access long-term if possible.
- **EC2**: Restrict port 3001 to your frontend (Amplify IPs) or use a load balancer and allow only the ALB security group.
- **Secrets**: Prefer **AWS Secrets Manager** or **SSM Parameter Store** for DB and API keys; inject into EC2 or Amplify env.
- **HTTPS**: Put the API behind **Application Load Balancer** or **API Gateway** and use HTTPS. Set **API_BASE_URL** and **NEXT_PUBLIC_API_URL** to the HTTPS URL.
- **S3**: Keep the bucket private; use IAM roles for EC2 (instance profile) instead of long-lived keys when possible.

---

## Part 8: Quick reference – env vars

**Backend (EC2 / Elastic Beanstalk):**

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`
- `API_BASE_URL` – public URL of the API (for CORS and any links)
- `PORT` – 3001 (or your choice)

**Frontend (Amplify / Next.js on EC2):**

- `NEXT_PUBLIC_API_URL` – backend URL the browser will call (e.g. `https://api.yourdomain.com`)
- **Email (required for emails to be sent):** `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and optionally `MAIL_FROM`. These are read by the **Next.js app** (e.g. `my-app`) when the backend calls `POST /api/email/send-*` on the frontend. If these are missing, the mailer will throw and emails will not send.

**Backend (for triggering emails):**

- `FRONTEND_BASE_URL` – URL where the Next.js app is reachable **from the backend server**. The backend calls this URL to trigger emails (e.g. `http://localhost:3000` when frontend and backend run on the same EC2, or `https://design.hubinterior.com` if the frontend is on a different host). If wrong or missing, the backend cannot trigger the frontend email API and no mail is sent.

---

## Emails not working on EC2

1. **Backend must reach the frontend**  
   Set `FRONTEND_BASE_URL` in the **backend** env (or `backend/.env`) to the URL the backend uses to call the Next app:
   - Same EC2: `http://localhost:3000`
   - Different host/domain: `https://your-frontend-domain.com`
   Restart the backend after changing.

2. **Frontend must have SMTP configured**  
   The **Next.js app** (`my-app`) sends the actual email. Set in the **frontend** env when you run `npm start` (or in `my-app/.env` on EC2):
   - `SMTP_HOST` (e.g. `email-smtp.ap-south-1.amazonaws.com` for AWS SES)
   - `SMTP_PORT` (e.g. `587`)
   - `SMTP_USER` (SES SMTP credentials)
   - `SMTP_PASS` (SES SMTP password)
   - `MAIL_FROM` (e.g. `noreply@yourdomain.com`)

3. **Check logs**  
   - Backend: `tail -f ~/app/api.log` (or wherever the API logs). Look for failed `fetch` to `FRONTEND_BASE_URL/api/email/...`.
   - Frontend: `tail -f ~/app/next.log`. Look for `[mailer] SMTP configuration is incomplete` or `D1 email send error`.

4. **SES (if using AWS)**  
   Verify the SMTP user/pass are for **SES SMTP** (not IAM console login). Ensure the sending identity (domain or email) is verified in SES and not in sandbox if you send to arbitrary addresses.

---

## Summary

1. **RDS**: Create MySQL, note endpoint; secure with a security group.
2. **S3**: Create bucket and IAM user; add keys to backend env.
3. **EC2**: Install Node, run backend (ts-node or compiled), set env, optionally systemd.
4. **Amplify**: Connect repo, set root to `my-app`, set `NEXT_PUBLIC_API_URL`, build and deploy.
5. **Single EC2**: Run backend and Next.js on the same instance; use Nginx + HTTPS for production.
6. **Docker (production)**: Use `backend/Dockerfile` and `my-app/Dockerfile` with `docker compose up`; RDS and S3 stay external. Run on EC2 with Docker installed, or push images to ECR and run on ECS.

After deployment, log in and test: dashboard, leads, file uploads (S3), and checklists. If anything fails, check backend logs (`journalctl -u design-module-api -f` or `docker compose logs -f api`) and browser Network tab for API calls to `NEXT_PUBLIC_API_URL`.
