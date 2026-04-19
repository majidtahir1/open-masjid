'use client'

/**
 * Custom Payload text field using shadcn Input + Label. Mirrors Payload 3's
 * built-in text field contract: receives `field` (the field config) and
 * `path` (string, provided by Payload's form renderer). Integrates with
 * form state via the `useField` hook from `@payloadcms/ui`.
 *
 * Note: we pass `pathFromProps` via `potentiallyStalePath` (not `path`) to
 * match how Payload's own built-in fields invoke `useField`. Passing `path`
 * directly can cause React 19 to throw "Context can only be read while React
 * is rendering" because the field-state selector callback inside useField
 * re-registers every render when the path reference is unstable.
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
  }
}

function labelText(label: FieldProp['label'], fallback: string): string {
  if (!label) return fallback
  if (typeof label === 'string') return label
  // Payload supports locale-keyed label objects. Prefer `en`, fall back to the
  // first value, then to the fallback (field name).
  return label.en ?? Object.values(label)[0] ?? fallback
}

export default function TextField({
  field,
  path: pathFromProps,
}: {
  field: FieldProp
  path: string
}) {
  const { value, setValue, showError, errorMessage, path } = useField<string>({
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
        type="text"
        value={(value as string) ?? ''}
        placeholder={field.admin?.placeholder}
        onChange={(e) => setValue(e.target.value)}
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
