'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { ExternalLink, X } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type IdentityInitial = {
  name?: string
  footerTagline?: string
  contactInfo?: {
    address?: string
    phone?: string
    email?: string
  }
  socialLinks?: Array<{ platform: string; url: string }>
}

type Props = {
  initial: IdentityInitial
  tenantName: string
  publicUrl: string
  onClose: () => void
  onSaved: () => void
  onAdvance?: () => void
  mode?: 'modal' | 'standalone'
  markCompleteOnSave?: boolean
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'twitter', label: 'Twitter / X' },
  { key: 'linkedin', label: 'LinkedIn' },
] as const

const SCOPE_CLASS = 'om-identity-step'

const SCOPED_CSS = `
.${SCOPE_CLASS} .om-grid-3 {
  display: grid;
  gap: var(--sp-3);
  grid-template-columns: 1fr 1fr 1fr;
}
.${SCOPE_CLASS} .om-grid-2 {
  display: grid;
  gap: var(--sp-3);
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 640px) {
  .${SCOPE_CLASS} .om-grid-3,
  .${SCOPE_CLASS} .om-grid-2 {
    grid-template-columns: 1fr;
  }
}
`

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const inputStyle: CSSProperties = {
  padding: '12px 14px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-md)',
  background: 'var(--bg)',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--fg1)',
  width: '100%',
  outline: 'none',
}

const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--fg1)',
}

const helperStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  color: 'var(--fg3)',
  lineHeight: 1.5,
}

function Field({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: ReactNode
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={labelStyle}>{label}</span>
      {helper && <p style={helperStyle}>{helper}</p>}
      {children}
    </div>
  )
}

function splitAddress(addr?: string): [string, string, string] {
  const parts = (addr ?? '').split('\n')
  return [parts[0] ?? '', parts[1] ?? '', parts[2] ?? '']
}

function joinAddress(street: string, city: string, stateZip: string): string {
  return [street, city, stateZip].join('\n')
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export function IdentityStep({
  initial,
  tenantName: _tenantName,
  publicUrl,
  onClose,
  onSaved,
  onAdvance,
  mode = 'modal',
  markCompleteOnSave = true,
}: Props) {
  const [name, setName] = useState(initial.name ?? '')
  const [footerTagline, setFooterTagline] = useState(initial.footerTagline ?? '')

  const [aStreet, aCity, aStateZip] = splitAddress(initial.contactInfo?.address)
  const [street, setStreet] = useState(aStreet)
  const [city, setCity] = useState(aCity)
  const [stateZip, setStateZip] = useState(aStateZip)

  const [phone, setPhone] = useState(initial.contactInfo?.phone ?? '')
  const [email, setEmail] = useState(initial.contactInfo?.email ?? '')

  const initialSocial = (initial.socialLinks ?? []).reduce<Record<string, string>>(
    (acc, s) => {
      if (s?.platform) acc[s.platform] = s.url ?? ''
      return acc
    },
    {},
  )
  const [social, setSocial] = useState<Record<string, string>>(() => ({
    instagram: initialSocial.instagram ?? '',
    facebook: initialSocial.facebook ?? '',
    youtube: initialSocial.youtube ?? '',
    twitter: initialSocial.twitter ?? '',
    linkedin: initialSocial.linkedin ?? '',
  }))

  const [saving, setSaving] = useState<'draft' | 'continue' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (kind: 'draft' | 'continue') => {
    const markComplete = kind === 'continue'
    setError(null)
    setSaving(kind)
    try {
      const socialLinks = SOCIAL_PLATFORMS.map((p) => ({
        platform: p.key,
        url: social[p.key]?.trim() ?? '',
      })).filter((s) => s.url.length > 0)

      const res = await fetch('/admin/api/onboarding/identity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          footerTagline: footerTagline.trim(),
          contactInfo: {
            address: joinAddress(street.trim(), city.trim(), stateZip.trim()),
            phone: phone.trim(),
            email: email.trim(),
          },
          socialLinks,
          markComplete,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Save failed (${res.status})`)
      }
      if (kind === 'continue' && onAdvance) {
        onAdvance()
      } else {
        onSaved()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div
      className={SCOPE_CLASS}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--sh-sm)',
        overflow: 'hidden',
        fontFamily: 'var(--font-body)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />

      {/* ---------- Sticky header + progress bar ---------- */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            padding: 'var(--sp-6) var(--sp-8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--sp-6)',
          }}
        >
          <div>
            {mode === 'modal' && (
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'var(--fg3)',
                  textTransform: 'uppercase',
                }}
              >
                Step 02 of 06
              </p>
            )}
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 28,
                lineHeight: 1.15,
                color: 'var(--fg1)',
              }}
            >
              Identity & Contact
            </h2>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
            }}
          >
            <HeaderSaveButton saving={saving} onSave={() => void submit(mode === 'modal' ? 'draft' : 'continue')} />
            {mode === 'modal' && (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 6,
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--fg2)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>

        {/* ---------- Progress bar ---------- */}
        {mode === 'modal' && (
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '0 var(--sp-8)',
              background: 'var(--bg)',
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  background: i === 1 ? 'var(--brand)' : 'var(--icp-gray-100)',
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------- Body ---------- */}
      <div
        style={{
          padding: 'var(--sp-10) var(--sp-12)',
          display: 'grid',
          gap: 'var(--sp-10)',
        }}
      >
        {/* Section header */}
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: 'var(--fg3)',
              textTransform: 'uppercase',
            }}
          >
            {mode === 'modal' ? 'Step 02 of 06 · Identity & Contact' : 'Identity & Contact'}
          </p>
          <h1
            style={{
              margin: 'var(--sp-3) 0 var(--sp-3) 0',
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              lineHeight: 1.1,
              color: 'var(--fg1)',
            }}
          >
            Tell visitors{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>who you are.</em>
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 640,
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--fs-sm)',
              color: 'var(--fg2)',
              lineHeight: 1.55,
            }}
          >
            Address, phone, email, social links, footer tagline. Shows in the site
            header, footer, and contact page.
          </p>
        </div>

        {/* Masjid name */}
        <Field label="Masjid name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </Field>

        {/* Tagline */}
        <Field
          label="Tagline"
          helper="Shown under the masjid name in the footer."
        >
          <input
            type="text"
            value={footerTagline}
            onChange={(e) => setFooterTagline(e.target.value)}
            style={inputStyle}
          />
        </Field>

        {/* Address */}
        <section style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <span style={labelStyle}>Address</span>
          <p style={helperStyle}>
            Used for the contact page map and prayer-time location.
          </p>
          <div className="om-grid-3">
            <div style={{ display: 'grid', gap: 6 }}>
              <span
                style={{
                  ...labelStyle,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--fg2)',
                }}
              >
                Street
              </span>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span
                style={{
                  ...labelStyle,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--fg2)',
                }}
              >
                City
              </span>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span
                style={{
                  ...labelStyle,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--fg2)',
                }}
              >
                State / ZIP
              </span>
              <input
                type="text"
                value={stateZip}
                onChange={(e) => setStateZip(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </section>

        {/* Contact */}
        <section style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <span style={labelStyle}>Contact</span>
          <div className="om-grid-2">
            <div style={{ display: 'grid', gap: 6 }}>
              <span
                style={{
                  ...labelStyle,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--fg2)',
                }}
              >
                Phone
              </span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span
                style={{
                  ...labelStyle,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--fg2)',
                }}
              >
                Email
              </span>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </section>

        {/* Social links */}
        <section style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <span style={labelStyle}>Social links</span>
          <p style={helperStyle}>Optional. Leave blank to hide an icon.</p>
          <div className="om-grid-3">
            {SOCIAL_PLATFORMS.map((p) => (
              <div key={p.key} style={{ display: 'grid', gap: 6 }}>
                <span
                  style={{
                    ...labelStyle,
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--fg2)',
                  }}
                >
                  {p.label}
                </span>
                <input
                  type="text"
                  value={social[p.key] ?? ''}
                  onChange={(e) =>
                    setSocial((prev) => ({ ...prev, [p.key]: e.target.value }))
                  }
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div
            role="alert"
            style={{
              padding: 'var(--sp-3) var(--sp-4)',
              borderRadius: 'var(--r-md)',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* ---------- Footer ---------- */}
      <div
        style={{
          padding: 'var(--sp-5) var(--sp-8)',
          background: 'var(--bg-alt)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--sp-4)',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--sp-6)',
          }}
        >
          {mode === 'modal' && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--fg3)',
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
          )}
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--fg2)',
            }}
          >
            <ExternalLink size={14} strokeWidth={1.75} />
            Preview
          </a>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
          }}
        >
          {mode === 'modal' && (
            <SecondaryFooterButton
              disabled={saving !== null}
              onClick={() => void submit('draft')}
            >
              {saving === 'draft' ? 'Saving...' : 'Save draft'}
            </SecondaryFooterButton>
          )}
          <PrimaryFooterButton
            disabled={saving !== null}
            onClick={() => void submit(markCompleteOnSave ? 'continue' : 'draft')}
          >
            {saving !== null && (markCompleteOnSave ? saving === 'continue' : saving === 'draft')
              ? 'Saving...'
              : markCompleteOnSave
                ? 'Save & continue →'
                : 'Save changes →'}
          </PrimaryFooterButton>
        </div>
      </div>
    </div>
  )
}

function HeaderSaveButton({
  saving,
  onSave,
}: {
  saving: 'draft' | 'continue' | null
  onSave: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const isSaving = saving !== null
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={isSaving}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: hovered && !isSaving ? 'var(--brand-hover)' : 'var(--brand)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: 'var(--r-md)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-sm)',
        fontWeight: 600,
        border: 'none',
        cursor: isSaving ? 'wait' : 'pointer',
        opacity: isSaving ? 0.6 : 1,
        transform: hovered && !isSaving ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'background var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
      }}
    >
      {isSaving ? 'Saving…' : 'Save'}
    </button>
  )
}

const baseFooterBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 18px',
  borderRadius: 'var(--r-md)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1,
  cursor: 'pointer',
  border: '1px solid transparent',
  transition: 'background var(--dur-base) var(--ease-out)',
}

function PrimaryFooterButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseFooterBtn,
        background: 'var(--brand)',
        color: '#fff',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

function SecondaryFooterButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseFooterBtn,
        background: 'var(--bg)',
        color: 'var(--fg1)',
        borderColor: 'var(--border)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

export default IdentityStep
