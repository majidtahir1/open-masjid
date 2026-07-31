'use client'

/**
 * DollarCents — Payload v3 custom Field component for a money value stored in
 * CENTS. Renders an editable dollar input ($25) and writes cents (2500) to the
 * underlying number field. Works inside groups/arrays where a `virtual` field
 * with a condition renders read-only. Reused by Forms (price, suggested
 * amounts) and Terms/SchoolClasses (tuition).
 */
import { useField } from '@payloadcms/ui'

interface FieldProp {
  label?: string | Record<string, string> | false
  admin?: { description?: string }
}

function labelText(label: FieldProp['label'], fallback: string): string {
  if (!label) return fallback
  if (typeof label === 'string') return label
  return (label as Record<string, string>).en ?? Object.values(label)[0] ?? fallback
}

export default function DollarCents({
  field,
  path: pathFromProps,
}: {
  field: FieldProp
  path: string
}) {
  const { value, setValue, path } = useField<number | null>({ potentiallyStalePath: pathFromProps })
  const resolvedPath = path || pathFromProps
  const label = labelText(field.label, 'Amount')
  const dollars = typeof value === 'number' ? String(value / 100) : ''

  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <label
        htmlFor={resolvedPath}
        style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--theme-elevation-800, #111827)' }}
      >
        {label}
      </label>
      <div style={{ position: 'relative', maxWidth: 320 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--om-text-muted)', fontSize: 13, pointerEvents: 'none' }}>$</span>
        <input
          id={resolvedPath}
          type="number"
          inputMode="decimal"
          min={0}
          step={1}
          value={dollars}
          placeholder="0"
          onChange={(e) => {
            const v = e.target.value
            if (v === '') { setValue(null); return }
            const n = Number(v)
            if (Number.isFinite(n)) setValue(Math.round(n * 100))
          }}
          style={{ width: '100%', padding: '8px 10px 8px 22px', border: '1px solid var(--om-pop-border)', borderRadius: 6, fontSize: 13 }}
        />
      </div>
      {field.admin?.description && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--om-text-muted)' }}>{field.admin.description}</p>
      )}
    </div>
  )
}
