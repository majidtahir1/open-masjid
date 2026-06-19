# Admin Top-Bar Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Payload's default left-sidebar admin nav with a role-aware, responsive top-bar shell (mega-menus + global ⌘K command palette) and refresh the dashboard hub to match the approved mockup.

**Architecture:** A custom component fills Payload's `admin.components.Nav` slot; `custom.scss` flips Payload's template layout so that nav renders as a fixed full-width bar with content flowing beneath it. A single `nav-config.ts` is the source of truth for both the bar and the palette and is filtered by the signed-in user's role. The palette mounts as a global provider. The dashboard view is restyled in place, reusing its existing server-side data fetching.

**Tech Stack:** Payload 3.x admin (React), `@payloadcms/ui` (`useAuth`, `useConfig`), Next.js App Router (`next/navigation`), shadcn/ui + Tailwind (already wired into `custom.scss`), lucide-react icons, Vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-06-18-admin-top-bar-shell-design.md`

**Reference mockup (visual source of truth):** Claude Design project `08512d8a-1dab-41d2-9d53-a4b95fefb69f`, file `Admin Shell.dc.html`. Colors/spacing already exist as tokens in `src/app/(payload)/custom.scss` (navy `--icp-navy-700/900`, teal `--icp-teal-500`, gold `--icp-gold-300`, Fraunces/Inter).

---

## File Structure

New, all under `src/admin/shell/`:
- `nav-config.ts` — nav/palette data + `visibleFor(role)` + `searchEntries(role, query)`. Pure, unit-tested.
- `nav-config.test.ts` — Vitest unit tests for the above.
- `icons.tsx` — maps `IconName` → lucide-react component (keeps `nav-config.ts` data-only / server-safe).
- `TopBarNav.tsx` — client; fills the `Nav` slot. Orchestrates bar + menus + drawer + responsive state.
- `MegaMenu.tsx` — client; one dropdown rendered from a nav group.
- `AccountMenu.tsx` — client; avatar dropdown (profile, site settings, view site, sign out).
- `MobileDrawer.tsx` — client; stacked nav for <860px.
- `CommandPalette.tsx` — client; ⌘K overlay. Consumes `searchEntries`.
- `CommandPaletteProvider.tsx` — client; mounts palette + global keydown, passes children through.

Modified:
- `src/payload.config.ts` — register `Nav` + palette provider.
- `src/app/(payload)/custom.scss` — layout flip + top-bar styling; retire sidebar rules (late task).
- `src/admin/Dashboard.tsx` — hub refresh.
- `src/app/(payload)/admin/importMap.js` — regenerated (dev server does this automatically).

Retired (late task, after the bar works): `NavOrder.tsx`, `DashboardLink.tsx`, `HideMediaAndPeopleNav.tsx`, `HideTenantsNav.tsx`, `ViewPublicSiteLink.tsx`, `ProfileLink.tsx`, `SiteSettingsCluster.tsx`, and the `*Nav` sidebar links under `donations/`, `membership/`, `school/`.

---

## Task 1: nav-config — data + role filter + palette search

**Files:**
- Create: `src/admin/shell/nav-config.ts`
- Test: `src/admin/shell/nav-config.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/admin/shell/nav-config.test.ts
import { describe, it, expect } from 'vitest'
import { NAV, visibleFor, searchEntries, type Role } from './nav-config'

describe('visibleFor', () => {
  it('admin sees every top-level area', () => {
    const labels = visibleFor('admin').map((i) => i.label)
    expect(labels).toEqual(
      expect.arrayContaining(['Dashboard', 'Prayer', 'Website', 'Displays', 'Forms', 'Community', 'Programs']),
    )
  })

  it('staff loses Community but keeps content areas', () => {
    const labels = visibleFor('staff').map((i) => i.label)
    expect(labels).toContain('Website')
    expect(labels).toContain('Forms')
    expect(labels).not.toContain('Community')
  })

  it('kioskManager only sees Dashboard and Displays', () => {
    expect(visibleFor('kioskManager').map((i) => i.label)).toEqual(['Dashboard', 'Displays'])
  })

  it('platformOwner sees content areas plus platform entries', () => {
    const labels = visibleFor('platformOwner').map((i) => i.label)
    expect(labels).toContain('Community')
    expect(labels).toContain('Tenants')
  })

  it('filters children of a mega-menu by role', () => {
    const displaysForKiosk = visibleFor('kioskManager').find((i) => i.label === 'Displays')
    expect(displaysForKiosk && 'children' in displaysForKiosk).toBe(true)
    // Kiosk keeps all Displays children
    const kids = (displaysForKiosk as { children: { label: string }[] }).children.map((c) => c.label)
    expect(kids).toContain('Kiosks')
  })
})

describe('searchEntries', () => {
  it('returns actions and pages matching the query for the role', () => {
    const res = searchEntries('admin', 'event')
    expect(res.actions.some((a) => /event/i.test(a.label))).toBe(true)
    expect(res.pages.some((p) => /event/i.test(p.label))).toBe(true)
  })

  it('empty query returns the full role-scoped set', () => {
    const res = searchEntries('staff', '')
    expect(res.pages.length).toBeGreaterThan(0)
    expect(res.actions.length).toBeGreaterThan(0)
  })

  it('excludes entries the role cannot see', () => {
    const res = searchEntries('kioskManager', '')
    expect(res.pages.every((p) => p.roles.includes('kioskManager'))).toBe(true)
    expect(res.pages.some((p) => p.label === 'Donations')).toBe(false)
  })

  it('no matches yields empty arrays', () => {
    const res = searchEntries('admin', 'zzzznope')
    expect(res.actions).toEqual([])
    expect(res.pages).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/admin/shell/nav-config.test.ts`
Expected: FAIL — "Cannot find module './nav-config'".

- [ ] **Step 3: Implement `nav-config.ts`**

```ts
// src/admin/shell/nav-config.ts
// Single source of truth for the admin top-bar nav AND the ⌘K palette.
// Data-only (no JSX) so it can be imported anywhere. Icons resolve via
// ./icons.tsx by IconName. Nav is a UX filter — collection access control
// remains the real security boundary.

export type Role = 'admin' | 'staff' | 'kioskManager' | 'platformOwner'

export type IconName =
  | 'dashboard' | 'clock' | 'globe' | 'calendar' | 'image' | 'megaphone'
  | 'tag' | 'file' | 'monitor' | 'sparkles' | 'grid' | 'qr' | 'fileText'
  | 'inbox' | 'users' | 'heart' | 'graduation' | 'building' | 'settings' | 'user'

export type NavLeaf = {
  kind: 'leaf'
  label: string
  href: string
  icon: IconName
  description?: string
  roles: Role[]
  badge?: 'submissions'
}

export type NavGroup = {
  kind: 'group'
  label: string
  icon?: IconName
  roles: Role[]
  layout: 'grid' | 'list'
  children: NavLeaf[]
}

export type NavItem = NavLeaf | NavGroup

const ADMIN_BASE = '/admin/collections'

// Helper to keep declarations terse.
const leaf = (
  label: string, href: string, icon: IconName, roles: Role[],
  extra: Partial<Pick<NavLeaf, 'description' | 'badge'>> = {},
): NavLeaf => ({ kind: 'leaf', label, href, icon, roles, ...extra })

const ALL: Role[] = ['admin', 'staff', 'kioskManager', 'platformOwner']
const CONTENT: Role[] = ['admin', 'staff', 'platformOwner']
const ADMIN_ONLY: Role[] = ['admin', 'platformOwner']
const DISPLAYS: Role[] = ['admin', 'staff', 'kioskManager', 'platformOwner']

export const NAV: NavItem[] = [
  leaf('Dashboard', '/admin', 'dashboard', ALL),
  leaf('Prayer', `${ADMIN_BASE}/prayer-schedules`, 'clock', CONTENT),
  {
    kind: 'group', label: 'Website', icon: 'globe', roles: CONTENT, layout: 'grid',
    children: [
      leaf('Events', `${ADMIN_BASE}/events`, 'calendar', CONTENT, { description: 'Classes, programs, gatherings' }),
      leaf('Hero Slides', `${ADMIN_BASE}/hero-slides`, 'image', CONTENT, { description: 'Homepage hero cards' }),
      leaf('Announcements', `${ADMIN_BASE}/announcements`, 'megaphone', CONTENT, { description: 'Site-wide notices' }),
      leaf('Services', `${ADMIN_BASE}/services`, 'tag', CONTENT, { description: 'Nikah, funeral, Ansar…' }),
      leaf('Pages', `${ADMIN_BASE}/pages`, 'file', CONTENT, { description: 'Static site pages' }),
      leaf('Media Library', `${ADMIN_BASE}/media`, 'image', CONTENT, { description: 'Photos & uploads' }),
    ],
  },
  {
    kind: 'group', label: 'Displays', icon: 'monitor', roles: DISPLAYS, layout: 'list',
    children: [
      leaf('Prayer Display Content', `${ADMIN_BASE}/prayer-display-content`, 'monitor', DISPLAYS),
      leaf('Carousel Slides', `${ADMIN_BASE}/carousel-slides`, 'monitor', DISPLAYS),
      leaf('Sponsor Slides', `${ADMIN_BASE}/sponsor-slides`, 'sparkles', DISPLAYS),
      leaf('Weekly Events Slides', `${ADMIN_BASE}/weekly-events-slides`, 'grid', DISPLAYS),
      leaf('Kiosks', `${ADMIN_BASE}/kiosks`, 'monitor', DISPLAYS),
      leaf('QR Codes', `${ADMIN_BASE}/qr-codes`, 'qr', DISPLAYS),
    ],
  },
  {
    kind: 'group', label: 'Forms', icon: 'fileText', roles: CONTENT, layout: 'list',
    children: [
      leaf('Forms', `${ADMIN_BASE}/forms`, 'fileText', CONTENT),
      leaf('Form Submissions', `${ADMIN_BASE}/form-submissions`, 'inbox', CONTENT, { badge: 'submissions' }),
    ],
  },
  {
    kind: 'group', label: 'Community', icon: 'users', roles: ADMIN_ONLY, layout: 'list',
    children: [
      leaf('Membership', `${ADMIN_BASE}/members`, 'users', ADMIN_ONLY),
      leaf('Donations', `${ADMIN_BASE}/donations`, 'heart', ADMIN_ONLY),
    ],
  },
  leaf('Programs', `${ADMIN_BASE}/school-classes`, 'graduation', CONTENT),
  // platformOwner-only top-level entries.
  leaf('Tenants', `${ADMIN_BASE}/tenants`, 'building', ['platformOwner']),
  leaf('Users', `${ADMIN_BASE}/users`, 'users', ['platformOwner']),
]

// ⌘K quick-create actions (separate from page navigation).
export type PaletteAction = { label: string; group: string; href: string; roles: Role[] }

export const ACTIONS: PaletteAction[] = [
  { label: 'Create new event', group: 'Events', href: `${ADMIN_BASE}/events/create`, roles: CONTENT },
  { label: 'Create form', group: 'Forms', href: `${ADMIN_BASE}/forms/create`, roles: CONTENT },
  { label: 'New announcement', group: 'Announcements', href: `${ADMIN_BASE}/announcements/create`, roles: CONTENT },
  { label: 'New prayer schedule', group: 'Prayer', href: `${ADMIN_BASE}/prayer-schedules/create`, roles: CONTENT },
  { label: 'New hero slide', group: 'Website', href: `${ADMIN_BASE}/hero-slides/create`, roles: CONTENT },
  { label: 'Add carousel slide', group: 'Displays', href: `${ADMIN_BASE}/carousel-slides/create`, roles: DISPLAYS },
]

function roleOk(roles: Role[], role: Role): boolean {
  return roles.includes(role)
}

/** Top-level items visible to a role, with group children also role-filtered. */
export function visibleFor(role: Role): NavItem[] {
  return NAV.filter((i) => roleOk(i.roles, role)).map((i) => {
    if (i.kind === 'group') {
      return { ...i, children: i.children.filter((c) => roleOk(c.roles, role)) }
    }
    return i
  }).filter((i) => i.kind === 'leaf' || i.children.length > 0)
}

/** Flatten all role-visible leaves into palette "pages". */
function pagesFor(role: Role): NavLeaf[] {
  const out: NavLeaf[] = []
  for (const i of visibleFor(role)) {
    if (i.kind === 'leaf') out.push(i)
    else out.push(...i.children)
  }
  // De-dupe by href (Dashboard etc.).
  const seen = new Set<string>()
  return out.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)))
}

export type SearchResult = { actions: PaletteAction[]; pages: NavLeaf[] }

/** Role-scoped, query-filtered palette results. Empty query → full set. */
export function searchEntries(role: Role, query: string): SearchResult {
  const q = query.trim().toLowerCase()
  const match = (label: string, group: string) =>
    !q || `${label} ${group}`.toLowerCase().includes(q)
  return {
    actions: ACTIONS.filter((a) => roleOk(a.roles, role) && match(a.label, a.group)),
    pages: pagesFor(role).filter((p) => match(p.label, p.label)),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/admin/shell/nav-config.test.ts`
Expected: PASS (all cases). If `Programs` slug (`school-classes`) or `Membership` slug (`members`) differs in your config, fix the href and re-run — see Task 1a.

- [ ] **Step 5: Commit**

```bash
git add src/admin/shell/nav-config.ts src/admin/shell/nav-config.test.ts
git commit -m "feat(admin): nav-config source of truth for top-bar + palette"
```

---

## Task 1a: Verify collection slugs referenced by nav-config

**Files:** read-only check; fix `nav-config.ts` hrefs if mismatched.

- [ ] **Step 1: Confirm every href slug exists**

Run:
```bash
grep -rn "slug:" src/collections/*.ts | grep -Ei "prayer-schedules|events|hero-slides|announcements|services|pages|media|prayer-display-content|carousel-slides|sponsor-slides|weekly-events-slides|kiosks|qr-codes|forms|form-submissions|members|donations|school-classes|tenants|users"
```
Expected: each slug used in `nav-config.ts` appears. Note especially: Membership → confirm the collection slug (`members` vs `membership-tiers`); Programs → confirm the Sunday-school landing slug (`school-classes` vs another). Donations → `donations` vs `donation-funds`.

- [ ] **Step 2: Fix any mismatched hrefs in `nav-config.ts` and re-run Task 1 tests.**

Run: `npx vitest run src/admin/shell/nav-config.test.ts` → PASS. Commit only if changes were made:
```bash
git add src/admin/shell/nav-config.ts && git commit -m "fix(admin): correct nav-config collection slugs"
```

---

## Task 2: icons map

**Files:**
- Create: `src/admin/shell/icons.tsx`

- [ ] **Step 1: Implement the icon resolver**

```tsx
// src/admin/shell/icons.tsx
import {
  LayoutDashboard, Clock, Globe, Calendar, Image, Megaphone, Tag, File,
  Monitor, Sparkles, Grid3x3, QrCode, FileText, Inbox, Users, Heart,
  GraduationCap, Building2, Settings, User, type LucideIcon,
} from 'lucide-react'
import type { IconName } from './nav-config'

const MAP: Record<IconName, LucideIcon> = {
  dashboard: LayoutDashboard, clock: Clock, globe: Globe, calendar: Calendar,
  image: Image, megaphone: Megaphone, tag: Tag, file: File, monitor: Monitor,
  sparkles: Sparkles, grid: Grid3x3, qr: QrCode, fileText: FileText, inbox: Inbox,
  users: Users, heart: Heart, graduation: GraduationCap, building: Building2,
  settings: Settings, user: User,
}

export function NavIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  const Cmp = MAP[name] ?? File
  return <Cmp size={size} aria-hidden />
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/admin/shell/icons.tsx
git commit -m "feat(admin): icon resolver for shell nav"
```

---

## Task 3: CommandPalette + provider

**Files:**
- Create: `src/admin/shell/CommandPalette.tsx`
- Create: `src/admin/shell/CommandPaletteProvider.tsx`

The palette logic mirrors the approved mockup's `<script>` block; `searchEntries` (Task 1) replaces the mockup's inline filtering.

- [ ] **Step 1: Implement `CommandPalette.tsx`**

```tsx
'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import { searchEntries, type Role } from './nav-config'

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { user } = useAuth()
  const role = ((user as { role?: Role } | null)?.role ?? 'staff') as Role
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const { actions, pages } = useMemo(() => searchEntries(role, query), [role, query])
  const flat = useMemo(
    () => [...actions.map((a) => a.href), ...pages.map((p) => p.href)],
    [actions, pages],
  )

  useEffect(() => { if (open) { setQuery(''); setActive(0); inputRef.current?.focus() } }, [open])

  const go = (href: string) => { onClose(); router.push(href) }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = flat.length
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (n ? (i + 1) % n : 0)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (n ? (i - 1 + n) % n : 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[active]) go(flat[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  if (!open) return null
  const ai = flat.length ? Math.min(active, flat.length - 1) : 0
  return (
    <div className="omk" style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,56,.32)' }} />
      <div role="dialog" aria-modal style={{
        position: 'absolute', top: 88, left: '50%', transform: 'translateX(-50%)',
        width: 600, maxWidth: '92vw', background: '#fff', borderRadius: 16,
        boxShadow: '0 30px 80px rgba(10,22,56,.4)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '18px 20px', borderBottom: '1px solid #EEF0F0' }}>
          <input
            ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={onKeyDown} placeholder="Search pages and actions…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, background: 'transparent' }}
          />
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#F7F8F8', color: '#747C7C' }}>esc</span>
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: 10 }}>
          {actions.length > 0 && <Section title="Actions" items={actions.map((a, i) => ({ key: a.href, label: a.label, group: a.group, activeRow: i === ai, onClick: () => go(a.href) }))} />}
          {pages.length > 0 && <Section title="Go to" items={pages.map((p, i) => ({ key: p.href, label: p.label, group: p.label, activeRow: actions.length + i === ai, onClick: () => go(p.href) }))} />}
          {flat.length === 0 && <div style={{ padding: '34px 12px', textAlign: 'center', color: '#9CA4A4' }}>No matches for “{query}”</div>}
        </div>
      </div>
    </div>
  )
}

function Section({ title, items }: { title: string; items: { key: string; label: string; group: string; activeRow: boolean; onClick: () => void }[] }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA4A4', padding: '8px 12px 6px' }}>{title}</div>
      {items.map((it) => (
        <div key={it.key} onClick={it.onClick} style={{ display: 'flex', gap: 13, padding: '11px 12px', borderRadius: 10, cursor: 'pointer', background: it.activeRow ? '#EEF0FA' : 'transparent' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#141616' }}>{it.label}</div>
            <div style={{ fontSize: 12, color: '#9CA4A4' }}>{it.group}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Implement `CommandPaletteProvider.tsx`**

```tsx
'use client'
import React, { useEffect, useState } from 'react'
import { CommandPalette } from './CommandPalette'

// Mounted as a global admin provider so ⌘K works on every page.
export default function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o) }
    }
    window.addEventListener('keydown', onKey)
    // Allow the top bar's search affordance to open the palette.
    const openHandler = () => setOpen(true)
    window.addEventListener('om:open-palette', openHandler)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('om:open-palette', openHandler) }
  }, [])
  return (<>{children}<CommandPalette open={open} onClose={() => setOpen(false)} /></>)
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `@payloadcms/ui` `useAuth` types complain about `user.role`, the cast `as { role?: Role }` already guards it.)

- [ ] **Step 4: Commit**

```bash
git add src/admin/shell/CommandPalette.tsx src/admin/shell/CommandPaletteProvider.tsx
git commit -m "feat(admin): global ⌘K command palette"
```

---

## Task 4: MegaMenu + AccountMenu + MobileDrawer + TopBarNav

These are visual client components. The mockup `Admin Shell.dc.html` is the exact styling reference (navy `#0F1E4A` bar, teal hover `rgba(40,160,180,.20)`, 540px grid menu for Website, 300px list menus, 62px bar height). Build with inline styles matching the mockup (consistent with `TeamPanel.tsx`/`AnsariSettingsTab.tsx` precedent) plus the `custom.scss` rules from Task 5.

**Files:**
- Create: `src/admin/shell/MegaMenu.tsx`
- Create: `src/admin/shell/AccountMenu.tsx`
- Create: `src/admin/shell/MobileDrawer.tsx`
- Create: `src/admin/shell/TopBarNav.tsx`

- [ ] **Step 1: `MegaMenu.tsx` — render one group**

Contract: `props { group: NavGroup; open: boolean; onToggle: () => void }`. Renders a top-bar button (label + chevron, teal bg when `open`) and, when `open`, an absolutely-positioned panel. `group.layout === 'grid'` → 2-col card grid with `description`; `'list'` → single-column rows. Each child is an `<a href={child.href}>` with `<NavIcon name={child.icon} />`. Submissions badge: if `child.badge === 'submissions'`, render the count passed via context/prop (wire the live count in Task 6; render nothing if undefined). Panel styling per mockup: `background:#fff;border:1px solid #DDE1E1;border-radius:14px;box-shadow:0 18px 44px rgba(15,30,74,.20)`.

- [ ] **Step 2: `AccountMenu.tsx` — avatar dropdown**

Contract: `props { open: boolean; onToggle: () => void; user: { name: string; email: string; role: Role; initial: string }; viewSiteHref: string; showSettings: boolean }`. Avatar circle (`#28A0B4`, white initial). When open, a dropdown: header (name + email), `My Profile` → `/admin/account`, `Site Settings` → `/admin/collections/tenants/<tenantId>` (only if `showSettings`), `View site` → `viewSiteHref` (new tab), divider, `Sign out` → `useAuth().logOut()` then `router.push('/admin/login')`.

- [ ] **Step 3: `MobileDrawer.tsx` — stacked nav**

Contract: `props { open: boolean; items: NavItem[]; onNavigate: () => void }`. Full-width panel below the bar. Renders each top-level leaf as a row and each group as a section label + child rows. Links use `<a href>`; `onClick` calls `onNavigate` to close. Visible only when `open`.

- [ ] **Step 4: `TopBarNav.tsx` — orchestrator (fills the Nav slot)**

Contract: default export, client component. Responsibilities:
- `useAuth()` → `user`; derive `role` (`user.role ?? 'staff'`), display initial, name, email.
- Derive `items = visibleFor(role)`; `viewSiteHref` from tenant slug (`https://<slug>.openmasjid.app`; read `user.tenant` if populated, else omit the link).
- State: `openMenu: string | null`, `accountOpen: boolean`, `mobileOpen: boolean`, `width: number` (from a `resize` listener; `isMobile = width < 860`).
- Desktop (`!isMobile`): logo, top-level items (leaves as `<a>`, groups as `<MegaMenu>`), right cluster: search affordance (`onClick` dispatches `window.dispatchEvent(new Event('om:open-palette'))`, shows `⌘K`), View-site, `<AccountMenu>`. A full-screen transparent backdrop closes any open menu.
- Mobile (`isMobile`): logo + hamburger (toggles `mobileOpen`), right: search icon (dispatch `om:open-palette`) + avatar (`accountOpen`). Renders `<MobileDrawer>`.
- Exact colors/sizing per the mockup.

Skeleton (fill menu/visual detail to match mockup):

```tsx
'use client'
import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { visibleFor, type Role, type NavItem } from './nav-config'
import { NavIcon } from './icons'
import { MegaMenu } from './MegaMenu'
import { AccountMenu } from './AccountMenu'
import { MobileDrawer } from './MobileDrawer'

export default function TopBarNav() {
  const { user } = useAuth()
  const u = (user ?? {}) as { role?: Role; firstName?: string; email?: string; tenant?: unknown }
  const role: Role = u.role ?? 'staff'
  const items: NavItem[] = visibleFor(role)
  const [width, setWidth] = useState(1280)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    onResize(); window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const isMobile = width < 860
  const openPalette = () => window.dispatchEvent(new Event('om:open-palette'))
  // …render bar per mockup; see Steps 1-3 for child components…
  return <nav data-om-topbar /* styles + children */ />
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/admin/shell/MegaMenu.tsx src/admin/shell/AccountMenu.tsx src/admin/shell/MobileDrawer.tsx src/admin/shell/TopBarNav.tsx
git commit -m "feat(admin): top-bar nav, mega-menus, account menu, mobile drawer"
```

---

## Task 5: Register the shell in Payload + layout-flip CSS

**Files:**
- Modify: `src/payload.config.ts:106-141` (admin.components)
- Modify: `src/app/(payload)/custom.scss` (append layout-flip block)

- [ ] **Step 1: Register `Nav` and the palette provider**

In `src/payload.config.ts`, inside `admin.components`, add the `Nav` override and append the palette provider:

```ts
    components: {
      Nav: '/src/admin/shell/TopBarNav#default',
      // …existing beforeNavLinks/afterNavLinks/header/graphics/views unchanged for now…
      providers: [
        '/src/admin/ansari/AnsariProvider#default',
        '/src/admin/shell/CommandPaletteProvider#default',
      ],
    },
```

(Leave the existing `beforeNavLinks`/`afterNavLinks`/`header` entries in place until Task 8 retires them — harmless because the custom `Nav` replaces the sidebar contents.)

- [ ] **Step 2: Append the layout-flip CSS to `custom.scss`**

```scss
/* =========================================================================
 * Top-bar admin shell — promote Payload's Nav slot to a full-width bar and
 * flow content beneath it. Depends on Payload template class names; update
 * here if a Payload upgrade renames them (see also NavOrder history).
 * ========================================================================= */
.template-default {
  display: block;
}
.template-default__nav,
aside.nav {
  position: fixed;
  inset: 0 0 auto 0;
  height: 62px;
  width: 100%;
  z-index: 60;
  border-right: none;
  background: var(--icp-navy-700);
  overflow: visible; /* let mega-menus escape the bar */
}
.template-default__wrap {
  margin-left: 0 !important;
  width: 100% !important;
  padding-top: 62px;
}
/* Payload's mobile sidebar toggler is replaced by our own hamburger. */
.nav-toggler { display: none !important; }
/* Slim the native app header; our bar owns account/search. */
.app-header .app-header__controls,
.app-header .step-nav + * { /* keep breadcrumbs, hide duplicate account cluster if present */ }
```

- [ ] **Step 3: Restart dev server and verify the bar renders full-width above content**

Run (per local-dev-verification memory): dev server on port 3001, host `demo.localhost`. Load `/admin`. Expected: navy top bar spans the full width; the dashboard renders beneath it; no left sidebar gutter; ⌘K opens the palette.

- [ ] **Step 4: Commit**

```bash
git add src/payload.config.ts "src/app/(payload)/custom.scss"
git commit -m "feat(admin): mount top-bar shell + palette; flip Payload layout"
```

---

## Task 6: Dashboard hub refresh + live submissions count

**Files:**
- Modify: `src/admin/Dashboard.tsx` (TenantDashboard render + parallel fetch block)

Keep ALL existing data-fetching and the `PlatformDashboard` branch. Re-layout `TenantDashboard` to the mockup and add two data points.

- [ ] **Step 1: Add the submissions count and a programs count to the parallel fetch**

In `TenantDashboard`, extend the second `Promise.all` (currently `tenantDoc, prayerSchedulesCount, heroSlidesCount, eventsTotal`) with:

```ts
    payload
      .find({ collection: 'form-submissions', where: { tenant: { equals: tenantId } /* add unread filter if the collection has one */ }, limit: 0, depth: 0, overrideAccess: true })
      .then((r) => r.totalDocs)
      .catch(() => 0),
```
Capture it as `submissionsCount`.

- [ ] **Step 2: Re-layout the tenant view to the mockup hub**

- Header: keep `Salam, {displayName}` + Managing pill; add the setup-checklist pill ("`{done} of 6 done`") for `user.role === 'admin'` using `onboardingStates` (count milestones whose state is complete/dismissed).
- Replace the single "Quick actions" section with a **"Jump back in"** grid of 4 cards (role-aware):
  - admin/staff: `Add event` (featured navy card, `/admin/collections/events/create`), `Create form` (`/admin/collections/forms/create`), `Review submissions` (`/admin/collections/form-submissions`, badge `{submissionsCount}`), `Review programs` (`/admin/collections/school-classes`).
  - kioskManager: `Update prayer display`, `Manage carousel`, `Manage kiosks` (Displays hrefs).
- Keep the three status cards (Active Prayer Schedule, Upcoming Events, Active Announcements). Render the announcement count in a large Fraunces numeral (`font-family: var(--font-display)`).
- Footer: "press ⌘K to jump anywhere."

Use existing shadcn primitives (`Card`, `Button`, `Badge`) so dark mode keeps working.

- [ ] **Step 3: Typecheck + run unit tests (no dashboard unit tests, but ensure nothing else broke)**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck clean; existing suite green.

- [ ] **Step 4: Manual verify the hub**

Load `/admin` as an admin tenant user. Expected: greeting, setup pill, 4 quick-action cards (featured navy first), live submissions badge, 3 status cards, ⌘K tip.

- [ ] **Step 5: Commit**

```bash
git add src/admin/Dashboard.tsx
git commit -m "feat(admin): refresh dashboard hub to top-bar mockup"
```

---

## Task 7: Role + responsive verification pass

**Files:** none (verification + screenshots).

- [ ] **Step 1: Verify each role sees the §4 matrix**

For each of admin / staff / kioskManager (and platformOwner), sign in (use the demo creds per local-dev-verification; screenshot popovers rather than trusting clicks) and confirm the top-bar items AND ⌘K results match the role→visibility matrix. Expected: kioskManager sees only Dashboard + Displays; staff has no Community; admin/platformOwner see all.

- [ ] **Step 2: Verify responsive behavior**

Resize the window across 860px. Expected: below 860px → hamburger + search icon + avatar; drawer opens with role-filtered sections; dashboard grids reflow 4→2→1.

- [ ] **Step 3: Verify collection pages still work under the bar**

Open a collection list and an edit page. Expected: they render below the bar; breadcrumbs present; save works.

- [ ] **Step 4: Note results in the PR description (no commit).**

---

## Task 8: Retire the old sidebar machinery

Only after Tasks 5-7 pass. Remove what the top bar now supersedes.

**Files:**
- Modify: `src/payload.config.ts` (drop `beforeNavLinks`, `afterNavLinks`, and the nav-hiding `header` entries that targeted the sidebar)
- Modify: `src/app/(payload)/custom.scss` (remove the obsolete sidebar `.nav__link`/icon/reorder blocks; keep tokens, button/tab/focus/font rules, and the new top-bar block)
- Delete: `src/admin/NavOrder.tsx`, `DashboardLink.tsx`, `HideMediaAndPeopleNav.tsx`, `HideTenantsNav.tsx`, `ViewPublicSiteLink.tsx`, `ProfileLink.tsx`, `SiteSettingsCluster.tsx`, and the sidebar `*Nav` links under `donations/`, `membership/`, `school/` (verify each is unused elsewhere first).

- [ ] **Step 1: Confirm each candidate is referenced only by `payload.config.ts`**

Run for each file, e.g.:
```bash
grep -rn "NavOrder\|DashboardLink\|HideMediaAndPeopleNav\|HideTenantsNav\|ViewPublicSiteLink\|ProfileLink\|SiteSettingsCluster\|DonationsNav\|MembershipNav\|SundaySchoolNav" src --include=*.ts --include=*.tsx | grep -v payload.config.ts
```
Expected: no references outside the config (and the files themselves). Keep anything still referenced.

- [ ] **Step 2: Remove config entries + delete the unreferenced files + trim sidebar CSS**

Edit `payload.config.ts` to drop the retired `beforeNavLinks`/`afterNavLinks`/`header` nav entries (keep `Favicon`, `TenantThemeStyle`, and `views.dashboard`/`graphics.Logo`). Delete the files confirmed unreferenced. Remove the now-dead sidebar selectors from `custom.scss`.

- [ ] **Step 3: Typecheck, lint, build, and re-verify the admin loads**

Run: `npx tsc --noEmit && npx eslint src/admin src/payload.config.ts && npx vitest run`
Expected: all clean. Reload `/admin`: top bar + dashboard render; no console errors about missing components.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(admin): retire sidebar nav machinery superseded by top-bar shell"
```

---

## Self-Review Notes

- **Spec coverage:** §2 approach → Task 5; §3 components → Tasks 1-4, 6; §4 role matrix → Task 1 (encoded) + Task 7 (verified); §5 responsive → Task 4 + Task 7; §6 data flow → Tasks 3,4,6; §7 dashboard → Task 6; §8 edge cases (platformOwner/no-tenant/dark mode) → Task 1 (platformOwner/Tenants/Users), Task 6 (existing branches retained); §9 verification → Tasks 7, plus typecheck/lint steps throughout; §10 touch list → Tasks 5,8.
- **Slug risk:** Membership/Programs/Donations/Media slugs are verified in Task 1a before anything depends on them.
- **TDD reality:** only `nav-config` is cleanly unit-testable and is fully TDD'd (Task 1). The visual shell + dashboard are verified by typecheck/lint + manual/screenshot passes (Tasks 5-7), which is the honest test strategy for Payload admin chrome.
- **No security regression:** nav-config is a visibility filter only; collection access control is unchanged.
