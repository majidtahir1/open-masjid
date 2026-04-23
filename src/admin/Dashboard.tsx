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
 *   and falls back to the legacy `prayer-times` shape so the dashboard keeps
 *   working mid-migration.
 * - UI is built with shadcn/ui primitives + Tailwind. Tailwind's components +
 *   utilities layers are loaded by `src/app/(payload)/custom.scss`, which
 *   Payload's admin layout imports — so we do NOT import globals.css here
 *   (doing so would pull Tailwind's `base` preflight, which resets styles
 *   Payload's own chrome depends on).
 */

import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import {
  Building,
  CalendarPlus,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Megaphone,
  Users,
} from 'lucide-react'

import config from '@payload-config'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type TenantRef = string | number | { id: string | number; name?: string } | null | undefined
type UserLite = {
  id: string | number
  email?: string
  firstName?: string
  lastName?: string
  role?: 'platformOwner' | 'admin' | 'staff'
  tenant?: TenantRef
} | null

/** Greeting name: prefer firstName, fall back to the local part of email. */
function greetingName(u: NonNullable<UserLite>): string {
  const fn = u.firstName?.trim()
  if (fn) return fn
  const email = u.email ?? ''
  return email.includes('@') ? email.split('@')[0] : email || 'friend'
}

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
 */
async function fetchActiveSchedule(
  payload: Awaited<ReturnType<typeof getPayload>>,
  tenantId: string | number,
): Promise<ActiveScheduleView | null> {
  const todayIso = new Date().toISOString()

  // 1. New collection: schedule covering today (startDate <= today <= endDate),
  //    then look up today's entry in days[].
  try {
    const dated = await payload.find({
      collection: 'prayer-schedules' as never,
      where: {
        tenant: { equals: tenantId },
        startDate: { less_than_equal: todayIso },
        endDate: { greater_than_equal: todayIso },
      },
      sort: '-startDate',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = dated.docs[0] as Record<string, unknown> | undefined

    if (doc) {
      type DayPair = { adhan?: string | null; iqamah?: string | null }
      type DayRow = {
        date?: string | null
        fajr?: DayPair | null
        zuhr?: DayPair | null
        asr?: DayPair | null
        maghrib?: DayPair | null
        isha?: DayPair | null
      }
      const days = (doc.days as DayRow[] | null | undefined) ?? []
      const target = todayIso.slice(0, 10)
      const today = days.find((d) => (d.date ? d.date.slice(0, 10) === target : false))

      const pick = (g: DayPair | null | undefined) => ({
        adhan: g?.adhan ?? '—',
        iqamah: g?.iqamah ?? '—',
      })

      return {
        id: doc.id as string | number,
        name: (doc.name as string) || 'Active schedule',
        collectionSlug: 'prayer-schedules',
        rows: [
          { prayer: 'Fajr', ...pick(today?.fajr) },
          { prayer: 'Zuhr', ...pick(today?.zuhr) },
          { prayer: 'Asr', ...pick(today?.asr) },
          { prayer: 'Maghrib', ...pick(today?.maghrib) },
          { prayer: 'Isha', ...pick(today?.isha) },
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
  // Resolve tenant name + logo. Always fetch with depth: 1 so the
  // branding.logo upload is populated with a `url` field.
  let tenantName = 'your masjid'
  let tenantLogo: { url: string; alt: string } | null = null
  try {
    const t = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 1,
      overrideAccess: true,
    })) as Record<string, unknown>
    if (t?.name) tenantName = t.name as string
    const branding = t.branding as { logo?: unknown } | undefined
    const logo = branding?.logo as { url?: string | null; alt?: string | null } | undefined
    if (logo?.url) {
      tenantLogo = { url: logo.url, alt: logo.alt ?? tenantName }
    }
  } catch {
    // ignore; fall back to the default label / no logo
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

  const displayName = greetingName(user)

  return (
    <div className="p-8 md:p-10 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-semibold text-foreground">
            Salam, {displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-base text-muted-foreground">
            <span>Managing</span>
            <Badge variant="secondary" className="gap-1 text-base px-3 py-1.5">
              <Building className="size-4" aria-hidden />
              {tenantName}
            </Badge>
          </div>
        </div>
        {tenantLogo && (
          <img
            src={tenantLogo.url}
            alt={tenantLogo.alt}
            className="h-20 md:h-24 w-auto object-contain shrink-0"
          />
        )}
      </header>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {/* Active prayer schedule */}
        <Card>
          <CardHeader className="p-6 md:p-8">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Clock className="size-5 text-secondary" aria-hidden />
                  Active Prayer Schedule
                </CardTitle>
                {schedule ? (
                  <CardDescription className="text-base text-muted-foreground">
                    {schedule.name}
                  </CardDescription>
                ) : (
                  <CardDescription className="text-base text-muted-foreground">
                    Nothing active yet
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 md:p-8 pt-0 md:pt-0">
            {schedule ? (
              <div className="space-y-1">
                <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
                  <div>Prayer</div>
                  <div>Adhan</div>
                  <div>Iqamah</div>
                </div>
                {schedule.rows.map((r, i) => (
                  <div
                    key={r.prayer}
                    className={`grid grid-cols-[80px_1fr_1fr] gap-2 text-base py-2.5 text-foreground ${
                      i < schedule.rows.length - 1 ? 'border-b border-border/60' : ''
                    }`}
                  >
                    <div className="font-medium">{r.prayer}</div>
                    <div className="text-muted-foreground">{r.adhan}</div>
                    <div>{r.iqamah}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="italic text-muted-foreground text-base">
                No schedule set yet. Create one to populate the public prayer times page.
              </p>
            )}
          </CardContent>
          <CardFooter className="p-6 md:p-8 pt-0 md:pt-0">
            <Button variant="ghost" size="sm" asChild className="text-base">
              <Link href={scheduleEditHref}>
                Update schedule
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Upcoming events */}
        <Card>
          <CardHeader className="p-6 md:p-8">
            <CardTitle className="flex items-center gap-2 text-xl">
              <CalendarPlus className="size-5 text-secondary" aria-hidden />
              Upcoming Events
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {eventsRes.docs.length > 0
                ? `${eventsRes.docs.length} upcoming`
                : 'Nothing scheduled'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 pt-0 md:pt-0">
            {eventsRes.docs.length > 0 ? (
              <ul className="space-y-0">
                {(
                  eventsRes.docs as Array<{
                    id: string | number
                    title?: string
                    when?: string
                    startDate?: string
                  }>
                ).map((e, i) => (
                  <li
                    key={e.id}
                    className={`py-2.5 ${
                      i < eventsRes.docs.length - 1 ? 'border-b border-border/60' : ''
                    }`}
                  >
                    <Link
                      href={`/admin/collections/events/${e.id}`}
                      className="block group"
                    >
                      <p className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                        {e.title || '(untitled)'}
                      </p>
                      <p className="text-base text-muted-foreground mt-0.5">
                        {e.startDate ? formatWhen(e.startDate) : e.when || 'No date set'}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="italic text-muted-foreground text-base">
                No upcoming published events.
              </p>
            )}
          </CardContent>
          <CardFooter className="p-6 md:p-8 pt-0 md:pt-0">
            <Button variant="ghost" size="sm" asChild className="text-base">
              <Link href="/admin/collections/events/create">
                Add event
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Active announcements */}
        <Card>
          <CardHeader className="p-6 md:p-8">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Megaphone className="size-5 text-secondary" aria-hidden />
              Active Announcements
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Live across the public site
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 pt-0 md:pt-0">
            <p className="text-6xl md:text-7xl font-bold text-foreground leading-none">
              {announcementsRes.totalDocs}
            </p>
            <p className="text-base text-muted-foreground mt-2">
              {announcementsRes.totalDocs === 1
                ? 'announcement is live'
                : 'announcements are live'}
            </p>
          </CardContent>
          <CardFooter className="p-6 md:p-8 pt-0 md:pt-0">
            <Button variant="ghost" size="sm" asChild className="text-base">
              <Link href="/admin/collections/announcements">
                View announcements
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Separator />

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" asChild className="text-base">
            <Link href="/admin/collections/events/create">
              <CalendarPlus className="h-5 w-5" aria-hidden />
              New Event
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="text-base">
            <Link href="/admin/collections/announcements/create">
              <Megaphone className="h-5 w-5" aria-hidden />
              New Announcement
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="text-base">
            <Link href={newScheduleHref}>
              <Clock className="h-5 w-5" aria-hidden />
              New Prayer Schedule
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="text-base">
            <Link href="/admin/collections/hero-slides/create">
              <ImageIcon className="h-5 w-5" aria-hidden />
              New Hero Slide
            </Link>
          </Button>
        </div>
      </section>
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
  const [tenantsRes, usersRes, eventsRes, announcementsRes] = await Promise.all([
    payload.find({ collection: 'tenants', limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'users', limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'events', limit: 0, depth: 0, overrideAccess: true }),
    payload.find({
      collection: 'announcements',
      where: { active: { equals: true } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const displayName = greetingName(user)

  const stats: Array<{
    label: string
    value: number
    caption: string
    href: string
    linkLabel: string
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  }> = [
    {
      label: 'Tenants',
      value: tenantsRes.totalDocs,
      caption: 'masajid on the platform',
      href: '/admin/collections/tenants',
      linkLabel: 'Manage tenants',
      icon: Building,
    },
    {
      label: 'Users',
      value: usersRes.totalDocs,
      caption: 'total staff accounts',
      href: '/admin/collections/users',
      linkLabel: 'Manage users',
      icon: Users,
    },
    {
      label: 'Events',
      value: eventsRes.totalDocs,
      caption: 'total events across all tenants',
      href: '/admin/collections/events',
      linkLabel: 'View events',
      icon: CalendarPlus,
    },
    {
      label: 'Announcements',
      value: announcementsRes.totalDocs,
      caption: 'active across all tenants',
      href: '/admin/collections/announcements',
      linkLabel: 'View announcements',
      icon: Megaphone,
    },
  ]

  return (
    <div className="p-8 md:p-10 max-w-[1400px] mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl md:text-5xl font-semibold text-foreground">
          Salam, {displayName}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-base text-muted-foreground">
          <Badge variant="accent" className="text-base px-3 py-1.5">
            Platform Admin
          </Badge>
          <span>Viewing platform-wide stats</span>
        </div>
      </header>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardHeader className="p-6 md:p-8">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className="size-5 text-secondary" aria-hidden />
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 md:p-8 pt-0 md:pt-0">
                <p className="text-6xl md:text-7xl font-bold text-foreground leading-none">
                  {s.value}
                </p>
                <p className="text-base text-muted-foreground mt-2">{s.caption}</p>
              </CardContent>
              <CardFooter className="p-6 md:p-8 pt-0 md:pt-0">
                <Button variant="ghost" size="sm" asChild className="text-base">
                  <Link href={s.href}>
                    {s.linkLabel}
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" asChild className="text-base">
            <Link href="/admin/collections/tenants/create">
              <Building className="h-5 w-5" aria-hidden />
              Add Tenant
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="text-base">
            <Link href="/admin/collections/users/create">
              <Users className="h-5 w-5" aria-hidden />
              Add User
            </Link>
          </Button>
        </div>
      </section>
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
      <div className="p-8 md:p-10 max-w-7xl mx-auto">
        <p className="text-muted-foreground">Please log in to view the dashboard.</p>
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
      <div className="p-8 md:p-10 max-w-[1400px] mx-auto space-y-4">
        <h1 className="text-4xl md:text-5xl font-semibold text-foreground">
          Salam, {greetingName(u)}
        </h1>
        <p className="text-base text-muted-foreground">No tenant assigned</p>
        <p className="italic text-muted-foreground text-base">
          Your account is not linked to a masjid yet. Ask a platform admin to set your tenant.
        </p>
      </div>
    )
  }

  return <TenantDashboard payload={payload} user={u} tenantId={tenantId} />
}
