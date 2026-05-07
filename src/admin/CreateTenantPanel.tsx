import React from 'react'

import { getAdminUser } from '@/lib/admin-context'

import CreateTenantPanelClient from './CreateTenantPanelClient'

/**
 * Rendered above the Tenants list via `admin.components.beforeListTable`.
 *
 * Only platform owners get the create panel (tenant admins can't reach the
 * Tenants list anyway — the sidebar link is CSS-hidden for them and the
 * collection's access rule scopes reads to their own tenant).
 */
export default async function CreateTenantPanel() {
  try {
    const { user } = await getAdminUser()
    if (!user) return null
    const u = user as { role?: string }
    if (u.role !== 'platformOwner') return null
    return <CreateTenantPanelClient />
  } catch {
    return null
  }
}
