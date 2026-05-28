import Link from 'next/link'
import React from 'react'

import { getAdminUser } from '@/lib/admin-context'

/**
 * Sidebar deep-link to the signed-in user's own edit page. Tenant admins
 * need this to manage their account (set a name, mint an API key + scopes)
 * because the global Users / People nav is intentionally hidden by
 * `HideMediaAndPeopleNav` for tenant-scoped roles.
 *
 * Hidden for platformOwners — they have the full Users collection in nav
 * already and don't need a profile shortcut.
 */
export default async function ProfileLink() {
  try {
    const { user } = await getAdminUser()
    if (!user) return null

    const u = user as { id?: string | number; role?: string }
    if (u.role === 'platformOwner') return null
    if (!u.id) return null

    return (
      <Link className="nav__link" href={`/admin/collections/users/${u.id}`} data-profile-link>
        My Profile
      </Link>
    )
  } catch {
    return null
  }
}
