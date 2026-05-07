import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { getAdminUser, getAdminTenant } from '@/lib/admin-context'
import {
  computeMilestoneStates,
  doneCount,
  isAllDone,
} from '@/lib/onboarding'

function tenantIdOf(t: unknown): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && t !== null && 'id' in t) return (t as { id: string | number }).id
  return t as string | number
}

export default async function OnboardingBanner() {
  const { user } = await getAdminUser()
  if (!user || user.role !== 'admin') return null
  const tenantId = tenantIdOf((user as { tenant?: unknown }).tenant)
  if (!tenantId) return null

  const tenantDoc = (await getAdminTenant(tenantId)) as unknown as Record<string, unknown>

  const payload = await getPayload({ config })
  const [prayerCount, eventsCount, heroCount] = await Promise.all([
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
        collection: 'events',
        where: { tenant: { equals: tenantId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      .then((r) => r.totalDocs),
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
  ])

  const states = computeMilestoneStates({
    tenant: {
      branding:
        (tenantDoc.branding as
          | { logo?: string | number | { id?: string | number } | null }
          | null) ?? null,
      contactInfo: (tenantDoc.contactInfo as { address?: string | null } | null) ?? null,
      donationConfig: (tenantDoc.donationConfig as { mode?: string | null } | null) ?? null,
    },
    counts: { prayerSchedules: prayerCount, events: eventsCount, heroSlides: heroCount },
  })

  if (isAllDone(states)) return null

  const done = doneCount(states)

  return (
    <div className="bg-secondary/15 border-b border-border px-4 py-2 text-sm flex items-center gap-3">
      <span className="font-semibold text-foreground">
        Setup checklist — {done} of 6 done
      </span>
      <Link href="/admin" className="text-primary hover:underline font-semibold">
        Resume →
      </Link>
    </div>
  )
}
