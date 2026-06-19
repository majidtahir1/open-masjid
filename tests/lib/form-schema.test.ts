// tests/lib/form-schema.test.ts
import { describe, it, expect } from 'vitest'
import {
  FormSchema,
  validateSchema,
  validateSubmission,
  FIELD_TYPES,
} from '@/lib/form-schema'

describe('FIELD_TYPES', () => {
  it('exposes the field types in a stable order', () => {
    expect(FIELD_TYPES.map((t) => t.id)).toEqual([
      'short-text','email','phone','long-text','number','date',
      'dropdown','radio','multiselect','checkbox-group','consent','page-break',
      'section','repeatable-group',
    ])
  })
})

describe('repeatable-group schema', () => {
  const groupSchema = {
    steps: [{ id: 's1', fields: [
      { type: 'short-text', id: 'g1', name: 'guardian_name', label: 'Guardian', required: true },
      { type: 'repeatable-group', id: 'p', name: 'participants', label: 'Children', itemLabel: 'Child', min: 1, max: 10, fields: [
        { type: 'short-text', id: 'f1', name: 'student_first_name', label: 'First', required: true },
        { type: 'short-text', id: 'f2', name: 'student_last_name', label: 'Last', required: true },
      ] },
    ] }],
  }

  it('accepts a valid group schema', () => {
    expect(validateSchema(groupSchema).success).toBe(true)
  })

  it('rejects duplicate names across group + top level', () => {
    const bad = JSON.parse(JSON.stringify(groupSchema))
    bad.steps[0].fields[1].fields[0].name = 'guardian_name'
    expect(validateSchema(bad).success).toBe(false)
  })

  it('validates submission into a nested participants array', () => {
    const r = validateSubmission(groupSchema as any, {
      guardian_name: 'Rahman',
      participants: [
        { student_first_name: 'Aisha', student_last_name: 'Abbasi' },
        { student_first_name: 'Yusuf', student_last_name: 'Abbasi' },
      ],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.guardian_name).toBe('Rahman')
      expect((r.data.participants as any[]).length).toBe(2)
      expect((r.data.participants as any[])[0].student_first_name).toBe('Aisha')
    }
  })

  it('fails when a required field inside an item is empty', () => {
    const r = validateSubmission(groupSchema as any, {
      guardian_name: 'Rahman',
      participants: [{ student_first_name: '', student_last_name: 'Abbasi' }],
    })
    expect(r.ok).toBe(false)
  })

  it('fails when fewer than min items', () => {
    const r = validateSubmission(groupSchema as any, { guardian_name: 'R', participants: [] })
    expect(r.ok).toBe(false)
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
