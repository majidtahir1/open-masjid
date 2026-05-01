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
 * Bottom-of-nav cluster: a "Site Settings" section header followed by
 * "Site Settings" (the tenant edit page) and "Billing" as visually nested
 * sub-entries. Lives in `afterNavLinks` so it renders below all collection
 * groups regardless of how many groups are added.
 *
 * Hidden for unauthenticated users and platform owners (who don't have a
 * single tenant context).
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
      <div className="nav-group" data-site-settings-cluster>
        <div className="nav-group__toggle" aria-hidden>
          <div className="nav-group__label">Site Settings</div>
        </div>
        <Link
          className="nav__link"
          href={`/admin/collections/tenants/${tenantId}`}
          style={{ paddingLeft: 'calc(var(--base) * 1.5)' }}
        >
          General
        </Link>
        <Link
          className="nav__link"
          href="/admin/billing"
          style={{ paddingLeft: 'calc(var(--base) * 1.5)' }}
        >
          Billing
        </Link>
      </div>
    )
  } catch {
    return null
  }
}
