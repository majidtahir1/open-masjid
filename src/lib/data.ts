/**
 * Server-only data access helpers. Thin wrappers over `payload.find()` that
 * always pass `overrideAccess: true` (the site is public-read) and scope
 * queries to the current tenant.
 *
 * All fetchers accept an optional `{ draft }` flag. When `draft: true`, the
 * fetcher returns the latest version (published or draft). When omitted or
 * false, an explicit `_status: published` where-clause is added so drafts
 * are filtered out even though we pass `overrideAccess: true` (which would
 * otherwise skip Payload's automatic draft filtering).
 */

import type { Where } from 'payload'
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

/** Merge an `_status: published` filter into a where-clause unless draft mode is on. */
function gate(where: Where, draft: boolean): Where {
  if (draft) return where
  return { ...where, _status: { equals: 'published' } }
}

export async function fetchHeroSlides(tenant: TenantRecord, opts: ReadOpts = {}) {
  noStore()
  const payload = await payloadClient()
  const draft = opts.draft ?? false
  try {
    const res = await payload.find({
      collection: 'hero-slides',
      where: gate(
        {
          tenant: { equals: tenant.id },
          active: { equals: true },
        },
        draft,
      ),
      sort: 'sortOrder',
      limit: 20,
      depth: 1,
      overrideAccess: true,
      draft,
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
  const draft = opts.draft ?? false
  try {
    const res = await payload.find({
      collection: 'events',
      where: gate({ tenant: { equals: tenant.id } }, draft),
      sort: '-startDate',
      limit: opts.limit ?? 50,
      depth: 1,
      overrideAccess: true,
      draft,
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
  const draft = opts.draft ?? false
  try {
    const res = await payload.find({
      collection: 'events',
      where: gate(
        {
          tenant: { equals: tenant.id },
          slug: { equals: slug },
        },
        draft,
      ),
      limit: 1,
      depth: 1,
      overrideAccess: true,
      draft,
    })
    return (res.docs[0] as unknown) ?? null
  } catch {
    return null
  }
}

export async function fetchServices(tenant: TenantRecord, opts: ReadOpts = {}) {
  noStore()
  const payload = await payloadClient()
  const draft = opts.draft ?? false
  try {
    const res = await payload.find({
      collection: 'services',
      where: gate({ tenant: { equals: tenant.id } }, draft),
      sort: 'sortOrder',
      limit: 50,
      depth: 1,
      overrideAccess: true,
      draft,
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
  const draft = opts.draft ?? false
  try {
    const res = await payload.find({
      collection: 'pages',
      where: gate(
        {
          tenant: { equals: tenant.id },
          slug: { equals: slug },
        },
        draft,
      ),
      limit: 1,
      depth: 1,
      overrideAccess: true,
      draft,
    })
    return (res.docs[0] as unknown) ?? null
  } catch {
    return null
  }
}

export async function fetchAnnouncements(tenant: TenantRecord, opts: ReadOpts = {}) {
  noStore()
  const payload = await payloadClient()
  const draft = opts.draft ?? false
  try {
    const res = await payload.find({
      collection: 'announcements',
      where: gate(
        {
          tenant: { equals: tenant.id },
          active: { equals: true },
        },
        draft,
      ),
      sort: '-priority',
      limit: 20,
      depth: 0,
      overrideAccess: true,
      draft,
    })
    return res.docs as unknown[]
  } catch {
    return []
  }
}
