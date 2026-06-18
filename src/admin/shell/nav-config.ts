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
  extra: Partial<Pick<NavLeaf, 'description'>> = {},
): NavLeaf => ({ kind: 'leaf', label, href, icon, roles, ...extra })

const ALL: Role[] = ['admin', 'staff', 'kioskManager', 'platformOwner']
const CONTENT: Role[] = ['admin', 'staff', 'platformOwner']
const ADMIN_ONLY: Role[] = ['admin', 'platformOwner']
// Displays currently coincides with ALL, but is kept distinct on purpose: it
// declares "every role can manage display content", which the access layer
// backs up — the six Displays collections use tenantScoped create/read (NOT
// denyKioskManager), so kioskManager genuinely reads and writes them. If a
// future collection narrows kiosk access, change DISPLAYS, not ALL.
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
  // Forms is a single link — submissions are viewed inside each form, not as a
  // standalone collection page (form-submissions is admin-hidden).
  leaf('Forms', `${ADMIN_BASE}/forms`, 'fileText', CONTENT),
  {
    kind: 'group', label: 'Community', icon: 'users', roles: ADMIN_ONLY, layout: 'list',
    children: [
      leaf('Membership', `${ADMIN_BASE}/members`, 'users', ADMIN_ONLY),
      leaf('Donations', `${ADMIN_BASE}/donations`, 'heart', ADMIN_ONLY),
    ],
  },
  // Programs → the custom Sunday-school hub (attendance, classes, students,
  // setup), NOT the raw school-classes collection list.
  leaf('Programs', '/admin/sunday-school', 'graduation', CONTENT),
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
    pages: pagesFor(role).filter((p) => match(p.label, '')),
  }
}
