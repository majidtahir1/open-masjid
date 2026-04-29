'use client'

/**
 * Custom Payload field for the per-slide `photoTone` selector. Renders four
 * swatch tiles instead of a text dropdown so editors see the actual color
 * each slot maps to:
 *
 *   - Brand     → resolves CSS var --brand on the admin document root
 *   - Secondary → resolves --secondary
 *   - Accent    → resolves --accent
 *   - Custom    → free-form color input; value is stored in a sibling
 *                 `customColor` text field (controlled here via `useFormFields`).
 *
 * Resolves CSS variable values on mount + whenever the document theme changes
 * so per-tenant skinning (if ever applied to admin) flows through. For now the
 * Payload admin always uses the platform defaults from globals.css, so editors
 * see ICP's navy/teal/gold by default — when a tenant brand override is in
 * effect, the swatches reflect it automatically.
 */

import { useField, useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'

type Tone = 'brand' | 'secondary' | 'accent' | 'custom'

const SLOTS: Array<{ value: Exclude<Tone, 'custom'>; label: string; cssVar: string }> = [
  { value: 'brand', label: 'Brand', cssVar: '--brand' },
  { value: 'secondary', label: 'Secondary', cssVar: '--secondary' },
  { value: 'accent', label: 'Accent', cssVar: '--accent' },
]

type FieldProp = {
  name?: string
  label?: string | Record<string, string> | false
  required?: boolean
  admin?: { description?: string }
}

function labelText(label: FieldProp['label'], fallback: string): string {
  if (!label) return fallback
  if (typeof label === 'string') return label
  return label.en ?? Object.values(label)[0] ?? fallback
}

function readCssVar(name: string): string {
  if (typeof window === 'undefined') return ''
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name)
  return raw.trim()
}

export default function PhotoToneField({
  field,
  path: pathFromProps,
}: {
  field: FieldProp
  path: string
}) {
  const { value, setValue, path } = useField<Tone>({
    potentiallyStalePath: pathFromProps,
  })
  const resolvedPath = path || pathFromProps

  // Sibling `customColor` field lives at the same group depth — derive its
  // path by replacing the trailing segment.
  const customColorPath = resolvedPath.replace(/\.photoTone$/, '.customColor')

  // Subscribe to the sibling so the input + swatch reflect the latest value.
  const customColorValue = useFormFields(([fields]) => {
    const v = fields?.[customColorPath]?.value
    return typeof v === 'string' ? v : ''
  })
  const dispatchFields = useFormFields((reducer) => reducer[1])

  const [resolvedHexes, setResolvedHexes] = useState<Record<string, string>>({})

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const slot of SLOTS) next[slot.value] = readCssVar(slot.cssVar) || '#888'
    setResolvedHexes(next)
  }, [])

  const label = labelText(field.label, field.name ?? resolvedPath)
  const current: Tone = (value as Tone) ?? 'secondary'

  const onPick = (tone: Tone) => {
    setValue(tone)
  }

  const onCustomChange = (hex: string) => {
    setValue('custom')
    dispatchFields({
      type: 'UPDATE',
      path: customColorPath,
      value: hex,
    })
  }

  // What the "Custom" swatch should show when picked. Default to a neutral
  // color so the input has something to edit.
  const customDisplay = customColorValue || '#888888'

  return (
    <div className="space-y-2 mb-4">
      <Label htmlFor={resolvedPath} className="text-base font-medium">
        {label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div
        id={resolvedPath}
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-3"
      >
        {SLOTS.map((slot) => {
          const hex = resolvedHexes[slot.value] ?? '#888'
          const active = current === slot.value
          return (
            <button
              key={slot.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(slot.value)}
              className={[
                'flex items-center gap-3 rounded-md border px-3 py-2 text-left',
                'transition-colors duration-150',
                active
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/50',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className="h-7 w-7 rounded-md border border-border"
                style={{ background: hex || '#888' }}
              />
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-medium">{slot.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {hex || '—'}
                </span>
              </span>
            </button>
          )
        })}

        {/* Custom slot */}
        <button
          type="button"
          role="radio"
          aria-checked={current === 'custom'}
          onClick={() => onPick('custom')}
          className={[
            'flex items-center gap-3 rounded-md border px-3 py-2 text-left',
            'transition-colors duration-150',
            current === 'custom'
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border hover:border-primary/50',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className="h-7 w-7 rounded-md border border-border"
            style={{
              background:
                current === 'custom'
                  ? customDisplay
                  : 'repeating-linear-gradient(45deg, #eee, #eee 4px, #fff 4px, #fff 8px)',
            }}
          />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-medium">Custom</span>
            <span className="font-mono text-xs text-muted-foreground">
              {current === 'custom' ? customDisplay : 'Pick a color'}
            </span>
          </span>
        </button>
      </div>

      {current === 'custom' && (
        <div className="mt-3 flex items-center gap-3">
          <input
            type="color"
            aria-label="Custom color picker"
            value={
              /^#[0-9a-fA-F]{6}$/.test(customDisplay) ? customDisplay : '#888888'
            }
            onChange={(e) => onCustomChange(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-0"
          />
          <input
            type="text"
            aria-label="Custom color hex"
            placeholder="#6f42c1"
            value={customColorValue}
            onChange={(e) => onCustomChange(e.target.value)}
            className="h-10 flex-1 rounded border border-border bg-background px-3 font-mono text-sm"
          />
        </div>
      )}

      {field.admin?.description && (
        <p className="text-sm text-muted-foreground">{field.admin.description}</p>
      )}
    </div>
  )
}
