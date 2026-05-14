import { describe, it, expect } from 'vitest'
import { versionHash } from '@/lib/kiosk/versionHash'

describe('versionHash', () => {
  it('is stable for identical input', () => {
    const a = versionHash({
      slideIds: ['a', 'b'],
      slideUpdatedAts: ['2026-01-01', '2026-01-02'],
      day: '2026-05-14',
      broadcastAt: null,
      pushAt: null,
    })
    const b = versionHash({
      slideIds: ['a', 'b'],
      slideUpdatedAts: ['2026-01-01', '2026-01-02'],
      day: '2026-05-14',
      broadcastAt: null,
      pushAt: null,
    })
    expect(a).toEqual(b)
  })

  it('changes when a slide updatedAt changes', () => {
    const a = versionHash({
      slideIds: ['a'],
      slideUpdatedAts: ['2026-01-01'],
      day: '2026-05-14',
      broadcastAt: null,
      pushAt: null,
    })
    const b = versionHash({
      slideIds: ['a'],
      slideUpdatedAts: ['2026-01-02'],
      day: '2026-05-14',
      broadcastAt: null,
      pushAt: null,
    })
    expect(a).not.toEqual(b)
  })

  it('changes when pushAt bumps', () => {
    const base = {
      slideIds: ['a'],
      slideUpdatedAts: ['2026-01-01'],
      day: '2026-05-14',
      broadcastAt: null,
    }
    const a = versionHash({ ...base, pushAt: null })
    const b = versionHash({ ...base, pushAt: '2026-05-14T12:00:00Z' })
    expect(a).not.toEqual(b)
  })
})
