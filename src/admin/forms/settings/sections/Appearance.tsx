'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'

interface ColorInputProps {
  value?: string | null
  onChange: (v: string) => void
  placeholder?: string
}

function ColorInput({ value, onChange, placeholder }: ColorInputProps) {
  return (
    <div className="form-field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 40,
          height: 32,
          border: '1px solid rgba(15,23,42,0.12)',
          borderRadius: 6,
          padding: 0,
          cursor: 'pointer',
        }}
      />
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: '8px 10px',
          border: '1px solid rgba(15,23,42,0.12)',
          borderRadius: 6,
          fontFamily: 'monospace',
          fontSize: 13,
        }}
      />
    </div>
  )
}

export default function Appearance() {
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
        <ColorInput
          value={bgColor}
          onChange={(v) => setBgColor(v)}
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
            <ColorInput
              value={gradFrom}
              onChange={(v) => setGradFrom(v)}
              placeholder="#1B3358"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              To
            </label>
            <ColorInput
              value={gradTo}
              onChange={(v) => setGradTo(v)}
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
