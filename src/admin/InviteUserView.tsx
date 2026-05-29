'use client'

import React, { useState } from 'react'

type Role = 'platformOwner' | 'admin' | 'staff' | 'kioskManager'

type Tenant = { id: string | number; name?: string | null }

interface Props {
  isPlatformOwner: boolean
  tenants: Tenant[]
  defaultTenantId?: string | number | null
}

/**
 * Client component rendered by the /admin/invite custom view.
 *
 * Collects email, role, and (for platform owners) target tenant. Submits to
 * POST /api/invite-user which creates the user with a random password and
 * fires Payload's forgot-password flow to send them a "set your password"
 * email.
 */
export default function InviteUserForm({
  isPlatformOwner,
  tenants,
  defaultTenantId,
}: Props) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [tenantId, setTenantId] = useState<string | number | ''>(
    defaultTenantId ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<
    { kind: 'ok' | 'error'; text: string } | null
  >(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim(),
          role,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          tenant: role === 'platformOwner' ? null : tenantId || null,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        email?: string
      }
      if (!res.ok || !json.ok) {
        setMessage({
          kind: 'error',
          text: json.error ?? `Request failed (${res.status})`,
        })
      } else {
        setMessage({
          kind: 'ok',
          text: `Invite sent to ${json.email}. They'll receive an email with a link to set their password.`,
        })
        setEmail('')
        setFirstName('')
        setLastName('')
      }
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const label: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: 'var(--theme-text)',
  }
  const input: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 4,
    border: '1px solid var(--theme-elevation-200, #cbd5e1)',
    fontSize: 14,
    background: 'var(--theme-elevation-0, #fff)',
    color: 'var(--theme-text)',
  }
  const row: React.CSSProperties = { marginBottom: 16 }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        maxWidth: 480,
        padding: 24,
        background: 'var(--theme-elevation-0, #fff)',
        borderRadius: 8,
        border: '1px solid var(--theme-elevation-150, #e2e8f0)',
      }}
    >
      <div style={row}>
        <label style={label} htmlFor="invite-email">
          Email <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
          placeholder="person@example.com"
          autoComplete="off"
        />
      </div>
      <div style={{ ...row, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={label} htmlFor="invite-first">
            First name
          </label>
          <input
            id="invite-first"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={input}
          />
        </div>
        <div>
          <label style={label} htmlFor="invite-last">
            Last name
          </label>
          <input
            id="invite-last"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={input}
          />
        </div>
      </div>
      <div style={row}>
        <label style={label} htmlFor="invite-role">
          Role <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          style={input}
        >
          {isPlatformOwner ? (
            <option value="platformOwner">Platform Owner — manages all tenants</option>
          ) : null}
          <option value="admin">Admin — full access within a tenant</option>
          <option value="staff">Staff — content only within a tenant</option>
          <option value="kioskManager">Display Manager — kiosk/display content only within a tenant</option>
        </select>
      </div>
      {role !== 'platformOwner' ? (
        <div style={row}>
          <label style={label} htmlFor="invite-tenant">
            Tenant <span style={{ color: '#dc2626' }}>*</span>
          </label>
          {isPlatformOwner ? (
            <select
              id="invite-tenant"
              required
              value={String(tenantId)}
              onChange={(e) => setTenantId(e.target.value)}
              style={input}
            >
              <option value="">Select a tenant…</option>
              {tenants.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name ?? t.id}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="invite-tenant"
              type="text"
              readOnly
              value={tenants[0]?.name ?? String(defaultTenantId ?? '')}
              style={{ ...input, background: 'var(--theme-elevation-50, #f8fafc)' }}
            />
          )}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '10px 18px',
            borderRadius: 4,
            background: 'var(--theme-elevation-800, #0F1E4A)',
            color: '#fff',
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Sending invite…' : 'Send invite'}
        </button>
        {message ? (
          <span
            style={{
              fontSize: 13,
              color: message.kind === 'ok' ? '#14532d' : '#991b1b',
            }}
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  )
}
