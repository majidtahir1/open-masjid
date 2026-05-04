/**
 * Server-only SEO helpers — host resolution + canonical URL building.
 *
 * Purpose: produce the absolute origin (https://host) for the *current
 * request* so sitemap/robots/metadata emit correct URLs whether the tenant
 * is reached via a platform subdomain (`icp.openmasjid.app`) or a custom
 * domain (`icprosper.org`).
 *
 * We trust the inbound `host` header because middleware has already
 * classified it. For the protocol we trust `x-forwarded-proto` when present
 * (Vercel and most reverse proxies set this) and otherwise infer https for
 * non-localhost hosts and http for bare localhost.
 */

import { PLATFORM_DOMAIN, type TenantRecord } from './tenant-parse'

export interface RequestOrigin {
  host: string
  protocol: 'http' | 'https'
  origin: string
}

/**
 * Read the current request's host + protocol from `next/headers`.
 * Falls back to the canonical tenant domain (custom domain → platform
 * subdomain) if there's no request context, e.g. during build.
 */
export async function getRequestOrigin(
  tenant?: TenantRecord | null,
): Promise<RequestOrigin> {
  let host = ''
  let protocolHeader: string | null = null
  try {
    const { headers } = await import('next/headers')
    const h = await headers()
    host = (h.get('x-forwarded-host') || h.get('host') || '').toLowerCase()
    protocolHeader = h.get('x-forwarded-proto')
  } catch {
    // Not in a request context (e.g. build time).
  }

  if (!host && tenant) {
    host = canonicalTenantHost(tenant)
  }
  if (!host) host = PLATFORM_DOMAIN

  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const protocol: 'http' | 'https' =
    protocolHeader === 'http' || protocolHeader === 'https'
      ? protocolHeader
      : isLocal
      ? 'http'
      : 'https'

  return { host, protocol, origin: `${protocol}://${host}` }
}

/**
 * Pick the tenant's canonical public host. Prefer the first custom domain
 * if one is configured (those are typically the public-facing brand);
 * otherwise fall back to `<slug>.openmasjid.app`.
 *
 * Used only as a fallback when there is no live request to read from.
 */
export function canonicalTenantHost(tenant: TenantRecord): string {
  const domains = tenant.customDomains
  if (Array.isArray(domains) && domains.length > 0) {
    const first = domains[0]
    const domain =
      typeof first === 'string'
        ? first
        : (first as { domain?: string } | null)?.domain
    if (domain) return domain
  }
  if (tenant.slug) return `${tenant.slug}.${PLATFORM_DOMAIN}`
  return PLATFORM_DOMAIN
}

/** Join an origin with a path, ensuring exactly one leading slash. */
export function absoluteUrl(origin: string, path: string): string {
  if (!path.startsWith('/')) path = `/${path}`
  return `${origin}${path}`
}
