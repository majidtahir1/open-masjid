import type { Field, FormSchema, LeafField } from './form-schema'

/** Required student-name fields a Sunday-school registration form must have. */
export const REGISTRATION_FIELD_DEFS = [
  { name: 'student_first_name', label: 'Student first name' },
  { name: 'student_last_name', label: 'Student last name' },
] as const

/** Role marking the typed Guardians repeatable-group + its child fields. The
 *  role is the contract a structured consumer reads (the kiosk matches on
 *  guardian_phone); the field LABEL stays free for admins to relabel. */
export const GUARDIANS_GROUP_ROLE = 'guardians' as const
export const GUARDIAN_ROLES = {
  name: 'guardian_name',
  phone: 'guardian_phone',
  email: 'guardian_email',
  relationship: 'guardian_relationship',
} as const

/** The single repeatable-group that is NOT the guardians group (the participants
 *  section). Backward-compatible: a form without a guardians group resolves to
 *  its only repeatable-group, exactly as before. */
export function participantGroupName(schema: FormSchema): string | null {
  const groups = schema.steps
    .flatMap((s) => s.fields)
    .filter((f) => f.type === 'repeatable-group' && f.role !== GUARDIANS_GROUP_ROLE)
  return groups.length === 1 ? (groups[0] as { name: string }).name : null
}

/** Name of the guardians-role repeatable-group, or null. */
export function guardiansGroupName(schema: FormSchema): string | null {
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'repeatable-group' && f.role === GUARDIANS_GROUP_ROLE) return f.name
    }
  }
  return null
}

/** Child fields of the guardians group (empty when there is no such group). */
function guardiansGroupFields(schema: FormSchema): LeafField[] {
  const name = guardiansGroupName(schema)
  if (!name) return []
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'repeatable-group' && f.name === name) return f.fields
    }
  }
  return []
}

/** Ensure a typed Guardians repeatable-group exists (role-tagged, relabel-safe).
 *  Idempotent: returns the SAME reference when a guardians group already exists.
 *  Appends to the last step so it renders after the participants section. */
export function ensureGuardiansGroup(schema: FormSchema, makeId: () => string): FormSchema {
  if (guardiansGroupName(schema)) return schema
  const group: Field = {
    type: 'repeatable-group',
    id: makeId(),
    name: 'guardians',
    label: 'Guardians',
    itemLabel: 'Guardian',
    role: GUARDIANS_GROUP_ROLE,
    min: 1,
    fields: [
      { type: 'short-text', id: makeId(), name: 'guardian_name', label: 'Name', required: true, role: GUARDIAN_ROLES.name },
      { type: 'phone', id: makeId(), name: 'guardian_phone', label: 'Phone', required: false, role: GUARDIAN_ROLES.phone },
      { type: 'email', id: makeId(), name: 'guardian_email', label: 'Email', required: false, role: GUARDIAN_ROLES.email },
      { type: 'short-text', id: makeId(), name: 'guardian_relationship', label: 'Relationship', required: false, role: GUARDIAN_ROLES.relationship },
    ],
  }
  const steps = schema.steps.length > 0
    ? schema.steps.map((s, i) => (i === schema.steps.length - 1 ? { ...s, fields: [...s.fields, group] } : s))
    : [{ id: makeId(), fields: [group] }]
  return { ...schema, steps }
}

/** When a guardians group is present, the FIRST (primary) guardian must have a
 *  phone — that's what the check-in kiosk matches on. Other guardians optional.
 *  Returns field-keyed errors (empty when valid or no group). */
export function validateGuardians(schema: FormSchema, data: Record<string, unknown>): Record<string, string> {
  const groupName = guardiansGroupName(schema)
  if (!groupName) return {}
  const phoneField = guardiansGroupFields(schema).find((c) => 'role' in c && c.role === GUARDIAN_ROLES.phone)
  if (!phoneField) return {}
  const fieldName = (phoneField as { name: string }).name
  const items = Array.isArray(data[groupName]) ? (data[groupName] as Record<string, unknown>[]) : []
  const v = items[0]?.[fieldName]
  const present = v != null && String(v).trim().length > 0
  return present ? {} : { [`${groupName}.0.${fieldName}`]: 'Required' }
}

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

/** A children-model registration form must contain exactly one participant
 *  (non-guardians) repeatable-group. */
export function hasParticipantGroup(schema: FormSchema): boolean {
  return participantGroupName(schema) !== null
}

/** Loose schema shape — callers pass Payload form docs whose `schema` is untyped. */
type SchemaLike = {
  steps?: Array<{
    fields?: Array<{ name?: string; type?: string; fields?: Array<{ name?: string; type?: string }> }>
  }>
} | null | undefined

/**
 * Name of the per-participant `class-select` field, resolved by TYPE (not a
 * hardcoded name), searching both top-level fields and repeatable-group
 * children. Returns null when the form has no class selector. Pricing and
 * enrollment must read each participant's chosen class via this name so an
 * admin renaming the field never silently breaks per-class tuition.
 */
export function classSelectFieldName(schema: SchemaLike): string | null {
  for (const step of schema?.steps ?? []) {
    for (const f of step.fields ?? []) {
      if (f?.type === 'class-select' && f.name) return f.name
      if (f?.type === 'repeatable-group') {
        for (const child of f.fields ?? []) {
          if (child?.type === 'class-select' && child.name) return child.name
        }
      }
    }
  }
  return null
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
      // The guardians group is a separate role-tagged block — not the participant
      // section — so exclude it from the "single participant group" detection.
      if (f.type === 'repeatable-group' && f.role !== GUARDIANS_GROUP_ROLE) {
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
