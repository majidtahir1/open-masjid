'use client'

/**
 * Custom Payload select field using shadcn Select. Supports `hasMany: false`
 * only — for hasMany selects, leave the default Payload field in place (adding
 * multi-select would mean rebuilding chip/tag UI, which isn't worth it yet).
 */

import { useField } from '@payloadcms/ui'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type OptionObject = { label: string; value: string }
type Option = string | OptionObject

type FieldProp = {
  name?: string
  label?: string | Record<string, string> | false
  required?: boolean
  options?: Option[]
  hasMany?: boolean
  admin?: { description?: string; placeholder?: string }
}

function labelText(label: FieldProp['label'], fallback: string): string {
  if (!label) return fallback
  if (typeof label === 'string') return label
  return label.en ?? Object.values(label)[0] ?? fallback
}

function normalizeOptions(options: Option[] = []): OptionObject[] {
  return options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o))
}

export default function SelectField({ field, path }: { field: FieldProp; path: string }) {
  const { value, setValue, showError, errorMessage } = useField<string>({ path })
  const label = labelText(field.label, field.name ?? path)
  const options = normalizeOptions(field.options)
  const placeholder = field.admin?.placeholder ?? 'Select...'

  return (
    <div className="space-y-2 mb-4">
      <Label htmlFor={path} className="text-sm font-medium">
        {label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select
        value={value ?? ''}
        onValueChange={(v) => setValue(v)}
      >
        <SelectTrigger
          id={path}
          className={showError ? 'border-destructive' : ''}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {field.admin?.description && (
        <p className="text-sm text-muted-foreground">{field.admin.description}</p>
      )}
      {showError && errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}
    </div>
  )
}
