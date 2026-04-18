/**
 * Pure, Edge-safe host parser.
 *
 * This file MUST have zero runtime dependencies so that it is safe to import
 * from `src/middleware.ts`, which runs on the Next.js Edge runtime where
 * Node.js APIs (and therefore Payload / pg / fs) are unavailable.
 *
 * Nothing in here is allowed to:
 *   - import `next/headers`
 *   - import `payload` or `@payload-config`
 *   - import `node:*` modules
 *   - make async I/O calls
 *
 * DB-backed tenant resolution lives in `./tenant-server.ts`, which server
 * components may import because they run in the Node runtime.
 */

export const PLATFORM_DOMAIN = 'openmasjid.app'
export const PLATFORM_ADMIN_SUBDOMAIN = 'admin'

export type TenantContext =
  | { type: 'platform-marketing' }
  | { type: 'platform-admin' }
  | { type: 'tenant-subdomain'; slug: string }
  | { type: 'tenant-custom'; host: string }
  | { type: 'localhost' }

/**
 * Minimal structural shape of a tenant record. Kept here (rather than in
 * `tenant-server.ts`) so both client context and server code can share it
 * without the client ever pulling in Payload.
 *
 * Will naturally widen once Payload generates its collection types.
 */
export interface TenantRecord {
  id: string | number
  name?: string
  slug?: string
  customDomains?: Array<string | { domain: string }>
  siteType?: 'masjid' | 'umbrella'
  branding?: {
    logo?: unknown
    primaryColor?: string
    secondaryColor?: string
    accentColor?: string
    colors?: {
      brand?: string
      secondary?: string
      accent?: string
      [key: string]: string | undefined
    }
    fonts?: {
      display?: string
      body?: string
      arabic?: string
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Strip the port off a host header: `icp.openmasjid.app:3000` → `icp.openmasjid.app`.
 */
function stripPort(host: string): string {
  const idx = host.indexOf(':')
  return idx === -1 ? host : host.slice(0, idx)
}

/**
 * Normalize host: trim, lowercase, strip port.
 * We intentionally do NOT strip `www.` here — the platform domain handler
 * treats `www.openmasjid.app` explicitly, and custom-domain handling strips
 * `www.` only after we've decided it's a custom domain.
 */
function normalizeHost(host: string): string {
  return stripPort(host.trim().toLowerCase())
}

function isLocalhostHost(host: string): boolean {
  if (host === 'localhost') return true
  if (host === '127.0.0.1') return true
  if (host === '::1') return true
  if (host === '[::1]') return true
  if (host === '0.0.0.0') return true
  if (host.endsWith('.localhost')) return true
  return false
}

/**
 * Pure classifier. Takes a raw Host header value and returns the context.
 * No DB, no async, no Node APIs — safe for Edge middleware.
 */
export function parseHostContext(host: string): TenantContext {
  if (!host) return { type: 'localhost' }

  const normalized = normalizeHost(host)

  if (isLocalhostHost(normalized)) {
    return { type: 'localhost' }
  }

  // Platform domain itself (apex + www).
  if (normalized === PLATFORM_DOMAIN || normalized === `www.${PLATFORM_DOMAIN}`) {
    return { type: 'platform-marketing' }
  }

  // Subdomain of the platform domain.
  if (normalized.endsWith(`.${PLATFORM_DOMAIN}`)) {
    const subdomain = normalized.slice(0, normalized.length - (PLATFORM_DOMAIN.length + 1))

    if (subdomain === PLATFORM_ADMIN_SUBDOMAIN) {
      return { type: 'platform-admin' }
    }

    // Only accept a single-label subdomain as a tenant slug (e.g. `icp`).
    // Anything deeper (e.g. `foo.bar.openmasjid.app`) is unexpected; we treat
    // it as a tenant-custom lookup so the DB layer can fail soft.
    if (subdomain && !subdomain.includes('.')) {
      return { type: 'tenant-subdomain', slug: subdomain }
    }

    return { type: 'tenant-custom', host: normalized }
  }

  // Everything else is a candidate custom domain — strip a leading `www.`
  // so `icprosper.org` and `www.icprosper.org` resolve to the same lookup.
  // Final authority on validity is the DB.
  const withoutWww = normalized.startsWith('www.') ? normalized.slice(4) : normalized
  return { type: 'tenant-custom', host: withoutWww }
}
