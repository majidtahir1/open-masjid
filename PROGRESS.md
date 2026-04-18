# Build Progress — OpenMasjid Platform

_Last updated: Wave 4A complete — admin UX overhauled. Prayer schedules redesigned, custom dashboard, field polish._

Kanban-style tracking for the autonomous build. Updated as agents complete work.

---

## 📋 Backlog

### Phase 1 — MVP (ICP tenant)

**Foundation**
- [ ] Scaffold Next.js + Payload CMS project
- [ ] Configure PostgreSQL via Docker Compose (local dev)
- [ ] Set up TypeScript, ESLint, Prettier
- [ ] Port `colors_and_type.css` design tokens to `app/globals.css`
- [ ] Configure Tailwind CSS with design tokens
- [ ] Set up `next/font` for Fraunces, Inter, Amiri

**Content Model (Payload Collections)**
- [ ] `Tenants` collection — name, slug, customDomains, siteType, branding
- [ ] `Users` collection — extends Payload auth, tenant relationship, role
- [ ] `Media` collection — with tenant scoping
- [ ] `Events` collection — all fields per ARCHITECTURE.md
- [ ] `HeroSlides` collection
- [ ] `PrayerTimes` collection
- [ ] `Announcements` collection
- [ ] `Services` collection
- [ ] `Pages` collection
- [ ] `SiteSettings` global (per-tenant)

**Multi-Tenancy**
- [ ] Domain-to-tenant resolution middleware
- [ ] Tenant context provider
- [ ] Access control hooks for all collections (tenant scoping)
- [ ] Platform admin context (admin.openmasjid.app routing)
- [ ] Custom domain vs subdomain handling
- [ ] Block /admin route on custom domains

**Components (port from design system prototypes)**
- [ ] `Header` component (client, mobile menu)
- [ ] `PrayerStrip` component (server, today's times)
- [ ] `Hero` component (client, slider with 4 accent themes)
- [ ] `ServicesGrid` component (server)
- [ ] `EventCard` component (server, 3 display modes)
- [ ] `EventsList` component (server)
- [ ] `Flyer` component (auto-generated branded flyers)
- [ ] `DonateCTA` component (server)
- [ ] `Footer` component (server)

**Pages**
- [ ] Home page (Hero + PrayerStrip + Events + Services + DonateCTA)
- [ ] Events list page
- [ ] Event detail page
- [ ] Prayer times page (full schedule)
- [ ] Donate page (with amount picker, external link mode)
- [ ] About page
- [ ] Dynamic CMS pages (`[slug]`)

**Tenant Skinning**
- [ ] Branding config UI in Payload admin (color pickers)
- [ ] Live preview of color choices
- [ ] CSS variable injection based on tenant branding
- [ ] Auto-derive hover/press/soft color variants
- [ ] Logo upload and display in header
- [ ] Display font selection from curated list

**Platform Admin**
- [ ] Platform admin detection in middleware
- [ ] Tenant creation UI
- [ ] First-admin-user creation flow
- [ ] Tenant listing/management
- [ ] Platform owner role enforcement

**Testing**
- [ ] Seed ICP tenant with real data from design system
- [ ] Test multi-tenant isolation (create second test tenant)
- [ ] Test public site rendering with branding
- [ ] Test admin panel tenant scoping
- [ ] Smoke test: visit every page

**Deployment**
- [ ] Production Dockerfile
- [ ] Docker Compose stack (app + db + Caddy)
- [ ] Caddyfile with multi-domain config
- [ ] Environment variable documentation (`.env.example`)
- [ ] Backup script examples
- [ ] Deployment documentation

---

## 🏗 In Progress

_Nothing active. Ready for Wave 4B (Dockerfile, Caddyfile, deployment) when you're ready._

---

## ✅ Done

**Wave 1 — Foundation**
- ✅ Next.js 15.5.15 + Payload 3.39.1 scaffold (build passing)
- ✅ TypeScript strict, App Router, path aliases (@/*, @payload-config)
- ✅ payload.config.ts with Postgres adapter + Lexical editor
- ✅ .env with DATABASE_URI + generated PAYLOAD_SECRET
- ✅ Minimal homepage + admin panel + REST + GraphQL endpoints registered
- ✅ PostgreSQL 16.13 running in Docker (healthy, localhost:5432)
- ✅ Design tokens staged: globals.css, tailwind.config.ts, fonts.ts, postcss.config.js, assets
- ✅ Git repo initialized with initial commit

**Wave 2 — Integration & Core Data**
- ✅ Design tokens applied to scaffold; Tailwind utilities working (`bg-brand`, `type-display`, etc.)
- ✅ All 9 Payload collections defined: Tenants, Users, Media, Events, HeroSlides, PrayerTimes, Announcements, Services, Pages
- ✅ Tenant-scoped access helpers (`src/access/tenantScoped.ts`) + auto-set hook (`src/hooks/setTenantFromUser.ts`)
- ✅ Edge-safe multi-tenant middleware with host parsing (16/16 tests pass)
- ✅ Server-side tenant resolution (`src/lib/tenant-server.ts`)
- ✅ Client-side tenant context (`src/lib/context.ts`: TenantProvider, useTenant, useRequiredTenant)
- ✅ Runtime branding injection helper (`src/lib/tenantTheme.ts`)
- ✅ /admin blocked on custom domains (security)
- ✅ Build passing (34.4kB middleware, Edge-safe)

---

## 🚧 Blocked

_None currently blocking._

**To address in hardening wave:**
- 17 npm vulnerabilities (4 critical, 2 high, 11 moderate) in transitive deps
- Payload 3.39.1 vs latest — future dep refresh

---

## 📝 Notes & Decisions

- **Tech stack:** Next.js + Payload CMS 3.x + PostgreSQL, all self-hosted
- **Platform domain:** `openmasjid.app`
- **First tenant:** ICP (Islamic Center of Prosper)
- **Design system:** extracted at `/tmp/design_extracted/icp-prosper-design-system/`
- **Full architecture:** see `ARCHITECTURE.md`
