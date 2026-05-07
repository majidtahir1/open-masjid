import React from 'react'

import { getAdminUser, getAdminTenant } from '@/lib/admin-context'

import InviteUserPanelClient from './InviteUserPanelClient'

type TenantRef = string | number | { id: string | number } | null | undefined

function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

/**
 * Rendered above the Users list view via `admin.components.beforeListTable`.
 *
 * Server component — resolves the current user's role + tenant and fetches
 * the tenant picker options (only for platformOwner). Delegates rendering +
 * state to `InviteUserPanelClient` which handles the toggle and form submit.
 */
export default async function InviteUserPanel() {
  try {
    const { payload, user } = await getAdminUser()
    if (!user) return null

    const u = user as { role?: string; tenant?: TenantRef }
    if (u.role !== 'platformOwner' && u.role !== 'admin') return null

    const isPlatformOwner = u.role === 'platformOwner'
    let tenants: Array<{ id: string | number; name?: string | null }> = []
    let defaultTenantId: string | number | null = null

    if (isPlatformOwner) {
      const res = await payload.find({
        collection: 'tenants',
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })
      tenants = res.docs.map((t) => ({
        id: (t as { id: string | number }).id,
        name: (t as { name?: string | null }).name,
      }))
    } else {
      const id = tenantIdOf(u.tenant)
      if (id != null) {
        defaultTenantId = id
        try {
          const t = (await getAdminTenant(id)) as {
            id: string | number
            name?: string | null
          }
          tenants = [{ id: t.id, name: t.name }]
        } catch {
          tenants = [{ id, name: null }]
        }
      }
    }

    return (
      <InviteUserPanelClient
        isPlatformOwner={isPlatformOwner}
        tenants={tenants}
        defaultTenantId={defaultTenantId}
      />
    )
  } catch {
    return null
  }
}
