'use client'

/**
 * Custom admin field for `backgroundTheme` on CarouselSlides. Backed by a plain
 * `text` column in the DB (no Postgres enum), so adding a theme in
 * `islamicThemes.ts` does not require a schema migration. Options are sourced
 * from the themes file at render time.
 */

import { useField } from '@payloadcms/ui'
import { ISLAMIC_THEMES } from '@/app/(kiosk)/_lib/themes/islamicThemes'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

export default function BackgroundThemeField({ field }: { field: FieldProp }) {
  const name = field?.name ?? 'backgroundTheme'
  const label = labelText(field?.label, 'Background Theme')
  const description = field?.admin?.description
  const { value, setValue } = useField<string>({ path: name })

  const options = Object.values(ISLAMIC_THEMES).map((t) => ({
    value: t.id,
    label: t.name,
  }))

  return (
    <div className="field-type">
      <Label htmlFor={name}>{label}</Label>
      <Select value={value || undefined} onValueChange={(v) => setValue(v)}>
        <SelectTrigger id={name}>
          <SelectValue placeholder="Pick a theme" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && <p className="field-description">{description}</p>}
    </div>
  )
}
