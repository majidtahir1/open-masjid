import { describe, expect, it } from 'vitest'
import type { FormSchema } from './form-schema'
import { applyRenames, detectFieldRenames } from './form-schema-migrate'

const makeSchema = (fields: Array<{ id: string; name: string }>): FormSchema => ({
  steps: [
    {
      id: 's1',
      fields: fields.map((f) => ({
        type: 'short-text' as const,
        id: f.id,
        name: f.name,
        label: f.name,
        required: false,
      })),
    },
  ],
})

describe('detectFieldRenames', () => {
  it('detects a renamed field by stable id', () => {
    const prev = makeSchema([{ id: 'f1', name: 'name' }, { id: 'f2', name: 'email' }])
    const next = makeSchema([{ id: 'f1', name: 'full_name' }, { id: 'f2', name: 'email' }])
    expect(detectFieldRenames(prev, next)).toEqual([{ from: 'name', to: 'full_name' }])
  })

  it('ignores added and removed fields', () => {
    const prev = makeSchema([{ id: 'f1', name: 'a' }, { id: 'f2', name: 'b' }])
    const next = makeSchema([{ id: 'f1', name: 'a' }, { id: 'f3', name: 'c' }])
    expect(detectFieldRenames(prev, next)).toEqual([])
  })

  it('detects swapped names', () => {
    const prev = makeSchema([{ id: 'f1', name: 'a' }, { id: 'f2', name: 'b' }])
    const next = makeSchema([{ id: 'f1', name: 'b' }, { id: 'f2', name: 'a' }])
    expect(detectFieldRenames(prev, next)).toEqual([
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
    ])
  })

  it('returns [] for invalid or missing schemas', () => {
    const valid = makeSchema([{ id: 'f1', name: 'a' }])
    expect(detectFieldRenames(null, valid)).toEqual([])
    expect(detectFieldRenames(valid, { steps: 'nope' })).toEqual([])
  })

  it('detects a renamed repeatable-group child, scoped to its group', () => {
    const withChild = (childName: string): FormSchema => ({
      steps: [
        {
          id: 's1',
          fields: [
            {
              type: 'repeatable-group', id: 'gr', name: 'children', label: 'Children',
              fields: [{ type: 'short-text', id: 'c1', name: childName, label: childName, required: false }],
            },
          ] as FormSchema['steps'][0]['fields'],
        },
      ],
    })
    expect(detectFieldRenames(withChild('first'), withChild('child_first'))).toEqual([
      { from: 'first', to: 'child_first', group: 'children' },
    ])
  })
})

describe('applyRenames', () => {
  it('moves a value to the new key', () => {
    const r = applyRenames({ name: 'Aisha', email: 'a@b.com' }, [{ from: 'name', to: 'full_name' }])
    expect(r.changed).toBe(true)
    expect(r.data).toEqual({ full_name: 'Aisha', email: 'a@b.com' })
  })

  it('is a no-op when the old key is absent', () => {
    const data = { full_name: 'Aisha' }
    const r = applyRenames(data, [{ from: 'name', to: 'full_name' }])
    expect(r.changed).toBe(false)
    expect(r.data).toBe(data)
  })

  it('handles swapped names in one pass', () => {
    const r = applyRenames({ a: 1, b: 2 }, [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
    ])
    expect(r.changed).toBe(true)
    expect(r.data).toEqual({ a: 2, b: 1 })
  })

  it('refuses to clobber an existing value that nothing moves away', () => {
    const data = { old: 'keep-me-too', current: 'existing' }
    const r = applyRenames(data, [{ from: 'old', to: 'current' }])
    expect(r.changed).toBe(false)
    expect(r.data).toEqual({ old: 'keep-me-too', current: 'existing' })
  })

  it('preserves falsy values when moving', () => {
    const r = applyRenames({ count: 0, agreed: false }, [
      { from: 'count', to: 'guests' },
      { from: 'agreed', to: 'consent' },
    ])
    expect(r.changed).toBe(true)
    expect(r.data).toEqual({ guests: 0, consent: false })
  })

  it('re-keys a child field inside every item of a repeatable-group', () => {
    const data = {
      guardian: 'Aisha',
      children: [
        { first: 'Yusuf', grade: 3 },
        { first: 'Maryam', grade: 5 },
      ],
    }
    const r = applyRenames(data, [{ from: 'first', to: 'child_first', group: 'children' }])
    expect(r.changed).toBe(true)
    expect(r.data).toEqual({
      guardian: 'Aisha',
      children: [
        { child_first: 'Yusuf', grade: 3 },
        { child_first: 'Maryam', grade: 5 },
      ],
    })
  })

  it('applies a top-level and a group-child rename together', () => {
    const data = { guardian: 'Aisha', kids: [{ first: 'Yusuf' }] }
    const r = applyRenames(data, [
      { from: 'guardian', to: 'parent_name' },
      { from: 'first', to: 'child_first', group: 'kids' },
    ])
    expect(r.changed).toBe(true)
    expect(r.data).toEqual({ parent_name: 'Aisha', kids: [{ child_first: 'Yusuf' }] })
  })

  it('is a no-op when a group-child rename targets an absent group', () => {
    const data = { guardian: 'Aisha' }
    const r = applyRenames(data, [{ from: 'first', to: 'child_first', group: 'children' }])
    expect(r.changed).toBe(false)
    expect(r.data).toBe(data)
  })
})
