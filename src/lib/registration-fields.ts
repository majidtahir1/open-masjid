import type { Field, FormSchema, LeafField } from './form-schema'

/** Required student-name fields a Sunday-school registration form must have. */
export const REGISTRATION_FIELD_DEFS = [
  { name: 'student_first_name', label: 'Student first name' },
  { name: 'student_last_name', label: 'Student last name' },
] as const

function fieldNames(schema: FormSchema): Set<string> {
  const names = new Set<string>()
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type !== 'page-break' && 'name' in f) names.add(f.name)
      // A repeatable-group's child names share the one form-wide namespace, so
      // required-field detection must descend into the group's fields too.
      if (f.type === 'repeatable-group') {
        for (const child of f.fields) names.add(child.name)
      }
    }
  }
  return names
}

/** True iff both required student-name fields exist anywhere in the schema. */
export function hasRequiredRegistrationFields(schema: FormSchema): boolean {
  const names = fieldNames(schema)
  return REGISTRATION_FIELD_DEFS.every((d) => names.has(d.name))
}

/** A children-model registration form must contain exactly one repeatable-group (the participant section). */
export function hasParticipantGroup(schema: FormSchema): boolean {
  const groups = schema.steps.flatMap((s) => s.fields).filter((f) => f.type === 'repeatable-group')
  return groups.length === 1
}

/**
 * Return the schema with both required student-name fields present, prepended
 * to the first step. Idempotent: returns the SAME reference when nothing is
 * missing. `makeId` supplies stable field ids (injected so tests are deterministic).
 */
export function ensureStudentFields(schema: FormSchema, makeId: () => string): FormSchema {
  const names = fieldNames(schema)
  const missing = REGISTRATION_FIELD_DEFS.filter((d) => !names.has(d.name))
  if (missing.length === 0) return schema

  const newFields: Field[] = missing.map(
    (d) => ({ type: 'short-text', id: makeId(), name: d.name, label: d.label, required: true }) as Field,
  )
  const steps = schema.steps.length > 0
    ? schema.steps.map((s, i) => (i === 0 ? { ...s, fields: [...newFields, ...s.fields] } : s))
    : [{ id: makeId(), fields: newFields }]
  return { ...schema, steps }
}

/**
 * For a children-model registration form: ensure both required student-name
 * fields live INSIDE the single participant repeatable-group. If the schema has
 * exactly one repeatable-group and it is missing either field, return a new
 * schema with the missing required `short-text` child fields PREPENDED to that
 * group's `fields[]`. Idempotent: returns the SAME reference when nothing is
 * missing, or when there is no (single) group to seed.
 */
export function ensureParticipantGroupFields(schema: FormSchema, makeId: () => string): FormSchema {
  // Locate the single participant group (step index + field index).
  let groupStepIndex = -1
  let groupFieldIndex = -1
  let groupCount = 0
  schema.steps.forEach((step, si) => {
    step.fields.forEach((f, fi) => {
      if (f.type === 'repeatable-group') {
        groupCount += 1
        groupStepIndex = si
        groupFieldIndex = fi
      }
    })
  })
  // No group, or more than one — the publish-time invariant owns those cases.
  if (groupCount !== 1) return schema

  const group = schema.steps[groupStepIndex].fields[groupFieldIndex]
  if (group.type !== 'repeatable-group') return schema

  const childNames = new Set(group.fields.map((c) => c.name))
  const missing = REGISTRATION_FIELD_DEFS.filter((d) => !childNames.has(d.name))
  if (missing.length === 0) return schema

  const newChildren: LeafField[] = missing.map(
    (d) => ({ type: 'short-text', id: makeId(), name: d.name, label: d.label, required: true }) as LeafField,
  )
  const newGroup = { ...group, fields: [...newChildren, ...group.fields] }
  const steps = schema.steps.map((s, si) =>
    si === groupStepIndex
      ? { ...s, fields: s.fields.map((f, fi) => (fi === groupFieldIndex ? newGroup : f)) }
      : s,
  )
  return { ...schema, steps }
}
