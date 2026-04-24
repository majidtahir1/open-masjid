import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'

import config from '@payload-config'

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
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await getHeaders() })
    if (!user) return null
    const u = user as { role?: string }
    if (u.role !== 'platformOwner') return null
    return <CreateTenantPanelClient />
  } catch {
    return null
  }
}
