'use client'

import React, { useState } from 'react'

type SiteType = 'masjid' | 'umbrella'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Platform-owner tenant onboarding wizard. Collapses above the Tenants list.
 *
 * On submit, POSTs to /api/create-tenant which creates the tenant + an admin
 * user + fires the invite email. The default "Create New" button beside the
 * list still exists for power users who want the raw doc form.
 */
export default function CreateTenantPanelClient() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugDirty, setSlugDirty] = useState(false)
  const [siteType, setSiteType] = useState<SiteType>('masjid')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminFirstName, setAdminFirstName] = useState('')
  const [adminLastName, setAdminLastName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<
    { kind: 'ok' | 'error'; text: string } | null
  >(null)

  function onNameChange(next: string) {
    setName(next)
    if (!slugDirty) setSlug(slugify(next))
  }

  function onSlugChange(next: string) {
    setSlug(next)
    setSlugDirty(true)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/create-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          siteType,
          adminEmail: adminEmail.trim(),
          adminFirstName: adminFirstName.trim(),
          adminLastName: adminLastName.trim(),
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        adminEmail?: string
      }
      if (!res.ok || !json.ok) {
        setMessage({
          kind: 'error',
          text: json.error ?? `Request failed (${res.status})`,
        })
      } else {
        setMessage({
          kind: 'ok',
          text: `Tenant "${name}" created. Invite sent to ${json.adminEmail}.`,
        })
        setName('')
        setSlug('')
        setSlugDirty(false)
        setAdminEmail('')
        setAdminFirstName('')
        setAdminLastName('')
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
  const row: React.CSSProperties = { marginBottom: 14 }

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
        {open ? '✕ Cancel' : '🏛 Create new tenant (with admin invite)'}
      </button>
      <p
        style={{
          margin: '6px 0 0',
          fontSize: 12,
          color: 'var(--theme-text-light, #64748b)',
        }}
      >
        Creates the tenant, an admin user for it, and emails them a one-time link to set their password.
        Use <strong>Create New</strong> (right) to provision a tenant without an admin.
      </p>
      {open ? (
        <form
          onSubmit={onSubmit}
          style={{
            marginTop: 12,
            maxWidth: 560,
            padding: 20,
            background: 'var(--theme-elevation-0, #fff)',
            borderRadius: 8,
            border: '1px solid var(--theme-elevation-150, #e2e8f0)',
          }}
        >
          <div style={row}>
            <label style={label} htmlFor="ct-name">
              Tenant name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              id="ct-name"
              type="text"
              required
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Islamic Center of Example"
              style={input}
            />
          </div>
          <div style={{ ...row, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="ct-slug">
                URL slug <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="ct-slug"
                type="text"
                required
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder="icp"
                style={input}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
              />
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 11,
                  color: 'var(--theme-text-light, #64748b)',
                }}
              >
                e.g. <code>{slug || 'icp'}.openmasjid.app</code>
              </p>
            </div>
            <div>
              <label style={label} htmlFor="ct-type">
                Site type <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                id="ct-type"
                value={siteType}
                onChange={(e) => setSiteType(e.target.value as SiteType)}
                style={input}
              >
                <option value="masjid">Masjid</option>
                <option value="umbrella">Umbrella organization</option>
              </select>
            </div>
          </div>
          <hr
            style={{
              border: 0,
              borderTop: '1px solid var(--theme-elevation-150, #e2e8f0)',
              margin: '16px 0',
            }}
          />
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--theme-text)',
            }}
          >
            First admin for this tenant
          </p>
          <div style={row}>
            <label style={label} htmlFor="ct-email">
              Email <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              id="ct-email"
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@example.org"
              style={input}
              autoComplete="off"
            />
          </div>
          <div style={{ ...row, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="ct-first">
                First name
              </label>
              <input
                id="ct-first"
                type="text"
                value={adminFirstName}
                onChange={(e) => setAdminFirstName(e.target.value)}
                style={input}
              />
            </div>
            <div>
              <label style={label} htmlFor="ct-last">
                Last name
              </label>
              <input
                id="ct-last"
                type="text"
                value={adminLastName}
                onChange={(e) => setAdminLastName(e.target.value)}
                style={input}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
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
              {busy ? 'Creating…' : 'Create tenant + send invite'}
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
      ) : null}
    </div>
  )
}
