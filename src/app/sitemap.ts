import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getCurrentTenant, getTenantContext } from '@/lib/tenant-server'
import { absoluteUrl, getRequestOrigin } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Host-aware sitemap.
 *
 * On the marketing host (`openmasjid.app` or bare-localhost in dev) we emit
 * the marketing route inventory. On a tenant host we emit the per-tenant
 * sitemap (static + published Pages + published Events).
 *
 * URLs are absolute against the *current request host* so search engines
 * treat the requested host as canonical.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const context = await getTenantContext()
  const now = new Date()

  if (context.type === 'platform-marketing' || context.type === 'platform-admin' || context.type === 'localhost') {
    const { origin } = await getRequestOrigin()

    const marketingPaths: Array<{
      path: string
      changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
      priority: number
    }> = [
      { path: '/', changeFrequency: 'weekly', priority: 1 },
      { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
      { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
      { path: '/features', changeFrequency: 'monthly', priority: 0.8 },
      { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
      { path: '/compare', changeFrequency: 'monthly', priority: 0.7 },
      { path: '/get-started', changeFrequency: 'monthly', priority: 0.9 },
      { path: '/self-host', changeFrequency: 'monthly', priority: 0.7 },
      { path: '/blog', changeFrequency: 'weekly', priority: 0.5 },
      { path: '/docs', changeFrequency: 'weekly', priority: 0.6 },
    ]

    return marketingPaths.map(({ path, changeFrequency, priority }) => ({
      url: absoluteUrl(origin, path),
      lastModified: now,
      changeFrequency,
      priority,
    }))
  }

  // Tenant host (subdomain or custom domain) — per-tenant sitemap.
  const tenant = await getCurrentTenant()
  if (!tenant) return []

  const { origin } = await getRequestOrigin(tenant)

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
