# ICPC Web Platform — Architecture

A multi-tenant website platform for **ICPC (Islamic Center of Prosper & Celina)**, an umbrella organization with 3 masajid. Single deployment serves multiple masjid sites and one umbrella site, each with its own domain, branding, and content.

**First tenant:** ICP (Islamic Center of Prosper) — replacing the current WordPress/MadinaApps site.

**Future vision:** Open-source or commercial platform purpose-built for masajid.

---

## 1. Guiding Principles

- **Security-first.** No plugin ecosystem, minimal attack surface. This is the primary reason for leaving WordPress.
- **Non-technical staff manage content.** Adding events, uploading flyers, updating prayer times — all self-serve through the admin panel.
- **Multi-tenancy from day one.** Not bolted on later.
- **Self-hosted.** Full control over infrastructure and data. No vendor lock-in.
- **MIT-licensed stack.** Enables future open-source release or commercial use.
- **Design system-driven.** Consistent brand per tenant, tokens stored in the database.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Framework** | Next.js (App Router) | Server components for SEO, client components where needed |
| **CMS** | Payload CMS 3.x | Embedded into Next.js, code-first collections, MIT licensed |
| **Database** | PostgreSQL | Single instance, tenant isolation via relationship field |
| **Styling** | Tailwind CSS + CSS custom properties | Design tokens from `colors_and_type.css` |
| **Icons** | Lucide React | 1.75px stroke at 24px, `currentColor` |
| **Fonts** | Fraunces (display), Inter (body), Amiri (Arabic) | Via `next/font/google` |
| **Deployment** | Docker Compose, self-hosted | Single stack: app + database + reverse proxy |
| **Reverse Proxy** | Nginx, Caddy, or Traefik | Multi-domain TLS termination via Let's Encrypt |

### Why Payload CMS

| Alternative | Why Not |
|-------------|---------|
| WordPress | Security — plugin ecosystem is the #1 attack surface on the internet |
| Sanity | Cannot self-host. Vendor lock-in incompatible with product ambitions |
| Directus | BSL-1.1 license prohibits offering as a hosted commercial service |
| Strapi | Enterprise features (SSO, audit logs, review workflows) gated behind paid tier |
| EmDash | v0.1.0 beta, Astro-only, no headless mode yet |

---

## 3. Multi-Tenancy Architecture

### Tenant Model

Each masjid (and the ICPC umbrella) is a tenant — a row in the `tenants` collection:

```
tenants
├── name: "Islamic Center of Prosper"
├── slug: "icp"                              ← used for icp.openmasjid.app
├── customDomains: ["icprosper.org", "www.icprosper.org"]
├── siteType: "masjid" | "umbrella"
├── branding
│   ├── logo (upload)
│   ├── colors { brand, secondary, accent, ... }
│   └── fonts { display, body, arabic }
├── contactInfo { phone, email, address }
├── socialLinks [{ platform, url }]
└── donationConfig { mode, externalUrl, stripeAccountId }
```

### Domain Model

The platform uses two domain layers:

```
Platform domains (you control):
  openmasjid.app                     → Marketing site ("Launch your masjid's website")
  admin.openmasjid.app               → Platform owner admin panel
  icp.openmasjid.app                 → ICP tenant (admin + fallback public site)
  celina.openmasjid.app              → Celina tenant (admin + fallback public site)
  icpc.openmasjid.app                → ICPC umbrella tenant

Custom domains (masjid controls):
  icprosper.org                      → ICP public site (visitors)
  iccelina.org                       → Celina public site (visitors)
  icpc.org                           → ICPC umbrella public site
```

**Separation of concerns:**

| Domain | Who uses it | What they see |
|--------|-------------|---------------|
| `icprosper.org` | Visitors | Public site — prayer times, events, donate |
| `icp.openmasjid.app/admin` | ICP staff | Payload admin panel scoped to ICP |
| `admin.openmasjid.app` | Platform owner | Platform admin — manage all tenants |
| `openmasjid.app` | Prospective customers | Marketing / signup (future) |

**Key benefits:**
- Staff always goes to `theirmasjid.openmasjid.app` — consistent, easy to remember
- The masjid's custom domain stays clean — no `/admin` route exposed to the public
- Wildcard cert for `*.openmasjid.app` covers all tenant admin domains
- If a masjid doesn't have a custom domain yet, `theirmasjid.openmasjid.app` serves as their public site too

### Domain Resolution

```
                         ┌─────────────────┐
  openmasjid.app ──────▶ │                 │
  *.openmasjid.app ────▶ │  Reverse Proxy  │     ┌──────────────────┐
  icprosper.org ───────▶  │  (Caddy)        │────▶│  Next.js :3000   │
  iccelina.org ────────▶  │                 │     │  + Payload CMS   │
  icpc.org ────────────▶  │                 │     └────────┬─────────┘
                         └─────────────────┘              │
                                                           ▼
                                                    ┌──────────────┐
                                                    │ PostgreSQL   │
                                                    └──────────────┘
```

Next.js middleware reads `req.headers.host` and resolves context:

```
admin.openmasjid.app       → platform admin context (platformOwner role required)
icp.openmasjid.app         → tenant context: ICP (admin at /admin, public site at /)
icprosper.org              → tenant context: ICP (public site only, no /admin)
openmasjid.app             → marketing site context
```

The middleware looks up tenants by:
1. Subdomain of `openmasjid.app` → match against tenant `slug`
2. Custom domain → match against tenant `customDomains[]`

### Data Isolation

Every content collection has a required `tenant` relationship field. Payload access control enforces scoping on all CRUD operations:

- Staff users belong to a tenant → can only read/write their own tenant's content
- Platform owner bypasses tenant filtering → can see and manage all tenants
- The admin panel at `icp.openmasjid.app/admin` automatically filters to ICP's content
- The public site at `icprosper.org` only renders ICP's content

---

## 4. Content Model

### System Collections

**`tenants`**
- name, slug, domains[], siteType (`masjid` | `umbrella`)
- branding (logo, colors, fonts)
- contactInfo, socialLinks, donationConfig

**`users`**
- Extends Payload's built-in auth (email/password, session-based)
- tenant (relationship) — which masjid they belong to
- role: `superAdmin` | `admin` | `staff`

**`media`**
- Payload's built-in upload collection with tenant scoping
- Local disk initially, S3-compatible adapter for scale

### Masjid Site Collections

**`events`**
| Field | Type | Notes |
|-------|------|-------|
| title | text | e.g. "Evidences of Islam" |
| slug | text | Auto-generated |
| shortDescription | textarea | Card subtitle |
| description | richText | Full event detail page |
| tag | select | Weekly class, Ramadan, Eid, Sisters, Youth, Brothers, Community |
| audience | select (multi) | Families, Sisters, Youth, Brothers, All — for filtering |
| when | text | Human-readable: "Mondays after Isha" (many events are recurring patterns) |
| startDate | date (optional) | For sorting and auto-hiding past events |
| endDate | date (optional) | |
| location | text | e.g. "Main prayer hall" |
| address | text (optional) | |
| contact | email (optional) | |
| displayMode | select | `image` (uploaded flyer), `template` (auto-generated), `text` (no visual) |
| flyerImage | upload (optional) | When displayMode is `image` |
| templateVariant | select | `default` (cream), `navy`, `gold` — when displayMode is `template` |
| featured | checkbox | Show in hero slider |
| heroAccent | select | cream, teal, navy, gold — hero slide theme when featured |
| status | select | draft, published |
| tenant | relationship | Required, scoped |

**`heroSlides`**
| Field | Type | Notes |
|-------|------|-------|
| eyebrow | text | e.g. "Islamic Center of Prosper" |
| title | text | |
| body | textarea | |
| accent | select | cream, teal, navy, gold |
| ctas | array | [{ label, page, url, icon, primary }] |
| meta | text (optional) | e.g. "Monthly recurring available" |
| sortOrder | number | |
| active | checkbox | |
| tenant | relationship | |

Separate from events because the hero can show non-event content (mission statement, donation CTA, general announcements). Featured events also appear in the hero, pulled from the events collection.

**`prayerTimes`**
| Field | Type | Notes |
|-------|------|-------|
| date | date | The date these times apply to |
| fajrAdhan / fajrIqamah | text | |
| zuhrAdhan / zuhrIqamah | text | |
| asrAdhan / asrIqamah | text | |
| maghribAdhan / maghribIqamah | text | |
| ishaAdhan / ishaIqamah | text | |
| jummahTimes | array of text | e.g. ["12:45 PM", "1:30 PM", "2:15 PM"] |
| hijriDate | text (optional) | e.g. "27 Ramadan" |
| notes | text (optional) | e.g. "Taraweeh after Isha" |
| source | select | `manual`, `api`, `csv` |
| tenant | relationship | |

**`announcements`**
| Field | Type | Notes |
|-------|------|-------|
| title | text | |
| body | richText | |
| priority | select | normal, high |
| active | checkbox | |
| expiresAt | date (optional) | Auto-deactivate after this date |
| tenant | relationship | |

**`services`**
| Field | Type | Notes |
|-------|------|-------|
| title | text | e.g. "New Muslims (Ansar)" |
| description | textarea | |
| icon | text | Lucide icon name, e.g. "hand-heart" |
| sortOrder | number | |
| tenant | relationship | |

**`pages`**
| Field | Type | Notes |
|-------|------|-------|
| title | text | |
| slug | text | |
| content | richText | For arbitrary pages (About, etc.) |
| tenant | relationship | |

### Umbrella Site Collections (future — not fully designed)

The ICPC umbrella site will need its own content types:
- `masjidDirectory` — references to tenants, descriptions, featured flag
- `crossMasjidPrograms` — programs spanning multiple masajid
- `governance` — board members, bylaws, annual reports
- Shared collections (events, media, announcements) are already tenant-aware and work for the umbrella tenant

---

## 5. Frontend Architecture

### Routing

```
/(site)/                     → Home (Hero + PrayerStrip + Events + Services + DonateCTA)
/(site)/events               → Events list (filterable by audience/tag)
/(site)/events/[slug]        → Event detail
/(site)/prayer-times         → Full prayer schedule
/(site)/donate               → Donation page
/(site)/about                → About / mission
/(site)/[slug]               → CMS-driven static pages
/admin                       → Payload admin panel (tenant-scoped)
```

### Component Map

| Design Prototype | Production Component | Server/Client | Data Source |
|-----------------|---------------------|---------------|-------------|
| `Header.jsx` | `components/Header.tsx` | Client (mobile menu) | tenant branding + siteSettings |
| `PrayerStrip.jsx` | `components/PrayerStrip.tsx` | Server | prayerTimes (today) |
| `Hero.jsx` | `components/Hero.tsx` | Client (slider state) | heroSlides + featured events |
| `ServicesGrid.jsx` | `components/ServicesGrid.tsx` | Server | services |
| `EventsList.jsx` | `components/EventsList.tsx` | Server | events |
| `EventDetail.jsx` | `app/events/[slug]/page.tsx` | Server | events (single) |
| `Flyer.jsx` | `components/Flyer.tsx` | Server | event data (template variant) |
| `DonateCTA.jsx` | `components/DonateCTA.tsx` | Server | tenant donationConfig |
| `Footer.jsx` | `components/Footer.tsx` | Server | tenant contactInfo + socialLinks |
| `Pages.jsx` | `app/[slug]/page.tsx` | Server | pages |

### Per-Tenant Skinning

Every masjid gets the same components and layout — the platform's value is that they don't have to design anything. They customize the **skin** (colors, logo, fonts), not the structure.

#### What tenant admins can customize (via Payload admin)

| Setting | Type | Example |
|---------|------|---------|
| **Logo** | Upload | Their masjid logo |
| **Primary color** | Color picker | `#0F1E4A` (navy) |
| **Secondary color** | Color picker | `#28A0B4` (teal) |
| **Accent color** | Color picker | `#F0C88C` (gold) |
| **Display font** | Select from curated list | Fraunces, Playfair Display, Lora, etc. |
| **Hero image** | Upload | Photo of their masjid |
| **Favicon** | Upload | |

The admin UI should include a **live preview** so non-technical staff can see how their color choices look before saving.

#### How it works

Branding config is stored in the `tenants` collection. The root layout reads the tenant's branding and injects CSS custom properties:

```css
/* Base tokens provide defaults. Tenant overrides are injected inline. */
:root {
  --brand: #0F1E4A;         /* from tenant.branding.primaryColor */
  --brand-hover: #0A1638;   /* auto-derived (darken 10%) */
  --brand-press: #050B22;   /* auto-derived (darken 20%) */
  --brand-soft: #EEF0FA;    /* auto-derived (lighten 90%) */
  --secondary: #28A0B4;     /* from tenant.branding.secondaryColor */
  --accent: #F0C88C;        /* from tenant.branding.accentColor */
  --bg: #FFFFFF;
  --fg1: #141616;
  --fg2: #3A3F3F;
  /* ... full token set */
}
```

Hover, press, and soft variants are auto-derived from the base colors so tenant admins only pick 3 colors. Tailwind references these via CSS variables: `bg-brand`, `text-secondary`, `border-accent`, etc.

#### What tenant admins cannot customize

- Page layout / component structure
- Which sections appear on the homepage
- Component behavior (slider timing, card styles, etc.)
- Typography scale, spacing, radii, shadows

These are platform-level decisions that ensure consistency and reduce support burden.

#### Future: Templates

Eventually the platform can offer multiple **templates** — different page layouts and component arrangements (e.g., a "modern" template, a "traditional" template, a "minimal" template). A tenant admin would pick a template and then apply their skin on top of it.

Templates are a Phase 4+ feature. For MVP, one template (the ICP design) with per-tenant skinning.

---

## 6. Platform Admin (Super Admin Site)

The platform has two admin layers: the **platform admin** (you, the platform owner) and **tenant admins** (masjid staff). These are completely separate contexts.

### Domain Model

```
Platform:     admin.openmasjid.app         ← Platform owner
              Create masajid, onboard users, manage subscriptions,
              monitor all tenants, platform-level settings

Tenant:       icp.openmasjid.app/admin     ← ICP staff (their content only)
              celina.openmasjid.app/admin   ← Celina staff (their content only)
              anymasjid.openmasjid.app/admin← Any masjid's staff

Public:       icprosper.org                 ← ICP visitors (no /admin exposed)
              iccelina.org                  ← Celina visitors
```

The platform domain (`openmasjid.app`) is yours — not tied to any customer. ICPC is just the first customer. Staff always accesses admin via `*.openmasjid.app`, keeping the masjid's custom domain clean for visitors.

### Platform Admin Capabilities

| Capability | Description |
|------------|-------------|
| **Tenant management** | Create, edit, suspend, delete masajid |
| **Onboarding** | Create a new masjid → set up domain, branding, first admin user |
| **User management** | View/manage all users across all tenants |
| **Domain management** | Assign/update domains per tenant, update Caddyfile |
| **Monitoring** | Dashboard: active tenants, content stats, storage usage |
| **Billing** (future) | Subscription management, payment processing, invoicing |
| **Platform settings** | Default branding, email templates, global config |

### Tenant Admin Capabilities

Masjid staff access their own admin at their own domain (`icprosper.org/admin`). They never see the platform level. They never see other masajid.

| Role | Can Do |
|------|--------|
| `admin` | Full CRUD for their masjid — content, users, site settings, branding |
| `staff` | Manage events, prayer times, announcements, media. Cannot change site settings or manage users. |

### How It Works (same app, different context)

No separate application. The middleware detects the platform admin domain and renders a different admin experience:

```
Request to admin.openmasjid.app
  → middleware: platform context
  → Payload admin with platform collections visible (tenants, all users, billing)
  → No tenant scoping

Request to icp.openmasjid.app/admin
  → middleware: tenant context (ICP)
  → Payload admin with tenant collections visible (events, prayer times, etc.)
  → All queries scoped to ICP tenant

Request to icp.openmasjid.app (no /admin)
  → middleware: tenant context (ICP)
  → Public site rendered with ICP branding and content (fallback if no custom domain)

Request to icprosper.org
  → middleware: tenant context (ICP) via customDomains lookup
  → Public site only — /admin route blocked on custom domains
```

Payload supports this via its access control hooks and admin panel customization — different collections and views are shown based on the user's role and the request context.

### Onboarding a New Masjid (workflow)

1. Platform admin creates a new tenant at `admin.openmasjid.app` (name, slug, branding defaults)
2. Platform admin creates the first admin user for that masjid (email invite)
3. Platform admin adds the domain to the Caddyfile and restarts proxy (future: automated via API)
4. Masjid points their DNS to the platform server
5. Masjid admin logs into `theirmasjid.org/admin`, uploads logo, sets colors, starts adding content

### Future: Self-Service Onboarding

Phase 4 goal — a public signup page at `openmasjid.app` where a masjid can:
1. Sign up, choose a plan
2. Enter their masjid name, upload logo, choose colors
3. Get `theirmasjid.openmasjid.app` immediately (admin + public site)
4. Connect their custom domain later for the public-facing site
5. Payment via Stripe (if charging)

This removes you from the onboarding loop entirely.

## 7. Authentication & Authorization

### Roles

| Role | Scope | Can Do |
|------|-------|--------|
| `platformOwner` | Platform-wide | Everything — manage tenants, billing, platform settings, all users, all content |
| `admin` | Single tenant | Full CRUD for their masjid — content, users, site settings, branding |
| `staff` | Single tenant | Manage events, prayer times, announcements, media. Cannot change site settings or manage users. |

### Auth

- Payload's built-in auth (email/password, session-based)
- No public-facing user accounts in MVP — all content is public, admin is staff-only
- Access control: every collection's hooks check `user.tenant === doc.tenant` (or `user.role === 'platformOwner'`)
- Platform admin collections (tenants, billing) only accessible to `platformOwner` role

---

## 7. Deployment

### Architecture

Single Docker Compose stack. All masajid + the umbrella site are tenants in the same application — no reason to run multiple instances.

```
┌──────────────────────────────────────────────────┐
│  Docker Compose                                  │
│                                                  │
│  ┌───────────┐   ┌──────────┐   ┌────────────┐  │
│  │   Caddy   │──▶│   App    │──▶│ PostgreSQL │  │
│  │  :80/443  │   │  :3000   │   │   :5432    │  │
│  │  (proxy)  │   │ Next.js  │   │            │  │
│  │  AutoTLS  │   │+ Payload │   │            │  │
│  └───────────┘   └──────────┘   └────────────┘  │
│                                                  │
│  *.openmasjid.app ─────────┐                      │
│  icprosper.org ────────────┼──▶ Caddy ──▶ App     │
│  iccelina.org ─────────────┤                      │
│  icpc.org ─────────────────┘                      │
└──────────────────────────────────────────────────┘
```

### Docker Compose Stack

```yaml
services:
  app:
    image: ghcr.io/icpc/icpc-web:latest  # or your own registry
    restart: unless-stopped
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=postgres://icpc:${DB_PASSWORD}@db:5432/icpc
      - PAYLOAD_SECRET=${PAYLOAD_SECRET}
      - MEDIA_DIR=/data/media
    volumes:
      - media:/data/media
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      - POSTGRES_USER=icpc
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=icpc
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U icpc"]
      interval: 10s
      timeout: 5s
      retries: 5

  proxy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  pgdata:
  media:
  caddy_data:
  caddy_config:
```

### Caddyfile (multi-domain)

```
# Platform + all tenant admin subdomains
*.openmasjid.app {
    reverse_proxy app:3000
}

# Masjid custom domains (public sites)
icprosper.org, www.icprosper.org,
iccelina.org, www.iccelina.org,
icpc.org, www.icpc.org {
    reverse_proxy app:3000
}
```

Adding a new masjid domain = add a line to the Caddyfile and restart Caddy. TLS certificates are automatic via Let's Encrypt. Future: automate this via Caddy's admin API so the platform can add domains without manual file editing.

### Update Process

Code lives in a Git repo. Updates flow through a CI/CD pipeline:

```
Developer pushes to main
        │
        ▼
CI builds Docker image (GitHub Actions / Gitea Actions)
        │
        ▼
Image pushed to container registry (GHCR / self-hosted)
        │
        ▼
On server: pull and restart
```

**Applying an update on the server:**

```bash
docker compose pull app
docker compose up -d app
```

That's it. The old container stops, the new one starts. Downtime is a few seconds — negligible for a community site.

**Database migrations** happen automatically. Payload detects schema changes on startup and runs migrations against PostgreSQL. No separate migration step.

**Options for triggering updates:**

| Method | How | Best For |
|--------|-----|----------|
| **Manual pull** | SSH in, run `docker compose pull && up -d` | Full control over when updates go live |
| **Watchtower** | Container that watches your registry and auto-pulls new images | Hands-off, updates automatically |
| **Webhook** | CI hits a webhook on your server that triggers the pull | Automated but you control the trigger |

Recommendation: Start with manual pull. Add Watchtower or a webhook when you want hands-off updates.

### Adding a New Masjid

1. Platform admin creates tenant at `admin.openmasjid.app` (name, slug, domains, branding)
2. Platform admin creates the first admin user for the masjid (email invite)
3. Add the domain to the Caddyfile, `docker compose restart proxy`
4. Masjid points their DNS A record to the server
5. Masjid admin logs into `theirmasjid.org/admin` and starts managing content

No new containers, no new databases, no new deployments. Future: steps 3-4 automated via Caddy API + wildcard subdomain as temporary default.

### Media Storage

Local Docker volume initially (`media:/data/media`). When storage needs grow, switch to a self-hosted S3-compatible store (MinIO) — Payload has a built-in S3 adapter, just change the config.

### Backups

| What | How | Frequency |
|------|-----|-----------|
| Database | `docker exec db pg_dump -U icpc icpc > backup.sql` | Daily cron |
| Media | rsync or volume snapshot of `media` volume | Daily cron |
| Application | Code is in Git | Every push |
| Caddyfile / env | Include in Git or backup separately | On change |

Example backup cron:

```bash
# /etc/cron.d/icpc-backup
0 3 * * * docker exec icpc-web-db-1 pg_dump -U icpc icpc | gzip > /backups/db/icpc-$(date +\%Y\%m\%d).sql.gz
0 3 * * * rsync -a /var/lib/docker/volumes/icpc-web_media/_data/ /backups/media/
# Retain 30 days
0 4 * * * find /backups -mtime +30 -delete
```

### Future: Distributing to Other Masajid

Two distribution models:

1. **Hosted (SaaS):** Masajid sign up on `openmasjid.app`, get onboarded as tenants on your server. You manage infrastructure, they manage content. Revenue via subscriptions.

2. **Self-hosted (open source):** A masjid clones the repo, runs `docker compose up -d`, and has their own instance. The multi-tenant architecture means a single masjid running one instance works just as well — it's just one tenant. They manage everything themselves.

---

## 8. Open Decisions

### Prayer Times (to be finalized)

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: Manual entry** | Staff enters times in Payload admin weekly/monthly | Full control, simple | Requires regular updates |
| **B: API hybrid** | Aladhan API for adhan times, manual iqamah overrides | Less manual entry | External dependency |
| **C: Bulk CSV import** | Upload annual spreadsheet | One upload per year | Still need iqamah adjustments |

Recommendation: Start with A, add B/C later. Data model supports all three via `source` field.

### Donations (to be finalized)

| Option | Description |
|--------|-------------|
| **External link** | "Donate" button links to existing processor (LaunchGood, PayPal, etc.) |
| **Stripe integration** | On-site payment via Stripe Elements with Sadaqah/Zakat/Building Fund tabs |

Recommendation: Start with external link (configurable URL in tenant settings). Build Stripe integration as Phase 2.

### RSVP (to be finalized)

Options: link to Google Forms, simple built-in form that emails the masjid, or no RSVP initially.

---

## 9. Implementation Phases

### Phase 1 — MVP (ICP site)
- Scaffold Next.js + Payload + PostgreSQL + Docker
- Tenant model and middleware (single tenant for now, but architecture is multi-tenant)
- Core collections: events, prayerTimes, heroSlides, services, pages, media
- All public pages: Home, Events, Event Detail, Prayer Times, Donate, About
- Port design system components from prototypes to production React
- Admin panel with tenant-scoped access control
- Deployment: Docker Compose with reverse proxy

### Phase 2 — Enhancements
- Prayer times API hybrid (Aladhan)
- Donations (Stripe integration)
- Announcements with expiry
- Flyer auto-generation (server-side render of Flyer component to PNG/PDF)
- Email notifications (event reminders, prayer time changes)

### Phase 3 — Multi-Masjid
- Onboard second and third masajid as tenants
- Per-tenant branding and design systems
- ICPC umbrella site (new site type, umbrella-specific collections)
- Cross-masjid content sharing

### Phase 4 — Platform
- Open-source release prep
- Documentation and onboarding flow
- Multi-language support (English, Arabic, Urdu)
- Tenant self-service provisioning (if commercializing)

---

## 10. Design System Reference

The ICP design system is the reference implementation for the first tenant. Key files:

```
design-system/
├── colors_and_type.css      ← CSS custom properties: colors, type, spacing, radii, shadows, motion
├── README.md                ← Brand voice, visual foundations, iconography, layout rules
├── assets/
│   ├── logo-icp.jpg         ← Primary logo
│   └── flyer-evidences.jpg  ← Sample event flyer
├── preview/                 ← 16 design token preview cards
└── ui_kits/website/         ← JSX component prototypes to port
    ├── Header.jsx
    ├── Hero.jsx              ← Slider with 4 accent themes, auto-advance, pause on hover
    ├── PrayerStrip.jsx       ← Sticky prayer times bar
    ├── ServicesGrid.jsx      ← 6-service grid with Lucide icons
    ├── EventsList.jsx        ← 3 display modes: image flyer, template flyer, text-only
    ├── EventDetail.jsx       ← Centered flyer + details sidebar
    ├── Flyer.jsx             ← Auto-generated branded flyer (navy/gold/cream variants)
    ├── DonateCTA.jsx         ← Hadith quote + donate button
    ├── Footer.jsx            ← Contact, socials, copyright
    └── Pages.jsx             ← About, Donate, Prayer Times pages
```

### Brand Essentials (ICP — first tenant)

- **Primary:** Navy `#0F1E4A`
- **Secondary:** Teal `#28A0B4`
- **Accent:** Gold `#F0C88C`
- **Cream:** `#F0EFE8`
- **Night:** `#0E2A2C`
- **Voice:** Modern, warm, grounded, community-first. Never preachy, never hype.
- **Type:** Fraunces (display, warm serif), Inter (body, clean sans), Amiri (Arabic, classical Naskh)
- **Icons:** Lucide, stroke-only, 1.75px at 24px, `currentColor`
- **Layout:** 1200px max, 12-col grid, 24px gutters, 80px section padding
- **Radii:** 6px (inputs), 10px (cards), 14px (features), pill (badges), arch (devotional)
- **Shadows:** Teal-tinted `rgba(19, 46, 48, ...)`, 5 levels

### Project Structure

```
icp-web/
├── app/
│   ├── (site)/
│   │   ├── layout.tsx              ← Header + PrayerStrip + Footer wrapper
│   │   ├── page.tsx                ← Home
│   │   ├── about/page.tsx
│   │   ├── donate/page.tsx
│   │   ├── events/page.tsx
│   │   ├── events/[slug]/page.tsx
│   │   ├── prayer-times/page.tsx
│   │   └── [slug]/page.tsx         ← CMS-driven pages
│   ├── (payload)/
│   │   ├── admin/[[...segments]]/page.tsx
│   │   └── api/[...slug]/route.ts
│   ├── globals.css                 ← Design tokens
│   └── layout.tsx                  ← Root layout with fonts + tenant theming
├── components/
│   ├── Header.tsx
│   ├── PrayerStrip.tsx
│   ├── Hero.tsx
│   ├── ServicesGrid.tsx
│   ├── EventsList.tsx
│   ├── EventCard.tsx
│   ├── Flyer.tsx
│   ├── DonateCTA.tsx
│   └── Footer.tsx
├── collections/
│   ├── Tenants.ts
│   ├── Users.ts
│   ├── Events.ts
│   ├── HeroSlides.ts
│   ├── PrayerTimes.ts
│   ├── Announcements.ts
│   ├── Services.ts
│   ├── Pages.ts
│   └── Media.ts
├── globals/
│   └── SiteSettings.ts
├── middleware.ts                    ← Domain → tenant resolution
├── payload.config.ts
├── tailwind.config.ts
├── next.config.ts
├── Dockerfile
├── docker-compose.yml
└── ARCHITECTURE.md                  ← This file
```
