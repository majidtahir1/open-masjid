// src/lib/form-schema.ts
import { z } from 'zod'

export const FIELD_TYPES = [
  { id: 'short-text', label: 'Short text', hasOptions: false },
  { id: 'email', label: 'Email', hasOptions: false },
  { id: 'phone', label: 'Phone', hasOptions: false },
  { id: 'long-text', label: 'Long text', hasOptions: false },
  { id: 'number', label: 'Number', hasOptions: false },
  { id: 'date', label: 'Date', hasOptions: false },
  { id: 'dropdown', label: 'Dropdown', hasOptions: true },
  { id: 'radio', label: 'Radio group', hasOptions: true },
  { id: 'multiselect', label: 'Multi-select', hasOptions: true },
  { id: 'checkbox-group', label: 'Checkbox group', hasOptions: true },
  { id: 'consent', label: 'Consent', hasOptions: false },
  { id: 'page-break', label: 'Page break', hasOptions: false },
] as const

export type FieldTypeId = (typeof FIELD_TYPES)[number]['id']

const FieldNameRegex = /^[a-z][a-z0-9_]*$/

const Option = z.object({ value: z.string().min(1), label: z.string().min(1) })

const FieldBase = {
  id: z.string().min(1),
  name: z.string().regex(FieldNameRegex),
  label: z.string().min(1),
  required: z.boolean().default(false),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
}

const FieldSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('short-text'), ...FieldBase }),
  z.object({ type: z.literal('email'), ...FieldBase }),
  z.object({ type: z.literal('phone'), ...FieldBase }),
  z.object({ type: z.literal('long-text'), ...FieldBase }),
  z.object({ type: z.literal('number'), ...FieldBase, min: z.number().optional(), max: z.number().optional() }),
  z.object({ type: z.literal('date'), ...FieldBase }),
  z.object({ type: z.literal('dropdown'), ...FieldBase, options: z.array(Option).min(1) }),
  z.object({ type: z.literal('radio'), ...FieldBase, options: z.array(Option).min(1) }),
  z.object({ type: z.literal('multiselect'), ...FieldBase, options: z.array(Option).min(1) }),
  z.object({ type: z.literal('checkbox-group'), ...FieldBase, options: z.array(Option).min(1) }),
  z.object({ type: z.literal('consent'), ...FieldBase, required: z.literal(true) }),
  z.object({ type: z.literal('page-break'), id: z.string().min(1), name: z.string().regex(FieldNameRegex) }),
])
export type Field = z.infer<typeof FieldSchema>

export const FormSchemaZ = z.object({
  steps: z.array(z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    fields: z.array(FieldSchema),
  })).min(1),
})
export type FormSchema = z.infer<typeof FormSchemaZ>

export interface ValidateSchemaOk { success: true; schema: FormSchema }
export interface ValidateSchemaErr { success: false; error: string }
export function validateSchema(input: unknown): ValidateSchemaOk | ValidateSchemaErr {
  const r = FormSchemaZ.safeParse(input)
  if (!r.success) return { success: false, error: r.error.message }
  // Cross-field rule: field names must be unique across all steps
  const names = new Set<string>()
  for (const step of r.data.steps) {
    for (const f of step.fields) {
      if (f.type === 'page-break') continue
      if (names.has(f.name)) return { success: false, error: `Duplicate field name: ${f.name}` }
      names.add(f.name)
    }
  }
  return { success: true, schema: r.data }
}

export interface SubmissionOk { ok: true; data: Record<string, unknown> }
export interface SubmissionErr { ok: false; errors: Record<string, string> }

const EmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateSubmission(
  schema: FormSchema,
  raw: Record<string, unknown>,
): SubmissionOk | SubmissionErr {
  const errors: Record<string, string> = {}
  const out: Record<string, unknown> = {}

  for (const step of schema.steps) for (const f of step.fields) {
    if (f.type === 'page-break') continue
    const v = raw[f.name]
    const present = v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    if (f.required && !present) { errors[f.name] = 'Required'; continue }
    if (!present) continue

    switch (f.type) {
      case 'short-text': case 'long-text': case 'phone':
        if (typeof v !== 'string') errors[f.name] = 'Must be text'
        else out[f.name] = v.trim()
        break
      case 'email':
        if (typeof v !== 'string' || !EmailRegex.test(v)) errors[f.name] = 'Invalid email'
        else out[f.name] = v.trim().toLowerCase()
        break
      case 'number': {
        const n = typeof v === 'number' ? v : Number(v)
        if (Number.isNaN(n)) { errors[f.name] = 'Must be a number'; break }
        if (f.min !== undefined && n < f.min) errors[f.name] = `Min ${f.min}`
        else if (f.max !== undefined && n > f.max) errors[f.name] = `Max ${f.max}`
        else out[f.name] = n
        break
      }
      case 'date':
        if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) errors[f.name] = 'Invalid date'
        else out[f.name] = v
        break
      case 'dropdown': case 'radio':
        if (!f.options.find((o) => o.value === v)) errors[f.name] = 'Invalid option'
        else out[f.name] = v
        break
      case 'multiselect': case 'checkbox-group': {
        if (!Array.isArray(v)) { errors[f.name] = 'Must be a list'; break }
        const valid = f.options.map((o) => o.value)
        const bad = (v as unknown[]).find((x) => !valid.includes(x as string))
        if (bad !== undefined) errors[f.name] = 'Invalid option'
        else out[f.name] = v
        break
      }
      case 'consent':
        if (v !== true) errors[f.name] = 'Required'
        else out[f.name] = true
        break
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, data: out }
}
