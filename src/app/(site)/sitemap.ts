import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getCurrentTenant } from '@/lib/tenant-server'
import { absoluteUrl, getRequestOrigin } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Per-tenant sitemap. Includes static routes, all published Pages, and all
 * published Events. Announcements have no per-item routes, so we expose only
 * the announcements landing page (if it exists at `/announcements`).
 *
 * URLs are absolute against the *current request host*, so a tenant on a
 * custom domain gets that domain in their sitemap (not the platform
 * subdomain) — search engines treat the requested host as canonical.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await getCurrentTenant()
  if (!tenant) return []

  const { origin } = await getRequestOrigin(tenant)

  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(origin, '/'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: absoluteUrl(origin, '/events'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: absoluteUrl(origin, '/prayer-times'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: absoluteUrl(origin, '/about'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: absoluteUrl(origin, '/donate'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: absoluteUrl(origin, '/announcements'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ]

  const dynamicEntries: MetadataRoute.Sitemap = []

  try {
    const payload = await getPayload({ config })

    const [pages, events] = await Promise.all([
      payload.find({
        collection: 'pages',
        where: {
          tenant: { equals: tenant.id },
          _status: { equals: 'published' },
        },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'events',
        where: {
          tenant: { equals: tenant.id },
          _status: { equals: 'published' },
        },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      }),
    ])

    for (const doc of pages.docs as Array<{
      slug?: string | null
      updatedAt?: string | null
    }>) {
      if (!doc.slug) continue
      dynamicEntries.push({
        url: absoluteUrl(origin, `/${doc.slug}`),
        lastModified: doc.updatedAt ? new Date(doc.updatedAt) : now,
        changeFrequency: 'monthly',
        priority: 0.6,
      })
    }

    for (const doc of events.docs as Array<{
      slug?: string | null
      updatedAt?: string | null
    }>) {
      if (!doc.slug) continue
      dynamicEntries.push({
        url: absoluteUrl(origin, `/events/${doc.slug}`),
        lastModified: doc.updatedAt ? new Date(doc.updatedAt) : now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }
  } catch {
    // Best-effort: emit static entries even if dynamic lookups fail.
  }

  return [...staticEntries, ...dynamicEntries]
}
