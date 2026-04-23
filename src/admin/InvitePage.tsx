import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@payload-config'

import InviteUserForm from './InviteUserView'

type TenantRef = string | number | { id: string | number } | null | undefined

function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

/**
 * Custom admin view at /admin/invite. Collects user email + role + tenant
 * and dispatches to POST /api/invite-user.
 *
 * Server component — resolves the current user, loads available tenants for
 * platformOwners (all tenants) or the single own tenant for admins, and
 * passes down to the client form.
 */
export default async function InvitePage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!user) redirect('/admin/login')

  const u = user as { role?: string; tenant?: TenantRef }
  if (u.role !== 'platformOwner' && u.role !== 'admin') {
    redirect('/admin')
  }

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
        const t = (await payload.findByID({
          collection: 'tenants',
          id,
          depth: 0,
          overrideAccess: true,
        })) as { id: string | number; name?: string | null }
        tenants = [{ id: t.id, name: t.name }]
      } catch {
        tenants = [{ id, name: null }]
      }
    }
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Invite a user</h1>
      <p
        style={{
          margin: '0 0 24px',
          color: 'var(--theme-text-light, #64748b)',
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        The invitee will get an email with a one-time link to set their password and sign in.
        {isPlatformOwner
          ? ' Platform owners can assign any role to any tenant.'
          : ' You can invite admins and staff into your own tenant.'}
      </p>
      <InviteUserForm
        isPlatformOwner={isPlatformOwner}
        tenants={tenants}
        defaultTenantId={defaultTenantId}
      />
    </div>
  )
}
