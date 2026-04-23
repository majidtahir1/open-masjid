'use client'

import React, { useState } from 'react'

import InviteUserForm from './InviteUserView'

interface Props {
  isPlatformOwner: boolean
  tenants: Array<{ id: string | number; name?: string | null }>
  defaultTenantId?: string | number | null
}

/**
 * Toggle button + collapsible form, mounted above the Users list. Keeps the
 * "Create new" button on the right untouched; admins can still create a user
 * with a known password via the default flow, or invite via email here.
 */
export default function InviteUserPanelClient({
  isPlatformOwner,
  tenants,
  defaultTenantId,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ margin: '0 0 20px 0' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '8px 16px',
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-200, #cbd5e1)',
          background: open ? 'var(--theme-elevation-100, #f1f5f9)' : 'transparent',
          color: 'var(--theme-text)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {open ? '✕ Cancel invite' : '✉ Invite user by email'}
      </button>
      <p
        style={{
          margin: '6px 0 0',
          fontSize: 12,
          color: 'var(--theme-text-light, #64748b)',
        }}
      >
        Invite sends the user an email with a one-time link to set their password.
        Use <strong>Create New</strong> instead when you already know the password.
      </p>
      {open ? (
        <div style={{ marginTop: 12 }}>
          <InviteUserForm
            isPlatformOwner={isPlatformOwner}
            tenants={tenants}
            defaultTenantId={defaultTenantId}
          />
        </div>
      ) : null}
    </div>
  )
}
