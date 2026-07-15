# eStoreMate — Deployment Guide

## Recommended Strategy

Deploy in two phases:

| Phase | Hosting | Database | Cost | When |
|---|---|---|---|---|
| 1 — Testing & Development | Vercel (free) | Neon PostgreSQL (free) | LKR 0 | Now — your own testing only |
| 2 — Production (real shops) | VPS (Hostinger or any provider) + Coolify | PostgreSQL on VPS | ~$6–8/mo | Before onboarding paying customers |

> **Important:** Neon free tier (0.5 GB, limited compute) is only suitable for your own development and testing. For 5–10 live shops it will be exceeded quickly. **Set up the VPS before you go live with paying customers.**

**Why this order?**
Vercel + Neon gets you a working live URL in under an hour — useful for testing, sharing demos with potential customers, and validating the system end-to-end. When you're ready to go live, a VPS with Coolify gives you unlimited compute, no cold starts, full data ownership, and lower cost than any managed platform at your scale.

**VPS provider options (any of these work — same Coolify setup applies):**

| Provider | Plan | RAM | Cost | Notes |
|---|---|---|---|---|
| Hostinger | KVM 2 | 8 GB | ~$6–8/mo | Good value, easy control panel |
| DigitalOcean | Droplet 2GB | 2 GB | $12/mo | Reliable, great docs |
| Hetzner | CX22 | 4 GB | ~€4/mo | Best price/performance in Europe |
| Vultr | Regular 2GB | 2 GB | $10/mo | Good global coverage |

Hostinger KVM 2 is the recommended starting point — 8 GB RAM comfortably runs Next.js + PostgreSQL + Coolify with room to grow.

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

## Domain & DNS Setup — nexoratech.lk with Cloudflare

> **Recommended approach:** Point your .lk domain's nameservers to Cloudflare (free). This gives you wildcard DNS, instant propagation, DDoS protection, and works regardless of what domains.lk's own DNS panel supports.

### Step 1: Buy nexoratech.lk from domains.lk

1. Go to [www.domains.lk](https://www.domains.lk)
2. Search for `nexoratech.lk` and complete the purchase
3. You'll receive login credentials for their control panel
4. **Do not configure DNS in domains.lk** — you'll manage DNS in Cloudflare instead

---

### Step 2: Create a Free Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com) and sign up (free)
2. Click **Add a Site**
3. Enter `nexoratech.lk` and click **Continue**
4. Select the **Free plan** → Continue
5. Cloudflare scans your domain and imports any existing DNS records
6. Click **Continue to nameservers**
7. Cloudflare gives you two nameservers, e.g.:
   ```
   anya.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
   **Copy these — you'll need them in the next step**

---

### Step 3: Point nexoratech.lk to Cloudflare Nameservers

1. Log in to your **domains.lk control panel**
2. Go to **My Domains → nexoratech.lk → Manage → Nameservers**
3. Replace the default nameservers with the two Cloudflare nameservers you copied
4. Save

> This is a one-time change. Propagation takes 24–48 hours. After this, all DNS is managed in Cloudflare — you never touch domains.lk DNS again.

---

### Step 4: Add DNS Records in Cloudflare

Once Cloudflare confirms your nameservers are active, go to **DNS → Records → Add Record**:

| Type | Name | Content | Proxy Status | TTL |
|---|---|---|---|---|
| A | `@` | `YOUR_VPS_IP` | DNS only (grey cloud) | Auto |
| A | `www` | `YOUR_VPS_IP` | DNS only (grey cloud) | Auto |
| A | `*` | `YOUR_VPS_IP` | DNS only (grey cloud) | Auto |

> **Important — use DNS only (grey cloud), NOT the orange proxy cloud.**
> Coolify generates its own SSL certificates via Let's Encrypt. If you enable Cloudflare's proxy (orange cloud), it intercepts HTTPS traffic and conflicts with Coolify's SSL, causing certificate errors.

The `*` wildcard record means every subdomain you create (`estoremate.nexoratech.lk`, `lms.nexoratech.lk`, etc.) automatically routes to your VPS — no further DNS changes ever needed.

---

### Step 5: Verify DNS is Working

After propagation (can check progress at [dnschecker.org](https://dnschecker.org)):

```bash
# Should return your VPS IP
nslookup nexoratech.lk
nslookup estoremate.nexoratech.lk
nslookup anything.nexoratech.lk
```

All three should resolve to the same VPS IP.

---

### Step 6: SSL in Coolify (Automatic)

When you add a domain to any app in Coolify:

1. App settings → **Domains** → enter `estoremate.nexoratech.lk`
2. Toggle **Generate SSL Certificate** → ON
3. Coolify contacts Let's Encrypt, issues the certificate, and configures HTTPS automatically
4. Repeat for every subdomain / product you add — each gets its own certificate

> Because the wildcard DNS is already set up, this just works every time without any DNS changes.

---

### Cloudflare vs domains.lk DNS — Why Cloudflare

| Feature | domains.lk DNS | Cloudflare (free) |
|---|---|---|
| Wildcard `*` DNS record | May not support | Full support |
| DNS propagation | 24–48 hrs per change | 1–5 minutes |
| DDoS protection | None | Built-in |
| Traffic analytics | None | Basic (free) |
| Reliability | Basic | Enterprise-grade |
| Cost | Included with domain | Free |

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

## Nexora Technologies — Multi-Product Setup on One VPS

This section covers running multiple products (eStoreMate, LMS, and future platforms) under a single VPS and the `nexoratech.lk` domain using subdomains.

### Architecture Overview

```
nexoratech.lk          → Company landing page
estoremate.nexoratech.lk  → eStoreMate (Next.js + PostgreSQL)
lms.nexoratech.lk         → LMS platform
crm.nexoratech.lk         → Future product
admin.nexoratech.lk       → Internal admin panel
```

All subdomains point to the **same VPS IP**. Coolify's built-in Nginx reverse proxy routes each subdomain to the correct app and issues a separate SSL certificate for each — no manual Nginx config needed.

---

### Step 1: Register nexoratech.lk

Purchase the domain from any registrar (Hostinger domains, Namecheap, or GoDaddy). Point it to your VPS by setting up DNS as described in Step 2.

---

### Step 2: Set Up Wildcard DNS (Do This Once, Works Forever)

Instead of adding a DNS record for every new subdomain, set a single wildcard record. Log in to your domain registrar's DNS panel and add:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `YOUR_VPS_IP` | 300 |
| A | `*` | `YOUR_VPS_IP` | 300 |

- The `@` record covers `nexoratech.lk` itself
- The `*` wildcard covers **every subdomain** — `estoremate.nexoratech.lk`, `lms.nexoratech.lk`, any future product — all automatically route to your VPS without touching DNS again

> After adding these records, DNS propagates in 5–60 minutes globally.

---

### Step 3: Organise Products as Separate Projects in Coolify

Coolify uses a **Projects** structure — create one project per product:

```
Coolify
├── Project: eStoreMate
│   ├── App: estoremate-app (Next.js)
│   └── DB:  estoremate-db  (PostgreSQL)
│
├── Project: LMS
│   ├── App: lms-app
│   └── DB:  lms-db (PostgreSQL / MySQL)
│
├── Project: Nexora Landing
│   └── App: nexoratech-site
│
└── Project: [Future Product]
    ├── App: ...
    └── DB:  ...
```

Each project is **fully isolated** — separate environment variables, separate databases, separate deployment pipelines. Deploying or restarting eStoreMate has zero effect on the LMS.

---

### Step 4: Adding a New Product (Repeatable Process)

Every time you launch a new product under Nexora Technologies:

1. **Coolify → Projects → New Project** — name it after the product
2. **New Resource → Database** — create a dedicated database for it
3. **New Resource → Application** — connect its GitHub repo, set build/start commands
4. **Environment Variables** — add all the product's secrets
5. **Domains** — set `productname.nexoratech.lk` — SSL is auto-issued
6. That's it. The wildcard DNS record you set in Step 2 means the subdomain already works

---

### VPS Plan Guide for Nexora Technologies

| Products Running | Recommended Plan | RAM | Approx. Cost |
|---|---|---|---|
| 1–2 products (launch) | Hostinger KVM 2 | 8 GB | ~$6–8/mo |
| 3–5 products | Hostinger KVM 4 | 16 GB | ~$12–16/mo |
| 6+ products or high traffic | Hostinger KVM 8 or 2nd VPS | 32 GB | ~$24–30/mo |

> Hostinger lets you **resize the VPS plan in-place** — no migration, no downtime, just upgrade through the control panel when you outgrow the current plan.

---

### Scaling Strategy as Nexora Grows

**Stage 1 — Launch (now):** One KVM 2 VPS, eStoreMate only. Validate and get paying customers.

**Stage 2 — 2nd product:** Same VPS, add LMS or next product as a new Coolify project. Upgrade to KVM 4 if RAM usage goes above 70%.

**Stage 3 — Established:** Either upgrade to KVM 8 (everything on one powerful server) or split by adding a second VPS and moving newer/heavier products there. Keep eStoreMate on the original server for stability.

**Stage 4 — Enterprise:** Dedicated servers or cloud (AWS/GCP) per product — but that's a problem for when you have the revenue to match.

---

### Database Isolation Best Practice

Each product must have its **own database** — never share a database between products. In Coolify:

- `estoremate` database → eStoreMate app only
- `lms_db` database → LMS app only
- Each database has its own credentials

This ensures one product's schema changes or failures never affect another.

---

### Coolify Dashboard Security

Once you have multiple products running, restrict Coolify's dashboard (port 8000) to your IP only:

```bash
# Allow only your office/home IP to access Coolify UI
ufw delete allow 8000
ufw allow from YOUR_IP_ADDRESS to any port 8000
```

This prevents anyone else from accessing your deployment panel even if they find the port.

---

## Quick Comparison

| | Vercel + Neon (Phase 1) | VPS + Coolify (Phase 2) |
|---|---|---|
| Cost | Free | ~$6–8/mo |
| Setup time | ~1 hour | ~3–4 hours |
| Server management | None | Minimal (Coolify handles it) |
| Cold starts | Yes (serverless) | No (always running) |
| Cron jobs | Via `vercel.json` | System crontab |
| Database | Neon free (0.5 GB) | Self-hosted PostgreSQL (unlimited) |
| SSL | Automatic | Automatic (Let's Encrypt via Coolify) |
| Suitable for | Your own testing & demos | 5–10+ live shops, real customers |
| Data ownership | Neon cloud | Your server, full control |
| Best for | Validation before launch | Production — use this for go-live |
