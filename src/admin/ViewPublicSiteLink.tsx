import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'

import config from '@payload-config'
import { PLATFORM_DOMAIN } from '@/lib/tenant-parse'

type TenantRef =
  | string
  | number
  | { id: string | number; slug?: string; customDomains?: Array<{ domain?: string | null }> }
  | null
  | undefined

function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

async function resolvePublicUrl(): Promise<string | null> {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await getHeaders() })
    if (!user) return null

    const u = user as { tenant?: TenantRef }
    const tenantId = tenantIdOf(u.tenant)
    if (!tenantId) return null

    if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'

    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })) as { slug?: string; customDomains?: Array<{ domain?: string | null }> }

    const firstCustom = tenant.customDomains?.find((d) => d?.domain)?.domain
    if (firstCustom) return `https://${firstCustom}`

    if (tenant.slug) return `https://${tenant.slug}.${PLATFORM_DOMAIN}`

    return null
  } catch {
    return null
  }
}

export default async function ViewPublicSiteLink() {
  const url = await resolvePublicUrl()
  if (!url) return null
  return (
    <a
      className="nav__link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-view-public-site
    >
      <svg
        aria-hidden
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 10 }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      View public site ↗
    </a>
  )
}
