# eStoreMate — Deployment Guide

## Recommended Strategy

Deploy in two phases:

| Phase | Hosting | Database | Cost | When |
|---|---|---|---|---|
| 1 — Launch | Vercel (free) | Neon PostgreSQL (free) | LKR 0 | Now |
| 2 — Scale | Hostinger VPS + Coolify | PostgreSQL on VPS | ~$6–8/mo | Once you have paying customers |

**Why this order?**
Vercel + Neon gets you live in under an hour with zero server management. When you're ready to move to your own VPS, Coolify makes the migration straightforward — it's a self-hosted deployment platform (like a mini Heroku on your own server) that handles SSL, reverse proxy, and deployments through a UI rather than the terminal.

---

## Tech Stack Reference

- **Framework:** Next.js 16 (App Router) + React 19
- **Database:** PostgreSQL via Prisma 7
- **Auth:** NextAuth v5
- **Payments:** PayHere
- **Email:** Nodemailer (SMTP)
- **SMS:** SMSLENZ / NotifyLK
- **Backups:** Google Drive API
- **PWA:** Service Worker (offline support)

---

## Environment Variables

Create a `.env.production` (or set these in your hosting dashboard). Never commit this file.

```env
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/estoremate?sslmode=require

# ── Auth ──────────────────────────────────────────────────────────────────────
AUTH_SECRET=                    # generate: openssl rand -base64 32
NEXTAUTH_URL=https://yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# ── Email (SMTP) ───────────────────────────────────────────────────────────────
SMTP_USER=your@email.com
SMTP_PASS=your_smtp_password
SMTP_FROM=your@email.com

# ── SMS ────────────────────────────────────────────────────────────────────────
SMSLENZ_USER_ID=
SMSLENZ_API_KEY=
SMSLENZ_SENDER_ID=eStoreMate
NOTIFYLK_USER_ID=
NOTIFYLK_API_KEY=
NOTIFYLK_SENDER_ID=

# ── Payments (PayHere) ─────────────────────────────────────────────────────────
PAYHERE_MERCHANT_ID=
PAYHERE_MERCHANT_SECRET=

# ── Google Drive Backup ────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_FOLDER_ID=

# ── Admin & Security ───────────────────────────────────────────────────────────
ADMIN_PHONE=+94XXXXXXXXX
NEXT_PUBLIC_ADMIN_PHONE=+94XXXXXXXXX
ADMIN_SECRET=                   # generate: openssl rand -hex 32
CRON_SECRET=                    # generate: openssl rand -hex 32
BACKUP_CRON_SECRET=             # generate: openssl rand -hex 32
BACKUP_EMAIL=your@email.com

# ── Supabase (if used) ─────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Phase 1 — Vercel + Neon (Recommended Starting Point)

### Step 1: Set Up Neon Database

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project → name it `estoremate`
3. Copy the **Connection string** (starts with `postgresql://...`)
4. Enable **Pooling** — copy the pooled connection string for `DATABASE_URL`

> Neon free tier: 0.5 GB storage, 1 database, always-on. More than enough to launch.

### Step 2: Run Database Migration

On your local machine, with `DATABASE_URL` pointing to Neon:

```bash
# Generate Prisma client
npx prisma generate

# Push your schema to Neon (first time)
npx prisma db push

# Or if you use migrations
npx prisma migrate deploy
```

### Step 3: Push Code to GitHub

```bash
git add .
git commit -m "production ready"
git push origin main
```

### Step 4: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Framework: **Next.js** (auto-detected)
4. Click **Environment Variables** → add every variable from the list above
5. Click **Deploy**

> Vercel automatically runs `next build` and deploys. Any future `git push` to `main` triggers a new deployment automatically.

### Step 5: Set Up Your Domain on Vercel

1. Go to your project → **Settings → Domains**
2. Add your domain (e.g. `app.estoremate.lk`)
3. Point your domain's DNS to Vercel's nameservers (they'll show you exactly what to add)
4. SSL is provisioned automatically — usually within 5 minutes

### Step 6: Configure Cron Jobs on Vercel

Vercel supports cron jobs via `vercel.json`. Create this file in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-summary",
      "schedule": "0 20 * * *"
    },
    {
      "path": "/api/cron/low-stock",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/backup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

> Adjust paths to match your actual cron API routes.

### Step 7: Verify the Deployment

- [ ] Home page loads
- [ ] Register a test shop
- [ ] Make a test sale in POS
- [ ] Check email receipt arrives
- [ ] Test offline mode (disable network in browser DevTools)
- [ ] Confirm PWA install prompt appears

---

## Phase 2 — Hostinger VPS with Coolify

When you're ready to move to your own server (for cost control, no cold starts, and full ownership).

### Recommended VPS Plan

**Hostinger KVM 2** (~$6–8/month)
- 2 vCPU, 8 GB RAM, 100 GB NVMe SSD
- Ubuntu 22.04 LTS
- This comfortably runs eStoreMate + PostgreSQL + Coolify

### Step 1: Order and Access Your VPS

1. Purchase the VPS from Hostinger
2. Choose **Ubuntu 22.04 LTS** as the OS
3. Set a strong root password (or add your SSH key during setup)
4. Connect via SSH:

```bash
ssh root@YOUR_VPS_IP
```

### Step 2: Initial Server Setup

```bash
# Update system
apt update && apt upgrade -y

# Create a non-root user (safer than running as root)
adduser deploy
usermod -aG sudo deploy

# Copy SSH key to new user (if you use SSH keys)
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Switch to new user
su - deploy
```

### Step 3: Install Coolify

Coolify is an open-source self-hosted platform that replaces PM2 + Nginx + Certbot setup with a simple web UI.

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Wait 2–3 minutes. Then open your browser:

```
http://YOUR_VPS_IP:8000
```

Complete the Coolify setup wizard (create your admin account).

### Step 4: Add Your Server to Coolify

1. In Coolify → **Servers → Add Server**
2. Choose **Localhost** (since Coolify is on the same server)
3. Coolify will validate the connection and install Docker automatically

### Step 5: Set Up PostgreSQL in Coolify

1. Go to **Resources → New Resource → Database → PostgreSQL**
2. Set a database name: `estoremate`
3. Set a strong password
4. Click **Deploy**
5. Copy the internal connection string Coolify provides — use this as your `DATABASE_URL`

### Step 6: Deploy eStoreMate in Coolify

1. Go to **Projects → New Project → New Resource → Application**
2. Connect your GitHub repository
3. Build pack: **Nixpacks** (auto-detects Next.js) or **Dockerfile** if you have one
4. Build command: `npm run build`
5. Start command: `npm start`
6. Port: `3000`

#### Add All Environment Variables

In the application settings → **Environment Variables**, paste all variables from the list at the top of this guide.

### Step 7: Connect Your Domain in Coolify

1. Application settings → **Domains**
2. Add `app.estoremate.lk` (or your domain)
3. Toggle **Generate SSL Certificate** → ON (uses Let's Encrypt automatically)
4. In your domain registrar / Hostinger DNS, add an **A record**:
   - Host: `app`
   - Value: `YOUR_VPS_IP`

### Step 8: Run Database Migration

Open Coolify terminal for your app container, or SSH into the server:

```bash
# Via SSH
cd /path/to/app   # Coolify stores apps in /data/coolify/...

npx prisma migrate deploy
```

Or add it as part of your build command:

```
prisma migrate deploy && next build
```

### Step 9: Set Up Cron Jobs on the VPS

```bash
crontab -e
```

Add these lines (adjust paths/URLs to match your domain):

```cron
# Daily sales summary — 8 PM
0 20 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://app.estoremate.lk/api/cron/daily-summary

# Low stock check — 8 AM
0 8 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://app.estoremate.lk/api/cron/low-stock

# Database backup — 2 AM
0 2 * * * curl -s -H "Authorization: Bearer YOUR_BACKUP_CRON_SECRET" https://app.estoremate.lk/api/cron/backup
```

### Step 10: Firewall Setup

```bash
# Allow SSH, HTTP, HTTPS, and Coolify dashboard
ufw allow 22
ufw allow 80
ufw allow 443
ufw allow 8000   # Coolify UI — restrict to your IP only in production
ufw enable
```

---

## Migrating from Vercel to VPS (When the Time Comes)

1. Export your data from Neon:
   ```bash
   pg_dump "YOUR_NEON_CONNECTION_STRING" > estoremate_backup.sql
   ```

2. Import into your VPS PostgreSQL:
   ```bash
   psql "YOUR_VPS_DB_CONNECTION_STRING" < estoremate_backup.sql
   ```

3. Update `DATABASE_URL` in Coolify to point to VPS PostgreSQL

4. Update domain DNS A records to point to VPS IP instead of Vercel

5. Remove project from Vercel after confirming everything works

---

## Security Checklist (Both Phases)

- [ ] `AUTH_SECRET` is at least 32 random characters
- [ ] `ADMIN_SECRET`, `CRON_SECRET`, `BACKUP_CRON_SECRET` are all unique random strings
- [ ] SMTP password is an app-specific password (not your main email password)
- [ ] Database is not publicly accessible (Neon: IP allowlist; VPS: firewall blocks port 5432)
- [ ] Coolify dashboard port 8000 is restricted to your IP only
- [ ] PayHere webhook URL is set in PayHere dashboard to your production domain
- [ ] Google Drive API credentials have minimum required scopes

---

## Generating Secrets

Run these locally to generate secure random strings:

```bash
# AUTH_SECRET
openssl rand -base64 32

# ADMIN_SECRET, CRON_SECRET, BACKUP_CRON_SECRET
openssl rand -hex 32
```

---

## Quick Comparison

| | Vercel + Neon | Hostinger VPS + Coolify |
|---|---|---|
| Cost | Free to start | ~$6–8/mo |
| Setup time | ~1 hour | ~3–4 hours |
| Server management | None | Minimal (Coolify handles it) |
| Cold starts | Yes (serverless) | No (always running) |
| Cron jobs | Via `vercel.json` | System crontab |
| Database | Neon (managed) | Self-hosted PostgreSQL |
| SSL | Automatic | Automatic (Let's Encrypt) |
| Scaling | Automatic | Manual VPS upgrade |
| Best for | Launch / validation | Production with customers |
