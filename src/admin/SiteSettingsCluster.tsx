import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@payload-config'

type TenantRef =
  | string
  | number
  | { id: string | number }
  | null
  | undefined

function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

/**
 * Bottom-anchored Site Settings link. Lives in `afterNavLinks` and uses
 * `margin-top: auto` so it floats to the bottom of the flex sidebar
 * regardless of how many groups are above it. Billing lives as a tab
 * inside the tenant edit page (not as a separate sidebar entry) — admins
 * rarely need to see it day-to-day.
 */
export default async function SiteSettingsCluster() {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await getHeaders() })
    if (!user) return null

    const u = user as { tenant?: TenantRef; role?: string }
    if (u.role === 'platformOwner') return null

    const tenantId = tenantIdOf(u.tenant)
    if (!tenantId) return null

    return (
      <Link
        className="nav__link"
        href={`/admin/collections/tenants/${tenantId}`}
        data-site-settings-link
        style={{ marginTop: 'auto' }}
      >
        Site Settings
      </Link>
    )
  } catch {
    return null
  }
}
