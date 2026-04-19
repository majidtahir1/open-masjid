'use client'

import { useField } from '@payloadcms/ui'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

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

export default function CheckboxField({
  field,
  path: pathFromProps,
}: {
  field: FieldProp
  path: string
}) {
  const { value, setValue, showError, errorMessage, path } = useField<boolean>({
    potentiallyStalePath: pathFromProps,
  })
  const resolvedPath = path || pathFromProps
  const label = labelText(field.label, field.name ?? resolvedPath)
  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id={resolvedPath}
          checked={value === true}
          onCheckedChange={(checked) => setValue(checked === true)}
        />
        <Label htmlFor={resolvedPath} className="text-base font-medium cursor-pointer">
          {label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
      {field.admin?.description && (
        <p className="text-sm text-muted-foreground">{field.admin.description}</p>
      )}
      {showError && errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}
    </div>
  )
}
