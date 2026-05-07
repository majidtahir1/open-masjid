import React from 'react'

import { getAdminUser, getAdminTenant } from '@/lib/admin-context'
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
    const { user } = await getAdminUser()
    if (!user) return null

    const u = user as { tenant?: TenantRef }
    const tenantId = tenantIdOf(u.tenant)
    if (!tenantId) return null

    if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'

    const tenant = (await getAdminTenant(tenantId)) as {
      slug?: string
      customDomains?: Array<{ domain?: string | null }>
    }

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
      View public site ↗
    </a>
  )
}
