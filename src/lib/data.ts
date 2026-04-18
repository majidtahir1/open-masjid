/**
 * Server-only data access helpers. Thin wrappers over `payload.find()` that
 * always pass `overrideAccess: true` (the site is public-read) and scope
 * queries to the current tenant.
 *
 * Returned types are intentionally loose (`any[]`) — page components accept
 * the subset of fields they need via `EventLike`, `HeroSlideLike`, etc. from
 * `components/types.ts`.
 */

import { getPayload } from 'payload'
import config from '@payload-config'

import type { TenantRecord } from './tenant-parse'

async function payloadClient() {
  return getPayload({ config })
}

export async function fetchHeroSlides(tenant: TenantRecord) {
  const payload = await payloadClient()
  try {
    const res = await payload.find({
      collection: 'hero-slides',
      where: {
        tenant: { equals: tenant.id },
        active: { equals: true },
      },
      sort: 'sortOrder',
      limit: 20,
      depth: 1,
      overrideAccess: true,
    })
    return res.docs as unknown[]
  } catch {
    return []
  }
}

export async function fetchEvents(
  tenant: TenantRecord,
  opts: { limit?: number } = {},
) {
  const payload = await payloadClient()
  try {
    const res = await payload.find({
      collection: 'events',
      where: {
        tenant: { equals: tenant.id },
        status: { equals: 'published' },
      },
      sort: '-startDate',
      limit: opts.limit ?? 50,
      depth: 1,
      overrideAccess: true,
    })
    return res.docs as unknown[]
  } catch {
    return []
  }
}

export async function fetchEventBySlug(tenant: TenantRecord, slug: string) {
  const payload = await payloadClient()
  try {
    const res = await payload.find({
      collection: 'events',
      where: {
        tenant: { equals: tenant.id },
        slug: { equals: slug },
      },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    return (res.docs[0] as unknown) ?? null
  } catch {
    return null
  }
}

export async function fetchServices(tenant: TenantRecord) {
  const payload = await payloadClient()
  try {
    const res = await payload.find({
      collection: 'services',
      where: { tenant: { equals: tenant.id } },
      sort: 'sortOrder',
      limit: 50,
      depth: 1,
      overrideAccess: true,
    })
    return res.docs as unknown[]
  } catch {
    return []
  }
}

/**
 * Prayer schedule fetchers live in `./prayer-schedule.ts` — import
 * `getActiveSchedule` / `getAllSchedules` from there instead. They are
 * re-exported here for convenience so page code has a single data-access
 * surface.
 */
export { getActiveSchedule, getAllSchedules } from './prayer-schedule'

export async function fetchPageBySlug(tenant: TenantRecord, slug: string) {
  const payload = await payloadClient()
  try {
    const res = await payload.find({
      collection: 'pages',
      where: {
        tenant: { equals: tenant.id },
        slug: { equals: slug },
      },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    return (res.docs[0] as unknown) ?? null
  } catch {
    return null
  }
}
