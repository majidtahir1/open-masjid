import { describe, it, expect } from 'vitest'
import { pickVariant, pickContent, VARIANTS } from '@/lib/kiosk/prayerDisplaySelection'
import type { ContentEntry } from '@/lib/kiosk/prayerContentSeeds'

const entry = (id: string): ContentEntry => ({
  id, kind: 'ayah', arabic: 'a', english: 'e', citation: 'c',
})

describe('pickVariant', () => {
  it('returns a valid variant', () => {
    expect(VARIANTS).toContain(pickVariant(null))
  })
  it('never repeats the previous variant', () => {
    for (let i = 0; i < 200; i++) {
      expect(pickVariant('cream')).not.toBe('cream')
      expect(pickVariant('night')).not.toBe('night')
      expect(pickVariant('mihrab')).not.toBe('mihrab')
    }
  })
})

describe('pickContent', () => {
  const pool = [entry('1'), entry('2'), entry('3')]
  it('returns null for an empty pool', () => {
    expect(pickContent([], [])).toBeNull()
  })
  it('avoids ids already seen this session', () => {
    const picked = pickContent(pool, ['1', '2'])
    expect(picked?.id).toBe('3')
  })
  it('falls back to the full pool once everything has been seen', () => {
    const picked = pickContent(pool, ['1', '2', '3'])
    expect(picked).not.toBeNull()
    expect(['1', '2', '3']).toContain(picked!.id)
  })
})
