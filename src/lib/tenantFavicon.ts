import type { TenantRecord } from './tenant-parse'

const FALLBACK_HREF = '/brand/openmasjid-favicon.svg'
const FALLBACK_MIME = 'image/svg+xml'

export interface ResolvedFavicon {
  href: string
  type: string
}

/**
 * Pick a favicon `{href, type}` for the given tenant.
 *
 * Rules:
 * - SVG favicon uploads: serve original (vector scales natively in browsers).
 * - Raster favicon uploads: prefer the 64×64 PNG derivative that the Media
 *   collection generates on upload; fall back to the original if absent.
 * - Tenant without a configured favicon: fall back to the platform default.
 */
export function resolveTenantFavicon(
  tenant: TenantRecord | null | undefined,
): ResolvedFavicon {
  if (!tenant) return { href: FALLBACK_HREF, type: FALLBACK_MIME }

  const branding = (tenant as { branding?: { favicon?: unknown } }).branding
  const favicon = branding?.favicon as
    | {
        url?: string | null
        mimeType?: string | null
        sizes?: { favicon?: { url?: string | null } | null } | null
      }
    | undefined

  if (!favicon?.url) return { href: FALLBACK_HREF, type: FALLBACK_MIME }

  if (favicon.mimeType === 'image/svg+xml') {
    return { href: favicon.url, type: 'image/svg+xml' }
  }

  const resized = favicon.sizes?.favicon?.url
  if (resized) return { href: resized, type: 'image/png' }
  return { href: favicon.url, type: favicon.mimeType ?? FALLBACK_MIME }
}
