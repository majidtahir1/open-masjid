import React from 'react'

import { getAdminUser, getAdminTenantWithRelations } from '@/lib/admin-context'
import OpenMasjidWordmark from './OpenMasjidWordmark'

type TenantRef =
  | string
  | number
  | { id: string | number; name?: string; branding?: { logo?: unknown } }
  | null
  | undefined

type TenantLogo = { url: string; alt: string; name: string }

function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

async function resolveTenantLogo(): Promise<TenantLogo | null> {
  try {
    const { user } = await getAdminUser()
    if (!user) return null

    const u = user as { tenant?: TenantRef; role?: string }
    const tenantId = tenantIdOf(u.tenant)
    if (!tenantId) return null

    const tenant = (await getAdminTenantWithRelations(tenantId)) as unknown as Record<string, unknown>

    const name = (tenant.name as string) ?? 'Tenant'
    const branding = tenant.branding as { logo?: unknown } | undefined
    const logo = branding?.logo as { url?: string | null; alt?: string | null } | undefined

    if (!logo?.url) return null
    return { url: logo.url, alt: logo.alt ?? name, name }
  } catch {
    return null
  }
}

export default async function Logo() {
  const tenantLogo = await resolveTenantLogo()

  if (tenantLogo) {
    return (
      <img
        className="graphic-logo graphic-logo--tenant"
        src={tenantLogo.url}
        alt={tenantLogo.alt}
      />
    )
  }

  return <OpenMasjidWordmark />
}
