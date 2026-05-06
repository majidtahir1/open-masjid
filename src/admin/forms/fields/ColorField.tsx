'use client'

/**
 * ColorField — Payload v3 custom Field component.
 *
 * Renders a color picker (native chooser + hex input + brand/preset
 * swatches) instead of Payload's default text input. Wired into the
 * `appearance.backgroundColor` and `appearance.backgroundGradient.{from,to}`
 * fields on the Forms collection.
 *
 * Brand presets are pulled from the form's tenant via `/api/tenants/<id>`.
 */

import { useEffect, useState } from 'react'
import { useField } from '@payloadcms/ui'

const NEUTRAL_PRESETS = [
  '#FFFFFF',
  '#FAF9F4',
  '#F4F5F7',
  '#E5E7EB',
  '#0E1B2C',
  '#146E69',
  '#C9A45A',
  '#5B1F2D',
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

interface FieldProp {
  label?: string | Record<string, string> | false
  admin?: { description?: string; placeholder?: string }
}

function labelText(label: FieldProp['label'], fallback: string): string {
  if (!label) return fallback
  if (typeof label === 'string') return label
  return label.en ?? Object.values(label)[0] ?? fallback
}

export default function ColorField({
  field,
  path: pathFromProps,
}: {
  field: FieldProp
  path: string
}) {
  const { value, setValue, path } = useField<string>({
    potentiallyStalePath: pathFromProps,
  })
  const resolvedPath = path || pathFromProps
  const label = labelText(field.label, resolvedPath.split('.').pop() ?? 'Color')

  // Pull brand presets from the form's tenant
  const { value: tenantField } = useField<string | { id: string | number } | null>({
    path: 'tenant',
  })
  const tenantId =
    tenantField && typeof tenantField === 'object' && 'id' in tenantField
      ? tenantField.id
      : (tenantField as string | number | null)
  const [brandPresets, setBrandPresets] = useState<string[]>([])
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
        setBrandPresets(out)
      })
      .catch(() => { /* fall back */ })
    return () => { cancelled = true }
  }, [tenantId])

  const safeForPicker = isValidHex(value) ? value : '#ffffff'
  const currentLower = (value ?? '').toLowerCase()

  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <label
        htmlFor={resolvedPath}
        style={{
          display: 'block',
          marginBottom: 8,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--theme-elevation-800, #111827)',
        }}
      >
        {label}
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Native picker + hex text + clear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            aria-label="Custom color"
            value={safeForPicker}
            onChange={(e) => setValue(e.target.value)}
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
            id={resolvedPath}
            type="text"
            value={value ?? ''}
            onChange={(e) => setValue(normalizeHex(e.target.value))}
            placeholder={field.admin?.placeholder ?? '#FAF9F4'}
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
              onClick={() => setValue('')}
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

        {/* Preset rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {brandPresets.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Brand
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {brandPresets.map((c) => (
                  <Swatch
                    key={`brand-${c}`}
                    color={c}
                    selected={currentLower === c.toLowerCase()}
                    onClick={() => setValue(c)}
                  />
                ))}
              </div>
            </>
          )}
          <div
            style={{
              fontSize: 11,
              color: '#6b7280',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginTop: brandPresets.length > 0 ? 4 : 0,
            }}
          >
            Presets
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {NEUTRAL_PRESETS.map((c) => (
              <Swatch
                key={`preset-${c}`}
                color={c}
                selected={currentLower === c.toLowerCase()}
                onClick={() => setValue(c)}
              />
            ))}
          </div>
        </div>

        {field.admin?.description && (
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{field.admin.description}</p>
        )}
      </div>
    </div>
  )
}

function Swatch({
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
        boxShadow:
          color.toLowerCase() === '#ffffff' ? 'inset 0 0 0 1px rgba(15,23,42,0.08)' : undefined,
      }}
    />
  )
}
