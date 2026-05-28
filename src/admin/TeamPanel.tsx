import Link from 'next/link'
import React from 'react'

import { getAdminUser } from '@/lib/admin-context'

type TenantRef = string | number | { id: string | number } | null | undefined

function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

const ROLE_LABEL: Record<string, string> = {
  platformOwner: 'Platform Owner',
  admin: 'Admin',
  staff: 'Staff',
  kioskManager: 'Kiosk Manager',
}

/**
 * Rendered inside the Team tab on the tenant edit page (Site Settings → Team).
 * Lets tenant admins see and manage other accounts in their masjid without
 * relying on the global Users nav (which is intentionally hidden via
 * `HideMediaAndPeopleNav`).
 *
 * Platform owners get a simple deep-link instead — they already have the full
 * Users collection in the sidebar. Staff and kiosk managers don't see the tab
 * at all (gated by the field's `access.read` in Tenants.ts).
 */
export default async function TeamPanel() {
  try {
    const { payload, user } = await getAdminUser()
    if (!user) return null

    const u = user as { role?: string; tenant?: TenantRef }
    const tenantId = tenantIdOf(u.tenant)

    if (u.role === 'platformOwner') {
      return (
        <div style={panelStyle}>
          <h3 style={headingStyle}>Team</h3>
          <p style={bodyStyle}>
            You can manage every user across all tenants from the Users
            collection.
          </p>
          <Link href="/admin/collections/users" style={primaryLinkStyle}>
            Open Users <span aria-hidden>→</span>
          </Link>
        </div>
      )
    }

    if (!tenantId) return null

    const members = await payload.find({
      collection: 'users',
      where: { tenant: { equals: tenantId } },
      limit: 200,
      depth: 0,
      sort: 'email',
    })

    const usersListHref = `/admin/collections/users?where[tenant][equals]=${tenantId}`

    return (
      <div style={panelStyle}>
        <h3 style={headingStyle}>Team</h3>
        <p style={bodyStyle}>
          People who can sign in to manage this masjid. Click a member to edit
          their profile, set their role, or mint an API key (used by the
          OpenMasjid chat skill and other integrations).
        </p>

        {members.docs.length === 0 ? (
          <p style={{ ...bodyStyle, fontStyle: 'italic' }}>No team members yet.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
              </tr>
            </thead>
            <tbody>
              {members.docs.map((m) => {
                const first = (m as { firstName?: string }).firstName ?? ''
                const last = (m as { lastName?: string }).lastName ?? ''
                const name = `${first} ${last}`.trim() || '—'
                const role = (m as { role?: string }).role ?? ''
                const isSelf = m.id === (user as { id?: string | number }).id
                return (
                  <tr key={m.id}>
                    <td style={tdStyle}>
                      <Link href={`/admin/collections/users/${m.id}`} style={cellLinkStyle}>
                        {name}
                        {isSelf ? <span style={youBadgeStyle}>you</span> : null}
                      </Link>
                    </td>
                    <td style={tdStyle}>{(m as { email?: string }).email ?? ''}</td>
                    <td style={tdStyle}>{ROLE_LABEL[role] ?? role}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <Link href={usersListHref} style={primaryLinkStyle}>
            Manage team <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    )
  } catch {
    return null
  }
}

const panelStyle: React.CSSProperties = { padding: '12px 0' }
const headingStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 8,
  fontSize: 18,
  fontWeight: 600,
}
const bodyStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 16,
  color: 'var(--theme-elevation-600)',
  fontSize: 14,
  lineHeight: 1.5,
  maxWidth: 640,
}
const tableStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 720,
  borderCollapse: 'collapse',
  fontSize: 14,
}
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1px solid var(--theme-elevation-150)',
  color: 'var(--theme-elevation-500)',
  fontWeight: 500,
}
const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--theme-elevation-100)',
  verticalAlign: 'middle',
}
const cellLinkStyle: React.CSSProperties = {
  color: 'var(--theme-elevation-900)',
  textDecoration: 'none',
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}
const youBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  padding: '2px 6px',
  borderRadius: 999,
  background: 'var(--theme-elevation-100)',
  color: 'var(--theme-elevation-600)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}
const primaryLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 16px',
  borderRadius: 4,
  background: 'var(--theme-elevation-800)',
  color: 'var(--theme-elevation-0)',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 600,
}
