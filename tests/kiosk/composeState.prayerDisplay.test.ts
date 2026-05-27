import { describe, it, expect } from 'vitest'
import { resolveContentPool } from '@/lib/kiosk/composeState'
import { PRAYER_CONTENT_SEEDS } from '@/lib/kiosk/prayerContentSeeds'

describe('resolveContentPool', () => {
  it('maps active docs to ContentEntry shape', () => {
    const pool = resolveContentPool([
      { id: 7, kind: 'ayah', arabic: 'a', english: 'e', citation: 'c', active: true },
    ] as any)
    expect(pool).toEqual([{ id: '7', kind: 'ayah', arabic: 'a', english: 'e', citation: 'c' }])
  })
  it('drops inactive docs but keeps active ones', () => {
    const pool = resolveContentPool([
      { id: 1, kind: 'ayah', arabic: 'a', english: 'e', citation: '', active: false },
      { id: 2, kind: 'hadith', arabic: 'b', english: 'f', citation: '', active: true },
    ] as any)
    expect(pool).toEqual([{ id: '2', kind: 'hadith', arabic: 'b', english: 'f', citation: '' }])
  })
  it('falls back to seeds when no active docs', () => {
    expect(resolveContentPool([])).toEqual(PRAYER_CONTENT_SEEDS)
  })
})
