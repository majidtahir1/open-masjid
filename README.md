# OpenMasjid

Multi-tenant platform for masjid websites, built with Next.js 15 and Payload CMS 3 on Postgres.

## Prerequisites

- **Node.js** ≥ 20.9.0
- **Docker** (for the local Postgres container)
- **npm**

## Setup

```bash
git clone https://github.com/majidtahir1/open-masjid.git
cd open-masjid
npm install
```

### Environment

```bash
cp .env.example .env
```

Then edit `.env`:

```env
# Host port from docker-compose.yml is 5433 (not 5432)
DATABASE_URI=postgres://postgres:postgres@localhost:5433/openmasjid

# Generate with: openssl rand -hex 32
PAYLOAD_SECRET=<32-byte random hex>

NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

### Email (optional, required for forgot-password + invites)

Leaving the Resend env vars unset makes Payload log outgoing email to the console — fine for local dev. To send real email:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM_ADDRESS=noreply@openmasjid.app
EMAIL_FROM_NAME=OpenMasjid
```

Get a key at [resend.com](https://resend.com) (free tier: 100/day, 3000/mo). Verify the sending domain in Resend before using a custom `EMAIL_FROM_ADDRESS` in production; for local testing you can use `onboarding@resend.dev` without verification.

### Database

```bash
docker compose up -d
```

This starts Postgres 16 on host port `5433` with a persistent `pgdata` volume. Payload pushes its schema automatically on first boot — no manual migrations needed.

### Run

```bash
npm run dev
```

Open http://localhost:3000 for the site and http://localhost:3000/admin for the Payload admin. Create the first admin user on first visit.

### Scheduled publishing

Events, Pages, Announcements, and Hero Slides support **scheduled publish / unpublish** — click the ▾ next to Publish in the admin and pick a future date/time.

In dev, Payload's job queue auto-runs every minute (wired in `payload.config.ts` under `jobs.autoRun`), so scheduled jobs fire without extra setup.

In production, the auto-runner is disabled. A cron drains the queue by POSTing to `/api/payload-jobs/run` every minute with a shared secret:

```bash
# generate a secret once, add to .env
openssl rand -hex 32   # → CRON_SECRET=...

# crontab -e, add:
* * * * * curl -fsS -X POST https://your-domain.tld/api/payload-jobs/run \
  -H "X-Cron-Secret: $CRON_SECRET" >> /var/log/openmasjid-jobs.log 2>&1
```

Payload's `jobs.access.run` accepts either an authenticated admin session **or** a matching `X-Cron-Secret` header — pick whichever suits your host. Without the env var set, the endpoint refuses unauthenticated calls entirely, so leaving `CRON_SECRET` unset in a production `.env` closes the route.

On Vercel use a Cron Job pointing at the same URL (set the secret as a Vercel env var and inject via header). On Fly/Render use the platform scheduler. On a plain VM the crontab snippet above is enough.

### Seed (optional)

```bash
npm run seed
```

## Deploying with Docker (recommended)

The production stack is three containers defined in `docker-compose.prod.yml`:

- **app** — Next.js + Payload, built from `Dockerfile` (multi-stage, standalone output, non-root, ~150 MB).
- **db** — Postgres 16 with a persistent `pgdata` volume.
- **cron** — Alpine crond sidecar that hits `/api/payload-jobs/run` every minute (scheduled-publish queue drain).

The stack sits behind an external reverse proxy — **Nginx Proxy Manager** typically running on a different host on your LAN. The app container publishes port 3000 on the host's LAN interface; NPM proxies to `http://<openmasjid-host-ip>:3000`.

### 1. Prereqs on the host

- Docker 24+ and Docker Compose v2 (`docker compose version`).
- An NFS mount from your TrueNAS (or any durable volume) for media uploads (optional but strongly recommended — container filesystems are ephemeral).
- Nginx Proxy Manager reachable on your LAN, already running.

### 2. Clone + configure

```bash
git clone https://github.com/majidtahir1/open-masjid.git /opt/openmasjid
cd /opt/openmasjid
cp .env.prod.example .env
chmod 600 .env
$EDITOR .env    # fill in DATABASE_URI, PAYLOAD_SECRET, RESEND_*, CRON_SECRET, MEDIA_PATH
```

Required env vars (see `.env.prod.example` for the full list):

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `DATABASE_URI` (reuses the Postgres creds, points at `db` service)
- `PAYLOAD_SECRET` — `openssl rand -hex 32`
- `NEXT_PUBLIC_SERVER_URL` — the public HTTPS URL NPM serves
- `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` — for invites / password resets
- `CRON_SECRET` — `openssl rand -hex 32`, shared between app + cron sidecar
- `MEDIA_PATH` — host path mounted into the app container at `/app/public/media`
- `APP_BIND` — interface to publish port 3000 on. Default `0.0.0.0` (all LAN interfaces, needed for off-box NPM). Set `127.0.0.1` if NPM runs on the same host.

### 3. TrueNAS media mount

On TrueNAS:

1. **Datasets** → create `tank/openmasjid/media`.
2. **Shares → NFS** → add the dataset; allow the web server's IP; check "Maproot user" = root.

On the web server:

```bash
sudo apt install nfs-common
sudo mkdir -p /mnt/truenas/openmasjid-media
# /etc/fstab:
truenas.local:/mnt/tank/openmasjid/media  /mnt/truenas/openmasjid-media  nfs  defaults,_netdev,soft,timeo=30  0 0
sudo mount -a
```

Then in `.env`:

```env
MEDIA_PATH=/mnt/truenas/openmasjid-media
```

The compose `app` service bind-mounts that path into `/app/public/media`. ZFS snapshots on TrueNAS now cover your uploads.

### 4. First boot

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f app    # watch Payload init + DB sync
```

Payload auto-syncs the schema on first boot. Once it's up, create the first user at `https://your-domain.tld/admin`.

### 5. Configure NPM

In the NPM UI → **Proxy Hosts → Add Proxy Host**:

- Domain names: `openmasjid.app`, `*.openmasjid.app`, plus any tenant custom domains (e.g. `icprosper.org`).
- Forward hostname: the openmasjid host's LAN IP or hostname (e.g. `192.168.1.50` or `openmasjid.lan`).
- Forward port: `3000`
- Scheme: `http` (NPM terminates TLS — talks to the app over plain HTTP on the LAN).
- **Block common exploits** on, **Websockets support** on.
- **SSL → Request a new SSL certificate with Let's Encrypt** (DNS challenge if you want the wildcard, HTTP challenge otherwise).
- **Advanced** tab, add:

  ```nginx
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  ```

The Host header is non-negotiable — middleware reads it for tenant resolution.

### 6. Deploy updates

```bash
cd /opt/openmasjid
git pull
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app cron
```

The rebuild is a clean image swap — no downtime for db/cron, ~5–10s of request drop while the new app container replaces the old. For true zero-downtime swap later, add a second app replica + loadbalance via NPM (or switch the compose to a rolling update pattern).

### 7. Backups

Add a Postgres dump to your TrueNAS daily via the host's cron:

```cron
0 3 * * * docker compose -f /opt/openmasjid/docker-compose.prod.yml exec -T db pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > /mnt/truenas/openmasjid-backups/db-$(date +\%F).sql.gz
```

Media is already on TrueNAS → snapshot the dataset on whatever schedule you prefer.

---

## Deploying without Docker (alternative)

If you'd rather run Node directly on the host, here's a plain-systemd setup. Skip this section if you're using Docker above.

### 1. Prereqs on the box

- Node.js ≥ 20.9.0
- Postgres 16 (either `apt install` or Docker — mirror the local `docker-compose.yml` if you want the Docker route)
- A reverse proxy terminating TLS (nginx, Caddy, or Traefik)

### 2. Clone + build

```bash
git clone https://github.com/majidtahir1/open-masjid.git /opt/openmasjid
cd /opt/openmasjid
npm ci
npm run build
```

### 3. Environment

Create `/opt/openmasjid/.env`:

```env
DATABASE_URI=postgres://USER:PASSWORD@localhost:5432/openmasjid
PAYLOAD_SECRET=<32-byte random hex, from openssl rand -hex 32>
NEXT_PUBLIC_SERVER_URL=https://your-domain.tld

# Email (optional — unset = console log only)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM_ADDRESS=noreply@your-domain.tld
EMAIL_FROM_NAME=YourMasjid

# Scheduled publishing cron
CRON_SECRET=<another 32-byte random hex>
```

Tighten permissions so only the service user can read it:

```bash
chown openmasjid:openmasjid /opt/openmasjid/.env
chmod 600 /opt/openmasjid/.env
```

### 4. systemd unit

Create `/etc/systemd/system/openmasjid.service`:

```ini
[Unit]
Description=OpenMasjid (Next.js + Payload)
After=network.target postgresql.service

[Service]
Type=simple
User=openmasjid
WorkingDirectory=/opt/openmasjid
EnvironmentFile=/opt/openmasjid/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Enable + start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now openmasjid
sudo systemctl status openmasjid
sudo journalctl -u openmasjid -f    # live logs
```

### 5. Reverse proxy (nginx example)

Point a server block at `http://localhost:3000`, terminate TLS with Let's Encrypt, forward the `Host` header (middleware needs it for tenant resolution):

```nginx
server {
  server_name your-domain.tld *.your-domain.tld;
  listen 443 ssl http2;
  # ... ssl_certificate / ssl_certificate_key ...

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### 6. Scheduled-publishing cron

The app doesn't run its own scheduler in production. A host crontab drains Payload's job queue every minute:

```bash
crontab -e -u openmasjid
```

Add (replace `<cron-secret>` with your `CRON_SECRET` value — cron doesn't read your `.env`):

```cron
* * * * * curl -fsS -X POST https://your-domain.tld/api/payload-jobs/run -H "X-Cron-Secret: <cron-secret>" >> /var/log/openmasjid-jobs.log 2>&1
```

Make sure the log file is writable:

```bash
sudo touch /var/log/openmasjid-jobs.log
sudo chown openmasjid:openmasjid /var/log/openmasjid-jobs.log
```

Verify: `tail -f /var/log/openmasjid-jobs.log` — you should see a JSON response each minute (`{"noJobsRemaining":true,...}` when the queue is empty).

### 7. Deploy updates

```bash
cd /opt/openmasjid
git pull
npm ci
npm run build
sudo systemctl restart openmasjid
```

Payload auto-syncs DB schema on boot in dev; for prod you should switch to explicit migration files via `npx payload migrate:create` (tracked separately — see backlog).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm run lint` | ESLint |
| `npm run generate:types` | Regenerate `payload-types.ts` from collections |
| `npm run seed` | Seed the database |

## Project structure

```
src/
├── app/              # Next.js app router (public site + /admin)
├── collections/      # Payload collections — the source of truth for the DB schema
├── access/           # Access control helpers
├── components/       # Shared React components
├── fields/           # Reusable Payload field definitions
├── hooks/            # Payload collection hooks
├── lib/              # Utilities
├── middleware.ts     # Tenant resolution
└── payload.config.ts # Payload config entry point
```

## Schema changes

The DB schema is defined by the Payload collections in `src/collections/`. On a fresh clone, starting the dev server creates all tables. When you change a collection, Payload auto-syncs the schema in dev. For production, consider switching to explicit migration files via `npx payload migrate:create`.

## Troubleshooting

- **`ECONNREFUSED` on port 5432** — the `.env` `DATABASE_URI` must use port **5433** (the host-mapped port in `docker-compose.yml`).
- **`payload-types.ts` missing** — run `npm run generate:types`. The file is gitignored and generated locally.
- **Reset the DB** — `docker compose down -v` removes the `pgdata` volume. Next `up -d` starts fresh.
