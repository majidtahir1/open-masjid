import { describe, expect, it } from 'vitest'
import { computeAdhanTimes, type AdhanMethod, type AsrMadhab } from '@/lib/adhan'

describe('computeAdhanTimes', () => {
  it('returns formatted times for a known date/location (ICP Prosper, ISNA, Standard, 2026-06-15)', () => {
    const result = computeAdhanTimes({
      lat: 33.2257,
      lng: -96.7969,
      timezone: 'America/Chicago',
      method: 'ISNA',
      madhab: 'Standard',
      date: new Date('2026-06-15T12:00:00Z'),
    })
    expect(result.fajr).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/)
    expect(result.isha).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/)
    expect(result.fajr).not.toBe(result.isha)
  })

  it('respects Hanafi asr madhab (Hanafi asr differs from Standard)', () => {
    const args = {
      lat: 33.2257,
      lng: -96.7969,
      timezone: 'America/Chicago',
      method: 'ISNA' as AdhanMethod,
      date: new Date('2026-06-15T12:00:00Z'),
    }
    const standard = computeAdhanTimes({ ...args, madhab: 'Standard' as AsrMadhab })
    const hanafi = computeAdhanTimes({ ...args, madhab: 'Hanafi' as AsrMadhab })
    expect(standard.asr).not.toBe(hanafi.asr)
  })

  it('formats times without leading zero on hour', () => {
    const result = computeAdhanTimes({
      lat: 33.2257,
      lng: -96.7969,
      timezone: 'America/Chicago',
      method: 'ISNA',
      madhab: 'Standard',
      date: new Date('2026-06-15T12:00:00Z'),
    })
    expect(result.fajr).not.toMatch(/^0\d:/)
  })
})
