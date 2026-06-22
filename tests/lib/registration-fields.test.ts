import { describe, it, expect } from 'vitest'
import { ensureParticipantGroupFields, ensureStudentFields, hasParticipantGroup, hasRequiredRegistrationFields, REGISTRATION_FIELD_DEFS } from '@/lib/registration-fields'
import type { FormSchema } from '@/lib/form-schema'

const empty: FormSchema = { steps: [{ id: 's1', fields: [] }] }
const counter = () => { let n = 0; return () => `gen-${++n}` }

/** A children form: one participant repeatable-group with the given child fields. */
function groupSchema(childNames: string[]): FormSchema {
  return {
    steps: [{ id: 's1', fields: [
      { type: 'repeatable-group', id: 'p', name: 'participants', label: 'Children', min: 1, fields:
        childNames.map((n, i) => ({ type: 'short-text', id: `c${i}`, name: n, label: n, required: true })),
      },
    ] }],
  } as unknown as FormSchema
}

describe('hasRequiredRegistrationFields', () => {
  it('false when missing', () => {
    expect(hasRequiredRegistrationFields(empty)).toBe(false)
  })
  it('true when both present', () => {
    const s = ensureStudentFields(empty, counter())
    expect(hasRequiredRegistrationFields(s)).toBe(true)
  })
  it('true when the required fields live INSIDE a repeatable-group', () => {
    const s = groupSchema(['student_first_name', 'student_last_name', 'dob'])
    expect(hasRequiredRegistrationFields(s)).toBe(true)
  })
  it('false when only one of the required fields is inside the group', () => {
    const s = groupSchema(['student_first_name', 'dob'])
    expect(hasRequiredRegistrationFields(s)).toBe(false)
  })
})

describe('ensureStudentFields', () => {
  it('prepends both required fields to the first step', () => {
    const s = ensureStudentFields(empty, counter())
    const names = s.steps[0].fields.map((f) => (f as any).name)
    expect(names).toEqual(['student_first_name', 'student_last_name'])
    expect(s.steps[0].fields.every((f) => (f as any).type === 'short-text' && (f as any).required === true)).toBe(true)
  })
  it('is idempotent — no duplicates when already present', () => {
    const once = ensureStudentFields(empty, counter())
    const twice = ensureStudentFields(once, counter())
    expect(twice).toBe(once)
    expect(twice.steps[0].fields.length).toBe(2)
  })
  it('adds only the missing one, preserving existing fields and order', () => {
    const partial: FormSchema = {
      steps: [{ id: 's1', fields: [
        { type: 'short-text', id: 'a', name: 'student_first_name', label: 'First', required: true },
        { type: 'email', id: 'b', name: 'email', label: 'Email', required: false },
      ] }],
    }
    const out = ensureStudentFields(partial, counter())
    const names = out.steps[0].fields.map((f) => (f as any).name)
    expect(names).toEqual(['student_last_name', 'student_first_name', 'email'])
  })
  it('assigns ids from the generator', () => {
    const out = ensureStudentFields(empty, counter())
    expect((out.steps[0].fields[0] as any).id).toBe('gen-1')
  })
})

describe('ensureParticipantGroupFields', () => {
  it('prepends both required fields to a group that is missing them', () => {
    const s = groupSchema(['dob'])
    const out = ensureParticipantGroupFields(s, counter())
    const group = out.steps[0].fields[0] as any
    const names = group.fields.map((f: any) => f.name)
    expect(names).toEqual(['student_first_name', 'student_last_name', 'dob'])
    expect(group.fields.slice(0, 2).every((f: any) => f.type === 'short-text' && f.required === true)).toBe(true)
  })
  it('adds only the missing one, preserving order', () => {
    const s = groupSchema(['student_first_name', 'dob'])
    const out = ensureParticipantGroupFields(s, counter())
    const names = (out.steps[0].fields[0] as any).fields.map((f: any) => f.name)
    expect(names).toEqual(['student_last_name', 'student_first_name', 'dob'])
  })
  it('is idempotent — same ref when both already present', () => {
    const s = groupSchema(['student_first_name', 'student_last_name'])
    expect(ensureParticipantGroupFields(s, counter())).toBe(s)
  })
  it('is a no-op (same ref) when there is no group', () => {
    expect(ensureParticipantGroupFields(empty, counter())).toBe(empty)
  })
})

describe('hasParticipantGroup', () => {
  const group = {
    type: 'repeatable-group', id: 'p', name: 'participants', label: 'Children', fields: [
      { type: 'short-text', id: 'f1', name: 'student_first_name', label: 'First', required: true },
    ],
  }
  it('true with exactly one repeatable-group', () => {
    const s = { steps: [{ id: 's1', fields: [group] }] } as unknown as FormSchema
    expect(hasParticipantGroup(s)).toBe(true)
  })
  it('false with zero repeatable-groups', () => {
    expect(hasParticipantGroup(empty)).toBe(false)
  })
  it('false with two repeatable-groups', () => {
    const s = {
      steps: [{ id: 's1', fields: [group, { ...group, id: 'p2', name: 'others' }] }],
    } as unknown as FormSchema
    expect(hasParticipantGroup(s)).toBe(false)
  })
})

describe('REGISTRATION_FIELD_DEFS', () => {
  it('declares the two student name fields', () => {
    expect(REGISTRATION_FIELD_DEFS.map((d) => d.name)).toEqual(['student_first_name', 'student_last_name'])
  })
})
