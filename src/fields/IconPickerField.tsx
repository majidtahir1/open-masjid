'use client'

import { FieldLabel, useField } from '@payloadcms/ui'
import React from 'react'

import LucideIconByName from '@/components/LucideIcon'
import { CURATED_ICONS } from '@/lib/curatedServiceIcons'

interface Props {
  path: string
  field?: { label?: string | false; required?: boolean; admin?: { description?: string } }
}

/**
 * Custom Payload Field that renders a visual grid of curated Lucide icons.
 * Admins click an icon to select; the underlying value is the kebab-case
 * Lucide name (so the public-site `LucideIconByName` component still works
 * and the schema stays a plain `text` field).
 *
 * An optional "Custom" text input at the bottom lets power users type any
 * Lucide name not in the curated list — same escape hatch as before, but
 * no longer the default UX.
 */
export default function IconPickerField({ path, field }: Props) {
  const { value, setValue } = useField<string>({ path })

  const selected = typeof value === 'string' ? value : ''
  const isCustom = selected !== '' && !CURATED_ICONS.some((c) => c.name === selected)

  const label = field?.label === false ? undefined : field?.label ?? undefined
  const required = field?.required ?? false
  const description = field?.admin?.description

  return (
    <div className="field-type" style={{ marginBottom: '1rem' }}>
      {label ? <FieldLabel label={label} required={required} /> : null}
      {description ? (
        <p
          style={{
            margin: '0 0 8px',
            color: 'var(--theme-text-light, #64748b)',
            fontSize: 12,
          }}
        >
          {description}
        </p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
          gap: 8,
          marginBottom: 12,
        }}
      >
        {CURATED_ICONS.map(({ name, label }) => {
          const active = selected === name
          return (
            <button
              type="button"
              key={name}
              onClick={() => setValue(name)}
              title={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '10px 6px',
                border: `1px solid ${active ? 'var(--theme-elevation-800, #0F1E4A)' : 'var(--theme-elevation-150, #e2e8f0)'}`,
                borderRadius: 6,
                background: active
                  ? 'var(--theme-elevation-100, #f1f5f9)'
                  : 'var(--theme-elevation-0, #fff)',
                color: 'var(--theme-text)',
                cursor: 'pointer',
                outline: active ? '2px solid var(--theme-elevation-800, #0F1E4A)' : 'none',
                outlineOffset: -1,
              }}
            >
              <LucideIconByName name={name} size={22} strokeWidth={1.75} />
              <span
                style={{
                  fontSize: 10,
                  textAlign: 'center',
                  color: 'var(--theme-text-light, #64748b)',
                  lineHeight: 1.2,
                  wordBreak: 'break-word',
                }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>

      <details style={{ fontSize: 13, marginTop: 6 }}>
        <summary
          style={{
            cursor: 'pointer',
            color: 'var(--theme-text-light, #64748b)',
            userSelect: 'none',
          }}
        >
          Use a custom icon (any name from lucide.dev)
        </summary>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={isCustom ? selected : ''}
            onChange={(e) => setValue(e.target.value.trim())}
            placeholder="book-open-check"
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 4,
              border: '1px solid var(--theme-elevation-200, #cbd5e1)',
              fontSize: 14,
            }}
          />
          {isCustom && selected ? (
            <span
              style={{
                width: 36,
                height: 36,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 4,
                border: '1px solid var(--theme-elevation-150, #e2e8f0)',
              }}
              title={`Preview: ${selected}`}
            >
              <LucideIconByName name={selected} size={20} />
            </span>
          ) : null}
        </div>
      </details>
    </div>
  )
}
