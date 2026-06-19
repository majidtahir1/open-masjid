# Admin Top-Bar Shell — Design

**Date:** 2026-06-18
**Status:** Approved (pending spec review)
**Branch:** `feat/sidebar-nudge-ansari-cleanup` (or a fresh `feat/admin-top-bar-shell`)

## 1. Goal

Replace Payload's default left-sidebar admin navigation with a full-width
**top-bar shell**: a horizontal nav with mega-menus, a global ⌘K command
palette, and a refreshed dashboard "hub". Navigation and the dashboard are
**role-aware** (admin / staff / kioskManager) and **responsive** (hamburger
drawer on small screens). Built from the approved `Admin Shell.dc.html` mockup.

This is a tenant-level shell. Platform owners keep working in the same admin;
they get a superset of nav plus the existing platform dashboard.

Out of scope for this pass: accessibility hardening (keyboard/ARIA/contrast),
a multi-tenant tenant switcher, and any "preview as role" demo affordance — nav
and dashboard are driven by the signed-in user's real role only.

## 2. Approach — Payload integration

Payload's `DefaultTemplate` renders:

```
.template-default
  ├─ aside.template-default__nav        ← the admin.components.Nav slot
  └─ .template-default__wrap
       ├─ .app-header                    ← breadcrumbs (step-nav) + account/theme
       └─ <view>                         ← dashboard / collection list / edit
```

**Plan:**

1. Register a custom `admin.components.Nav` → `TopBarNav`. This replaces the
   sidebar's *contents*.
2. In `src/app/(payload)/custom.scss`, **flip the layout**: promote the nav
   `aside` to a fixed, full-width bar at the top (`position: fixed; inset: 0 0
   auto 0; height: 62px`), and give `.template-default__wrap` a matching
   `padding-top` with no left gutter. Hide Payload's mobile `.nav-toggler`.
3. Keep Payload's `.app-header` as a slim secondary bar **below** our top bar —
   it provides breadcrumbs/back-context on edit pages. Suppress its duplicate
   account/theme controls via CSS (our avatar menu owns those). The dashboard
   view can hide breadcrumbs; deep views keep them.
4. The ⌘K palette is registered as a global `providers` entry (alongside
   `AnsariProvider`) so it works on every admin page, not just the dashboard.
5. The dashboard hub stays in the existing `admin.components.views.dashboard`
   slot (`Dashboard.tsx`), refreshed to the mockup layout.

**Why this over alternatives:** the `Nav` slot is Payload's intended override
point; all collection list/edit views, auth, and routing keep working natively
below the bar. A custom Next.js layout wrapping Payload would re-implement
routing/breadcrumbs (too big). An overlay-only bar that ignores the `Nav` slot
is hackier than using the slot. The repo already manipulates these exact
Payload DOM classes in `custom.scss` and `NavOrder.tsx`, so this extends an
established pattern rather than introducing a new dependency.

**Known risk:** the layout flip depends on Payload's template class names
(`.template-default`, `.template-default__nav`, `.template-default__wrap`,
`.app-header`, `.nav-toggler`). These are already depended on elsewhere in the
repo; selectors are written defensively and documented so a Payload upgrade has
one place to fix.

## 3. Components

All new admin components live under `src/admin/shell/`.

| Component | Type | Responsibility |
|---|---|---|
| `nav-config.ts` | data | Single source of truth: top-level items + mega-menu groups, each with `label`, `icon`, `href`/children, and `roles[]`. Also the palette's action list. Pure data + a `visibleFor(role)` filter. |
| `TopBarNav.tsx` | client (Nav slot) | Logo, role-filtered top-level items and mega-menus, ⌘K search affordance, View-site link, avatar → `AccountMenu`. Reads role/name/tenant via `useAuth()`. Manages open-menu + mobile-drawer + responsive state. |
| `MegaMenu.tsx` | client | Renders one dropdown (grid for Website, list for Displays/Forms/Community) from a nav-config group. Click-toggle + click-outside backdrop. |
| `AccountMenu.tsx` | client | Avatar dropdown: name/email, My Profile, Site Settings (admin only), View site, Sign out (Payload `logOut`). |
| `MobileDrawer.tsx` | client | Below ~860px: stacked, role-filtered sections from the same nav-config. |
| `CommandPalette.tsx` | client (provider) | Global ⌘K. Role-filtered actions + page jump-to from nav-config. Arrow/Enter/Esc, hover sync, empty state. Navigates via `next/navigation` `router.push`. |
| `CommandPaletteProvider.tsx` | client (provider) | Mounts the palette + global keydown listener; passes children through (mirrors `AnsariProvider`). |
| `Dashboard.tsx` (existing) | server | Refresh tenant view to the mockup hub. Reuse existing data-fetching; add a form-submissions count and a programs action. Platform-owner branch unchanged. |
| `custom.scss` (existing) | css | Layout flip, app-header suppression, top-bar styling, responsive rules. |

### nav-config shape

```ts
type Role = 'admin' | 'staff' | 'kioskManager' | 'platformOwner'
type NavLeaf = { label: string; href: string; icon: IconName; roles: Role[]; badge?: 'submissions' }
type NavGroup = { label: string; icon?: IconName; roles: Role[]; children: NavLeaf[] }
type NavItem  = NavLeaf | NavGroup
```

Top-level structure (hrefs are `/admin/collections/<slug>` and
`/admin/collections/<slug>/create` for actions):

- **Dashboard** — link — all roles
- **Prayer** — link → `prayer-schedules` — admin, staff
- **Website** — mega-menu — admin, staff — Events, Hero Slides, Announcements,
  Services, Pages, Media Library
- **Displays** — mega-menu — admin, staff, kioskManager — Prayer Display
  Content, Carousel Slides, Sponsor Slides, Weekly Events Slides, Kiosks, QR Codes
- **Forms** — mega-menu — admin, staff — Forms, Form Submissions (badge)
- **Community** — mega-menu — admin — Membership, Donations
- **Programs** — link → Sunday-school overview — admin, staff
- **(platformOwner extras)** — Tenants, Users surfaced for platformOwner

## 4. Role → visibility matrix

| Area | admin | staff | kioskManager | platformOwner |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Prayer (schedules) | ✓ | ✓ | — | ✓ |
| Website | ✓ | ✓ | — | ✓ |
| Displays | ✓ | ✓ | ✓ | ✓ |
| Forms | ✓ | ✓ | — | ✓ |
| Community (membership, donations) | ✓ | — | — | ✓ |
| Programs | ✓ | ✓ | — | ✓ |
| Account → Site Settings | ✓ | — | — | ✓ |
| Tenants / Users (platform) | — | — | — | ✓ |

Mirrors real access: `denyKioskManager` gates everything but Displays; Site
Settings (`tenants` update) is admin-only. The nav is a UX filter, not a
security boundary — collection access control remains the enforcement layer.

## 5. Responsive behavior

- Breakpoint at **860px**, tracked via a `width` state + `resize` listener in
  `TopBarNav` (the mockup's pattern).
- **≥860px:** full top bar with inline items + mega-menus; 248px search box.
- **<860px:** logo + hamburger (left), search icon + avatar (right). Hamburger
  opens `MobileDrawer` (stacked role-filtered sections). Search icon opens ⌘K.
- Dashboard grids reflow: quick-actions 4→2→1, status cards 3→2→1 (Tailwind
  responsive classes — already present in `Dashboard.tsx`).

## 6. Data flow

- **Role/identity:** `useAuth()` from `@payloadcms/ui` (client) gives
  `user.role`, `user.firstName/email`, `user.tenant`. `TopBarNav` and
  `CommandPalette` filter nav-config by `user.role`.
- **View-site URL:** tenant slug → `https://<slug>.openmasjid.app` (same as the
  dashboard computes today). For the bar, derive from `user.tenant` (populated)
  or fetch once.
- **Submissions badge:** server count of new `form-submissions` for the tenant,
  passed to the bar. Simplest: a tiny client fetch to
  `/api/form-submissions?where[tenant][equals]=<id>&limit=0` on mount (matches
  the `AnsariSettingsTab` fetch pattern). Mirror the same count on the
  dashboard's "Review submissions" card (server-side, reusing the dashboard's
  existing `payload.find` pattern).
- **Navigation:** `router.push(href)` from the palette; `<a href>` from the bar.
- **Sign out:** Payload `useAuth().logOut()`.

## 7. Dashboard hub refresh

Keep the existing server component structure and **all current data-fetching**
(`fetchActiveSchedule`, parallel events/announcements/counts, onboarding states,
tenant branding, platform-owner branch). Re-layout the tenant view to the
mockup:

- **Header:** "Salam, {name}" (Fraunces), "Managing {tenant}" pill, setup
  checklist pill ("N of 6 done") for admin — reuse `computeMilestoneStates`.
  Keep `OnboardingShell` (welcome wizard) mounted.
- **"Jump back in" quick actions (role-aware):**
  - admin/staff: Add event (featured dark/navy card), Create form, Review
    submissions (live badge), Review programs.
  - kioskManager: Update prayer display, Manage carousel, Manage kiosks.
- **Status cards (admin/staff):** Active Prayer Schedule (today's rows),
  Upcoming Events (3), Active Announcements (big Fraunces numeral). kioskManager
  gets display-oriented cards (kiosks online, carousel slide count, prayer
  display status).
- **Footer tip:** "press ⌘K to jump anywhere."

New data needed beyond what's fetched today: form-submissions count and a
programs (Sunday-school) entry point. Add to the existing parallel fetch block.

## 8. Edge cases & decisions

- **platformOwner:** no single tenant — bar shows the full menu set plus
  Tenants/Users; dashboard keeps the existing `PlatformDashboard` branch.
- **No tenant assigned:** bar degrades to Dashboard + account menu only;
  dashboard keeps its existing "No tenant assigned" state.
- **Dark mode:** Payload's account menu can toggle `[data-theme='dark']`. The
  bar uses navy chrome in both modes (like the current sidebar in `custom.scss`),
  so it's theme-stable; verify the dashboard cards still read in dark mode.
- **Tenant theming:** admin chrome stays platform-branded (navy/teal), NOT
  per-tenant — consistent with the decision that this mockup represents the
  tenant-level admin look, not tenant-colored chrome.
- **app-header coexistence:** if the slim secondary breadcrumb bar feels
  redundant on the dashboard, hide it there; keep it on collection/edit views.

## 9. Verification

- Manual: sign in as admin, staff, kioskManager (and platformOwner) and confirm
  each sees exactly the matrix in §4 in both the bar and ⌘K. Confirm collection
  pages still render below the bar with working breadcrumbs.
- Responsive: resize across 860px; confirm hamburger drawer + search icon +
  grid reflow.
- ⌘K: open/close, arrow/Enter navigation, role filtering, empty state.
- `npx tsc --noEmit` and `npx eslint` on all touched files.
- Run the dev server (port 3001, `demo.localhost` host) and screenshot each
  role's shell + the palette per the local-dev-verification practice.

## 10. File touch list

- New: `src/admin/shell/nav-config.ts`, `TopBarNav.tsx`, `MegaMenu.tsx`,
  `AccountMenu.tsx`, `MobileDrawer.tsx`, `CommandPalette.tsx`,
  `CommandPaletteProvider.tsx`.
- Edit: `src/payload.config.ts` (register `Nav` + palette provider), `Dashboard.tsx`
  (hub refresh), `src/app/(payload)/custom.scss` (layout flip + bar styles),
  `src/app/(payload)/admin/importMap.js` (regenerated).
- Likely retire/trim once the bar lands: `NavOrder.tsx`, `DashboardLink.tsx`,
  `HideMediaAndPeopleNav.tsx`, `HideTenantsNav.tsx`, the custom sidebar nav
  links (`donations/DonationsNav`, `membership/MembershipNav`,
  `school/SundaySchoolNav`), `ViewPublicSiteLink.tsx`, `ProfileLink.tsx`,
  `SiteSettingsCluster.tsx`, and the sidebar CSS in `custom.scss` — their
  responsibilities move into `nav-config` + the top bar. Confirm during
  implementation before deleting.
