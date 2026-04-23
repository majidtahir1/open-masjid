/**
 * Server-only data access helpers. Thin wrappers over `payload.find()` that
 * always pass `overrideAccess: true` (the site is public-read) and scope
 * queries to the current tenant.
 *
 * All fetchers accept an optional `{ draft }` flag. When `draft: true`, the
 * fetcher returns the latest version (published or draft). When omitted or
 * false, Payload returns only published content. Public pages pass `draft`
 * only after verifying an authenticated admin session — see `previewMode.ts`.
 */

import { unstable_noStore as noStore } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'

import type { TenantRecord } from './tenant-parse'

export interface ReadOpts {
  draft?: boolean
}

async function payloadClient() {
  return getPayload({ config })
}

export async function fetchHeroSlides(tenant: TenantRecord, opts: ReadOpts = {}) {
  noStore()
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
      draft: opts.draft ?? false,
    })
    return res.docs as unknown[]
  } catch {
    return []
  }
}

export async function fetchEvents(
  tenant: TenantRecord,
  opts: ReadOpts & { limit?: number } = {},
) {
  noStore()
  const payload = await payloadClient()
  try {
    const res = await payload.find({
      collection: 'events',
      where: {
        tenant: { equals: tenant.id },
      },
      sort: '-startDate',
      limit: opts.limit ?? 50,
      depth: 1,
      overrideAccess: true,
      draft: opts.draft ?? false,
    })
    return res.docs as unknown[]
  } catch {
    return []
  }
}

export async function fetchEventBySlug(
  tenant: TenantRecord,
  slug: string,
  opts: ReadOpts = {},
) {
  noStore()
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
      draft: opts.draft ?? false,
    })
    return (res.docs[0] as unknown) ?? null
  } catch {
    return null
  }
}

export async function fetchServices(tenant: TenantRecord, opts: ReadOpts = {}) {
  noStore()
  const payload = await payloadClient()
  try {
    const res = await payload.find({
      collection: 'services',
      where: { tenant: { equals: tenant.id } },
      sort: 'sortOrder',
      limit: 50,
      depth: 1,
      overrideAccess: true,
      draft: opts.draft ?? false,
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

export async function fetchPageBySlug(
  tenant: TenantRecord,
  slug: string,
  opts: ReadOpts = {},
) {
  noStore()
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
      draft: opts.draft ?? false,
    })
    return (res.docs[0] as unknown) ?? null
  } catch {
    return null
  }
}

export async function fetchAnnouncements(tenant: TenantRecord, opts: ReadOpts = {}) {
  noStore()
  const payload = await payloadClient()
  try {
    const res = await payload.find({
      collection: 'announcements',
      where: {
        tenant: { equals: tenant.id },
        active: { equals: true },
      },
      sort: '-priority',
      limit: 20,
      depth: 0,
      overrideAccess: true,
      draft: opts.draft ?? false,
    })
    return res.docs as unknown[]
  } catch {
    return []
  }
}
