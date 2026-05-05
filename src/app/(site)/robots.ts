import type { MetadataRoute } from 'next'

import { absoluteUrl, getRequestOrigin } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Per-tenant robots.txt. Allows public crawling, disallows admin/api paths,
 * and references the auto-generated sitemap on the same host.
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
