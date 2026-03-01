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

Two common deployment patterns:

1. **Amplify + EC2 + RDS + S3** – Frontend on Amplify (managed), API on a single EC2, DB on RDS.
2. **EC2 only (monolith)** – One EC2 runs both Next.js and the Express API; RDS for MySQL, S3 for files.

Below we describe **Option 1** (Amplify + EC2 + RDS) and then a simpler **single-EC2** variant.

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
git clone <your-repo-url> app && cd app/backend
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

If you prefer one server:

1. Use the same EC2 and RDS/S3 setup as above.
2. On EC2 install Node, clone repo, then:

**Backend (port 3001):**

```bash
cd ~/app/backend
npm ci
# set .env as in Part 3
nohup npx ts-node server.ts > api.log 2>&1 &
# or use systemd as in 3.3
```

**Frontend (port 3000):**

```bash
cd ~/app/my-app
npm ci
npm run build
NEXT_PUBLIC_API_URL=http://<EC2-PUBLIC-IP>:3001 nohup npm start > next.log 2>&1 &
```

Open **http://\<EC2-PUBLIC-IP\>:3000** in the browser. Set **NEXT_PUBLIC_API_URL** to `http://<EC2-PUBLIC-IP>:3001` so the client calls the same host.

For production, put **Nginx** (or another reverse proxy) in front:

- Nginx listens on 80/443 and proxies:
  - `/api` → `http://127.0.0.1:3001`
  - `/` → `http://127.0.0.1:3000`
- Use **Let’s Encrypt** for HTTPS and set **NEXT_PUBLIC_API_URL** to `https://yourdomain.com` (same origin, so `/api` is enough if you proxy API under the same domain).

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

**Frontend (Amplify / build env):**

- `NEXT_PUBLIC_API_URL` – backend URL the browser will call (e.g. `https://api.yourdomain.com`)

---

## Summary

1. **RDS**: Create MySQL, note endpoint; secure with a security group.
2. **S3**: Create bucket and IAM user; add keys to backend env.
3. **EC2**: Install Node, run backend (ts-node or compiled), set env, optionally systemd.
4. **Amplify**: Connect repo, set root to `my-app`, set `NEXT_PUBLIC_API_URL`, build and deploy.
5. **Single EC2**: Run backend and Next.js on the same instance; use Nginx + HTTPS for production.

After deployment, log in and test: dashboard, leads, file uploads (S3), and checklists. If anything fails, check backend logs (`journalctl -u design-module-api -f`) and browser Network tab for API calls to `NEXT_PUBLIC_API_URL`.
