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
  { id: 'class-select', label: 'Class', hasOptions: false },
  { id: 'page-break', label: 'Page break', hasOptions: false },
  { id: 'section', label: 'Section', hasOptions: false },
  { id: 'repeatable-group', label: 'Repeatable group', hasOptions: false },
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

// Leaf (input) field members — these may appear at the top level and inside a
// repeatable-group's `fields`. They never contain nested structural types.
const LeafFieldMembers = [
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
  // Per-participant class selector. Options are resolved at render time from the
  // bound program's classes — never stored statically in the schema.
  z.object({
    type: z.literal('class-select'),
    id: z.string().min(1),
    name: z.string().regex(FieldNameRegex),
    label: z.string().optional(),
    required: z.boolean().default(false),
    helpText: z.string().optional(),
  }),
] as const

const LeafFieldSchema = z.discriminatedUnion('type', LeafFieldMembers)
export type LeafField = z.infer<typeof LeafFieldSchema>

const FieldSchema = z.discriminatedUnion('type', [
  ...LeafFieldMembers,
  z.object({ type: z.literal('page-break'), id: z.string().min(1), name: z.string().regex(FieldNameRegex) }),
  z.object({ type: z.literal('section'), id: z.string().min(1), name: z.string().regex(FieldNameRegex), label: z.string().optional() }),
  z.object({
    type: z.literal('repeatable-group'),
    id: z.string().min(1),
    name: z.string().regex(FieldNameRegex),
    label: z.string().optional(),
    itemLabel: z.string().optional(),
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(1).optional(),
    // child fields are leaf inputs only — no nested groups/sections/page-breaks
    fields: z.array(LeafFieldSchema).min(1),
  }),
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
  // Cross-field rule: field names must be unique across all steps. A
  // repeatable-group's name and its child names share one namespace.
  const names = new Set<string>()
  for (const step of r.data.steps) {
    for (const f of step.fields) {
      if (f.type === 'page-break' || f.type === 'section') continue
      if (names.has(f.name)) return { success: false, error: `Duplicate field name: ${f.name}` }
      names.add(f.name)
      if (f.type === 'repeatable-group') {
        // Zod guarantees child fields are leaf (input) types only; here we just
        // enforce that the group name + child names share one namespace.
        for (const child of f.fields) {
          if (names.has(child.name)) return { success: false, error: `Duplicate field name: ${child.name}` }
          names.add(child.name)
        }
      }
    }
  }
  return { success: true, schema: r.data }
}

export interface SubmissionOk { ok: true; data: Record<string, unknown> }
export interface SubmissionErr { ok: false; errors: Record<string, string> }

const EmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validate a flat set of leaf fields against a raw value map, writing cleaned
 * values into `out` and field-keyed messages into `errors`. Shared by the
 * top-level submission pass and per-item repeatable-group validation.
 */
function validateItem(
  fields: readonly LeafField[],
  raw: Record<string, unknown>,
  out: Record<string, unknown>,
  errors: Record<string, string>,
  keyPrefix = '',
): void {
  for (const f of fields) {
    const errKey = keyPrefix + f.name
    const v = raw[f.name]
    const present = v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    if (f.required && !present) { errors[errKey] = 'Required'; continue }
    if (!present) continue

    switch (f.type) {
      case 'short-text': case 'long-text': case 'phone':
        if (typeof v !== 'string') errors[errKey] = 'Must be text'
        else out[f.name] = v.trim()
        break
      case 'email':
        if (typeof v !== 'string' || !EmailRegex.test(v)) errors[errKey] = 'Invalid email'
        else out[f.name] = v.trim().toLowerCase()
        break
      case 'number': {
        const n = typeof v === 'number' ? v : Number(v)
        if (Number.isNaN(n)) { errors[errKey] = 'Must be a number'; break }
        if (f.min !== undefined && n < f.min) errors[errKey] = `Min ${f.min}`
        else if (f.max !== undefined && n > f.max) errors[errKey] = `Max ${f.max}`
        else out[f.name] = n
        break
      }
      case 'date':
        if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) errors[errKey] = 'Invalid date'
        else out[f.name] = v
        break
      case 'dropdown': case 'radio':
        if (!f.options.find((o) => o.value === v)) errors[errKey] = 'Invalid option'
        else out[f.name] = v
        break
      case 'multiselect': case 'checkbox-group': {
        if (!Array.isArray(v)) { errors[errKey] = 'Must be a list'; break }
        const valid = f.options.map((o) => o.value)
        const bad = (v as unknown[]).find((x) => !valid.includes(x as string))
        if (bad !== undefined) errors[errKey] = 'Invalid option'
        else out[f.name] = v
        break
      }
      case 'consent':
        if (v !== true) errors[errKey] = 'Required'
        else out[f.name] = true
        break
      case 'class-select':
        // Value is a class id (string). Options are program-derived, so we
        // accept any non-empty string here; placement-time validation owns
        // checking the id against the program's live classes.
        if (typeof v !== 'string') errors[errKey] = 'Invalid class'
        else out[f.name] = v
        break
    }
  }
}

/**
 * Validate a single list of fields (one step, or the whole form) against a raw
 * value map. Returns cleaned values and field-keyed error messages. Shared by
 * the server submission pass (`validateSubmission`) and the client's per-step
 * "Continue" gate so both enforce the same rules (format, min/max, options) —
 * not just emptiness.
 */
export function validateFields(
  fields: readonly Field[],
  raw: Record<string, unknown>,
): { out: Record<string, unknown>; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const out: Record<string, unknown> = {}

  for (const f of fields) {
    if (f.type === 'page-break' || f.type === 'section') continue

    if (f.type === 'repeatable-group') {
      const rawItems = raw[f.name]
      const items = Array.isArray(rawItems) ? rawItems : []
      const min = f.min ?? 0
      if (items.length < min) { errors[f.name] = `Add at least ${min}`; continue }
      if (f.max !== undefined && items.length > f.max) { errors[f.name] = `Add at most ${f.max}`; continue }
      const cleaned: Record<string, unknown>[] = []
      items.forEach((item, i) => {
        const itemOut: Record<string, unknown> = {}
        validateItem(
          f.fields,
          (item ?? {}) as Record<string, unknown>,
          itemOut,
          errors,
          `${f.name}.${i}.`,
        )
        cleaned.push(itemOut)
      })
      out[f.name] = cleaned
      continue
    }

    validateItem([f], raw, out, errors)
  }

  return { out, errors }
}

export function validateSubmission(
  schema: FormSchema,
  raw: Record<string, unknown>,
): SubmissionOk | SubmissionErr {
  const errors: Record<string, string> = {}
  const out: Record<string, unknown> = {}

  for (const step of schema.steps) {
    const r = validateFields(step.fields, raw)
    Object.assign(out, r.out)
    Object.assign(errors, r.errors)
  }

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, data: out }
}
