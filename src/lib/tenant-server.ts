/**
 * Server-only tenant helpers.
 *
 * These run in the Node runtime (server components, route handlers) and are
 * free to import Payload, `next/headers`, etc.
 *
 * DO NOT import this file from:
 *   - `src/middleware.ts` (Edge runtime)
 *   - any `'use client'` module
 *   - any file that itself is imported transitively by middleware
 *
 * For the Edge-safe host classifier, import from `./tenant-parse` instead.
 */

// NOTE: we intentionally do not `import 'server-only'` here because the
// package is not a direct dependency of this project. The Edge/Node split
// is enforced by convention: middleware only imports `./tenant-parse`, and
// this file is never transitively reachable from middleware.

import { parseHostContext, type TenantContext, type TenantRecord } from './tenant-parse'

export { parseHostContext }
export type { TenantContext, TenantRecord }

/**
 * Read the `x-tenant-context` header that middleware attached to the request
 * and return the parsed context.
 *
 * Falls back to re-parsing the `host` header if the context header is
 * missing (e.g. during a direct RSC render with no middleware pass, or
 * during build-time pre-rendering).
 *
 * Final fallback is `{ type: 'localhost' }` so that server components remain
 * safe to render in non-request contexts.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const { headers } = await import('next/headers')
  const h = await headers()

  const raw = h.get('x-tenant-context')
  if (raw) {
    try {
      return JSON.parse(raw) as TenantContext
    } catch {
      // fall through to host-based parse
    }
  }

  const host = h.get('host') || ''
  return parseHostContext(host)
}

/**
 * Full tenant resolution via Payload.
 *
 * Returns `null` when the context does not correspond to a tenant
 * (marketing, platform admin, localhost with no DEV_TENANT_SLUG, or an
 * unregistered custom domain).
 */
export async function resolveTenantFromContext(
  context: TenantContext,
): Promise<TenantRecord | null> {
  if (context.type === 'platform-marketing' || context.type === 'platform-admin') {
    return null
  }

  if (context.type === 'localhost') {
    const devSlug = process.env.DEV_TENANT_SLUG
    if (!devSlug) return null
    return findTenantBySlug(devSlug)
  }

  if (context.type === 'tenant-subdomain') {
    return findTenantBySlug(context.slug)
  }

  // tenant-custom
  return findTenantByCustomDomain(context.host)
}

/**
 * Convenience: read the context from request headers and resolve the tenant
 * in one call.
 */
export async function getCurrentTenant(): Promise<TenantRecord | null> {
  const ctx = await getTenantContext()
  return resolveTenantFromContext(ctx)
}

async function findTenantBySlug(slug: string): Promise<TenantRecord | null> {
  const payload = await getPayloadClient()
  if (!payload) return null

  try {
    const result = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
    })
    return (result.docs[0] as TenantRecord) ?? null
  } catch {
    // Collection may not exist yet, or DB may be unavailable during build.
    return null
  }
}

async function findTenantByCustomDomain(host: string): Promise<TenantRecord | null> {
  const payload = await getPayloadClient()
  if (!payload) return null

  const candidates = [host]
  if (host.startsWith('www.')) candidates.push(host.slice(4))
  else candidates.push(`www.${host}`)

  try {
    const result = await payload.find({
      collection: 'tenants',
      where: {
        or: candidates.map((domain) => ({
          'customDomains.domain': { equals: domain },
        })),
      },
      limit: 1,
      depth: 1,
    })
    if (result.docs[0]) return result.docs[0] as TenantRecord

    // Fallback: some collection shapes may store customDomains as a plain
    // array of strings rather than { domain } subfields.
    const fallback = await payload.find({
      collection: 'tenants',
      where: {
        or: candidates.map((domain) => ({
          customDomains: { contains: domain },
        })),
      },
      limit: 1,
      depth: 1,
    })
    return (fallback.docs[0] as TenantRecord) ?? null
  } catch {
    return null
  }
}

interface PayloadLike {
  find: (args: {
    collection: string
    where?: unknown
    limit?: number
    depth?: number
  }) => Promise<{ docs: unknown[] }>
}

/**
 * Lazily load Payload. Wrapped in try/catch so missing config or pre-build
 * environments never throw from a server component render.
 */
async function getPayloadClient(): Promise<PayloadLike | null> {
  try {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    return (await getPayload({ config })) as unknown as PayloadLike
  } catch {
    return null
  }
}
