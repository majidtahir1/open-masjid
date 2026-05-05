import type { MetadataRoute } from 'next'

import { absoluteUrl, getRequestOrigin } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Host-aware robots.txt.
 *
 * Same shape on the marketing host and tenant hosts: allow public crawling,
 * disallow admin/api paths, point at this host's sitemap. The sitemap route
 * itself branches on tenant context to emit the right inventory.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { origin } = await getRequestOrigin()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api'],
      },
    ],
    sitemap: absoluteUrl(origin, '/sitemap.xml'),
    host: origin,
  }
}
