import { describe, it, expect } from 'vitest'
import { firstIncompleteStep, type HubSummary } from './school-setup'

const base: HubSummary = { term: { id: 1, name: 'T' } as HubSummary['term'], classCount: 0, teacherlessCount: 0, placedCount: 0, unplacedCount: 0 }

describe('firstIncompleteStep', () => {
  it('returns 1 when no term', () => {
    expect(firstIncompleteStep({ ...base, term: null })).toBe(1)
  })
  it('returns 2 when no classes', () => {
    expect(firstIncompleteStep({ ...base, classCount: 0 })).toBe(2)
  })
  it('never returns 4 (placement is no longer a setup step)', () => {
    expect(firstIncompleteStep({ ...base, classCount: 2, unplacedCount: 9 })).not.toBe(4)
  })
  it('returns 5 (finish) once a term and classes exist', () => {
    expect(firstIncompleteStep({ ...base, classCount: 2, unplacedCount: 9 })).toBe(5)
  })
})
