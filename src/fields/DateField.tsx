'use client'

/**
 * Custom Payload date field — MVP: native `<input type="date">` with shadcn
 * styling. Doesn't yet support Payload's `pickerAppearance: 'dayAndTime'` —
 * for fields that need time-of-day (startDate/endDate), leave the default
 * Payload DateTime field in place.
 */

import { useField } from '@payloadcms/ui'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FieldProp = {
  name?: string
  label?: string | Record<string, string> | false
  required?: boolean
  admin?: {
    description?: string
    placeholder?: string
    date?: { pickerAppearance?: string }
  }
}

function labelText(label: FieldProp['label'], fallback: string): string {
  if (!label) return fallback
  if (typeof label === 'string') return label
  return label.en ?? Object.values(label)[0] ?? fallback
}

function toInputValue(v: string | Date | null | undefined): string {
  if (!v) return ''
  const d = typeof v === 'string' ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return ''
  // yyyy-mm-dd
  return d.toISOString().slice(0, 10)
}

export default function DateField({
  field,
  path: pathFromProps,
}: {
  field: FieldProp
  path: string
}) {
  const { value, setValue, showError, errorMessage, path } = useField<
    string | Date
  >({
    potentiallyStalePath: pathFromProps,
  })
  const resolvedPath = path || pathFromProps
  const label = labelText(field.label, field.name ?? resolvedPath)
  return (
    <div className="space-y-2 mb-4">
      <Label htmlFor={resolvedPath} className="text-base font-medium">
        {label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={resolvedPath}
        type="date"
        value={toInputValue(value as string | Date | null | undefined)}
        onChange={(e) => {
          const v = e.target.value
          // Store as ISO string so Payload's date validation is happy.
          setValue(v ? new Date(v).toISOString() : null)
        }}
        className={showError ? 'border-destructive' : ''}
      />
      {field.admin?.description && (
        <p className="text-sm text-muted-foreground">{field.admin.description}</p>
      )}
      {showError && errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}
    </div>
  )
}
