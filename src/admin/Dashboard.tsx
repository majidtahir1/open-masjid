/**
 * Custom admin home (dashboard) view for Payload.
 *
 * Shown at /admin instead of Payload's default collection list. Designed for
 * non-technical masjid staff: surfaces what they actually care about
 * (active prayer schedule, upcoming events, announcement count, quick
 * create buttons) without making them hunt through the sidebar.
 *
 * platformOwner users get a platform-wide summary instead.
 *
 * Implementation notes:
 * - This is a React Server Component that runs inside Payload's admin shell.
 *   We use `getPayload` + `payload.auth` to identify the user, then scope all
 *   queries to their tenant.
 * - All queries use `overrideAccess: true` because the user is already
 *   authenticated by the admin shell and we've already scoped by tenant in
 *   the query itself.
 * - Prayer schedule lookup tries the new `prayer-schedules` collection first
 *   (Agent J's refactor) and falls back to the legacy `prayer-times` shape
 *   so the dashboard keeps working mid-migration.
 */

import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@payload-config'

type TenantRef = string | number | { id: string | number; name?: string } | null | undefined
type UserLite = {
  id: string | number
  email?: string
  name?: string
  role?: 'platformOwner' | 'admin' | 'staff'
  tenant?: TenantRef
} | null

/** Extract the id out of a relationship that may be populated or a primitive. */
function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

/** Format a Date as a human-readable "Mon Apr 21, 6:30 PM". */
function formatWhen(d: string | Date | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Shape returned to the UI for the "Active prayer schedule" card. We collapse
 * both the new (nested group) and legacy (flat field) shapes into the same
 * structure so the render code doesn't have to branch.
 */
type ActiveScheduleView = {
  id: string | number
  name: string
  collectionSlug: 'prayer-schedules' | 'prayer-times'
  rows: Array<{ prayer: string; adhan: string; iqamah: string }>
}

/**
 * Resolve the tenant's currently-active prayer schedule. Prefers the new
 * `prayer-schedules` collection; falls back to the most recent row in the
 * legacy `prayer-times` collection.
 *
 * We `try/catch` around each collection lookup: one of them may not exist in
 * the current build (mid-migration) and that should not crash the dashboard.
 */
async function fetchActiveSchedule(
  payload: Awaited<ReturnType<typeof getPayload>>,
  tenantId: string | number,
): Promise<ActiveScheduleView | null> {
  const todayIso = new Date().toISOString()

  // 1. New collection: most recent schedule with startDate <= today.
  try {
    const dated = await payload.find({
      collection: 'prayer-schedules' as never,
      where: {
        tenant: { equals: tenantId },
        startDate: { less_than_equal: todayIso },
      },
      sort: '-startDate',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    let doc = dated.docs[0] as Record<string, unknown> | undefined

    // 2. Fall back to baseline (isCurrent: true) if no dated schedule matched.
    if (!doc) {
      const baseline = await payload.find({
        collection: 'prayer-schedules' as never,
        where: {
          tenant: { equals: tenantId },
          isCurrent: { equals: true },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      doc = baseline.docs[0] as Record<string, unknown> | undefined
    }

    if (doc) {
      const pick = (g: unknown): { adhan: string; iqamah: string } => {
        const group = (g ?? {}) as { adhan?: string | null; iqamah?: string | null }
        return { adhan: group.adhan ?? '—', iqamah: group.iqamah ?? '—' }
      }
      const fajr = pick(doc.fajr)
      const zuhr = pick(doc.zuhr)
      const asr = pick(doc.asr)
      const maghrib = pick(doc.maghrib)
      const isha = pick(doc.isha)
      return {
        id: doc.id as string | number,
        name: (doc.name as string) || 'Active schedule',
        collectionSlug: 'prayer-schedules',
        rows: [
          { prayer: 'Fajr', ...fajr },
          { prayer: 'Zuhr', ...zuhr },
          { prayer: 'Asr', ...asr },
          { prayer: 'Maghrib', ...maghrib },
          { prayer: 'Isha', ...isha },
        ],
      }
    }
  } catch {
    // Collection doesn't exist or query failed — try the legacy shape next.
  }

  // 3. Legacy collection: most recent `prayer-times` row for the tenant.
  try {
    const legacy = await payload.find({
      collection: 'prayer-times' as never,
      where: { tenant: { equals: tenantId } },
      sort: '-date',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = legacy.docs[0] as Record<string, unknown> | undefined
    if (!doc) return null
    const s = (k: string) => (doc[k] as string) || '—'
    const date = doc.date ? new Date(doc.date as string).toLocaleDateString() : 'today'
    return {
      id: doc.id as string | number,
      name: `Schedule for ${date}`,
      collectionSlug: 'prayer-times',
      rows: [
        { prayer: 'Fajr', adhan: s('fajrAdhan'), iqamah: s('fajrIqamah') },
        { prayer: 'Zuhr', adhan: s('zuhrAdhan'), iqamah: s('zuhrIqamah') },
        { prayer: 'Asr', adhan: s('asrAdhan'), iqamah: s('asrIqamah') },
        { prayer: 'Maghrib', adhan: s('maghribAdhan'), iqamah: s('maghribIqamah') },
        { prayer: 'Isha', adhan: s('ishaAdhan'), iqamah: s('ishaIqamah') },
      ],
    }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Styles — inline to avoid fighting Payload's SCSS layer ordering.    */
/* ------------------------------------------------------------------ */

/*
 * Colour strategy: we rely on Payload's own `--theme-elevation-*` scale
 * so the dashboard inverts correctly between light and dark admin themes.
 * Fallbacks assume light mode (white page) — that matches Payload's default.
 *
 *   elevation-0   → page bg (white / near-black)
 *   elevation-50  → slight off-bg tint
 *   elevation-100 → hairlines / borders
 *   elevation-500 → muted text
 *   elevation-800 → strong text
 *   elevation-1000 → highest-contrast text
 *
 * We never hard-code navy as a background — navy on navy is unreadable.
 * Accent colour (ICP teal) is reserved for links.
 */
const styles = {
  page: {
    padding: '2rem',
    maxWidth: 1200,
    margin: '0 auto',
    fontFamily: 'inherit',
    color: 'var(--theme-elevation-1000, #111)',
  } as React.CSSProperties,
  greeting: {
    fontSize: '1.75rem',
    fontWeight: 600,
    margin: 0,
    color: 'var(--theme-elevation-1000, #111)',
  } as React.CSSProperties,
  contextLine: {
    marginTop: '0.25rem',
    marginBottom: '1.75rem',
    color: 'var(--theme-elevation-500, #666)',
    fontSize: '0.95rem',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1.25rem',
  } as React.CSSProperties,
  card: {
    background: 'var(--theme-elevation-0, #ffffff)',
    border: '1px solid var(--theme-elevation-100, #e5e5e5)',
    borderRadius: 8,
    padding: '1.25rem 1.5rem',
    color: 'var(--theme-elevation-1000, #111)',
  } as React.CSSProperties,
  cardHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--theme-elevation-600, #444)',
  } as React.CSSProperties,
  cardLink: {
    fontSize: '0.85rem',
    textDecoration: 'none',
    color: 'var(--icp-teal, #28a0b4)',
    fontWeight: 500,
  } as React.CSSProperties,
  scheduleRow: {
    display: 'grid',
    gridTemplateColumns: '70px 1fr 1fr',
    gap: '0.5rem',
    padding: '0.4rem 0',
    borderBottom: '1px solid var(--theme-elevation-100, #eee)',
    fontSize: '0.95rem',
    color: 'var(--theme-elevation-900, #222)',
  } as React.CSSProperties,
  eventRow: {
    padding: '0.6rem 0',
    borderBottom: '1px solid var(--theme-elevation-100, #eee)',
  } as React.CSSProperties,
  eventTitle: {
    fontWeight: 500,
    margin: 0,
    color: 'var(--theme-elevation-1000, #111)',
  } as React.CSSProperties,
  eventWhen: {
    fontSize: '0.85rem',
    color: 'var(--theme-elevation-500, #666)',
    margin: '0.1rem 0 0',
  } as React.CSSProperties,
  bigNumber: {
    fontSize: '2.5rem',
    fontWeight: 700,
    margin: '0.25rem 0',
    color: 'var(--theme-elevation-1000, #111)',
  } as React.CSSProperties,
  quickRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    marginTop: '2rem',
  } as React.CSSProperties,
  quickBtn: {
    display: 'inline-block',
    padding: '0.7rem 1.2rem',
    borderRadius: 6,
    background: 'var(--icp-navy, #0f1e4a)',
    color: '#ffffff',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: 500,
    border: '1px solid var(--icp-navy, #0f1e4a)',
  } as React.CSSProperties,
  empty: {
    color: 'var(--theme-elevation-500, #888)',
    fontStyle: 'italic',
    fontSize: '0.9rem',
    margin: '0.5rem 0',
  } as React.CSSProperties,
}

/* ------------------------------------------------------------------ */
/* Card primitives                                                     */
/* ------------------------------------------------------------------ */

function Card({
  title,
  linkHref,
  linkLabel,
  children,
}: {
  title: string
  linkHref?: string
  linkLabel?: string
  children: React.ReactNode
}) {
  return (
    <section style={styles.card}>
      <header style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>{title}</h2>
        {linkHref && linkLabel ? (
          <a href={linkHref} style={styles.cardLink}>
            {linkLabel} →
          </a>
        ) : null}
      </header>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Tenant-scoped dashboard                                             */
/* ------------------------------------------------------------------ */

async function TenantDashboard({
  payload,
  user,
  tenantId,
}: {
  payload: Awaited<ReturnType<typeof getPayload>>
  user: NonNullable<UserLite>
  tenantId: string | number
}) {
  // Resolve tenant name for the context line — user.tenant may already be
  // populated, in which case we skip the extra query.
  let tenantName = 'your masjid'
  if (typeof user.tenant === 'object' && user.tenant && 'name' in user.tenant && user.tenant.name) {
    tenantName = user.tenant.name
  } else {
    try {
      const t = await payload.findByID({
        collection: 'tenants',
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })
      if (t?.name) tenantName = t.name as string
    } catch {
      // ignore; fall back to the default label
    }
  }

  // Fetch all three cards in parallel — keeps first paint snappy even with
  // a slow Postgres link.
  const [schedule, eventsRes, announcementsRes] = await Promise.all([
    fetchActiveSchedule(payload, tenantId),
    payload.find({
      collection: 'events',
      where: {
        tenant: { equals: tenantId },
        status: { equals: 'published' },
        or: [
          { startDate: { greater_than_equal: new Date().toISOString() } },
          { startDate: { exists: false } },
        ],
      },
      sort: 'startDate',
      limit: 3,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'announcements',
      where: {
        tenant: { equals: tenantId },
        active: { equals: true },
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const scheduleCollection = schedule?.collectionSlug ?? 'prayer-schedules'
  const scheduleEditHref = schedule
    ? `/admin/collections/${scheduleCollection}/${schedule.id}`
    : `/admin/collections/${scheduleCollection}`

  // If prayer-schedules isn't registered yet, point the quick-action button
  // at the legacy collection so the link still resolves.
  const newScheduleHref =
    schedule?.collectionSlug === 'prayer-times'
      ? '/admin/collections/prayer-times/create'
      : '/admin/collections/prayer-schedules/create'

  const displayName = user.name?.trim() || user.email || 'friend'

  return (
    <div style={styles.page}>
      <h1 style={styles.greeting}>Salam, {displayName}</h1>
      <p style={styles.contextLine}>Managing: {tenantName}</p>

      <div style={styles.grid}>
        {/* Active prayer schedule */}
        <Card
          title="Active Prayer Schedule"
          linkHref={scheduleEditHref}
          linkLabel="Update schedule"
        >
          {schedule ? (
            <>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--theme-elevation-500, #666)' }}>
                {schedule.name}
              </p>
              <div style={{ ...styles.scheduleRow, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--theme-elevation-500, #888)' }}>
                <div>Prayer</div>
                <div>Adhan</div>
                <div>Iqamah</div>
              </div>
              {schedule.rows.map((r) => (
                <div key={r.prayer} style={styles.scheduleRow}>
                  <div>{r.prayer}</div>
                  <div>{r.adhan}</div>
                  <div>{r.iqamah}</div>
                </div>
              ))}
            </>
          ) : (
            <p style={styles.empty}>
              No schedule set yet. Create one to populate the public prayer times page.
            </p>
          )}
        </Card>

        {/* Upcoming events */}
        <Card title="Upcoming Events" linkHref="/admin/collections/events/create" linkLabel="Add event">
          {eventsRes.docs.length > 0 ? (
            (eventsRes.docs as Array<{ id: string | number; title?: string; when?: string; startDate?: string }>).map(
              (e) => (
                <div key={e.id} style={styles.eventRow}>
                  <p style={styles.eventTitle}>
                    <a
                      href={`/admin/collections/events/${e.id}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {e.title || '(untitled)'}
                    </a>
                  </p>
                  <p style={styles.eventWhen}>
                    {e.startDate ? formatWhen(e.startDate) : e.when || 'No date set'}
                  </p>
                </div>
              ),
            )
          ) : (
            <p style={styles.empty}>No upcoming published events.</p>
          )}
        </Card>

        {/* Active announcements */}
        <Card
          title="Active Announcements"
          linkHref="/admin/collections/announcements"
          linkLabel="View announcements"
        >
          <p style={styles.bigNumber}>{announcementsRes.totalDocs}</p>
          <p style={{ margin: 0, color: 'var(--theme-elevation-500, #666)', fontSize: '0.9rem' }}>
            {announcementsRes.totalDocs === 1 ? 'announcement is live' : 'announcements are live'}
          </p>
        </Card>
      </div>

      {/* Quick actions */}
      <div style={styles.quickRow}>
        <a href="/admin/collections/events/create" style={styles.quickBtn}>
          + New Event
        </a>
        <a href="/admin/collections/announcements/create" style={styles.quickBtn}>
          + New Announcement
        </a>
        <a href={newScheduleHref} style={styles.quickBtn}>
          + New Prayer Schedule
        </a>
        <a href="/admin/collections/hero-slides/create" style={styles.quickBtn}>
          + New Hero Slide
        </a>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Platform-owner dashboard                                            */
/* ------------------------------------------------------------------ */

async function PlatformDashboard({
  payload,
  user,
}: {
  payload: Awaited<ReturnType<typeof getPayload>>
  user: NonNullable<UserLite>
}) {
  const [tenantsRes, usersRes, eventsRes] = await Promise.all([
    payload.find({ collection: 'tenants', limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'users', limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'events', limit: 0, depth: 0, overrideAccess: true }),
  ])

  const displayName = user.name?.trim() || user.email || 'friend'

  return (
    <div style={styles.page}>
      <h1 style={styles.greeting}>Salam, {displayName}</h1>
      <p style={styles.contextLine}>Platform Admin</p>

      <div style={styles.grid}>
        <Card title="Tenants" linkHref="/admin/collections/tenants" linkLabel="Manage tenants">
          <p style={styles.bigNumber}>{tenantsRes.totalDocs}</p>
          <p style={{ margin: 0, color: 'var(--theme-elevation-500, #666)', fontSize: '0.9rem' }}>
            masajid on the platform
          </p>
        </Card>
        <Card title="Users" linkHref="/admin/collections/users" linkLabel="Manage users">
          <p style={styles.bigNumber}>{usersRes.totalDocs}</p>
          <p style={{ margin: 0, color: 'var(--theme-elevation-500, #666)', fontSize: '0.9rem' }}>
            total staff accounts
          </p>
        </Card>
        <Card title="Events" linkHref="/admin/collections/events" linkLabel="View events">
          <p style={styles.bigNumber}>{eventsRes.totalDocs}</p>
          <p style={{ margin: 0, color: 'var(--theme-elevation-500, #666)', fontSize: '0.9rem' }}>
            total events across all tenants
          </p>
        </Card>
      </div>

      <div style={styles.quickRow}>
        <a href="/admin/collections/tenants/create" style={styles.quickBtn}>
          + Add Tenant
        </a>
        <a href="/admin/collections/users/create" style={styles.quickBtn}>
          + Add User
        </a>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Default export — dispatches to the right view based on role.        */
/* ------------------------------------------------------------------ */

export default async function Dashboard() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })

  // The admin shell already gates unauthenticated users to /admin/login,
  // but be defensive.
  if (!user) {
    return (
      <div style={styles.page}>
        <p>Please log in to view the dashboard.</p>
      </div>
    )
  }

  const u = user as NonNullable<UserLite>

  if (u.role === 'platformOwner') {
    return <PlatformDashboard payload={payload} user={u} />
  }

  const tenantId = tenantIdOf(u.tenant)
  if (!tenantId) {
    return (
      <div style={styles.page}>
        <h1 style={styles.greeting}>Salam, {u.name?.trim() || u.email}</h1>
        <p style={styles.contextLine}>No tenant assigned</p>
        <p style={styles.empty}>
          Your account is not linked to a masjid yet. Ask a platform admin to set your tenant.
        </p>
      </div>
    )
  }

  return <TenantDashboard payload={payload} user={u} tenantId={tenantId} />
}
