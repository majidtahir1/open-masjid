'use client'

import React, { useEffect, useState } from 'react'
import { useField } from '@payloadcms/ui'

/* ─── Curated neutral / pastel presets shown alongside the tenant's brand
   colors. Picked to read well on a form page background. ──────────────── */
const NEUTRAL_PRESETS = [
  '#FFFFFF', // white
  '#FAF9F4', // cream
  '#F4F5F7', // light gray
  '#E5E7EB', // mid gray
  '#0E1B2C', // ink navy
  '#146E69', // OpenMasjid teal
  '#C9A45A', // gold
  '#5B1F2D', // burgundy
]

function normalizeHex(raw: string | null | undefined): string {
  if (!raw) return ''
  const s = raw.trim()
  if (!s) return ''
  return s.startsWith('#') ? s : `#${s}`
}

function isValidHex(s: string | null | undefined): s is string {
  return Boolean(s && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s))
}

interface ColorPickerInlineProps {
  value?: string | null
  onChange: (v: string) => void
  /** Brand-color presets shown first. Empty when none configured. */
  brandPresets?: string[]
  placeholder?: string
}

function ColorPickerInline({
  value,
  onChange,
  brandPresets = [],
  placeholder,
}: ColorPickerInlineProps) {
  const safeForPicker = isValidHex(value) ? value : '#ffffff'
  const allPresets = [...brandPresets, ...NEUTRAL_PRESETS]
  const currentLower = (value ?? '').toLowerCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          aria-label="Custom color"
          value={safeForPicker}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 44,
            height: 36,
            border: '1px solid rgba(15,23,42,0.12)',
            borderRadius: 6,
            padding: 0,
            cursor: 'pointer',
            background: 'transparent',
          }}
        />
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(normalizeHex(e.target.value))}
          placeholder={placeholder ?? '#FAF9F4'}
          spellCheck={false}
          style={{
            flex: 1,
            padding: '8px 10px',
            border: '1px solid rgba(15,23,42,0.12)',
            borderRadius: 6,
            fontFamily: 'monospace',
            fontSize: 13,
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Clear"
            style={{
              padding: '6px 10px',
              border: '1px solid rgba(15,23,42,0.12)',
              borderRadius: 6,
              background: 'white',
              fontSize: 12,
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {brandPresets.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Brand
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {brandPresets.map((c) => (
                <SwatchButton
                  key={`brand-${c}`}
                  color={c}
                  selected={currentLower === c.toLowerCase()}
                  onClick={() => onChange(c)}
                />
              ))}
            </div>
          </>
        )}
        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: brandPresets.length > 0 ? 4 : 0 }}>
          Presets
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {NEUTRAL_PRESETS.map((c) => (
            <SwatchButton
              key={`preset-${c}`}
              color={c}
              selected={currentLower === c.toLowerCase()}
              onClick={() => onChange(c)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SwatchButton({
  color,
  selected,
  onClick,
}: {
  color: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`Use ${color}`}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        border: selected ? '2px solid #0E1B2C' : '1px solid rgba(15,23,42,0.12)',
        background: color,
        padding: 0,
        cursor: 'pointer',
        boxShadow: color.toLowerCase() === '#ffffff' ? 'inset 0 0 0 1px rgba(15,23,42,0.08)' : undefined,
      }}
    />
  )
}

/** Fetch the tenant's primary brand color so we can offer it as a preset. */
function useTenantBrandPresets(): string[] {
  const { value: tenantField } = useField<string | { id: string | number } | null>({
    path: 'tenant',
  })
  const tenantId =
    tenantField && typeof tenantField === 'object' && 'id' in tenantField
      ? tenantField.id
      : (tenantField as string | number | null)
  const [presets, setPresets] = useState<string[]>([])
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    fetch(`/api/tenants/${tenantId}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => {
        if (cancelled || !doc) return
        const branding = (doc.branding ?? {}) as Record<string, unknown>
        const out: string[] = []
        for (const key of ['primaryColor', 'secondaryColor', 'accentColor']) {
          const v = branding[key]
          if (typeof v === 'string' && isValidHex(v)) out.push(v)
        }
        setPresets(out)
      })
      .catch(() => { /* fall back to neutral presets only */ })
    return () => { cancelled = true }
  }, [tenantId])
  return presets
}

export default function Appearance() {
  // Tenant brand colors used as preset swatches in the picker
  const brandPresets = useTenantBrandPresets()

  // Display mode
  const { value: displayMode, setValue: setDisplayMode } = useField<string>({
    path: 'appearance.displayMode',
  })

  // Background color
  const { value: bgColor, setValue: setBgColor } = useField<string>({
    path: 'appearance.backgroundColor',
  })

  // Gradient
  const { value: gradFrom, setValue: setGradFrom } = useField<string>({
    path: 'appearance.backgroundGradient.from',
  })
  const { value: gradTo, setValue: setGradTo } = useField<string>({
    path: 'appearance.backgroundGradient.to',
  })
  const { value: gradDir, setValue: setGradDir } = useField<string>({
    path: 'appearance.backgroundGradient.direction',
  })

  // Live gradient preview when "from" is set
  const previewCss = (() => {
    const from = gradFrom
    const to = gradTo || from
    if (!from) return null
    const dir =
      gradDir === 'horizontal' ? '90deg' : gradDir === 'diagonal' ? '135deg' : '180deg'
    return `linear-gradient(${dir}, ${from}, ${to})`
  })()

  return (
    <div className="settings-section">
      <h2 className="settings-section__title">Appearance</h2>
      <p className="settings-section__desc">Customize how the form looks and feels.</p>

      {/* Display mode */}
      <div className="settings-card">
        <h3 className="settings-card__title">Display mode</h3>
        <p className="settings-card__hint" style={{ marginBottom: 8 }}>
          Choose whether all questions are shown at once or one at a time.
        </p>
        <select
          value={displayMode ?? 'all-at-once'}
          onChange={(e) => setDisplayMode(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid rgba(15,23,42,0.12)',
            fontSize: 14,
          }}
        >
          <option value="all-at-once">All questions on one page</option>
          <option value="one-per-page">One question per page (Typeform-style)</option>
        </select>
      </div>

      {/* Messages — richText fields edited in main view */}
      <div className="settings-card">
        <h3 className="settings-card__title">Intro message</h3>
        <p className="settings-field__helper">
          Optional message shown above the first field.{' '}
          <a href="../" style={{ color: '#1e3a5f', textDecoration: 'underline' }}>
            Edit intro message in the main form view
          </a>{' '}
          to use the full rich-text editor.
        </p>
      </div>

      <div className="settings-card">
        <h3 className="settings-card__title">Submission message</h3>
        <p className="settings-field__helper">
          Shown after a successful submission.{' '}
          <a href="../" style={{ color: '#1e3a5f', textDecoration: 'underline' }}>
            Edit submission message in the main form view
          </a>{' '}
          to use the full rich-text editor. Falls back to the Settings &rarr; Confirmation message
          if blank.
        </p>
      </div>

      {/* Background color */}
      <div className="settings-card">
        <h3 className="settings-card__title">Background color</h3>
        <p className="settings-card__hint" style={{ marginBottom: 8 }}>
          Solid color shown behind the form card. Ignored if a gradient is set below.
        </p>
        <ColorPickerInline
          value={bgColor}
          onChange={(v) => setBgColor(v)}
          brandPresets={brandPresets}
          placeholder="#FAF9F4"
        />
      </div>

      {/* Background gradient */}
      <div className="settings-card">
        <h3 className="settings-card__title">Background gradient</h3>
        <p className="settings-card__hint" style={{ marginBottom: 12 }}>
          When &quot;From&quot; is set, the gradient overrides the solid color.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              From
            </label>
            <ColorPickerInline
              value={gradFrom}
              onChange={(v) => setGradFrom(v)}
              brandPresets={brandPresets}
              placeholder="#1B3358"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              To
            </label>
            <ColorPickerInline
              value={gradTo}
              onChange={(v) => setGradTo(v)}
              brandPresets={brandPresets}
              placeholder="#0E1B2C"
            />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Direction
          </label>
          <select
            value={gradDir ?? 'vertical'}
            onChange={(e) => setGradDir(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid rgba(15,23,42,0.12)',
              fontSize: 14,
            }}
          >
            <option value="vertical">Top &rarr; Bottom</option>
            <option value="horizontal">Left &rarr; Right</option>
            <option value="diagonal">Diagonal (TL &rarr; BR)</option>
          </select>
        </div>
        {previewCss && (
          <div
            aria-label="Gradient preview"
            style={{
              marginTop: 12,
              height: 80,
              borderRadius: 8,
              background: previewCss,
              border: '1px solid rgba(15,23,42,0.08)',
            }}
          />
        )}
      </div>
    </div>
  )
}
