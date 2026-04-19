'use client'

import { useField } from '@payloadcms/ui'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FieldProp = {
  name?: string
  label?: string | Record<string, string> | false
  required?: boolean
  admin?: { description?: string; placeholder?: string }
}

function labelText(label: FieldProp['label'], fallback: string): string {
  if (!label) return fallback
  if (typeof label === 'string') return label
  return label.en ?? Object.values(label)[0] ?? fallback
}

export default function EmailField({
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
        type="email"
        autoComplete="email"
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
