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

import Link from 'next/link'
import { getPayload } from 'payload'

import { getAdminUser } from '@/lib/admin-context'
import {
  Building,
  CalendarPlus,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Megaphone,
  Monitor,
  Images,
  Users,
} from 'lucide-react'

import { OnboardingShell } from './onboarding/OnboardingShell'
import { computeMilestoneStates, doneCount } from '@/lib/onboarding'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
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
  role?: 'platformOwner' | 'admin' | 'staff' | 'kioskManager'
  tenant?: TenantRef
  onboardingWelcomeSeenAt?: string | null
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
    const doc = dated.docs[0] as unknown as Record<string, unknown> | undefined

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
    const doc = legacy.docs[0] as unknown as Record<string, unknown> | undefined
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
    })) as unknown as Record<string, unknown>
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

  const [tenantDoc, prayerSchedulesCount, heroSlidesCount, eventsTotal] = await Promise.all([
    payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 1,
      overrideAccess: true,
    }) as Promise<unknown>,
    payload
      .find({
        collection: 'prayer-schedules' as never,
        where: { tenant: { equals: tenantId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      .then((r) => r.totalDocs)
      .catch(() => 0),
    payload
      .find({
        collection: 'hero-slides',
        where: { tenant: { equals: tenantId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      .then((r) => r.totalDocs)
      .catch(() => 0),
    payload
      .find({
        collection: 'events',
        where: { tenant: { equals: tenantId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      .then((r) => r.totalDocs),
  ])

  const onboardingStates = computeMilestoneStates({
    tenant: {
      branding:
        (tenantDoc as { branding?: { logo?: string | number | { id?: string | number } | null } | null }).branding ?? null,
      contactInfo:
        (tenantDoc as { contactInfo?: { address?: string | null } | null }).contactInfo ?? null,
      donationConfig:
        (tenantDoc as { donationConfig?: { mode?: string | null } | null }).donationConfig ?? null,
    },
    counts: {
      prayerSchedules: prayerSchedulesCount,
      events: eventsTotal,
      heroSlides: heroSlidesCount,
    },
  })
  const showWelcome = !user.onboardingWelcomeSeenAt
  const tenantSlug = (tenantDoc as { slug?: string }).slug ?? ''
  const publicUrl = `https://${tenantSlug}.openmasjid.app`

  // Build branding initial values for the rich Branding step. The tenant doc
  // was fetched at depth 1 above, so `branding.logo` is populated as a Media
  // object with `url`, `filename`, `filesize`.
  const brandingDoc = (tenantDoc as {
    branding?: {
      logo?:
        | string
        | number
        | { id?: string | number; url?: string; filename?: string; filesize?: number }
        | null
      favicon?:
        | string
        | number
        | { id?: string | number; url?: string; filename?: string; filesize?: number }
        | null
      primaryColor?: string | null
      secondaryColor?: string | null
      accentColor?: string | null
      displayFont?: string | null
    } | null
  }).branding
  const logoVal = brandingDoc?.logo
  const faviconVal = brandingDoc?.favicon
  const brandingInitial = {
    logo:
      logoVal && typeof logoVal === 'object' && logoVal.id != null
        ? {
            id: logoVal.id as string | number,
            url: logoVal.url ?? undefined,
            filename: logoVal.filename ?? undefined,
            filesize: logoVal.filesize ?? undefined,
          }
        : null,
    favicon:
      faviconVal && typeof faviconVal === 'object' && faviconVal.id != null
        ? {
            id: faviconVal.id as string | number,
            url: faviconVal.url ?? undefined,
            filename: faviconVal.filename ?? undefined,
            filesize: faviconVal.filesize ?? undefined,
          }
        : null,
    primaryColor: brandingDoc?.primaryColor ?? undefined,
    secondaryColor: brandingDoc?.secondaryColor ?? undefined,
    accentColor: brandingDoc?.accentColor ?? undefined,
    displayFont: brandingDoc?.displayFont ?? undefined,
  }

  const identityDoc = tenantDoc as {
    name?: string | null
    footerTagline?: string | null
    contactInfo?: {
      address?: string | null
      phone?: string | null
      email?: string | null
    } | null
    socialLinks?: Array<{ platform?: string; url?: string }> | null
  }
  const identityInitial = {
    name: identityDoc.name ?? '',
    footerTagline: identityDoc.footerTagline ?? '',
    contactInfo: {
      address: identityDoc.contactInfo?.address ?? '',
      phone: identityDoc.contactInfo?.phone ?? '',
      email: identityDoc.contactInfo?.email ?? '',
    },
    socialLinks: (identityDoc.socialLinks ?? [])
      .filter((s): s is { platform: string; url: string } =>
        Boolean(s?.platform && s?.url),
      )
      .map((s) => ({ platform: s.platform, url: s.url })),
  }

  const scheduleCollection = schedule?.collectionSlug ?? 'prayer-schedules'
  const scheduleEditHref = schedule
    ? `/admin/collections/${scheduleCollection}/${schedule.id}`
    : `/admin/collections/${scheduleCollection}`

  const displayName = greetingName(user)
  const setupDone = doneCount(onboardingStates)
  const isAdmin = user.role === 'admin'
  const isKiosk = user.role === 'kioskManager'

  return (
    <div className="om-dashboard-hub min-h-screen bg-[#F7F8F8] px-6 py-10 md:px-14 md:py-11">
      <div className="mx-auto max-w-[1180px] space-y-9">
      <OnboardingShell
        initialStates={onboardingStates}
        publicUrl={publicUrl}
        tenantName={tenantName}
        showWelcome={showWelcome}
        brandingInitial={brandingInitial}
        identityInitial={identityInitial}
      />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="text-[40px] font-medium leading-[1.1] tracking-[-0.02em] text-[#0F1E4A]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Salam, {displayName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px] text-[#747C7C]">
            <span>Managing</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F5F7] px-3 py-1.5 font-semibold text-[#175F6B]">
              <Building className="size-3.5" aria-hidden />
              {tenantName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && setupDone >= onboardingStates.length && (
            <span className="inline-flex items-center gap-2 rounded-[10px] border border-[#DDE1E1] bg-white px-3.5 py-2.5 text-[14.5px] text-[#3A3F3F]">
              <span className="size-2 rounded-full bg-[#4C8B5B]" aria-hidden />
              Setup checklist · {setupDone} of {onboardingStates.length} done
            </span>
          )}
          {tenantLogo && (
            <img
              src={tenantLogo.url}
              alt={tenantLogo.alt}
              className="h-12 w-auto object-contain shrink-0"
            />
          )}
        </div>
      </header>

      {/* Jump back in — role-aware quick actions.
          `setTenantFromUser` hooks pre-fill the tenant on save for non-platform
          users; create forms save as Draft until Publish. */}
      <section className="space-y-3.5">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#9CA4A4]">
          Jump back in
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isKiosk ? (
            <>
              <QuickActionCard
                href="/admin/collections/prayer-display-content"
                icon={<Monitor className="h-5 w-5" aria-hidden />}
                title="Update prayer display"
                description="Edit the prayer screen content"
              />
              <QuickActionCard
                href="/admin/collections/carousel-slides"
                icon={<Images className="h-5 w-5" aria-hidden />}
                title="Manage carousel"
                description="Slides shown between prayers"
              />
              <QuickActionCard
                href="/admin/collections/kiosks"
                icon={<Monitor className="h-5 w-5" aria-hidden />}
                title="Manage kiosks"
                description="Registered display devices"
              />
            </>
          ) : (
            <>
              <QuickActionCard
                href="/admin/collections/events/create"
                icon={<CalendarPlus className="h-5 w-5" aria-hidden />}
                title="Add event"
                description="Class, program, or gathering"
                featured
              />
              <QuickActionCard
                href="/admin/collections/forms/create"
                icon={<FileText className="h-5 w-5" aria-hidden />}
                title="Create form"
                description="Signup or registration form"
              />
              <QuickActionCard
                href="/admin/collections/school-classes"
                icon={<GraduationCap className="h-5 w-5" aria-hidden />}
                title="Review programs"
                description="Sunday-school classes"
              />
            </>
          )}
        </div>
      </section>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {/* Active prayer schedule */}
        <div className="rounded-[13px] border border-[#DDE1E1] bg-white p-6">
          <div className="mb-3.5 flex items-center gap-2.5 text-[#1E7E8E]">
            <Clock className="size-[18px]" aria-hidden />
            <span className="text-[15.5px] font-semibold text-[#141616]">Active Prayer Schedule</span>
          </div>
          {schedule ? (
            <div>
              <div className="grid grid-cols-[70px_1fr_1fr] gap-2 border-b border-[#EEF0F0] pb-2 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#9CA4A4]">
                <div>Prayer</div>
                <div>Adhan</div>
                <div>Iqamah</div>
              </div>
              {schedule.rows.map((r, i) => (
                <div
                  key={r.prayer}
                  className={`grid grid-cols-[70px_1fr_1fr] gap-2 py-2 text-[14.5px] ${
                    i < schedule.rows.length - 1 ? 'border-b border-[#F2F3F3]' : ''
                  }`}
                >
                  <div className="font-medium text-[#3A3F3F]">{r.prayer}</div>
                  <div className="text-[#747C7C]">{r.adhan}</div>
                  <div className="text-[#141616]">{r.iqamah}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[14.5px] leading-[1.6] text-[#747C7C]">
              No schedule set yet. Create one to populate the public prayer times page.
            </p>
          )}
          <Link
            href={scheduleEditHref}
            className="mt-4 inline-flex items-center gap-1 text-[14.5px] font-semibold text-[#1E7E8E]"
          >
            Update schedule
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {/* Upcoming events */}
        <div className="rounded-[13px] border border-[#DDE1E1] bg-white p-6">
          <div className="mb-3.5 flex items-center gap-2.5 text-[#1E7E8E]">
            <CalendarPlus className="size-[18px]" aria-hidden />
            <span className="text-[15.5px] font-semibold text-[#141616]">Upcoming Events</span>
            <span className="ml-auto text-[13.5px] text-[#9CA4A4]">
              {eventsRes.docs.length > 0 ? `${eventsRes.docs.length} upcoming` : 'None'}
            </span>
          </div>
          {eventsRes.docs.length > 0 ? (
            <ul>
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
                  className={i < eventsRes.docs.length - 1 ? 'mb-3' : undefined}
                >
                  <Link href={`/admin/collections/events/${e.id}`} className="block">
                    <p className="text-[14.5px] font-medium text-[#3A3F3F]">
                      {e.title || '(untitled)'}
                    </p>
                    <p className="mt-0.5 text-[13.5px] text-[#9CA4A4]">
                      {e.startDate ? formatWhen(e.startDate) : e.when || 'No date set'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14.5px] leading-[1.6] text-[#747C7C]">No upcoming published events.</p>
          )}
        </div>

        {/* Active announcements */}
        <div className="rounded-[13px] border border-[#DDE1E1] bg-white p-6">
          <div className="mb-3.5 flex items-center gap-2.5 text-[#1E7E8E]">
            <Megaphone className="size-[18px]" aria-hidden />
            <span className="text-[15.5px] font-semibold text-[#141616]">Active Announcements</span>
          </div>
          <p
            className="text-[54px] font-medium leading-none text-[#0F1E4A]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {announcementsRes.totalDocs}
          </p>
          <p className="mt-1.5 text-[14.5px] text-[#747C7C]">
            {announcementsRes.totalDocs === 1 ? 'announcement is live' : 'announcements are live'}
          </p>
        </div>
      </div>

      <p className="flex items-center gap-1.5 pt-1 text-[14px] text-[#9CA4A4]">
        Tip — press
        <kbd className="rounded-[6px] bg-[#EEF0F0] px-1.5 py-0.5 text-[12.5px] font-semibold text-[#545B5B]">
          ⌘K
        </kbd>
        to jump anywhere or run an action.
      </p>
      </div>
    </div>
  )
}

function QuickActionCard({
  href,
  icon,
  title,
  description,
  featured = false,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  /** Navy filled card used to highlight the primary action. */
  featured?: boolean
}) {
  if (featured) {
    return (
      <Link
        href={href}
        className="block rounded-[13px] bg-[#0F1E4A] p-[21px] text-white transition-transform duration-200 hover:-translate-y-0.5"
      >
        <span className="text-[#F0C88C] [&_svg]:size-[22px]">{icon}</span>
        <div className="mt-[18px] text-[16.5px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[14px] text-[#9FAAD0]">{description}</div>
      </Link>
    )
  }
  return (
    <Link
      href={href}
      className="block rounded-[13px] border border-[#DDE1E1] bg-white p-[21px] transition duration-200 hover:border-[#BEE4E9] hover:shadow-[0_6px_18px_rgba(19,46,48,0.08)]"
    >
      <span className="text-[#1E7E8E] [&_svg]:size-[22px]">{icon}</span>
      <div className="mt-[18px] text-[16.5px] font-semibold text-[#141616]">{title}</div>
      <div className="mt-0.5 text-[14px] text-[#747C7C]">{description}</div>
    </Link>
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            href="/admin/collections/tenants/create"
            icon={<Building className="h-5 w-5" aria-hidden />}
            title="Add Tenant"
            description="Provision a new masjid site"
          />
          <QuickActionCard
            href="/admin/collections/users/create"
            icon={<Users className="h-5 w-5" aria-hidden />}
            title="Add User"
            description="Invite staff or admins"
          />
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Default export — dispatches to the right view based on role.        */
/* ------------------------------------------------------------------ */

export default async function Dashboard() {
  const { payload, user } = await getAdminUser()

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
