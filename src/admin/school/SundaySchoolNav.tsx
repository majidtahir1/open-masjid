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

/**
 * Custom Payload nav link for school teachers and admins to reach the
 * Take Attendance page. Only renders for school_admin and teacher roles;
 * all other roles (platform owners, regular admins, staff, kiosk) get nothing.
 * Mirrors the DonationsNav / MembershipNav pattern.
 */
export default async function SundaySchoolNav() {
  try {
    const { user } = await getAdminUser()
    if (!user) return null

    const u = user as { tenant?: TenantRef; role?: string }
    if (u.role !== 'school_admin' && u.role !== 'teacher') return null

    const tenantId = tenantIdOf(u.tenant)
    if (!tenantId) return null

    return (
      <Link
        className="nav__link"
        href="/admin/take-attendance"
        data-sunday-school-nav-link
      >
        Take Attendance
      </Link>
    )
  } catch {
    return null
  }
}
