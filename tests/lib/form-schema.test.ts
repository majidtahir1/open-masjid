// tests/lib/form-schema.test.ts
import { describe, it, expect } from 'vitest'
import {
  FormSchema,
  validateSchema,
  validateSubmission,
  FIELD_TYPES,
} from '@/lib/form-schema'

describe('FIELD_TYPES', () => {
  it('exposes the 12 v1 field types in a stable order', () => {
    expect(FIELD_TYPES.map((t) => t.id)).toEqual([
      'short-text','email','phone','long-text','number','date',
      'dropdown','radio','multiselect','checkbox-group','consent','page-break',
    ])
  })
})

describe('validateSchema', () => {
  it('accepts a minimal valid schema', () => {
    const ok = validateSchema({
      steps: [{ id: 's1', fields: [
        { type: 'email', id: 'f1', name: 'email', label: 'Email', required: true },
      ]}],
    })
    expect(ok.success).toBe(true)
  })
  it('rejects duplicate field names across steps', () => {
    const r = validateSchema({
      steps: [
        { id: 's1', fields: [{ type: 'email', id: 'f1', name: 'email', label: 'Email', required: true }] },
        { id: 's2', fields: [{ type: 'short-text', id: 'f2', name: 'email', label: 'Other', required: false }] },
      ],
    })
    expect(r.success).toBe(false)
  })
  it('rejects an empty schema', () => {
    expect(validateSchema({ steps: [] }).success).toBe(false)
  })
})

describe('validateSubmission', () => {
  const schema: FormSchema = {
    steps: [{ id: 's1', fields: [
      { type: 'email', id: 'f1', name: 'email', label: 'Email', required: true },
      { type: 'short-text', id: 'f2', name: 'name', label: 'Name', required: true },
      { type: 'multiselect', id: 'f3', name: 'roles', label: 'Roles', required: false,
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    ]}],
  }
  it('passes when required fields are present and types are valid', () => {
    const r = validateSubmission(schema, { email: 'x@y.com', name: 'Aisha', roles: ['a'] })
    expect(r.ok).toBe(true)
  })
  it('rejects missing required fields with field-keyed errors', () => {
    const r = validateSubmission(schema, { email: 'x@y.com' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.name).toBeDefined()
  })
  it('rejects invalid email', () => {
    const r = validateSubmission(schema, { email: 'not-an-email', name: 'A' })
    expect(r.ok).toBe(false)
  })
  it('rejects multiselect values not in option list', () => {
    const r = validateSubmission(schema, { email: 'x@y.com', name: 'A', roles: ['c'] })
    expect(r.ok).toBe(false)
  })
})
