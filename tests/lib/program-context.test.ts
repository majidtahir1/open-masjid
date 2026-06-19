import { describe, it, expect } from 'vitest'
import { resolveProgramId } from '@/lib/program-context'

const programs = [
  { id: 1, status: 'active', startDate: '2026-01-04' },
  { id: 2, status: 'active', startDate: '2026-09-06' }, // newest active
  { id: 3, status: 'archived', startDate: '2026-12-01' }, // newest overall but archived
]

describe('resolveProgramId', () => {
  it('returns the requested program when it exists', () => {
    expect(resolveProgramId('1', programs)).toBe(1)
  })
  it('falls back to the newest active when requested is missing/unknown', () => {
    expect(resolveProgramId(null, programs)).toBe(2)
    expect(resolveProgramId('999', programs)).toBe(2)
  })
  it('"new" resolves to null (create mode)', () => {
    expect(resolveProgramId('new', programs)).toBeNull()
  })
  it('falls back to newest of any status when none active', () => {
    expect(resolveProgramId(null, [{ id: 7, status: 'archived', startDate: '2026-03-01' }, { id: 8, status: 'archived', startDate: '2026-06-01' }])).toBe(8)
  })
  it('null when there are no programs', () => {
    expect(resolveProgramId(null, [])).toBeNull()
  })
})
