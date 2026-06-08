<div align="center">

# OpenMasjid

### A modern website for your masjid — built for the age of AI agents.

Prayer times, events, donations, memberships, and a lobby display — all in one place,
managed by your volunteers instead of your IT vendor. And because every part of the
platform is exposed through a scoped, permissioned API, an AI assistant can run the
masjid for you just by being asked.

**Free to self-host. Open source. Agent-ready.**

![OpenMasjid homepage](docs/screenshots/marketing-home.png)

</div>

---

## What is OpenMasjid?

OpenMasjid is a ready-to-go website platform built specifically for mosques. Instead of
wrangling WordPress plugins or paying an agency, a volunteer can set up and run the whole
site themselves — or hand the day-to-day to **Ansari**, the platform's AI assistant, and
manage the masjid through chat.

One platform can host **many masajid** — each with its own web address, branding, and
content — so it works just as well for a single masjid as it does for an umbrella
organization running several.

It is designed from the ground up to be operated by AI agents: every collection sits
behind a default-deny, capability-scoped API, so an agent can be handed exactly the
permissions it needs (say, "create events and upload flyers") and nothing more. More on
that [below](#built-for-ai-agents).

Everything in this README is a real screenshot from the app.

---

## What your community sees

### Prayer times that just work

A full daily schedule with both **iqamah** (prayer start) and **adhan** (call to prayer)
times side by side, multiple Jummah slots, Hijri dates, and seasonal rules — set up for
the whole year in minutes. The next prayer also rides along the top of every page.

![Prayer times page](docs/screenshots/tenant-prayer-times.png)

### Events & programs

A clean community calendar for halaqas, youth nights, Ramadan programs, and gatherings.
Upload a flyer and OpenMasjid turns it into an event page — no design tools needed.

![Events page](docs/screenshots/tenant-events.png)

### Donations & memberships

Collect one-time donations and recurring memberships through Stripe. Members manage their
own subscriptions; the masjid sees who's signed up — no spreadsheets.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/tenant-donate.png" alt="Donations page" /></td>
<td width="50%"><img src="docs/screenshots/tenant-membership.png" alt="Membership page" /></td>
</tr>
</table>

### Lobby & display screens

Drive a TV or monitor in the lobby with a full-screen prayer board that auto-rotates the
next prayer, the Hijri date, and an Arabic ayah/hadith — in several built-in themes.

![Prayer display screen](docs/screenshots/kiosk-prayer-display.png)

When a prayer time arrives, the screen automatically takes over with a full-screen call to
prayer — *"Salah is in progress, please silence your phone"* — and returns to the rotation
afterward.

![Salah-in-progress takeover screen](docs/screenshots/kiosk-salah-takeover.png)

Between prayer boards, the display rotates a carousel of your own slides — event flyers,
weekly schedules, and sponsor/advertiser cards with QR codes. Pair a screen in seconds with
a 6-character code and push updates instantly from the admin.

<table>
<tr>
<td width="33%"><img src="docs/screenshots/kiosk-carousel-event.png" alt="Event flyer slide" /><br/><sub>Event flyer slide</sub></td>
<td width="33%"><img src="docs/screenshots/kiosk-sponsor-slide.png" alt="Sponsor slide" /><br/><sub>Sponsor / advertiser slide</sub></td>
<td width="33%"><img src="docs/screenshots/kiosk-weekly-events.png" alt="Weekly schedule slide" /><br/><sub>Weekly schedule slide</sub></td>
</tr>
</table>

### Everything a masjid needs. Nothing it doesn't.

A focused, opinionated feature set — prayer times, events, donations, branding, and
security — without the 60,000-plugin universe of a typical website builder.

![Features overview](docs/screenshots/marketing-features.png)

---

## What your volunteers manage

Behind the public site is a friendly admin (built on Payload CMS). The dashboard surfaces
the active prayer schedule, upcoming events, and live announcements at a glance.

![Admin dashboard](docs/screenshots/admin-dashboard.png)

Prayer schedules are date-ranged, so Ramadan, summer, and winter timings can all be set up
in advance and the public site automatically shows the right one. A timeline makes it
obvious which schedule is live today.

![Admin — prayer schedules with timeline](docs/screenshots/admin-prayer-list.png)

Events, announcements, pages, and hero slides all support scheduled publish/unpublish, so
volunteers can queue everything ahead of time.

![Admin — events](docs/screenshots/admin-events-list.png)

---

## Built for AI agents

OpenMasjid treats AI agents as first-class operators, not an afterthought. The same actions
a volunteer takes in the admin can be performed by an agent over the API — safely.

### Ansari, the AI assistant

**Ansari** ("the helper") is OpenMasjid's AI assistant. The idea is simple: run the masjid
by chatting with it. *"Move Isha iqamah to 9:45 starting next week."* *"Turn this flyer
into an event with an RSVP form."* *"How many people signed up for the dinner?"* Ansari
makes the change after showing you exactly what it will do (a diff-then-confirm flow), so
nothing happens behind your back.

Ansari is delivered through **[Hermes](https://github.com/NousResearch/hermes-agent)**
(Nous Research's open-source agent framework). The split is deliberate: OpenMasjid is the
**brain** — it owns the data, the rules, and the permissioned API — while Hermes is the
**mouth and ears**, owning the chat channel (e.g. Telegram), natural-language phrasing, and
timing. Each masjid runs as its own Hermes profile with its own scoped API key, so one
agent can never touch another masjid's data. The full design lives in
[`docs/superpowers/specs/`](docs/superpowers/specs/) (capability surface, multi-tenant
productization, and a proactive nudge engine).

### The capability surface (available today)

Any user can be issued an **API key** restricted to a set of **scopes**. Enforcement is
**default-deny**: a scoped key can only perform the exact `(collection, operation)` pairs
its scopes allow, and scopes can only *narrow* a role's permissions, never widen them.
Tenant isolation and billing locks still apply on top. (Implemented in
[`src/access/apiScoped.ts`](src/access/apiScoped.ts), with tenant scoping never applied to
normal UI sessions.)

| Scope | Grants |
| --- | --- |
| `prayer-times:read` / `:write` | Read or update prayer schedules and iqamah rules |
| `events:read` / `:write` | List, create, reschedule, publish events |
| `announcements:read` / `:write` | Read or post/edit/expire banner notices |
| `forms:read` / `:write` | Read submissions/counts, or create & edit signup forms |
| `members:read` | Look up and count members (read-only) |
| `media:read` / `:write` | Read or upload images and flyers |

### Skills

A set of **agent skills** package these capabilities into natural-language workflows. Each
skill knows which scopes it needs and walks the agent through calling the right endpoints
with a confirm-before-write pattern:

- **`flyer-to-event`** — parse an event flyer image into a titled, dated, located event, and
  optionally spin up an RSVP/signup form (uses `media:write`, `events:write`, `forms:write`).
- **`open-masjid-prayer-times`** — read or change adhan/iqamah times in plain language.
- **`open-masjid-events`** — list, reschedule, edit, publish, or delete events.
- **`open-masjid-announcements`** — post, edit, or take down banner notices.
- **`open-masjid-forms`** — build signup/registration forms and read RSVP counts.
- **`open-masjid-members`** — look up and count members (read-only).

> Skills live as Claude Code skills (each a single prompt file backed by the scoped REST
> API). They're the same workflows Ansari uses under the hood — and a human can run them
> too, just by asking.

---

## Two ways to run it

You can let OpenMasjid host your site, or run the exact same open-source code on your own
server. Either way, you own your content.

![Pricing — hosted or self-hosted](docs/screenshots/marketing-pricing.png)

| | Hosted | Self-hosted |
| --- | --- | --- |
| **Best for** | Masajid who want a website, not a sysadmin job | Masajid with a tech volunteer who'd rather own the box |
| **Setup** | Claim a subdomain, you're live | Follow the guide below |
| **Cost** | A monthly fee | Free forever |
| **Code** | Same open-source codebase | Same open-source codebase |

The rest of this README is the technical guide for running OpenMasjid yourself.

---

## For developers — running it yourself

OpenMasjid is a multi-tenant platform built with **Next.js 16** and **Payload CMS 3** on
**Postgres**.

### Prerequisites

- **Node.js** ≥ 20.9.0
- **Docker** (for the local Postgres container)
- **npm**

### Setup

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

> **Multi-tenant tip:** locally, each masjid lives at `<slug>.localhost:3000`
> (e.g. `icp.localhost:3000`). The bare `localhost:3000` serves the marketing site.

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

The production stack is four containers defined in `docker-compose.prod.yml`:

- **app** — Next.js + Payload, pulled from GHCR (`ghcr.io/majidtahir1/open-masjid`). Runs pending Payload migrations on startup, then serves. The image is built automatically by GitHub Actions on every merge to `main`.
- **db** — Postgres 16 with a persistent `pgdata` volume.
- **cron** — Alpine crond sidecar that hits `/api/payload-jobs/run` every minute (scheduled-publish queue drain).
- **watchtower** — polls GHCR and auto-updates the **app** container when a new image is published (see [Deploy updates](#6-deploy-updates-automated-via-ghcr--watchtower)).

The stack sits behind an external reverse proxy — **Nginx Proxy Manager** typically running on a different host on your LAN. The app container publishes port 3000 on the host's LAN interface; NPM proxies to `http://<openmasjid-host-ip>:3000`.

### 1. Prereqs on the host

- Docker 24+ and Docker Compose v2 (`docker compose version`).
- An NFS mount from your TrueNAS (or any durable volume) for media uploads (optional but strongly recommended — container filesystems are ephemeral).
- Nginx Proxy Manager reachable on your LAN, already running.
- **GHCR pull auth.** The app image is published to GitHub Container Registry as a **private** package, so the host must be logged in before it can pull. Create a GitHub Personal Access Token (classic) with the **`read:packages`** scope, then:

  ```bash
  echo "<YOUR_PAT>" | docker login ghcr.io -u <your-github-username> --password-stdin
  ```

  This writes `~/.docker/config.json`, which both `docker compose pull` and the Watchtower sidecar use. (Watchtower mounts it read-only; override its path with `DOCKER_CONFIG_PATH` in `.env` if it lives elsewhere.)

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
- `APP_BIND` — interface to publish on. Default `0.0.0.0` (all LAN interfaces, needed for off-box NPM). Set `127.0.0.1` if NPM runs on the same host.
- `APP_HOST_PORT` — host port to publish (container always listens on 3000 internally). Default `3000`. Change if the host already runs something on 3000.

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

### 6. Deploy updates (automated via GHCR + Watchtower)

Deploys are automatic. On every merge to `main`, GitHub Actions (the `publish`
job in `.github/workflows/ci.yml`) builds the production app image and pushes it
to GHCR as `ghcr.io/majidtahir1/open-masjid:latest` (plus a `sha-<short>` tag for
the exact commit). The publish step is gated on the `test` + `build` jobs
passing. For cosmetic changes that don't need the full gate, include
`[fast-ship]` in the commit message to skip the test/build wait, or trigger the
workflow manually from the repo's **Actions** tab ("Run workflow").

On the host, the **watchtower** service polls GHCR every 5 minutes
(`WATCHTOWER_POLL_INTERVAL=300`). When a new `:latest` image is available it
pulls it, recreates the **app** container, and prunes the old image
(`WATCHTOWER_CLEANUP=true`). Only **app** is watched — it carries the
`com.centurylinklabs.watchtower.enable=true` label; `db` and `cron` are left
untouched. On startup the new app container runs `payload migrate` before
serving, so schema changes apply automatically. Recreate is a clean swap —
~5–10s of request drop while the new container replaces the old.

> **Two operational caveats.**
> 1. **`[fast-ship]` skips ALL tests**, not just the wait — no `tsc --noEmit`
>    and no `npm test` run on a fast-shipped commit (only the Docker `next
>    build` still gates it). Use it for genuinely cosmetic changes only; a type
>    or behavior regression can ship straight to `:latest`.
> 2. **A failed migration is a crash loop, not a clean failure.** Because the
>    app container is `restart: unless-stopped`, a migration that throws will
>    exit, restart, and fail again — the app never serves. Watchtower does not
>    auto-roll-back. Pinning `APP_IMAGE` to the previous `sha-` tag only helps
>    if the migration didn't already mutate the schema; a half-applied or
>    forward-only migration needs manual DB intervention (inspect
>    `docker compose -f docker-compose.prod.yml logs app`, fix the DB or the
>    migration, then redeploy). Test migrations against a staging copy before
>    relying on unattended deploys.

**Manual operations.**

```bash
cd /opt/openmasjid

# Force an immediate pull + restart of the app (don't wait for the poll):
docker compose -f docker-compose.prod.yml pull app
docker compose -f docker-compose.prod.yml up -d app

# Roll back to a specific build (e.g. a migration broke): pin APP_IMAGE to a
# known-good sha tag and bring it up. The tag is shown in the Actions run and
# on the GHCR package page. The sha tag is immutable, so Watchtower won't
# overwrite the pin.
APP_IMAGE=ghcr.io/majidtahir1/open-masjid:sha-<short> \
  docker compose -f docker-compose.prod.yml up -d app

# Return to auto-updates once a fixed :latest is published:
docker compose -f docker-compose.prod.yml up -d app
```

> `app.image` defaults to `:latest` via `${APP_IMAGE:-…}`, so a bare
> `docker compose up -d app` always tracks the auto-updated image. For a true
> zero-downtime swap later, add a second app replica + load-balance via NPM.

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

## Kiosk

OpenMasjid includes a tenant-scoped kiosk / display-monitor system. Each tenant can:

- Author **Carousel Slides**, **Sponsor Slides**, **Weekly Events Slides**, and a **QR-code library** in admin.
- Register physical **Kiosks**, pair them via a typed 6-character code, and optionally override the slide playlist per kiosk.
- Push immediate updates to a kiosk from the admin edit view; otherwise kiosks poll every 60 seconds.

Display URL: `https://<tenant>.openmasjid.app/kiosk`

Spec: `docs/superpowers/specs/2026-05-14-kiosk-integration-design.md`
Plan: `docs/superpowers/plans/2026-05-14-kiosk-integration.md`

## Troubleshooting

- **`ECONNREFUSED` on port 5432** — the `.env` `DATABASE_URI` must use port **5433** (the host-mapped port in `docker-compose.yml`).
- **`payload-types.ts` missing** — run `npm run generate:types`. The file is gitignored and generated locally.
- **Reset the DB** — `docker compose down -v` removes the `pgdata` volume. Next `up -d` starts fresh.

## License

MIT (see `package.json`) — free to use, modify, and self-host.
