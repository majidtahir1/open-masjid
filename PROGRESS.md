# Build Progress — OpenMasjid Platform

_Last updated: Wave 1 started — scaffolding foundation_

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

**Wave 1 — Foundation (3 parallel agents)**
- 🔨 Agent A (Scaffolder): Next.js + Payload scaffold, deps, payload.config.ts, homepage, .env
- 🗄 Agent B (Database): Docker Compose for PostgreSQL, start, verify
- 🎨 Agent C (Design tokens): Prepare tokens CSS + Tailwind config + font setup (staged, applied after A finishes)

---

## ✅ Done

_None yet._

---

## 🚧 Blocked

_None yet._

---

## 📝 Notes & Decisions

- **Tech stack:** Next.js + Payload CMS 3.x + PostgreSQL, all self-hosted
- **Platform domain:** `openmasjid.app`
- **First tenant:** ICP (Islamic Center of Prosper)
- **Design system:** extracted at `/tmp/design_extracted/icp-prosper-design-system/`
- **Full architecture:** see `ARCHITECTURE.md`
