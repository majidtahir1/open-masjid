import type { PayloadRequest } from 'payload'

import { PLATFORM_DOMAIN } from './tenant-parse'

type TenantRef =
  | string
  | number
  | {
      id: string | number
      slug?: string | null
      customDomains?: Array<{ domain?: string | null } | null> | null
    }
  | null
  | undefined

function extractId(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

async function tenantBaseUrl(
  tenant: TenantRef,
  payload: PayloadRequest['payload'],
): Promise<string | null> {
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'

  let resolved: { slug?: string | null; customDomains?: Array<{ domain?: string | null } | null> | null } | null = null

  if (tenant && typeof tenant === 'object' && 'id' in tenant) {
    resolved = tenant
  } else {
    const id = extractId(tenant)
    if (!id) return null
    try {
      resolved = (await payload.findByID({
        collection: 'tenants',
        id,
        depth: 0,
        overrideAccess: true,
      })) as typeof resolved
    } catch {
      return null
    }
  }
  if (!resolved) return null

  const first = resolved.customDomains?.find((d) => d?.domain)?.domain
  if (first) return `https://${first}`
  if (resolved.slug) return `https://${resolved.slug}.${PLATFORM_DOMAIN}`
  return null
}

/**
 * Build a preview/live-preview URL for a doc that maps 1:1 to a public page.
 *
 * @param doc   the doc being edited; must have `slug` (and `tenant` for resolution).
 * @param req   Payload request (from the preview function's options).
 * @param path  path prefix before the slug, e.g. "events" → `/events/<slug>`.
 *              Pass '' for slug-at-root (e.g. Pages).
 */
export async function buildPreviewUrl(
  doc: Record<string, unknown>,
  req: PayloadRequest,
  path: string,
): Promise<string | null> {
  // Preview only makes sense after the doc is saved — Payload's internal
  // preview endpoint needs a real id to resolve. Returning null here tells
  // Payload to hide the button / disable the live-preview iframe.
  if (!doc?.id) return null

  const slug = doc.slug as string | null | undefined
  if (!slug) return null

  const base = await tenantBaseUrl(doc.tenant as TenantRef, req.payload)
  if (!base) return null

  const prefix = path ? `/${path.replace(/^\/+|\/+$/g, '')}` : ''
  return `${base}${prefix}/${encodeURIComponent(slug)}?draft=1`
}

/**
 * Build a preview URL pointing at the tenant homepage (for docs that don't
 * have individual pages — e.g. Announcements render as banners site-wide).
 */
export async function buildHomePreviewUrl(
  doc: Record<string, unknown>,
  req: PayloadRequest,
): Promise<string | null> {
  if (!doc?.id) return null
  const base = await tenantBaseUrl(doc.tenant as TenantRef, req.payload)
  if (!base) return null
  return `${base}/?draft=1`
}
