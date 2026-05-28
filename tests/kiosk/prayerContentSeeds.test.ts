import { describe, it, expect } from 'vitest'
import { PRAYER_CONTENT_SEEDS, prayerContentSeedRows } from '@/lib/kiosk/prayerContentSeeds'

describe('prayerContentSeedRows', () => {
  it('maps every seed to a create row scoped to the tenant', () => {
    const rows = prayerContentSeedRows(1)
    expect(rows).toHaveLength(PRAYER_CONTENT_SEEDS.length)
    for (const r of rows) {
      expect(r.tenant).toBe(1)
      expect(r.active).toBe(true)
    }
  })

  it('carries kind/arabic/english/citation and drops the in-code id', () => {
    const rows = prayerContentSeedRows(7)
    expect(rows[0]).toEqual({
      tenant: 7,
      kind: PRAYER_CONTENT_SEEDS[0].kind,
      arabic: PRAYER_CONTENT_SEEDS[0].arabic,
      english: PRAYER_CONTENT_SEEDS[0].english,
      citation: PRAYER_CONTENT_SEEDS[0].citation,
      active: true,
    })
    expect('id' in rows[0]).toBe(false)
  })
})
