import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@payload-config'

/**
 * Sidebar "Invite user" link — visible only for platformOwner and admin users.
 */
export default async function InviteLink() {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await getHeaders() })
    if (!user) return null
    const u = user as { role?: string }
    if (u.role !== 'platformOwner' && u.role !== 'admin') return null

    return (
      <Link className="nav__link" href="/admin/invite">
        Invite user
      </Link>
    )
  } catch {
    return null
  }
}
