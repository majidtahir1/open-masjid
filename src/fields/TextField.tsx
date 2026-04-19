'use client'

/**
 * Custom Payload text field using shadcn Input + Label. Mirrors Payload 3's
 * built-in text field contract: receives `field` (the field config) and
 * `path` (string, provided by Payload's form renderer). Integrates with
 * form state via the `useField` hook from `@payloadcms/ui`.
 */

import { useField } from '@payloadcms/ui'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FieldProp = {
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

export default function TextField({ field, path }: { field: FieldProp & { name?: string }; path: string }) {
  const { value, setValue, showError, errorMessage } = useField<string>({ path })
  const label = labelText(field.label, field.name ?? path)
  return (
    <div className="space-y-2 mb-4">
      <Label htmlFor={path} className="text-base font-medium">
        {label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={path}
        type="text"
        value={value ?? ''}
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
