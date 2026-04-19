'use client'

import { useField } from '@payloadcms/ui'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FieldProp = {
  name?: string
  label?: string | Record<string, string> | false
  required?: boolean
  admin?: { description?: string; placeholder?: string; step?: number }
  min?: number
  max?: number
}

function labelText(label: FieldProp['label'], fallback: string): string {
  if (!label) return fallback
  if (typeof label === 'string') return label
  return label.en ?? Object.values(label)[0] ?? fallback
}

export default function NumberField({ field, path }: { field: FieldProp; path: string }) {
  const { value, setValue, showError, errorMessage } = useField<number | null>({ path })
  const label = labelText(field.label, field.name ?? path)
  return (
    <div className="space-y-2 mb-4">
      <Label htmlFor={path} className="text-base font-medium">
        {label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={path}
        type="number"
        value={value ?? ''}
        min={field.min}
        max={field.max}
        placeholder={field.admin?.placeholder}
        onChange={(e) => {
          const v = e.target.value
          setValue(v === '' ? null : Number(v))
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
