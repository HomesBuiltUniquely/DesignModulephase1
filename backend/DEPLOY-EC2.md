# Backend deployment on EC2

---

## Deploy new changes (your usual procedure, with PM2)

You already do: `cd backend` → `git pull origin main` → export env vars → run server.  
**Only change:** run the server with **PM2** instead of `npx ts-node server.ts` so it keeps running after you close SSH and restarts if it crashes.

### One-time setup (if not done yet)

1. Install PM2: `sudo npm install -g pm2`
2. (Recommended) Put your env vars in a file so you don’t paste them every time and they’re not in shell history:
   ```bash
   cd backend
   nano env.sh
   ```
   Paste your exports (SMTP_*, PAYMENT_*, DB_*, AWS_*, API_BASE_URL, FRONTEND_BASE_URL, etc.), one per line, then save (Ctrl+O, Enter, Ctrl+X).  
   Then: `chmod 600 env.sh` and add `env.sh` to `.gitignore` so it’s never committed.

### Every deploy (new changes)

```bash
cd backend
git pull origin main
source env.sh          # if you use env.sh; otherwise run your export commands
export PORT=3001
pm2 restart backend
```

If the app is **not** running under PM2 yet (first time or after a reboot):

```bash
cd backend
git pull origin main
source env.sh          # or your export commands
export PORT=3001
pm2 start ecosystem.config.cjs
pm2 save
```

PM2 will keep the env vars from this shell. After that, for future deploys you only need:

```bash
cd backend && git pull origin main && pm2 restart backend
```

No need to re-export unless you change an env value.

**Summary:**  
- **Before:** `PORT=3001 npx ts-node server.ts` (stops when SSH closes, no auto-restart).  
- **After:** same pull + exports, then `pm2 start ecosystem.config.cjs` once, then `pm2 restart backend` on every deploy.

---

## Full setup (first-time / new instance)

## 1. Launch and connect to EC2

- In AWS Console: **EC2 → Launch instance** (e.g. Amazon Linux 2 or Ubuntu 22.04, `t2.micro` or larger).
- Create/select a key pair and download the `.pem` file.
- In Security Group: allow **Inbound** → **SSH (22)** from your IP, and **Custom TCP 3001** from your app/frontend (or `0.0.0.0/0` for testing only).
- Connect:
  ```bash
  chmod 400 your-key.pem
  ssh -i your-key.pem ec2-user@<EC2-PUBLIC-IP>
  ```
  (Use `ubuntu@...` if you chose Ubuntu.)

---

## 2. Install Node.js and PM2

**Amazon Linux 2:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node -v
npm -v
```

**Ubuntu:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

**PM2 (both):**
```bash
sudo npm install -g pm2
pm2 -v
```

---

## 3. Get your code on the server

**Option A – Git (recommended)**  
If the repo is on GitHub/GitLab:
```bash
sudo yum install -y git   # Amazon Linux
# sudo apt install -y git   # Ubuntu

git clone https://github.com/YOUR_ORG/DesignModulephase1.git
cd DesignModulephase1/backend
```

**Option B – Upload with SCP**  
From your laptop:
```bash
scp -i your-key.pem -r /path/to/DesignModulephase1 ec2-user@<EC2-IP>:~/
```
Then on EC2: `cd ~/DesignModulephase1/backend`.

---

## 4. Install dependencies and build

```bash
cd ~/DesignModulephase1/backend   # or your path

npm ci
# Or if no lockfile: npm install

# Optional but recommended: run compiled JS (fewer crashes, less memory)
npm run build
```

---

## 5. Environment variables

Create a `.env` in the backend folder (or set vars before starting):

```bash
nano .env
```

Add at least:

```env
PORT=3001
NODE_ENV=production

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=DesignMod
DB_PORT=3306

# If frontend is on same/different server
FRONTEND_BASE_URL=https://design.hubinterior.com
API_BASE_URL=https://your-api-domain.com

# Optional: S3 (if you use uploads)
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_REGION=ap-south-1
# S3_BUCKET_NAME=...
```

Save (Ctrl+O, Enter, Ctrl+X).  
To load `.env` in Node, you can use `dotenv` or export vars in the next step.

---

## 6. MySQL on EC2 (if DB runs on same instance)

**Amazon Linux 2:**
```bash
sudo yum install -y mariadb105-server
sudo systemctl start mariadb
sudo systemctl enable mariadb
sudo mysql_secure_installation
```

**Ubuntu:**
```bash
sudo apt update
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
sudo mysql_secure_installation
```

Create DB and user:
```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE DesignMod;
CREATE USER 'appuser'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL ON DesignMod.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Then set in `.env`: `DB_USER=appuser`, `DB_PASSWORD=your_password`, `DB_NAME=DesignMod`.

If MySQL is on **another host** (e.g. RDS), set `DB_HOST` (and port) in `.env` and ensure the security group allows the EC2 instance to reach the DB port.

---

## 7. Start the backend with PM2

**Using ts-node (no build):**
```bash
cd ~/DesignModulephase1/backend

# Load .env and start (bash)
set -a && source .env 2>/dev/null; set +a
PORT=3001 pm2 start ecosystem.config.cjs
```

**Using compiled JS (recommended):**
```bash
cd ~/DesignModulephase1/backend

set -a && source .env 2>/dev/null; set +a
PORT=3001 pm2 start dist/server.js --name backend
```

Check status and logs:
```bash
pm2 status
pm2 logs backend
```

---

## 8. Keep backend running after reboot

```bash
pm2 startup
# Run the command it prints (e.g. sudo env PATH=... pm2 startup systemd -u ec2-user --hp /home/ec2-user)

pm2 save
```

After a reboot, PM2 will start the backend again.

---

## 9. Useful PM2 commands

| Command            | Description              |
|--------------------|--------------------------|
| `pm2 status`       | List processes           |
| `pm2 logs backend` | Stream logs              |
| `pm2 restart backend` | Restart app          |
| `pm2 stop backend` | Stop app                 |
| `pm2 delete backend` | Remove from PM2        |

---

## 10. Large PDF / file uploads (production) — **read this**

If uploads work locally but **in production only tiny files (KB) succeed** or you see **413 Request Entity Too Large**:

- **Nginx** defaults to **`client_max_body_size 1m`**. Multipart uploads (DQC drawing + quotation PDFs, MMT ZIPs) must allow more.
- Fix: set **`client_max_body_size 200M;`** in the **`server { }`** block for `api.hubinterior.com` (and optionally in `http { }`), then `sudo nginx -t && sudo systemctl reload nginx`.
- A ready-made snippet is in the repo: **`backend/nginx-api-large-uploads.conf`** — merge the directives into your real site config.

The Node backend already allows **~200MB** per file (`express` + `multer` limits). The usual missing piece is **Nginx** (or another reverse proxy) in front of Node.

---

## 11. (Optional) Nginx in front of the app

If you want HTTPS and a reverse proxy:

```bash
# Ubuntu
sudo apt install -y nginx

# Amazon Linux 2
sudo amazon-linux-extras enable nginx1
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

Create a site config, e.g. `/etc/nginx/conf.d/backend.conf`:

```nginx
server {
    listen 80;
    server_name your-api-domain.com;   # or EC2 public IP for testing

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 200M;
    }
}
```

Then:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Point your frontend’s `NEXT_PUBLIC_API_URL` (or `API_BASE_URL`) to `http://your-api-domain.com` (or `https://...` after adding SSL, e.g. with Let’s Encrypt).

---

## Quick checklist

- [ ] EC2 instance running, security group allows 22 (SSH) and 3001 (or 80/443 if using Nginx).
- [ ] Node.js 18+ and PM2 installed.
- [ ] Code in `~/DesignModulephase1/backend` (or your path).
- [ ] `npm ci` / `npm install` and optionally `npm run build`.
- [ ] `.env` with PORT, DB_*, FRONTEND_BASE_URL (and S3 if needed).
- [ ] MySQL installed and `DesignMod` DB + user created (or RDS configured and reachable).
- [ ] `pm2 start dist/server.js --name backend` (or `ecosystem.config.cjs`) with env loaded.
- [ ] `pm2 startup` and `pm2 save` for restart on reboot.
- [ ] If using Nginx: **`client_max_body_size 200M`** (see §10) so PDF/ZIP uploads are not capped at ~1 MB.
