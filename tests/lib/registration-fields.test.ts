import { describe, it, expect } from 'vitest'
import { ensureStudentFields, hasRequiredRegistrationFields, REGISTRATION_FIELD_DEFS } from '@/lib/registration-fields'
import type { FormSchema } from '@/lib/form-schema'

const empty: FormSchema = { steps: [{ id: 's1', fields: [] }] }
const counter = () => { let n = 0; return () => `gen-${++n}` }

describe('hasRequiredRegistrationFields', () => {
  it('false when missing', () => {
    expect(hasRequiredRegistrationFields(empty)).toBe(false)
  })
  it('true when both present', () => {
    const s = ensureStudentFields(empty, counter())
    expect(hasRequiredRegistrationFields(s)).toBe(true)
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

describe('REGISTRATION_FIELD_DEFS', () => {
  it('declares the two student name fields', () => {
    expect(REGISTRATION_FIELD_DEFS.map((d) => d.name)).toEqual(['student_first_name', 'student_last_name'])
  })
})
