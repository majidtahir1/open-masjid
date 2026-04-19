'use client'

/**
 * Custom Payload select field using shadcn Select. Supports `hasMany: false`
 * only — for hasMany selects, leave the default Payload field in place (adding
 * multi-select would mean rebuilding chip/tag UI, which isn't worth it yet).
 *
 * Important: Radix `<Select>` does NOT accept an empty string for `value` —
 * passing `""` triggers a console error. We render the trigger in "unset"
 * mode (no `value` prop) when the field has no value, and only go controlled
 * once the user picks something. Radix's `<SelectItem value="">` is also
 * forbidden, so we filter any empty option out.
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
  return options
    .map((o) => (typeof o === 'string' ? { label: o, value: o } : o))
    .filter((o) => o.value !== '')
}

export default function SelectField({
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
  const options = normalizeOptions(field.options)
  const placeholder = field.admin?.placeholder ?? 'Select...'
  const hasValue = typeof value === 'string' && value.length > 0

  return (
    <div className="space-y-2 mb-4">
      <Label htmlFor={resolvedPath} className="text-base font-medium">
        {label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select
        // Pass `undefined` (not "") when the field has no value so Radix stays
        // in uncontrolled-ish mode and renders the placeholder.
        value={hasValue ? (value as string) : undefined}
        onValueChange={(v) => setValue(v)}
      >
        <SelectTrigger
          id={resolvedPath}
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
