import Link from 'next/link'
import React from 'react'

import { getAdminUser } from '@/lib/admin-context'

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

const ALLOWED_ROLES = new Set(['platformOwner', 'admin', 'school_admin', 'teacher'])

/**
 * Custom Payload nav link for school teachers and admins to reach the
 * Take Attendance page. Renders for platformOwner, admin, school_admin, and
 * teacher roles; staff and kioskManager are excluded.
 * Mirrors the DonationsNav / MembershipNav pattern.
 */
export default async function SundaySchoolNav() {
  try {
    const { user } = await getAdminUser()
    if (!user) return null

    const u = user as { tenant?: TenantRef; role?: string }
    if (!u.role || !ALLOWED_ROLES.has(u.role)) return null

    // platformOwner may not have a tenant; that's fine — the page handles it.
    // For tenant-scoped roles (school_admin, teacher, admin) require a tenant.
    const isSuperRole = u.role === 'platformOwner'
    const tenantId = tenantIdOf(u.tenant)
    if (!isSuperRole && !tenantId) return null

    return (
      <Link
        className="nav__link"
        href="/admin/sunday-school"
        data-sunday-school-nav-link
      >
        Programs
      </Link>
    )
  } catch {
    return null
  }
}
