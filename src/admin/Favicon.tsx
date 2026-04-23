import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'

import config from '@payload-config'

const FALLBACK_HREF = '/brand/logo-icp.jpg'
const FALLBACK_MIME = 'image/jpeg'

type TenantRef =
  | string
  | number
  | { id: string | number; branding?: { logo?: unknown } }
  | null
  | undefined

function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

async function resolveFavicon(): Promise<{ href: string; type: string }> {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await getHeaders() })
    if (!user) return { href: FALLBACK_HREF, type: FALLBACK_MIME }

    const u = user as { tenant?: TenantRef }
    const tenantId = tenantIdOf(u.tenant)
    if (!tenantId) return { href: FALLBACK_HREF, type: FALLBACK_MIME }

    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 1,
      overrideAccess: true,
    })) as Record<string, unknown>

    const branding = tenant.branding as { logo?: unknown } | undefined
    const logo = branding?.logo as
      | { url?: string | null; mimeType?: string | null }
      | undefined

    if (!logo?.url) return { href: FALLBACK_HREF, type: FALLBACK_MIME }
    return { href: logo.url, type: logo.mimeType ?? FALLBACK_MIME }
  } catch {
    return { href: FALLBACK_HREF, type: FALLBACK_MIME }
  }
}

export default async function Favicon() {
  const { href, type } = await resolveFavicon()
  return (
    <>
      <link rel="icon" href={href} type={type} />
      <link rel="shortcut icon" href={href} type={type} />
    </>
  )
}
